-- ============================================================================
-- NORMALIZE SMART on FHIR RLS POLICIES
-- ============================================================================
-- Context: Phase 2.2 of the Trust & Accountability Wrapper refactor.
--
-- Problem: The tenant RLS gap-fix migration (_APPLIED_20260103000003) added
-- smart_registered_apps_tenant which grants FOR ALL to any authenticated user
-- matching the tenant_id. This bypasses admin-only enforcement — a regular
-- patient could modify app registrations.
--
-- Additionally, Phase 1 (20260207100000) dropped the original patient self-view
-- policies when it replaced them with admin-all policies. Patients need:
--   - SELECT on approved apps (to authorize them in the OAuth flow)
--   - SELECT on their own authorizations (to manage connected apps)
--   - SELECT on their own tokens (to review active sessions)
--
-- This migration establishes the correct layered RLS:
--   Layer 1: service_role = full access (for edge functions)
--   Layer 2: admin/super_admin = full CRUD (via current_user_has_any_role)
--   Layer 3: authenticated = read approved apps, own authorizations, own tokens
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP OVERLY-PERMISSIVE TENANT POLICY
-- ============================================================================
-- This policy let ANY authenticated user with matching tenant_id do anything
-- on smart_registered_apps — including INSERT/UPDATE/DELETE. Not acceptable.

DROP POLICY IF EXISTS "smart_registered_apps_tenant" ON public.smart_registered_apps;

-- Also drop the original public_view if it somehow survived (it shouldn't,
-- but safety first)
DROP POLICY IF EXISTS "smart_apps_public_view" ON public.smart_registered_apps;

-- Drop original patient self-view policies if they survived
DROP POLICY IF EXISTS "smart_authorizations_patient_view" ON public.smart_authorizations;
DROP POLICY IF EXISTS "smart_tokens_patient_view" ON public.smart_access_tokens;

-- ============================================================================
-- 2. VERIFY ADMIN POLICIES EXIST (idempotent recreate)
-- ============================================================================
-- These were created in Phase 1 (20260207100000). Recreate if missing.

-- 2a. Admin CRUD on registered apps
DROP POLICY IF EXISTS "smart_registered_apps_admin_all" ON public.smart_registered_apps;
CREATE POLICY "smart_registered_apps_admin_all" ON public.smart_registered_apps
  FOR ALL
  TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['admin', 'super_admin'])
  )
  WITH CHECK (
    public.current_user_has_any_role(ARRAY['admin', 'super_admin'])
  );

-- 2b. Admin CRUD on authorizations
DROP POLICY IF EXISTS "smart_authorizations_admin_all" ON public.smart_authorizations;
CREATE POLICY "smart_authorizations_admin_all" ON public.smart_authorizations
  FOR ALL
  TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['admin', 'super_admin'])
  )
  WITH CHECK (
    public.current_user_has_any_role(ARRAY['admin', 'super_admin'])
  );

-- 2c. Admin SELECT on audit log (already correct, idempotent recreate)
DROP POLICY IF EXISTS "smart_audit_log_admin_select" ON public.smart_audit_log;
CREATE POLICY "smart_audit_log_admin_select" ON public.smart_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['admin', 'super_admin'])
  );

-- ============================================================================
-- 3. ADD PATIENT / AUTHENTICATED READ POLICIES
-- ============================================================================
-- These are the Layer 3 policies: let regular users see what they need.

-- 3a. Any authenticated user can SEE approved apps (required for OAuth consent screen)
CREATE POLICY "smart_apps_approved_view" ON public.smart_registered_apps
  FOR SELECT
  TO authenticated
  USING (status = 'approved');

-- 3b. Patients can view their own authorizations (manage connected apps)
CREATE POLICY "smart_authorizations_patient_view" ON public.smart_authorizations
  FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

-- 3c. Patients can view their own tokens (review active sessions)
CREATE POLICY "smart_tokens_patient_view" ON public.smart_access_tokens
  FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

-- ============================================================================
-- 4. VERIFY SERVICE ROLE POLICIES EXIST (should already exist)
-- ============================================================================
-- Service role needs full access for the edge functions (smart-register-app,
-- token endpoint, etc). These should already exist from the original migration.
-- Idempotent recreate to be safe.

DROP POLICY IF EXISTS "smart_apps_service_all" ON public.smart_registered_apps;
CREATE POLICY "smart_apps_service_all" ON public.smart_registered_apps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "smart_auth_codes_service_all" ON public.smart_auth_codes;
DROP POLICY IF EXISTS "smart_auth_codes_service_only" ON public.smart_auth_codes;
CREATE POLICY "smart_auth_codes_service_all" ON public.smart_auth_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "smart_tokens_service_all" ON public.smart_access_tokens;
DROP POLICY IF EXISTS "smart_access_tokens_service_only" ON public.smart_access_tokens;
CREATE POLICY "smart_tokens_service_all" ON public.smart_access_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "smart_authorizations_service_all" ON public.smart_authorizations;
CREATE POLICY "smart_authorizations_service_all" ON public.smart_authorizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "smart_audit_service_all" ON public.smart_audit_log;
DROP POLICY IF EXISTS "smart_audit_log_service_insert" ON public.smart_audit_log;
CREATE POLICY "smart_audit_service_all" ON public.smart_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;

-- ============================================================================
-- FINAL POLICY MATRIX (expected after this migration)
-- ============================================================================
-- Table                   | Policy                              | Role           | Ops
-- smart_registered_apps   | smart_apps_service_all              | service_role   | ALL
-- smart_registered_apps   | smart_registered_apps_admin_all     | admin/s_admin  | ALL
-- smart_registered_apps   | smart_apps_approved_view            | authenticated  | SELECT (approved only)
-- smart_auth_codes        | smart_auth_codes_service_all        | service_role   | ALL
-- smart_access_tokens     | smart_tokens_service_all            | service_role   | ALL
-- smart_access_tokens     | smart_tokens_patient_view           | authenticated  | SELECT (own only)
-- smart_authorizations    | smart_authorizations_service_all    | service_role   | ALL
-- smart_authorizations    | smart_authorizations_admin_all      | admin/s_admin  | ALL
-- smart_authorizations    | smart_authorizations_patient_view   | authenticated  | SELECT (own only)
-- smart_audit_log         | smart_audit_service_all             | service_role   | ALL
-- smart_audit_log         | smart_audit_log_admin_select        | admin/s_admin  | SELECT
-- ============================================================================
