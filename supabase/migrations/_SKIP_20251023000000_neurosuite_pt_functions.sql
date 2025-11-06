-- =====================================================
-- CLINICAL INTELLIGENCE SQL FUNCTIONS
-- For NeuroSuite & PT Workflow System
-- =====================================================
-- Created: 2025-10-23
-- Purpose: Clinical decision support and analytics
-- =====================================================

-- =====================================================
-- NEUROSUITE FUNCTIONS
-- =====================================================

-- Function: Get active stroke patients for neurologist
CREATE OR REPLACE FUNCTION get_active_stroke_patients(p_neurologist_id UUID)
RETURNS TABLE (
    patient_id UUID,
    patient_name TEXT,
    stroke_type TEXT,
    nihss_score INTEGER,
    days_since_stroke INTEGER,
    next_assessment_due DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        nsa.patient_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'Unknown Patient') AS patient_name,
        nsa.stroke_type::TEXT,
        nsa.nihss_total_score,
        EXTRACT(DAY FROM NOW() - nsa.assessment_date::TIMESTAMP)::INTEGER AS days_since_stroke,
        (nsa.assessment_date::DATE + INTERVAL '90 days')::DATE AS next_assessment_due
    FROM neuro_stroke_assessments nsa
    LEFT JOIN profiles p ON p.user_id = nsa.patient_id
    WHERE nsa.assessor_id = p_neurologist_id
      AND nsa.assessment_type IN ('baseline', '24_hour')
      AND nsa.assessment_date > NOW() - INTERVAL '90 days'
    ORDER BY nsa.assessment_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate stroke outcome improvement
CREATE OR REPLACE FUNCTION calculate_stroke_outcome_improvement(p_patient_id UUID)
RETURNS TABLE (
    baseline_nihss INTEGER,
    discharge_nihss INTEGER,
    nihss_improvement INTEGER,
    baseline_mrs INTEGER,
    day_90_mrs INTEGER,
    functional_independence_achieved BOOLEAN
) AS $$
DECLARE
    v_baseline_nihss INTEGER;
    v_discharge_nihss INTEGER;
    v_baseline_mrs INTEGER;
    v_day_90_mrs INTEGER;
BEGIN
    -- Get baseline NIHSS
    SELECT nihss_total_score INTO v_baseline_nihss
    FROM neuro_stroke_assessments
    WHERE patient_id = p_patient_id
      AND assessment_type = 'baseline'
    ORDER BY assessment_date ASC
    LIMIT 1;

    -- Get discharge NIHSS
    SELECT nihss_total_score INTO v_discharge_nihss
    FROM neuro_stroke_assessments
    WHERE patient_id = p_patient_id
      AND assessment_type = 'discharge'
    ORDER BY assessment_date DESC
    LIMIT 1;

    -- Get baseline mRS
    SELECT mrs_score INTO v_baseline_mrs
    FROM neuro_modified_rankin_scale
    WHERE patient_id = p_patient_id
      AND assessment_timepoint = 'pre_stroke'
    ORDER BY assessment_date ASC
    LIMIT 1;

    -- Get 90-day mRS
    SELECT mrs_score INTO v_day_90_mrs
    FROM neuro_modified_rankin_scale
    WHERE patient_id = p_patient_id
      AND assessment_timepoint = '90_day'
    ORDER BY assessment_date DESC
    LIMIT 1;

    RETURN QUERY SELECT
        v_baseline_nihss,
        v_discharge_nihss,
        COALESCE(v_baseline_nihss - v_discharge_nihss, 0) AS nihss_improvement,
        v_baseline_mrs,
        v_day_90_mrs,
        (v_day_90_mrs <= 2) AS functional_independence_achieved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get dementia patients needing reassessment
CREATE OR REPLACE FUNCTION get_dementia_patients_due_for_assessment()
RETURNS TABLE (
    patient_id UUID,
    patient_name TEXT,
    last_assessment_date DATE,
    days_overdue INTEGER,
    dementia_stage TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH last_assessments AS (
        SELECT
            nca.patient_id,
            MAX(nca.assessment_date) AS last_date,
            (SELECT dementia_stage::TEXT
             FROM neuro_dementia_staging nds
             WHERE nds.patient_id = nca.patient_id
             ORDER BY assessment_date DESC
             LIMIT 1) AS stage
        FROM neuro_cognitive_assessments nca
        GROUP BY nca.patient_id
    )
    SELECT
        la.patient_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'Unknown Patient') AS patient_name,
        la.last_date::DATE,
        GREATEST(0, EXTRACT(DAY FROM NOW() - (la.last_date + INTERVAL '6 months'))::INTEGER) AS days_overdue,
        COALESCE(la.stage, 'Not staged') AS dementia_stage
    FROM last_assessments la
    LEFT JOIN profiles p ON p.user_id = la.patient_id
    WHERE la.last_date < NOW() - INTERVAL '6 months'
    ORDER BY days_overdue DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate cognitive decline rate
