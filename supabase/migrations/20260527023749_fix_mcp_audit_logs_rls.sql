-- ============================================================================
-- Fix mcp_audit_logs RLS (M-4)
-- ============================================================================
--
-- Two gaps in the existing SELECT policy on mcp_audit_logs:
--
-- 1. The policy "Admins can read mcp_audit_logs" checks user_roles.role (text
--    column) directly:
--      EXISTS (SELECT 1 FROM user_roles
--              WHERE user_id = auth.uid()
--                AND role IN ('admin','super_admin'))
--    But user_roles.role is mostly NULL in production (3 of 42 rows are set).
--    The canonical role-lookup pattern everywhere else in the codebase is
--    profiles.user_id -> profiles.role_id -> roles.id, with the role NAME on
--    the roles table. The current policy excludes almost every admin.
--
-- 2. The policy lacks tenant scoping. Admin in tenant A can read mcp_audit_logs
--    rows for tenant B. Per .claude/rules/governance-boundaries.md (Shared
--    Spine S4), all audit/PHI access logs should be tenant-scoped (super_admin
--    is the only legitimate cross-tenant reader).
--
-- Note on mcp_key_audit_log: already uses the canonical profiles->roles
-- pattern (super_admin only), no fix needed there.
--
-- This migration:
--   - DROPs the broken admin policy
--   - Creates a tenant-scoped admin policy using the canonical profiles->roles join
--   - Creates a separate super_admin cross-tenant policy
--   - INSERT and ALL service-role policies remain untouched
--
-- After this migration, the SELECT access matrix is:
--
-- | Caller                          | Can SELECT rows where ...                |
-- |---------------------------------|------------------------------------------|
-- | service_role                    | (any row — bypasses RLS)                 |
-- | super_admin (any tenant)        | (any row)                                |
-- | admin / care_manager /          | tenant_id = caller's profiles.tenant_id  |
-- |   department_head / it_admin    |                                          |
-- | everyone else                   | (no rows)                                |
--
-- ============================================================================

BEGIN;

-- 1. Drop the broken admin policy (relies on mostly-empty user_roles.role text)
DROP POLICY IF EXISTS "Admins can read mcp_audit_logs"
  ON public.mcp_audit_logs;

-- 2. Tenant-scoped admin SELECT — uses the canonical profiles -> roles join.
--    Matches the pattern from mcp_key_audit_log's super_admin policy and from
--    the SH-1 RPC, both already canonical in this codebase.
--    Note: mcp_audit_logs.tenant_id is TEXT (not UUID) — see column inventory;
--    profiles.tenant_id is UUID. Cast both sides to text for the comparison.
CREATE POLICY "mcp_audit_logs_tenant_admin_select"
  ON public.mcp_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = auth.uid()
        AND r.name IN ('admin', 'care_manager', 'department_head', 'it_admin')
        AND mcp_audit_logs.tenant_id IS NOT NULL
        AND p.tenant_id::text = mcp_audit_logs.tenant_id
    )
  );

-- 3. Super-admin cross-tenant SELECT (platform-level visibility — by design).
CREATE POLICY "mcp_audit_logs_super_admin_select"
  ON public.mcp_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = auth.uid()
        AND r.name = 'super_admin'
    )
  );

COMMIT;

-- ============================================================================
-- Post-migration verification (against remote via Supabase MCP):
--
--   SELECT policyname, cmd, roles, qual
--   FROM pg_policies
--   WHERE tablename = 'mcp_audit_logs'
--   ORDER BY policyname;
--
-- Expected:
--   - mcp_audit_logs_super_admin_select (SELECT, authenticated)
--   - mcp_audit_logs_tenant_admin_select (SELECT, authenticated)
--   - Service role full access on mcp_audit_logs (ALL, service_role)
-- ============================================================================
