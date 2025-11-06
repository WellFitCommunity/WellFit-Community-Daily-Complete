-- =====================================================
-- NEUROSUITE: STROKE & DEMENTIA CARE SYSTEM
-- =====================================================
-- Evidence-Based Neurological Care Workflows
-- Stroke: Hyperacute → Acute → Rehab → Maintenance
-- Dementia: Screening → Diagnosis → Care Planning → Caregiver Support
-- =====================================================

-- =====================================================
-- 1. STROKE ASSESSMENTS
-- =====================================================
-- NIH Stroke Scale (NIHSS) - Gold standard for stroke severity

CREATE TABLE IF NOT EXISTS neuro_stroke_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
    assessor_id UUID NOT NULL REFERENCES profiles(user_id),

    -- Assessment Context
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    assessment_type TEXT NOT NULL CHECK (assessment_type IN (
        'baseline',          -- Initial assessment (ED/hyperacute)
        '24_hour',          -- 24 hours post-tPA or thrombectomy
        'discharge',        -- Hospital discharge
        '90_day',           -- 90-day outcome (standard endpoint)
        'annual',           -- Annual follow-up
        'deterioration'     -- Clinical worsening
    )),

    -- Stroke Type
    stroke_type TEXT CHECK (stroke_type IN (
        'ischemic_large_vessel',
        'ischemic_small_vessel',
        'ischemic_cardioembolic',
        'ischemic_cryptogenic',
        'hemorrhagic_intracerebral',
        'hemorrhagic_subarachnoid',
        'tia'
    )),
    stroke_territory TEXT, -- MCA, ACA, PCA, basilar, etc.

    -- Time Critical Information
    last_known_well TIMESTAMP WITH TIME ZONE,
    symptom_onset TIMESTAMP WITH TIME ZONE,
    arrival_time TIMESTAMP WITH TIME ZONE,
    ct_time TIMESTAMP WITH TIME ZONE,
    time_to_assessment_minutes INTEGER,

    -- NIH Stroke Scale (0-42, higher = worse)
    -- 1a. Level of Consciousness
    loc_score INTEGER CHECK (loc_score BETWEEN 0 AND 3),
    -- 1b. LOC Questions (month, age)
    loc_questions_score INTEGER CHECK (loc_questions_score BETWEEN 0 AND 2),
    -- 1c. LOC Commands (open/close eyes, grip/release hand)
    loc_commands_score INTEGER CHECK (loc_commands_score BETWEEN 0 AND 2),
    -- 2. Best Gaze
    best_gaze_score INTEGER CHECK (best_gaze_score BETWEEN 0 AND 2),
    -- 3. Visual Fields
    visual_fields_score INTEGER CHECK (visual_fields_score BETWEEN 0 AND 3),
    -- 4. Facial Palsy
    facial_palsy_score INTEGER CHECK (facial_palsy_score BETWEEN 0 AND 3),
    -- 5a. Left Arm Motor
    left_arm_motor_score INTEGER CHECK (left_arm_motor_score BETWEEN 0 AND 4),
    -- 5b. Right Arm Motor
    right_arm_motor_score INTEGER CHECK (right_arm_motor_score BETWEEN 0 AND 4),
    -- 6a. Left Leg Motor
    left_leg_motor_score INTEGER CHECK (left_leg_motor_score BETWEEN 0 AND 4),
    -- 6b. Right Leg Motor
    right_leg_motor_score INTEGER CHECK (right_leg_motor_score BETWEEN 0 AND 4),
    -- 7. Limb Ataxia
    limb_ataxia_score INTEGER CHECK (limb_ataxia_score BETWEEN 0 AND 2),
    -- 8. Sensory
    sensory_score INTEGER CHECK (sensory_score BETWEEN 0 AND 2),
    -- 9. Best Language
    best_language_score INTEGER CHECK (best_language_score BETWEEN 0 AND 3),
    -- 10. Dysarthria
    dysarthria_score INTEGER CHECK (dysarthria_score BETWEEN 0 AND 2),
    -- 11. Extinction/Inattention
    extinction_inattention_score INTEGER CHECK (extinction_inattention_score BETWEEN 0 AND 2),

    -- Total NIHSS Score (auto-calculated)
    nihss_total_score INTEGER GENERATED ALWAYS AS (
        COALESCE(loc_score, 0) +
        COALESCE(loc_questions_score, 0) +
        COALESCE(loc_commands_score, 0) +
        COALESCE(best_gaze_score, 0) +
        COALESCE(visual_fields_score, 0) +
        COALESCE(facial_palsy_score, 0) +
        COALESCE(left_arm_motor_score, 0) +
        COALESCE(right_arm_motor_score, 0) +
        COALESCE(left_leg_motor_score, 0) +
        COALESCE(right_leg_motor_score, 0) +
        COALESCE(limb_ataxia_score, 0) +
        COALESCE(sensory_score, 0) +
        COALESCE(best_language_score, 0) +
        COALESCE(dysarthria_score, 0) +
        COALESCE(extinction_inattention_score, 0)
    ) STORED,

    -- NIHSS Interpretation
    nihss_severity TEXT GENERATED ALWAYS AS (
        CASE
            WHEN (COALESCE(loc_score, 0) + COALESCE(loc_questions_score, 0) + COALESCE(loc_commands_score, 0) +
                  COALESCE(best_gaze_score, 0) + COALESCE(visual_fields_score, 0) + COALESCE(facial_palsy_score, 0) +
                  COALESCE(left_arm_motor_score, 0) + COALESCE(right_arm_motor_score, 0) + COALESCE(left_leg_motor_score, 0) +
                  COALESCE(right_leg_motor_score, 0) + COALESCE(limb_ataxia_score, 0) + COALESCE(sensory_score, 0) +
                  COALESCE(best_language_score, 0) + COALESCE(dysarthria_score, 0) + COALESCE(extinction_inattention_score, 0)) = 0 THEN 'no_stroke'
            WHEN (COALESCE(loc_score, 0) + COALESCE(loc_questions_score, 0) + COALESCE(loc_commands_score, 0) +
                  COALESCE(best_gaze_score, 0) + COALESCE(visual_fields_score, 0) + COALESCE(facial_palsy_score, 0) +
                  COALESCE(left_arm_motor_score, 0) + COALESCE(right_arm_motor_score, 0) + COALESCE(left_leg_motor_score, 0) +
                  COALESCE(right_leg_motor_score, 0) + COALESCE(limb_ataxia_score, 0) + COALESCE(sensory_score, 0) +
                  COALESCE(best_language_score, 0) + COALESCE(dysarthria_score, 0) + COALESCE(extinction_inattention_score, 0)) BETWEEN 1 AND 4 THEN 'minor_stroke'
            WHEN (COALESCE(loc_score, 0) + COALESCE(loc_questions_score, 0) + COALESCE(loc_commands_score, 0) +
                  COALESCE(best_gaze_score, 0) + COALESCE(visual_fields_score, 0) + COALESCE(facial_palsy_score, 0) +
                  COALESCE(left_arm_motor_score, 0) + COALESCE(right_arm_motor_score, 0) + COALESCE(left_leg_motor_score, 0) +
                  COALESCE(right_leg_motor_score, 0) + COALESCE(limb_ataxia_score, 0) + COALESCE(sensory_score, 0) +
                  COALESCE(best_language_score, 0) + COALESCE(dysarthria_score, 0) + COALESCE(extinction_inattention_score, 0)) BETWEEN 5 AND 15 THEN 'moderate_stroke'
            WHEN (COALESCE(loc_score, 0) + COALESCE(loc_questions_score, 0) + COALESCE(loc_commands_score, 0) +
                  COALESCE(best_gaze_score, 0) + COALESCE(visual_fields_score, 0) + COALESCE(facial_palsy_score, 0) +
                  COALESCE(left_arm_motor_score, 0) + COALESCE(right_arm_motor_score, 0) + COALESCE(left_leg_motor_score, 0) +
                  COALESCE(right_leg_motor_score, 0) + COALESCE(limb_ataxia_score, 0) + COALESCE(sensory_score, 0) +
                  COALESCE(best_language_score, 0) + COALESCE(dysarthria_score, 0) + COALESCE(extinction_inattention_score, 0)) BETWEEN 16 AND 20 THEN 'moderate_severe_stroke'
            ELSE 'severe_stroke'
        END
    ) STORED,

    -- Treatment Decisions
    tpa_eligible BOOLEAN,
    tpa_administered BOOLEAN DEFAULT false,
    tpa_bolus_time TIMESTAMP WITH TIME ZONE,
    thrombectomy_eligible BOOLEAN,
    thrombectomy_performed BOOLEAN DEFAULT false,
    groin_puncture_time TIMESTAMP WITH TIME ZONE,
    recanalization_time TIMESTAMP WITH TIME ZONE,

    -- Clinical Notes
    clinical_notes TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX idx_stroke_assessments_patient ON neuro_stroke_assessments(patient_id);
