-- ============================================================================
-- AUTOMATIC REFERRAL TRIGGERS
-- ============================================================================
-- Purpose: Automatically create cross-system referrals based on clinical events
--          Enable seamless patient handoffs between disciplines
-- Author: Healthcare Integration System
-- Date: 2025-10-25
-- ============================================================================

-- ============================================================================
-- 1. STROKE ASSESSMENT → PT REFERRAL TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_stroke_to_pt_referral()
RETURNS TRIGGER AS $$
DECLARE
  v_motor_deficit BOOLEAN;
  v_referral_id UUID;
  v_therapist_id UUID;
BEGIN
  -- Check if this is a baseline stroke assessment with motor deficits
  IF NEW.assessment_type = 'baseline' THEN
    -- Determine if patient has motor deficits
    v_motor_deficit := (
      COALESCE(NEW.left_arm_motor_score, 0) >= 1 OR
      COALESCE(NEW.right_arm_motor_score, 0) >= 1 OR
      COALESCE(NEW.left_leg_motor_score, 0) >= 1 OR
      COALESCE(NEW.right_leg_motor_score, 0) >= 1
    );

    -- If motor deficits present, create PT referral
    IF v_motor_deficit THEN
      -- Get an available PT (role_id 99 or 101)
      SELECT user_id INTO v_therapist_id
      FROM profiles
      WHERE role_id IN (99, 101)
      ORDER BY RANDOM()
      LIMIT 1;

      -- Create cross-system referral
      INSERT INTO cross_system_referrals (
        patient_id,
        source_system,
        source_record_id,
        source_record_type,
        referring_provider_id,
        target_system,
        target_provider_id,
        referral_type,
        referral_reason,
        clinical_indication,
        urgency,
        auto_created,
        auto_creation_rule,
        relevant_diagnoses,
        functional_status_summary,
        discharge_dependent,
        created_by
      ) VALUES (
        NEW.patient_id,
        'neurosuite',
        NEW.id,
        'stroke_assessment',
        NEW.assessor_id,
        'pt_suite',
        v_therapist_id,
        'initial_evaluation',
        'Stroke patient with motor deficits requiring physical therapy evaluation',
        'Patient has acute stroke with motor weakness. NIHSS total score: ' || COALESCE(NEW.nihss_total_score::TEXT, 'N/A') ||
        '. Motor scores: Left arm=' || COALESCE(NEW.left_arm_motor_score::TEXT, '0') ||
        ', Right arm=' || COALESCE(NEW.right_arm_motor_score::TEXT, '0') ||
        ', Left leg=' || COALESCE(NEW.left_leg_motor_score::TEXT, '0') ||
        ', Right leg=' || COALESCE(NEW.right_leg_motor_score::TEXT, '0') ||
        '. Please evaluate for mobility, transfers, and ADL training.',
        'urgent',
        true,
        'stroke_motor_deficit_to_pt',
        ARRAY['I63.9 - Cerebral infarction', NEW.stroke_type],
        'Acute stroke with motor deficits - NIHSS ' || COALESCE(NEW.nihss_total_score::TEXT, 'N/A'),
        true,
        NEW.assessor_id
      ) RETURNING id INTO v_referral_id;

      RAISE NOTICE 'Auto-created PT referral % for stroke patient %', v_referral_id, NEW.patient_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stroke_assessment_auto_referral
  AFTER INSERT ON neuro_stroke_assessments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_stroke_to_pt_referral();

-- ============================================================================
-- 2. STROKE ASSESSMENT → MENTAL HEALTH REFERRAL TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_stroke_to_mh_referral()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_id UUID;
  v_therapist_id UUID;
