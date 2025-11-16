-- ============================================================================
-- Add ANON Role Policies for audit_logs and realtime_subscription_registry
-- ============================================================================
-- Purpose: Allow unauthenticated (anon) users to INSERT into these tables
-- Context: Frontend uses anon key before user authentication
-- Date: 2025-11-16
-- ============================================================================

-- ============================================================================
-- 1. ADD ANON POLICIES FOR audit_logs
-- ============================================================================

-- Drop existing anon policies if they exist
DROP POLICY IF EXISTS "anon_insert_audit_logs" ON audit_logs;

-- Allow anonymous users to insert audit logs (for pre-auth events)
CREATE POLICY "anon_insert_audit_logs"
  ON audit_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================================================
-- 2. ADD ANON POLICIES FOR realtime_subscription_registry
-- ============================================================================

-- Drop existing anon policies if they exist
DROP POLICY IF EXISTS "anon_insert_subscriptions" ON realtime_subscription_registry;
DROP POLICY IF EXISTS "anon_update_subscriptions" ON realtime_subscription_registry;
DROP POLICY IF EXISTS "anon_delete_subscriptions" ON realtime_subscription_registry;
DROP POLICY IF EXISTS "anon_select_subscriptions" ON realtime_subscription_registry;

-- Allow anonymous users to insert subscriptions (for pre-auth realtime)
CREATE POLICY "anon_insert_subscriptions"
  ON realtime_subscription_registry
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Allow anonymous users to update subscriptions (heartbeat for pre-auth)
CREATE POLICY "anon_update_subscriptions"
  ON realtime_subscription_registry
  FOR UPDATE
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- Allow anonymous users to delete subscriptions (cleanup for pre-auth)
CREATE POLICY "anon_delete_subscriptions"
  ON realtime_subscription_registry
  FOR DELETE
  TO anon
  USING (user_id IS NULL);

-- Allow anonymous users to select subscriptions (for monitoring)
CREATE POLICY "anon_select_subscriptions"
  ON realtime_subscription_registry
  FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- ============================================================================
-- 3. VERIFY
-- ============================================================================

DO $$
DECLARE
  audit_anon_count integer;
  registry_anon_count integer;
BEGIN
  -- Count anon policies on audit_logs
  SELECT COUNT(*) INTO audit_anon_count
  FROM pg_policies
  WHERE tablename = 'audit_logs' AND 'anon' = ANY(roles::text[]);

  -- Count anon policies on realtime_subscription_registry
  SELECT COUNT(*) INTO registry_anon_count
  FROM pg_policies
  WHERE tablename = 'realtime_subscription_registry' AND 'anon' = ANY(roles::text[]);

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'ANON Role RLS Policies Added!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'audit_logs anon policies: %', audit_anon_count;
  RAISE NOTICE 'realtime_subscription_registry anon policies: %', registry_anon_count;
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Expected behavior:';
  RAISE NOTICE '- Anonymous (unauthenticated) users CAN INSERT audit logs';
  RAISE NOTICE '- Anonymous users CAN manage their own realtime subscriptions';
  RAISE NOTICE '- 403 errors should be FIXED for pre-auth operations';
  RAISE NOTICE '=================================================================';
END $$;