CREATE OR REPLACE FUNCTION calculate_cognitive_decline_rate(p_patient_id UUID)
RETURNS TABLE (
    baseline_score INTEGER,
    current_score INTEGER,
    decline_per_year NUMERIC,
    statistically_significant BOOLEAN
) AS $$
DECLARE
    v_baseline_score INTEGER;
    v_baseline_date TIMESTAMP;
    v_current_score INTEGER;
    v_current_date TIMESTAMP;
    v_years_elapsed NUMERIC;
    v_decline_rate NUMERIC;
BEGIN
    -- Get baseline assessment
    SELECT
        COALESCE(moca_total_score, mmse_total_score),
        assessment_date::TIMESTAMP
    INTO v_baseline_score, v_baseline_date
    FROM neuro_cognitive_assessments
    WHERE patient_id = p_patient_id
    ORDER BY assessment_date ASC
    LIMIT 1;

    -- Get most recent assessment
    SELECT
        COALESCE(moca_total_score, mmse_total_score),
        assessment_date::TIMESTAMP
    INTO v_current_score, v_current_date
    FROM neuro_cognitive_assessments
    WHERE patient_id = p_patient_id
    ORDER BY assessment_date DESC
    LIMIT 1;

    -- Calculate years elapsed
    v_years_elapsed := EXTRACT(EPOCH FROM (v_current_date - v_baseline_date)) / (365.25 * 24 * 60 * 60);

    -- Calculate decline rate per year
    IF v_years_elapsed > 0 THEN
        v_decline_rate := (v_baseline_score - v_current_score) / v_years_elapsed;
    ELSE
        v_decline_rate := 0;
    END IF;

    RETURN QUERY SELECT
        v_baseline_score,
        v_current_score,
        ROUND(v_decline_rate, 2) AS decline_per_year,
        -- Decline >3 points/year on MoCA is clinically significant
        (ABS(v_decline_rate) > 3) AS statistically_significant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Identify high-burden caregivers
