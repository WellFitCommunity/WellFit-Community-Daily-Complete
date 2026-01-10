-- ============================================================================
-- SIMPLE RLS FIX: No subqueries to RLS-protected tables
-- ============================================================================
-- Problem: Previous policies used subqueries to `profiles` table which has RLS,
--          causing the policy check itself to fail (RLS recursion)
-- Solution: Use simple policies that don't depend on other RLS-protected tables
-- ============================================================================

-- ============================================================================
-- 1. FIX audit_logs - Simple policies without profile lookups
-- ============================================================================
DO $$
DECLARE
  pol record;
BEGIN
  -- Drop all existing policies
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'audit_logs' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON audit_logs', pol.policyname);
  END LOOP;
END $$;

-- Simple INSERT: Any authenticated user can insert
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Simple SELECT: Any authenticated user can read (audit logs aren't PHI)
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (true);

-- Service role full access
CREATE POLICY "audit_logs_service" ON audit_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Anon INSERT for pre-auth events
CREATE POLICY "audit_logs_anon_insert" ON audit_logs
  FOR INSERT TO anon
  WITH CHECK (true);

-- ============================================================================
-- 2. FIX realtime_subscription_registry - Same approach
-- ============================================================================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'realtime_subscription_registry' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON realtime_subscription_registry', pol.policyname);
  END LOOP;
END $$;

-- Simple policies - users manage their own, but can see all for reconnection logic
CREATE POLICY "rsr_insert" ON realtime_subscription_registry
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "rsr_select" ON realtime_subscription_registry
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rsr_update" ON realtime_subscription_registry
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "rsr_delete" ON realtime_subscription_registry
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "rsr_service" ON realtime_subscription_registry
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. GRANT permissions explicitly
-- ============================================================================
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT INSERT ON audit_logs TO anon;
GRANT ALL ON audit_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON realtime_subscription_registry TO authenticated;
GRANT ALL ON realtime_subscription_registry TO service_role;

-- ============================================================================
-- 4. Verify
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Simple RLS fix applied - no subqueries to RLS-protected tables';
END $$;
