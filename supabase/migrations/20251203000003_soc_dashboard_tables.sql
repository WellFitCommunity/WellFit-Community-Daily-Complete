-- ============================================================================
-- SOC Dashboard Tables
-- ============================================================================
-- Purpose: Internal Security Operations Center dashboard for real-time
-- monitoring, team collaboration, and alert management.
--
-- Features:
-- 1. Alert comments/messages for team collaboration
-- 2. Team presence tracking
-- 3. Alert assignments
-- 4. Notification preferences
--
-- Access: Envision super_admins only (internal operations)
-- SOC2 Compliance: CC6.1, CC7.2, CC7.3
-- ============================================================================

-- ============================================================================
-- 1. ALERT MESSAGES - Team collaboration on specific alerts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.soc_alert_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to alert
  alert_id UUID NOT NULL REFERENCES security_alerts(id) ON DELETE CASCADE,

  -- Message content
  message_type TEXT NOT NULL DEFAULT 'comment' CHECK (message_type IN ('comment', 'action', 'system', 'escalation')),
  content TEXT NOT NULL,

  -- Author
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT, -- Denormalized for display

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_soc_alert_messages_alert_id ON soc_alert_messages(alert_id);
CREATE INDEX IF NOT EXISTS idx_soc_alert_messages_created_at ON soc_alert_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_soc_alert_messages_author ON soc_alert_messages(author_id);

-- Enable RLS
ALTER TABLE soc_alert_messages ENABLE ROW LEVEL SECURITY;

-- Only super_admins can access
CREATE POLICY "soc_alert_messages_super_admin_all" ON soc_alert_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE soc_alert_messages;

