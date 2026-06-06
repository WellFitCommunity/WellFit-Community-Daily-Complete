-- Migration: give the guardian-daily-summary cron an Authorization header
--
-- Context: closing the guardian cron-auth gap. guardian-agent now runs with the
-- gateway's verify_jwt=false and enforces its OWN cron-secret auth in-function
-- (isAuthorizedServerCaller: X-Cron-Secret / Bearer == CRON_SECRET or the new
-- SB_SECRET_KEY). The per-5-min `guardian-automated-monitoring` job already sends
-- `Bearer <vault sb_secret_key>` via trigger_guardian_monitoring(), so it is covered.
--
-- BUT the `guardian-daily-summary` job (jobid 26) posted `{action:'analyze'}` with
-- NO Authorization header at all — it 401'd at the old gateway and would now be
-- rejected by the in-function cron check. Re-schedule it (upsert by name) to send
-- the same new-format secret key the monitoring trigger uses, read from Vault.
--
-- The new sb_secret_* key is NOT a JWT and is deliberately matched against the
-- function's SB_SECRET_KEY env — NOT the legacy JWT service-role key, which is a
-- separate, deprecated credential (CLAUDE.md supabase §14).

SELECT cron.schedule(
  'guardian-daily-summary',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/guardian-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sb_secret_key' LIMIT 1),
        ''
      )
    ),
    body := jsonb_build_object('action', 'analyze')
  );
  $$
);
