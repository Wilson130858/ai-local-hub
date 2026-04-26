CREATE OR REPLACE FUNCTION public.install_close_invoices_cron(_function_url text, _cron_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, cron, net
AS $$
DECLARE
  v_job_id bigint;
BEGIN
  -- Permite service_role (chamada da edge function, que já validou admin) OU admin via JWT
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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