-- Schedule the nurse-question auto-escalation watchdog (Maria-directed 2026-07-10).
--
-- nurse-question-auto-escalate escalates stale nurse questions:
--   - unclaimed  > 2h  -> charge_nurse
--   - claimed, unanswered > 4h -> supervisor
-- Its own docstring says "Runs every 15 minutes via Supabase cron", but no cron job
-- was ever created, so the safety feature never ran (verified live 2026-07-10:
-- zero matching cron.job rows). Same class as the bed-capacity-monitor / health-monitor
-- "designed cron-triggered but never scheduled" findings from 2026-07-09.
--
-- Auth: the function is pinned verify_jwt=false (config.toml) and now enforces a
-- cron-secret check for ALL callers (isAuthorizedCronCaller — it is cron-only, no app
-- invoker). The cron sends the new-format sb_secret_key from Vault as a Bearer token —
-- same pattern as guardian-daily-summary / security-alert-processor / health-monitor.
--
-- Cadence: every 15 minutes (matches the cooldown/threshold design).
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

SELECT cron.unschedule('nurse-question-auto-escalate')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nurse-question-auto-escalate');

SELECT cron.schedule(
  'nurse-question-auto-escalate',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/nurse-question-auto-escalate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sb_secret_key' LIMIT 1),
        ''
      )
    ),
    body := jsonb_build_object('source', 'cron')
  );
  $$
);