CREATE INDEX idx_stroke_assessments_date ON neuro_stroke_assessments(assessment_date DESC);
CREATE INDEX idx_stroke_assessments_type ON neuro_stroke_assessments(assessment_type);
CREATE INDEX idx_stroke_assessments_nihss ON neuro_stroke_assessments(nihss_total_score);

-- =====================================================
-- 2. MODIFIED RANKIN SCALE (mRS) - Functional Outcome
-- =====================================================

CREATE TABLE IF NOT EXISTS neuro_modified_rankin_scale (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stroke_assessment_id UUID REFERENCES neuro_stroke_assessments(id) ON DELETE SET NULL,
    assessor_id UUID NOT NULL REFERENCES profiles(user_id),

    -- Assessment Details
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    assessment_timepoint TEXT CHECK (assessment_timepoint IN (
        'pre_stroke',     -- Retrospective pre-stroke function
        'discharge',      -- Hospital discharge
        '90_day',         -- Primary stroke trial endpoint
        '6_month',
        '1_year',
        'annual'
    )),

    -- mRS Score (0-6)
    mrs_score INTEGER NOT NULL CHECK (mrs_score BETWEEN 0 AND 6),
    -- 0 = No symptoms
    -- 1 = No significant disability despite symptoms
    -- 2 = Slight disability; unable to carry out all previous activities but able to look after own affairs without assistance
    -- 3 = Moderate disability; requires some help but able to walk without assistance
    -- 4 = Moderately severe disability; unable to walk and attend to bodily needs without assistance
    -- 5 = Severe disability; bedridden, incontinent, requires constant nursing care
    -- 6 = Dead

    -- Structured Interview Details
    ambulation TEXT, -- Independent, cane, walker, wheelchair, bedridden
    self_care TEXT, -- Independent, needs some help, needs full help
    usual_activities TEXT, -- Can do all, can do some, cannot do
    pain_discomfort TEXT,
    anxiety_depression TEXT,

    -- Clinical Notes
    functional_description TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_mrs_patient ON neuro_modified_rankin_scale(patient_id);
CREATE INDEX idx_mrs_timepoint ON neuro_modified_rankin_scale(assessment_timepoint);
CREATE INDEX idx_mrs_score ON neuro_modified_rankin_scale(mrs_score);

-- =====================================================
-- 3. BARTHEL INDEX - Activities of Daily Living
-- =====================================================

CREATE TABLE IF NOT EXISTS neuro_barthel_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assessor_id UUID NOT NULL REFERENCES profiles(user_id),

    -- Assessment Details
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    -- Barthel Index Items (0-100 scale)
    feeding INTEGER NOT NULL CHECK (feeding IN (0, 5, 10)), -- 0=unable, 5=needs help, 10=independent
    bathing INTEGER NOT NULL CHECK (bathing IN (0, 5)), -- 0=dependent, 5=independent
    grooming INTEGER NOT NULL CHECK (grooming IN (0, 5)),
    dressing INTEGER NOT NULL CHECK (dressing IN (0, 5, 10)),
    bowel_control INTEGER NOT NULL CHECK (bowel_control IN (0, 5, 10)),
    bladder_control INTEGER NOT NULL CHECK (bladder_control IN (0, 5, 10)),
    toilet_use INTEGER NOT NULL CHECK (toilet_use IN (0, 5, 10)),
    transfers INTEGER NOT NULL CHECK (transfers IN (0, 5, 10, 15)), -- Bed/chair
    mobility INTEGER NOT NULL CHECK (mobility IN (0, 5, 10, 15)), -- Walking
    stairs INTEGER NOT NULL CHECK (stairs IN (0, 5, 10)),

    -- Total Score (auto-calculated, 0-100)
    barthel_total INTEGER GENERATED ALWAYS AS (
        feeding + bathing + grooming + dressing + bowel_control +
        bladder_control + toilet_use + transfers + mobility + stairs
    ) STORED,

    -- Interpretation
    barthel_interpretation TEXT GENERATED ALWAYS AS (
        CASE
            WHEN (feeding + bathing + grooming + dressing + bowel_control +
                  bladder_control + toilet_use + transfers + mobility + stairs) >= 90 THEN 'independent'
            WHEN (feeding + bathing + grooming + dressing + bowel_control +
                  bladder_control + toilet_use + transfers + mobility + stairs) BETWEEN 60 AND 89 THEN 'minimal_assistance'
            WHEN (feeding + bathing + grooming + dressing + bowel_control +
                  bladder_control + toilet_use + transfers + mobility + stairs) BETWEEN 40 AND 59 THEN 'moderate_assistance'
            WHEN (feeding + bathing + grooming + dressing + bowel_control +
                  bladder_control + toilet_use + transfers + mobility + stairs) BETWEEN 20 AND 39 THEN 'severe_dependence'
            ELSE 'total_dependence'
        END
    ) STORED,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_barthel_patient ON neuro_barthel_index(patient_id);
CREATE INDEX idx_barthel_date ON neuro_barthel_index(assessment_date DESC);

-- =====================================================
-- 4. DEMENTIA COGNITIVE SCREENING
-- =====================================================
-- Montreal Cognitive Assessment (MoCA) & Mini-Mental State Exam (MMSE)

CREATE TABLE IF NOT EXISTS neuro_cognitive_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assessor_id UUID NOT NULL REFERENCES profiles(user_id),
    encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,

    -- Assessment Details
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    assessment_tool TEXT NOT NULL CHECK (assessment_tool IN ('MoCA', 'MMSE', 'SLUMS', 'Mini-Cog')),

    -- Patient Education Level (for MoCA scoring adjustment)
    years_education INTEGER,
    education_adjustment_applied BOOLEAN DEFAULT false,

    -- MoCA Scoring (0-30, ≥26 = normal)
    moca_visuospatial INTEGER CHECK (moca_visuospatial BETWEEN 0 AND 5), -- Trail making, cube, clock
    moca_naming INTEGER CHECK (moca_naming BETWEEN 0 AND 3), -- Lion, rhino, camel
    moca_attention INTEGER CHECK (moca_attention BETWEEN 0 AND 6), -- Digits, tapping, serial 7s
    moca_language INTEGER CHECK (moca_language BETWEEN 0 AND 3), -- Repeat sentences, fluency
    moca_abstraction INTEGER CHECK (moca_abstraction BETWEEN 0 AND 2), -- Similarities
    moca_delayed_recall INTEGER CHECK (moca_delayed_recall BETWEEN 0 AND 5), -- 5 words
    moca_orientation INTEGER CHECK (moca_orientation BETWEEN 0 AND 6), -- Date, place

    -- MoCA Total (auto-calculated, +1 if education ≤12 years)
    moca_total_score INTEGER GENERATED ALWAYS AS (
        COALESCE(moca_visuospatial, 0) + COALESCE(moca_naming, 0) +
        COALESCE(moca_attention, 0) + COALESCE(moca_language, 0) +
        COALESCE(moca_abstraction, 0) + COALESCE(moca_delayed_recall, 0) +
        COALESCE(moca_orientation, 0) +
        CASE WHEN years_education <= 12 AND education_adjustment_applied THEN 1 ELSE 0 END
    ) STORED,

    -- MMSE Scoring (0-30, ≥24 = normal)
    mmse_orientation_time INTEGER CHECK (mmse_orientation_time BETWEEN 0 AND 5),
    mmse_orientation_place INTEGER CHECK (mmse_orientation_place BETWEEN 0 AND 5),
    mmse_registration INTEGER CHECK (mmse_registration BETWEEN 0 AND 3),
    mmse_attention_calculation INTEGER CHECK (mmse_attention_calculation BETWEEN 0 AND 5),
    mmse_recall INTEGER CHECK (mmse_recall BETWEEN 0 AND 3),
    mmse_naming INTEGER CHECK (mmse_naming BETWEEN 0 AND 2),
    mmse_repetition INTEGER CHECK (mmse_repetition BETWEEN 0 AND 1),
    mmse_comprehension INTEGER CHECK (mmse_comprehension BETWEEN 0 AND 3),
    mmse_reading INTEGER CHECK (mmse_reading BETWEEN 0 AND 1),
    mmse_writing INTEGER CHECK (mmse_writing BETWEEN 0 AND 1),
    mmse_drawing INTEGER CHECK (mmse_drawing BETWEEN 0 AND 1),

    -- MMSE Total (auto-calculated)
    mmse_total_score INTEGER GENERATED ALWAYS AS (
        COALESCE(mmse_orientation_time, 0) + COALESCE(mmse_orientation_place, 0) +
        COALESCE(mmse_registration, 0) + COALESCE(mmse_attention_calculation, 0) +
        COALESCE(mmse_recall, 0) + COALESCE(mmse_naming, 0) +
        COALESCE(mmse_repetition, 0) + COALESCE(mmse_comprehension, 0) +
        COALESCE(mmse_reading, 0) + COALESCE(mmse_writing, 0) +
        COALESCE(mmse_drawing, 0)
    ) STORED,

    -- Cognitive Interpretation
    cognitive_status TEXT,
    concerns_noted TEXT[],

    -- Clinical Notes
    behavioral_observations TEXT,
    informant_report TEXT, -- Collateral history from family

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_cognitive_patient ON neuro_cognitive_assessments(patient_id);
CREATE INDEX idx_cognitive_tool ON neuro_cognitive_assessments(assessment_tool);
CREATE INDEX idx_cognitive_date ON neuro_cognitive_assessments(assessment_date DESC);

-- =====================================================
-- 5. CLINICAL DEMENTIA RATING (CDR) SCALE
-- =====================================================
-- Gold standard for dementia staging

CREATE TABLE IF NOT EXISTS neuro_dementia_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assessor_id UUID NOT NULL REFERENCES profiles(user_id),

    -- Assessment Details
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    -- CDR Domains (0, 0.5, 1, 2, 3)
    cdr_memory NUMERIC(2,1) NOT NULL CHECK (cdr_memory IN (0, 0.5, 1, 2, 3)),
    cdr_orientation NUMERIC(2,1) NOT NULL CHECK (cdr_orientation IN (0, 0.5, 1, 2, 3)),
    cdr_judgment_problem_solving NUMERIC(2,1) NOT NULL CHECK (cdr_judgment_problem_solving IN (0, 0.5, 1, 2, 3)),
    cdr_community_affairs NUMERIC(2,1) NOT NULL CHECK (cdr_community_affairs IN (0, 0.5, 1, 2, 3)),
    cdr_home_hobbies NUMERIC(2,1) NOT NULL CHECK (cdr_home_hobbies IN (0, 0.5, 1, 2, 3)),
    cdr_personal_care NUMERIC(2,1) NOT NULL CHECK (cdr_personal_care IN (0, 0.5, 1, 2, 3)),

    -- CDR Global Score (algorithm-based, not simple average)
    cdr_global_score NUMERIC(2,1) NOT NULL CHECK (cdr_global_score IN (0, 0.5, 1, 2, 3)),

    -- CDR Sum of Boxes (0-18, used for tracking change)
    cdr_sum_boxes NUMERIC(3,1) GENERATED ALWAYS AS (
        cdr_memory + cdr_orientation + cdr_judgment_problem_solving +
        cdr_community_affairs + cdr_home_hobbies + cdr_personal_care
    ) STORED,

    -- Dementia Severity
    dementia_stage TEXT GENERATED ALWAYS AS (
        CASE cdr_global_score
            WHEN 0 THEN 'no_dementia'
            WHEN 0.5 THEN 'questionable_dementia_mci'
            WHEN 1 THEN 'mild_dementia'
            WHEN 2 THEN 'moderate_dementia'
            WHEN 3 THEN 'severe_dementia'
        END
    ) STORED,

    -- Informant Details
    informant_name TEXT,
    informant_relationship TEXT,
    informant_contact_frequency TEXT,

    -- Clinical Notes
    functional_decline_examples TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_dementia_staging_patient ON neuro_dementia_staging(patient_id);
CREATE INDEX idx_dementia_staging_date ON neuro_dementia_staging(assessment_date DESC);
CREATE INDEX idx_dementia_cdr_global ON neuro_dementia_staging(cdr_global_score);

-- =====================================================
-- 6. CAREGIVER BURDEN ASSESSMENT (Zarit Burden Interview)
-- =====================================================

CREATE TABLE IF NOT EXISTS neuro_caregiver_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    caregiver_id UUID REFERENCES profiles(user_id), -- If caregiver has account
    assessor_id UUID NOT NULL REFERENCES profiles(user_id),

    -- Assessment Details
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    -- Caregiver Information
    caregiver_name TEXT NOT NULL,
    caregiver_relationship TEXT NOT NULL,
    caregiver_lives_with_patient BOOLEAN,
    hours_caregiving_per_week NUMERIC(5,2),
    other_caregivers_available BOOLEAN,

    -- Zarit Burden Interview (Short Form - 12 items, 0-48)
    -- Each item: 0=Never, 1=Rarely, 2=Sometimes, 3=Quite Frequently, 4=Nearly Always
    zbi_feel_strain INTEGER CHECK (zbi_feel_strain BETWEEN 0 AND 4),
    zbi_time_affected INTEGER CHECK (zbi_time_affected BETWEEN 0 AND 4),
    zbi_stressed INTEGER CHECK (zbi_stressed BETWEEN 0 AND 4),
    zbi_embarrassed INTEGER CHECK (zbi_embarrassed BETWEEN 0 AND 4),
    zbi_angry INTEGER CHECK (zbi_angry BETWEEN 0 AND 4),
    zbi_relationships_affected INTEGER CHECK (zbi_relationships_affected BETWEEN 0 AND 4),
    zbi_health_suffered INTEGER CHECK (zbi_health_suffered BETWEEN 0 AND 4),
    zbi_privacy_affected INTEGER CHECK (zbi_privacy_affected BETWEEN 0 AND 4),
    zbi_social_life_affected INTEGER CHECK (zbi_social_life_affected BETWEEN 0 AND 4),
    zbi_lost_control INTEGER CHECK (zbi_lost_control BETWEEN 0 AND 4),
    zbi_uncertain_what_to_do INTEGER CHECK (zbi_uncertain_what_to_do BETWEEN 0 AND 4),
    zbi_should_do_more INTEGER CHECK (zbi_should_do_more BETWEEN 0 AND 4),

    -- Total Score (auto-calculated, 0-48)
    zbi_total_score INTEGER GENERATED ALWAYS AS (
        COALESCE(zbi_feel_strain, 0) + COALESCE(zbi_time_affected, 0) +
        COALESCE(zbi_stressed, 0) + COALESCE(zbi_embarrassed, 0) +
        COALESCE(zbi_angry, 0) + COALESCE(zbi_relationships_affected, 0) +
        COALESCE(zbi_health_suffered, 0) + COALESCE(zbi_privacy_affected, 0) +
        COALESCE(zbi_social_life_affected, 0) + COALESCE(zbi_lost_control, 0) +
        COALESCE(zbi_uncertain_what_to_do, 0) + COALESCE(zbi_should_do_more, 0)
    ) STORED,

    -- Burden Level
    burden_level TEXT GENERATED ALWAYS AS (
        CASE
            WHEN (COALESCE(zbi_feel_strain, 0) + COALESCE(zbi_time_affected, 0) +
                  COALESCE(zbi_stressed, 0) + COALESCE(zbi_embarrassed, 0) +
                  COALESCE(zbi_angry, 0) + COALESCE(zbi_relationships_affected, 0) +
                  COALESCE(zbi_health_suffered, 0) + COALESCE(zbi_privacy_affected, 0) +
                  COALESCE(zbi_social_life_affected, 0) + COALESCE(zbi_lost_control, 0) +
                  COALESCE(zbi_uncertain_what_to_do, 0) + COALESCE(zbi_should_do_more, 0)) <= 10 THEN 'little_no_burden'
            WHEN (COALESCE(zbi_feel_strain, 0) + COALESCE(zbi_time_affected, 0) +
                  COALESCE(zbi_stressed, 0) + COALESCE(zbi_embarrassed, 0) +
                  COALESCE(zbi_angry, 0) + COALESCE(zbi_relationships_affected, 0) +
                  COALESCE(zbi_health_suffered, 0) + COALESCE(zbi_privacy_affected, 0) +
                  COALESCE(zbi_social_life_affected, 0) + COALESCE(zbi_lost_control, 0) +
                  COALESCE(zbi_uncertain_what_to_do, 0) + COALESCE(zbi_should_do_more, 0)) BETWEEN 11 AND 20 THEN 'mild_moderate_burden'
            ELSE 'moderate_severe_burden'
        END
    ) STORED,

    -- Support Needs Assessment
    respite_care_needed BOOLEAN,
    support_group_interest BOOLEAN,
    counseling_needed BOOLEAN,
    financial_assistance_needed BOOLEAN,

    -- Clinical Notes
    caregiver_concerns TEXT,
    interventions_recommended TEXT[],

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_caregiver_assessments_patient ON neuro_caregiver_assessments(patient_id);
CREATE INDEX idx_caregiver_assessments_caregiver ON neuro_caregiver_assessments(caregiver_id);
CREATE INDEX idx_caregiver_burden_level ON neuro_caregiver_assessments(burden_level);

-- =====================================================
-- 7. NEURO CARE PLANS
-- =====================================================
-- Specialized care plans for stroke and dementia

CREATE TABLE IF NOT EXISTS neuro_care_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fhir_care_plan_id UUID REFERENCES fhir_care_plans(id) ON DELETE SET NULL,

    -- Care Plan Type
    care_plan_type TEXT NOT NULL CHECK (care_plan_type IN (
        'acute_stroke',
        'stroke_rehab',
        'stroke_secondary_prevention',
        'dementia_early_stage',
        'dementia_moderate_stage',
        'dementia_advanced_stage',
        'mci_monitoring'
    )),

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'draft',
        'active',
        'on_hold',
        'completed',
        'cancelled'
    )),

    -- Timeline
    start_date DATE NOT NULL,
    projected_end_date DATE,
    actual_end_date DATE,

    -- Stroke-Specific
    stroke_prevention_medications JSONB, -- Antiplatelet, anticoagulant, statin
    blood_pressure_target TEXT,
    cholesterol_target TEXT,
    diabetes_management_plan TEXT,
    smoking_cessation_plan TEXT,

    -- Dementia-Specific
    cognitive_stimulation_activities JSONB,
    behavioral_management_strategies JSONB,
    medication_management_plan TEXT, -- Cholinesterase inhibitors, etc.
    safety_interventions JSONB, -- Wandering prevention, fall prevention
    advance_directive_status TEXT,
    legal_planning_status TEXT, -- POA, living will

    -- Goals
    patient_goals JSONB,
    family_goals JSONB,

    -- Care Team
    neurologist_id UUID REFERENCES profiles(user_id),
    primary_care_id UUID REFERENCES profiles(user_id),
    case_manager_id UUID REFERENCES profiles(user_id),
    social_worker_id UUID REFERENCES profiles(user_id),

    -- Monitoring
    follow_up_schedule JSONB,
    imaging_schedule JSONB,
    lab_monitoring_schedule JSONB,

    -- Education Provided
    patient_education_completed JSONB,
    caregiver_education_completed JSONB,

    -- Metadata
    created_by UUID NOT NULL REFERENCES profiles(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_neuro_care_plans_patient ON neuro_care_plans(patient_id);
CREATE INDEX idx_neuro_care_plans_type ON neuro_care_plans(care_plan_type);
CREATE INDEX idx_neuro_care_plans_status ON neuro_care_plans(status);

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER neuro_stroke_assessments_updated_at
    BEFORE UPDATE ON neuro_stroke_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER neuro_care_plans_updated_at
    BEFORE UPDATE ON neuro_care_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS
ALTER TABLE neuro_stroke_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuro_modified_rankin_scale ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuro_barthel_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuro_cognitive_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuro_dementia_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuro_caregiver_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuro_care_plans ENABLE ROW LEVEL SECURITY;

-- Patients can view their own assessments
CREATE POLICY neuro_stroke_patient_view ON neuro_stroke_assessments
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY neuro_mrs_patient_view ON neuro_modified_rankin_scale
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY neuro_barthel_patient_view ON neuro_barthel_index
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY neuro_cognitive_patient_view ON neuro_cognitive_assessments
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY neuro_dementia_patient_view ON neuro_dementia_staging
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY neuro_caregiver_patient_view ON neuro_caregiver_assessments
    FOR SELECT USING (patient_id = auth.uid() OR caregiver_id = auth.uid());

CREATE POLICY neuro_care_plans_patient_view ON neuro_care_plans
    FOR SELECT USING (patient_id = auth.uid());

-- Clinical staff can manage all neuro assessments
-- role_id: 1=admin, 2=super_admin, 3=staff, 99=PT, 101=DPT, 105=Neurologist
CREATE POLICY neuro_stroke_staff_manage ON neuro_stroke_assessments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (1, 2, 3, 99, 101, 105)
        )
    );

