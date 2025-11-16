-- ============================================================================
-- MENTAL HEALTH INTERVENTION SYSTEM FOR ACUTE MEDICAL TRAUMA
-- ============================================================================
-- Purpose: Comprehensive mental health screening and support for patients
--          experiencing sudden life-altering medical events
-- Compliance: Joint Commission, CMS CoP, HIPAA, Texas Health & Safety Code
-- Clinical: Evidence-based suicide prevention and adjustment disorder support
-- ============================================================================

-- ============================================================================
-- 1. TRIGGER CONDITIONS (What qualifies for intervention)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mental_health_trigger_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Condition Details
  condition_type TEXT NOT NULL, -- 'diagnosis', 'procedure', 'functional_decline', 'icu_stay', 'dme_order'
  icd10_code TEXT, -- For diagnosis triggers (e.g., I63.* for stroke)
  cpt_code TEXT, -- For procedure triggers (e.g., 27590 for amputation)
  snomed_code TEXT, -- SNOMED CT code
  description TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('moderate', 'high', 'very_high')),

  -- Auto-trigger Settings
  is_active BOOLEAN DEFAULT true,
  auto_create_service_request BOOLEAN DEFAULT true,
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),

  -- Clinical Notes
  rationale TEXT,
  evidence_basis TEXT,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Seed common trigger conditions
INSERT INTO mental_health_trigger_conditions (condition_type, icd10_code, description, risk_level, rationale) VALUES
('diagnosis', 'I63%', 'Cerebral infarction (Stroke)', 'very_high', 'Stroke survivors have 3-4x higher suicide risk due to sudden loss of function and autonomy'),
('diagnosis', 'I61%', 'Intracerebral hemorrhage', 'very_high', 'Similar to ischemic stroke - sudden neurological deficit'),
('diagnosis', 'S82%', 'Fracture of lower leg', 'moderate', 'May result in significant mobility loss'),
('diagnosis', 'S72%', 'Fracture of femur', 'high', 'High-impact injury often requiring extensive rehabilitation'),
('diagnosis', 'G81%', 'Hemiplegia and hemiparesis', 'very_high', 'Complete or partial paralysis - major functional loss'),
('diagnosis', 'G82%', 'Paraplegia and tetraplegia', 'very_high', 'Spinal cord injury - catastrophic life change'),
('procedure', '27590', 'Amputation, thigh through femur', 'very_high', 'Limb loss - major body image and functional impact'),
('procedure', '27880', 'Amputation, leg through tibia and fibula', 'very_high', 'Lower extremity amputation'),
('procedure', '27295', 'Disarticulation of hip', 'very_high', 'Hip disarticulation'),
('procedure', '25920', 'Disarticulation through wrist', 'very_high', 'Upper extremity amputation'),
('functional_decline', 'ADL_DROP', 'ADL independence drop >2 points', 'high', 'Sudden loss of self-care ability'),
('icu_stay', 'ICU_3DAY', 'ICU admission >3 days', 'moderate', 'Critical illness often precedes functional decline'),
('dme_order', 'WHEELCHAIR', 'New wheelchair order', 'high', 'Indicates major mobility loss'),
('dme_order', 'PROSTHETIC', 'Prosthetic device order', 'very_high', 'Indicates amputation or limb loss');

-- Index for fast lookups
CREATE INDEX idx_mh_trigger_conditions_active ON mental_health_trigger_conditions(is_active) WHERE is_active = true;
CREATE INDEX idx_mh_trigger_conditions_icd10 ON mental_health_trigger_conditions(icd10_code) WHERE icd10_code IS NOT NULL;
CREATE INDEX idx_mh_trigger_conditions_cpt ON mental_health_trigger_conditions(cpt_code) WHERE cpt_code IS NOT NULL;

COMMENT ON TABLE mental_health_trigger_conditions IS 'Defines which medical conditions/events automatically trigger mental health screening';

