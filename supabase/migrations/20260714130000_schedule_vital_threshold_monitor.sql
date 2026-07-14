-- Schedule vital-threshold-monitor (island fix, Maria-directed 2026-07-14).
--
-- The function is designed as a "cron-triggered function that evaluates
-- RPM-enrolled patients' vitals against threshold rules and creates
-- guardian_alerts when thresholds are breached" — but no cron was ever
-- created (verified live: 0 cron.job rows), so RPM vital alerting has never
-- run. Same class as the bed-capacity-monitor / nurse-question-auto-escalate
-- findings (2026-07-09/10).
--
-- Auth: the function is pinned verify_jwt=false (config.toml) and now
-- enforces a cron-secret check (added same commit — it was previously an
-- open data-mutating endpoint). The cron sends the sb_secret_key from Vault.
--
-- Cadence: every 15 minutes (matches bed-capacity-monitor / health-monitor).
-- NOTE: with 0 active RPM enrollments live, runs no-op until enrollment data
-- exists — expected, same as the bed-capacity precedent.
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

SELECT cron.unschedule('vital-threshold-monitor-checks')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vital-threshold-monitor-checks');

SELECT cron.schedule(
  'vital-threshold-monitor-checks',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/vital-threshold-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sb_secret_key' LIMIT 1),
        ''
      )
    ),
    body := jsonb_build_object('action', 'check_vitals')
  );
  $$
);
