-- ============================================================================
-- UNIFIED BILLING DASHBOARD
-- ============================================================================
-- Purpose: Consolidated billing view across NeuroSuite, PT, and Mental Health
--          Track CPT codes, units, and revenue across all clinical systems
-- Author: Healthcare Integration System
-- Date: 2025-10-25
-- ============================================================================

-- ============================================================================
-- 1. UNIFIED BILLABLE SERVICES VIEW
-- ============================================================================

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

COMMENT ON VIEW v_unified_billable_services IS 'Unified view of all billable services across PT, Mental Health, and NeuroSuite';

-- ============================================================================
-- 2. CPT CODE REFERENCE TABLE (For revenue estimation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cpt_code_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- CPT Code
  cpt_code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'evaluation_management',
    'physical_therapy',
    'occupational_therapy',
    'mental_health',
    'neurology',
    'diagnostic',
    'procedure'
  )),

  -- Billing
  medicare_rvu NUMERIC(6,2), -- Relative Value Unit
  medicare_rate NUMERIC(8,2), -- Medicare payment rate
  commercial_rate NUMERIC(8,2), -- Average commercial rate
  time_based BOOLEAN DEFAULT false,
  typical_units INTEGER DEFAULT 1,

  -- Requirements
  requires_supervision BOOLEAN DEFAULT false,
  requires_physician_order BOOLEAN DEFAULT false,
  place_of_service TEXT[], -- '11' = Office, '21' = Inpatient Hospital, '22' = Outpatient Hospital

  -- Documentation
  documentation_requirements TEXT,
  common_modifiers TEXT[],

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_cpt_code_lookup ON cpt_code_reference(cpt_code);
CREATE INDEX idx_cpt_category ON cpt_code_reference(category);

-- ============================================================================
-- 3. SEED COMMON CPT CODES
-- ============================================================================

INSERT INTO cpt_code_reference (cpt_code, description, category, medicare_rate, commercial_rate, time_based, typical_units) VALUES
-- PT Codes
('97110', 'Therapeutic Exercise', 'physical_therapy', 32.50, 45.00, true, 2),
('97112', 'Neuromuscular Reeducation', 'physical_therapy', 33.00, 46.00, true, 2),
('97116', 'Gait Training', 'physical_therapy', 32.00, 44.00, true, 2),
('97140', 'Manual Therapy', 'physical_therapy', 33.50, 47.00, true, 2),
('97161', 'PT Evaluation - Low Complexity', 'physical_therapy', 95.00, 130.00, false, 1),
('97162', 'PT Evaluation - Moderate Complexity', 'physical_therapy', 135.00, 185.00, false, 1),
('97163', 'PT Evaluation - High Complexity', 'physical_therapy', 175.00, 240.00, false, 1),

-- Mental Health Codes
('90832', 'Psychotherapy 30 minutes', 'mental_health', 75.00, 105.00, false, 1),
('90834', 'Psychotherapy 45 minutes', 'mental_health', 110.00, 155.00, false, 1),
('90836', 'Psychotherapy 45 min with E&M', 'mental_health', 125.00, 175.00, false, 1),
('90838', 'Psychotherapy 60 min with E&M', 'mental_health', 150.00, 210.00, false, 1),
('90791', 'Psychiatric Diagnostic Evaluation', 'mental_health', 145.00, 200.00, false, 1),
('90792', 'Psychiatric Eval with Medical Services', 'mental_health', 165.00, 230.00, false, 1),

-- E&M Codes (Neuro/Hospital)
('99223', 'Initial Hospital Care - High Complexity', 'evaluation_management', 220.00, 310.00, false, 1),
('99232', 'Subsequent Hospital Care', 'evaluation_management', 95.00, 135.00, false, 1),
('99238', 'Hospital Discharge Day Management', 'evaluation_management', 85.00, 120.00, false, 1),
('99490', 'Care Coordination - First 20 min', 'evaluation_management', 42.00, 60.00, true, 1),
('99439', 'Care Coordination - Additional 20 min', 'evaluation_management', 38.00, 55.00, true, 1)
ON CONFLICT (cpt_code) DO NOTHING;

