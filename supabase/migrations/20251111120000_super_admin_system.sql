/**
 * Super Admin System
 *
 * Master control panel for Envision VirtualEdge Group LLC
 * System-wide administration separate from tenant admin
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- ============================================================================
-- SUPER ADMIN ROLES
-- ============================================================================

/**
 * Super admin roles table
 * Separate from tenant roles - these users have cross-tenant powers
 */
CREATE TABLE IF NOT EXISTS super_admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'system_operator', 'auditor')),
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id),

  UNIQUE(user_id)
);

CREATE INDEX idx_super_admin_users_user_id ON super_admin_users(user_id);
CREATE INDEX idx_super_admin_users_email ON super_admin_users(email);
CREATE INDEX idx_super_admin_users_active ON super_admin_users(is_active) WHERE is_active = true;

COMMENT ON TABLE super_admin_users IS 'Envision VirtualEdge Group LLC super administrators with cross-tenant access';
COMMENT ON COLUMN super_admin_users.role IS 'super_admin: Full control, system_operator: Read/write, auditor: Read-only';
COMMENT ON COLUMN super_admin_users.permissions IS 'Array of permission strings: ["tenants.manage", "features.toggle", "system.kill_switch", "users.manage", "audit.view"]';

-- ============================================================================
-- SYSTEM CONTROLS
-- ============================================================================

/**
 * Global feature flags
 * Can be overridden at tenant level, but super admin can force disable
 */
CREATE TABLE IF NOT EXISTS system_feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_key TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  force_disabled BOOLEAN NOT NULL DEFAULT false, -- Super admin emergency kill switch
  enabled_for_new_tenants BOOLEAN NOT NULL DEFAULT true,
  requires_license BOOLEAN NOT NULL DEFAULT false,
  category TEXT, -- 'core', 'healthcare', 'law_enforcement', 'billing', etc.
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES super_admin_users(id)
);

CREATE INDEX idx_system_feature_flags_key ON system_feature_flags(feature_key);
CREATE INDEX idx_system_feature_flags_category ON system_feature_flags(category);
CREATE INDEX idx_system_feature_flags_force_disabled ON system_feature_flags(force_disabled) WHERE force_disabled = true;

COMMENT ON TABLE system_feature_flags IS 'Global feature flags with super admin override capability';
COMMENT ON COLUMN system_feature_flags.force_disabled IS 'Emergency kill switch - when true, feature is disabled for ALL tenants regardless of their settings';

/**
 * Tenant override table
 * Super admin can enable/disable entire tenants
 */
CREATE TABLE IF NOT EXISTS tenant_system_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  suspension_reason TEXT,
  suspended_at TIMESTAMPTZ,
  suspended_by UUID REFERENCES super_admin_users(id),
  max_users INTEGER,
  max_patients INTEGER,
  storage_quota_gb INTEGER DEFAULT 100,
  api_rate_limit INTEGER DEFAULT 1000, -- requests per minute
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES super_admin_users(id),

  UNIQUE(tenant_id)
);

CREATE INDEX idx_tenant_system_status_tenant_id ON tenant_system_status(tenant_id);
CREATE INDEX idx_tenant_system_status_suspended ON tenant_system_status(is_suspended) WHERE is_suspended = true;

COMMENT ON TABLE tenant_system_status IS 'Super admin controls for tenant activation, suspension, and resource limits';

/**
 * System health checks
 * Automated monitoring with super admin visibility
 */
CREATE TABLE IF NOT EXISTS system_health_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_type TEXT NOT NULL, -- 'database', 'api', 'storage', 'cache', 'integration'
  check_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  response_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_health_checks_type ON system_health_checks(check_type);
CREATE INDEX idx_system_health_checks_status ON system_health_checks(status);
CREATE INDEX idx_system_health_checks_checked_at ON system_health_checks(checked_at DESC);

COMMENT ON TABLE system_health_checks IS 'System health monitoring for super admin dashboard';

-- ============================================================================
-- AUDIT LOGGING
-- ============================================================================

/**
 * Super admin audit log
 * Track all super admin actions for security and compliance
 */
