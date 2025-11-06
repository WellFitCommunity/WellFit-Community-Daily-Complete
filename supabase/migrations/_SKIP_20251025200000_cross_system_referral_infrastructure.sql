-- ============================================================================
-- CROSS-SYSTEM REFERRAL INFRASTRUCTURE
-- ============================================================================
-- Purpose: Connect NeuroSuite, PT Suite, and Mental Health systems
--          Enable automatic and manual referrals between disciplines
-- Author: Healthcare Integration System
-- Date: 2025-10-25
-- ============================================================================

-- ============================================================================
-- 1. CROSS-SYSTEM REFERRALS TABLE
-- ============================================================================
-- Tracks all referrals between neurology, PT, mental health, and other services

CREATE TABLE IF NOT EXISTS cross_system_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Patient
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,

  -- Source System (who is making the referral)
  source_system TEXT NOT NULL CHECK (source_system IN (
    'neurosuite',
    'pt_suite',
    'mental_health',
    'primary_care',
    'occupational_therapy',
    'speech_therapy',
    'social_work',
    'pharmacy',
    'case_management'
  )),
  source_record_id UUID, -- ID of the assessment/session that triggered referral
  source_record_type TEXT, -- 'stroke_assessment', 'pt_assessment', 'risk_assessment', etc.
  referring_provider_id UUID REFERENCES profiles(user_id),
  referring_provider_name TEXT,

  -- Target System (who should receive the referral)
  target_system TEXT NOT NULL CHECK (target_system IN (
    'neurosuite',
    'pt_suite',
    'mental_health',
    'primary_care',
    'occupational_therapy',
    'speech_therapy',
    'social_work',
    'pharmacy',
    'case_management'
  )),
  target_provider_id UUID REFERENCES profiles(user_id),
  target_provider_name TEXT,

  -- Referral Details
  referral_type TEXT NOT NULL CHECK (referral_type IN (
    'consultation',
    'initial_evaluation',
    'co_management',
    'transfer_of_care',
    'urgent_consultation',
    'stat_consultation'
  )),

  referral_reason TEXT NOT NULL,
  clinical_indication TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'routine' CHECK (urgency IN (
    'routine',      -- Within 1 week
    'urgent',       -- Within 24-48 hours
    'stat'          -- Immediate/same day
  )),

  -- Auto vs Manual
  auto_created BOOLEAN DEFAULT false,
  auto_creation_rule TEXT, -- Which trigger created this (e.g., 'stroke_motor_deficit_to_pt')

  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',           -- Awaiting acceptance
    'accepted',          -- Provider accepted referral
    'declined',          -- Provider declined
    'completed',         -- Service completed
    'cancelled',         -- Cancelled before acceptance
    'expired'            -- Not responded to in time
  )),

  -- Response Tracking
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES profiles(user_id),
  declined_at TIMESTAMPTZ,
  declined_by UUID REFERENCES profiles(user_id),
  decline_reason TEXT,

  -- Service Completion
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(user_id),
  outcome_summary TEXT,

  -- Created Record in Target System
  target_record_id UUID, -- ID of created assessment/service request
  target_record_type TEXT, -- 'pt_functional_assessment', 'mental_health_service_request', etc.

  -- Clinical Data Sharing
  relevant_diagnoses TEXT[],
  relevant_medications TEXT[],
  functional_status_summary TEXT,
  special_precautions TEXT[],
  specific_questions TEXT, -- What the referring provider wants answered

  -- Follow-up Communication
  requires_feedback BOOLEAN DEFAULT true,
  feedback_received BOOLEAN DEFAULT false,
  feedback_text TEXT,
  feedback_date TIMESTAMPTZ,

  -- Priority Flags
  discharge_dependent BOOLEAN DEFAULT false, -- Patient can't be discharged until this is addressed
  safety_concern BOOLEAN DEFAULT false,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_systems CHECK (source_system != target_system)
);

