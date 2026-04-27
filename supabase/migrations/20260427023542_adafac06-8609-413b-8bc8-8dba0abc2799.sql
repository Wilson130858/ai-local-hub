ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS dashboard_config jsonb NOT NULL DEFAULT jsonb_build_object(
  'metrics', jsonb_build_array('faturamento_dia','leads_gerados','agendamentos_hoje','ticket_medio')
);