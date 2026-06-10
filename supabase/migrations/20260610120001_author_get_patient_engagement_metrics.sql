-- Batch 16 (DB-reference drift triage) — author rpc::get_patient_engagement_metrics (#19).
--
-- Bucket: B-author (never defined in any migration; 0 migdefs).
-- Caller: src/api/metrics.ts:23 → fetchPatientEngagementMetrics(supabase, { tenantId, userId })
--   .rpc('get_patient_engagement_metrics', { _tenant: tenantId, _user: userId })
--   Consumer (src/pages/MetricsPage.tsx) renders one row per patient:
--     user_id | last_check_in_at | check_in_count | engagement_score
--   PatientEngagementMetric TS type also carries tenant_id.
--
-- Substrate verified live 2026-06-10 (CLAUDE.md #18):
--   * patient_engagement_metrics is a BASE TABLE (per-patient/per-day), columns incl.
--     patient_id uuid, tenant_id uuid, date date, check_in_completed boolean,
--     engagement_score integer, overall_engagement_score integer.
--   * RLS ENABLED, single policy: USING (is_admin(auth.uid()) OR patient_id = auth.uid()).
--   * function get_patient_engagement_metrics did NOT exist live (drift).
--
-- No invented algorithm: engagement_score is a STORED column; this function only aggregates
-- existing data (latest stored score, count + last date of completed check-ins) — distinct from
-- the analytics RPCs (#1/#4/#5) that need Maria's intent.
--
-- Security: SECURITY INVOKER so the base table's RLS stays the ceiling (a patient sees only
-- their own row; an admin sees all). The _tenant / _user args only NARROW within RLS — they
-- cannot widen it. Mirrors the Batch 11 precedent (prefer INVOKER when the backing table has
-- tenant/owner RLS, vs. the unscoped DEFINER siblings).
--
-- NOTE for Maria (non-blocking): the caller (src/api/metrics.ts + MetricsPage.tsx) is currently
-- UNROUTED scaffolding (placeholder TENANT_ID, "adjust fields" comments) and overlaps the live
-- PatientEngagementDashboard / patient_engagement_scores view. Authoring this fn is non-destructive
-- and clears the drift either way; product decision on keeping vs. retiring the scaffold is yours.

CREATE OR REPLACE FUNCTION public.get_patient_engagement_metrics(_tenant uuid, _user uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, last_check_in_at date, check_in_count bigint, engagement_score integer, tenant_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    pem.patient_id AS user_id,
    MAX(pem.date) FILTER (WHERE pem.check_in_completed) AS last_check_in_at,
    COUNT(*) FILTER (WHERE pem.check_in_completed) AS check_in_count,
    (ARRAY_AGG(COALESCE(pem.overall_engagement_score, pem.engagement_score)
               ORDER BY pem.date DESC NULLS LAST))[1] AS engagement_score,
    pem.tenant_id
  FROM public.patient_engagement_metrics pem
  WHERE pem.tenant_id = _tenant
    AND (_user IS NULL OR pem.patient_id = _user)
  GROUP BY pem.patient_id, pem.tenant_id;
$$;

REVOKE ALL ON FUNCTION public.get_patient_engagement_metrics(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_patient_engagement_metrics(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_engagement_metrics(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.get_patient_engagement_metrics(uuid, uuid) IS
  'Per-patient engagement summary for a tenant (optionally one patient): latest stored '
  'engagement_score, count + last date of completed check-ins. SECURITY INVOKER — base-table '
  'RLS governs visibility. Consumed by src/api/metrics.ts / MetricsPage. Drift-triage Batch 16 (#19).';
