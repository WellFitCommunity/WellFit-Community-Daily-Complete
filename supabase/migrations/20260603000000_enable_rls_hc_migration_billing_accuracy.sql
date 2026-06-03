-- ============================================================================
-- Enable RLS on three operational tables that were shipping with RLS disabled
-- ============================================================================
-- Purpose: Close a tenant-isolation gap found by /security-scan (2026-06-03).
--          These three tables had rowsecurity=false, leaving them open to ALL
--          authenticated users regardless of tenant. All three are empty today
--          (0 rows), so there is no live exposure — this freezes the perimeter
--          before they hold data.
--
-- Tables & isolation path:
--   1. hc_migration_batch       -> organization_id -> hc_organization.tenant_id
--   2. hc_migration_log         -> batch_id -> hc_migration_batch -> org.tenant_id
--      (HIGH SENSITIVITY: source_value can contain raw migrated PHI from rows
--       that failed validation. NO super_admin bypass — mirrors the `patients`
--       table rule in 20251125000001: platform super admins never see PHI.)
--   3. billing_code_accuracy    -> encounter_id -> encounters.tenant_id
--
-- Writers: all three are written from the browser (authenticated role) via
--   src/services/hospital-workforce/migration.ts,
--   src/services/enterprise-migration/enterpriseMigrationService.ts, and
--   src/services/ai/accuracyTrackingService.ts. The policies below scope by the
--   caller's tenant so those writers continue to work within their own tenant.
--   Service-role writers (if any) bypass RLS as usual.
--
-- Caveat (intentional fail-closed): hc_organization.tenant_id is nullable. Any
--   migration org with a NULL tenant_id will have its batches/logs visible to
--   service role only — never to authenticated users. This is the safe default.
--
-- Helper: get_current_tenant_id() (SECURITY DEFINER, STABLE) — canonical tenant
--   resolver, confirmed present in pg_proc on 2026-06-03.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. hc_migration_batch — tenant isolation via the hc_organization bridge
-- ----------------------------------------------------------------------------
ALTER TABLE public.hc_migration_batch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hc_migration_batch_tenant_isolation" ON public.hc_migration_batch;
CREATE POLICY "hc_migration_batch_tenant_isolation" ON public.hc_migration_batch
  FOR ALL
  USING (
    organization_id IN (
      SELECT o.organization_id
      FROM public.hc_organization o
      WHERE o.tenant_id = get_current_tenant_id()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT o.organization_id
      FROM public.hc_organization o
      WHERE o.tenant_id = get_current_tenant_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 2. hc_migration_log — tenant isolation via batch -> org bridge.
--    source_value may hold PHI: strictly tenant-scoped, no super_admin bypass.
-- ----------------------------------------------------------------------------
ALTER TABLE public.hc_migration_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hc_migration_log_tenant_isolation" ON public.hc_migration_log;
CREATE POLICY "hc_migration_log_tenant_isolation" ON public.hc_migration_log
  FOR ALL
  USING (
    batch_id IN (
      SELECT b.batch_id
      FROM public.hc_migration_batch b
      JOIN public.hc_organization o ON o.organization_id = b.organization_id
      WHERE o.tenant_id = get_current_tenant_id()
    )
  )
  WITH CHECK (
    batch_id IN (
      SELECT b.batch_id
      FROM public.hc_migration_batch b
      JOIN public.hc_organization o ON o.organization_id = b.organization_id
      WHERE o.tenant_id = get_current_tenant_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 3. billing_code_accuracy — tenant isolation via the encounter
-- ----------------------------------------------------------------------------
ALTER TABLE public.billing_code_accuracy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_code_accuracy_tenant_isolation" ON public.billing_code_accuracy;
CREATE POLICY "billing_code_accuracy_tenant_isolation" ON public.billing_code_accuracy
  FOR ALL
  USING (
    encounter_id IN (
      SELECT e.id
      FROM public.encounters e
      WHERE e.tenant_id = get_current_tenant_id()
    )
  )
  WITH CHECK (
    encounter_id IN (
      SELECT e.id
      FROM public.encounters e
      WHERE e.tenant_id = get_current_tenant_id()
    )
  );

commit;
