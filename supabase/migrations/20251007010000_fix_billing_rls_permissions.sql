-- ==============================================================================
-- Fix Billing System RLS Permissions
-- Date: 2025-10-07
-- Issue: 403 Forbidden errors on billing_providers, claims tables
--
-- Root Cause:
-- RLS policies are either missing, misconfigured, or the is_admin function
-- is not working correctly for the current user session.
--
-- Solution:
-- 1. Ensure RLS is enabled on all billing tables
-- 2. Drop and recreate all policies with correct logic
-- 3. Add fallback policies for anon/authenticated access where appropriate
-- 4. Grant proper table permissions to roles
-- ==============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Ensure is_admin function exists and is correct
-- ============================================================================

-- Drop existing versions
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

-- Create is_admin() - checks current user
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user's role from profiles table
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = auth.uid();

  -- Check if user is admin or super_admin
  RETURN user_role IN ('admin', 'super_admin');
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Create is_admin(uuid) - checks specific user
CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = p_uid;

  RETURN user_role IN ('admin', 'super_admin');
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Grant execute to all roles
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.is_admin() IS 'Returns true if current user is admin or super_admin';
COMMENT ON FUNCTION public.is_admin(uuid) IS 'Returns true if specified user is admin or super_admin';

-- ============================================================================
-- PART 2: Fix billing_providers table
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE public.billing_providers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "billing_providers_admin_all" ON public.billing_providers;
DROP POLICY IF EXISTS "billing_providers_read_all" ON public.billing_providers;
DROP POLICY IF EXISTS "billing_providers_select_all" ON public.billing_providers;
DROP POLICY IF EXISTS "billing_providers_admin_full" ON public.billing_providers;

-- Allow authenticated users to READ all providers (needed for dropdowns)
CREATE POLICY "billing_providers_authenticated_select"
ON public.billing_providers
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage providers
CREATE POLICY "billing_providers_admin_manage"
ON public.billing_providers
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Grant table permissions
GRANT SELECT ON public.billing_providers TO authenticated;
GRANT ALL ON public.billing_providers TO service_role;

COMMENT ON TABLE public.billing_providers IS 'Insurance providers and payers. RLS: All users can read, admins can manage.';

-- ============================================================================
-- PART 3: Fix claims table
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "claims_admin_all" ON public.claims;
DROP POLICY IF EXISTS "claims_user_read_own" ON public.claims;
DROP POLICY IF EXISTS "claims_admin_rw_owner_r" ON public.claims;
DROP POLICY IF EXISTS "claims_admin_full_access" ON public.claims;
DROP POLICY IF EXISTS "claims_creator_select_own" ON public.claims;
DROP POLICY IF EXISTS "claims_creator_insert_own" ON public.claims;
DROP POLICY IF EXISTS "claims_admin_manage" ON public.claims;
DROP POLICY IF EXISTS "claims_creator_read" ON public.claims;

-- Allow admins to see and manage ALL claims
CREATE POLICY "claims_admin_full"
ON public.claims
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Allow claim creators to READ their own claims
CREATE POLICY "claims_creator_select"
ON public.claims
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Allow authenticated users to INSERT claims for themselves
CREATE POLICY "claims_creator_insert"
ON public.claims
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Grant table permissions
GRANT SELECT, INSERT ON public.claims TO authenticated;
GRANT ALL ON public.claims TO service_role;

COMMENT ON TABLE public.claims IS 'Medical billing claims. RLS: Admins see all, creators see own.';

-- ============================================================================
-- PART 4: Fix other billing tables if they exist
-- ============================================================================

-- billing_encounters
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_encounters') THEN
    ALTER TABLE public.billing_encounters ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "billing_encounters_admin_all" ON public.billing_encounters;

    CREATE POLICY "billing_encounters_admin_full"
    ON public.billing_encounters
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

    GRANT SELECT ON public.billing_encounters TO authenticated;
    GRANT ALL ON public.billing_encounters TO service_role;
  END IF;
END $$;

-- billing_line_items
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_line_items') THEN
    ALTER TABLE public.billing_line_items ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "billing_line_items_admin_all" ON public.billing_line_items;

    CREATE POLICY "billing_line_items_admin_full"
    ON public.billing_line_items
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

    GRANT SELECT ON public.billing_line_items TO authenticated;
    GRANT ALL ON public.billing_line_items TO service_role;
  END IF;
END $$;

-- claim_line_items
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claim_line_items') THEN
    ALTER TABLE public.claim_line_items ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "claim_line_items_admin_all" ON public.claim_line_items;

    CREATE POLICY "claim_line_items_admin_full"
    ON public.claim_line_items
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

    GRANT SELECT ON public.claim_line_items TO authenticated;
    GRANT ALL ON public.claim_line_items TO service_role;
  END IF;
END $$;

-- ============================================================================
-- PART 5: Verification queries (will output results in migration logs)
-- ============================================================================

-- Show all policies on billing tables
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== Billing Table RLS Policies ===';
  FOR rec IN
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE tablename IN ('billing_providers', 'claims', 'billing_encounters', 'billing_line_items', 'claim_line_items')
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE 'Table: %, Policy: %, Command: %', rec.tablename, rec.policyname, rec.cmd;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- TESTING NOTES
-- ============================================================================
-- After applying this migration:
--
-- 1. Test as admin user:
--    SELECT * FROM billing_providers; -- Should work
--    SELECT * FROM claims;            -- Should work
--
-- 2. Test as non-admin user:
--    SELECT * FROM billing_providers; -- Should work (read-only)
--    SELECT * FROM claims WHERE created_by = auth.uid(); -- Should work
--
-- 3. If still getting 403:
--    - Check user's role in profiles table: SELECT role FROM profiles WHERE user_id = auth.uid();
--    - Check if is_admin() returns true: SELECT public.is_admin();
--    - Check RLS is enabled: SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'billing%' OR tablename = 'claims';
-- ============================================================================
