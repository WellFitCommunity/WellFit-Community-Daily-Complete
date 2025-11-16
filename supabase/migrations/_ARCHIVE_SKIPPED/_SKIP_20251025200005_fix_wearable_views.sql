-- ============================================================================
-- FIX WEARABLE INTEGRATION VIEWS - Column Name Corrections
-- ============================================================================
-- Purpose: Fix column name mismatches in wearable integration views
-- Author: Healthcare Integration System
-- Date: 2025-10-25
-- ============================================================================

-- Drop old views if they exist (they failed to create anyway)
DROP VIEW IF EXISTS v_pt_wearable_gait_integration CASCADE;
DROP VIEW IF EXISTS v_mh_wearable_activity_integration CASCADE;

-- ============================================================================
-- 1. PT-WEARABLE DATA INTEGRATION VIEW (CORRECTED)
-- ============================================================================

CREATE OR REPLACE VIEW v_pt_wearable_gait_integration AS
SELECT
  pt.id as pt_assessment_id,
  pt.patient_id,
  pt.assessment_date,
  pt.therapist_id,

  -- PT Gait Assessment Data
  pt.gait_analysis as pt_gait_clinical,

  -- Wearable Gait Data (Last 7 days before PT assessment)
  (SELECT json_agg(json_build_object(
    'recorded_at', wg.recorded_at,
    'gait_speed', wg.gait_speed_m_per_s,
    'stride_length', wg.stride_length_cm,
    'cadence', wg.cadence,
    'double_support_time', wg.double_support_time_percent,
    'gait_variability', wg.gait_variability_score
  ) ORDER BY wg.recorded_at DESC)
   FROM wearable_gait_analysis wg
   WHERE wg.user_id = pt.patient_id
     AND wg.recorded_at BETWEEN pt.assessment_date - INTERVAL '7 days' AND pt.assessment_date
  ) as wearable_gait_data_week,

  -- Average gait metrics from wearables
  (SELECT AVG(gait_speed_m_per_s)
   FROM wearable_gait_analysis
   WHERE user_id = pt.patient_id
     AND recorded_at BETWEEN pt.assessment_date - INTERVAL '7 days' AND pt.assessment_date
  ) as avg_gait_speed_week,

  (SELECT AVG(gait_variability_score)
   FROM wearable_gait_analysis
   WHERE user_id = pt.patient_id
     AND recorded_at BETWEEN pt.assessment_date - INTERVAL '7 days' AND pt.assessment_date
  ) as avg_gait_variability_week,

  -- Fall Risk Indicators
  (SELECT COUNT(*)
   FROM wearable_fall_detections
   WHERE patient_id = pt.patient_id
     AND fall_detected_at BETWEEN pt.assessment_date - INTERVAL '30 days' AND pt.assessment_date
  ) as falls_last_30_days,

  (SELECT COUNT(*)
   FROM wearable_fall_detections
   WHERE patient_id = pt.patient_id
     AND fall_detected_at BETWEEN pt.assessment_date - INTERVAL '7 days' AND pt.assessment_date
  ) as falls_last_7_days

FROM pt_functional_assessments pt
WHERE pt.gait_analysis IS NOT NULL;

GRANT SELECT ON v_pt_wearable_gait_integration TO authenticated;

COMMENT ON VIEW v_pt_wearable_gait_integration IS 'Combines PT clinical gait assessment with wearable device gait data (corrected column names)';

-- ============================================================================
-- 2. MENTAL HEALTH - WEARABLE ACTIVITY INTEGRATION VIEW (CORRECTED)
-- ============================================================================

