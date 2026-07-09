-- Schedule the health-monitor watchdog (Maria-directed 2026-07-09, GRD/#4).
--
-- health-monitor checks all registered agents (agent_registry: 10 agents, 6 critical),
-- records health results, attempts recovery, and — on a CRITICAL agent failure —
-- calls guardian-agent action:'record', which is the ONLY writer of
-- guardian_eyes_recordings. It had NO cron, so the entire watchdog + auto-recovery +
-- Guardian-Eyes-on-incident path was dormant (guardian_eyes_recordings = 0 rows ever).
--
-- Auth: the function is pinned verify_jwt=false (config.toml) and now enforces a
-- cron-secret check for no-Origin callers (mirrors guardian-agent). The cron sends the
-- new-format sb_secret_key from Vault as a Bearer token — same pattern as the existing
-- guardian-daily-summary / security-alert-processor crons.
--
-- Cadence: every 15 minutes.
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

-- cron.schedule upserts by job name, but unschedule-if-exists keeps re-runs clean.
SELECT cron.unschedule('health-monitor-checks')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'health-monitor-checks');

SELECT cron.schedule(
  'health-monitor-checks',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/health-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sb_secret_key' LIMIT 1),
        ''
      )
    ),
    body := jsonb_build_object('action', 'check_all')
  );
  $$
);