BEGIN
  -- All baseline stroke assessments trigger mental health screening
  IF NEW.assessment_type = 'baseline' THEN
    -- Get an available mental health provider (role_id 9 or 10)
    SELECT user_id INTO v_therapist_id
    FROM profiles
    WHERE role_id IN (9, 10)
    ORDER BY RANDOM()
    LIMIT 1;

    -- Create mental health referral
    INSERT INTO cross_system_referrals (
      patient_id,
      source_system,
      source_record_id,
      source_record_type,
      referring_provider_id,
      target_system,
      target_provider_id,
      referral_type,
      referral_reason,
      clinical_indication,
      urgency,
      auto_created,
      auto_creation_rule,
      relevant_diagnoses,
      functional_status_summary,
      discharge_dependent,
      created_by
    ) VALUES (
      NEW.patient_id,
      'neurosuite',
      NEW.id,
      'stroke_assessment',
      NEW.assessor_id,
      'mental_health',
      v_therapist_id,
      'initial_evaluation',
      'Stroke patient requiring mental health screening for adjustment disorder',
      'Patient has experienced acute stroke, a life-altering medical event. Stroke severity: ' ||
      COALESCE(NEW.nihss_severity, 'unknown') || ' (NIHSS ' || COALESCE(NEW.nihss_total_score::TEXT, 'N/A') || '). ' ||
      'Please screen for depression, anxiety, and adjustment disorder per Joint Commission standards. ' ||
      'Provide supportive counseling as needed.',
      'routine',
      true,
      'stroke_to_mental_health',
      ARRAY['I63.9 - Cerebral infarction', 'F43.2 - Adjustment disorder'],
      'New stroke diagnosis - heightened suicide risk per clinical evidence',
      true,
      NEW.assessor_id
    ) RETURNING id INTO v_referral_id;

    -- Also create mental health service request directly
    INSERT INTO mental_health_service_requests (
      patient_id,
      status,
      priority,
      code,
      code_display,
      category,
      requester_id,
      reason_code,
      reason_display,
      session_type,
      total_sessions_required,
      is_discharge_blocker,
      discharge_blocker_active,
      created_by
    ) VALUES (
      NEW.patient_id,
      'active',
      'routine',
      '385893002',
      'Mental Health Assessment - Adjustment to Medical Condition',
      ARRAY['mental-health', 'adjustment-disorder', 'stroke-related'],
      NEW.assessor_id,
      ARRAY['I63.9', 'F43.2'],
      ARRAY['Cerebral infarction', 'Adjustment disorder with mixed anxiety and depressed mood'],
      'inpatient',
      3,
      true,
      true,
      NEW.assessor_id
    );

    RAISE NOTICE 'Auto-created Mental Health referral % for stroke patient %', v_referral_id, NEW.patient_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stroke_assessment_mh_auto_referral
  AFTER INSERT ON neuro_stroke_assessments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_stroke_to_mh_referral();

-- ============================================================================
-- 3. HIGH PHQ-9 IN PT → MENTAL HEALTH REFERRAL TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_pt_high_phq9_to_mh()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_id UUID;
  v_mh_provider_id UUID;
BEGIN
  -- Check if this is a PHQ-9 outcome measure with score >= 15
  IF NEW.measure_acronym = 'PHQ-9' AND NEW.raw_score >= 15 THEN
    -- Check if referral doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM cross_system_referrals
      WHERE patient_id = NEW.patient_id
        AND source_system = 'pt_suite'
        AND target_system = 'mental_health'
        AND status IN ('pending', 'accepted')
        AND created_at > NOW() - INTERVAL '30 days'
    ) THEN
      -- Get mental health provider
      SELECT user_id INTO v_mh_provider_id
      FROM profiles
      WHERE role_id IN (9, 10)
      ORDER BY RANDOM()
      LIMIT 1;

      -- Create referral
      INSERT INTO cross_system_referrals (
        patient_id,
        source_system,
        source_record_id,
        source_record_type,
        referring_provider_id,
        target_system,
        target_provider_id,
        referral_type,
        referral_reason,
        clinical_indication,
        urgency,
        auto_created,
        auto_creation_rule,
        relevant_diagnoses,
        functional_status_summary,
        discharge_dependent,
        specific_questions,
        created_by
      ) VALUES (
        NEW.patient_id,
        'pt_suite',
        NEW.id,
        'pt_outcome_measure',
        NEW.therapist_id,
        'mental_health',
        v_mh_provider_id,
        'consultation',
        'PT patient with moderately severe depression (PHQ-9 >= 15)',
        'Patient undergoing physical therapy has screened positive for moderately severe depression. ' ||
        'PHQ-9 score: ' || NEW.raw_score || '/27. ' ||
        'Please evaluate for major depressive disorder and provide appropriate interventions. ' ||
        'Depression may be impacting rehabilitation progress.',
        'urgent',
        true,
        'pt_high_phq9_to_mental_health',
        ARRAY['F33.1 - Major depressive disorder, recurrent, moderate'],
        'Undergoing PT for ' || COALESCE((SELECT clinical_impression FROM pt_functional_assessments
                                          WHERE patient_id = NEW.patient_id
                                          ORDER BY assessment_date DESC LIMIT 1), 'condition'),
        false,
        'Is depression interfering with PT participation? Should antidepressant therapy be considered?',
        NEW.therapist_id
      ) RETURNING id INTO v_referral_id;

      RAISE NOTICE 'Auto-created MH referral % for PT patient % with PHQ-9=%', v_referral_id, NEW.patient_id, NEW.raw_score;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pt_outcome_measure_mh_auto_referral
  AFTER INSERT ON pt_outcome_measures
  FOR EACH ROW
  EXECUTE FUNCTION trigger_pt_high_phq9_to_mh();

