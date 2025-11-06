-- =====================================================
-- INNOVATIVE PHYSICAL THERAPY WORKFLOW SYSTEM
-- =====================================================
-- FHIR R4 Compliant | Evidence-Based | Holistic Approach
-- Designed for comprehensive PT care delivery and outcomes tracking
-- =====================================================

-- =====================================================
-- 1. PT FUNCTIONAL ASSESSMENT FRAMEWORK
-- =====================================================
-- Uses ICF (International Classification of Functioning, Disability and Health) framework
-- Tracks body function/structure, activity limitations, participation restrictions

CREATE TABLE IF NOT EXISTS pt_functional_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
    therapist_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

    -- Assessment Type and Context
    assessment_type TEXT NOT NULL CHECK (assessment_type IN (
        'initial_evaluation',
        'interim_evaluation',
        'discharge_evaluation',
        'post_discharge_followup'
    )),
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    visit_number INTEGER NOT NULL DEFAULT 1,

    -- Chief Complaint and History
    chief_complaint TEXT NOT NULL,
    history_present_illness TEXT,
    mechanism_of_injury TEXT,
    onset_date DATE,
    onset_type TEXT CHECK (onset_type IN ('acute', 'insidious', 'gradual', 'post_surgical')),

    -- Medical History Relevant to PT
    prior_level_of_function TEXT, -- Functional status before injury/illness
    comorbidities TEXT[], -- Chronic conditions affecting rehab
    medications_affecting_rehab TEXT[], -- Beta blockers, steroids, anticoagulants, etc.
    surgical_history JSONB, -- Relevant surgical procedures
    imaging_results JSONB, -- MRI, X-ray findings
    precautions TEXT[], -- Weight bearing, cardiac, spinal, etc.
    contraindications TEXT[], -- Absolute/relative contraindications

    -- Social Determinants and Environmental Factors (ICF)
    living_situation TEXT CHECK (living_situation IN (
        'independent_alone',
        'independent_with_family',
        'assisted_living',
        'skilled_nursing',
        'homeless',
        'other'
    )),
    home_accessibility JSONB, -- Stairs, railings, bathroom setup
    support_system TEXT, -- Family/caregiver involvement
    transportation_access TEXT CHECK (transportation_access IN (
        'independent_driving',
        'family_transport',
        'public_transport',
        'medical_transport',
        'no_reliable_transport'
    )),
    occupation TEXT,
    work_demands JSONB, -- Physical demands, ergonomics
    hobbies_recreational_activities TEXT[],

    -- Patient Goals (ICF Participation)
    patient_stated_goals TEXT[],
    participation_goals JSONB, -- Return to work, sports, ADLs

    -- Systems Review
    cardiovascular_respiratory_findings TEXT,
    integumentary_findings TEXT,
    musculoskeletal_findings TEXT,
    neuromuscular_findings TEXT,

    -- Body Function/Structure Impairments (ICF)
    pain_assessment JSONB, -- Location, quality, intensity, aggravating/alleviating factors
    range_of_motion_data JSONB, -- Goniometric measurements by joint
    muscle_strength_data JSONB, -- MMT 0-5 scale by muscle group
    sensory_assessment JSONB, -- Light touch, proprioception, vibration
    reflex_testing JSONB, -- Deep tendon reflexes
    special_tests JSONB, -- Orthopedic special tests (e.g., Lachman, Neer's)
    posture_analysis TEXT,
    gait_analysis JSONB, -- Gait pattern, assistive device, deviations
    balance_assessment JSONB, -- Static/dynamic balance
    coordination_assessment TEXT,

    -- Activity Limitations (ICF)
    bed_mobility_score INTEGER CHECK (bed_mobility_score BETWEEN 1 AND 7), -- FIM scale
    transfer_ability_score INTEGER CHECK (transfer_ability_score BETWEEN 1 AND 7),
    ambulation_score INTEGER CHECK (ambulation_score BETWEEN 1 AND 7),
    stair_negotiation_score INTEGER CHECK (stair_negotiation_score BETWEEN 1 AND 7),

    -- Standardized Outcome Measures (Evidence-Based)
    -- Examples: Lower Extremity Functional Scale (LEFS), Oswestry Disability Index (ODI),
    -- DASH, PSFS (Patient Specific Functional Scale), TUG, 6MWT, Berg Balance Scale
    outcome_measures JSONB, -- Array of validated tools with scores

    -- Clinical Impression
    primary_diagnosis TEXT, -- PT diagnosis using ICD-10 or movement system diagnosis
    secondary_diagnoses TEXT[],
    clinical_impression TEXT NOT NULL,

    -- Rehab Potential and Prognosis
    rehab_potential TEXT CHECK (rehab_potential IN (
        'excellent',
        'good',
        'fair',
        'poor',
        'guarded'
    )),
    prognosis_narrative TEXT,
    expected_duration_weeks INTEGER,
    expected_visit_frequency TEXT, -- e.g., "3x/week for 4 weeks, then 2x/week"

    -- Barriers to Recovery
    barriers_to_recovery JSONB, -- Pain, fear-avoidance, poor compliance, social factors

    -- Clinical Decision Making
    clinical_reasoning TEXT, -- Justification for treatment approach
    evidence_based_rationale TEXT, -- Research supporting treatment plan

    -- Digital Integration
    video_assessment_url TEXT, -- Link to recorded movement analysis
    imaging_links TEXT[], -- Links to uploaded X-rays, MRIs

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    signed_by UUID REFERENCES profiles(user_id), -- Supervising PT for students
    signed_at TIMESTAMP WITH TIME ZONE

    -- Note: Role validation will be added after PT roles are created
    -- CONSTRAINT valid_therapist CHECK validated via application logic
);

