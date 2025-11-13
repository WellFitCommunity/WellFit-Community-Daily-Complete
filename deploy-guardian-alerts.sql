-- ========================================
-- DEPLOY GUARDIAN AGENT ALERT SYSTEM
-- ========================================
-- This will deploy the Guardian alerts and security notifications tables
-- PASTE THIS INTO SUPABASE SQL EDITOR AND RUN
-- Go to: https://supabase.com/dashboard → SQL Editor → New query
-- ========================================

-- Guardian Alerts Table
CREATE TABLE IF NOT EXISTS guardian_alerts (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Alert classification
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
  category TEXT NOT NULL CHECK (category IN (
    'security_vulnerability',
    'phi_exposure',
    'memory_leak',
    'api_failure',
    'healing_generated',
    'system_health'
  )),

  -- Alert content
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Guardian Eyes session link
  session_recording_id TEXT,
  session_recording_url TEXT,
  video_timestamp INTEGER, -- Milliseconds into recording when issue occurred

  -- Healing information
  healing_operation_id TEXT,
  generated_fix JSONB, -- { original_code, fixed_code, file_path, line_number }

  -- Context
  affected_component TEXT,
  affected_users TEXT[], -- Array of user IDs
  error_stack TEXT,

  -- Review status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'reviewing', 'resolved', 'dismissed')),
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Actions
  actions JSONB NOT NULL, -- Array of { id, label, type, url, confirmation_required, danger }

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  -- { error_count, users_impacted, auto_healable, requires_immediate_action, estimated_impact }
);

-- Security Notifications Table (persistent inbox)
CREATE TABLE IF NOT EXISTS security_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  type TEXT NOT NULL, -- 'guardian_alert', 'compliance_reminder', 'audit_flag', etc.
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- URL to relevant page
  metadata JSONB DEFAULT '{}'::jsonb,

  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guardian_alerts_status ON guardian_alerts(status);
CREATE INDEX IF NOT EXISTS idx_guardian_alerts_severity ON guardian_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_guardian_alerts_category ON guardian_alerts(category);
CREATE INDEX IF NOT EXISTS idx_guardian_alerts_created_at ON guardian_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_alerts_session ON guardian_alerts(session_recording_id);

CREATE INDEX IF NOT EXISTS idx_security_notifications_read ON security_notifications(read);
CREATE INDEX IF NOT EXISTS idx_security_notifications_created_at ON security_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_notifications_type ON security_notifications(type);

-- RLS Policies
ALTER TABLE guardian_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_notifications ENABLE ROW LEVEL SECURITY;

-- Security admins can see all alerts (role_code: 1=super_admin, 2=admin)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'guardian_alerts' AND policyname = 'Security admins can view all guardian alerts'
  ) THEN
    CREATE POLICY "Security admins can view all guardian alerts"
    ON guardian_alerts
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role_code IN (1, 2)  -- super_admin, admin
      )
    );
  END IF;
END $$;

-- Security admins can update alerts (role_code: 1=admin, 2=super_admin)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'guardian_alerts' AND policyname = 'Security admins can update guardian alerts'
  ) THEN
    CREATE POLICY "Security admins can update guardian alerts"
    ON guardian_alerts
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role_code IN (1, 2)  -- admin, super_admin
      )
    );
  END IF;
END $$;

-- System can insert alerts (Guardian Agent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'guardian_alerts' AND policyname = 'System can insert guardian alerts'
  ) THEN
    CREATE POLICY "System can insert guardian alerts"
    ON guardian_alerts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
END $$;

-- Security team can view notifications (role_code: 1=admin, 2=super_admin)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'security_notifications' AND policyname = 'Security team can view notifications'
  ) THEN
    CREATE POLICY "Security team can view notifications"
    ON security_notifications
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role_code IN (1, 2)  -- admin, super_admin
      )
    );
  END IF;
END $$;

