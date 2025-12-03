-- ============================================================================
-- Security Alerting Automation
-- ============================================================================
-- Purpose: Add database triggers and functions for real-time security alerting
--
-- Features:
-- 1. Automatic alert creation on failed login thresholds
-- 2. Alert escalation tracking
-- 3. Notification status tracking on alerts
-- 4. Security event to alert linking
--
-- SOC2 Compliance: CC6.1, CC7.2, CC7.3
-- ============================================================================

-- ============================================================================
-- 1. ADD NOTIFICATION TRACKING COLUMNS TO SECURITY_ALERTS
-- ============================================================================
-- Note: Uses existing schema - security_alerts table already has:
--   status: 'new', 'investigating', 'resolved', 'false_positive', 'escalated'
--   alert_type: specific constraint values
--   description: (not 'message')

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_channels TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS escalated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_response_executed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_response_type TEXT;

-- Index for finding alerts that need escalation
CREATE INDEX IF NOT EXISTS idx_security_alerts_escalation
ON public.security_alerts(status, escalated, created_at)
WHERE status = 'new' AND escalated = false;

-- Index for notification tracking
CREATE INDEX IF NOT EXISTS idx_security_alerts_notification
ON public.security_alerts(notification_sent, severity)
WHERE notification_sent = false;

-- ============================================================================
-- 2. FUNCTION TO CREATE SECURITY ALERT FROM FAILED LOGINS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_failed_login_threshold()
RETURNS TRIGGER AS $$
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

        -- Log to audit
        PERFORM log_audit_event(
          'SECURITY_ALERT_CREATED',
          'security',
          'security_alerts',
          NULL,
          NEW.user_id,
          jsonb_build_object(
            'alert_type', 'brute_force_attack',
            'identifier', NEW.identifier,
            'failed_count', failed_count
          )
        );
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on login_attempts
DROP TRIGGER IF EXISTS check_failed_login_threshold_trigger ON login_attempts;
CREATE TRIGGER check_failed_login_threshold_trigger
  AFTER INSERT ON login_attempts
  FOR EACH ROW
  EXECUTE FUNCTION check_failed_login_threshold();

