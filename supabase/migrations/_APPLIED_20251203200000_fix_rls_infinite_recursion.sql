-- ============================================================================
-- Fix RLS Infinite Recursion on super_admin_users
-- Date: 2025-12-03
-- Purpose: Fix the infinite recursion bug in RLS policies that reference
--          super_admin_users from within super_admin_users policies
--
-- Problem: Policies on super_admin_users were doing:
--   USING (auth.uid() IN (SELECT user_id FROM super_admin_users WHERE is_active = true))
-- This causes infinite recursion when Postgres evaluates the policy.
--
-- Solution: Use is_super_admin() function which is SECURITY DEFINER and
--           bypasses RLS, breaking the recursion.
-- ============================================================================

-- ============================================================================
-- 1. DROP ALL PROBLEMATIC POLICIES ON super_admin_users
-- ============================================================================

DROP POLICY IF EXISTS super_admin_users_read_all ON super_admin_users;
DROP POLICY IF EXISTS super_admin_users_write ON super_admin_users;
DROP POLICY IF EXISTS super_admin_full_access_super_admin_users ON super_admin_users;

-- Keep the safe policy that only reads own record
DROP POLICY IF EXISTS super_admin_users_read_own ON super_admin_users;

-- ============================================================================
-- 2. CREATE SAFE is_super_admin_bypass FUNCTION
-- This function uses SECURITY DEFINER to bypass RLS on super_admin_users
-- ============================================================================

CREATE OR REPLACE FUNCTION is_super_admin_bypass(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admin_users
    WHERE user_id = check_user_id AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION is_super_admin_bypass(UUID) TO authenticated;

-- ============================================================================
-- 3. RECREATE SAFE POLICIES ON super_admin_users
-- ============================================================================

-- Users can read their OWN record (for login check)
-- This is safe because it only uses auth.uid() = user_id comparison
DROP POLICY IF EXISTS super_admin_users_read_own ON super_admin_users;
CREATE POLICY super_admin_users_read_own
  ON super_admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- Super admins can manage all records - uses bypass function
DROP POLICY IF EXISTS super_admin_users_manage_all ON super_admin_users;
CREATE POLICY super_admin_users_manage_all
  ON super_admin_users
  FOR ALL
  USING (is_super_admin_bypass(auth.uid()))
  WITH CHECK (is_super_admin_bypass(auth.uid()));

-- ============================================================================
-- 4. FIX ALL OTHER TABLES THAT REFERENCE super_admin_users IN POLICIES
-- ============================================================================

-- system_feature_flags
DROP POLICY IF EXISTS system_feature_flags_super_admin ON system_feature_flags;
CREATE POLICY system_feature_flags_super_admin
  ON system_feature_flags
  FOR ALL
  USING (is_super_admin_bypass(auth.uid()));

-- system_health_checks
DROP POLICY IF EXISTS system_health_checks_super_admin ON system_health_checks;
CREATE POLICY system_health_checks_super_admin
  ON system_health_checks
  FOR ALL
  USING (is_super_admin_bypass(auth.uid()));

-- super_admin_audit_log
DROP POLICY IF EXISTS super_admin_audit_log_super_admin ON super_admin_audit_log;
CREATE POLICY super_admin_audit_log_super_admin
  ON super_admin_audit_log
  FOR ALL
  USING (is_super_admin_bypass(auth.uid()));

-- system_metrics
DROP POLICY IF EXISTS system_metrics_super_admin ON system_metrics;
CREATE POLICY system_metrics_super_admin
  ON system_metrics
  FOR ALL
  USING (is_super_admin_bypass(auth.uid()));

-- ai_skill_config
DROP POLICY IF EXISTS ai_skill_config_super_admin ON ai_skill_config;
DROP POLICY IF EXISTS "Super admins full access ai_skill_config" ON ai_skill_config;
CREATE POLICY ai_skill_config_super_admin
  ON ai_skill_config
  FOR ALL
  USING (is_super_admin_bypass(auth.uid()));

-- guardian_alerts
DROP POLICY IF EXISTS "Super admins can view all guardian alerts" ON guardian_alerts;
DROP POLICY IF EXISTS "Super admins can update guardian alerts" ON guardian_alerts;
DROP POLICY IF EXISTS "Super admins can insert guardian alerts" ON guardian_alerts;

CREATE POLICY super_admin_view_guardian_alerts
  ON guardian_alerts
  FOR SELECT
  TO authenticated
  USING (is_super_admin_bypass(auth.uid()));

CREATE POLICY super_admin_update_guardian_alerts
  ON guardian_alerts
  FOR UPDATE
  TO authenticated
  USING (is_super_admin_bypass(auth.uid()));

CREATE POLICY super_admin_insert_guardian_alerts
  ON guardian_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin_bypass(auth.uid()));

-- guardian_cron_log
DROP POLICY IF EXISTS "Super admins can view guardian cron logs" ON guardian_cron_log;
DROP POLICY IF EXISTS "Super admins can manage guardian cron logs" ON guardian_cron_log;

CREATE POLICY super_admin_guardian_cron_log
  ON guardian_cron_log
  FOR ALL
  TO authenticated
  USING (is_super_admin_bypass(auth.uid()));

-- tenant_module_config
DROP POLICY IF EXISTS "Super admins can view all tenant module configs" ON tenant_module_config;
DROP POLICY IF EXISTS "Super admins can update all tenant module configs" ON tenant_module_config;

CREATE POLICY super_admin_view_tenant_module_config
  ON tenant_module_config
  FOR SELECT
  TO authenticated
  USING (is_super_admin_bypass(auth.uid()));

CREATE POLICY super_admin_update_tenant_module_config
  ON tenant_module_config
  FOR UPDATE
  TO authenticated
  USING (is_super_admin_bypass(auth.uid()))
  WITH CHECK (is_super_admin_bypass(auth.uid()));

-- admin_audit_logs (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_audit_logs') THEN
    DROP POLICY IF EXISTS "Super admins can view all audit logs" ON admin_audit_logs;

    CREATE POLICY super_admin_view_admin_audit_logs
      ON admin_audit_logs
      FOR SELECT
      TO authenticated
      USING (is_super_admin_bypass(auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- 5. UPDATE is_super_admin() TO USE THE BYPASS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT is_super_admin_bypass(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================

-- ============================================================================
-- 7. FIX TABLE GRANTS - authenticated role needs SELECT/INSERT/UPDATE/DELETE
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON super_admin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON system_feature_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON system_health_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON super_admin_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON system_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_module_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guardian_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_skill_config TO authenticated;

-- Drop old conflicting policies
DROP POLICY IF EXISTS super_admin_full_access_feature_flags ON system_feature_flags;

-- ============================================================================
-- 8. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'RLS Infinite Recursion Fix Complete!';
  RAISE NOTICE '- Created is_super_admin_bypass(UUID) function';
  RAISE NOTICE '- Fixed super_admin_users policies to avoid recursion';
  RAISE NOTICE '- Updated all dependent table policies';
  RAISE NOTICE '- Fixed grants for authenticated role';
END $$;