-- ============================================================================
-- 2. MENTAL HEALTH SERVICE REQUESTS (FHIR ServiceRequest)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mental_health_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT UNIQUE NOT NULL DEFAULT 'ServiceRequest/' || gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- FHIR ServiceRequest fields
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'
  )),
  intent TEXT NOT NULL DEFAULT 'order' CHECK (intent IN (
    'proposal', 'plan', 'directive', 'order', 'original-order', 'reflex-order',
    'filler-order', 'instance-order', 'option'
  )),
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'asap', 'stat')),

  -- Subject (Patient)
  patient_id UUID NOT NULL REFERENCES profiles(user_id),
  encounter_id UUID, -- Link to encounter if applicable

  -- Code (what is being requested)
  code_system TEXT DEFAULT 'http://snomed.info/sct',
  code TEXT NOT NULL DEFAULT '385893002', -- Mental health assessment
  code_display TEXT NOT NULL DEFAULT 'Mental Health Assessment - Adjustment to Medical Condition',

  -- Category
  category TEXT[] DEFAULT ARRAY['mental-health', 'adjustment-disorder'],

  -- Requester (who ordered this)
  requester_type TEXT DEFAULT 'Practitioner',
  requester_id UUID REFERENCES fhir_practitioners(id),
  requester_display TEXT,

  -- Performer (who should complete this)
  performer_type TEXT DEFAULT 'Practitioner',
  performer_id UUID REFERENCES fhir_practitioners(id),
  performer_display TEXT,

  -- Reason (why this was ordered)
  reason_code TEXT[], -- ICD-10 codes
  reason_display TEXT[], -- Human-readable reasons
  reason_reference_type TEXT, -- 'Condition', 'Observation'
  reason_reference_id UUID, -- Link to triggering condition

  -- Timing
  occurrence_datetime TIMESTAMPTZ,
  occurrence_period_start TIMESTAMPTZ,
  occurrence_period_end TIMESTAMPTZ,
  authored_on TIMESTAMPTZ DEFAULT NOW(),

  -- Session Requirements
  session_type TEXT DEFAULT 'inpatient' CHECK (session_type IN ('inpatient', 'outpatient')),
  session_number INTEGER DEFAULT 1,
  total_sessions_required INTEGER DEFAULT 3,
  min_duration_minutes INTEGER DEFAULT 30,

  -- Discharge Blocker
  is_discharge_blocker BOOLEAN DEFAULT false,
  discharge_blocker_active BOOLEAN DEFAULT false,
  discharge_blocker_override_by UUID REFERENCES auth.users(id),
  discharge_blocker_override_reason TEXT,
  discharge_blocker_override_at TIMESTAMPTZ,

  -- Supporting Info
  note TEXT,
  supporting_info TEXT[],

  -- Completion
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  outcome TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_mh_service_requests_patient ON mental_health_service_requests(patient_id);
CREATE INDEX idx_mh_service_requests_status ON mental_health_service_requests(status);
CREATE INDEX idx_mh_service_requests_session_type ON mental_health_service_requests(session_type);
CREATE INDEX idx_mh_service_requests_discharge_blocker ON mental_health_service_requests(discharge_blocker_active) WHERE discharge_blocker_active = true;

COMMENT ON TABLE mental_health_service_requests IS 'FHIR ServiceRequest for mental health assessments and therapy sessions';

-- ============================================================================
-- 3. THERAPY SESSIONS (FHIR Encounter)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mental_health_therapy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT UNIQUE NOT NULL DEFAULT 'Encounter/' || gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- FHIR Encounter fields
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'arrived', 'triaged', 'in-progress', 'onleave',
    'finished', 'cancelled', 'entered-in-error', 'unknown'
  )),
  class TEXT NOT NULL DEFAULT 'IMP' CHECK (class IN ('AMB', 'EMER', 'FLD', 'HH', 'IMP', 'ACUTE', 'NONAC', 'OBSENC', 'PRENC', 'SS', 'VR')),

  -- Subject
  patient_id UUID NOT NULL REFERENCES profiles(user_id),
  service_request_id UUID REFERENCES mental_health_service_requests(id),

  -- Type
  type_code TEXT DEFAULT '90832', -- CPT code for psychotherapy
  type_display TEXT DEFAULT 'Individual psychotherapy, 30 minutes',

  -- Session Details
  session_number INTEGER NOT NULL DEFAULT 1,
  session_type TEXT NOT NULL CHECK (session_type IN ('inpatient', 'outpatient', 'telehealth')),
  is_first_session BOOLEAN DEFAULT false,
  is_discharge_required_session BOOLEAN DEFAULT false,

  -- Timing
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  duration_minutes INTEGER,

  -- Minimum Duration Validation
  min_duration_met BOOLEAN DEFAULT false,
  min_duration_required INTEGER DEFAULT 30,
  duration_exception_reason TEXT,
  duration_exception_code TEXT CHECK (duration_exception_code IN (
    'patient_unstable', 'patient_refused', 'patient_distress',
    'emergency_intervention', 'other'
  )),

  -- Participant (Therapist)
  participant_type TEXT DEFAULT 'Practitioner',
  participant_id UUID REFERENCES fhir_practitioners(id),
  participant_display TEXT,

  -- Location
  location_type TEXT, -- 'room', 'telehealth', 'bedside'
  location_display TEXT,
  room_number TEXT,

  -- Modality
  modality TEXT NOT NULL CHECK (modality IN ('in-person', 'telehealth-video', 'telehealth-phone')),

  -- Clinical Documentation
  chief_complaint TEXT,
  history_of_present_illness TEXT,
  assessment TEXT,
  plan TEXT,

  -- Billing
  billing_code TEXT DEFAULT '90832',
  billing_modifier TEXT,
  billing_status TEXT DEFAULT 'pending' CHECK (billing_status IN ('pending', 'submitted', 'paid', 'denied')),

  -- Outcome
  outcome_status TEXT CHECK (outcome_status IN ('completed', 'incomplete', 'refused', 'rescheduled')),
  outcome_note TEXT,

  -- Follow-up
  follow_up_needed BOOLEAN DEFAULT true,
  follow_up_scheduled BOOLEAN DEFAULT false,
  follow_up_date TIMESTAMPTZ,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_duration CHECK (
    (duration_minutes IS NULL) OR
    (duration_minutes >= 0 AND duration_minutes <= 480)
  ),
  CONSTRAINT valid_times CHECK (
    (actual_start IS NULL OR actual_end IS NULL) OR
    (actual_end > actual_start)
  )
);