CREATE OR REPLACE VIEW v_mh_wearable_activity_integration AS
SELECT
  mh.id as risk_assessment_id,
  mh.patient_id,
  mh.effective_datetime,
  mh.risk_level,
  mh.phq9_score,
  mh.gad7_score,

  -- Activity data from wearables (7 days prior) - CORRECTED: use 'date' not 'activity_date'
  (SELECT AVG(steps)
   FROM wearable_activity_data
   WHERE user_id = mh.patient_id
     AND date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date
  ) as avg_daily_steps_week,

  (SELECT AVG(active_minutes)
   FROM wearable_activity_data
   WHERE user_id = mh.patient_id
     AND date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date
  ) as avg_active_minutes_week,

  (SELECT AVG(sedentary_minutes)
   FROM wearable_activity_data
   WHERE user_id = mh.patient_id
     AND date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date
  ) as avg_sedentary_minutes_week,

  (SELECT AVG(sleep_minutes)
   FROM wearable_activity_data
   WHERE user_id = mh.patient_id
     AND date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date
  ) as avg_sleep_duration_week,

  -- Activity trend (comparing to previous week)
  (SELECT AVG(steps)
   FROM wearable_activity_data
   WHERE user_id = mh.patient_id
     AND date BETWEEN (mh.effective_datetime::date - 14) AND (mh.effective_datetime::date - 7)
  ) as avg_daily_steps_prior_week,

  -- Calculate activity decline percentage
  CASE
    WHEN (SELECT AVG(steps) FROM wearable_activity_data
          WHERE user_id = mh.patient_id
            AND date BETWEEN (mh.effective_datetime::date - 14) AND (mh.effective_datetime::date - 7)) > 0
    THEN
      ((SELECT AVG(steps) FROM wearable_activity_data
        WHERE user_id = mh.patient_id
          AND date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date) -
       (SELECT AVG(steps) FROM wearable_activity_data
        WHERE user_id = mh.patient_id
          AND date BETWEEN (mh.effective_datetime::date - 14) AND (mh.effective_datetime::date - 7)))
      /
      (SELECT AVG(steps) FROM wearable_activity_data
       WHERE user_id = mh.patient_id
         AND date BETWEEN (mh.effective_datetime::date - 14) AND (mh.effective_datetime::date - 7))
      * 100
    ELSE NULL
  END as activity_change_percentage,

  -- Flag for significant activity decline (potential depression indicator)
  CASE
    WHEN (SELECT AVG(steps) FROM wearable_activity_data
          WHERE user_id = mh.patient_id
            AND date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date) <
         (SELECT AVG(steps) FROM wearable_activity_data
          WHERE user_id = mh.patient_id
            AND date BETWEEN (mh.effective_datetime::date - 14) AND (mh.effective_datetime::date - 7)) * 0.5
    THEN true
    ELSE false
  END as significant_activity_decline

FROM mental_health_risk_assessments mh;

GRANT SELECT ON v_mh_wearable_activity_integration TO authenticated;

COMMENT ON VIEW v_mh_wearable_activity_integration IS 'Combines mental health assessments with wearable activity data to identify behavioral changes (corrected column names)';

-- ============================================================================
-- 3. UPDATE WEARABLE OUTCOME CALCULATION FUNCTIONS
-- ============================================================================

-- Fix calculate_pt_wearable_outcomes to use correct column names
CREATE OR REPLACE FUNCTION calculate_pt_wearable_outcomes(
  p_pt_assessment_id UUID,
  p_days_before INTEGER DEFAULT 7
) RETURNS UUID AS $$
DECLARE
  v_patient_id UUID;
  v_assessment_date TIMESTAMPTZ;
  v_outcome_id UUID;
  v_avg_gait_speed NUMERIC;
  v_avg_cadence INTEGER;
  v_avg_steps INTEGER;
  v_fall_count INTEGER;
