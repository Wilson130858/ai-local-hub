CREATE OR REPLACE FUNCTION public.install_close_invoices_cron(_function_url text, _cron_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, cron, net
AS $$
DECLARE
  v_job_id bigint;
BEGIN
  -- Apenas admins podem instalar/recriar o agendamento
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Remove agendamento anterior se existir
  BEGIN
    PERFORM cron.unschedule('close-invoices-daily');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT cron.schedule(
    'close-invoices-daily',
    '0 6 * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', %L),
        body := '{}'::jsonb
      );
      $cmd$,
      _function_url,
      _cron_secret
    )
  ) INTO v_job_id;

  RETURN 'scheduled job_id=' || v_job_id::text;
END;
$$;

REVOKE ALL ON FUNCTION public.install_close_invoices_cron(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.install_close_invoices_cron(text, text) TO authenticated, service_role;