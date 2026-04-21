-- 1) Tighten profiles UPDATE: prevent self-escalation of credits/status by non-admins
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
USING ((auth.uid() = id) OR public.is_admin())
WITH CHECK (
  public.is_admin()
  OR (
    auth.uid() = id
    AND credits IS NOT DISTINCT FROM (SELECT p.credits FROM public.profiles p WHERE p.id = auth.uid())
    AND status  IS NOT DISTINCT FROM (SELECT p.status  FROM public.profiles p WHERE p.id = auth.uid())
  )
);

-- Defense in depth: revoke direct column updates on sensitive fields
REVOKE UPDATE (credits, status) ON public.profiles FROM anon, authenticated;

-- 2) Remove hardcoded admin email from handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'pending'::public.profile_status
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$function$;