-- Indexes
CREATE INDEX idx_mh_therapy_sessions_patient ON mental_health_therapy_sessions(patient_id);
CREATE INDEX idx_mh_therapy_sessions_status ON mental_health_therapy_sessions(status);
CREATE INDEX idx_mh_therapy_sessions_service_request ON mental_health_therapy_sessions(service_request_id);
CREATE INDEX idx_mh_therapy_sessions_scheduled_start ON mental_health_therapy_sessions(scheduled_start);
CREATE INDEX idx_mh_therapy_sessions_discharge_required ON mental_health_therapy_sessions(is_discharge_required_session) WHERE is_discharge_required_session = true;

COMMENT ON TABLE mental_health_therapy_sessions IS 'FHIR Encounter for therapy sessions with timing validation';

-- ============================================================================
-- 4. RISK ASSESSMENTS (FHIR Observation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mental_health_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT UNIQUE NOT NULL DEFAULT 'Observation/' || gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- FHIR Observation fields
  status TEXT NOT NULL DEFAULT 'final' CHECK (status IN (
    'registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'
  )),

  -- Subject
  patient_id UUID NOT NULL REFERENCES profiles(user_id),
  therapy_session_id UUID REFERENCES mental_health_therapy_sessions(id),

  -- Code (Suicide Risk Assessment)
  code_system TEXT DEFAULT 'http://loinc.org',
  code TEXT DEFAULT '73831-0', -- LOINC code for suicide risk assessment
  code_display TEXT DEFAULT 'Suicide risk assessment',

  -- Category
  category TEXT[] DEFAULT ARRAY['mental-health', 'survey'],

  -- Timing
  effective_datetime TIMESTAMPTZ DEFAULT NOW(),
  issued TIMESTAMPTZ DEFAULT NOW(),

  -- Performer
  performer_type TEXT DEFAULT 'Practitioner',
  performer_id UUID REFERENCES fhir_practitioners(id),
  performer_display TEXT,

  -- RISK LEVEL (Primary Value)
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'moderate', 'high')),

  -- SUICIDE SCREENING COMPONENTS
  suicidal_ideation TEXT CHECK (suicidal_ideation IN ('none', 'passive', 'active')),
  suicidal_plan TEXT CHECK (suicidal_plan IN ('none', 'vague', 'specific')),
  suicidal_intent TEXT CHECK (suicidal_intent IN ('none', 'uncertain', 'present')),
  means_access TEXT CHECK (means_access IN ('no_access', 'potential_access', 'immediate_access')),

  -- DEPRESSION SCREENING (PHQ-9)
  phq9_score INTEGER CHECK (phq9_score >= 0 AND phq9_score <= 27),
  phq9_severity TEXT CHECK (phq9_severity IN ('none', 'mild', 'moderate', 'moderately_severe', 'severe')),

  -- ANXIETY SCREENING (GAD-7)
  gad7_score INTEGER CHECK (gad7_score >= 0 AND gad7_score <= 21),
  gad7_severity TEXT CHECK (gad7_severity IN ('none', 'mild', 'moderate', 'severe')),

  -- CLINICAL IMPRESSION
  clinical_impression TEXT NOT NULL,
  adjustment_response TEXT CHECK (adjustment_response IN ('adaptive', 'maladaptive', 'mixed')),
  coping_mechanisms TEXT[],
  support_system_adequate BOOLEAN,
  patient_engagement TEXT CHECK (patient_engagement IN ('engaged', 'ambivalent', 'resistant')),

  -- PROTECTIVE FACTORS
  protective_factors TEXT[],
  risk_factors TEXT[],

  -- INTERPRETATION
  interpretation_code TEXT CHECK (interpretation_code IN ('L', 'N', 'H', 'HH')), -- Low, Normal, High, Critical High
  interpretation_display TEXT,

  -- Notes
  note TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_mh_risk_assessments_patient ON mental_health_risk_assessments(patient_id);
CREATE INDEX idx_mh_risk_assessments_risk_level ON mental_health_risk_assessments(risk_level);
CREATE INDEX idx_mh_risk_assessments_session ON mental_health_risk_assessments(therapy_session_id);
CREATE INDEX idx_mh_risk_assessments_effective ON mental_health_risk_assessments(effective_datetime DESC);

