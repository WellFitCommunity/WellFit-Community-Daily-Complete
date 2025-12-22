-- ============================================================================
-- Fix RLS Policies for Super Admin Access
-- ============================================================================
-- Problem: Super admins getting 401 errors because tenant-based RLS policies
-- require app.current_tenant_id to be set, which isn't happening for REST API calls.
--
-- Solution: Add policies that allow super_admin and admin users to bypass
-- tenant restrictions, and fix any profiles.id vs profiles.user_id mismatches.
-- ============================================================================

-- Helper function to check if current user is super_admin or admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- FIX: claude_admin_task_templates
-- ============================================================================
-- Drop problematic tenant policy and replace with admin-aware version
DROP POLICY IF EXISTS "claude_admin_task_templates_tenant" ON claude_admin_task_templates;
DROP POLICY IF EXISTS "claude_admin_task_templates_admin_access" ON claude_admin_task_templates;

CREATE POLICY "claude_admin_task_templates_admin_access" ON claude_admin_task_templates
  FOR ALL
  USING (
    is_admin_user() OR tenant_id = get_current_tenant_id()
  );

-- ============================================================================
-- FIX: claude_usage_logs
-- ============================================================================
DROP POLICY IF EXISTS "claude_usage_logs_tenant" ON claude_usage_logs;
DROP POLICY IF EXISTS "claude_usage_logs_admin_access" ON claude_usage_logs;

CREATE POLICY "claude_usage_logs_admin_access" ON claude_usage_logs
  FOR ALL
  USING (
    is_admin_user() OR user_id = auth.uid() OR tenant_id = get_current_tenant_id()
  );

-- ============================================================================
-- FIX: shift_handoff_risk_scores
-- ============================================================================
DROP POLICY IF EXISTS "shift_handoff_risk_scores_tenant" ON shift_handoff_risk_scores;

-- Fix the SELECT policy - it was using profiles.id instead of profiles.user_id
DROP POLICY IF EXISTS "Nurses and admins can view handoff scores" ON shift_handoff_risk_scores;
CREATE POLICY "Nurses and admins can view handoff scores" ON shift_handoff_risk_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse', 'care_manager')
    )
  );

-- Fix the UPDATE policy
DROP POLICY IF EXISTS "Nurses can update handoff scores" ON shift_handoff_risk_scores;
CREATE POLICY "Nurses can update handoff scores" ON shift_handoff_risk_scores
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse')
    )
  );

-- Add tenant policy that allows admin bypass
DROP POLICY IF EXISTS "shift_handoff_risk_scores_admin_access" ON shift_handoff_risk_scores;
CREATE POLICY "shift_handoff_risk_scores_admin_access" ON shift_handoff_risk_scores
  FOR ALL
  USING (
    is_admin_user() OR tenant_id = get_current_tenant_id()
  );

-- ============================================================================
-- FIX: check_ins - Add admin access policy
-- ============================================================================
DROP POLICY IF EXISTS "check_ins_admin_access" ON check_ins;

CREATE POLICY "check_ins_admin_access" ON check_ins
  FOR SELECT
  USING (
    is_admin_user()
  );

-- ============================================================================
-- FIX: telehealth_appointments - Add admin access policy
-- ============================================================================
DROP POLICY IF EXISTS "telehealth_appointments_admin_access" ON telehealth_appointments;

CREATE POLICY "telehealth_appointments_admin_access" ON telehealth_appointments
  FOR ALL
  USING (
    is_admin_user()
  );

-- ============================================================================
-- FIX: profiles - Ensure admins can read all profiles
-- ============================================================================
DROP POLICY IF EXISTS "profiles_admin_read" ON profiles;

CREATE POLICY "profiles_admin_read" ON profiles
  FOR SELECT
  USING (
    user_id = auth.uid() OR is_admin_user()
  );

-- ============================================================================
-- FIX: user_workflow_preferences - policies look correct but add admin access
-- ============================================================================
DROP POLICY IF EXISTS "user_workflow_preferences_admin_access" ON user_workflow_preferences;

CREATE POLICY "user_workflow_preferences_admin_access" ON user_workflow_preferences
  FOR ALL
  USING (
    user_id = auth.uid() OR is_admin_user()
  );

-- ============================================================================
-- Grant execute on helper function
-- ============================================================================
GRANT EXECUTE ON FUNCTION is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_user() TO anon;

COMMENT ON FUNCTION is_admin_user() IS 'Check if current authenticated user is super_admin or admin';
