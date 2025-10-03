-- ==============================================================================
-- Migration: Fix Claims Table RLS Permissions
-- Date: 2025-10-03
-- Author: System Administrator
--
-- PURPOSE:
-- Restore dual-access pattern for claims table that was broken in previous
-- "fix" migration. The original design allowed both:
-- 1. Admins to access ALL claims (read/write)
-- 2. Claim creators to access THEIR OWN claims (read only)
--
-- PROBLEM:
-- The migration 20250930154555_fix_billing_rls.sql dropped the combined policy
-- and replaced it with admin-only access, breaking BillingDashboard.tsx which
-- calls BillingService.searchClaims() expecting to see user's own claims.
--
-- SOLUTION:
-- Restore the dual-access pattern with separate policies:
-- - Admins: Full access to all claims (ALL operations)
-- - Creators: Read access to their own claims (SELECT only)
-- - Creators: Can create new claims for themselves (INSERT only)
--
-- AFFECTED TABLES:
-- - public.claims
--
-- AFFECTED FILES:
-- - src/components/admin/BillingDashboard.tsx:34 (searchClaims call)
-- - src/services/billingService.ts:403-427 (searchClaims method)
--
-- COMPATIBILITY:
-- - Safe to run multiple times (uses DROP POLICY IF EXISTS)
-- - No data migration needed
-- - No breaking changes to existing code
-- ==============================================================================

-- migrate:up
begin;

-- Drop existing policies that caused the permission issue
DROP POLICY IF EXISTS "claims_admin_all" ON public.claims;
DROP POLICY IF EXISTS "claims_user_read_own" ON public.claims;
DROP POLICY IF EXISTS "claims_admin_rw_owner_r" ON public.claims;

-- Create admin policy: Full access to all claims for admins
CREATE POLICY "claims_admin_full_access" ON public.claims
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Create creator policy: Read access to own claims
CREATE POLICY "claims_creator_select_own" ON public.claims
  FOR SELECT
  USING (created_by = auth.uid());

-- Create creator policy: Insert own claims
CREATE POLICY "claims_creator_insert_own" ON public.claims
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Add helpful comment for future developers
COMMENT ON TABLE public.claims IS 'Medical billing claims for insurance submission. RLS: Admins see all, creators see own.';

commit;

-- migrate:down
begin;

-- Restore the broken policy from previous migration (for rollback only)
DROP POLICY IF EXISTS "claims_admin_full_access" ON public.claims;
DROP POLICY IF EXISTS "claims_creator_select_own" ON public.claims;
DROP POLICY IF EXISTS "claims_creator_insert_own" ON public.claims;

CREATE POLICY "claims_admin_all" ON public.claims
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "claims_user_read_own" ON public.claims
  FOR SELECT
  USING (created_by = auth.uid());

commit;