-- ============================================================================
-- 4. HIGH CAREGIVER BURDEN → MENTAL HEALTH + SOCIAL WORK
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_caregiver_burden_referrals()
RETURNS TRIGGER AS $$
DECLARE
  v_mh_referral_id UUID;
  v_sw_referral_id UUID;
BEGIN
  -- High caregiver burden (Zarit >= 21)
  IF NEW.burden_level IN ('mild_moderate_burden', 'moderate_severe_burden') THEN
    -- Mental health referral for caregiver
    INSERT INTO cross_system_referrals (
      patient_id,
      source_system,
      source_record_id,
      source_record_type,
      referring_provider_id,
      target_system,
      referral_type,
      referral_reason,
      clinical_indication,
      urgency,
      auto_created,
      auto_creation_rule,
      functional_status_summary,
      specific_questions,
      created_by
    ) VALUES (
      NEW.patient_id,
      'neurosuite',
      NEW.id,
      'caregiver_assessment',
      NEW.assessor_id,
      'mental_health',
      'consultation',
      'Caregiver experiencing high burden - mental health support needed',
      'Caregiver of patient is experiencing ' || NEW.burden_level || ' (Zarit total: ' || NEW.zbi_total_score || '/48). ' ||
      'Caregiver provides ' || COALESCE(NEW.hours_caregiving_per_week::TEXT, 'many') || ' hours per week of care. ' ||
      'Please evaluate for depression, anxiety, and provide supportive counseling. Consider caregiver support groups.',
      CASE WHEN NEW.zbi_total_score >= 36 THEN 'urgent' ELSE 'routine' END,
      true,
      'high_caregiver_burden_to_mh',
      'Caregiving for patient with ' || COALESCE((SELECT care_plan_type FROM neuro_care_plans
                                                   WHERE patient_id = NEW.patient_id AND status = 'active'
                                                   ORDER BY created_at DESC LIMIT 1)::TEXT, 'neurological condition'),
      'Is caregiver at risk for depression? What resources can reduce burden?',
      NEW.assessor_id
    ) RETURNING id INTO v_mh_referral_id;

    -- Social work referral for respite care, resources
    INSERT INTO cross_system_referrals (
      patient_id,
      source_system,
      source_record_id,
      source_record_type,
      referring_provider_id,
      target_system,
      referral_type,
      referral_reason,
      clinical_indication,
      urgency,
      auto_created,
      auto_creation_rule,
      specific_questions,
      created_by
    ) VALUES (
      NEW.patient_id,
      'neurosuite',
      NEW.id,
      'caregiver_assessment',
      NEW.assessor_id,
      'social_work',
      'consultation',
      'Caregiver support needed - respite care, resources, financial assistance',
      'Caregiver is experiencing high burden (Zarit: ' || NEW.zbi_total_score || '). ' ||
      CASE WHEN NEW.respite_care_needed THEN 'Respite care requested. ' ELSE '' END ||
      CASE WHEN NEW.financial_assistance_needed THEN 'Financial assistance requested. ' ELSE '' END ||
      CASE WHEN NEW.support_group_interest THEN 'Interested in support groups. ' ELSE '' END ||
      'Please provide community resources, respite care options, and financial counseling.',
      'routine',
      true,
      'high_caregiver_burden_to_sw',
      'What respite care options are available? Are there caregiver support groups? Financial assistance programs?',
      NEW.assessor_id
    ) RETURNING id INTO v_sw_referral_id;

    RAISE NOTICE 'Auto-created caregiver burden referrals (MH:%, SW:%) for patient %', v_mh_referral_id, v_sw_referral_id, NEW.patient_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER caregiver_assessment_auto_referrals
  AFTER INSERT ON neuro_caregiver_assessments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_caregiver_burden_referrals();

