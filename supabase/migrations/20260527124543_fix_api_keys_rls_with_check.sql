-- _APPLIED_20260527124543_fix_api_keys_rls_with_check.sql
--
-- API-3a — Self-Audit Session 6 wave 2 (2026-05-27)
--
-- Applied to live DB via Supabase MCP `apply_migration` on 2026-05-27
-- (version 20260527124543 in supabase_migrations.schema_migrations).
-- The `_APPLIED_` prefix causes `supabase db push` to skip this file.
--
-- Closes the cross-tenant write gap on public.api_keys.
--
-- BEFORE this migration: policy `api_keys_tenant` had a USING clause but no
-- WITH CHECK clause. A tenant-admin in tenant A could INSERT or UPDATE a row
-- with `tenant_id = tenant B`, because the missing WITH CHECK defaulted to
-- permissive. The table is currently empty (0 rows in production) so no data
-- has been corrupted, but this MUST be closed before the first external
-- partner onboards via the api_keys channel (per API-3 plan in
-- docs/trackers/claude-self-audit-2026-05-20-tracker.md).
--
-- AFTER this migration: WITH CHECK matches USING. The same predicate is
-- enforced on both read and write. Cross-tenant INSERT / UPDATE rejected by
-- RLS.
--
-- Verified live state pre-migration via Supabase MCP execute_sql:
--   policyname  = api_keys_tenant
--   cmd         = ALL
--   qual        = (tenant_id = get_current_tenant_id() AND is_tenant_admin())
--   with_check  = NULL          <-- the gap being closed
--   roles       = {public}
--
-- Per .claude/rules/supabase.md §2: USING controls reads; WITH CHECK controls
-- writes; both required when admin write capability exists on a tenant-scoped
-- table.

-- 1. Replace the existing policy with one that has WITH CHECK matching USING.
DROP POLICY IF EXISTS api_keys_tenant ON public.api_keys;

CREATE POLICY api_keys_tenant ON public.api_keys
  FOR ALL
  USING (
    tenant_id = get_current_tenant_id()
    AND is_tenant_admin()
  )
  WITH CHECK (
    tenant_id = get_current_tenant_id()
    AND is_tenant_admin()
  );

COMMENT ON POLICY api_keys_tenant ON public.api_keys IS
  'Tenant-scoped admin access to api_keys. WITH CHECK matches USING to prevent cross-tenant writes (added 2026-05-27, API-3a self-audit).';

-- 2. Confirm RLS is still enabled (defensive — should already be on).
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