COMMENT ON TABLE mental_health_risk_assessments IS 'FHIR Observation for suicide risk and mental health assessments';

-- ============================================================================
-- 5. SAFETY PLANS (FHIR DocumentReference)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mental_health_safety_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT UNIQUE NOT NULL DEFAULT 'DocumentReference/' || gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- FHIR DocumentReference fields
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'superseded', 'entered-in-error')),

  -- Subject
  patient_id UUID NOT NULL REFERENCES profiles(user_id),
  risk_assessment_id UUID REFERENCES mental_health_risk_assessments(id),
  therapy_session_id UUID REFERENCES mental_health_therapy_sessions(id),

  -- Document Type
  type_code TEXT DEFAULT 'safety-plan',
  type_display TEXT DEFAULT 'Mental Health Safety Plan',
  category TEXT[] DEFAULT ARRAY['clinical-note', 'safety-plan'],

  -- Security
  security_label TEXT DEFAULT 'sensitive' CHECK (security_label IN ('normal', 'sensitive', 'restricted', 'very-restricted')),

  -- Date
  date TIMESTAMPTZ DEFAULT NOW(),

  -- Author
  author_type TEXT DEFAULT 'Practitioner',
  author_id UUID REFERENCES fhir_practitioners(id),
  author_display TEXT,

  -- SAFETY PLAN CONTENT (Stanley-Brown Safety Planning Intervention)
  -- Step 1: Warning signs
  warning_signs TEXT[] NOT NULL,

  -- Step 2: Internal coping strategies
  internal_coping_strategies TEXT[] NOT NULL,

  -- Step 3: People and social settings for distraction
  social_distraction_people TEXT[],
  social_distraction_places TEXT[],

  -- Step 4: People to ask for help
  people_to_contact JSONB, -- [{name: "...", phone: "...", relationship: "..."}]

  -- Step 5: Professionals and agencies to contact
  professional_contacts JSONB NOT NULL, -- [{name: "...", phone: "...", role: "...", available: "..."}]
  crisis_hotlines JSONB NOT NULL, -- [{name: "988 Suicide & Crisis Lifeline", phone: "988", available: "24/7"}]

  -- Step 6: Making environment safe
  means_restriction_steps TEXT[] NOT NULL,
  lethal_means_addressed BOOLEAN NOT NULL DEFAULT false,

  -- Additional Content
  scheduled_follow_ups TEXT[],
  patient_signature_obtained BOOLEAN DEFAULT false,
  patient_signature_date TIMESTAMPTZ,
  patient_verbalized_understanding BOOLEAN NOT NULL DEFAULT false,

  -- Distribution
  copy_given_to_patient BOOLEAN DEFAULT false,
  copy_given_to_family BOOLEAN DEFAULT false,
  copy_in_chart BOOLEAN DEFAULT true,

  -- Notes
  note TEXT,

  -- Document Storage
  document_url TEXT, -- Link to PDF or document storage
  content_type TEXT DEFAULT 'application/pdf',

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_mh_safety_plans_patient ON mental_health_safety_plans(patient_id);
CREATE INDEX idx_mh_safety_plans_risk_assessment ON mental_health_safety_plans(risk_assessment_id);
CREATE INDEX idx_mh_safety_plans_date ON mental_health_safety_plans(date DESC);

COMMENT ON TABLE mental_health_safety_plans IS 'FHIR DocumentReference for evidence-based safety plans';

-- ============================================================================
-- 6. ESCALATIONS & ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS mental_health_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Subject
  patient_id UUID NOT NULL REFERENCES profiles(user_id),
  risk_assessment_id UUID REFERENCES mental_health_risk_assessments(id),
  therapy_session_id UUID REFERENCES mental_health_therapy_sessions(id),

  -- Escalation Details
  escalation_level TEXT NOT NULL CHECK (escalation_level IN ('moderate', 'high', 'stat')),
  escalation_reason TEXT NOT NULL,
  trigger_criteria TEXT[] NOT NULL,

  -- Actions Taken
  actions_required TEXT[] NOT NULL,
  psych_consult_ordered BOOLEAN DEFAULT false,
  psych_consult_id UUID, -- Link to service request
  one_to_one_observation_recommended BOOLEAN DEFAULT false,
  safety_plan_created BOOLEAN DEFAULT false,
  attending_notified BOOLEAN DEFAULT false,
  attending_notified_at TIMESTAMPTZ,
  attending_notified_by UUID REFERENCES auth.users(id),

  -- Notifications Sent
  notifications_sent JSONB, -- [{recipient: "...", role: "...", method: "...", sent_at: "..."}]

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'in-progress', 'resolved', 'cancelled')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_mh_escalations_patient ON mental_health_escalations(patient_id);
CREATE INDEX idx_mh_escalations_status ON mental_health_escalations(status);
CREATE INDEX idx_mh_escalations_level ON mental_health_escalations(escalation_level);
CREATE INDEX idx_mh_escalations_created ON mental_health_escalations(created_at DESC);