-- Indexes
CREATE INDEX idx_pt_assessments_patient ON pt_functional_assessments(patient_id);
CREATE INDEX idx_pt_assessments_therapist ON pt_functional_assessments(therapist_id);
CREATE INDEX idx_pt_assessments_date ON pt_functional_assessments(assessment_date DESC);
CREATE INDEX idx_pt_assessments_type ON pt_functional_assessments(assessment_type);

-- Audit Trail
CREATE TRIGGER pt_assessments_updated_at
    BEFORE UPDATE ON pt_functional_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. PT TREATMENT PLAN (Integrated with FHIR CarePlan)
-- =====================================================
-- Links to fhir_care_plans but adds PT-specific structure

CREATE TABLE IF NOT EXISTS pt_treatment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES pt_functional_assessments(id) ON DELETE CASCADE,
    care_plan_id UUID REFERENCES fhir_care_plans(id) ON DELETE SET NULL, -- Link to FHIR
    therapist_id UUID NOT NULL REFERENCES profiles(user_id),

    -- Plan Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'draft',
        'active',
        'on_hold',
        'modified',
        'completed',
        'discontinued'
    )),

    -- Plan Period
    start_date DATE NOT NULL,
    projected_end_date DATE NOT NULL,
    actual_end_date DATE,

    -- Visit Authorization
    total_visits_authorized INTEGER,
    visits_used INTEGER DEFAULT 0,
    visits_remaining INTEGER GENERATED ALWAYS AS (total_visits_authorized - visits_used) STORED,
    frequency TEXT, -- "3x/week", "2x/week tapering to 1x/week"

    -- SMART Goals (Specific, Measurable, Achievable, Relevant, Time-bound)
    goals JSONB NOT NULL, -- Array of PT-specific functional goals
    -- Each goal: {
    --   goal_id,
    --   goal_statement,
    --   icf_category (body_function | activity | participation),
    --   baseline_status,
    --   target_status,
    --   timeframe_weeks,
    --   progress_percentage,
    --   outcome_measure_used,
    --   achieved (boolean),
    --   achieved_date
    -- }

    -- Intervention Categories (CPT-based)
    interventions JSONB NOT NULL, -- Array of planned interventions
    -- Examples: therapeutic_exercise (97110), manual_therapy (97140),
    -- neuromuscular_reeducation (97112), gait_training (97116)
    -- Each: {intervention_type, cpt_code, rationale, frequency, duration_minutes}

    -- Treatment Approach and Framework
    treatment_approach TEXT[], -- Movement System, NDT, PNF, McKenzie, etc.
    clinical_practice_guidelines_followed TEXT[], -- APTA guidelines, Cochrane reviews

    -- Home Exercise Program
    hep_prescribed BOOLEAN DEFAULT false,
    hep_delivery_method TEXT CHECK (hep_delivery_method IN (
        'paper_handout',
        'digital_app',
        'video_demonstration',
        'telehealth_instruction',
        'combination'
    )),
    hep_compliance_tracking BOOLEAN DEFAULT false,

    -- Plan Modifications
    modification_history JSONB, -- Track changes to plan with rationale

    -- Discharge Planning (from initial eval)
    discharge_criteria JSONB, -- Specific functional criteria for discharge
    discharge_destination TEXT CHECK (discharge_destination IN (
        'home_independent',
        'home_with_services',
        'subacute_rehab',
        'continued_outpatient',
        'self_maintenance_program'
    )),

    -- Collaboration
    interdisciplinary_referrals TEXT[], -- OT, Speech, Psychology, etc.
    physician_communication_log JSONB,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    CONSTRAINT valid_visit_count CHECK (visits_used <= total_visits_authorized),
    CONSTRAINT valid_dates CHECK (projected_end_date >= start_date)
);

