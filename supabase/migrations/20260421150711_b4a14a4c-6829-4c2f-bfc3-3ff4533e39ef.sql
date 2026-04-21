-- ============ app_settings ============
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage settings"
ON public.app_settings FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

INSERT INTO public.app_settings (key, value) VALUES
  ('monthly_base_amount', '9900'::jsonb),
  ('invoice_closing_day', '5'::jsonb);

-- ============ service_quotes ============
CREATE TYPE public.quote_status AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE public.quote_billing_type AS ENUM ('recurring', 'lifetime');

CREATE TABLE public.service_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  amount integer NOT NULL CHECK (amount >= 0),
  billing_type public.quote_billing_type NOT NULL,
  recurrence_months integer CHECK (recurrence_months IS NULL OR (recurrence_months > 0 AND recurrence_months <= 60)),
  status public.quote_status NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_quotes_tenant_status ON public.service_quotes(tenant_id, status);

ALTER TABLE public.service_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owners view quotes"
ON public.service_quotes FOR SELECT
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id = service_quotes.tenant_id AND t.owner_id = auth.uid()
  )
);

CREATE POLICY "Admins manage quotes"
ON public.service_quotes FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============ invoices ============
CREATE TYPE public.invoice_status AS ENUM ('open', 'closed', 'paid');
CREATE TYPE public.invoice_item_kind AS ENUM ('base', 'quote_recurring', 'quote_lifetime');

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  base_amount integer NOT NULL DEFAULT 0,
  extras_amount integer NOT NULL DEFAULT 0,
  total_amount integer NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_start)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owners view invoices"
ON public.invoices FOR SELECT
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id = invoices.tenant_id AND t.owner_id = auth.uid()
  )
);

CREATE POLICY "Admins manage invoices"
ON public.invoices FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.service_quotes(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount integer NOT NULL,
  kind public.invoice_item_kind NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owners view invoice items"
ON public.invoice_items FOR SELECT
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.tenants t ON t.id = i.tenant_id
    WHERE i.id = invoice_items.invoice_id AND t.owner_id = auth.uid()
  )
);

CREATE POLICY "Admins manage invoice items"
ON public.invoice_items FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============ decide_quote RPC ============
CREATE OR REPLACE FUNCTION public.decide_quote(_quote_id uuid, _decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote public.service_quotes;
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_new_status public.quote_status;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF _decision NOT IN ('accepted', 'declined') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_decision');
  END IF;

  SELECT * INTO v_quote FROM public.service_quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'quote_not_found');
  END IF;

  SELECT owner_id INTO v_owner FROM public.tenants WHERE id = v_quote.tenant_id;
  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF v_quote.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_decided');
  END IF;

  v_new_status := _decision::public.quote_status;

  UPDATE public.service_quotes
  SET status = v_new_status, decided_at = now()
  WHERE id = _quote_id;

  INSERT INTO public.notifications (target_user_id, title, message, type, created_by)
  VALUES (
    v_quote.created_by,
    CASE WHEN v_new_status = 'accepted' THEN 'Orçamento aceito' ELSE 'Orçamento recusado' END,
    'O cliente ' || (CASE WHEN v_new_status = 'accepted' THEN 'aceitou' ELSE 'recusou' END)
      || ' o orçamento "' || v_quote.name || '".',
    'system',
    v_uid
  );

  RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$;

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_quotes;