CREATE TABLE IF NOT EXISTS super_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  super_admin_id UUID REFERENCES super_admin_users(id) ON DELETE SET NULL,
  super_admin_email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'tenant.suspend', 'feature.disable', 'user.delete', etc.
  target_type TEXT, -- 'tenant', 'feature', 'user', 'system'
  target_id TEXT,
  target_name TEXT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_super_admin_audit_log_admin_id ON super_admin_audit_log(super_admin_id);
CREATE INDEX idx_super_admin_audit_log_action ON super_admin_audit_log(action);
CREATE INDEX idx_super_admin_audit_log_target ON super_admin_audit_log(target_type, target_id);
CREATE INDEX idx_super_admin_audit_log_created_at ON super_admin_audit_log(created_at DESC);
CREATE INDEX idx_super_admin_audit_log_severity ON super_admin_audit_log(severity) WHERE severity = 'critical';

COMMENT ON TABLE super_admin_audit_log IS 'SOC 2 audit trail for all super admin actions';

-- ============================================================================
-- SYSTEM METRICS
-- ============================================================================

/**
 * System-wide metrics for dashboard
 */
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type TEXT NOT NULL, -- 'tenant_count', 'user_count', 'patient_count', 'api_requests', 'storage_used_gb'
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX idx_system_metrics_recorded_at ON system_metrics(recorded_at DESC);

-- ============================================================================
-- SECURITY POLICIES (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE super_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_system_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Super admin users can see everything
CREATE POLICY super_admin_full_access_super_admin_users
  ON super_admin_users
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admin_users WHERE is_active = true
    )
  );

CREATE POLICY super_admin_full_access_feature_flags
  ON system_feature_flags
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admin_users WHERE is_active = true
    )
  );

CREATE POLICY super_admin_full_access_tenant_status
  ON tenant_system_status
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admin_users WHERE is_active = true
    )
  );

CREATE POLICY super_admin_full_access_health_checks
  ON system_health_checks
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admin_users WHERE is_active = true
    )
  );

CREATE POLICY super_admin_full_access_audit_log
  ON super_admin_audit_log
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admin_users WHERE is_active = true
    )
  );

CREATE POLICY super_admin_full_access_metrics
  ON system_metrics
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admin_users WHERE is_active = true
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

/**
 * Check if current user is super admin
 */
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM super_admin_users
    WHERE user_id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Get system overview stats
 */
