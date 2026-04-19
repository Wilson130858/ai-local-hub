
-- 1. profiles.status
CREATE TYPE public.profile_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE public.profiles
  ADD COLUMN status public.profile_status NOT NULL DEFAULT 'pending';

-- Aprovar todos os perfis existentes (não quebrar acesso atual)
UPDATE public.profiles SET status = 'approved';

-- 2. profiles.category -> text
ALTER TABLE public.profiles
  ALTER COLUMN category TYPE text USING category::text;

-- (mantém o enum business_category para não quebrar types, mas coluna vira text)

-- 3. credit_vouchers: limite de usos
ALTER TABLE public.credit_vouchers
  ADD COLUMN max_uses integer,
  ADD COLUMN uses_count integer NOT NULL DEFAULT 0;

-- Para vouchers antigos já usados, refletir no contador
UPDATE public.credit_vouchers SET uses_count = 1, max_uses = 1 WHERE is_used = true;

-- 4. tabela voucher_redemptions (1x por usuário)
CREATE TABLE public.voucher_redemptions (
  voucher_id uuid NOT NULL REFERENCES public.credit_vouchers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  value_at_redemption integer NOT NULL,
  PRIMARY KEY (voucher_id, user_id)
);

ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemptions"
  ON public.voucher_redemptions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins manage redemptions"
  ON public.voucher_redemptions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. nova função redeem_voucher
CREATE OR REPLACE FUNCTION public.redeem_voucher(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_voucher public.credit_vouchers;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_voucher FROM public.credit_vouchers WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  -- já resgatado por este usuário?
  IF EXISTS (SELECT 1 FROM public.voucher_redemptions WHERE voucher_id = v_voucher.id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed_by_user');
  END IF;

  -- limite de usos atingido?
  IF v_voucher.max_uses IS NOT NULL AND v_voucher.uses_count >= v_voucher.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'max_uses_reached');
  END IF;

  -- registra resgate
  INSERT INTO public.voucher_redemptions (voucher_id, user_id, value_at_redemption)
  VALUES (v_voucher.id, v_uid, v_voucher.value);

  -- incrementa contador; marca is_used quando atinge o limite
  UPDATE public.credit_vouchers
  SET uses_count = uses_count + 1,
      is_used = CASE WHEN max_uses IS NOT NULL AND uses_count + 1 >= max_uses THEN true ELSE is_used END,
      used_by = COALESCE(used_by, v_uid),
      used_at = COALESCE(used_at, now())
  WHERE id = v_voucher.id;

  -- credita valor (em centavos)
  UPDATE public.profiles
  SET credits = credits + v_voucher.value
  WHERE id = v_uid;

  RETURN jsonb_build_object('success', true, 'value', v_voucher.value);
END;
$$;

-- 6. handle_new_user: admin master entra como approved
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.email = 'wilson.ribeiro.nascimento@gmail.com' THEN 'approved'::public.profile_status ELSE 'pending'::public.profile_status END
  );

  IF NEW.email = 'wilson.ribeiro.nascimento@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;
