-- ============================================================================
-- WEARABLE DEVICE INTEGRATION ENHANCEMENTS
-- ============================================================================
-- Purpose: Connect wearable device data to PT and Mental Health systems
--          Enhance gait analysis, fall detection, and activity monitoring
--          Enable real-time health data for clinical decision making
-- Author: Healthcare Integration System
-- Date: 2025-10-25
-- ============================================================================

-- ============================================================================
-- 1. PT-WEARABLE DATA INTEGRATION VIEW
-- ============================================================================
-- Link wearable gait analysis to PT functional assessments

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
    'step_length', wg.step_length_cm,
    'step_time', wg.step_time_ms,
    'cadence', wg.cadence_steps_per_min,
    'asymmetry', wg.gait_asymmetry_percentage,
    'double_support_time', wg.double_support_time_percentage
  ) ORDER BY wg.recorded_at DESC)
   FROM wearable_gait_analysis wg
   WHERE wg.patient_id = pt.patient_id
     AND wg.recorded_at BETWEEN pt.assessment_date - INTERVAL '7 days' AND pt.assessment_date
  ) as wearable_gait_data_week,

  -- Average gait metrics from wearables
  (SELECT AVG(gait_speed_m_per_s)
   FROM wearable_gait_analysis
   WHERE patient_id = pt.patient_id
     AND recorded_at BETWEEN pt.assessment_date - INTERVAL '7 days' AND pt.assessment_date
  ) as avg_gait_speed_week,

  (SELECT AVG(gait_asymmetry_percentage)
   FROM wearable_gait_analysis
   WHERE patient_id = pt.patient_id
     AND recorded_at BETWEEN pt.assessment_date - INTERVAL '7 days' AND pt.assessment_date
  ) as avg_gait_asymmetry_week,

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

COMMENT ON VIEW v_pt_wearable_gait_integration IS 'Combines PT clinical gait assessment with wearable device gait data';

-- ============================================================================
-- 2. MENTAL HEALTH - WEARABLE ACTIVITY INTEGRATION VIEW
-- ============================================================================
-- Link activity data to mental health assessments (reduced activity = depression indicator)

CREATE OR REPLACE VIEW v_mh_wearable_activity_integration AS
SELECT
  mh.id as risk_assessment_id,
  mh.patient_id,
  mh.effective_datetime,
  mh.risk_level,
  mh.phq9_score,
  mh.gad7_score,

  -- Activity data from wearables (7 days prior)
  (SELECT AVG(steps)
   FROM wearable_activity_data
   WHERE patient_id = mh.patient_id
     AND activity_date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date
  ) as avg_daily_steps_week,

  (SELECT AVG(active_minutes)
   FROM wearable_activity_data
   WHERE patient_id = mh.patient_id
     AND activity_date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date
  ) as avg_active_minutes_week,

  (SELECT AVG(sedentary_minutes)
   FROM wearable_activity_data
   WHERE patient_id = mh.patient_id
     AND activity_date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date
  ) as avg_sedentary_minutes_week,

  (SELECT AVG(sleep_duration_minutes)
   FROM wearable_activity_data
   WHERE patient_id = mh.patient_id
     AND activity_date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date
  ) as avg_sleep_duration_week,

  -- Activity trend (comparing to previous week)
  (SELECT AVG(steps)
   FROM wearable_activity_data
   WHERE patient_id = mh.patient_id
     AND activity_date BETWEEN (mh.effective_datetime::date - 14) AND (mh.effective_datetime::date - 7)
  ) as avg_daily_steps_prior_week,

  -- Calculate activity decline percentage
  CASE
    WHEN (SELECT AVG(steps) FROM wearable_activity_data
          WHERE patient_id = mh.patient_id
            AND activity_date BETWEEN (mh.effective_datetime::date - 14) AND (mh.effective_datetime::date - 7)) > 0
    THEN
      ((SELECT AVG(steps) FROM wearable_activity_data
        WHERE patient_id = mh.patient_id
          AND activity_date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date) -
       (SELECT AVG(steps) FROM wearable_activity_data
        WHERE patient_id = mh.patient_id
          AND activity_date BETWEEN (mh.effective_datetime::date - 14) AND (mh.effective_datetime::date - 7)))
      /
      (SELECT AVG(steps) FROM wearable_activity_data
       WHERE patient_id = mh.patient_id
         AND activity_date BETWEEN (mh.effective_datetime::date - 14) AND (mh.effective_datetime::date - 7))
      * 100
    ELSE NULL
  END as activity_change_percentage,

  -- Flag for significant activity decline (potential depression indicator)
  CASE
    WHEN (SELECT AVG(steps) FROM wearable_activity_data
          WHERE patient_id = mh.patient_id
            AND activity_date BETWEEN (mh.effective_datetime::date - 7) AND mh.effective_datetime::date) <
         (SELECT AVG(steps) FROM wearable_activity_data
          WHERE patient_id = mh.patient_id
            AND activity_date BETWEEN (mh.effective_datetime::date - 14) AND (mh.effective_datetime::date - 7)) * 0.5
    THEN true
    ELSE false
  END as significant_activity_decline