-- ============================================================================
-- 5. DEMENTIA DIAGNOSIS → SOCIAL WORK REFERRAL
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_dementia_to_social_work()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_id UUID;
BEGIN
  -- New dementia diagnosis (CDR >= 1.0)
  IF NEW.cdr_global_score >= 1.0 THEN
    INSERT INTO cross_system_referrals (
      patient_id,
      source_system,
      source_record_id,
      source_record_type,
      referring_provider_id,
      target_system,
      referral_type,
      referral_reason,
      clinical_indication,
      urgency,
      auto_created,
      auto_creation_rule,
      functional_status_summary,
      specific_questions,
      created_by
    ) VALUES (
      NEW.patient_id,
      'neurosuite',
      NEW.id,
      'dementia_staging',
      NEW.assessor_id,
      'social_work',
      'consultation',
      'New dementia diagnosis - caregiver support and resources needed',
      'Patient has been diagnosed with dementia. CDR Global Score: ' || NEW.cdr_global_score ||
      ' (' || NEW.dementia_stage || '). CDR Sum of Boxes: ' || NEW.cdr_sum_boxes || '. ' ||
      'Please provide caregiver education, community resources (adult day care, Alzheimer''s Association), ' ||
      'respite care options, long-term care planning, and advance directive planning assistance.',
      'routine',
      true,
      'dementia_to_social_work',
      'Dementia stage: ' || NEW.dementia_stage,
      'What caregiver education is available? Adult day care options? Long-term care planning resources?',
      NEW.assessor_id
    ) RETURNING id INTO v_referral_id;

    RAISE NOTICE 'Auto-created social work referral % for dementia patient %', v_referral_id, NEW.patient_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dementia_staging_auto_referral
  AFTER INSERT ON neuro_dementia_staging
  FOR EACH ROW
  EXECUTE FUNCTION trigger_dementia_to_social_work();

-- ============================================================================
-- 6. FUNCTION: Manually trigger referral creation from rules
-- ============================================================================

CREATE OR REPLACE FUNCTION manually_trigger_referral_rule(
  p_rule_name TEXT,
  p_patient_id UUID,
  p_source_record_id UUID,
  p_created_by UUID
) RETURNS UUID AS $$
DECLARE
  v_rule RECORD;
  v_referral_id UUID;
  v_target_provider_id UUID;
BEGIN
  -- Get rule
  SELECT * INTO v_rule
  FROM referral_auto_creation_rules
  WHERE rule_name = p_rule_name
    AND is_active = true;

  IF v_rule IS NULL THEN
    RAISE EXCEPTION 'Rule % not found or not active', p_rule_name;
  END IF;

  -- Get target provider
  SELECT user_id INTO v_target_provider_id
  FROM profiles
  WHERE CASE v_rule.target_system
    WHEN 'pt_suite' THEN role_id IN (99, 101)
    WHEN 'mental_health' THEN role_id IN (9, 10)
    WHEN 'social_work' THEN role_id = 10
    ELSE true
  END
  ORDER BY RANDOM()
  LIMIT 1;

  -- Create referral
  INSERT INTO cross_system_referrals (
    patient_id,
    source_system,
    source_record_id,
    target_system,
    target_provider_id,
    referral_type,
    referral_reason,
    clinical_indication,
    urgency,
    auto_created,
    auto_creation_rule,
    discharge_dependent,
    created_by
  ) VALUES (
    p_patient_id,
    v_rule.trigger_system,
    p_source_record_id,
    v_rule.target_system,
    v_target_provider_id,
    v_rule.referral_type,
    v_rule.reason_template,
    v_rule.clinical_indication_template,
    v_rule.urgency,
    false, -- Manual trigger
    p_rule_name,
    v_rule.discharge_dependent,
    p_created_by
  ) RETURNING id INTO v_referral_id;

  -- Update rule stats
  UPDATE referral_auto_creation_rules
  SET
    last_triggered_at = NOW(),
    trigger_count = trigger_count + 1
  WHERE rule_name = p_rule_name;

  RETURN v_referral_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION manually_trigger_referral_rule IS 'Manually trigger a referral based on an auto-creation rule';

-- ============================================================================
-- 7. SUMMARY
-- ============================================================================

COMMENT ON SCHEMA public IS 'Auto-referral triggers now active: Stroke→PT, Stroke→MH, PT High Depression→MH, High Caregiver Burden→MH+SW, Dementia→SW';
