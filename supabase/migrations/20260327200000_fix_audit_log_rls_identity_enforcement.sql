-- ============================================================================
-- A-3: Fix audit_logs and phi_access_logs RLS — enforce identity on INSERT
-- ============================================================================
-- Problem: audit_logs INSERT policy uses WITH CHECK (true), allowing any
-- authenticated user to insert records with arbitrary actor_user_id.
-- Also: anon users can insert into audit_logs (rate-limited but still wrong).
-- This makes the audit trail spoofable — fatal for HIPAA compliance.
--
-- Fix:
-- 1. Replace authenticated INSERT with actor_user_id = auth.uid()
-- 2. Remove anon INSERT entirely (audit logs must have verified identity)
-- 3. Keep service_role full access (edge functions need to log on behalf of system)
-- 4. Fix phi_access_logs INSERT to enforce accessing_user_id = auth.uid()
-- ============================================================================

-- ============================================================================
-- AUDIT_LOGS — Fix INSERT policies
-- ============================================================================

-- Drop the permissive authenticated INSERT
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;

-- Drop anon INSERT (rate-limited or not — anon should never write audit logs)
DROP POLICY IF EXISTS "audit_logs_anon_insert" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_anon_insert_rate_limited" ON audit_logs;
DROP POLICY IF EXISTS "anon_insert_audit_logs" ON audit_logs;

-- Recreate authenticated INSERT with identity enforcement
-- actor_user_id MUST match the authenticated user's ID
CREATE POLICY "audit_logs_authenticated_insert"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
  );

-- Service role retains full access (edge functions acting as system)
-- This policy should already exist, but ensure it's there
DROP POLICY IF EXISTS "audit_logs_service" ON audit_logs;
CREATE POLICY "audit_logs_service_full"
  ON audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Keep existing SELECT policy unchanged (users see own + admin sees all)
-- audit_logs_select_policy already handles this correctly

-- ============================================================================
-- PHI_ACCESS_LOGS — Fix INSERT policy
-- ============================================================================

-- Drop the permissive tenant-only INSERT
DROP POLICY IF EXISTS "phi_access_logs_tenant_insert" ON phi_access_logs;

-- Recreate with identity enforcement: accessing_user_id must be the caller
-- Also check if accessing_user_id column exists (it should per the table schema)
DO $$
BEGIN
  -- Check if accessing_user_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'phi_access_logs'
      AND column_name = 'accessing_user_id'
  ) THEN
    EXECUTE 'CREATE POLICY "phi_access_logs_identity_insert"
      ON phi_access_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = get_current_tenant_id()
        AND accessing_user_id = auth.uid()
      )';
  ELSE
    -- Fallback: if column is named differently, use tenant-only
    -- but log a warning via RAISE NOTICE
    RAISE NOTICE 'phi_access_logs does not have accessing_user_id column — using tenant-only INSERT policy';
    EXECUTE 'CREATE POLICY "phi_access_logs_tenant_insert_v2"
      ON phi_access_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = get_current_tenant_id()
      )';
  END IF;
END $$;

-- Service role for phi_access_logs (edge functions logging PHI access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'phi_access_logs'
      AND policyname = 'phi_access_logs_service_role'
  ) THEN
    EXECUTE 'CREATE POLICY "phi_access_logs_service_role"
      ON phi_access_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- ============================================================================
-- Also fix phi_access_log (singular — legacy table name)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'phi_access_log'
  ) THEN
    -- Drop permissive INSERT if exists
    EXECUTE 'DROP POLICY IF EXISTS "phi_access_log_tenant_insert" ON phi_access_log';
    EXECUTE 'DROP POLICY IF EXISTS "phi_access_log_insert" ON phi_access_log';

    -- Check for identity column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'phi_access_log'
        AND column_name = 'accessing_user_id'
    ) THEN
      EXECUTE 'CREATE POLICY "phi_access_log_identity_insert"
        ON phi_access_log
        FOR INSERT
        TO authenticated
        WITH CHECK (accessing_user_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- COMMENT explaining the security rationale
-- ============================================================================
COMMENT ON POLICY "audit_logs_authenticated_insert" ON audit_logs IS
  'A-3 fix: Authenticated users can only insert audit records where actor_user_id matches their own auth.uid(). '
  'Prevents spoofing the audit trail. Service role is exempt (edge functions log system events).';

COMMENT ON POLICY "audit_logs_service_full" ON audit_logs IS
  'Service role has unrestricted access for edge functions that log system events and batch operations.';
