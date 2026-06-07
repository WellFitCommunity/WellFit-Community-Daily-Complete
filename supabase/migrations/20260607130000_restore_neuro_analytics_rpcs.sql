-- Restore neuro-suite analytics RPCs (DB-reference drift triage — rpc:: Batch 11)
-- Tracker: docs/trackers/db-reference-drift-triage-tracker.md (#13, #28)
--
-- Both functions were authored in the SKIPPED migration
-- _ARCHIVE_SKIPPED/_SKIP_20251023000000_neurosuite_pt_functions.sql and then DROPPED as
-- "broken" by 20251209110000_drop_broken_functions.sql (SYSTEMIC FINDING #2 — dropped because
-- their backing tables didn't exist at drop time). The neuro_* tables now EXIST live with every
-- referenced column (verified via information_schema 2026-06-07), so the restore is legitimate.
--
-- DELIBERATE CHANGE FROM THE ORIGINAL: the originals were SECURITY DEFINER with NO tenant filter,
-- which would return clinical assessment data across ALL tenants (a HIPAA/RLS leak). All three
-- neuro_* tables have RLS (tenant_id = get_current_tenant_id() OR clinical-staff role). These are
-- user-facing SELECT analytics, so they are restored as SECURITY INVOKER — RLS now scopes the
-- result to exactly what the calling clinician is authorized to see (supabase.md §4). This is
-- strictly safer than the dropped originals.

-- #28 — caregivers with high Zarit burden needing intervention (neuroSuiteService.getHighBurdenCaregivers)
CREATE OR REPLACE FUNCTION public.identify_high_burden_caregivers()
RETURNS TABLE (
    caregiver_id UUID,
    patient_id UUID,
    zarit_score INTEGER,
    burden_level TEXT,
    respite_care_needed BOOLEAN,
    days_since_last_assessment INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH latest_assessments AS (
        SELECT DISTINCT ON (nca.patient_id)
            nca.patient_id,
            nca.caregiver_id,
            nca.zbi_total_score,
            nca.burden_level::TEXT AS burden_level,
            nca.respite_care_needed,
            nca.assessment_date
        FROM neuro_caregiver_assessments nca
        ORDER BY nca.patient_id, nca.assessment_date DESC
    )
    SELECT
        la.caregiver_id,
        la.patient_id,
        la.zbi_total_score,
        la.burden_level,
        la.respite_care_needed,
        EXTRACT(DAY FROM NOW() - la.assessment_date::TIMESTAMP)::INTEGER AS days_since_last_assessment
    FROM latest_assessments la
    WHERE la.burden_level IN ('mild_moderate_burden', 'moderate_severe_burden')
    ORDER BY la.zbi_total_score DESC;
END;
$$;
COMMENT ON FUNCTION public.identify_high_burden_caregivers() IS
  'Caregivers with mild_moderate/moderate_severe Zarit burden, latest assessment per patient. '
  'SECURITY INVOKER: RLS on neuro_caregiver_assessments scopes results to the caller.';

-- #13 — dementia patients overdue (>6mo) for cognitive reassessment (neuroSuiteService.getDementiaPatientsNeedingReassessment)
CREATE OR REPLACE FUNCTION public.get_dementia_patients_due_for_assessment()
RETURNS TABLE (
    patient_id UUID,
    patient_name TEXT,
    last_assessment_date DATE,
    days_overdue INTEGER,
    dementia_stage TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH last_assessments AS (
        SELECT
            nca.patient_id,
            MAX(nca.assessment_date) AS last_date,
            (SELECT nds.dementia_stage::TEXT
             FROM neuro_dementia_staging nds
             WHERE nds.patient_id = nca.patient_id
             ORDER BY nds.assessment_date DESC
             LIMIT 1) AS stage
        FROM neuro_cognitive_assessments nca
        GROUP BY nca.patient_id
    )
    SELECT
        la.patient_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'Unknown Patient') AS patient_name,
        la.last_date::DATE AS last_assessment_date,
        GREATEST(0, EXTRACT(DAY FROM NOW() - (la.last_date + INTERVAL '6 months'))::INTEGER) AS days_overdue,
        COALESCE(la.stage, 'Not staged') AS dementia_stage
    FROM last_assessments la
    LEFT JOIN profiles p ON p.user_id = la.patient_id
    WHERE la.last_date < NOW() - INTERVAL '6 months'
    ORDER BY days_overdue DESC;
END;
$$;
COMMENT ON FUNCTION public.get_dementia_patients_due_for_assessment() IS
  'Dementia patients whose latest cognitive assessment is >6 months old, with latest staging. '
  'SECURITY INVOKER: RLS on neuro_cognitive_assessments/neuro_dementia_staging scopes to caller.';

GRANT EXECUTE ON FUNCTION public.identify_high_burden_caregivers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dementia_patients_due_for_assessment() TO authenticated;
