-- Real-Time Security Alerts and Monitoring for SOC2 Compliance
-- Priority 4: Security Monitoring & Incident Detection

-- Create security alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'failed_login_spike',
    'unusual_phi_access',
    'privilege_escalation',
    'mfa_bypass_attempt',
    'bulk_data_export',
    'after_hours_access',
    'suspicious_ip',
    'brute_force_attack',
    'account_takeover',
    'data_exfiltration',
    'unauthorized_api_access',
    'database_schema_change',
    'security_policy_violation',
    'anomalous_behavior'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved', 'false_positive', 'escalated')),

  -- Alert details
  title TEXT NOT NULL,
  description TEXT,
  affected_user_id UUID REFERENCES auth.users(id),
  affected_resource TEXT,
  source_ip INET,
  user_agent TEXT,

  -- Detection details
  detection_method TEXT CHECK (detection_method IN ('rule_based', 'threshold', 'anomaly', 'manual')),
  threshold_value NUMERIC,
  actual_value NUMERIC,
  confidence_score NUMERIC CHECK (confidence_score BETWEEN 0 AND 1),

  -- Timeline
  first_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_occurrence_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,

  -- Response
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_channels TEXT[], -- ['slack', 'email', 'pagerduty']
  assigned_to UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  resolution_time TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB,
  related_events UUID[], -- Array of security_events IDs

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity, status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON security_alerts(affected_user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at DESC);

-- Enable RLS
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can view all alerts
CREATE POLICY "Admins can view all security alerts"
  ON security_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- System can create alerts
CREATE POLICY "System can create security alerts"
  ON security_alerts FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Admins can update alerts
CREATE POLICY "Admins can update security alerts"
  ON security_alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Function to detect failed login spikes
CREATE OR REPLACE FUNCTION detect_failed_login_spike()
RETURNS VOID AS $$
DECLARE
  v_user RECORD;
  v_failed_count INTEGER;
  v_threshold INTEGER := 5; -- Alert after 5 failed attempts in 5 minutes
BEGIN
  -- Check for users with excessive failed logins
  FOR v_user IN
    SELECT
      user_id,
      COUNT(*) as failed_count,
      MAX(created_at) as last_attempt
    FROM security_events
    WHERE event_type = 'auth_failure'
      AND created_at > NOW() - INTERVAL '5 minutes'
    GROUP BY user_id
    HAVING COUNT(*) >= v_threshold
  LOOP
    -- Create alert if not already exists for this user in last hour
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

-- Function to detect unusual PHI access
CREATE OR REPLACE FUNCTION detect_unusual_phi_access()
RETURNS VOID AS $$
DECLARE
  v_access RECORD;
  v_avg_daily_access NUMERIC;
  v_current_access INTEGER;
  v_threshold_multiplier NUMERIC := 3.0; -- Alert if 3x normal activity
BEGIN
  -- Check for users accessing PHI at unusual rates
  FOR v_access IN
    SELECT
      user_id,
      COUNT(*) as access_count,
      ARRAY_AGG(DISTINCT resource_id) as accessed_patients
    FROM security_events
    WHERE event_type = 'phi_access'
      AND created_at > NOW() - INTERVAL '1 hour'
    GROUP BY user_id
  LOOP
    -- Calculate user's average hourly PHI access (last 30 days)
    SELECT AVG(hourly_count) INTO v_avg_daily_access
    FROM (
      SELECT COUNT(*) as hourly_count
      FROM security_events
      WHERE event_type = 'phi_access'
        AND user_id = v_access.user_id
        AND created_at > NOW() - INTERVAL '30 days'
        AND created_at < NOW() - INTERVAL '1 hour'
      GROUP BY DATE_TRUNC('hour', created_at)
    ) hourly_stats;

    -- Alert if current activity is significantly above baseline
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

-- Function to detect privilege escalation
CREATE OR REPLACE FUNCTION detect_privilege_escalation()
RETURNS VOID AS $$
DECLARE
  v_event RECORD;
BEGIN
  -- Check for recent role changes to privileged roles
  FOR v_event IN
    SELECT
      se.user_id,
      se.metadata->>'new_role' as new_role,
      se.metadata->>'old_role' as old_role,
      se.created_at
    FROM security_events se
    WHERE se.event_type = 'role_change'
      AND se.created_at > NOW() - INTERVAL '1 hour'
      AND se.metadata->>'new_role' IN ('admin', 'super_admin')
  LOOP
    -- Create alert for privilege escalation
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

-- Function to detect bulk data exports
CREATE OR REPLACE FUNCTION detect_bulk_data_export()
RETURNS VOID AS $$
DECLARE
  v_export RECORD;
  v_threshold INTEGER := 100; -- Alert if exporting >100 records
BEGIN
  -- Check for large data exports
  FOR v_export IN
    SELECT
      user_id,
      metadata->>'record_count' as record_count,
      metadata->>'export_type' as export_type,
      created_at
    FROM security_events
    WHERE event_type = 'data_export'
      AND created_at > NOW() - INTERVAL '1 hour'
      AND (metadata->>'record_count')::INTEGER > v_threshold
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

-- Function to detect after-hours access
CREATE OR REPLACE FUNCTION detect_after_hours_access()
RETURNS VOID AS $$
DECLARE
  v_access RECORD;
  v_current_hour INTEGER;
  v_is_weekend BOOLEAN;
