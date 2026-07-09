-- Guardian alert escalation policy fix (Maria-directed 2026-07-09).
--
-- BEFORE: check_alert_escalation() escalated EVERY 'new' alert older than 15 minutes,
-- regardless of severity or alert_type. Combined with un-deduplicated slow_query
-- alerts (one identical row per 5-minute cron tick), this escalated 41,356
-- low-severity slow-query rows — 99.9% of ALL security_alerts read 'escalated',
-- which destroyed the severity signal (a real critical would be one row among 41k
-- escalated low-severity dupes).
--
-- Live investigation (2026-07-09) proved the flagged "slow queries" are Supabase's
-- own schema-introspection queries (the table/view editor + MCP list_tables over 761
-- tables) + a one-off pg_net response read — NOT application code. slow_query is
-- therefore permanent noise that must never escalate.
--
-- AFTER:
--   * slow_query alerts NEVER escalate.
--   * medium / high / critical: keep the 15-minute-unaddressed age rule.
--   * low severity: escalate only after 20 UNADDRESSED occurrences
--     (occurrence_count >= 20), which the guardian-agent dedup now accumulates on a
--     single row instead of spawning duplicates.
--
-- No `-- migrate:down` block by design: `supabase db push` executes down blocks too
-- (documented footgun — see PROJECT_STATE / memory). This is a forward-only
-- CREATE OR REPLACE; the prior definition is preserved in git history.

CREATE OR REPLACE FUNCTION public.check_alert_escalation()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  alert_record RECORD;
  escalation_threshold INTERVAL := '15 minutes';
  low_occurrence_threshold INTEGER := 20;
BEGIN
  FOR alert_record IN
    SELECT id, severity, created_at, escalation_level
    FROM security_alerts
    WHERE status = 'new'
      AND escalated = false
      AND alert_type <> 'slow_query'          -- introspection noise: never escalate
      AND (
        -- medium/high/critical: unaddressed for 15 minutes
        (severity <> 'low' AND created_at < NOW() - escalation_threshold)
        OR
        -- low: only after recurring 20x without being addressed
        (severity = 'low' AND COALESCE(occurrence_count, 1) >= low_occurrence_threshold)
      )
  LOOP
    UPDATE security_alerts
    SET
      escalated = true,
      escalated_at = NOW(),
      escalation_level = COALESCE(alert_record.escalation_level, 0) + 1,
      status = 'escalated',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'escalation_reason',
        CASE
          WHEN alert_record.severity = 'low'
            THEN 'Low-severity alert recurred >= 20 times without response'
          ELSE 'No response within 15 minutes'
        END,
        'escalated_at', NOW()
      ),
      updated_at = NOW()
    WHERE id = alert_record.id;
  END LOOP;
END;
$function$;