FROM mental_health_risk_assessments mh;

GRANT SELECT ON v_mh_wearable_activity_integration TO authenticated;

COMMENT ON VIEW v_mh_wearable_activity_integration IS 'Combines mental health assessments with wearable activity data to identify behavioral changes';

-- ============================================================================
-- 3. WEARABLE-ENHANCED PT OUTCOME MEASURES TABLE
-- ============================================================================
-- Store objective mobility metrics from wearables alongside PT assessments

CREATE TABLE IF NOT EXISTS pt_wearable_enhanced_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Links
  pt_assessment_id UUID REFERENCES pt_functional_assessments(id) ON DELETE CASCADE,
  pt_outcome_measure_id UUID REFERENCES pt_outcome_measures(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Time Period
  measurement_date DATE NOT NULL,
  days_before_assessment INTEGER, -- 7, 14, 30
  days_after_assessment INTEGER,

  -- Wearable Gait Metrics (Averaged)
  avg_gait_speed_m_per_s NUMERIC(5,2),
  avg_cadence_steps_per_min INTEGER,
  avg_step_length_cm NUMERIC(5,1),
  avg_gait_asymmetry_percentage NUMERIC(5,2),

  -- Activity Metrics
  avg_daily_steps INTEGER,
  avg_active_minutes INTEGER,
  total_distance_meters INTEGER,

  -- Fall Risk
  fall_count INTEGER DEFAULT 0,
  near_fall_count INTEGER DEFAULT 0,

  -- Quality Indicators
  data_completeness_percentage INTEGER, -- % of days with data
  device_wear_time_minutes_avg INTEGER,

  -- Clinical Correlation
  correlates_with_pt_assessment BOOLEAN,
  variance_from_clinical_assessment TEXT, -- 'aligned', 'overestimated', 'underestimated'
  clinical_notes TEXT,

  -- Metadata
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_pt_wearable_outcomes_assessment ON pt_wearable_enhanced_outcomes(pt_assessment_id);
CREATE INDEX idx_pt_wearable_outcomes_patient ON pt_wearable_enhanced_outcomes(patient_id);
CREATE INDEX idx_pt_wearable_outcomes_date ON pt_wearable_enhanced_outcomes(measurement_date DESC);

COMMENT ON TABLE pt_wearable_enhanced_outcomes IS 'Objective mobility outcomes from wearables to supplement PT clinical assessments';

-- ============================================================================
-- 4. MENTAL HEALTH WEARABLE BIOMARKERS TABLE
-- ============================================================================
-- Track physiological markers related to mental health

CREATE TABLE IF NOT EXISTS mh_wearable_biomarkers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Links
  risk_assessment_id UUID REFERENCES mental_health_risk_assessments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Time Period
  measurement_date DATE NOT NULL,
  days_analyzed INTEGER DEFAULT 7,

  -- Heart Rate Variability (HRV) - stress indicator
  avg_hrv_ms NUMERIC(6,2),
  hrv_trend TEXT CHECK (hrv_trend IN ('improving', 'stable', 'declining')),

  -- Resting Heart Rate - anxiety/depression marker
  avg_resting_hr INTEGER,
  rhr_trend TEXT CHECK (rhr_trend IN ('increasing', 'stable', 'decreasing')),

  -- Sleep Quality - depression indicator
  avg_sleep_duration_hours NUMERIC(4,2),
  avg_sleep_efficiency_percentage NUMERIC(5,2),
  sleep_disruptions_per_night NUMERIC(4,1),
  sleep_trend TEXT CHECK (sleep_trend IN ('improving', 'stable', 'worsening')),

  -- Activity/Energy Level
  avg_daily_steps INTEGER,
  activity_variability_coefficient NUMERIC(5,3), -- Day-to-day consistency
  sedentary_time_hours NUMERIC(4,1),

  -- Circadian Rhythm Indicators
  sleep_wake_consistency_score NUMERIC(3,1), -- 0-10 scale
  irregular_sleep_pattern BOOLEAN,

  -- Social Interaction Proxy (if device tracks location patterns)
  unique_locations_visited INTEGER,
  time_away_from_home_hours NUMERIC(5,1),

  -- Clinical Interpretation
  biomarker_risk_level TEXT CHECK (biomarker_risk_level IN ('low', 'moderate', 'high')),
  interpretation_notes TEXT,
  aligns_with_self_report BOOLEAN,

  -- Metadata
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_mh_biomarkers_assessment ON mh_wearable_biomarkers(risk_assessment_id);
CREATE INDEX idx_mh_biomarkers_patient ON mh_wearable_biomarkers(patient_id);
CREATE INDEX idx_mh_biomarkers_date ON mh_wearable_biomarkers(measurement_date DESC);
CREATE INDEX idx_mh_biomarkers_risk ON mh_wearable_biomarkers(biomarker_risk_level);

COMMENT ON TABLE mh_wearable_biomarkers IS 'Physiological biomarkers from wearables to supplement mental health clinical assessments';

-- ============================================================================
-- 5. FUNCTION: Auto-calculate PT wearable outcomes
-- ============================================================================

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

  -- Calculate averages from wearable data
  SELECT
    AVG(gait_speed_m_per_s),
    AVG(cadence_steps_per_min)::INTEGER
  INTO v_avg_gait_speed, v_avg_cadence
  FROM wearable_gait_analysis
  WHERE patient_id = v_patient_id
    AND recorded_at BETWEEN v_assessment_date - (p_days_before || ' days')::INTERVAL AND v_assessment_date;

  SELECT AVG(steps)::INTEGER
  INTO v_avg_steps
  FROM wearable_activity_data
  WHERE patient_id = v_patient_id
    AND activity_date BETWEEN (v_assessment_date::date - p_days_before) AND v_assessment_date::date;

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

COMMENT ON FUNCTION calculate_pt_wearable_outcomes IS 'Automatically calculates objective mobility metrics from wearables for PT assessment';

-- ============================================================================
-- 6. FUNCTION: Auto-calculate MH wearable biomarkers
-- ============================================================================

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

  -- Calculate activity metrics
  SELECT AVG(steps)::INTEGER, AVG(sleep_duration_minutes / 60.0)
  INTO v_avg_steps, v_avg_sleep
  FROM wearable_activity_data
  WHERE patient_id = v_patient_id
    AND activity_date BETWEEN (v_assessment_date::date - p_days_analyzed) AND v_assessment_date::date;

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

COMMENT ON FUNCTION calculate_mh_wearable_biomarkers IS 'Automatically calculates mental health biomarkers from wearable device data';

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE pt_wearable_enhanced_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_wearable_biomarkers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PT staff can view wearable outcomes"
  ON pt_wearable_enhanced_outcomes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 99, 100, 101, 102, 103, 104)
    )
  );

CREATE POLICY "PT staff can manage wearable outcomes"
  ON pt_wearable_enhanced_outcomes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 99, 100, 101)
    )
  );

CREATE POLICY "MH staff can view biomarkers"
  ON mh_wearable_biomarkers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10)
    )
  );

CREATE POLICY "MH staff can manage biomarkers"
  ON mh_wearable_biomarkers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 9, 10)
    )
  );

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON pt_wearable_enhanced_outcomes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON mh_wearable_biomarkers TO authenticated;

-- ============================================================================
-- 9. SUMMARY
-- ============================================================================

COMMENT ON SCHEMA public IS 'Wearable device data now integrated with PT and Mental Health clinical assessments for objective outcome tracking';
