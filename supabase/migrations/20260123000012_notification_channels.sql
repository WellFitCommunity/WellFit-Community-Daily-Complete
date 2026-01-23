-- Notification Channels for Alert Routing
-- Purpose: Configure external notification channels (Slack, PagerDuty, webhooks)
-- Integration: Guardian alerts, security events, SLA breaches

-- ============================================================================
-- 1. NOTIFICATION CHANNELS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Channel info
  channel_type TEXT NOT NULL CHECK (channel_type IN ('slack', 'pagerduty', 'email', 'webhook', 'sms')),
  name TEXT NOT NULL,
  description TEXT,

  -- Status
  is_enabled BOOLEAN DEFAULT TRUE,

  -- Configuration (encrypted in production)
  config JSONB NOT NULL DEFAULT '{}',
  -- For Slack: { webhookUrl }
  -- For PagerDuty: { routingKey, apiKey }
  -- For Email: { emailAddresses: [] }
  -- For Webhook: { webhookUrl, headers: {} }
  -- For SMS: { phoneNumbers: [] }

  -- Filters - which alerts to send
  filters JSONB DEFAULT '{"severities": ["warning", "critical", "emergency"], "categories": []}',
  -- severities: [] = all, or ['warning', 'critical', 'emergency']
  -- categories: [] = all, or ['security', 'sla', 'system', 'clinical', 'billing']

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. NOTIFICATION LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Channel reference
  channel_id UUID REFERENCES notification_channels(id) ON DELETE SET NULL,
  channel_type TEXT NOT NULL,

  -- Alert reference
  alert_id TEXT,  -- May reference guardian_alerts or other alert sources

  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  response_id TEXT,  -- External ID (e.g., PagerDuty dedup key)

  -- Payload (optional, for debugging)
  payload JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. NOTIFICATION SCHEDULES (Optional - for quiet hours)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,

  -- Schedule type
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('quiet_hours', 'business_hours')),

  -- Time configuration
  timezone TEXT DEFAULT 'America/Chicago',
  days_of_week INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6],  -- 0 = Sunday
  start_time TIME,  -- e.g., '22:00' for quiet hours start
  end_time TIME,    -- e.g., '07:00' for quiet hours end

  -- Override settings
  override_for_emergency BOOLEAN DEFAULT TRUE,  -- Always notify for emergency

  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant ON notification_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_notification_channels_enabled ON notification_channels(is_enabled) WHERE is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_notification_log_tenant ON notification_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_channel ON notification_log(channel_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_alert ON notification_log(alert_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_created ON notification_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_success ON notification_log(success);

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- Get channels that should receive an alert
CREATE OR REPLACE FUNCTION get_active_notification_channels(
  p_tenant_id UUID,
  p_severity TEXT,
  p_category TEXT
)
RETURNS TABLE (
  id UUID,
  channel_type TEXT,
  name TEXT,
  config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    nc.id,
    nc.channel_type,
    nc.name,
    nc.config
  FROM notification_channels nc
  WHERE nc.tenant_id = p_tenant_id
    AND nc.is_enabled = TRUE
    AND (
      -- Empty severities array means all severities
      jsonb_array_length(nc.filters->'severities') = 0
      OR nc.filters->'severities' ? p_severity
    )
    AND (
      -- Empty categories array means all categories
      jsonb_array_length(nc.filters->'categories') = 0
      OR nc.filters->'categories' ? p_category
    )
    AND NOT EXISTS (
      -- Check for quiet hours that would block this notification
      SELECT 1 FROM notification_schedules ns
      WHERE ns.channel_id = nc.id
        AND ns.is_enabled = TRUE
        AND ns.schedule_type = 'quiet_hours'
        AND (
          -- During quiet hours (not emergency or emergency override disabled)
          (p_severity != 'emergency' OR NOT ns.override_for_emergency)
          AND EXTRACT(DOW FROM NOW() AT TIME ZONE ns.timezone) = ANY(ns.days_of_week)
          AND (NOW() AT TIME ZONE ns.timezone)::TIME >= ns.start_time
          AND (NOW() AT TIME ZONE ns.timezone)::TIME <= ns.end_time
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get notification statistics
CREATE OR REPLACE FUNCTION get_notification_stats(
  p_tenant_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_notifications BIGINT,
  successful BIGINT,
  failed BIGINT,
  by_channel JSONB,
  by_day JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT *
    FROM notification_log
    WHERE tenant_id = p_tenant_id
      AND created_at >= NOW() - (p_days || ' days')::INTERVAL
  ),
  by_ch AS (
    SELECT jsonb_object_agg(channel_type, cnt) AS data
    FROM (
      SELECT channel_type, COUNT(*) AS cnt
      FROM base
      GROUP BY channel_type
    ) c
  ),
  by_d AS (
    SELECT jsonb_agg(jsonb_build_object(
      'date', dt::TEXT,
      'total', total,
      'success', succ,
      'failed', fail
    ) ORDER BY dt) AS data
    FROM (
      SELECT
        DATE(created_at) AS dt,
        COUNT(*) AS total,
        COUNT(CASE WHEN success THEN 1 END) AS succ,
        COUNT(CASE WHEN NOT success THEN 1 END) AS fail
      FROM base
      GROUP BY DATE(created_at)
    ) d
  )
  SELECT
    COUNT(*)::BIGINT,
    COUNT(CASE WHEN success THEN 1 END)::BIGINT,
    COUNT(CASE WHEN NOT success THEN 1 END)::BIGINT,
    COALESCE((SELECT data FROM by_ch), '{}'::JSONB),
    COALESCE((SELECT data FROM by_d), '[]'::JSONB)
  FROM base;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log a notification attempt
CREATE OR REPLACE FUNCTION log_notification(
  p_tenant_id UUID,
  p_channel_id UUID,
  p_channel_type TEXT,
  p_alert_id TEXT,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_response_id TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notification_log (
    tenant_id,
    channel_id,
    channel_type,
    alert_id,
    success,
    error_message,
    response_id,
    payload
  ) VALUES (
    p_tenant_id,
    p_channel_id,
    p_channel_type,
    p_alert_id,
    p_success,
    p_error_message,
    p_response_id,
    p_payload
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;

-- Channels - admins can manage their tenant's channels
CREATE POLICY "Admins manage notification channels"
  ON notification_channels FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND (p.role = 'super_admin' OR p.tenant_id = notification_channels.tenant_id)
    )
  );

-- Log - admins can view their tenant's logs
CREATE POLICY "Admins view notification logs"
  ON notification_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND (p.role = 'super_admin' OR p.tenant_id = notification_log.tenant_id)
    )
  );

-- System can insert logs
CREATE POLICY "System insert notification logs"
  ON notification_log FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- Schedules - admins manage
CREATE POLICY "Admins manage notification schedules"
  ON notification_schedules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notification_channels nc
      JOIN profiles p ON p.user_id = auth.uid()
      WHERE nc.id = notification_schedules.channel_id
        AND p.role IN ('admin', 'super_admin')
        AND (p.role = 'super_admin' OR p.tenant_id = nc.tenant_id)
    )
  );

-- ============================================================================
-- 7. CLEANUP FUNCTION
-- ============================================================================

-- Cleanup old notification logs (retain 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_notification_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM notification_log
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE notification_channels IS 'External notification channel configurations (Slack, PagerDuty, etc.)';
COMMENT ON TABLE notification_log IS 'Log of all notification attempts';
COMMENT ON TABLE notification_schedules IS 'Quiet hours and business hours schedules for channels';
COMMENT ON FUNCTION get_active_notification_channels IS 'Get channels that should receive an alert based on filters and schedules';
COMMENT ON FUNCTION get_notification_stats IS 'Get notification statistics for a tenant';
COMMENT ON FUNCTION log_notification IS 'Log a notification attempt';
