-- =============================================================================
-- Fix pg_net notify_telegram body parameter for jsonb
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_telegram(p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url        text := 'https://brvlvempavfiqyjbomjz.supabase.co/functions/v1/telegram-notify';
  v_anon_key   text := 'sb_publishable_Htd1CQw0mzwW6eWFR8yBUg_RlphBIXG';
  v_request_id bigint;
BEGIN
  SELECT net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey', v_anon_key
    ),
    body := p_payload
  ) INTO v_request_id;
  RAISE LOG '[notify_telegram] dispatched request_id=%', v_request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_telegram] failed: %', SQLERRM;
END;
$$;