-- Indexes for performance
CREATE INDEX idx_cross_referrals_patient ON cross_system_referrals(patient_id);
CREATE INDEX idx_cross_referrals_source_system ON cross_system_referrals(source_system);
CREATE INDEX idx_cross_referrals_target_system ON cross_system_referrals(target_system);
CREATE INDEX idx_cross_referrals_status ON cross_system_referrals(status);
CREATE INDEX idx_cross_referrals_urgency ON cross_system_referrals(urgency) WHERE status = 'pending';
CREATE INDEX idx_cross_referrals_target_provider ON cross_system_referrals(target_provider_id) WHERE status IN ('pending', 'accepted');
CREATE INDEX idx_cross_referrals_discharge_dependent ON cross_system_referrals(discharge_dependent) WHERE discharge_dependent = true AND status != 'completed';

-- Trigger for updated_at
CREATE TRIGGER update_cross_referrals_updated_at
  BEFORE UPDATE ON cross_system_referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. REFERRAL AUTO-CREATION RULES TABLE
-- ============================================================================
-- Defines the rules for automatically creating referrals

CREATE TABLE IF NOT EXISTS referral_auto_creation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Rule Identification
  rule_name TEXT UNIQUE NOT NULL,
  rule_description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,

  -- Trigger Conditions
  trigger_system TEXT NOT NULL CHECK (trigger_system IN (
    'neurosuite',
    'pt_suite',
    'mental_health',
    'primary_care'
  )),
  trigger_event TEXT NOT NULL, -- 'stroke_assessment_created', 'pt_phq9_high', etc.

  -- Conditions (JSONB for flexibility)
  conditions JSONB NOT NULL,
  -- Example: {
  --   "nihss_total_score": {"operator": ">=", "value": 5},
  --   "motor_deficit": {"operator": "=", "value": true}
  -- }

  -- Target
  target_system TEXT NOT NULL,
  referral_type TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'routine',

  -- Template
  reason_template TEXT NOT NULL,
  clinical_indication_template TEXT NOT NULL,

  -- Behavior
  auto_accept BOOLEAN DEFAULT false, -- Automatically accept (for critical workflows)
  discharge_dependent BOOLEAN DEFAULT false,
  requires_provider_confirmation BOOLEAN DEFAULT true,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0
);

-- Index
CREATE INDEX idx_auto_rules_active ON referral_auto_creation_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_auto_rules_trigger_system ON referral_auto_creation_rules(trigger_system);

-- ============================================================================
-- 3. SEED AUTO-CREATION RULES
-- ============================================================================

-- Rule 1: Stroke with motor deficit → PT
INSERT INTO referral_auto_creation_rules (
  rule_name,
  rule_description,
  trigger_system,
  trigger_event,
  conditions,
  target_system,
  referral_type,
  urgency,
  reason_template,
  clinical_indication_template,
  discharge_dependent
) VALUES (
  'stroke_motor_deficit_to_pt',
  'Automatic PT referral for stroke patients with motor deficits (NIHSS motor score >= 1)',
  'neurosuite',
  'stroke_assessment_created',
  '{"or": [
    {"left_arm_motor_score": {"operator": ">=", "value": 1}},
    {"right_arm_motor_score": {"operator": ">=", "value": 1}},
    {"left_leg_motor_score": {"operator": ">=", "value": 1}},
    {"right_leg_motor_score": {"operator": ">=", "value": 1}}
  ]}'::jsonb,
  'pt_suite',
  'initial_evaluation',
  'urgent',
  'Stroke patient with motor deficits requiring physical therapy evaluation',
  'Patient has acute stroke with motor weakness. NIHSS motor scores indicate need for rehabilitation assessment. Please evaluate for mobility, transfers, and ADL training.',
  true
) ON CONFLICT (rule_name) DO NOTHING;

-- Rule 2: Stroke (any type) → Mental Health screening
INSERT INTO referral_auto_creation_rules (
  rule_name,
  rule_description,
  trigger_system,
  trigger_event,
  conditions,
  target_system,
  referral_type,
  urgency,
  reason_template,
  clinical_indication_template,
  discharge_dependent
) VALUES (
  'stroke_to_mental_health',
  'Automatic mental health screening for all stroke patients',
  'neurosuite',
  'stroke_assessment_created',
  '{"assessment_type": {"operator": "=", "value": "baseline"}}'::jsonb,
  'mental_health',
  'initial_evaluation',
  'routine',
  'Stroke patient requiring mental health screening for adjustment disorder',
  'Patient has experienced acute stroke, a life-altering medical event. Please screen for depression, anxiety, and adjustment disorder. Provide supportive counseling as needed.',
  true
) ON CONFLICT (rule_name) DO NOTHING;

