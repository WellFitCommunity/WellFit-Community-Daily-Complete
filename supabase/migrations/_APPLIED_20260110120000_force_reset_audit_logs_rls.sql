-- ============================================================================
-- FORCE RESET: audit_logs RLS Policies
-- ============================================================================
-- Purpose: Clear ALL existing policies and create simple, working policies
-- Date: 2026-01-10
-- Issue: Multiple conflicting migrations have left audit_logs in broken state
-- Result: 403 errors on both SELECT and INSERT operations
-- ============================================================================

-- ============================================================================
-- 1. ENABLE RLS (if not already)
-- ============================================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. DROP ALL EXISTING POLICIES (nuclear option)
-- ============================================================================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'audit_logs' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON audit_logs', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- ============================================================================
-- 3. CREATE FRESH, SIMPLE POLICIES
-- ============================================================================

-- INSERT: Any authenticated user can create audit logs
-- This is required for the auditLogger service to work
CREATE POLICY "audit_logs_authenticated_insert"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: Users can see their own logs, admins can see all
CREATE POLICY "audit_logs_authenticated_select"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own logs
    actor_user_id = auth.uid()
    -- OR user is admin/super_admin (check profiles table)
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- Service role (Edge Functions) has full access
CREATE POLICY "audit_logs_service_role"
  ON audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon can INSERT for pre-auth logging (registration, login attempts)
CREATE POLICY "audit_logs_anon_insert"
  ON audit_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================================================
-- 4. GRANT PERMISSIONS (belt and suspenders)
-- ============================================================================
GRANT INSERT, SELECT ON audit_logs TO authenticated;
GRANT INSERT ON audit_logs TO anon;
GRANT ALL ON audit_logs TO service_role;

-- ============================================================================
-- 5. VERIFY
-- ============================================================================
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'audit_logs' AND schemaname = 'public';

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'audit_logs RLS Reset Complete!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total policies created: %', policy_count;
  RAISE NOTICE 'Expected: 4 (authenticated_insert, authenticated_select, service_role, anon_insert)';
  RAISE NOTICE '=================================================================';
END $$;
