-- Migration: fix the security-alert-processor cron auth (same root cause as guardian)
--
-- The per-minute `security-alert-processor` cron (jobid 50) sent
--   Authorization: Bearer <vault.cron_secret>
-- but Vault has NO `cron_secret` (confirmed: vault holds only app_encryption_key,
-- MAILERSEND_API_KEY, sb_secret_key, SMTP creds). So it sent `Bearer ` (empty) and
-- 401'd at the gateway every minute — security alert notifications never processed.
--
-- The function already authorizes EITHER X-Cron-Secret / Bearer == CRON_SECRET or the
-- new SB_SECRET_KEY. Paired with config.toml ([functions.security-alert-processor]
-- verify_jwt=false, so the non-JWT secret isn't rejected at the gateway), re-point the
-- cron at the existing `vault.sb_secret_key` — the same new-format key the guardian
-- monitoring trigger uses. No new secret to provision; matches the function's
-- SB_SECRET_KEY env byte-for-byte (verified sha256 7e386f73…).
--
-- The new sb_secret_* key is deliberately used here, NOT the legacy JWT service-role
-- key — a separate, deprecated credential (CLAUDE.md supabase §14).

SELECT cron.schedule(
  'security-alert-processor',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/security-alert-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sb_secret_key' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
