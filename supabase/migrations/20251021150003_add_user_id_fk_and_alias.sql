-- Add Foreign Key for actor_user_id and create user_id alias
-- This allows using both 'user_id' (legacy name) and 'actor_user_id' (descriptive name)

-- Add Foreign Key constraint to actor_user_id
ALTER TABLE security_events
ADD CONSTRAINT fk_security_events_actor_user
FOREIGN KEY (actor_user_id)
REFERENCES auth.users(id)
ON DELETE SET NULL; -- If user deleted, keep the log but null out the user_id

-- Create index on actor_user_id for performance
CREATE INDEX IF NOT EXISTS idx_security_events_actor_user_id
ON security_events(actor_user_id);

-- Add comment explaining the column
COMMENT ON COLUMN security_events.actor_user_id IS 'Foreign key to auth.users(id) - user who performed the action';

-- Create a view that includes 'user_id' as an alias for backward compatibility
CREATE OR REPLACE VIEW security_events_with_user_id AS
SELECT
  id,
  event_type,
  severity,
  description,
  actor_user_id,
  actor_user_id AS user_id, -- Alias for backward compatibility
  actor_ip_address,
  actor_user_agent,
  metadata,
  correlation_id,
  related_audit_log_id,
  requires_investigation,
  investigated,
  investigated_by,
  investigated_at,
  alert_sent,
  alert_sent_at,
  alert_recipients,
  auto_blocked,
  resolution,
  resource_type,
  resource_id,
  action_taken,
  created_at
FROM security_events;

-- Grant access to the view
GRANT SELECT ON security_events_with_user_id TO authenticated;

-- Add same FK to security_alerts table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_security_alerts_affected_user'
      AND table_name = 'security_alerts'
  ) THEN
    ALTER TABLE security_alerts
    ADD CONSTRAINT fk_security_alerts_affected_user
    FOREIGN KEY (affected_user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_security_alerts_assigned_to'
      AND table_name = 'security_alerts'
  ) THEN
    ALTER TABLE security_alerts
    ADD CONSTRAINT fk_security_alerts_assigned_to
    FOREIGN KEY (assigned_to)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Create index on security_alerts for performance
CREATE INDEX IF NOT EXISTS idx_security_alerts_affected_user_id
ON security_alerts(affected_user_id);

CREATE INDEX IF NOT EXISTS idx_security_alerts_assigned_to
ON security_alerts(assigned_to);

-- Update the security monitoring functions to work with both column names
-- by using COALESCE to check both actor_user_id and user_id

-- Fix detect_failed_login_spike to use actor_user_id
CREATE OR REPLACE FUNCTION detect_failed_login_spike()
RETURNS VOID AS $$
DECLARE
  v_user RECORD;
  v_failed_count INTEGER;
  v_threshold INTEGER := 5;
