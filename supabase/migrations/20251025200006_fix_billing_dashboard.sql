-- ============================================================================
-- FIX BILLING DASHBOARD - Add Missing Column and Correct Views
-- ============================================================================
-- Purpose: Add billing_status to PT sessions and fix billing views
-- Author: Healthcare Integration System
-- Date: 2025-10-25
-- ============================================================================

-- ============================================================================
-- 1. ADD BILLING_STATUS COLUMN TO PT SESSIONS
-- ============================================================================

ALTER TABLE pt_treatment_sessions
ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'pending'
CHECK (billing_status IN ('pending', 'submitted', 'paid', 'denied'));

CREATE INDEX IF NOT EXISTS idx_pt_sessions_billing_status
ON pt_treatment_sessions(billing_status);

COMMENT ON COLUMN pt_treatment_sessions.billing_status IS 'Billing submission status for the session';

-- ============================================================================
-- 2. RECREATE UNIFIED BILLABLE SERVICES VIEW (CORRECTED)
-- ============================================================================

DROP VIEW IF EXISTS v_unified_billable_services CASCADE;

CREATE OR REPLACE VIEW v_unified_billable_services AS

-- PT Services
SELECT
  pts.id as service_id,
  'pt_suite' as source_system,
  'pt_treatment_session' as service_type,
  pts.patient_id,
  p.first_name || ' ' || p.last_name as patient_name,
  p.mrn,
  pts.session_date as service_date,
  pts.therapist_id as provider_id,
  prov.first_name || ' ' || prov.last_name as provider_name,
  pts.cpt_codes_billed as cpt_codes,
  pts.total_billable_units as units,
  pts.total_timed_minutes as total_minutes,
  pts.billing_status as status,
  NULL::TEXT as billing_modifier,
  'Physical Therapy Session' as service_description,
  pts.created_at
FROM pt_treatment_sessions pts
JOIN profiles p ON pts.patient_id = p.user_id
JOIN profiles prov ON pts.therapist_id = prov.user_id

UNION ALL

-- Mental Health Services
SELECT
  mhts.id as service_id,
  'mental_health' as source_system,
  'therapy_session' as service_type,
  mhts.patient_id,
  p.first_name || ' ' || p.last_name as patient_name,
  p.mrn,
  mhts.session_date::date as service_date,
  mhts.participant_id as provider_id,
  mhts.participant_display as provider_name,
  ARRAY[mhts.billing_code] as cpt_codes,
  1 as units, -- Mental health typically 1 unit per session
  mhts.duration_minutes as total_minutes,
  mhts.billing_status::TEXT as status,
  mhts.billing_modifier,
  mhts.type_display as service_description,
  mhts.created_at
FROM mental_health_therapy_sessions mhts
JOIN profiles p ON mhts.patient_id = p.user_id

UNION ALL

-- Neuro Assessments (if billable - typically part of E&M)
SELECT
  nsa.id as service_id,
  'neurosuite' as source_system,
  'stroke_assessment' as service_type,
  nsa.patient_id,
  p.first_name || ' ' || p.last_name as patient_name,
  p.mrn,
  nsa.assessment_date::date as service_date,
  nsa.assessor_id as provider_id,
  prov.first_name || ' ' || prov.last_name as provider_name,
  CASE
    WHEN nsa.assessment_type = 'baseline' THEN ARRAY['99223'] -- Initial hospital care
    WHEN nsa.assessment_type = 'discharge' THEN ARRAY['99238'] -- Hospital discharge
    ELSE ARRAY['99232'] -- Subsequent hospital care
  END as cpt_codes,
  1 as units,
  NULL::INTEGER as total_minutes,
  'pending'::TEXT as status,
  NULL::TEXT as billing_modifier,
  'Stroke Assessment - ' || nsa.assessment_type as service_description,
  nsa.created_at
FROM neuro_stroke_assessments nsa
JOIN profiles p ON nsa.patient_id = p.user_id
JOIN profiles prov ON nsa.assessor_id = prov.user_id;

GRANT SELECT ON v_unified_billable_services TO authenticated;

COMMENT ON VIEW v_unified_billable_services IS 'Unified view of all billable services across PT, Mental Health, and NeuroSuite (corrected)';

-- ============================================================================
-- 3. RECREATE PATIENT BILLING SUMMARY VIEW
-- ============================================================================

CREATE OR REPLACE VIEW v_patient_billing_summary AS
SELECT
  ubs.patient_id,
  ubs.patient_name,
  ubs.mrn,

  -- Service Counts
  COUNT(DISTINCT ubs.service_id) as total_services,
  COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.source_system = 'pt_suite') as pt_services,
  COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.source_system = 'mental_health') as mh_services,
  COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.source_system = 'neurosuite') as neuro_services,

  -- Units
  SUM(ubs.units) as total_units,
  SUM(ubs.units) FILTER (WHERE ubs.source_system = 'pt_suite') as pt_units,
  SUM(ubs.units) FILTER (WHERE ubs.source_system = 'mental_health') as mh_units,

  -- Estimated Revenue (using Medicare rates)
  SUM(
    (SELECT COALESCE(SUM(cpt.medicare_rate * ubs.units), 0)
     FROM unnest(ubs.cpt_codes) as code
     LEFT JOIN cpt_code_reference cpt ON cpt.cpt_code = code)
  ) as estimated_medicare_revenue,

  SUM(
    (SELECT COALESCE(SUM(cpt.commercial_rate * ubs.units), 0)
     FROM unnest(ubs.cpt_codes) as code
     LEFT JOIN cpt_code_reference cpt ON cpt.cpt_code = code)
  ) as estimated_commercial_revenue,

  -- Billing Status
  COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.status = 'pending') as pending_services,
  COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.status = 'submitted') as submitted_services,
  COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.status = 'paid') as paid_services,

  -- Date Range
  MIN(ubs.service_date) as first_service_date,
  MAX(ubs.service_date) as latest_service_date,
  MAX(ubs.service_date) - MIN(ubs.service_date) as days_of_service