BEGIN
  v_current_hour := EXTRACT(HOUR FROM NOW());
  v_is_weekend := EXTRACT(DOW FROM NOW()) IN (0, 6); -- Sunday = 0, Saturday = 6

  -- After hours: 10 PM - 6 AM or weekends
  IF v_current_hour >= 22 OR v_current_hour < 6 OR v_is_weekend THEN
    -- Check for PHI access during after hours
    FOR v_access IN
      SELECT DISTINCT
        user_id,
        COUNT(*) as access_count
      FROM security_events
      WHERE event_type = 'phi_access'
        AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY user_id
      HAVING COUNT(*) > 5 -- More than 5 accesses in off-hours
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

-- Master function to run all security monitoring checks
CREATE OR REPLACE FUNCTION run_security_monitoring()
RETURNS JSONB AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE;
  v_end_time TIMESTAMP WITH TIME ZONE;
  v_new_alerts INTEGER;
  v_result JSONB;
BEGIN
  v_start_time := NOW();

  -- Run all detection functions
  PERFORM detect_failed_login_spike();
  PERFORM detect_unusual_phi_access();
  PERFORM detect_privilege_escalation();
  PERFORM detect_bulk_data_export();
  PERFORM detect_after_hours_access();

  v_end_time := NOW();

  -- Count new alerts created
  SELECT COUNT(*) INTO v_new_alerts
  FROM security_alerts
  WHERE created_at > v_start_time;

  -- Log monitoring run
  INSERT INTO security_events (
    event_type,
    severity,
    description,
    metadata
  ) VALUES (
    'security_monitoring_run',
    'info',
    'Automated security monitoring completed',
    jsonb_build_object(
      'duration_ms', EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time)),
      'new_alerts', v_new_alerts,
      'timestamp', v_start_time
    )
  );

  v_result := jsonb_build_object(
    'status', 'completed',
    'new_alerts', v_new_alerts,
    'duration_ms', EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time)),
    'timestamp', v_start_time
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active security alerts
CREATE OR REPLACE FUNCTION get_active_security_alerts()
RETURNS TABLE (
  alert_id UUID,
  alert_type TEXT,
  severity TEXT,
  title TEXT,
  description TEXT,
  affected_user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  occurrence_count INTEGER,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.alert_type,
    sa.severity,
    sa.title,
    sa.description,
    u.email,
    sa.created_at,
    sa.occurrence_count,
    sa.status
  FROM security_alerts sa
  LEFT JOIN auth.users u ON u.id = sa.affected_user_id
  WHERE sa.status IN ('new', 'investigating', 'escalated')
  ORDER BY
    CASE sa.severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    sa.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for security alert dashboard
CREATE OR REPLACE VIEW security_alert_dashboard AS
SELECT
  DATE(created_at) as alert_date,
  severity,
  alert_type,
  status,
  COUNT(*) as alert_count,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
  COUNT(CASE WHEN status = 'false_positive' THEN 1 END) as false_positive_count,
  AVG(EXTRACT(EPOCH FROM (resolution_time - created_at))) / 3600 as avg_resolution_hours
FROM security_alerts
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at), severity, alert_type, status
ORDER BY alert_date DESC, severity;

-- Grant access
GRANT SELECT ON security_alert_dashboard TO authenticated;

-- Function to acknowledge and assign alert
CREATE OR REPLACE FUNCTION acknowledge_security_alert(
  p_alert_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_result JSONB;
BEGIN
  v_admin_id := auth.uid();

  -- Update alert
  UPDATE security_alerts
  SET status = 'investigating',
      assigned_to = v_admin_id,
      resolution_notes = COALESCE(p_notes, resolution_notes),
      updated_at = NOW()
  WHERE id = p_alert_id;

  -- Log acknowledgment
  INSERT INTO security_events (
    event_type,
    user_id,
    severity,
    description,
    metadata
  ) VALUES (
    'alert_acknowledged',
    v_admin_id,
    'info',
    'Security alert acknowledged',
    jsonb_build_object(
      'alert_id', p_alert_id,
      'notes', p_notes
    )
  );

  v_result := jsonb_build_object(
    'status', 'success',
    'alert_id', p_alert_id,
    'acknowledged_by', v_admin_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resolve alert
CREATE OR REPLACE FUNCTION resolve_security_alert(
  p_alert_id UUID,
  p_resolution_notes TEXT,
  p_is_false_positive BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_result JSONB;
BEGIN
  v_admin_id := auth.uid();

  -- Update alert
  UPDATE security_alerts
  SET status = CASE WHEN p_is_false_positive THEN 'false_positive' ELSE 'resolved' END,
      resolution_notes = p_resolution_notes,
      resolution_time = NOW(),
      updated_at = NOW()
  WHERE id = p_alert_id;

  -- Log resolution
  INSERT INTO security_events (
    event_type,
    user_id,
    severity,
    description,
    metadata
  ) VALUES (
    'alert_resolved',
    v_admin_id,
    'info',
    'Security alert resolved',
    jsonb_build_object(
      'alert_id', p_alert_id,
      'resolution_notes', p_resolution_notes,
      'is_false_positive', p_is_false_positive
    )
  );

  v_result := jsonb_build_object(
    'status', 'success',
    'alert_id', p_alert_id,
    'resolved_by', v_admin_id,
    'is_false_positive', p_is_false_positive
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run initial security monitoring
PERFORM run_security_monitoring();

COMMENT ON TABLE security_alerts IS 'Real-time security alerts for SOC2 compliance and threat detection';
COMMENT ON FUNCTION run_security_monitoring IS 'Master function to run all automated security checks (run every 5-15 minutes)';
COMMENT ON FUNCTION get_active_security_alerts IS 'Returns all active security alerts for dashboard display';
COMMENT ON VIEW security_alert_dashboard IS 'Security alert metrics for SOC2 reporting and trend analysis';