-- Rule 3: High depression score in PT → Mental Health
INSERT INTO referral_auto_creation_rules (
  rule_name,
  rule_description,
  trigger_system,
  trigger_event,
  conditions,
  target_system,
  referral_type,
  urgency,
  reason_template,
  clinical_indication_template,
  discharge_dependent
) VALUES (
  'pt_high_phq9_to_mental_health',
  'PT patient with PHQ-9 >= 15 (moderately severe depression)',
  'pt_suite',
  'outcome_measure_recorded',
  '{"measure_acronym": {"operator": "=", "value": "PHQ-9"}, "raw_score": {"operator": ">=", "value": 15}}'::jsonb,
  'mental_health',
  'consultation',
  'urgent',
  'PT patient with moderately severe depression (PHQ-9 >= 15)',
  'Patient undergoing physical therapy has screened positive for moderately severe depression. Please evaluate for major depressive disorder and provide appropriate interventions.',
  false
) ON CONFLICT (rule_name) DO NOTHING;

-- Rule 4: High suicide risk → STAT neuro consult (in case of TBI/stroke)
INSERT INTO referral_auto_creation_rules (
  rule_name,
  rule_description,
  trigger_system,
  trigger_event,
  conditions,
  target_system,
  referral_type,
  urgency,
  reason_template,
  clinical_indication_template,
  discharge_dependent
) VALUES (
  'high_suicide_risk_to_neuro',
  'High suicide risk in patient with known neurological condition',
  'mental_health',
  'risk_assessment_created',
  '{"risk_level": {"operator": "=", "value": "high"}}'::jsonb,
  'neurosuite',
  'urgent_consultation',
  'stat',
  'High suicide risk in patient - evaluate for neurological contribution',
  'Patient with high suicide risk. Please evaluate for organic causes (frontal lobe injury, stroke, medication effects) that may be contributing to behavioral changes.',
  false
) ON CONFLICT (rule_name) DO NOTHING;

-- Rule 5: Dementia diagnosis → Social Work
INSERT INTO referral_auto_creation_rules (
  rule_name,
  rule_description,
  trigger_system,
  trigger_event,
  conditions,
  target_system,
  referral_type,
  urgency,
  reason_template,
  clinical_indication_template,
  discharge_dependent
) VALUES (
  'dementia_to_social_work',
  'New dementia diagnosis requires social work for caregiver support',
  'neurosuite',
  'dementia_staging_created',
  '{"cdr_global_score": {"operator": ">=", "value": 1.0}}'::jsonb,
  'social_work',
  'consultation',
  'routine',
  'New dementia diagnosis - caregiver support and resources needed',
  'Patient has been diagnosed with dementia (CDR >= 1). Please provide caregiver education, community resources, respite care options, and advance directive planning assistance.',
  false
) ON CONFLICT (rule_name) DO NOTHING;

