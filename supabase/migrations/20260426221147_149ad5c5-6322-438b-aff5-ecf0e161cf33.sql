CREATE OR REPLACE FUNCTION public.decide_quote(_quote_id uuid, _decision text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote public.service_quotes;
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_billing_day integer;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_next_due date;
  v_days_remaining integer;
  v_prorata integer := 0;
  v_new_status public.quote_status;
  v_q record;
  v_new_day integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF _decision NOT IN ('accepted', 'declined') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_decision');
  END IF;

  SELECT * INTO v_quote FROM public.service_quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'quote_not_found');
  END IF;

  SELECT owner_id, billing_day INTO v_owner, v_billing_day
  FROM public.tenants WHERE id = v_quote.tenant_id;

  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF v_quote.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_decided');
  END IF;

  v_new_status := _decision::public.quote_status;

  IF v_new_status = 'accepted' THEN
    -- Caso 1: alteração de dia de cobrança
    IF v_quote.billing_type::text = 'billing_change' THEN
      IF v_quote.proposed_billing_day IS NOT NULL THEN
        v_new_day := v_quote.proposed_billing_day;

        UPDATE public.tenants
        SET billing_day = v_new_day
        WHERE id = v_quote.tenant_id;

        -- Recalcula prorratas dos quotes aceitos no mês corrente com o novo dia
        FOR v_q IN
          SELECT id, amount, decided_at
          FROM public.service_quotes
          WHERE tenant_id = v_quote.tenant_id
            AND status = 'accepted'
            AND billing_type::text <> 'billing_change'
            AND decided_at IS NOT NULL
            AND date_trunc('month', (decided_at AT TIME ZONE 'America/Sao_Paulo'))
                = date_trunc('month', (now()       AT TIME ZONE 'America/Sao_Paulo'))
        LOOP
          v_next_due := make_date(
            EXTRACT(year FROM v_today)::int,
            EXTRACT(month FROM v_today)::int,
            v_new_day
          );
          IF EXTRACT(day FROM v_today)::int >= v_new_day THEN
            v_next_due := (v_next_due + interval '1 month')::date;
          END IF;
          v_days_remaining := (v_next_due - v_today);
          IF v_days_remaining > 0 AND v_days_remaining < 30 THEN
            v_prorata := floor((v_q.amount::numeric * v_days_remaining) / 30)::int;
          ELSE
            v_prorata := 0;
          END IF;

          UPDATE public.service_quotes
          SET proration_amount = v_prorata
          WHERE id = v_q.id;
        END LOOP;
      END IF;
    ELSE
      -- Caso 2: serviço normal — calcular prorata
      v_next_due := make_date(
        EXTRACT(year FROM v_today)::int,
        EXTRACT(month FROM v_today)::int,
        v_billing_day
      );
      IF EXTRACT(day FROM v_today)::int >= v_billing_day THEN
        v_next_due := (v_next_due + interval '1 month')::date;
      END IF;
      v_days_remaining := (v_next_due - v_today);
      IF v_days_remaining > 0 AND v_days_remaining < 30 THEN
        v_prorata := floor((v_quote.amount::numeric * v_days_remaining) / 30)::int;
      END IF;

      UPDATE public.service_quotes
      SET proration_amount = v_prorata
      WHERE id = _quote_id;
    END IF;
  END IF;

  UPDATE public.service_quotes
  SET status = v_new_status, decided_at = now()
  WHERE id = _quote_id;

  INSERT INTO public.notifications (target_user_id, title, message, type, created_by)
  VALUES (
    v_quote.created_by,
    CASE WHEN v_new_status = 'accepted' THEN 'Proposta aceita' ELSE 'Proposta recusada' END,
    'O cliente ' || (CASE WHEN v_new_status = 'accepted' THEN 'aceitou' ELSE 'recusou' END)
      || ' a proposta "' || v_quote.name || '".',
    'system',
    v_uid
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', v_new_status,
    'proration_amount', v_prorata
  );
END;
$function$;