-- Indexes
CREATE INDEX idx_pt_plans_patient ON pt_treatment_plans(patient_id);
CREATE INDEX idx_pt_plans_status ON pt_treatment_plans(status);
CREATE INDEX idx_pt_plans_assessment ON pt_treatment_plans(assessment_id);

-- =====================================================
-- 3. PT TREATMENT SESSIONS (Daily Notes)
-- =====================================================

CREATE TABLE IF NOT EXISTS pt_treatment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    treatment_plan_id UUID NOT NULL REFERENCES pt_treatment_plans(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
    therapist_id UUID NOT NULL REFERENCES profiles(user_id),

    -- Session Details
    session_date DATE NOT NULL,
    session_number INTEGER NOT NULL,
    session_duration_minutes INTEGER NOT NULL CHECK (session_duration_minutes >= 15),

    -- Attendance
    attendance_status TEXT NOT NULL CHECK (attendance_status IN (
        'attended',
        'late_cancel',
        'no_show',
        'rescheduled',
        'cancelled_by_facility'
    )),

    -- Subjective (SOAP)
    patient_reported_status TEXT, -- "Feeling better", "Pain worse", etc.
    pain_level_today INTEGER CHECK (pain_level_today BETWEEN 0 AND 10),
    hep_compliance TEXT CHECK (hep_compliance IN (
        'fully_compliant',
        'mostly_compliant',
        'partially_compliant',
        'non_compliant',
        'not_applicable'
    )),
    barriers_today TEXT[], -- Pain, fatigue, equipment issues, etc.

    -- Objective (SOAP)
    vitals_if_needed JSONB, -- HR, BP, SpO2 for cardiac/pulmonary PT
    reassessments_today JSONB, -- ROM, strength, balance tests repeated

    -- Interventions Provided
    interventions_delivered JSONB NOT NULL, -- Array of actual treatments
    -- Each: {
    --   intervention_type,
    --   cpt_code,
    --   time_spent_minutes (for billing),
    --   parameters (e.g., "10 reps x 3 sets", "Grade III mobilization"),
    --   patient_response
    -- }

    -- Assessment (SOAP)
    progress_toward_goals TEXT NOT NULL,
    functional_changes TEXT,
    clinical_decision_making TEXT, -- Why you did what you did

    -- Plan (SOAP)
    plan_for_next_visit TEXT NOT NULL,
    plan_modifications JSONB, -- Changes to treatment plan
    goals_updated BOOLEAN DEFAULT false,

    -- Billing
    total_timed_minutes INTEGER, -- Sum of time-based CPT codes
    total_billable_units INTEGER, -- Based on 8-minute rule
    cpt_codes_billed TEXT[], -- Array of CPT codes for this session

    -- Digital Assets
    exercise_videos_shared TEXT[], -- Links to videos shown to patient
    educational_materials_provided TEXT[],

    -- Safety and Incidents
    adverse_events TEXT, -- Falls, pain exacerbation, etc.
    incident_report_filed BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    co_signed_by UUID REFERENCES profiles(user_id), -- For PTAs
    co_signed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_pt_sessions_patient ON pt_treatment_sessions(patient_id);
CREATE INDEX idx_pt_sessions_plan ON pt_treatment_sessions(treatment_plan_id);
CREATE INDEX idx_pt_sessions_date ON pt_treatment_sessions(session_date DESC);

-- Trigger to increment visits_used in treatment plan
CREATE OR REPLACE FUNCTION increment_pt_visits()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.attendance_status = 'attended' THEN
        UPDATE pt_treatment_plans
        SET visits_used = visits_used + 1
        WHERE id = NEW.treatment_plan_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pt_session_increment_visits
    AFTER INSERT ON pt_treatment_sessions
    FOR EACH ROW
    EXECUTE FUNCTION increment_pt_visits();

-- =====================================================
-- 4. EXERCISE PRESCRIPTION LIBRARY (Evidence-Based)
-- =====================================================

CREATE TABLE IF NOT EXISTS pt_exercise_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Exercise Identification
    exercise_name TEXT NOT NULL,
    exercise_code TEXT UNIQUE, -- Custom coding system
    category TEXT NOT NULL CHECK (category IN (
        'therapeutic_exercise',
        'neuromuscular_reeducation',
        'balance_coordination',
        'gait_training',
        'manual_therapy',
        'modality',
        'functional_training',
        'cardiovascular_endurance',
        'flexibility_rom'
    )),
    subcategory TEXT, -- Upper extremity, lower extremity, core, cardio

    -- Exercise Description
    description TEXT NOT NULL,
    purpose TEXT NOT NULL, -- What it treats
    indications TEXT[], -- When to use
    contraindications TEXT[], -- When NOT to use
    precautions TEXT[], -- Special considerations

    -- Evidence Base
    evidence_level TEXT CHECK (evidence_level IN (
        'level_1a', -- Systematic review of RCTs
        'level_1b', -- Individual RCT
        'level_2a', -- Systematic review of cohort studies
        'level_2b', -- Individual cohort study
        'level_3',  -- Case-control study
        'level_4',  -- Case series
        'level_5',  -- Expert opinion
        'clinical_experience'
    )),
    research_references TEXT[], -- PubMed IDs, DOIs
    clinical_practice_guideline TEXT, -- Which CPG recommends this

    -- Dosage Parameters
    default_sets INTEGER,
    default_reps INTEGER,
    default_hold_seconds INTEGER,
    default_frequency_per_week INTEGER,
    progression_guidelines TEXT, -- How to advance exercise
    regression_options TEXT, -- How to make easier

    -- Media
    demonstration_video_url TEXT,
    patient_handout_url TEXT,
    images TEXT[], -- Exercise demonstration images

    -- Equipment Needed
    equipment_required TEXT[],

    -- Patient Instructions
    patient_instructions TEXT NOT NULL,
    common_errors TEXT[], -- What to watch for

    -- Clinical Notes for Therapist
    therapist_notes TEXT,

    -- Metadata
    created_by UUID REFERENCES profiles(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    approved_for_use BOOLEAN DEFAULT false,
    times_prescribed INTEGER DEFAULT 0 -- Track usage
);

-- Indexes
CREATE INDEX idx_exercise_category ON pt_exercise_library(category);
CREATE INDEX idx_exercise_subcategory ON pt_exercise_library(subcategory);
CREATE INDEX idx_exercise_name_search ON pt_exercise_library USING gin(to_tsvector('english', exercise_name || ' ' || description));

-- =====================================================
-- 5. HOME EXERCISE PROGRAM (HEP) ASSIGNMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS pt_home_exercise_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    treatment_plan_id UUID NOT NULL REFERENCES pt_treatment_plans(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES profiles(user_id),

    -- Program Details
    program_name TEXT NOT NULL,
    prescribed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    last_modified_date DATE,
    active BOOLEAN DEFAULT true,

    -- Exercises in Program
    exercises JSONB NOT NULL, -- Array of exercise prescriptions
    -- Each: {
    --   exercise_id (references pt_exercise_library),
    --   exercise_name,
    --   sets, reps, hold_seconds, frequency_per_week,
    --   special_instructions,
    --   video_link,
    --   order_sequence
    -- }

    -- Patient Instructions
    overall_instructions TEXT,
    frequency_guidance TEXT, -- "Complete daily" or "3x per week"
    time_of_day_recommendation TEXT,
    expected_duration_minutes INTEGER,

    -- Compliance Tracking
    patient_tracking_enabled BOOLEAN DEFAULT false,
    compliance_logs JSONB, -- Patient-reported completion
    -- [{date, exercises_completed, difficulty_rating, pain_during, notes}]

    -- Digital Delivery
    delivery_method TEXT CHECK (delivery_method IN (
        'paper_handout',
        'email_pdf',
        'patient_portal',
        'mobile_app',
        'sms_link',
        'telehealth_demo'
    )),
    sent_to_patient_at TIMESTAMP WITH TIME ZONE,
    patient_acknowledged BOOLEAN DEFAULT false,
    patient_acknowledged_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX idx_hep_patient ON pt_home_exercise_programs(patient_id);
CREATE INDEX idx_hep_active ON pt_home_exercise_programs(active);
CREATE INDEX idx_hep_plan ON pt_home_exercise_programs(treatment_plan_id);

-- =====================================================
-- 6. OUTCOME MEASURES TRACKING (Validated Tools)
-- =====================================================

CREATE TABLE IF NOT EXISTS pt_outcome_measures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES profiles(user_id),
    assessment_id UUID REFERENCES pt_functional_assessments(id) ON DELETE SET NULL,
    session_id UUID REFERENCES pt_treatment_sessions(id) ON DELETE SET NULL,

    -- Measure Details
    measure_name TEXT NOT NULL,
    measure_acronym TEXT NOT NULL, -- LEFS, ODI, DASH, etc.
    body_region TEXT, -- Lower extremity, spine, upper extremity

    -- Psychometric Properties
    mcid NUMERIC, -- Minimal Clinically Important Difference
    mdm NUMERIC, -- Minimal Detectable Change

    -- Administration
    administration_date DATE NOT NULL,
    administration_context TEXT CHECK (administration_context IN (
        'initial_evaluation',
        'interim_reassessment',
        'discharge',
        'follow_up'
    )),

    -- Scoring
    raw_score NUMERIC NOT NULL,
    percentage_score NUMERIC, -- Some tools report as percentage
    interpretation TEXT, -- Mild, moderate, severe disability

    -- Comparison
    previous_score NUMERIC,
    change_from_previous NUMERIC,
    mcid_achieved BOOLEAN, -- Did change exceed MCID?

    -- Evidence Base
    tool_validation_reference TEXT, -- Research supporting tool use
    normative_data_reference TEXT,

    -- Digital
    digital_form_used BOOLEAN DEFAULT false,
    auto_calculated BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX idx_outcome_patient ON pt_outcome_measures(patient_id);
CREATE INDEX idx_outcome_measure_type ON pt_outcome_measures(measure_acronym);
CREATE INDEX idx_outcome_date ON pt_outcome_measures(administration_date DESC);

-- =====================================================
-- 7. PT PERFORMANCE METRICS & QUALITY INDICATORS
-- =====================================================

CREATE TABLE IF NOT EXISTS pt_quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID NOT NULL REFERENCES profiles(user_id),

    -- Reporting Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Patient Outcomes
    avg_functional_improvement NUMERIC, -- Average % improvement on outcome measures
    mcid_achievement_rate NUMERIC, -- % of patients achieving MCID
    discharge_to_prior_level_rate NUMERIC, -- % discharged to prior level of function

    -- Efficiency Metrics
    avg_visits_to_discharge NUMERIC,
    avg_length_of_care_days NUMERIC,
    no_show_rate NUMERIC,
    cancellation_rate NUMERIC,

    -- Documentation Quality
    initial_eval_timeliness_rate NUMERIC, -- % completed within 24 hours
    daily_note_compliance_rate NUMERIC, -- % of sessions with notes
    discharge_summary_completion_rate NUMERIC,

    -- Patient Satisfaction
    avg_satisfaction_score NUMERIC,
    nps_score NUMERIC, -- Net Promoter Score

    -- Safety
    adverse_event_count INTEGER DEFAULT 0,
    fall_count INTEGER DEFAULT 0,

    -- Productivity
    billable_hours NUMERIC,
    productivity_percentage NUMERIC, -- Billable/total hours

    -- Evidence-Based Practice
    cpg_adherence_rate NUMERIC, -- % following clinical practice guidelines
    outcome_measure_usage_rate NUMERIC, -- % of patients with validated measures

    -- Metadata
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    calculation_version TEXT -- Track calculation methodology
);

-- Indexes
CREATE INDEX idx_quality_therapist ON pt_quality_metrics(therapist_id);
CREATE INDEX idx_quality_period ON pt_quality_metrics(period_start, period_end);

-- =====================================================
-- 8. INTERDISCIPLINARY COLLABORATION HUB
-- =====================================================

CREATE TABLE IF NOT EXISTS pt_team_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Communication Details
    from_discipline TEXT NOT NULL CHECK (from_discipline IN (
        'physical_therapy',
        'occupational_therapy',
        'speech_therapy',
        'nursing',
        'physician',
        'social_work',
        'psychology',
        'case_management',
        'pharmacy'
    )),
    to_discipline TEXT NOT NULL,
    from_user_id UUID NOT NULL REFERENCES profiles(user_id),
    to_user_id UUID REFERENCES profiles(user_id),

    -- Message
    communication_type TEXT CHECK (communication_type IN (
        'consultation_request',
        'status_update',
        'discharge_coordination',
        'safety_concern',
        'goal_alignment',
        'equipment_recommendation',
        'patient_education_coordination'
    )),
    message_subject TEXT NOT NULL,
    message_body TEXT NOT NULL,
    priority TEXT CHECK (priority IN ('routine', 'urgent', 'emergent')),

    -- Response
    response_required BOOLEAN DEFAULT false,
    response_by_date DATE,
    response_received BOOLEAN DEFAULT false,
    response_text TEXT,
    responded_by UUID REFERENCES profiles(user_id),
    responded_at TIMESTAMP WITH TIME ZONE,

    -- Action Items
    action_items JSONB, -- Specific tasks resulting from communication

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_pt_comms_patient ON pt_team_communications(patient_id);
CREATE INDEX idx_pt_comms_to_user ON pt_team_communications(to_user_id);
CREATE INDEX idx_pt_comms_priority ON pt_team_communications(priority) WHERE response_received = false;

-- =====================================================
-- 9. TELEHEALTH PT SESSION TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS pt_telehealth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES pt_treatment_sessions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES profiles(user_id),

    -- Platform
    platform_used TEXT CHECK (platform_used IN (
        'zoom',
        'doxy_me',
        'vsee',
        'webex',
        'microsoft_teams',
        'native_platform'
    )),

    -- Technical Quality
    video_quality TEXT CHECK (video_quality IN ('excellent', 'good', 'fair', 'poor')),
    audio_quality TEXT CHECK (audio_quality IN ('excellent', 'good', 'fair', 'poor')),
    technical_issues TEXT,

    -- Clinical Adaptations
    limitations_due_to_virtual JSONB, -- What couldn't be assessed
    adaptations_made TEXT[], -- How PT modified treatment for telehealth

    -- Patient Environment Assessment
    home_safety_observations TEXT,
    equipment_available TEXT[], -- Resistance bands, weights, chair, etc.
    caregiver_present BOOLEAN,
    caregiver_trained BOOLEAN,

    -- Clinical Effectiveness
    virtual_effectiveness_rating INTEGER CHECK (virtual_effectiveness_rating BETWEEN 1 AND 5),
    recommend_return_to_in_person BOOLEAN,

    -- Billing Compliance
    consent_documented BOOLEAN NOT NULL,
    patient_location_verified BOOLEAN NOT NULL, -- For state licensure
    appropriate_for_telehealth_code BOOLEAN NOT NULL, -- CPT modifier 95 or GT

    -- Metadata
    session_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    session_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    recording_consent BOOLEAN DEFAULT false,
    recording_url TEXT
);