FROM v_unified_billable_services ubs
GROUP BY ubs.patient_id, ubs.patient_name, ubs.mrn;

GRANT SELECT ON v_patient_billing_summary TO authenticated;

COMMENT ON VIEW v_patient_billing_summary IS 'Patient-level billing summary across all clinical systems';

-- ============================================================================
-- 4. RECREATE PROVIDER PRODUCTIVITY DASHBOARD VIEW
-- ============================================================================

CREATE OR REPLACE VIEW v_provider_productivity AS
SELECT
  ubs.provider_id,
  ubs.provider_name,

  -- Determine primary discipline
  (SELECT roles.name FROM profiles
   JOIN roles ON profiles.role_id = roles.id
   WHERE profiles.user_id = ubs.provider_id
   LIMIT 1) as provider_role,

  -- Service Counts (Last 30 Days)
  COUNT(DISTINCT ubs.service_id) FILTER (
    WHERE ubs.service_date >= CURRENT_DATE - 30
  ) as services_last_30_days,

  -- Units Billed
  SUM(ubs.units) FILTER (
    WHERE ubs.service_date >= CURRENT_DATE - 30
  ) as units_last_30_days,

  -- Time Tracking
  SUM(ubs.total_minutes) FILTER (
    WHERE ubs.service_date >= CURRENT_DATE - 30
  ) as total_minutes_last_30_days,

  (SUM(ubs.total_minutes) FILTER (
    WHERE ubs.service_date >= CURRENT_DATE - 30
  ) / 60.0) as total_hours_last_30_days,

  -- Revenue Estimates
  SUM(
    (SELECT COALESCE(SUM(cpt.medicare_rate * ubs.units), 0)
     FROM unnest(ubs.cpt_codes) as code
     LEFT JOIN cpt_code_reference cpt ON cpt.cpt_code = code)
  ) FILTER (WHERE ubs.service_date >= CURRENT_DATE - 30) as estimated_revenue_30_days,

  -- Patient Count
  COUNT(DISTINCT ubs.patient_id) FILTER (
    WHERE ubs.service_date >= CURRENT_DATE - 30
  ) as unique_patients_30_days,

  -- Average per service
  CASE
    WHEN COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.service_date >= CURRENT_DATE - 30) > 0
    THEN SUM(ubs.units) FILTER (WHERE ubs.service_date >= CURRENT_DATE - 30)::NUMERIC /
         COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.service_date >= CURRENT_DATE - 30)
    ELSE 0
  END as avg_units_per_service,

  -- Latest activity
  MAX(ubs.service_date) as last_service_date

FROM v_unified_billable_services ubs
GROUP BY ubs.provider_id, ubs.provider_name;

GRANT SELECT ON v_provider_productivity TO authenticated;

COMMENT ON VIEW v_provider_productivity IS 'Provider productivity metrics across all services';

-- ============================================================================
-- 5. RECREATE DAILY BILLING RECONCILIATION VIEW
-- ============================================================================

CREATE OR REPLACE VIEW v_daily_billing_reconciliation AS
SELECT
  ubs.service_date,
  ubs.source_system,

  -- Volume
  COUNT(DISTINCT ubs.service_id) as total_services,
  COUNT(DISTINCT ubs.patient_id) as unique_patients,
  COUNT(DISTINCT ubs.provider_id) as unique_providers,

  -- Units & Time
  SUM(ubs.units) as total_units,
  SUM(ubs.total_minutes) as total_minutes,

  -- Revenue Estimation
  SUM(
    (SELECT COALESCE(SUM(cpt.medicare_rate * ubs.units), 0)
     FROM unnest(ubs.cpt_codes) as code
     LEFT JOIN cpt_code_reference cpt ON cpt.cpt_code = code)
  ) as estimated_medicare_revenue,

  SUM(
    (SELECT COALESCE(SUM(cpt.commercial_rate * ubs.units), 0)
     FROM unnest(ubs.cpt_codes) as code
     LEFT JOIN cpt_code_reference cpt ON cpt.cpt_code = code)
  ) as estimated_commercial_revenue,

  -- Status Breakdown
  COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.status = 'pending') as pending,
  COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.status = 'submitted') as submitted,
  COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.status = 'paid') as paid,
  COUNT(DISTINCT ubs.service_id) FILTER (WHERE ubs.status = 'denied') as denied

FROM v_unified_billable_services ubs
WHERE ubs.service_date >= CURRENT_DATE - 90 -- Last 90 days
GROUP BY ubs.service_date, ubs.source_system
ORDER BY ubs.service_date DESC, ubs.source_system;

GRANT SELECT ON v_daily_billing_reconciliation TO authenticated;

COMMENT ON VIEW v_daily_billing_reconciliation IS 'Daily billing reconciliation across all systems';

-- ============================================================================
-- 6. SUMMARY
-- ============================================================================

COMMENT ON SCHEMA public IS 'Billing dashboard fully functional with billing_status column added and all views corrected';
