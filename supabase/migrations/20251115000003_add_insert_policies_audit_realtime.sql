-- ============================================================================
-- Add INSERT Policies to Existing audit_logs and realtime_subscription_registry
-- ============================================================================
-- Purpose: Fix 403 errors by allowing authenticated users to INSERT into these tables
-- Note: This migration assumes tables already exist and just adds missing policies
-- ============================================================================

-- ============================================================================
-- 1. ADD INSERT POLICY TO audit_logs (if table exists)
-- ============================================================================

DO $$
BEGIN
  -- Check if audit_logs table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN

    -- Drop conflicting policies if they exist
    DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;
    DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;
    DROP POLICY IF EXISTS "Service role can manage audit logs" ON audit_logs;

    -- Add INSERT policy for all authenticated users
    EXECUTE 'CREATE POLICY "Authenticated users can insert audit logs"
      ON audit_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (true)';

    -- Add service role policy
    EXECUTE 'CREATE POLICY "Service role can manage audit logs"
      ON audit_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';

    RAISE NOTICE 'Added INSERT policies to audit_logs table';
  ELSE
    RAISE NOTICE 'audit_logs table does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- 2. ADD POLICIES TO realtime_subscription_registry (if table exists)
-- ============================================================================

DO $$
BEGIN
  -- Check if realtime_subscription_registry table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'realtime_subscription_registry') THEN

    -- Drop conflicting policies if they exist
    DROP POLICY IF EXISTS "Users can insert own subscriptions" ON realtime_subscription_registry;
    DROP POLICY IF EXISTS "Users can update own subscriptions" ON realtime_subscription_registry;
    DROP POLICY IF EXISTS "Users can delete own subscriptions" ON realtime_subscription_registry;

    -- Add INSERT policy
    EXECUTE 'CREATE POLICY "Users can insert own subscriptions"
      ON realtime_subscription_registry
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid() OR user_id IS NULL)';

    -- Add UPDATE policy (for heartbeat)
    EXECUTE 'CREATE POLICY "Users can update own subscriptions"
      ON realtime_subscription_registry
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid() OR user_id IS NULL)
      WITH CHECK (user_id = auth.uid() OR user_id IS NULL)';

    -- Add DELETE policy (for cleanup)
    EXECUTE 'CREATE POLICY "Users can delete own subscriptions"
      ON realtime_subscription_registry
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid() OR user_id IS NULL)';

    RAISE NOTICE 'Added policies to realtime_subscription_registry table';
  ELSE
    RAISE NOTICE 'realtime_subscription_registry table does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- 3. SUCCESS
-- ============================================================================

-- Policies have been added successfully
-- You can verify by running:
-- SELECT tablename, policyname, cmd, roles FROM pg_policies
-- WHERE tablename IN ('audit_logs', 'realtime_subscription_registry');
