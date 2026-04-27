-- Adiciona campos OAuth do Google Calendar na tabela tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS google_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_access_token text,
  ADD COLUMN IF NOT EXISTS google_token_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS google_email text,
  ADD COLUMN IF NOT EXISTS google_calendar_id text DEFAULT 'primary';

-- Enum de status de agendamento
DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.appointment_source AS ENUM ('panel', 'whatsapp', 'google');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de agendamentos
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  title text NOT NULL,
  description text,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  google_event_id text,
  source public.appointment_source NOT NULL DEFAULT 'panel',
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_start ON public.appointments(tenant_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_google_event ON public.appointments(google_event_id);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owners view appointments"
  ON public.appointments FOR SELECT
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id = appointments.tenant_id AND t.owner_id = auth.uid()
  ));

CREATE POLICY "Tenant owners insert appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id = appointments.tenant_id AND t.owner_id = auth.uid()
  ));

CREATE POLICY "Tenant owners update appointments"
  ON public.appointments FOR UPDATE
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id = appointments.tenant_id AND t.owner_id = auth.uid()
  ));

CREATE POLICY "Tenant owners delete appointments"
  ON public.appointments FOR DELETE
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id = appointments.tenant_id AND t.owner_id = auth.uid()
  ));

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();