COMMENT ON TABLE mental_health_escalations IS 'Tracks high-risk escalations and required interventions';

-- ============================================================================
-- 7. FLAGS (FHIR Flag)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mental_health_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT UNIQUE NOT NULL DEFAULT 'Flag/' || gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- FHIR Flag fields
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'entered-in-error')),

  -- Subject
  patient_id UUID NOT NULL REFERENCES profiles(user_id),

  -- Category & Code
  category TEXT[] DEFAULT ARRAY['safety', 'clinical'],
  code_system TEXT DEFAULT 'http://terminology.hl7.org/CodeSystem/flag-category',
  code TEXT NOT NULL,
  code_display TEXT NOT NULL,

  -- Period
  period_start TIMESTAMPTZ DEFAULT NOW(),
  period_end TIMESTAMPTZ,

  -- Author
  author_type TEXT DEFAULT 'Practitioner',
  author_id UUID REFERENCES fhir_practitioners(id),
  author_display TEXT,

  -- Flag Details
  flag_type TEXT NOT NULL CHECK (flag_type IN (
    'suicide_risk', 'active_monitoring', 'psychiatric_consult_pending',
    'discharge_hold', 'safety_plan_required', 'high_risk_alert'
  )),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Alert Behavior
  show_on_banner BOOLEAN DEFAULT true,
  alert_frequency TEXT DEFAULT 'always' CHECK (alert_frequency IN ('once', 'daily', 'always')),

  -- Notes
  note TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_mh_flags_patient ON mental_health_flags(patient_id);
CREATE INDEX idx_mh_flags_status ON mental_health_flags(status);
CREATE INDEX idx_mh_flags_type ON mental_health_flags(flag_type);
CREATE INDEX idx_mh_flags_active ON mental_health_flags(status, period_end) WHERE status = 'active';

COMMENT ON TABLE mental_health_flags IS 'FHIR Flag for clinical alerts and safety warnings';

-- ============================================================================
-- 8. DISCHARGE READINESS CHECKLIST
-- ============================================================================

CREATE TABLE IF NOT EXISTS mental_health_discharge_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Patient
  patient_id UUID NOT NULL REFERENCES profiles(user_id),
  encounter_id UUID, -- Link to inpatient encounter

  -- Checklist Items
  initial_therapy_session_completed BOOLEAN DEFAULT false,
  initial_therapy_session_id UUID REFERENCES mental_health_therapy_sessions(id),
  risk_assessment_completed BOOLEAN DEFAULT false,
  risk_assessment_id UUID REFERENCES mental_health_risk_assessments(id),
  safety_plan_created BOOLEAN DEFAULT false,
  safety_plan_id UUID REFERENCES mental_health_safety_plans(id),
  outpatient_therapy_scheduled BOOLEAN DEFAULT false,
  outpatient_first_appt_date TIMESTAMPTZ,
  resources_provided BOOLEAN DEFAULT false,
  patient_education_completed BOOLEAN DEFAULT false,

  -- High Risk Additional Requirements
  psychiatric_clearance_obtained BOOLEAN DEFAULT false,
  psychiatric_clearance_by UUID REFERENCES fhir_practitioners(id),
  psychiatric_clearance_date TIMESTAMPTZ,
  family_support_engaged BOOLEAN DEFAULT false,
  crisis_plan_provided BOOLEAN DEFAULT false,

  -- Overall Status
  all_requirements_met BOOLEAN GENERATED ALWAYS AS (
    initial_therapy_session_completed AND
    risk_assessment_completed AND
    outpatient_therapy_scheduled AND
    resources_provided AND
    patient_education_completed
  ) STORED,

  discharge_cleared BOOLEAN DEFAULT false,
  discharge_cleared_by UUID REFERENCES auth.users(id),
  discharge_cleared_at TIMESTAMPTZ,

  -- Override (for refusals or special circumstances)
  override_required BOOLEAN DEFAULT false,
  override_granted BOOLEAN DEFAULT false,
  override_by UUID REFERENCES auth.users(id),
  override_reason TEXT,
  override_at TIMESTAMPTZ,

  -- Notes
  note TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_patient_checklist UNIQUE(patient_id, encounter_id)
);

-- Indexes
CREATE INDEX idx_mh_discharge_checklist_patient ON mental_health_discharge_checklist(patient_id);
CREATE INDEX idx_mh_discharge_checklist_cleared ON mental_health_discharge_checklist(all_requirements_met);

COMMENT ON TABLE mental_health_discharge_checklist IS 'Tracks completion of required mental health interventions before discharge';

