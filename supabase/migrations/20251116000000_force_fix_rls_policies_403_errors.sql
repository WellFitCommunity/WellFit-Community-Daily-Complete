-- ============================================================================
-- FORCE FIX: RLS Policies for audit_logs and realtime_subscription_registry
-- ============================================================================
-- Purpose: Fix 403 Forbidden errors by ensuring proper RLS policies exist
-- Date: 2025-11-16
-- Issue: Frontend getting 403 errors when trying to INSERT into these tables
-- ============================================================================

-- ============================================================================
-- 1. ENABLE RLS (if not already enabled)
-- ============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_subscription_registry ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. DROP ALL EXISTING POLICIES (clean slate)
-- ============================================================================

DO $$
DECLARE
  pol record;
BEGIN
  -- Drop all policies on audit_logs
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'audit_logs'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON audit_logs';
  END LOOP;

  -- Drop all policies on realtime_subscription_registry
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'realtime_subscription_registry'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON realtime_subscription_registry';
  END LOOP;

  RAISE NOTICE 'Dropped all existing policies on audit_logs and realtime_subscription_registry';
END $$;

-- ============================================================================
-- 3. CREATE FRESH POLICIES FOR audit_logs
-- ============================================================================

-- Allow ALL authenticated users to INSERT audit logs (no restrictions)
CREATE POLICY "authenticated_insert_audit_logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to SELECT their own audit logs
CREATE POLICY "authenticated_select_own_audit_logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (actor_user_id = auth.uid());

-- Service role has full access (for Edge Functions)
CREATE POLICY "service_role_all_audit_logs"
  ON audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. CREATE FRESH POLICIES FOR realtime_subscription_registry
-- ============================================================================

-- Allow authenticated users to INSERT their own subscriptions
CREATE POLICY "authenticated_insert_subscriptions"
  ON realtime_subscription_registry
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Allow authenticated users to UPDATE their own subscriptions (heartbeat)
CREATE POLICY "authenticated_update_subscriptions"
  ON realtime_subscription_registry
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Allow authenticated users to DELETE their own subscriptions (cleanup)
CREATE POLICY "authenticated_delete_subscriptions"
  ON realtime_subscription_registry
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Allow authenticated users to SELECT their own subscriptions
CREATE POLICY "authenticated_select_subscriptions"
  ON realtime_subscription_registry
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Service role has full access (for Edge Functions)
CREATE POLICY "service_role_all_subscriptions"
  ON realtime_subscription_registry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5. VERIFY SUCCESS
-- ============================================================================

DO $$
DECLARE
  audit_policy_count integer;
  registry_policy_count integer;
BEGIN
  -- Count policies on audit_logs
  SELECT COUNT(*) INTO audit_policy_count
  FROM pg_policies
  WHERE tablename = 'audit_logs';

  -- Count policies on realtime_subscription_registry
  SELECT COUNT(*) INTO registry_policy_count
  FROM pg_policies
  WHERE tablename = 'realtime_subscription_registry';

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'RLS Policy Setup Complete!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'audit_logs policies: %', audit_policy_count;
  RAISE NOTICE 'realtime_subscription_registry policies: %', registry_policy_count;
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Expected behavior:';
  RAISE NOTICE '- Authenticated users CAN INSERT into both tables';
  RAISE NOTICE '- Users can only SELECT their own data';
  RAISE NOTICE '- Service role (Edge Functions) has full access';
  RAISE NOTICE '- 403 errors should be FIXED';
  RAISE NOTICE '=================================================================';
END $$;
