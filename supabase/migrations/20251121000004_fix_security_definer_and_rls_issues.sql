-- ============================================================================
-- FIX SECURITY DEFINER AND RLS PERFORMANCE ISSUES
-- Date: 2025-11-21
-- Purpose: Fix search_path, SECURITY DEFINER, and RLS performance issues
-- ============================================================================

-- ============================================================================
-- ISSUE 1: Fix assign_super_admin_to_tenant - Add search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_super_admin_to_tenant(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- ✅ FIX: Prevent SQL injection
AS $$
BEGIN
  -- Insert tenant assignment for super admin
  INSERT INTO public.tenant_assignments (user_id, tenant_id, role)
  VALUES (p_user_id, p_tenant_id, 'super_admin')
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET role = 'super_admin', updated_at = NOW();

  -- Ensure user has super_admin role in user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'super_admin')
  ON CONFLICT (user_id)
  DO UPDATE SET role = 'super_admin';
END;
$$;

-- ============================================================================
-- ISSUE 2: Fix app_patients - Remove SECURITY DEFINER from view
-- ============================================================================
-- SKIPPED: View schema unknown, fix manually in Supabase Dashboard if needed

-- ============================================================================
-- ISSUE 3: Fix account_lockouts - Optimize RLS policy to not re-evaluate auth
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can unlock accounts" ON public.account_lockouts;

-- Create optimized policy that evaluates auth.uid() once
CREATE POLICY "Admins can unlock accounts"
ON public.account_lockouts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid())  -- ✅ FIX: Subquery evaluates once
      AND ur.role IN ('super_admin', 'admin')
  )
);

-- ============================================================================
-- ISSUE 4: Fix claim_denials - Consolidate duplicate SELECT policies
-- ============================================================================
-- SKIPPED: Table schema unknown, fix manually in Supabase Dashboard if needed

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE '✅ Security & Performance Fixes Applied (2 of 4)';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '1. ✅ assign_super_admin_to_tenant: search_path set';
  RAISE NOTICE '2. ⏭️  app_patients: SKIPPED';
  RAISE NOTICE '3. ✅ account_lockouts: RLS policy optimized';
  RAISE NOTICE '4. ⏭️  claim_denials: SKIPPED';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Note: Issues 2 & 4 need manual fixing in Supabase Dashboard';
  RAISE NOTICE '================================================================';
END $$;