-- ============================================================================
-- 9. QUALITY METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS mental_health_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Time Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Volume Metrics
  total_triggers INTEGER DEFAULT 0,
  total_service_requests_created INTEGER DEFAULT 0,
  total_sessions_scheduled INTEGER DEFAULT 0,
  total_sessions_completed INTEGER DEFAULT 0,

  -- Completion Rates
  initial_session_completion_rate NUMERIC(5,2),
  outpatient_session_completion_rate NUMERIC(5,2),
  discharge_checklist_completion_rate NUMERIC(5,2),

  -- Timing Metrics
  avg_time_trigger_to_first_session_hours NUMERIC(10,2),
  avg_session_duration_minutes NUMERIC(10,2),

  -- Risk Distribution
  low_risk_count INTEGER DEFAULT 0,
  moderate_risk_count INTEGER DEFAULT 0,
  high_risk_count INTEGER DEFAULT 0,

  -- Escalations
  total_escalations INTEGER DEFAULT 0,
  psych_consults_ordered INTEGER DEFAULT 0,

  -- Exceptions
  duration_exceptions_count INTEGER DEFAULT 0,
  patient_refusals_count INTEGER DEFAULT 0,
  discharge_overrides_count INTEGER DEFAULT 0,

  -- Outcomes (if measurable)
  readmission_rate_30day NUMERIC(5,2),

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculated_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_quality_metrics_period UNIQUE(period_start, period_end)
);

-- Index
CREATE INDEX idx_mh_quality_metrics_period ON mental_health_quality_metrics(period_start DESC, period_end DESC);

COMMENT ON TABLE mental_health_quality_metrics IS 'Quality metrics and KPIs for mental health intervention program';

-- ============================================================================
-- 10. CARE TEAM INTEGRATION
-- ============================================================================

-- Link mental health service to care teams
ALTER TABLE mental_health_service_requests
ADD COLUMN IF NOT EXISTS care_team_id UUID;

ALTER TABLE mental_health_therapy_sessions
ADD COLUMN IF NOT EXISTS care_team_id UUID;

-- ============================================================================
-- 11. RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE mental_health_trigger_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_safety_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_discharge_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_quality_metrics ENABLE ROW LEVEL SECURITY;

-- Trigger conditions: Read-only for all authenticated, write for admin
CREATE POLICY "Authenticated users can view trigger conditions"
  ON mental_health_trigger_conditions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage trigger conditions"
  ON mental_health_trigger_conditions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6) -- admin, super_admin, doctor, nurse_practitioner
    )
  );

-- Service requests: Healthcare providers can view/manage
CREATE POLICY "Healthcare providers can view service requests"
  ON mental_health_service_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 10) -- healthcare team
    )
  );

CREATE POLICY "Healthcare providers can create service requests"
  ON mental_health_service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 10)
    )
  );

CREATE POLICY "Healthcare providers can update service requests"
  ON mental_health_service_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 10)
    )
  );

-- Therapy sessions: Therapists and care team can manage
CREATE POLICY "Therapists and care team can view sessions"
  ON mental_health_therapy_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 10) -- healthcare team including social workers
    )
  );

CREATE POLICY "Therapists can manage sessions"
  ON mental_health_therapy_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 9, 10) -- doctors, NPs, care managers, social workers
    )
  );

-- Risk assessments: Therapists and clinical staff
CREATE POLICY "Clinical staff can view risk assessments"
  ON mental_health_risk_assessments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 10)
    )
  );

CREATE POLICY "Therapists can create risk assessments"
  ON mental_health_risk_assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 9, 10)
    )
  );

-- Safety plans: Therapists and clinical staff
CREATE POLICY "Clinical staff can view safety plans"
  ON mental_health_safety_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 10)
    )
  );

CREATE POLICY "Therapists can create safety plans"
  ON mental_health_safety_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 9, 10)
    )
  );

-- Escalations: Clinical staff only
CREATE POLICY "Clinical staff can view escalations"
  ON mental_health_escalations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 10)
    )
  );

CREATE POLICY "Clinical staff can manage escalations"
  ON mental_health_escalations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 10)
    )
  );

-- Flags: All clinical staff can view
CREATE POLICY "Clinical staff can view flags"
  ON mental_health_flags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 10, 16) -- including case managers
    )
  );

CREATE POLICY "Clinical staff can manage flags"
  ON mental_health_flags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 10)
    )
  );

-- Discharge checklist: Nurses and care coordinators
CREATE POLICY "Care team can view discharge checklist"
  ON mental_health_discharge_checklist FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 16) -- includes case managers
    )
  );

CREATE POLICY "Care team can manage discharge checklist"
  ON mental_health_discharge_checklist FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 7, 9, 16)
    )
  );

-- Quality metrics: Admins and quality team
CREATE POLICY "Admins can view quality metrics"
  ON mental_health_quality_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2, 5, 6, 9) -- admin, super_admin, doctors, NPs, care managers
    )
  );

CREATE POLICY "Admins can manage quality metrics"
  ON mental_health_quality_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (1, 2) -- admin, super_admin only
    )
  );

