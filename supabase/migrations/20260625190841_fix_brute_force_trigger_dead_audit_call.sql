-- ============================================================================
-- Fix check_failed_login_threshold() — remove dead log_audit_event() call
-- ============================================================================
-- The AFTER INSERT trigger check_failed_login_threshold_trigger on
-- public.login_attempts creates a 'brute_force_attack' security_alert once an
-- identifier crosses 5 failed logins in 15 minutes. Its final step called
-- log_audit_event(...), but that function was DELIBERATELY DROPPED on
-- 2025-12-09 by 20251209110000_drop_broken_functions.sql.
--
-- Consequence: every time the threshold was crossed, the trigger threw
-- "function log_audit_event(...) does not exist", which rolled back the
-- INSERT into login_attempts. The brute-force alert has therefore NEVER fired,
-- and (now that record_login_attempt actually inserts rows) it also blocked the
-- account-lockout system from recording the 5th failed attempt.
--
-- Fix: remove the dead log_audit_event() call. This matches the established
-- remediation pattern in 20260529180000_restore_guardian_approve_reject_rpcs.sql,
-- which removed the same dead dependency from the Guardian RPCs. The
-- security_alerts row IS the alert; the supplementary audit-log write is dropped.
-- App-layer auditLogger still records auth events independently.
--
-- This is the ONLY remaining live function that called log_audit_event
-- (verified via pg_get_functiondef scan, 2026-06-25).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_failed_login_threshold()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  failed_count INTEGER;
  threshold INTEGER := 5;
  time_window INTERVAL := '15 minutes';
  existing_alert_id UUID;
BEGIN
  -- Only check on failed login attempts
  IF NEW.success = false THEN
    -- Count failed attempts in time window
    SELECT COUNT(*) INTO failed_count
    FROM login_attempts
    WHERE identifier = NEW.identifier
      AND success = false
      AND created_at > NOW() - time_window;

    -- Check if threshold exceeded
    IF failed_count >= threshold THEN
      -- Check for existing active alert
      SELECT id INTO existing_alert_id
      FROM security_alerts
      WHERE alert_type = 'brute_force_attack'
        AND status = 'new'
        AND metadata->>'identifier' = NEW.identifier
        AND created_at > NOW() - time_window
      LIMIT 1;

      -- Create alert if none exists
      IF existing_alert_id IS NULL THEN
        INSERT INTO security_alerts (
          severity,
          alert_type,
          title,
          description,
          metadata,
          status,
          affected_user_id,
          detection_method,
          threshold_value,
          actual_value,
          source_ip
        ) VALUES (
          'high',
          'brute_force_attack',
          'Failed Login Threshold Exceeded',
          format('Account %s has %s failed login attempts in the last 15 minutes',
                 NEW.identifier, failed_count),
          jsonb_build_object(
            'identifier', NEW.identifier,
            'failed_count', failed_count,
            'threshold', threshold,
            'time_window_minutes', 15,
            'last_ip_address', NEW.ip_address,
            'last_user_agent', NEW.user_agent,
            'trigger_type', 'automatic'
          ),
          'new',
          NEW.user_id,
          'threshold',
          threshold,
          failed_count,
          NEW.ip_address::inet
        );

        -- NOTE: the dead `PERFORM log_audit_event(...)` call that used to be
        -- here was removed — log_audit_event was dropped 2025-12-09
        -- (20251209110000). The security_alerts row above is the durable record.
      ELSE
        -- Update existing alert with new occurrence
        UPDATE security_alerts
        SET
          occurrence_count = occurrence_count + 1,
          last_occurrence_at = NOW(),
          actual_value = failed_count,
          updated_at = NOW()
        WHERE id = existing_alert_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.check_failed_login_threshold IS
  'AFTER INSERT trigger on login_attempts: raises a brute_force_attack security_alert at 5 failed logins/15min. Dead log_audit_event() call removed 2026-06-25 (fn dropped 2025-12-09).';