CREATE OR REPLACE FUNCTION identify_high_burden_caregivers()
RETURNS TABLE (
    caregiver_id UUID,
    patient_id UUID,
    zarit_score INTEGER,
    burden_level TEXT,
    respite_care_needed BOOLEAN,
    days_since_last_assessment INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_assessments AS (
        SELECT DISTINCT ON (patient_id)
            patient_id,
            caregiver_id,
            zbi_total_score,
            burden_level::TEXT,
            respite_care_needed,
            assessment_date
        FROM neuro_caregiver_assessments
        ORDER BY patient_id, assessment_date DESC
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PHYSICAL THERAPY FUNCTIONS
-- =====================================================

-- Function: Get PT therapist's active caseload
CREATE OR REPLACE FUNCTION get_pt_therapist_caseload(p_therapist_id UUID)
RETURNS TABLE (
    patient_id UUID,
    patient_name TEXT,
    diagnosis TEXT,
    visits_used INTEGER,
    visits_remaining INTEGER,
    next_scheduled_visit TIMESTAMP,
    days_since_last_visit INTEGER,
    progress_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH active_plans AS (
        SELECT
            ptp.patient_id,
            ptp.id AS plan_id,
            ptp.visits_used,
            ptp.visits_remaining,
            ptfa.primary_diagnosis AS diagnosis
        FROM pt_treatment_plans ptp
        LEFT JOIN pt_functional_assessments ptfa ON ptfa.id = ptp.assessment_id
        WHERE ptp.therapist_id = p_therapist_id
          AND ptp.status = 'active'
    ),
    last_sessions AS (
        SELECT DISTINCT ON (treatment_plan_id)
            treatment_plan_id,
            session_date
        FROM pt_treatment_sessions
        ORDER BY treatment_plan_id, session_date DESC
    )
    SELECT
        ap.patient_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'Unknown Patient') AS patient_name,
        ap.diagnosis,
        ap.visits_used,
        ap.visits_remaining,
        NULL::TIMESTAMP AS next_scheduled_visit, -- TODO: Link to scheduling system
        COALESCE(EXTRACT(DAY FROM NOW() - ls.session_date::TIMESTAMP)::INTEGER, 999) AS days_since_last_visit,
        CASE
            WHEN ap.visits_remaining < 3 THEN 'at_risk'
            WHEN COALESCE(EXTRACT(DAY FROM NOW() - ls.session_date::TIMESTAMP)::INTEGER, 999) > 14 THEN 'not_progressing'
            ELSE 'on_track'
        END AS progress_status
    FROM active_plans ap
    LEFT JOIN profiles p ON p.user_id = ap.patient_id
    LEFT JOIN last_sessions ls ON ls.treatment_plan_id = ap.plan_id
    ORDER BY days_since_last_visit DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Evaluate PT discharge readiness
DROP FUNCTION IF EXISTS evaluate_pt_discharge_readiness(UUID);
CREATE OR REPLACE FUNCTION evaluate_pt_discharge_readiness(p_plan_id UUID)
RETURNS TABLE (
    ready_for_discharge BOOLEAN,
    goals_met_count INTEGER,
    total_goals INTEGER,
    goals_met_percentage NUMERIC,
    recommendations TEXT
) AS $$
DECLARE
    v_goals JSONB;
    v_total_goals INTEGER;
    v_goals_met INTEGER;
    v_percentage NUMERIC;
    v_ready BOOLEAN;
    v_recommendations TEXT;
BEGIN
    -- Get goals from treatment plan
    SELECT goals INTO v_goals
    FROM pt_treatment_plans
    WHERE id = p_plan_id;

    -- Count total goals
    v_total_goals := jsonb_array_length(v_goals);

    -- Count goals met (achieved = true)
    SELECT COUNT(*) INTO v_goals_met
    FROM jsonb_array_elements(v_goals) AS goal
    WHERE (goal->>'achieved')::BOOLEAN = TRUE;

    -- Calculate percentage
    IF v_total_goals > 0 THEN
        v_percentage := (v_goals_met::NUMERIC / v_total_goals::NUMERIC) * 100;
    ELSE
        v_percentage := 0;
    END IF;

    -- Determine readiness (80% threshold)
    v_ready := v_percentage >= 80;

    -- Generate recommendations
    IF v_ready THEN
        v_recommendations := 'Patient meets discharge criteria. Prepare discharge summary and home exercise program.';
    ELSIF v_percentage >= 60 THEN
        v_recommendations := 'Patient progressing well. Continue treatment for 2-3 more visits.';
    ELSE
        v_recommendations := 'Patient requires continued therapy. Review goals and modify treatment plan if needed.';
    END IF;

    RETURN QUERY SELECT
        v_ready,
        v_goals_met,
        v_total_goals,
        ROUND(v_percentage, 1) AS goals_met_percentage,
        v_recommendations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate PT functional improvement
CREATE OR REPLACE FUNCTION calculate_pt_functional_improvement(p_patient_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_initial_score NUMERIC;
    v_current_score NUMERIC;
    v_improvement NUMERIC;
BEGIN
    -- Get initial evaluation functional scores (average of mobility scores)
    SELECT
        (COALESCE(bed_mobility_score, 0) +
         COALESCE(transfer_ability_score, 0) +
         COALESCE(ambulation_score, 0) +
         COALESCE(stair_negotiation_score, 0)) / 4.0
    INTO v_initial_score
    FROM pt_functional_assessments
    WHERE patient_id = p_patient_id
      AND assessment_type = 'initial_evaluation'
    ORDER BY assessment_date ASC
    LIMIT 1;

    -- Get most recent evaluation functional scores
    SELECT
        (COALESCE(bed_mobility_score, 0) +
         COALESCE(transfer_ability_score, 0) +
         COALESCE(ambulation_score, 0) +
         COALESCE(stair_negotiation_score, 0)) / 4.0
    INTO v_current_score
    FROM pt_functional_assessments
    WHERE patient_id = p_patient_id
    ORDER BY assessment_date DESC
    LIMIT 1;

    -- Calculate improvement percentage
    IF v_initial_score > 0 THEN
        v_improvement := ((v_current_score - v_initial_score) / v_initial_score) * 100;
    ELSE
        v_improvement := 0;
    END IF;

    RETURN ROUND(v_improvement, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_active_stroke_patients(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_stroke_outcome_improvement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dementia_patients_due_for_assessment() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_cognitive_decline_rate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION identify_high_burden_caregivers() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pt_therapist_caseload(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_pt_discharge_readiness(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_pt_functional_improvement(UUID) TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION get_active_stroke_patients IS 'Returns active stroke patients for a neurologist with NIHSS scores and follow-up dates';
COMMENT ON FUNCTION calculate_stroke_outcome_improvement IS 'Calculates stroke outcome improvement from baseline to discharge (NIHSS and mRS)';
COMMENT ON FUNCTION get_dementia_patients_due_for_assessment IS 'Identifies dementia patients overdue for 6-month reassessment';
COMMENT ON FUNCTION calculate_cognitive_decline_rate IS 'Calculates cognitive decline rate per year based on MoCA/MMSE scores';
COMMENT ON FUNCTION identify_high_burden_caregivers IS 'Identifies caregivers with high Zarit burden scores needing intervention';
COMMENT ON FUNCTION get_pt_therapist_caseload IS 'Returns PT therapist active caseload with visit utilization and progress status';
COMMENT ON FUNCTION evaluate_pt_discharge_readiness IS 'Evaluates if PT patient is ready for discharge based on goal achievement';
COMMENT ON FUNCTION calculate_pt_functional_improvement IS 'Calculates functional improvement percentage for PT patient';