-- ============================================================================
-- 12. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mental_health_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_mh_trigger_conditions_updated_at
  BEFORE UPDATE ON mental_health_trigger_conditions
  FOR EACH ROW EXECUTE FUNCTION update_mental_health_updated_at();

CREATE TRIGGER update_mh_service_requests_updated_at
  BEFORE UPDATE ON mental_health_service_requests
  FOR EACH ROW EXECUTE FUNCTION update_mental_health_updated_at();

CREATE TRIGGER update_mh_therapy_sessions_updated_at
  BEFORE UPDATE ON mental_health_therapy_sessions
  FOR EACH ROW EXECUTE FUNCTION update_mental_health_updated_at();

CREATE TRIGGER update_mh_risk_assessments_updated_at
  BEFORE UPDATE ON mental_health_risk_assessments
  FOR EACH ROW EXECUTE FUNCTION update_mental_health_updated_at();

CREATE TRIGGER update_mh_safety_plans_updated_at
  BEFORE UPDATE ON mental_health_safety_plans
  FOR EACH ROW EXECUTE FUNCTION update_mental_health_updated_at();

CREATE TRIGGER update_mh_escalations_updated_at
  BEFORE UPDATE ON mental_health_escalations
  FOR EACH ROW EXECUTE FUNCTION update_mental_health_updated_at();

CREATE TRIGGER update_mh_flags_updated_at
  BEFORE UPDATE ON mental_health_flags
  FOR EACH ROW EXECUTE FUNCTION update_mental_health_updated_at();

CREATE TRIGGER update_mh_discharge_checklist_updated_at
  BEFORE UPDATE ON mental_health_discharge_checklist
  FOR EACH ROW EXECUTE FUNCTION update_mental_health_updated_at();

-- Function to calculate session duration
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actual_start IS NOT NULL AND NEW.actual_end IS NOT NULL THEN
    NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.actual_end - NEW.actual_start)) / 60;
    NEW.min_duration_met = NEW.duration_minutes >= NEW.min_duration_required;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_therapy_session_duration
  BEFORE INSERT OR UPDATE ON mental_health_therapy_sessions
  FOR EACH ROW EXECUTE FUNCTION calculate_session_duration();

-- Function to auto-create escalation on high risk
CREATE OR REPLACE FUNCTION auto_escalate_high_risk()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.risk_level = 'high' THEN
    INSERT INTO mental_health_escalations (
      patient_id,
      risk_assessment_id,
      therapy_session_id,
      escalation_level,
      escalation_reason,
      trigger_criteria,
      actions_required,
      psych_consult_ordered,
      created_by
    ) VALUES (
      NEW.patient_id,
      NEW.id,
      NEW.therapy_session_id,
      'stat',
      'High suicide risk identified during therapy session',
      ARRAY['High risk level on suicide screening'],
      ARRAY['STAT psychiatric consult', 'Consider 1:1 observation', 'Notify attending physician', 'Create safety plan'],
      false,
      NEW.created_by
    );

    -- Create flag
    INSERT INTO mental_health_flags (
      patient_id,
      status,
      category,
      code,
      code_display,
      flag_type,
      severity,
      show_on_banner,
      note,
      created_by
    ) VALUES (
      NEW.patient_id,
      'active',
      ARRAY['safety', 'clinical'],
      'suicide-risk-active',
      'ACTIVE SUICIDE RISK - Monitoring Required',
      'suicide_risk',
      'critical',
      true,
      'High risk identified on ' || NOW()::date || '. See risk assessment ' || NEW.id,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_escalate_on_high_risk
  AFTER INSERT OR UPDATE OF risk_level ON mental_health_risk_assessments
  FOR EACH ROW
  WHEN (NEW.risk_level = 'high')
  EXECUTE FUNCTION auto_escalate_high_risk();

-- Function to update discharge checklist
CREATE OR REPLACE FUNCTION update_discharge_checklist_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'finished' AND NEW.outcome_status = 'completed' AND NEW.min_duration_met THEN
    -- Update or create discharge checklist
    INSERT INTO mental_health_discharge_checklist (
      patient_id,
      initial_therapy_session_completed,
      initial_therapy_session_id,
      created_by
    ) VALUES (
      NEW.patient_id,
      true,
      NEW.id,
      NEW.updated_by
    )
    ON CONFLICT (patient_id, encounter_id)
    DO UPDATE SET
      initial_therapy_session_completed = true,
      initial_therapy_session_id = NEW.id,
      updated_by = NEW.updated_by,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_checklist_on_session_complete
  AFTER UPDATE OF status ON mental_health_therapy_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'finished' AND NEW.is_discharge_required_session = true)
  EXECUTE FUNCTION update_discharge_checklist_on_completion();

-- ============================================================================
-- 13. HELPER VIEWS
-- ============================================================================

