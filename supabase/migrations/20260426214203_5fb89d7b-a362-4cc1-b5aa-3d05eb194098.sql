-- 1) Dia de cobrança individual por tenant
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS billing_day integer NOT NULL DEFAULT 5
    CHECK (billing_day BETWEEN 1 AND 28);

-- 2) Novo tipo de orçamento: alteração de dia de cobrança
-- O enum quote_billing_type pode ainda não existir como nome — descobrir e estender
DO $$
DECLARE
  enum_name text;
BEGIN
  SELECT t.typname INTO enum_name
  FROM pg_type t
  JOIN pg_attribute a ON a.atttypid = t.oid
  JOIN pg_class c ON c.oid = a.attrelid
  WHERE c.relname = 'service_quotes' AND a.attname = 'billing_type';

  IF enum_name IS NOT NULL THEN
    -- Adiciona valor se ainda não existir
    BEGIN
      EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', enum_name, 'billing_change');
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END $$;

-- 3) Campos extras em service_quotes
ALTER TABLE public.service_quotes
  ADD COLUMN IF NOT EXISTS proration_amount integer,
  ADD COLUMN IF NOT EXISTS proposed_billing_day integer
    CHECK (proposed_billing_day IS NULL OR proposed_billing_day BETWEEN 1 AND 28);

-- amount pode ser 0 para billing_change — relaxar NOT NULL não é necessário, usaremos 0
-- 4) Atualizar decide_quote() com prorata + aplicação de billing_change
CREATE OR REPLACE FUNCTION public.decide_quote(_quote_id uuid, _decision text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote public.service_quotes;
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_billing_day integer;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_next_due date;
  v_days_remaining integer;
  v_prorata integer := 0;
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

  SELECT owner_id, billing_day INTO v_owner, v_billing_day
  FROM public.tenants WHERE id = v_quote.tenant_id;

  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF v_quote.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_decided');
  END IF;

  v_new_status := _decision::public.quote_status;

  IF v_new_status = 'accepted' THEN
    -- Caso 1: alteração de dia de cobrança
    IF v_quote.billing_type::text = 'billing_change' THEN
      IF v_quote.proposed_billing_day IS NOT NULL THEN
        UPDATE public.tenants
        SET billing_day = v_quote.proposed_billing_day
        WHERE id = v_quote.tenant_id;
      END IF;
    ELSE
      -- Caso 2: serviço normal — calcular prorata
      v_next_due := make_date(
        EXTRACT(year FROM v_today)::int,
        EXTRACT(month FROM v_today)::int,
        v_billing_day
      );
      IF EXTRACT(day FROM v_today)::int >= v_billing_day THEN
        v_next_due := (v_next_due + interval '1 month')::date;
      END IF;
      v_days_remaining := (v_next_due - v_today);
      IF v_days_remaining > 0 AND v_days_remaining < 30 THEN
        v_prorata := floor((v_quote.amount::numeric * v_days_remaining) / 30)::int;
      END IF;

      UPDATE public.service_quotes
      SET proration_amount = v_prorata
      WHERE id = _quote_id;
    END IF;
  END IF;

  UPDATE public.service_quotes
  SET status = v_new_status, decided_at = now()
  WHERE id = _quote_id;

  INSERT INTO public.notifications (target_user_id, title, message, type, created_by)
  VALUES (
    v_quote.created_by,
    CASE WHEN v_new_status = 'accepted' THEN 'Proposta aceita' ELSE 'Proposta recusada' END,
    'O cliente ' || (CASE WHEN v_new_status = 'accepted' THEN 'aceitou' ELSE 'recusou' END)
      || ' a proposta "' || v_quote.name || '".',
    'system',
    v_uid
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', v_new_status,
    'proration_amount', v_prorata
  );
END;
$function$;

-- 5) Remover configurações globais de faturamento (mantém as de cloud-usage)
DELETE FROM public.app_settings
WHERE key IN ('monthly_base_amount', 'closing_day');
