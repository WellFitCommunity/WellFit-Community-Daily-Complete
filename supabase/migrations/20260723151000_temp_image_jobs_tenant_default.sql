-- temp_image_jobs: auto-populate tenant_id on insert.
--
-- Live-verified 2026-07-23: the only non-service RLS policy on this table is
--   temp_image_jobs_tenant USING/CHECK (tenant_id = get_current_tenant_id() OR is_super_admin())
-- but the client (VitalCapture.tsx) inserts WITHOUT tenant_id and the column is
-- nullable with no default — so every regular user's job INSERT failed RLS
-- (NULL = get_current_tenant_id() → NULL → rejected). Same defect class as the
-- ONC-1 incident (form blocked by unset tenant_id at RLS).
--
-- Fix: default the column through the canonical resolver. get_current_tenant_id()
-- is SECURITY DEFINER and falls back to the caller's profiles.tenant_id, so any
-- authenticated insert now lands with the caller's tenant and passes WITH CHECK.
-- No client change required; explicit tenant_id values still win over the default.

ALTER TABLE public.temp_image_jobs
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();
