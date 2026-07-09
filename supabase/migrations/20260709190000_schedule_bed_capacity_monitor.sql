-- Schedule the bed-capacity-monitor (Maria-directed 2026-07-09).
--
-- The function is designed as a "cron-triggered function that monitors bed capacity
-- across all facilities and creates alerts when thresholds are breached" (70/80/90/95%
-- -> charge nurse / bed control / administrator / divert), but it had NO cron and had
-- been dead on every call (BOOT_ERROR from a bad getEnv import, fixed in dd58db69).
-- Now that it boots (live re-probe: 200), schedule it so capacity alerting actually runs.
--
-- Auth: the function is pinned verify_jwt=false (config.toml) and now enforces a
-- cron-secret check for no-Origin callers (mirrors health-monitor / guardian-agent).
-- The cron sends the new-format sb_secret_key from Vault as a Bearer token.
--
-- Cadence: every 15 minutes (matches health-monitor; timely enough for divert alerts).
-- NOTE: with 0 facility capacity snapshots present, runs currently no-op
-- (facilities_checked: 0) until facility/capacity data exists — that's expected.
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

SELECT cron.unschedule('bed-capacity-monitor-checks')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bed-capacity-monitor-checks');

SELECT cron.schedule(
  'bed-capacity-monitor-checks',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/bed-capacity-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sb_secret_key' LIMIT 1),
        ''
      )
    ),
    body := jsonb_build_object('action', 'check_capacity')
  );
  $$
);
