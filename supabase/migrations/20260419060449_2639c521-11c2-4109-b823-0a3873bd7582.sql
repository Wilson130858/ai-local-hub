
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.business_category AS ENUM ('barbearia', 'clinica', 'petshop');
CREATE TYPE public.lead_status AS ENUM ('pendente', 'agendado', 'cancelado');
CREATE TYPE public.notification_type AS ENUM ('system', 'alert');

-- =========================================================
-- TIMESTAMP TRIGGER FUNCTION
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  category public.business_category,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER ROLES (separate table to avoid privilege escalation)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- =========================================================
-- TENANTS
-- =========================================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  ai_config JSONB NOT NULL DEFAULT '{"tone":"profissional","rules":""}'::jsonb,
  google_calendar_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tenants_owner ON public.tenants(owner_id);

CREATE TRIGGER tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- LEADS
-- =========================================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status public.lead_status NOT NULL DEFAULT 'pendente',
  origin TEXT DEFAULT 'whatsapp',
  original_query TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_leads_tenant ON public.leads(tenant_id);
CREATE INDEX idx_leads_created ON public.leads(created_at DESC);

-- =========================================================
-- CREDIT VOUCHERS
-- =========================================================
CREATE TABLE public.credit_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  value INTEGER NOT NULL CHECK (value > 0),
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID REFERENCES public.profiles(id),
  used_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_vouchers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_vouchers_code ON public.credit_vouchers(code);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'system',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_target ON public.notifications(target_user_id, is_read);

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_admin ON public.audit_logs(admin_id, created_at DESC);

-- =========================================================
-- RLS POLICIES — PROFILES
-- =========================================================
CREATE POLICY "Users view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins insert profiles" ON public.profiles
FOR INSERT WITH CHECK (public.is_admin() OR auth.uid() = id);

CREATE POLICY "Admins delete profiles" ON public.profiles
FOR DELETE USING (public.is_admin());

-- =========================================================
-- RLS POLICIES — USER ROLES
-- =========================================================
CREATE POLICY "Users view own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Only admins manage roles" ON public.user_roles
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================
-- RLS POLICIES — TENANTS
-- =========================================================
CREATE POLICY "Owners view tenants" ON public.tenants
FOR SELECT USING (auth.uid() = owner_id OR public.is_admin());

CREATE POLICY "Owners insert tenants" ON public.tenants
FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update tenants" ON public.tenants
FOR UPDATE USING (auth.uid() = owner_id OR public.is_admin());

CREATE POLICY "Owners delete tenants" ON public.tenants
FOR DELETE USING (auth.uid() = owner_id OR public.is_admin());

-- =========================================================
-- RLS POLICIES — LEADS
-- =========================================================
CREATE POLICY "Tenant owners view leads" ON public.leads
FOR SELECT USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
);

CREATE POLICY "Tenant owners insert leads" ON public.leads
FOR INSERT WITH CHECK (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
);

CREATE POLICY "Tenant owners update leads" ON public.leads
FOR UPDATE USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
);

CREATE POLICY "Tenant owners delete leads" ON public.leads
FOR DELETE USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
);

-- =========================================================
-- RLS POLICIES — CREDIT VOUCHERS
-- =========================================================
CREATE POLICY "Admins manage vouchers" ON public.credit_vouchers
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users view their redeemed vouchers" ON public.credit_vouchers
FOR SELECT USING (used_by = auth.uid());

-- =========================================================
-- RLS POLICIES — NOTIFICATIONS
-- =========================================================
CREATE POLICY "Users view own notifications" ON public.notifications
FOR SELECT USING (auth.uid() = target_user_id OR public.is_admin());

CREATE POLICY "Users update own notifications" ON public.notifications
FOR UPDATE USING (auth.uid() = target_user_id OR public.is_admin());

CREATE POLICY "Admins create notifications" ON public.notifications
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete notifications" ON public.notifications
FOR DELETE USING (public.is_admin());

-- =========================================================
-- RLS POLICIES — AUDIT LOGS
-- =========================================================
CREATE POLICY "Admins view audit logs" ON public.audit_logs
FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins insert audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (public.is_admin() AND admin_id = auth.uid());

-- =========================================================
-- HANDLE NEW USER (auto profile + role + master admin)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  IF NEW.email = 'wilson.ribeiro.nascimento@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- REDEEM VOUCHER (atomic)
-- =========================================================
CREATE OR REPLACE FUNCTION public.redeem_voucher(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher public.credit_vouchers;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_voucher FROM public.credit_vouchers WHERE code = _code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_voucher.is_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;

  UPDATE public.credit_vouchers
  SET is_used = true, used_by = auth.uid(), used_at = now()
  WHERE id = v_voucher.id;

  UPDATE public.profiles
  SET credits = credits + v_voucher.value
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true, 'value', v_voucher.value);
END;
$$;