-- ============================================================================
-- 3. FUNCTION TO CREATE ALERT FROM CRITICAL SECURITY EVENTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_alert_from_security_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create alerts for CRITICAL and HIGH severity events
  IF NEW.severity IN ('CRITICAL', 'HIGH') THEN
    INSERT INTO security_alerts (
      severity,
      alert_type,
      title,
      description,
      metadata,
      status,
      affected_user_id,
      detection_method
    ) VALUES (
      LOWER(NEW.severity),
      'security_policy_violation',
      format('Security Event: %s', NEW.event_type),
      COALESCE(NEW.description, format('Security event detected: %s', NEW.event_type)),
      jsonb_build_object(
        'event_id', NEW.id,
        'event_type', NEW.event_type,
        'actor_user_id', NEW.actor_user_id,
        'actor_ip_address', NEW.actor_ip_address,
        'correlation_id', NEW.correlation_id,
        'auto_blocked', NEW.auto_blocked,
        'original_metadata', NEW.metadata
      ),
      'new',
      NEW.actor_user_id,
      'rule_based'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on security_events
DROP TRIGGER IF EXISTS create_alert_from_security_event_trigger ON security_events;
CREATE TRIGGER create_alert_from_security_event_trigger
  AFTER INSERT ON security_events
  FOR EACH ROW
  EXECUTE FUNCTION create_alert_from_security_event();

-- ============================================================================
-- 4. FUNCTION TO CREATE ALERT FROM ANOMALY DETECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_alert_from_anomaly()
RETURNS TRIGGER AS $$
DECLARE
  alert_severity TEXT;
BEGIN
  -- Map risk level to alert severity
  CASE
    WHEN NEW.risk_level = 'CRITICAL' THEN alert_severity := 'critical';
    WHEN NEW.risk_level = 'HIGH' THEN alert_severity := 'high';
    WHEN NEW.risk_level = 'MEDIUM' THEN alert_severity := 'medium';
    ELSE alert_severity := 'low';
  END CASE;

  -- Only create alerts for CRITICAL and HIGH risk anomalies
  IF NEW.risk_level IN ('CRITICAL', 'HIGH') THEN
    INSERT INTO security_alerts (
      severity,
      alert_type,
      title,
      description,
      metadata,
      status,
      affected_user_id,
      detection_method,
      confidence_score
    ) VALUES (
      alert_severity,
      'anomalous_behavior',
      format('Anomaly Detected: %s', NEW.anomaly_type),
      format('Behavioral anomaly detected for user. Risk score: %s',
             ROUND(NEW.risk_score::numeric, 2)),
      jsonb_build_object(
        'anomaly_id', NEW.id,
        'anomaly_type', NEW.anomaly_type,
        'risk_score', NEW.risk_score,
        'risk_level', NEW.risk_level,
        'details', NEW.details
      ),
      'new',
      NEW.user_id,
      'anomaly',
      NEW.risk_score::numeric
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on anomaly_detections (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'anomaly_detections') THEN
    DROP TRIGGER IF EXISTS create_alert_from_anomaly_trigger ON anomaly_detections;
    CREATE TRIGGER create_alert_from_anomaly_trigger
      AFTER INSERT ON anomaly_detections
      FOR EACH ROW
      EXECUTE FUNCTION create_alert_from_anomaly();
  END IF;
END $$;

-- ============================================================================
-- 5. FUNCTION TO CHECK AND UPDATE ALERT ESCALATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_alert_escalation()
RETURNS void AS $$
DECLARE
  alert_record RECORD;
  escalation_threshold INTERVAL := '15 minutes';
BEGIN
  -- Find alerts that need escalation (status = 'new' and older than threshold)
  FOR alert_record IN
    SELECT id, severity, title, created_at, escalation_level
    FROM security_alerts
    WHERE status = 'new'
      AND escalated = false
      AND created_at < NOW() - escalation_threshold
  LOOP
    -- Update alert to escalated status
    UPDATE security_alerts
    SET
      escalated = true,
      escalated_at = NOW(),
      escalation_level = COALESCE(alert_record.escalation_level, 0) + 1,
      status = 'escalated',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'escalation_reason', 'No response within 15 minutes',
        'escalated_at', NOW()
      ),
      updated_at = NOW()
    WHERE id = alert_record.id;

    -- Log escalation
    PERFORM log_audit_event(
      'SECURITY_ALERT_ESCALATED',
      'security',
      'security_alerts',
      alert_record.id::text,
      NULL,
      jsonb_build_object(
        'alert_id', alert_record.id,
        'original_created_at', alert_record.created_at,
        'escalation_level', COALESCE(alert_record.escalation_level, 0) + 1
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. FUNCTION TO GET ALERT STATISTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_security_alert_stats(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_alerts BIGINT,
  critical_alerts BIGINT,
  high_alerts BIGINT,
  medium_alerts BIGINT,
  low_alerts BIGINT,
  new_alerts BIGINT,
  investigating_alerts BIGINT,
  resolved_alerts BIGINT,
  escalated_alerts BIGINT,
  avg_resolution_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_alerts,
    COUNT(*) FILTER (WHERE severity = 'critical')::BIGINT as critical_alerts,
    COUNT(*) FILTER (WHERE severity = 'high')::BIGINT as high_alerts,
    COUNT(*) FILTER (WHERE severity = 'medium')::BIGINT as medium_alerts,
    COUNT(*) FILTER (WHERE severity = 'low')::BIGINT as low_alerts,
    COUNT(*) FILTER (WHERE status = 'new')::BIGINT as new_alerts,
    COUNT(*) FILTER (WHERE status = 'investigating')::BIGINT as investigating_alerts,
    COUNT(*) FILTER (WHERE status = 'resolved')::BIGINT as resolved_alerts,
    COUNT(*) FILTER (WHERE escalated = true)::BIGINT as escalated_alerts,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (resolution_time - created_at)) / 60
      ) FILTER (WHERE resolution_time IS NOT NULL)::NUMERIC,
      2
    ) as avg_resolution_minutes
  FROM security_alerts
  WHERE created_at > NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. FUNCTION TO ACKNOWLEDGE ALERT (start investigating)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.acknowledge_security_alert(
  p_alert_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE security_alerts
  SET
    status = 'investigating',
    assigned_to = p_user_id,
    updated_at = NOW()
  WHERE id = p_alert_id
    AND status = 'new';

  IF FOUND THEN
    -- Log acknowledgment
    PERFORM log_audit_event(
      'SECURITY_ALERT_ACKNOWLEDGED',
      'security',
      'security_alerts',
      p_alert_id::text,
      p_user_id,
      jsonb_build_object('alert_id', p_alert_id)
    );
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. FUNCTION TO RESOLVE ALERT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_security_alert(
  p_alert_id UUID,
  p_resolution TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE security_alerts
  SET
    status = 'resolved',
    resolution_time = NOW(),
    resolution_notes = p_resolution,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('resolution', p_resolution),
    updated_at = NOW()
  WHERE id = p_alert_id
    AND status IN ('new', 'investigating', 'escalated');

  IF FOUND THEN
    -- Log resolution
    PERFORM log_audit_event(
      'SECURITY_ALERT_RESOLVED',
      'security',
      'security_alerts',
      p_alert_id::text,
      p_user_id,
      jsonb_build_object(
        'alert_id', p_alert_id,
        'resolution', p_resolution
      )
    );
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. VIEW FOR PENDING ALERTS REQUIRING ACTION
-- ============================================================================

CREATE OR REPLACE VIEW public.pending_security_alerts AS
SELECT
  sa.id,
  sa.severity,
  sa.alert_type,
  sa.title,
  sa.description,
  sa.metadata,
  sa.status,
  sa.created_at,
  sa.escalated,
  sa.escalated_at,
  sa.escalation_level,
  sa.notification_sent,
  sa.affected_user_id,
  p.email as affected_user_email,
  EXTRACT(EPOCH FROM (NOW() - sa.created_at)) / 60 as minutes_since_created,
  CASE
    WHEN sa.severity = 'critical' THEN 1
    WHEN sa.severity = 'high' THEN 2
    WHEN sa.severity = 'medium' THEN 3
    ELSE 4
  END as priority_order
FROM security_alerts sa
LEFT JOIN auth.users u ON sa.affected_user_id = u.id
LEFT JOIN profiles p ON sa.affected_user_id = p.user_id
WHERE sa.status IN ('new', 'escalated')
ORDER BY
  sa.escalated DESC,
  priority_order ASC,
  sa.created_at ASC;

-- Grant access to the view
GRANT SELECT ON public.pending_security_alerts TO authenticated;

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.check_alert_escalation() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_security_alert_stats(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_security_alert(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_security_alert(UUID, TEXT, UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

COMMENT ON FUNCTION public.check_failed_login_threshold() IS
  'Automatically creates security alert when failed login threshold is exceeded';

COMMENT ON FUNCTION public.create_alert_from_security_event() IS
  'Automatically creates security alert from CRITICAL/HIGH severity security events';

COMMENT ON FUNCTION public.check_alert_escalation() IS
  'Marks new alerts as escalated after 15 minutes without acknowledgment';

COMMENT ON VIEW public.pending_security_alerts IS
  'View of all new/escalated security alerts prioritized by severity';

-- ============================================================================
-- 11. SCHEDULE CRON JOBS (if pg_cron available)
-- ============================================================================

DO $$
BEGIN
  -- Check alert escalation every 5 minutes
  PERFORM cron.schedule(
    'check-security-alert-escalation',
    '*/5 * * * *',  -- Every 5 minutes
    'SELECT check_alert_escalation()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available for security alert escalation scheduling';
END $$;

-- ============================================================================
-- NOTE ON EDGE FUNCTION CRON JOB
-- ============================================================================
-- The security-alert-processor edge function should be called every minute
-- to process pending alerts and send notifications.
--
-- Configure this in Supabase Dashboard:
-- 1. Go to Database > Extensions > Enable pg_net (if not enabled)
-- 2. Go to Database > Scheduled Jobs
-- 3. Create a new job:
--    - Name: process-security-alerts
--    - Schedule: * * * * * (every minute)
--    - Command:
--      SELECT net.http_post(
--        url := current_setting('app.supabase_url') || '/functions/v1/security-alert-processor',
--        headers := jsonb_build_object(
--          'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--          'Content-Type', 'application/json'
--        ),
--        body := '{}'::jsonb
--      );
--
-- Alternative: Configure via Supabase CLI in config.toml:
--   [edge_functions.cron_jobs]
--   security-alert-processor = "* * * * *"
-- ============================================================================
