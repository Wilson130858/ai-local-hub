-- 1) notifications: add title column
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

-- 2) credit_vouchers: add is_paused column
ALTER TABLE public.credit_vouchers
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;

-- 3) Update redeem_voucher to honor is_paused
CREATE OR REPLACE FUNCTION public.redeem_voucher(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF v_voucher.is_paused THEN
    RETURN jsonb_build_object('success', false, 'error', 'voucher_paused');
  END IF;

  IF EXISTS (SELECT 1 FROM public.voucher_redemptions WHERE voucher_id = v_voucher.id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed_by_user');
  END IF;

  IF v_voucher.max_uses IS NOT NULL AND v_voucher.uses_count >= v_voucher.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'max_uses_reached');
  END IF;

  INSERT INTO public.voucher_redemptions (voucher_id, user_id, value_at_redemption)
  VALUES (v_voucher.id, v_uid, v_voucher.value);

  UPDATE public.credit_vouchers
  SET uses_count = uses_count + 1,
      is_used = CASE WHEN max_uses IS NOT NULL AND uses_count + 1 >= max_uses THEN true ELSE is_used END,
      used_by = COALESCE(used_by, v_uid),
      used_at = COALESCE(used_at, now())
  WHERE id = v_voucher.id;

  UPDATE public.profiles
  SET credits = credits + v_voucher.value
  WHERE id = v_uid;

  RETURN jsonb_build_object('success', true, 'value', v_voucher.value);
END;
$function$;

-- 4) Cascade delete: when a voucher is removed, drop its redemptions too
ALTER TABLE public.voucher_redemptions
  DROP CONSTRAINT IF EXISTS voucher_redemptions_voucher_id_fkey;

ALTER TABLE public.voucher_redemptions
  ADD CONSTRAINT voucher_redemptions_voucher_id_fkey
  FOREIGN KEY (voucher_id) REFERENCES public.credit_vouchers(id) ON DELETE CASCADE;