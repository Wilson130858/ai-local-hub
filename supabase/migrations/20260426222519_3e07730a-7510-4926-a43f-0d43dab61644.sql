-- Restrict credit_vouchers SELECT policy to authenticated role only
DROP POLICY IF EXISTS "Users view their redeemed vouchers" ON public.credit_vouchers;
CREATE POLICY "Users view their redeemed vouchers"
ON public.credit_vouchers
FOR SELECT
TO authenticated
USING (used_by = auth.uid());

-- Remove service_quotes from realtime publication to prevent cross-tenant broadcast
ALTER PUBLICATION supabase_realtime DROP TABLE public.service_quotes;