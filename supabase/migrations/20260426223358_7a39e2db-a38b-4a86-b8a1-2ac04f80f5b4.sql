CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status
ON public.invoices(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_due
ON public.invoices(tenant_id, due_date DESC);