-- ============================================================================
-- 2. SOC PRESENCE - Track who's online in the SOC
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.soc_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User info
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT,

  -- Presence state
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Session info
  session_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_alert_id UUID REFERENCES security_alerts(id) ON DELETE SET NULL, -- What alert they're viewing

  -- Metadata
  user_agent TEXT,

  -- Unique constraint - one presence record per user
  CONSTRAINT soc_presence_user_unique UNIQUE (user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_soc_presence_status ON soc_presence(status) WHERE status != 'offline';
CREATE INDEX IF NOT EXISTS idx_soc_presence_last_seen ON soc_presence(last_seen_at DESC);

-- Enable RLS
ALTER TABLE soc_presence ENABLE ROW LEVEL SECURITY;

-- Super admins can see all presence, update their own
CREATE POLICY "soc_presence_super_admin_select" ON soc_presence
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "soc_presence_update_own" ON soc_presence
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "soc_presence_insert_own" ON soc_presence
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "soc_presence_delete_own" ON soc_presence
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE soc_presence;

-- ============================================================================
-- 3. SOC NOTIFICATION PREFERENCES - Per-user notification settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.soc_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Sound preferences
  sound_enabled BOOLEAN DEFAULT TRUE,
  sound_critical TEXT DEFAULT 'alarm',
  sound_high TEXT DEFAULT 'alert',
  sound_medium TEXT DEFAULT 'notification',
  sound_low TEXT DEFAULT 'soft',

  -- Browser notification preferences
  browser_notifications_enabled BOOLEAN DEFAULT TRUE,
  notify_on_critical BOOLEAN DEFAULT TRUE,
  notify_on_high BOOLEAN DEFAULT TRUE,
  notify_on_medium BOOLEAN DEFAULT FALSE,
  notify_on_low BOOLEAN DEFAULT FALSE,
  notify_on_escalation BOOLEAN DEFAULT TRUE,
  notify_on_new_message BOOLEAN DEFAULT TRUE,

  -- Desktop notification preferences
  desktop_notifications_enabled BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique per user
  CONSTRAINT soc_notification_prefs_user_unique UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE soc_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own preferences
CREATE POLICY "soc_notification_prefs_own" ON soc_notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 4. ALERT ASSIGNMENTS - Track who's working on what
-- ============================================================================

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for finding assigned alerts
CREATE INDEX IF NOT EXISTS idx_security_alerts_assigned_to
ON security_alerts(assigned_to)
WHERE assigned_to IS NOT NULL;

-- ============================================================================
-- 5. FUNCTIONS FOR SOC OPERATIONS
-- ============================================================================

-- Function to update presence (heartbeat)
CREATE OR REPLACE FUNCTION public.soc_heartbeat(
  p_status TEXT DEFAULT 'online',
  p_current_alert_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Get user info
  SELECT
    COALESCE(p.first_name || ' ' || p.last_name, p.email),
    p.email
  INTO v_user_name, v_user_email
  FROM profiles p
  WHERE p.user_id = auth.uid();

  -- Upsert presence
  INSERT INTO soc_presence (user_id, user_name, user_email, status, last_seen_at, current_alert_id)
  VALUES (auth.uid(), v_user_name, v_user_email, p_status, NOW(), p_current_alert_id)
  ON CONFLICT (user_id)
  DO UPDATE SET
    status = p_status,
    last_seen_at = NOW(),
    current_alert_id = p_current_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to go offline
CREATE OR REPLACE FUNCTION public.soc_go_offline()
RETURNS void AS $$
BEGIN
  UPDATE soc_presence
  SET status = 'offline', last_seen_at = NOW()
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add message to alert
CREATE OR REPLACE FUNCTION public.soc_add_alert_message(
  p_alert_id UUID,
  p_content TEXT,
  p_message_type TEXT DEFAULT 'comment'
)
RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
  v_author_name TEXT;
BEGIN
  -- Get author name
  SELECT COALESCE(p.first_name || ' ' || p.last_name, p.email)
  INTO v_author_name
  FROM profiles p
  WHERE p.user_id = auth.uid();

  -- Insert message
  INSERT INTO soc_alert_messages (alert_id, content, message_type, author_id, author_name)
  VALUES (p_alert_id, p_content, p_message_type, auth.uid(), v_author_name)
  RETURNING id INTO v_message_id;

  -- Log to audit
  PERFORM log_audit_event(
    'SOC_ALERT_MESSAGE',
    'security',
    'soc_alert_messages',
    v_message_id::text,
    auth.uid(),
    jsonb_build_object(
      'alert_id', p_alert_id,
      'message_type', p_message_type
    )
  );

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign alert
CREATE OR REPLACE FUNCTION public.soc_assign_alert(
  p_alert_id UUID,
  p_assignee_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_assignee_name TEXT;
BEGIN
  -- Get assignee name
  SELECT COALESCE(p.first_name || ' ' || p.last_name, p.email)
  INTO v_assignee_name
  FROM profiles p
  WHERE p.user_id = p_assignee_id;

  -- Update alert
  UPDATE security_alerts
  SET
    assigned_to = p_assignee_id,
    assigned_at = NOW(),
    assigned_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_alert_id;

  IF FOUND THEN
    -- Add system message
    PERFORM soc_add_alert_message(
      p_alert_id,
      format('Alert assigned to %s', v_assignee_name),
      'action'
    );

    -- Log to audit
    PERFORM log_audit_event(
      'SOC_ALERT_ASSIGNED',
      'security',
      'security_alerts',
      p_alert_id::text,
      auth.uid(),
      jsonb_build_object(
        'assigned_to', p_assignee_id,
        'assignee_name', v_assignee_name
      )
    );

    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get SOC dashboard summary
CREATE OR REPLACE FUNCTION public.soc_get_dashboard_summary()
RETURNS TABLE (
  critical_count BIGINT,
  high_count BIGINT,
  medium_count BIGINT,
  low_count BIGINT,
  unassigned_count BIGINT,
  escalated_count BIGINT,
  my_assigned_count BIGINT,
  online_operators BIGINT,
  avg_response_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE severity = 'critical' AND status IN ('new', 'investigating'))::BIGINT,
    COUNT(*) FILTER (WHERE severity = 'high' AND status IN ('new', 'investigating'))::BIGINT,
    COUNT(*) FILTER (WHERE severity = 'medium' AND status IN ('new', 'investigating'))::BIGINT,
    COUNT(*) FILTER (WHERE severity = 'low' AND status IN ('new', 'investigating'))::BIGINT,
    COUNT(*) FILTER (WHERE assigned_to IS NULL AND status IN ('new', 'investigating'))::BIGINT,
    COUNT(*) FILTER (WHERE escalated = true AND status NOT IN ('resolved', 'false_positive'))::BIGINT,
    COUNT(*) FILTER (WHERE assigned_to = auth.uid() AND status IN ('new', 'investigating'))::BIGINT,
    (SELECT COUNT(*) FROM soc_presence WHERE status = 'online' AND last_seen_at > NOW() - interval '5 minutes')::BIGINT,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (
          COALESCE(resolution_time, NOW()) - created_at
        )) / 60
      ) FILTER (WHERE status = 'investigating')::NUMERIC,
      1
    )
  FROM security_alerts
  WHERE created_at > NOW() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up stale presence (run periodically)
CREATE OR REPLACE FUNCTION public.soc_cleanup_stale_presence()
RETURNS void AS $$
BEGIN
  UPDATE soc_presence
  SET status = 'offline'
  WHERE status != 'offline'
    AND last_seen_at < NOW() - interval '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.soc_heartbeat(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soc_go_offline() TO authenticated;
GRANT EXECUTE ON FUNCTION public.soc_add_alert_message(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soc_assign_alert(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soc_get_dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.soc_cleanup_stale_presence() TO service_role;

-- ============================================================================
-- 7. SCHEDULE CLEANUP (if pg_cron available)
-- ============================================================================

DO $$
BEGIN
  -- Clean up stale presence every minute
  PERFORM cron.schedule(
    'soc-cleanup-stale-presence',
    '* * * * *',
    'SELECT soc_cleanup_stale_presence()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available for SOC presence cleanup scheduling';
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE soc_alert_messages IS 'Team collaboration messages on security alerts';
COMMENT ON TABLE soc_presence IS 'Real-time presence tracking for SOC operators';
COMMENT ON TABLE soc_notification_preferences IS 'Per-user notification settings for SOC dashboard';
COMMENT ON FUNCTION soc_heartbeat IS 'Update user presence in SOC (call every 30 seconds)';
COMMENT ON FUNCTION soc_get_dashboard_summary IS 'Get summary statistics for SOC dashboard';