BEGIN
  FOR v_user IN
    SELECT
      actor_user_id as user_id,
      COUNT(*) as failed_count,
      MAX(created_at) as last_attempt
    FROM security_events
    WHERE event_type = 'auth_failure'
      AND created_at > NOW() - INTERVAL '5 minutes'
      AND actor_user_id IS NOT NULL
    GROUP BY actor_user_id
    HAVING COUNT(*) >= v_threshold
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM security_alerts
      WHERE alert_type = 'failed_login_spike'
        AND affected_user_id = v_user.user_id
        AND created_at > NOW() - INTERVAL '1 hour'
        AND status != 'resolved'
    ) THEN
      INSERT INTO security_alerts (
        alert_type,
        severity,
        title,
        description,
        affected_user_id,
        detection_method,
        threshold_value,
        actual_value,
        confidence_score,
        metadata
      ) VALUES (
        'failed_login_spike',
        CASE
          WHEN v_user.failed_count >= 10 THEN 'critical'
          WHEN v_user.failed_count >= 7 THEN 'high'
          ELSE 'medium'
        END,
        format('Multiple failed login attempts detected (User: %s)', v_user.user_id),
        format('%s failed login attempts in the last 5 minutes', v_user.failed_count),
        v_user.user_id,
        'threshold',
        v_threshold,
        v_user.failed_count,
        0.9,
        jsonb_build_object(
          'failed_count', v_user.failed_count,
          'time_window', '5 minutes',
          'last_attempt', v_user.last_attempt
        )
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix detect_unusual_phi_access to use actor_user_id
CREATE OR REPLACE FUNCTION detect_unusual_phi_access()
RETURNS VOID AS $$
DECLARE
  v_access RECORD;
  v_avg_daily_access NUMERIC;
  v_current_access INTEGER;
  v_threshold_multiplier NUMERIC := 3.0;
BEGIN
  FOR v_access IN
    SELECT
      actor_user_id as user_id,
      COUNT(*) as access_count,
      ARRAY_AGG(DISTINCT resource_id) as accessed_patients
    FROM security_events
    WHERE event_type = 'phi_access'
      AND created_at > NOW() - INTERVAL '1 hour'
      AND actor_user_id IS NOT NULL
    GROUP BY actor_user_id
  LOOP
    SELECT AVG(hourly_count) INTO v_avg_daily_access
    FROM (
      SELECT COUNT(*) as hourly_count
      FROM security_events
      WHERE event_type = 'phi_access'
        AND actor_user_id = v_access.user_id
        AND created_at > NOW() - INTERVAL '30 days'
        AND created_at < NOW() - INTERVAL '1 hour'
      GROUP BY DATE_TRUNC('hour', created_at)
    ) hourly_stats;

    IF v_avg_daily_access IS NOT NULL
       AND v_access.access_count > (v_avg_daily_access * v_threshold_multiplier)
       AND v_avg_daily_access > 0 THEN

      INSERT INTO security_alerts (
        alert_type,
        severity,
        title,
        description,
        affected_user_id,
        detection_method,
        threshold_value,
        actual_value,
        confidence_score,
        metadata
      ) VALUES (
        'unusual_phi_access',
        CASE
          WHEN v_access.access_count > (v_avg_daily_access * 5) THEN 'high'
          ELSE 'medium'
        END,
        format('Unusual PHI access pattern detected (User: %s)', v_access.user_id),
        format('User accessed %s patient records in the last hour (average: %.1f)', v_access.access_count, v_avg_daily_access),
        v_access.user_id,
        'anomaly',
        v_avg_daily_access * v_threshold_multiplier,
        v_access.access_count,
        0.85,
        jsonb_build_object(
          'access_count', v_access.access_count,
          'average_count', v_avg_daily_access,
          'patient_count', array_length(v_access.accessed_patients, 1),
          'time_window', '1 hour'
        )
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix detect_privilege_escalation to use actor_user_id
CREATE OR REPLACE FUNCTION detect_privilege_escalation()
RETURNS VOID AS $$
DECLARE
  v_event RECORD;
BEGIN
  FOR v_event IN
    SELECT
      se.actor_user_id as user_id,
      se.metadata->>'new_role' as new_role,
      se.metadata->>'old_role' as old_role,
      se.created_at
    FROM security_events se
    WHERE se.event_type = 'role_change'
      AND se.created_at > NOW() - INTERVAL '1 hour'
      AND se.metadata->>'new_role' IN ('admin', 'super_admin')
      AND se.actor_user_id IS NOT NULL
  LOOP
    INSERT INTO security_alerts (
      alert_type,
      severity,
      title,
      description,
      affected_user_id,
      detection_method,
      confidence_score,
      metadata
    ) VALUES (
      'privilege_escalation',
      'high',
      format('Privilege escalation detected (User: %s)', v_event.user_id),
      format('User role changed from %s to %s', v_event.old_role, v_event.new_role),
      v_event.user_id,
      'rule_based',
      1.0,
      jsonb_build_object(
        'old_role', v_event.old_role,
        'new_role', v_event.new_role,
        'timestamp', v_event.created_at
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix detect_bulk_data_export to use actor_user_id
CREATE OR REPLACE FUNCTION detect_bulk_data_export()
RETURNS VOID AS $$
DECLARE
  v_export RECORD;
  v_threshold INTEGER := 100;
BEGIN
  FOR v_export IN
    SELECT
      actor_user_id as user_id,
      metadata->>'record_count' as record_count,
      metadata->>'export_type' as export_type,
      created_at
    FROM security_events
    WHERE event_type = 'data_export'
      AND created_at > NOW() - INTERVAL '1 hour'
      AND (metadata->>'record_count')::INTEGER > v_threshold
      AND actor_user_id IS NOT NULL
  LOOP
    INSERT INTO security_alerts (
      alert_type,
      severity,
      title,
      description,
      affected_user_id,
      detection_method,
      threshold_value,
      actual_value,
      confidence_score,
      metadata
    ) VALUES (
      'bulk_data_export',
      CASE
        WHEN v_export.record_count::INTEGER >= 1000 THEN 'critical'
        WHEN v_export.record_count::INTEGER >= 500 THEN 'high'
        ELSE 'medium'
      END,
      format('Large data export detected (User: %s)', v_export.user_id),
      format('User exported %s %s records', v_export.record_count, v_export.export_type),
      v_export.user_id,
      'threshold',
      v_threshold,
      v_export.record_count::INTEGER,
      0.95,
      jsonb_build_object(
        'record_count', v_export.record_count,
        'export_type', v_export.export_type,
        'timestamp', v_export.created_at
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix detect_after_hours_access to use actor_user_id
CREATE OR REPLACE FUNCTION detect_after_hours_access()
RETURNS VOID AS $$
DECLARE
  v_access RECORD;
  v_current_hour INTEGER;
  v_is_weekend BOOLEAN;
BEGIN
  v_current_hour := EXTRACT(HOUR FROM NOW());
  v_is_weekend := EXTRACT(DOW FROM NOW()) IN (0, 6);

  IF v_current_hour >= 22 OR v_current_hour < 6 OR v_is_weekend THEN
    FOR v_access IN
      SELECT DISTINCT
        actor_user_id as user_id,
        COUNT(*) as access_count
      FROM security_events
      WHERE event_type = 'phi_access'
        AND created_at > NOW() - INTERVAL '1 hour'
        AND actor_user_id IS NOT NULL
      GROUP BY actor_user_id
      HAVING COUNT(*) > 5
    LOOP
      INSERT INTO security_alerts (
        alert_type,
        severity,
        title,
        description,
        affected_user_id,
        detection_method,
        confidence_score,
        metadata
      ) VALUES (
        'after_hours_access',
        'medium',
        format('After-hours PHI access detected (User: %s)', v_access.user_id),
        format('User accessed PHI %s times during off-hours', v_access.access_count),
        v_access.user_id,
        'rule_based',
        0.7,
        jsonb_build_object(
          'access_count', v_access.access_count,
          'hour', v_current_hour,
          'is_weekend', v_is_weekend
        )
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the security monitoring now
SELECT run_security_monitoring();

COMMENT ON VIEW security_events_with_user_id IS 'View with user_id alias for backward compatibility - both user_id and actor_user_id refer to the same column';
COMMENT ON CONSTRAINT fk_security_events_actor_user ON security_events IS 'Foreign key to auth.users - ensures actor_user_id always references a valid user';