-- Indexes
CREATE INDEX idx_tele_patient ON pt_telehealth_sessions(patient_id);
CREATE INDEX idx_tele_therapist ON pt_telehealth_sessions(therapist_id);

-- =====================================================
-- HELPER FUNCTIONS FOR PT WORKFLOW
-- =====================================================

-- Function: Get current active PT patients for a therapist
CREATE OR REPLACE FUNCTION get_active_pt_caseload(p_therapist_id UUID)
RETURNS TABLE (
    patient_id UUID,
    patient_name TEXT,
    diagnosis TEXT,
    visits_used INTEGER,
    visits_remaining INTEGER,
    next_scheduled_visit DATE,
    days_since_last_visit INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.id,
        p.first_name || ' ' || p.last_name,
        ptp.goals->0->>'goal_statement', -- Primary goal as proxy for diagnosis
        ptp.visits_used,
        ptp.visits_remaining,
        CURRENT_DATE, -- Placeholder - would need scheduling table
        CURRENT_DATE - MAX(pts.session_date)::DATE
    FROM pt_treatment_plans ptp
    JOIN patients p ON ptp.patient_id = p.id
    LEFT JOIN pt_treatment_sessions pts ON ptp.id = pts.treatment_plan_id
    WHERE ptp.therapist_id = p_therapist_id
        AND ptp.status = 'active'
    GROUP BY p.id, p.first_name, p.last_name, ptp.goals, ptp.visits_used, ptp.visits_remaining;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate functional improvement percentage
CREATE OR REPLACE FUNCTION calculate_pt_functional_improvement(p_patient_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    initial_score NUMERIC;
    latest_score NUMERIC;
    improvement NUMERIC;
BEGIN
    -- Get initial outcome measure score
    SELECT raw_score INTO initial_score
    FROM pt_outcome_measures
    WHERE patient_id = p_patient_id
        AND administration_context = 'initial_evaluation'
    ORDER BY administration_date ASC
    LIMIT 1;

    -- Get most recent outcome measure score
    SELECT raw_score INTO latest_score
    FROM pt_outcome_measures
    WHERE patient_id = p_patient_id
    ORDER BY administration_date DESC
    LIMIT 1;

    -- Calculate percentage improvement
    IF initial_score IS NOT NULL AND latest_score IS NOT NULL AND initial_score != 0 THEN
        improvement := ((latest_score - initial_score) / initial_score) * 100;
        RETURN improvement;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if patient is ready for discharge based on goals
CREATE OR REPLACE FUNCTION evaluate_pt_discharge_readiness(p_treatment_plan_id UUID)
RETURNS TABLE (
    ready_for_discharge BOOLEAN,
    goals_met_count INTEGER,
    total_goals INTEGER,
    goals_met_percentage NUMERIC,
    recommendations TEXT
) AS $$
DECLARE
    plan_goals JSONB;
    goals_achieved INTEGER;
    total INTEGER;
BEGIN
    -- Get goals from treatment plan
    SELECT goals INTO plan_goals
    FROM pt_treatment_plans
    WHERE id = p_treatment_plan_id;

    -- Count achieved goals
    SELECT
        COUNT(*) FILTER (WHERE (goal->>'achieved')::BOOLEAN = true),
        COUNT(*)
    INTO goals_achieved, total
    FROM jsonb_array_elements(plan_goals) AS goal;

    RETURN QUERY
    SELECT
        goals_achieved::NUMERIC / total >= 0.80, -- 80% threshold for discharge
        goals_achieved,
        total,
        ROUND((goals_achieved::NUMERIC / total * 100), 2),
        CASE
            WHEN goals_achieved::NUMERIC / total >= 0.80 THEN
                'Patient has met discharge criteria. Consider discharge planning.'
            WHEN goals_achieved::NUMERIC / total >= 0.60 THEN
                'Patient is progressing well. Continue treatment with focus on remaining goals.'
            ELSE
                'Patient requires continued skilled therapy. Reassess goals and interventions.'
        END;
END;
$$ LANGUAGE plpgsql;

-- Function: Get PT quality dashboard for therapist
CREATE OR REPLACE FUNCTION get_pt_quality_dashboard(p_therapist_id UUID, p_days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC,
    benchmark NUMERIC,
    performance TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_patients AS (
        SELECT DISTINCT patient_id
        FROM pt_treatment_sessions
        WHERE therapist_id = p_therapist_id
            AND session_date >= CURRENT_DATE - p_days_back
    ),
    outcome_data AS (
        SELECT
            patient_id,
            MAX(raw_score) FILTER (WHERE administration_context = 'discharge') as discharge_score,
            MIN(raw_score) FILTER (WHERE administration_context = 'initial_evaluation') as initial_score
        FROM pt_outcome_measures
        WHERE patient_id IN (SELECT patient_id FROM recent_patients)
        GROUP BY patient_id
    )
    SELECT 'Avg Functional Improvement %'::TEXT,
           AVG((discharge_score - initial_score) / initial_score * 100),
           15.0::NUMERIC,
           CASE WHEN AVG((discharge_score - initial_score) / initial_score * 100) >= 15
                THEN 'Above Benchmark' ELSE 'Below Benchmark' END
    FROM outcome_data
    WHERE initial_score > 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all PT tables
ALTER TABLE pt_functional_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_treatment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_exercise_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_home_exercise_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_outcome_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_team_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_telehealth_sessions ENABLE ROW LEVEL SECURITY;

-- Patients can view their own PT records
CREATE POLICY pt_assessments_patient_view ON pt_functional_assessments
    FOR SELECT USING (
        patient_id = auth.uid()
        OR patient_id IN (
            SELECT patient_id FROM caregiver_view_grants
            WHERE caregiver_id = auth.uid() AND is_active = true
        )
    );

-- PT staff can view and manage their assigned patients
CREATE POLICY pt_assessments_staff_manage ON pt_functional_assessments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (99, 100, 101, 1, 3)
        )
    );

-- Similar policies for other tables (abbreviated for space)
CREATE POLICY pt_plans_patient_view ON pt_treatment_plans FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY pt_plans_staff_manage ON pt_treatment_plans FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role_id IN (99, 100, 101, 1, 3))
);

