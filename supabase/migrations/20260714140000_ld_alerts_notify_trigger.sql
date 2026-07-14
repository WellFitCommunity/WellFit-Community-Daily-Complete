-- Wire ld-alert-notifier to ld_alerts (island fix, Maria-directed 2026-07-14).
--
-- The ld-alert-notifier edge function ("Triggered when a critical/high
-- severity alert is persisted in ld_alerts") was deployed with NO trigger,
-- cron, or invoker — critical Labor & Delivery alerts persisted silently and
-- nobody was ever notified. This adds the AFTER INSERT trigger the function's
-- own header presumes.
--
-- The trigger fires only for critical/high severity (the function also
-- re-checks severity server-side). net.http_post is async (pg_net queue) —
-- the insert never blocks or fails on notification problems.
--
-- SECURITY DEFINER + fixed search_path so the inserting role does not need
-- direct vault read privileges. The function sends the Vault sb_secret_key
-- as a Bearer; ld-alert-notifier now enforces that secret (added same
-- commit — it was previously an OPEN external-messaging endpoint).
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

CREATE OR REPLACE FUNCTION public.notify_ld_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.severity IN ('critical', 'high') THEN
    PERFORM net.http_post(
      url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/ld-alert-notifier',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sb_secret_key' LIMIT 1),
          ''
        )
      ),
      body := jsonb_build_object(
        'alert_id', NEW.id,
        'patient_id', NEW.patient_id,
        'tenant_id', NEW.tenant_id,
        'alert_type', NEW.alert_type,
        'severity', NEW.severity,
        'message', NEW.message
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Execution is via trigger only — no direct role EXECUTE needed.
REVOKE EXECUTE ON FUNCTION public.notify_ld_alert() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_ld_alert ON public.ld_alerts;
CREATE TRIGGER trg_notify_ld_alert
AFTER INSERT ON public.ld_alerts
FOR EACH ROW EXECUTE FUNCTION public.notify_ld_alert();
