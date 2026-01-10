-- ============================================================================
-- COMPREHENSIVE FIX: RLS Policies for Admin Dashboard Tables
-- ============================================================================
-- Purpose: Fix 403 errors on audit_logs, user_sessions, wearable_device_registry
-- Date: 2026-01-10
-- Issue: Admin dashboards getting 403 when trying to SELECT/INSERT
-- Root cause: Previous policies too restrictive for admin access
-- ============================================================================

-- ============================================================================
-- 1. FIX AUDIT_LOGS - Allow admins to SELECT all logs
-- ============================================================================
-- Current policy only allows SELECT where actor_user_id = auth.uid()
-- Admins need to see ALL audit logs for compliance dashboards

-- Drop restrictive SELECT policy
DROP POLICY IF EXISTS "authenticated_select_own_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_select" ON audit_logs;

-- Create admin-friendly SELECT policy
-- Users can see their own logs, admins can see all
CREATE POLICY "audit_logs_select_policy"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    actor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON POLICY "audit_logs_select_policy" ON audit_logs IS
  'Users can view own audit logs; admins can view all logs';

-- ============================================================================
-- 2. FIX USER_SESSIONS - Enable RLS and add policies
-- ============================================================================

-- Enable RLS if not already
ALTER TABLE IF EXISTS user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "user_sessions_select" ON user_sessions;
DROP POLICY IF EXISTS "user_sessions_insert" ON user_sessions;
DROP POLICY IF EXISTS "user_sessions_update" ON user_sessions;
DROP POLICY IF EXISTS "user_sessions_delete" ON user_sessions;
DROP POLICY IF EXISTS "user_sessions_service" ON user_sessions;
DROP POLICY IF EXISTS "user_sessions_admin_select" ON user_sessions;

-- INSERT: Any authenticated user can create their session
CREATE POLICY "user_sessions_insert"
  ON user_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- SELECT: Users see own sessions, admins see all
CREATE POLICY "user_sessions_select"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- UPDATE: Users can update own sessions (session_end)
CREATE POLICY "user_sessions_update"
  ON user_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- DELETE: Users can delete own sessions
CREATE POLICY "user_sessions_delete"
  ON user_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Service role full access
CREATE POLICY "user_sessions_service"
  ON user_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "user_sessions_select" ON user_sessions IS
  'Users can view own sessions; admins can view all sessions';

-- ============================================================================
-- 3. FIX WEARABLE_DEVICE_REGISTRY - Enable RLS and add policies
-- ============================================================================
-- Note: This table may not exist in all environments - wrapped in DO block

DO $$
BEGIN
  -- Check if table exists before modifying
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wearable_device_registry') THEN
    -- Enable RLS if not already
    ALTER TABLE wearable_device_registry ENABLE ROW LEVEL SECURITY;

    -- Drop any existing policies
    DROP POLICY IF EXISTS "wearable_device_registry_select" ON wearable_device_registry;
    DROP POLICY IF EXISTS "wearable_device_registry_insert" ON wearable_device_registry;
    DROP POLICY IF EXISTS "wearable_device_registry_update" ON wearable_device_registry;
    DROP POLICY IF EXISTS "wearable_device_registry_delete" ON wearable_device_registry;
    DROP POLICY IF EXISTS "wearable_device_registry_service" ON wearable_device_registry;
    DROP POLICY IF EXISTS "wearable_device_registry_admin" ON wearable_device_registry;

    -- SELECT: All authenticated users can read the registry (needed for device type lookup)
    CREATE POLICY "wearable_device_registry_select"
      ON wearable_device_registry
      FOR SELECT
      TO authenticated
      USING (true);

    -- INSERT: Only admins can add new device types
    CREATE POLICY "wearable_device_registry_insert"
      ON wearable_device_registry
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN ('admin', 'super_admin')
        )
      );

    -- UPDATE: Only admins can update device registry
    CREATE POLICY "wearable_device_registry_update"
      ON wearable_device_registry
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

    -- DELETE: Only admins can delete from registry
    CREATE POLICY "wearable_device_registry_delete"
      ON wearable_device_registry
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.user_id = auth.uid()
          AND profiles.role IN ('admin', 'super_admin')
        )
      );

    -- Service role full access
    CREATE POLICY "wearable_device_registry_service"
      ON wearable_device_registry
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    RAISE NOTICE 'Created RLS policies for wearable_device_registry';
  ELSE
    RAISE NOTICE 'wearable_device_registry table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  audit_count integer;
  sessions_count integer;
  registry_count integer;
BEGIN
  SELECT COUNT(*) INTO audit_count FROM pg_policies WHERE tablename = 'audit_logs';
  SELECT COUNT(*) INTO sessions_count FROM pg_policies WHERE tablename = 'user_sessions';
  SELECT COUNT(*) INTO registry_count FROM pg_policies WHERE tablename = 'wearable_device_registry';

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'RLS Policy Update Complete!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'audit_logs policies: %', audit_count;
  RAISE NOTICE 'user_sessions policies: %', sessions_count;
  RAISE NOTICE 'wearable_device_registry policies: %', registry_count;
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Expected behavior:';
  RAISE NOTICE '- Admins can SELECT all audit logs';
  RAISE NOTICE '- Users can SELECT own audit logs';
  RAISE NOTICE '- Users can INSERT/UPDATE/SELECT own sessions';
  RAISE NOTICE '- All authenticated users can SELECT device registry';
  RAISE NOTICE '- 403 errors on admin dashboards should be FIXED';
  RAISE NOTICE '=================================================================';
END $$;