CREATE OR REPLACE FUNCTION get_system_overview()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin only';
  END IF;

  SELECT jsonb_build_object(
    'total_tenants', (SELECT COUNT(*) FROM tenants),
    'active_tenants', (SELECT COUNT(*) FROM tenant_system_status WHERE is_active = true),
    'suspended_tenants', (SELECT COUNT(*) FROM tenant_system_status WHERE is_suspended = true),
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'total_patients', (SELECT COUNT(*) FROM patients),
    'features_force_disabled', (SELECT COUNT(*) FROM system_feature_flags WHERE force_disabled = true),
    'critical_health_issues', (SELECT COUNT(*) FROM system_health_checks WHERE status = 'down' AND checked_at > NOW() - INTERVAL '5 minutes'),
    'critical_audit_events_24h', (SELECT COUNT(*) FROM super_admin_audit_log WHERE severity = 'critical' AND created_at > NOW() - INTERVAL '24 hours')
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Get all tenants with status
 */
CREATE OR REPLACE FUNCTION get_all_tenants_with_status()
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  subdomain TEXT,
  is_active BOOLEAN,
  is_suspended BOOLEAN,
  suspension_reason TEXT,
  user_count BIGINT,
  patient_count BIGINT,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin only';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.subdomain,
    COALESCE(tss.is_active, true),
    COALESCE(tss.is_suspended, false),
    tss.suspension_reason,
    (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id),
    (SELECT COUNT(*) FROM patients p WHERE p.tenant_id = t.id),
    (SELECT MAX(created_at) FROM audit_logs WHERE tenant_id = t.id),
    t.created_at
  FROM tenants t
  LEFT JOIN tenant_system_status tss ON tss.tenant_id = t.id
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Emergency kill switch - force disable feature globally
 */
CREATE OR REPLACE FUNCTION emergency_disable_feature(
  p_feature_key TEXT,
  p_reason TEXT,
  p_super_admin_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin only';
  END IF;

  -- Disable feature
  UPDATE system_feature_flags
  SET force_disabled = true,
      updated_at = NOW(),
      updated_by = p_super_admin_id
  WHERE feature_key = p_feature_key;

  -- Log critical audit event
  INSERT INTO super_admin_audit_log (
    super_admin_id,
    super_admin_email,
    action,
    target_type,
    target_id,
    target_name,
    new_value,
    reason,
    severity
  ) VALUES (
    p_super_admin_id,
    (SELECT email FROM super_admin_users WHERE id = p_super_admin_id),
    'feature.emergency_disable',
    'feature',
    p_feature_key,
    (SELECT feature_name FROM system_feature_flags WHERE feature_key = p_feature_key),
    jsonb_build_object('force_disabled', true),
    p_reason,
    'critical'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Suspend tenant
 */
CREATE OR REPLACE FUNCTION suspend_tenant(
  p_tenant_id UUID,
  p_reason TEXT,
  p_super_admin_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin only';
  END IF;

  -- Suspend tenant
  INSERT INTO tenant_system_status (
    tenant_id,
    is_active,
    is_suspended,
    suspension_reason,
    suspended_at,
    suspended_by
  ) VALUES (
    p_tenant_id,
    false,
    true,
    p_reason,
    NOW(),
    p_super_admin_id
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    is_active = false,
    is_suspended = true,
    suspension_reason = p_reason,
    suspended_at = NOW(),
    suspended_by = p_super_admin_id,
    updated_at = NOW();

  -- Log critical audit event
  INSERT INTO super_admin_audit_log (
    super_admin_id,
    super_admin_email,
    action,
    target_type,
    target_id,
    target_name,
    new_value,
    reason,
    severity
  ) VALUES (
    p_super_admin_id,
    (SELECT email FROM super_admin_users WHERE id = p_super_admin_id),
    'tenant.suspend',
    'tenant',
    p_tenant_id::text,
    (SELECT name FROM tenants WHERE id = p_tenant_id),
    jsonb_build_object('is_suspended', true, 'is_active', false),
    p_reason,
    'critical'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA
-- ============================================================================

/**
 * Insert default system feature flags
 */
INSERT INTO system_feature_flags (feature_key, feature_name, description, category) VALUES
  ('core.authentication', 'User Authentication', 'Core authentication system', 'core'),
  ('core.multi_tenant', 'Multi-Tenant Isolation', 'Tenant separation and RLS', 'core'),
  ('healthcare.ehr_integration', 'EHR Integration', 'Epic/Cerner adapters', 'healthcare'),
  ('healthcare.sdoh_static', 'SDOH Static Assessment', 'Structured SDOH forms', 'healthcare'),
  ('healthcare.sdoh_passive', 'SDOH Passive Detection', 'NLP-based SDOH detection', 'healthcare'),
  ('healthcare.risk_assessment', 'Risk Assessment', 'Patient risk scoring', 'healthcare'),
  ('healthcare.ccm', 'Chronic Care Management', 'CCM billing and workflows', 'healthcare'),
  ('healthcare.dental', 'Dental Module', 'Dental health tracking', 'healthcare'),
  ('law_enforcement.welfare_checks', 'Welfare Check System', 'Senior welfare check dispatch', 'law_enforcement'),
  ('law_enforcement.emergency_response', 'Emergency Response Info', 'First responder information', 'law_enforcement'),
  ('billing.insurance_claims', 'Insurance Claims', 'Claims submission and tracking', 'billing'),
  ('billing.z_codes', 'Z-Code Billing', 'SDOH Z-code billing', 'billing')
ON CONFLICT (feature_key) DO NOTHING;

COMMENT ON TABLE system_feature_flags IS 'System feature flags with emergency kill switch capability for super admin';