-- Security team can update notifications (mark as read) (role_code: 1=admin, 2=super_admin)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'security_notifications' AND policyname = 'Security team can update notifications'
  ) THEN
    CREATE POLICY "Security team can update notifications"
    ON security_notifications
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role_code IN (1, 2)  -- admin, super_admin
      )
    );
  END IF;
END $$;

-- System can insert notifications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'security_notifications' AND policyname = 'System can insert notifications'
  ) THEN
    CREATE POLICY "System can insert notifications"
    ON security_notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
END $$;

-- Functions for alert management

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_security_notifications_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM security_notifications
    WHERE read = FALSE
  );
END;
$$;

-- Function to get pending alerts count by severity
CREATE OR REPLACE FUNCTION get_pending_alerts_by_severity()
RETURNS TABLE (
  severity TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ga.severity,
    COUNT(*)::BIGINT
  FROM guardian_alerts ga
  WHERE ga.status IN ('pending', 'acknowledged')
  GROUP BY ga.severity;
END;
$$;

-- Function to auto-dismiss old info alerts (cleanup)
CREATE OR REPLACE FUNCTION auto_dismiss_old_info_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  dismissed_count INTEGER;
BEGIN
  -- Auto-dismiss info alerts older than 7 days
  UPDATE guardian_alerts
  SET status = 'dismissed',
      resolution_notes = 'Auto-dismissed after 7 days'
  WHERE severity = 'info'
    AND status = 'pending'
    AND created_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS dismissed_count = ROW_COUNT;

  RETURN dismissed_count;
END;
$$;

-- Trigger to send real-time notification when alert is inserted
CREATE OR REPLACE FUNCTION notify_new_guardian_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Notify via pg_notify for real-time subscriptions
  PERFORM pg_notify(
    'guardian_alert_created',
    json_build_object(
      'id', NEW.id,
      'severity', NEW.severity,
      'title', NEW.title,
      'category', NEW.category
    )::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_guardian_alert ON guardian_alerts;

CREATE TRIGGER trigger_notify_new_guardian_alert
AFTER INSERT ON guardian_alerts
FOR EACH ROW
EXECUTE FUNCTION notify_new_guardian_alert();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON guardian_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON security_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_security_notifications_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_alerts_by_severity() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_dismiss_old_info_alerts() TO authenticated;

-- Comments
COMMENT ON TABLE guardian_alerts IS 'Alerts generated by Guardian Agent for Security Panel review';
COMMENT ON TABLE security_notifications IS 'Persistent inbox of security notifications for security team';
COMMENT ON COLUMN guardian_alerts.session_recording_id IS 'Link to Guardian Eyes session recording';
COMMENT ON COLUMN guardian_alerts.video_timestamp IS 'Milliseconds into recording when issue occurred';
COMMENT ON COLUMN guardian_alerts.generated_fix IS 'Code fix generated by Guardian Agent';
COMMENT ON COLUMN guardian_alerts.metadata IS 'Additional metadata: auto_healable, requires_immediate_action, estimated_impact, etc.';

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Guardian alerts system deployed successfully!';
  RAISE NOTICE 'Tables created: guardian_alerts, security_notifications';
  RAISE NOTICE 'Functions created: get_unread_security_notifications_count, get_pending_alerts_by_severity, auto_dismiss_old_info_alerts';
  RAISE NOTICE 'Trigger created: trigger_notify_new_guardian_alert';
  RAISE NOTICE 'Guardian Agent is now operational and can create alerts.';
END $$;

-- ========================================
-- EXPECTED OUTPUT IN "MESSAGES" TAB:
-- ========================================
-- NOTICE:  ✅ Guardian alerts system deployed successfully!
-- NOTICE:  Tables created: guardian_alerts, security_notifications
-- NOTICE:  Functions created: get_unread_security_notifications_count, get_pending_alerts_by_severity, auto_dismiss_old_info_alerts
-- NOTICE:  Trigger created: trigger_notify_new_guardian_alert
-- NOTICE:  Guardian Agent is now operational and can create alerts.
-- ========================================
