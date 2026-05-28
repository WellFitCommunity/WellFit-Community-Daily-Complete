-- ============================================================================
-- fix_fhir_service_requests_update_with_check
-- ============================================================================
--
-- The initial migration 20260528102906_create_fhir_service_requests was
-- applied to the live DB with the UPDATE policy missing a WITH CHECK clause —
-- the exact gap that almost shipped on api_keys (API-3a, 2026-05-27). The
-- pre-commit gate (rule #16 in scripts/pre-commit-checks.sh) blocked the
-- create-table commit until it was fixed, so this migration records the fix
-- that was applied to the live DB BEFORE the original migration was
-- committed to git.
--
-- The original migration file (20260528102906) has been edited in place to
-- include WITH CHECK, so on a fresh database this fix migration is a no-op
-- (DROP + CREATE with identical clauses). On the live DB it was the actual
-- patch that closed the cross-tenant-write hole.
-- ============================================================================

DROP POLICY IF EXISTS fhir_service_requests_update ON public.fhir_service_requests;

CREATE POLICY fhir_service_requests_update
  ON public.fhir_service_requests
  FOR UPDATE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = get_current_tenant_id() AND is_tenant_admin());
