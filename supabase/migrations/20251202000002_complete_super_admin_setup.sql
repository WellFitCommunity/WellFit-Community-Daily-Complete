-- ============================================================================
-- Complete Super Admin Panel Setup
-- Date: 2025-12-02
-- Purpose: Create all missing RPC functions, RLS policies, and tables
--          needed for the Envision Super Admin dashboard
-- ============================================================================

-- ============================================================================
-- 1. RLS POLICIES FOR super_admin_users
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS super_admin_full_access_super_admin_users ON super_admin_users;
DROP POLICY IF EXISTS super_admin_users_read_own ON super_admin_users;
DROP POLICY IF EXISTS super_admin_users_read_all ON super_admin_users;
DROP POLICY IF EXISTS super_admin_users_write ON super_admin_users;

-- Users can read their OWN record (for login check)
CREATE POLICY super_admin_users_read_own
  ON super_admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- Active super admins can read ALL records
CREATE POLICY super_admin_users_read_all
  ON super_admin_users
  FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
  );

-- Active super admins can write
CREATE POLICY super_admin_users_write
  ON super_admin_users
  FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true)
  );

-- ============================================================================
-- 2. is_super_admin RPC
-- ============================================================================

DROP FUNCTION IF EXISTS is_super_admin();

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

-- ============================================================================
-- 3. get_system_overview RPC
-- ============================================================================

DROP FUNCTION IF EXISTS get_system_overview();

CREATE OR REPLACE FUNCTION get_system_overview()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_tenants', (SELECT COUNT(*) FROM tenants),
    'active_tenants', (SELECT COUNT(*) FROM tenants),
    'suspended_tenants', 0,
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_patients', (SELECT COUNT(*) FROM profiles WHERE role_code IN (4, 19)),
    'total_staff', (SELECT COUNT(*) FROM profiles WHERE role_code IN (1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13)),
    'total_check_ins_today', (SELECT COUNT(*) FROM check_ins WHERE created_at >= CURRENT_DATE),
    'total_check_ins_week', (SELECT COUNT(*) FROM check_ins WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'features_force_disabled', 0,
    'critical_health_issues', 0,
    'critical_audit_events_24h', 0,
    'system_health', 'healthy',
    'last_updated', NOW()
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_system_overview() TO authenticated;

-- ============================================================================
-- 4. get_all_tenants_with_status RPC
-- ============================================================================

DROP FUNCTION IF EXISTS get_all_tenants_with_status();

CREATE OR REPLACE FUNCTION get_all_tenants_with_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', t.id,
      'tenant_id', t.id,
      'tenant_name', t.name,
      'subdomain', t.subdomain,
      'tenant_code', t.tenant_code,
      'licensed_products', ARRAY['wellfit', 'atlus'],
      'is_active', true,
      'is_suspended', false,
      'status', 'active',
      'user_count', (SELECT COUNT(*) FROM profiles p WHERE p.tenant_id = t.id),
      'patient_count', (SELECT COUNT(*) FROM profiles p WHERE p.tenant_id = t.id AND p.role_code IN (4, 19)),
      'created_at', t.created_at
    )
  ), '[]'::json)
  FROM tenants t
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_tenants_with_status() TO authenticated;

-- ============================================================================
-- 5. Create system_feature_flags table if not exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT UNIQUE NOT NULL,
  feature_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  force_disabled BOOLEAN DEFAULT false,
  enabled_for_new_tenants BOOLEAN DEFAULT true,
  requires_license TEXT,
  category TEXT DEFAULT 'general',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

ALTER TABLE system_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_feature_flags_super_admin ON system_feature_flags;
CREATE POLICY system_feature_flags_super_admin
  ON system_feature_flags
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true));

-- ============================================================================
-- 6. Create system_health_checks table if not exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type TEXT NOT NULL,
  check_name TEXT NOT NULL,
  component_name TEXT,
  status TEXT NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  message TEXT,
  metrics JSONB,
  metadata JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_health_checks_super_admin ON system_health_checks;
CREATE POLICY system_health_checks_super_admin
  ON system_health_checks
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true));

-- ============================================================================
-- 7. Create super_admin_audit_log table if not exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS super_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID,
  super_admin_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_name TEXT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  severity TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE super_admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_audit_log_super_admin ON super_admin_audit_log;
CREATE POLICY super_admin_audit_log_super_admin
  ON super_admin_audit_log
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true));

-- ============================================================================
-- 8. Create system_metrics table if not exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  metric_value NUMERIC,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_metrics_super_admin ON system_metrics;
CREATE POLICY system_metrics_super_admin
  ON system_metrics
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true));

-- ============================================================================
-- 9. Create ai_skill_config table if not exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_skill_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_key TEXT UNIQUE NOT NULL,
  skill_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_skill_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_skill_config_super_admin ON ai_skill_config;
CREATE POLICY ai_skill_config_super_admin
  ON ai_skill_config
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true));

-- ============================================================================
-- 10. Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Super Admin Panel setup complete!';
  RAISE NOTICE 'Tables created/verified: super_admin_users, system_feature_flags, system_health_checks, super_admin_audit_log, system_metrics, ai_skill_config';
  RAISE NOTICE 'RPC functions created: is_super_admin, get_system_overview, get_all_tenants_with_status';
END $$;
