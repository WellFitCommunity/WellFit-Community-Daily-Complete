-- ============================================================================
-- Create Security Events Table
-- ============================================================================
-- Purpose: SOC 2 CC7.3 compliance - Security incident tracking
--
-- This table was previously in a skipped migration. The frontend code
-- (securityAutomationService.ts) queries this table for threshold monitoring.
-- ============================================================================

-- ============================================================================
-- SECURITY EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event metadata
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

    -- Event details
    category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
        'authentication', 'authorization', 'data_access', 'configuration_change',
        'encryption', 'backup', 'vulnerability', 'malware', 'dos', 'intrusion',
        'policy_violation', 'compliance', 'other'
    )),
    description TEXT NOT NULL,

    -- Source information
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id TEXT,
    ip_address INET,
    user_agent TEXT,

    -- Affected resources
    affected_resource_type TEXT,
    affected_resource_id UUID,
    affected_user_count INTEGER DEFAULT 0,

    -- Detection
    detection_method TEXT NOT NULL DEFAULT 'automated' CHECK (detection_method IN (
        'automated', 'user_report', 'admin_review', 'external_scan', 'intrusion_detection'
    )),
    detected_by TEXT,

    -- Response tracking
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
        'new', 'investigating', 'contained', 'remediated', 'closed', 'false_positive'
    )),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    response_started_at TIMESTAMPTZ,
    response_completed_at TIMESTAMPTZ,

    -- Impact assessment
    data_breach BOOLEAN DEFAULT FALSE,
    phi_exposed BOOLEAN DEFAULT FALSE,
    systems_affected TEXT[],
    estimated_impact TEXT,

    -- Notification tracking
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_channels TEXT[],
    notified_parties TEXT[],

    -- Remediation
    remediation_actions TEXT[],
    remediation_notes TEXT,
    lessons_learned TEXT,

    -- Compliance reporting
    reportable_incident BOOLEAN DEFAULT FALSE,
    reported_to TEXT[],
    reported_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Guardian Agent fields
    auto_blocked BOOLEAN DEFAULT FALSE,
    requires_investigation BOOLEAN DEFAULT FALSE,

    -- Tenant isolation
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_status ON security_events(status);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_events_tenant ON security_events(tenant_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Super admins can see all events
CREATE POLICY security_events_super_admin_all ON security_events
  FOR ALL
  TO authenticated
  USING (is_super_admin_bypass(auth.uid()))
  WITH CHECK (is_super_admin_bypass(auth.uid()));

-- Tenant admins can see events for their tenant
CREATE POLICY security_events_tenant_admin_select ON security_events
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Service role can insert events (for automated systems)
CREATE POLICY security_events_service_insert ON security_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON security_events TO authenticated;
GRANT ALL ON security_events TO service_role;

-- ============================================================================
-- TRIGGER: Link security events to alerts
-- ============================================================================

-- Function to automatically create an alert when a critical security event occurs
CREATE OR REPLACE FUNCTION create_alert_from_critical_security_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create alerts for HIGH or CRITICAL events
  IF NEW.severity IN ('HIGH', 'CRITICAL') THEN
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
      CASE NEW.category
        WHEN 'authentication' THEN 'brute_force_attack'
        WHEN 'authorization' THEN 'unauthorized_access'
        WHEN 'data_access' THEN 'data_exfiltration'
        ELSE 'anomalous_behavior'
      END,
      NEW.event_type,
      NEW.description,
      jsonb_build_object(
        'security_event_id', NEW.id,
        'category', NEW.category,
        'ip_address', NEW.ip_address::TEXT,
        'user_agent', NEW.user_agent
      ),
      'new',
      NEW.user_id,
      NEW.detection_method
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS create_alert_from_security_event_trigger ON security_events;
CREATE TRIGGER create_alert_from_security_event_trigger
  AFTER INSERT ON security_events
  FOR EACH ROW
  EXECUTE FUNCTION create_alert_from_critical_security_event();

-- ============================================================================
-- ADD MISSING COLUMNS (if table already exists)
-- ============================================================================

ALTER TABLE public.security_events
ADD COLUMN IF NOT EXISTS auto_blocked BOOLEAN DEFAULT FALSE;

ALTER TABLE public.security_events
ADD COLUMN IF NOT EXISTS requires_investigation BOOLEAN DEFAULT FALSE;

ALTER TABLE public.security_events
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'security_events table created/updated successfully';
  RAISE NOTICE '- Indexes created';
  RAISE NOTICE '- RLS policies configured';
  RAISE NOTICE '- Grants applied';
  RAISE NOTICE '- Alert trigger installed';
  RAISE NOTICE '- Guardian Agent columns added (auto_blocked, requires_investigation)';
END $$;