CREATE POLICY pt_sessions_patient_view ON pt_treatment_sessions FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY pt_sessions_staff_manage ON pt_treatment_sessions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role_id IN (99, 100, 101, 1, 3))
);

CREATE POLICY pt_exercises_all_view ON pt_exercise_library FOR SELECT USING (approved_for_use = true);
CREATE POLICY pt_exercises_staff_manage ON pt_exercise_library FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role_id IN (99, 101, 1, 3))
);

CREATE POLICY pt_hep_patient_view ON pt_home_exercise_programs FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY pt_hep_staff_manage ON pt_home_exercise_programs FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role_id IN (99, 100, 101, 1, 3))
);

CREATE POLICY pt_outcomes_patient_view ON pt_outcome_measures FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY pt_outcomes_staff_manage ON pt_outcome_measures FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role_id IN (99, 101, 1, 3))
);

CREATE POLICY pt_quality_therapist_view ON pt_quality_metrics FOR SELECT USING (
    therapist_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role_id IN (1, 2))
);

CREATE POLICY pt_comms_team_view ON pt_team_communications FOR SELECT USING (
    from_user_id = auth.uid() OR to_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role_id IN (1, 2))
);
CREATE POLICY pt_comms_team_manage ON pt_team_communications FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role_id IN (99, 102, 103, 1, 3))
);