-- ============================================================================
-- 4. BILLING SUMMARY BY PATIENT VIEW
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
-- 5. PROVIDER PRODUCTIVITY DASHBOARD VIEW
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
-- 6. DAILY BILLING RECONCILIATION VIEW
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
-- 7. FUNCTION: Calculate Estimated Revenue for Patient
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_patient_estimated_revenue(
  p_patient_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_payer_type TEXT DEFAULT 'medicare' -- 'medicare' or 'commercial'
) RETURNS TABLE (
  total_services BIGINT,
  total_units BIGINT,
  pt_revenue NUMERIC,
  mh_revenue NUMERIC,
  neuro_revenue NUMERIC,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT ubs.service_id)::BIGINT,
    SUM(ubs.units)::BIGINT,
    SUM(
      CASE WHEN ubs.source_system = 'pt_suite'
      THEN (SELECT COALESCE(SUM(
        CASE p_payer_type
          WHEN 'medicare' THEN cpt.medicare_rate
          ELSE cpt.commercial_rate
        END * ubs.units), 0)
       FROM unnest(ubs.cpt_codes) as code
       LEFT JOIN cpt_code_reference cpt ON cpt.cpt_code = code)
      ELSE 0
      END
    ) as pt_revenue,
    SUM(
      CASE WHEN ubs.source_system = 'mental_health'
      THEN (SELECT COALESCE(SUM(
        CASE p_payer_type
          WHEN 'medicare' THEN cpt.medicare_rate
          ELSE cpt.commercial_rate
        END * ubs.units), 0)
       FROM unnest(ubs.cpt_codes) as code
       LEFT JOIN cpt_code_reference cpt ON cpt.cpt_code = code)
      ELSE 0
      END
    ) as mh_revenue,
    SUM(
      CASE WHEN ubs.source_system = 'neurosuite'
      THEN (SELECT COALESCE(SUM(
        CASE p_payer_type
          WHEN 'medicare' THEN cpt.medicare_rate
          ELSE cpt.commercial_rate
        END * ubs.units), 0)
       FROM unnest(ubs.cpt_codes) as code
       LEFT JOIN cpt_code_reference cpt ON cpt.cpt_code = code)
      ELSE 0
      END
    ) as neuro_revenue,
    SUM(
      (SELECT COALESCE(SUM(
        CASE p_payer_type
          WHEN 'medicare' THEN cpt.medicare_rate
          ELSE cpt.commercial_rate
        END * ubs.units), 0)
       FROM unnest(ubs.cpt_codes) as code
       LEFT JOIN cpt_code_reference cpt ON cpt.cpt_code = code)
    ) as total_revenue
  FROM v_unified_billable_services ubs
  WHERE ubs.patient_id = p_patient_id
    AND (p_start_date IS NULL OR ubs.service_date >= p_start_date)
    AND (p_end_date IS NULL OR ubs.service_date <= p_end_date);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_patient_estimated_revenue IS 'Calculate estimated revenue for a patient across all systems';

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE cpt_code_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view CPT codes"
  ON cpt_code_reference FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage CPT codes"
  ON cpt_code_reference FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2)
    )
  );

-- ============================================================================
-- 9. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON cpt_code_reference TO authenticated;
GRANT INSERT, UPDATE ON cpt_code_reference TO authenticated;

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE cpt_code_reference IS 'CPT code reference with Medicare and commercial rates for revenue estimation';
COMMENT ON VIEW v_unified_billable_services IS 'All billable services across PT, Mental Health, and NeuroSuite';
COMMENT ON VIEW v_patient_billing_summary IS 'Patient-level billing summary with revenue estimates';
COMMENT ON VIEW v_provider_productivity IS 'Provider productivity and revenue metrics';
COMMENT ON VIEW v_daily_billing_reconciliation IS 'Daily billing reconciliation report';
