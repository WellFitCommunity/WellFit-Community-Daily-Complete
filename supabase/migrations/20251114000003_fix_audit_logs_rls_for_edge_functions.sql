/**
 * Fix Audit Logs RLS Policies for Edge Functions
 *
 * Problem: Edge Functions (running as service role) are getting 403 errors
 * when trying to insert audit logs from verify-admin-pin and other functions.
 *
 * Solution: Add policy to allow service role (anon key with elevated permissions)
 * to insert audit logs without authentication constraints.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- Drop ALL existing policies on audit_logs to start fresh
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'audit_logs'
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON audit_logs', pol.policyname);
  END LOOP;
END $$;

-- Enable RLS (if not already enabled)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow service role to INSERT audit logs (for Edge Functions)
-- Service role bypasses RLS by default, but we make it explicit
CREATE POLICY "audit_logs_service_role_insert"
  ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy 2: Allow authenticated users to INSERT their own audit logs
-- This is for client-side audit logging (e.g., frontend actions)
CREATE POLICY "audit_logs_authenticated_insert"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
  );

-- Policy 3: Allow anon role to INSERT audit logs (for unauthenticated events)
-- Example: Failed login attempts, registration attempts
CREATE POLICY "audit_logs_anon_insert"
  ON audit_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy 4: Admins can SELECT audit logs for their tenant
CREATE POLICY "audit_logs_admin_select"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM profiles
      WHERE user_id = auth.uid()
        AND (is_admin = true OR role IN ('admin', 'super_admin'))
    )
  );

-- Policy 5: Super admins can SELECT all audit logs (Master Panel)
CREATE POLICY "audit_logs_super_admin_select_all"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id
      FROM super_admin_users
      WHERE is_active = true
    )
  );

-- Policy 6: Users can SELECT their own audit logs
CREATE POLICY "audit_logs_user_select_own"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    actor_user_id = auth.uid()
  );

COMMENT ON TABLE audit_logs IS 'HIPAA-compliant audit trail with service role insert permissions for Edge Functions';
