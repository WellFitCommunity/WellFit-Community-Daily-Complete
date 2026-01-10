-- ============================================================================
-- Fix RLS Policies for Admin Dashboard Tables
-- ============================================================================
-- Purpose: Allow authenticated users to SELECT from performance_metrics and
--          error_logs tables to prevent 401/403 errors in admin dashboards.
--          These tables are NOT multi-tenant (no tenant_id column).
-- ============================================================================

-- ============================================================================
-- 1. FIX PERFORMANCE_METRICS RLS POLICY
-- ============================================================================
-- Note: performance_metrics table does NOT have tenant_id column
-- It uses user_id for user-scoped metrics

-- Drop any existing tenant-based policy that may have been incorrectly applied
DROP POLICY IF EXISTS "performance_metrics_tenant" ON performance_metrics;
DROP POLICY IF EXISTS "performance_metrics_select" ON performance_metrics;
DROP POLICY IF EXISTS "performance_metrics_insert" ON performance_metrics;
DROP POLICY IF EXISTS "performance_metrics_admin_modify" ON performance_metrics;
DROP POLICY IF EXISTS "performance_metrics_admin_delete" ON performance_metrics;
DROP POLICY IF EXISTS "performance_metrics_service" ON performance_metrics;

-- SELECT: Admin users can view all metrics
CREATE POLICY "performance_metrics_admin_select"
  ON performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- INSERT: Any authenticated user can insert metrics (for app-level logging)
CREATE POLICY "performance_metrics_insert"
  ON performance_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role can do everything (for Edge Functions)
CREATE POLICY "performance_metrics_service"
  ON performance_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "performance_metrics_admin_select" ON performance_metrics IS
  'Allows admin users to view all performance metrics';

-- ============================================================================
-- 2. FIX ERROR_LOGS RLS POLICY
-- ============================================================================
-- Note: error_logs table does NOT have tenant_id column
-- It uses user_id for user-scoped errors

DROP POLICY IF EXISTS "error_logs_tenant" ON error_logs;
DROP POLICY IF EXISTS "error_logs_select" ON error_logs;
DROP POLICY IF EXISTS "error_logs_insert" ON error_logs;
DROP POLICY IF EXISTS "error_logs_admin_modify" ON error_logs;
DROP POLICY IF EXISTS "error_logs_admin_delete" ON error_logs;
DROP POLICY IF EXISTS "error_logs_service" ON error_logs;

-- SELECT: Admin users can view all error logs
CREATE POLICY "error_logs_admin_select"
  ON error_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- INSERT: Any authenticated user can insert error logs
CREATE POLICY "error_logs_insert"
  ON error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Admins can update (mark as resolved)
CREATE POLICY "error_logs_admin_update"
  ON error_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Service role can do everything
CREATE POLICY "error_logs_service"
  ON error_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "error_logs_admin_select" ON error_logs IS
  'Allows admin users to view all error logs';

-- ============================================================================
-- 3. ADD REALTIME_SUBSCRIPTION_REGISTRY SELECT POLICY
-- ============================================================================
-- The existing policies only allow INSERT/UPDATE/DELETE but not SELECT
DROP POLICY IF EXISTS "Users can select own subscriptions" ON realtime_subscription_registry;

CREATE POLICY "Users can select own subscriptions"
  ON realtime_subscription_registry
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

COMMENT ON POLICY "Users can select own subscriptions" ON realtime_subscription_registry IS
  'Allows users to view their own realtime subscriptions';

-- ============================================================================
-- VERIFICATION QUERIES (run manually to verify)
-- ============================================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN ('performance_metrics', 'error_logs', 'realtime_subscription_registry')
-- ORDER BY tablename, policyname;
