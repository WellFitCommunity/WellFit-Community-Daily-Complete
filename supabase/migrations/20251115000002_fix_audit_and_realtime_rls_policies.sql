-- ============================================================================
-- Fix RLS Policies for audit_logs and realtime_subscription_registry
-- ============================================================================
-- Purpose: Allow authenticated users to INSERT into audit_logs and
--          realtime_subscription_registry to prevent 403 errors
-- ============================================================================

-- ============================================================================
-- 1. FIX AUDIT_LOGS RLS POLICIES
-- ============================================================================

-- Drop old incorrect policies that reference profiles.id instead of profiles.user_id
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;

-- Recreate admin SELECT policy with correct column name
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse', 'physician', 'doctor')
    )
  );

-- Allow ALL authenticated users to INSERT audit logs (app-level logging)
-- This prevents 403 errors when the app tries to log events
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role can manage audit logs"
  ON audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Authenticated users can insert audit logs" ON audit_logs IS
  'Allows all authenticated users to log events. RLS prevents modification/deletion.';

-- ============================================================================
-- 2. FIX REALTIME_SUBSCRIPTION_REGISTRY RLS POLICIES
-- ============================================================================

-- Allow authenticated users to INSERT their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
  ON realtime_subscription_registry
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Allow users to UPDATE their own subscriptions (heartbeat)
CREATE POLICY "Users can update own subscriptions"
  ON realtime_subscription_registry
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Allow users to DELETE their own subscriptions (cleanup)
CREATE POLICY "Users can delete own subscriptions"
  ON realtime_subscription_registry
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

COMMENT ON POLICY "Users can insert own subscriptions" ON realtime_subscription_registry IS
  'Allows users to register their realtime subscriptions for monitoring and cleanup.';

-- ============================================================================
-- 3. FIX SECURITY_EVENTS RLS POLICIES (same issue as audit_logs)
-- ============================================================================

-- Drop old incorrect policy
DROP POLICY IF EXISTS "Admins can view security events" ON security_events;

-- Recreate with correct column name
CREATE POLICY "Admins can view security events"
  ON security_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 4. FIX PHI_ACCESS_LOG RLS POLICIES (same issue)
-- ============================================================================

-- Drop old incorrect policy
DROP POLICY IF EXISTS "Admins can view PHI access logs" ON phi_access_log;

-- Recreate with correct column name
CREATE POLICY "Admins can view PHI access logs"
  ON phi_access_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 5. FIX CLAUDE_API_AUDIT RLS POLICIES (same issue)
-- ============================================================================

-- Drop old incorrect policies
DROP POLICY IF EXISTS "Admins can view all Claude usage" ON claude_api_audit;

-- Recreate with correct column name
CREATE POLICY "Admins can view all Claude usage"
  ON claude_api_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show all policies on audit_logs
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'audit_logs'
-- ORDER BY policyname;

-- Show all policies on realtime_subscription_registry
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'realtime_subscription_registry'
-- ORDER BY policyname;