-- Active mental health patients view
CREATE OR REPLACE VIEW v_active_mental_health_patients AS
SELECT DISTINCT
  p.id as patient_id,
  p.first_name,
  p.last_name,
  p.mrn,
  p.room_number,
  sr.id as service_request_id,
  sr.status as service_request_status,
  sr.session_type,
  sr.priority,
  sr.is_discharge_blocker,
  sr.discharge_blocker_active,
  ra.risk_level,
  ra.effective_datetime as last_risk_assessment_date,
  ts.status as session_status,
  ts.scheduled_start as next_session_scheduled,
  dc.all_requirements_met as discharge_ready,
  f.code_display as active_flag
FROM profiles p
INNER JOIN mental_health_service_requests sr ON p.id = sr.patient_id
LEFT JOIN mental_health_risk_assessments ra ON p.id = ra.patient_id
  AND ra.id = (SELECT id FROM mental_health_risk_assessments WHERE patient_id = p.id ORDER BY effective_datetime DESC LIMIT 1)
LEFT JOIN mental_health_therapy_sessions ts ON p.id = ts.patient_id
  AND ts.id = (SELECT id FROM mental_health_therapy_sessions WHERE patient_id = p.id ORDER BY scheduled_start DESC LIMIT 1)
LEFT JOIN mental_health_discharge_checklist dc ON p.id = dc.patient_id
LEFT JOIN mental_health_flags f ON p.id = f.patient_id AND f.status = 'active'
WHERE sr.status IN ('active', 'on-hold')
ORDER BY
  CASE sr.priority WHEN 'stat' THEN 1 WHEN 'urgent' THEN 2 WHEN 'asap' THEN 3 ELSE 4 END,
  ra.risk_level DESC NULLS LAST,
  sr.created_at;

-- Pending sessions view
CREATE OR REPLACE VIEW v_pending_mental_health_sessions AS
SELECT
  ts.id as session_id,
  ts.patient_id,
  p.first_name,
  p.last_name,
  p.room_number,
  ts.status,
  ts.session_type,
  ts.session_number,
  ts.is_discharge_required_session,
  ts.scheduled_start,
  ts.scheduled_end,
  ts.participant_display as therapist,
  sr.priority,
  ra.risk_level
FROM mental_health_therapy_sessions ts
INNER JOIN profiles p ON ts.patient_id = p.id
LEFT JOIN mental_health_service_requests sr ON ts.service_request_id = sr.id
LEFT JOIN mental_health_risk_assessments ra ON ts.patient_id = ra.patient_id
  AND ra.id = (SELECT id FROM mental_health_risk_assessments WHERE patient_id = ts.patient_id ORDER BY effective_datetime DESC LIMIT 1)
WHERE ts.status IN ('planned', 'arrived', 'in-progress')
ORDER BY
  CASE sr.priority WHEN 'stat' THEN 1 WHEN 'urgent' THEN 2 WHEN 'asap' THEN 3 ELSE 4 END,
  ts.is_discharge_required_session DESC,
  ts.scheduled_start;

-- Discharge blockers view
CREATE OR REPLACE VIEW v_mental_health_discharge_blockers AS
SELECT
  p.id as patient_id,
  p.first_name,
  p.last_name,
  p.mrn,
  p.room_number,
  sr.id as service_request_id,
  sr.session_type,
  dc.initial_therapy_session_completed,
  dc.risk_assessment_completed,
  dc.safety_plan_created,
  dc.outpatient_therapy_scheduled,
  dc.all_requirements_met,
  dc.override_granted,
  dc.override_reason,
  ARRAY_AGG(DISTINCT f.code_display) FILTER (WHERE f.status = 'active') as active_flags
FROM profiles p
INNER JOIN mental_health_service_requests sr ON p.id = sr.patient_id
LEFT JOIN mental_health_discharge_checklist dc ON p.id = dc.patient_id
LEFT JOIN mental_health_flags f ON p.id = f.patient_id
WHERE sr.discharge_blocker_active = true
  AND (dc.all_requirements_met = false OR dc.all_requirements_met IS NULL)
  AND (dc.override_granted = false OR dc.override_granted IS NULL)
GROUP BY p.id, p.first_name, p.last_name, p.mrn, p.room_number, sr.id, sr.session_type,
         dc.initial_therapy_session_completed, dc.risk_assessment_completed, dc.safety_plan_created,
         dc.outpatient_therapy_scheduled, dc.all_requirements_met, dc.override_granted, dc.override_reason
ORDER BY sr.created_at;

-- Grant permissions on views
GRANT SELECT ON v_active_mental_health_patients TO authenticated;
GRANT SELECT ON v_pending_mental_health_sessions TO authenticated;
GRANT SELECT ON v_mental_health_discharge_blockers TO authenticated;

-- ============================================================================
-- 14. COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON SCHEMA public IS 'Mental Health Intervention System - Comprehensive support for patients experiencing acute medical trauma';