BEGIN
  -- Get assessment details
  SELECT patient_id, assessment_date
  INTO v_patient_id, v_assessment_date
  FROM pt_functional_assessments
  WHERE id = p_pt_assessment_id;

  -- Calculate averages from wearable data (CORRECTED: use user_id)
  SELECT
    AVG(gait_speed_m_per_s),
    AVG(cadence)::INTEGER
  INTO v_avg_gait_speed, v_avg_cadence
  FROM wearable_gait_analysis
  WHERE user_id = v_patient_id
    AND recorded_at BETWEEN v_assessment_date - (p_days_before || ' days')::INTERVAL AND v_assessment_date;

  -- CORRECTED: use 'date' not 'activity_date'
  SELECT AVG(steps)::INTEGER
  INTO v_avg_steps
  FROM wearable_activity_data
  WHERE user_id = v_patient_id
    AND date BETWEEN (v_assessment_date::date - p_days_before) AND v_assessment_date::date;

  SELECT COUNT(*)
  INTO v_fall_count
  FROM wearable_fall_detections
  WHERE patient_id = v_patient_id
    AND fall_detected_at BETWEEN v_assessment_date - (p_days_before || ' days')::INTERVAL AND v_assessment_date;

  -- Insert outcome record
  INSERT INTO pt_wearable_enhanced_outcomes (
    pt_assessment_id,
    patient_id,
    measurement_date,
    days_before_assessment,
    avg_gait_speed_m_per_s,
    avg_cadence_steps_per_min,
    avg_daily_steps,
    fall_count,
    created_by
  ) VALUES (
    p_pt_assessment_id,
    v_patient_id,
    v_assessment_date::date,
    p_days_before,
    v_avg_gait_speed,
    v_avg_cadence,
    v_avg_steps,
    v_fall_count,
    v_patient_id
  )
  RETURNING id INTO v_outcome_id;

  RETURN v_outcome_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_pt_wearable_outcomes IS 'Automatically calculates objective mobility metrics from wearables for PT assessment (corrected column names)';

-- Fix calculate_mh_wearable_biomarkers
CREATE OR REPLACE FUNCTION calculate_mh_wearable_biomarkers(
  p_risk_assessment_id UUID,
  p_days_analyzed INTEGER DEFAULT 7
) RETURNS UUID AS $$
DECLARE
  v_patient_id UUID;
  v_assessment_date TIMESTAMPTZ;
  v_biomarker_id UUID;
  v_avg_steps INTEGER;
  v_avg_sleep NUMERIC;
  v_risk_level TEXT;
BEGIN
  -- Get assessment details
  SELECT patient_id, effective_datetime
  INTO v_patient_id, v_assessment_date
  FROM mental_health_risk_assessments
  WHERE id = p_risk_assessment_id;

  -- Calculate activity metrics (CORRECTED: use user_id and date)
  SELECT AVG(steps)::INTEGER, AVG(sleep_minutes / 60.0)
  INTO v_avg_steps, v_avg_sleep
  FROM wearable_activity_data
  WHERE user_id = v_patient_id
    AND date BETWEEN (v_assessment_date::date - p_days_analyzed) AND v_assessment_date::date;

  -- Determine biomarker risk level
  v_risk_level := CASE
    WHEN v_avg_steps < 2000 OR v_avg_sleep < 5.0 THEN 'high'
    WHEN v_avg_steps < 5000 OR v_avg_sleep < 6.5 THEN 'moderate'
    ELSE 'low'
  END;

  -- Insert biomarker record
  INSERT INTO mh_wearable_biomarkers (
    risk_assessment_id,
    patient_id,
    measurement_date,
    days_analyzed,
    avg_daily_steps,
    avg_sleep_duration_hours,
    biomarker_risk_level,
    created_by
  ) VALUES (
    p_risk_assessment_id,
    v_patient_id,
    v_assessment_date::date,
    p_days_analyzed,
    v_avg_steps,
    v_avg_sleep,
    v_risk_level,
    v_patient_id
  )
  RETURNING id INTO v_biomarker_id;

  RETURN v_biomarker_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_mh_wearable_biomarkers IS 'Automatically calculates mental health biomarkers from wearable device data (corrected column names)';

-- ============================================================================
-- SUMMARY
-- ============================================================================

COMMENT ON SCHEMA public IS 'Wearable integration views and functions corrected for actual column names (user_id, date, stride_length_cm)';
