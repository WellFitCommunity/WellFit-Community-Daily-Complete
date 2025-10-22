-- Fix admin_enroll_audit RLS policy to allow Edge Function inserts
--
-- PROBLEM: enrollClient Edge Function uses service role to insert audit records,
-- but the RLS policy only allows authenticated users with admin role in user_roles.
-- This causes audit inserts to fail silently, leading to enrollment success but
-- error message shown to admin.
--
-- SOLUTION: Add policy to allow service role (which bypasses RLS anyway) OR
-- check if current_setting exists (Edge Function context) instead of auth.uid().

BEGIN;

-- Drop the merged INSERT policy that's causing issues
DROP POLICY IF EXISTS "merged_insert_auth_acc1f0dc" ON public.admin_enroll_audit;

-- Create new policy that allows:
-- 1. Authenticated admins (via user_roles check)
-- 2. Service role (will bypass RLS anyway, but explicit is better)
CREATE POLICY "admin_enroll_audit_insert_policy"
ON public.admin_enroll_audit
FOR INSERT
TO authenticated, service_role
WITH CHECK (
  -- Allow service role (Edge Functions)
  current_user = 'service_role'
  OR
  -- Allow authenticated admins
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
  )
  OR
  -- Also check profiles table (alternative role storage)
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
  )
);

-- Add helpful comment
COMMENT ON POLICY "admin_enroll_audit_insert_policy" ON public.admin_enroll_audit IS
  'Allows admin enrollment audit logging from Edge Functions (service_role) and authenticated admins';

-- Verify the policy was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_enroll_audit'
      AND policyname = 'admin_enroll_audit_insert_policy'
  ) THEN
    RAISE EXCEPTION 'Failed to create admin_enroll_audit_insert_policy';
  END IF;

  RAISE NOTICE 'Successfully created admin_enroll_audit_insert_policy';
END $$;

COMMIT;