CREATE POLICY neuro_mrs_staff_manage ON neuro_modified_rankin_scale
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (1, 2, 3, 99, 101, 105)
        )
    );

CREATE POLICY neuro_barthel_staff_manage ON neuro_barthel_index
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (1, 2, 3, 99, 101, 105)
        )
    );

CREATE POLICY neuro_cognitive_staff_manage ON neuro_cognitive_assessments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (1, 2, 3, 105)
        )
    );

CREATE POLICY neuro_dementia_staff_manage ON neuro_dementia_staging
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (1, 2, 3, 105)
        )
    );

CREATE POLICY neuro_caregiver_staff_manage ON neuro_caregiver_assessments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (1, 2, 3, 105)
        )
    );

CREATE POLICY neuro_care_plans_staff_manage ON neuro_care_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (1, 2, 3, 105)
        )
    );

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON neuro_stroke_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON neuro_modified_rankin_scale TO authenticated;
GRANT SELECT, INSERT, UPDATE ON neuro_barthel_index TO authenticated;
GRANT SELECT, INSERT, UPDATE ON neuro_cognitive_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON neuro_dementia_staging TO authenticated;
GRANT SELECT, INSERT, UPDATE ON neuro_caregiver_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON neuro_care_plans TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE neuro_stroke_assessments IS 'NIH Stroke Scale assessments for stroke severity tracking';
COMMENT ON TABLE neuro_modified_rankin_scale IS 'Modified Rankin Scale for functional outcome measurement';
COMMENT ON TABLE neuro_barthel_index IS 'Barthel Index for ADL independence tracking';
COMMENT ON TABLE neuro_cognitive_assessments IS 'MoCA and MMSE cognitive screening for dementia';
COMMENT ON TABLE neuro_dementia_staging IS 'Clinical Dementia Rating (CDR) scale for dementia severity';
COMMENT ON TABLE neuro_caregiver_assessments IS 'Zarit Burden Interview for caregiver support needs';
COMMENT ON TABLE neuro_care_plans IS 'Specialized care plans for stroke and dementia patients';