CREATE POLICY pt_tele_patient_view ON pt_telehealth_sessions FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY pt_tele_staff_manage ON pt_telehealth_sessions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role_id IN (99, 101, 1, 3))
);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON pt_functional_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pt_treatment_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pt_treatment_sessions TO authenticated;
GRANT SELECT ON pt_exercise_library TO authenticated;
GRANT INSERT, UPDATE ON pt_exercise_library TO authenticated; -- For PT/admin roles via RLS
GRANT SELECT, INSERT, UPDATE ON pt_home_exercise_programs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pt_outcome_measures TO authenticated;
GRANT SELECT ON pt_quality_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pt_team_communications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pt_telehealth_sessions TO authenticated;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE pt_functional_assessments IS 'Comprehensive PT initial evaluations, interim assessments, and discharge evaluations using ICF framework';
COMMENT ON TABLE pt_treatment_plans IS 'SMART goal-based treatment plans with evidence-based interventions and discharge criteria';
COMMENT ON TABLE pt_treatment_sessions IS 'Daily SOAP notes for PT treatment sessions with billing integration';
COMMENT ON TABLE pt_exercise_library IS 'Evidence-based exercise database with research references and patient instructions';
COMMENT ON TABLE pt_home_exercise_programs IS 'Patient-assigned home exercise programs with digital delivery and compliance tracking';
COMMENT ON TABLE pt_outcome_measures IS 'Validated outcome measure tracking with MCID comparison for evidence-based progress monitoring';
COMMENT ON TABLE pt_quality_metrics IS 'PT quality indicators and performance metrics for continuous improvement';
COMMENT ON TABLE pt_team_communications IS 'Interdisciplinary communication hub for coordinated patient care';
COMMENT ON TABLE pt_telehealth_sessions IS 'Telehealth PT session documentation with platform and clinical adaptation tracking';

COMMENT ON FUNCTION get_active_pt_caseload IS 'Returns therapist caseload with visit utilization and last visit date';
COMMENT ON FUNCTION calculate_pt_functional_improvement IS 'Calculates percentage improvement from initial to latest outcome measure';
COMMENT ON FUNCTION evaluate_pt_discharge_readiness IS 'Evaluates goal achievement percentage and provides discharge recommendations';
COMMENT ON FUNCTION get_pt_quality_dashboard IS 'Returns quality metrics dashboard for therapist performance tracking';
