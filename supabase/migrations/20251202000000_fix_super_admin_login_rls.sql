-- ============================================================================
-- Fix Super Admin Login RLS Policy
-- Date: 2025-12-02
-- Purpose: Allow users to check their own super_admin_users record during login
-- Issue: Current policy requires being a super admin to read super_admin_users,
--        but we need to read it to verify if someone IS a super admin
-- ============================================================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS super_admin_full_access_super_admin_users ON super_admin_users;

-- Policy 1: Users can read their OWN record (needed for login verification)
CREATE POLICY super_admin_users_read_own
  ON super_admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Active super admins can read ALL records (for admin panel)
CREATE POLICY super_admin_users_read_all
  ON super_admin_users
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admin_users WHERE is_active = true
    )
  );

-- Policy 3: Active super admins can insert/update/delete
CREATE POLICY super_admin_users_write
  ON super_admin_users
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admin_users WHERE is_active = true
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM super_admin_users WHERE is_active = true
    )
  );

-- Verify policies
DO $$
BEGIN
  RAISE NOTICE 'Super admin login RLS policies updated successfully';
END $$;