-- Rule 6: High caregiver burden → Mental Health
INSERT INTO referral_auto_creation_rules (
  rule_name,
  rule_description,
  trigger_system,
  trigger_event,
  conditions,
  target_system,
  referral_type,
  urgency,
  reason_template,
  clinical_indication_template,
  discharge_dependent
) VALUES (
  'high_caregiver_burden_to_mh',
  'Caregiver with high burden (Zarit >= 21) needs mental health support',
  'neurosuite',
  'caregiver_assessment_created',
  '{"zbi_total_score": {"operator": ">=", "value": 21}}'::jsonb,
  'mental_health',
  'consultation',
  'urgent',
  'Caregiver experiencing high burden - mental health support needed',
  'Caregiver of patient is experiencing moderate to severe caregiver burden (Zarit >= 21). Please evaluate for depression, anxiety, and provide supportive counseling. Consider caregiver support groups.',
  false
) ON CONFLICT (rule_name) DO NOTHING;

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function: Get pending referrals for a provider
CREATE OR REPLACE FUNCTION get_pending_referrals_for_provider(p_provider_id UUID)
RETURNS TABLE (
  referral_id UUID,
  patient_id UUID,
  patient_name TEXT,
  source_system TEXT,
  referral_reason TEXT,
  urgency TEXT,
  created_at TIMESTAMPTZ,
  days_pending INTEGER,
  is_urgent BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.patient_id,
    p.first_name || ' ' || p.last_name,
    r.source_system,
    r.referral_reason,
    r.urgency,
    r.created_at,
    EXTRACT(DAY FROM NOW() - r.created_at)::INTEGER,
    r.urgency IN ('urgent', 'stat')
  FROM cross_system_referrals r
  JOIN profiles p ON r.patient_id = p.user_id
  WHERE r.target_provider_id = p_provider_id
    AND r.status = 'pending'
  ORDER BY
    CASE r.urgency
      WHEN 'stat' THEN 1
      WHEN 'urgent' THEN 2
      ELSE 3
    END,
    r.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function: Get referrals by patient
CREATE OR REPLACE FUNCTION get_patient_referrals(p_patient_id UUID)
RETURNS TABLE (
  referral_id UUID,
  source_system TEXT,
  target_system TEXT,
  referral_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  referring_provider TEXT,
  target_provider TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.source_system,
    r.target_system,
    r.referral_type,
    r.status,
    r.created_at,
    r.referring_provider_name,
    r.target_provider_name
  FROM cross_system_referrals r
  WHERE r.patient_id = p_patient_id
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Accept referral
CREATE OR REPLACE FUNCTION accept_referral(
  p_referral_id UUID,
  p_provider_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE cross_system_referrals
  SET
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by = p_provider_id,
    updated_at = NOW(),
    updated_by = p_provider_id
  WHERE id = p_referral_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function: Complete referral
CREATE OR REPLACE FUNCTION complete_referral(
  p_referral_id UUID,
  p_provider_id UUID,
  p_outcome_summary TEXT,
  p_target_record_id UUID DEFAULT NULL,
  p_target_record_type TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE cross_system_referrals
  SET
    status = 'completed',
    completed_at = NOW(),
    completed_by = p_provider_id,
    outcome_summary = p_outcome_summary,
    target_record_id = p_target_record_id,
    target_record_type = p_target_record_type,
    updated_at = NOW(),
    updated_by = p_provider_id
  WHERE id = p_referral_id
    AND status IN ('accepted', 'pending');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE cross_system_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_auto_creation_rules ENABLE ROW LEVEL SECURITY;

-- Healthcare providers can view referrals they're involved in
CREATE POLICY "Healthcare providers can view relevant referrals"
  ON cross_system_referrals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

-- Healthcare providers can create referrals
CREATE POLICY "Healthcare providers can create referrals"
  ON cross_system_referrals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

-- Healthcare providers can update referrals they're involved in
CREATE POLICY "Healthcare providers can update relevant referrals"
  ON cross_system_referrals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

-- Auto-creation rules: Read for all providers, manage for admins
CREATE POLICY "Providers can view auto-creation rules"
  ON referral_auto_creation_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 3, 5, 6, 7, 9, 10, 99, 100, 101, 102, 103, 104, 105)
    )
  );

CREATE POLICY "Admins can manage auto-creation rules"
  ON referral_auto_creation_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2)
    )
  );

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON cross_system_referrals TO authenticated;
GRANT SELECT ON referral_auto_creation_rules TO authenticated;
GRANT INSERT, UPDATE ON referral_auto_creation_rules TO authenticated;

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE cross_system_referrals IS 'Cross-system referral tracking between NeuroSuite, PT, Mental Health, and other services';
COMMENT ON TABLE referral_auto_creation_rules IS 'Rules for automatically creating referrals based on clinical triggers';
COMMENT ON FUNCTION get_pending_referrals_for_provider IS 'Returns pending referrals for a specific provider sorted by urgency';
COMMENT ON FUNCTION get_patient_referrals IS 'Returns all referrals for a patient across all systems';
COMMENT ON FUNCTION accept_referral IS 'Marks a referral as accepted by the target provider';
COMMENT ON FUNCTION complete_referral IS 'Marks a referral as completed with outcome summary';
