-- =====================================================
-- Enable security-alert-processor cron job
-- =====================================================
-- GRD-1 from guardian-system-tracker.md
--
-- Background: security-alert-processor edge function was fully built
-- (516 lines, Slack/SMS/email/internal notification channels) but the
-- cron that triggers it was left as commented-out documentation in
-- migration 20251203000002. Critical alerts sat in security_alerts
-- with no multi-channel delivery, so the SOC team was only receiving
-- direct emails from guardian-agent (critical/high only).
--
-- This migration schedules the cron to fire every minute and pass the
-- cron secret as a Bearer token. The secret is read from Supabase Vault
-- to avoid hardcoding. If the vault secret is not set, the cron job
-- will still be scheduled but the edge function will reject the call
-- with 401 — no silent bypass.
--
-- Setup required (one-time, run BEFORE this migration or immediately after):
--   1. Generate a long random secret:
--        openssl rand -hex 32
--   2. Store it in Supabase Vault:
--        SELECT vault.create_secret('<generated-secret>', 'cron_secret', 'Shared secret for pg_cron → edge function auth');
--   3. Store the same value as an edge function env var:
--        npx supabase secrets set CRON_SECRET=<generated-secret>
--
-- Regression check:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'security-alert-processor';
-- =====================================================

-- Ensure pg_cron + pg_net extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule any prior version to make this migration idempotent
DO $$
BEGIN
  PERFORM cron.unschedule('security-alert-processor');
EXCEPTION WHEN OTHERS THEN
  -- Job did not exist — fine
  NULL;
END $$;

-- Schedule the cron job to call the edge function every minute.
-- Reads the cron secret from vault.decrypted_secrets. If the vault
-- secret is missing, this will pass NULL and the edge function will
-- reject with 401 (safe default — no silent bypass).
SELECT cron.schedule(
  'security-alert-processor',
  '* * * * *',  -- every minute
  $$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/security-alert-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Record the operational change in audit_logs so SOC/ops has a trail
INSERT INTO public.audit_logs (
  event_type,
  severity,
  message,
  metadata
)
VALUES (
  'CRON_JOB_ENABLED',
  'INFO',
  'security-alert-processor cron scheduled (every minute)',
  jsonb_build_object(
    'tracker', 'GRD-1',
    'migration', '20260421120000_enable_security_alert_processor_cron',
    'schedule', '* * * * *',
    'purpose', 'Multi-channel security alert notification (email/SMS/Slack/internal)',
    'auth_method', 'bearer_token_from_vault',
    'cron_job', 'security-alert-processor'
  )
);

COMMENT ON EXTENSION pg_cron IS 'Scheduled jobs — see cron.job for active schedule';
