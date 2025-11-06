-- =====================================================
-- PARKINSON'S DISEASE MANAGEMENT SYSTEM
-- =====================================================
-- ROBERT & FORBES Comprehensive Care Framework
-- Includes UPDRS, medication tracking, motor monitoring
-- =====================================================

-- =====================================================
-- 1. PARKINSONS PATIENT REGISTRY
-- =====================================================

CREATE TABLE IF NOT EXISTS parkinsons_patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Diagnosis Details
    diagnosis_date DATE NOT NULL,
    parkinsons_type TEXT CHECK (parkinsons_type IN (
        'idiopathic',
        'young_onset', -- <50 years
        'genetic', -- LRRK2, GBA, SNCA mutations
        'drug_induced',
        'vascular',
        'atypical' -- MSA, PSP, CBD
    )),
    genetic_testing_done BOOLEAN DEFAULT false,
    genetic_mutations TEXT[], -- ['GBA', 'LRRK2', 'SNCA']

    -- Current Stage
    hoehn_yahr_stage NUMERIC(2,1) CHECK (hoehn_yahr_stage BETWEEN 0 AND 5), -- 0, 0.5, 1, 1.5, ..., 5
    schwab_england_adl_pct INTEGER CHECK (schwab_england_adl_pct BETWEEN 0 AND 100),

    -- Care Team
    neurologist_id UUID REFERENCES auth.users(id),
    movement_disorder_specialist_id UUID REFERENCES auth.users(id),
    primary_caregiver_id UUID REFERENCES auth.users(id),

    -- Treatment History
    levodopa_start_date DATE,
    years_on_levodopa NUMERIC(4,2), -- Auto-calculated
    dbs_implant BOOLEAN DEFAULT false,
    dbs_date DATE,
    dbs_target TEXT CHECK (dbs_target IN ('STN', 'GPi', 'VIM', 'none')),

    -- Clinical Trial Participation
    in_clinical_trial BOOLEAN DEFAULT false,
    trial_name TEXT,
    trial_drug TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    UNIQUE(patient_id)
);

CREATE INDEX idx_parkinsons_patients_patient ON parkinsons_patients(patient_id);
CREATE INDEX idx_parkinsons_patients_neurologist ON parkinsons_patients(neurologist_id);
CREATE INDEX idx_parkinsons_patients_stage ON parkinsons_patients(hoehn_yahr_stage);

-- =====================================================
-- 2. UPDRS ASSESSMENTS (Unified Parkinson's Disease Rating Scale)
-- =====================================================

CREATE TABLE IF NOT EXISTS parkinsons_updrs_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assessor_id UUID NOT NULL REFERENCES auth.users(id),
    assessment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    assessment_setting TEXT CHECK (assessment_setting IN ('clinic', 'home', 'telehealth')),

    -- Part I: Non-Motor Aspects of Daily Living (13 items, 0-52 total)
    cognitive_impairment INTEGER CHECK (cognitive_impairment BETWEEN 0 AND 4),
    hallucinations_psychosis INTEGER CHECK (hallucinations_psychosis BETWEEN 0 AND 4),
    depressed_mood INTEGER CHECK (depressed_mood BETWEEN 0 AND 4),
    anxious_mood INTEGER CHECK (anxious_mood BETWEEN 0 AND 4),
    apathy INTEGER CHECK (apathy BETWEEN 0 AND 4),
    dopamine_dysregulation INTEGER CHECK (dopamine_dysregulation BETWEEN 0 AND 4),
    sleep_problems INTEGER CHECK (sleep_problems BETWEEN 0 AND 4),
    daytime_sleepiness INTEGER CHECK (daytime_sleepiness BETWEEN 0 AND 4),
    pain_discomfort INTEGER CHECK (pain_discomfort BETWEEN 0 AND 4),
    urinary_problems INTEGER CHECK (urinary_problems BETWEEN 0 AND 4),
    constipation INTEGER CHECK (constipation BETWEEN 0 AND 4),
    lightheadedness INTEGER CHECK (lightheadedness BETWEEN 0 AND 4),
    fatigue INTEGER CHECK (fatigue BETWEEN 0 AND 4),
    part_i_total INTEGER GENERATED ALWAYS AS (
        COALESCE(cognitive_impairment, 0) + COALESCE(hallucinations_psychosis, 0) +
        COALESCE(depressed_mood, 0) + COALESCE(anxious_mood, 0) + COALESCE(apathy, 0) +
        COALESCE(dopamine_dysregulation, 0) + COALESCE(sleep_problems, 0) +
        COALESCE(daytime_sleepiness, 0) + COALESCE(pain_discomfort, 0) +
        COALESCE(urinary_problems, 0) + COALESCE(constipation, 0) +
        COALESCE(lightheadedness, 0) + COALESCE(fatigue, 0)
    ) STORED,

    -- Part II: Motor Aspects of Daily Living (13 items, 0-52 total)
    speech INTEGER CHECK (speech BETWEEN 0 AND 4),
    saliva_drooling INTEGER CHECK (saliva_drooling BETWEEN 0 AND 4),
    chewing_swallowing INTEGER CHECK (chewing_swallowing BETWEEN 0 AND 4),
    eating_tasks INTEGER CHECK (eating_tasks BETWEEN 0 AND 4),
    dressing INTEGER CHECK (dressing BETWEEN 0 AND 4),
    hygiene INTEGER CHECK (hygiene BETWEEN 0 AND 4),
    handwriting INTEGER CHECK (handwriting BETWEEN 0 AND 4),
    hobbies INTEGER CHECK (hobbies BETWEEN 0 AND 4),
    turning_in_bed INTEGER CHECK (turning_in_bed BETWEEN 0 AND 4),
    tremor INTEGER CHECK (tremor BETWEEN 0 AND 4),
    getting_out_chair INTEGER CHECK (getting_out_chair BETWEEN 0 AND 4),
    walking_balance INTEGER CHECK (walking_balance BETWEEN 0 AND 4),
    freezing INTEGER CHECK (freezing BETWEEN 0 AND 4),
    part_ii_total INTEGER GENERATED ALWAYS AS (
        COALESCE(speech, 0) + COALESCE(saliva_drooling, 0) + COALESCE(chewing_swallowing, 0) +
        COALESCE(eating_tasks, 0) + COALESCE(dressing, 0) + COALESCE(hygiene, 0) +
        COALESCE(handwriting, 0) + COALESCE(hobbies, 0) + COALESCE(turning_in_bed, 0) +
        COALESCE(tremor, 0) + COALESCE(getting_out_chair, 0) + COALESCE(walking_balance, 0) +
        COALESCE(freezing, 0)
    ) STORED,

    -- Part III: Motor Examination (stored as JSONB for detailed scoring)
    part_iii_scores JSONB, -- 33 items scored by clinician
    part_iii_total INTEGER CHECK (part_iii_total BETWEEN 0 AND 132),

    -- Part IV: Motor Complications (6 items, 0-24 total)
    time_with_dyskinesias INTEGER CHECK (time_with_dyskinesias BETWEEN 0 AND 4),
    functional_impact_dyskinesias INTEGER CHECK (functional_impact_dyskinesias BETWEEN 0 AND 4),
    time_off INTEGER CHECK (time_off BETWEEN 0 AND 4),
    functional_impact_off INTEGER CHECK (functional_impact_off BETWEEN 0 AND 4),
    motor_fluctuations_complexity INTEGER CHECK (motor_fluctuations_complexity BETWEEN 0 AND 4),
    painful_off_dystonia INTEGER CHECK (painful_off_dystonia BETWEEN 0 AND 4),
    part_iv_total INTEGER GENERATED ALWAYS AS (
        COALESCE(time_with_dyskinesias, 0) + COALESCE(functional_impact_dyskinesias, 0) +
        COALESCE(time_off, 0) + COALESCE(functional_impact_off, 0) +
        COALESCE(motor_fluctuations_complexity, 0) + COALESCE(painful_off_dystonia, 0)
    ) STORED,

    -- Total UPDRS Score (0-260) - cannot reference generated columns, so calculate directly
    updrs_total_score INTEGER,

    -- Medication State During Assessment
    medication_state TEXT CHECK (medication_state IN ('ON', 'OFF', 'wearing_off')),
    hours_since_last_dose NUMERIC(4,2),

    -- Clinical Notes
    clinical_notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_updrs_patient ON parkinsons_updrs_assessments(patient_id);
CREATE INDEX idx_updrs_date ON parkinsons_updrs_assessments(assessment_date DESC);
CREATE INDEX idx_updrs_total ON parkinsons_updrs_assessments(updrs_total_score);

-- =====================================================
-- 3. PARKINSONS MEDICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS parkinsons_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Medication Details
    medication_name TEXT NOT NULL, -- 'Carbidopa/Levodopa', 'Pramipexole', etc.
    generic_name TEXT, -- 'levodopa', 'pramipexole'
    brand_name TEXT, -- 'Sinemet', 'Mirapex'
    medication_class TEXT CHECK (medication_class IN (
        'levodopa',
        'dopamine_agonist',
        'mao_b_inhibitor',
        'comt_inhibitor',
        'amantadine',
        'anticholinergic',
        'antipsychotic',
        'antidepressant',
        'other'
    )),

    -- Dosing
    dose_amount TEXT, -- '25/100mg', '0.5mg'
    dose_unit TEXT, -- 'mg', 'mcg', 'mg/24hr' (for patches)
    frequency TEXT, -- 'TID', 'QID', 'q4h', 'daily'
    times_per_day INTEGER,
    scheduled_times TEXT[], -- ['08:00', '12:00', '16:00', '20:00']

    -- Instructions
    take_with_food BOOLEAN,
    protein_spacing BOOLEAN DEFAULT false, -- For levodopa
    special_instructions TEXT,

    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,

    -- Prescriber
    prescribed_by UUID REFERENCES auth.users(id),

    -- Side Effects Tracking
    side_effects TEXT[],
    side_effect_severity TEXT CHECK (side_effect_severity IN ('mild', 'moderate', 'severe')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_parkinsons_meds_patient ON parkinsons_medications(patient_id);
CREATE INDEX idx_parkinsons_meds_active ON parkinsons_medications(is_active) WHERE is_active = true;
CREATE INDEX idx_parkinsons_meds_class ON parkinsons_medications(medication_class);

-- =====================================================
-- 4. MEDICATION LOG (Adherence & ON/OFF Tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS parkinsons_medication_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES parkinsons_medications(id) ON DELETE CASCADE,

    -- Dose Details
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_time TIMESTAMP WITH TIME ZONE,
    dose_taken BOOLEAN DEFAULT true,
    dose_amount TEXT,

    -- Symptom State (30 min after dose)
    symptom_state_30min TEXT CHECK (symptom_state_30min IN ('ON', 'partial_ON', 'OFF')),
    symptom_state_60min TEXT CHECK (symptom_state_60min IN ('ON', 'partial_ON', 'OFF')),
    symptom_state_120min TEXT CHECK (symptom_state_120min IN ('ON', 'partial_ON', 'OFF')),

    -- Dyskinesia Tracking
    dyskinesias_present BOOLEAN,
    dyskinesia_severity TEXT CHECK (dyskinesia_severity IN ('mild', 'moderate', 'severe')),

    -- Notes
    patient_notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_med_log_patient ON parkinsons_medication_log(patient_id);
CREATE INDEX idx_med_log_scheduled ON parkinsons_medication_log(scheduled_time DESC);
CREATE INDEX idx_med_log_adherence ON parkinsons_medication_log(dose_taken);

-- =====================================================
-- 5. DAILY SYMPTOM DIARY
-- =====================================================

CREATE TABLE IF NOT EXISTS parkinsons_symptom_diary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    diary_date DATE NOT NULL,

    -- Time in Each State (hours)
    hours_on_no_dyskinesia NUMERIC(4,2) CHECK (hours_on_no_dyskinesia BETWEEN 0 AND 24),
    hours_on_with_dyskinesia NUMERIC(4,2) CHECK (hours_on_with_dyskinesia BETWEEN 0 AND 24),
    hours_off NUMERIC(4,2) CHECK (hours_off BETWEEN 0 AND 24),
    hours_asleep NUMERIC(4,2) CHECK (hours_asleep BETWEEN 0 AND 24),

    -- Total hours validation (should add up to ~24)
    total_hours_logged NUMERIC(4,2) GENERATED ALWAYS AS (
        COALESCE(hours_on_no_dyskinesia, 0) + COALESCE(hours_on_with_dyskinesia, 0) +
        COALESCE(hours_off, 0) + COALESCE(hours_asleep, 0)
    ) STORED,

    -- Symptom Severity (0-10 scale)
    tremor_severity INTEGER CHECK (tremor_severity BETWEEN 0 AND 10),
    rigidity_severity INTEGER CHECK (rigidity_severity BETWEEN 0 AND 10),
    bradykinesia_severity INTEGER CHECK (bradykinesia_severity BETWEEN 0 AND 10),
    balance_problems INTEGER CHECK (balance_problems BETWEEN 0 AND 10),

    -- Freezing of Gait Events
    fog_episodes_count INTEGER DEFAULT 0,
    falls_count INTEGER DEFAULT 0,

    -- Non-Motor Symptoms
    mood_rating INTEGER CHECK (mood_rating BETWEEN 1 AND 10), -- 1=terrible, 10=excellent
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
    constipation BOOLEAN,
    urinary_urgency BOOLEAN,

    -- Exercise & Activity
    minutes_exercised INTEGER,
    exercise_type TEXT,
    steps_count INTEGER,

    -- Free Text
    daily_notes TEXT,

    -- Wearable Data Linked
    wearable_data_synced BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    UNIQUE(patient_id, diary_date)
);

CREATE INDEX idx_symptom_diary_patient ON parkinsons_symptom_diary(patient_id);
CREATE INDEX idx_symptom_diary_date ON parkinsons_symptom_diary(diary_date DESC);

-- =====================================================
-- 6. ROBERT FRAMEWORK TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS parkinsons_robert_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tracking_date DATE NOT NULL,

    -- R: Rhythm & Movement Optimization
    gait_speed_cm_per_sec NUMERIC(6,2),
    step_length_cm NUMERIC(6,2),
    cadence_steps_per_min INTEGER,
    tremor_episodes_count INTEGER DEFAULT 0,
    tremor_avg_frequency_hz NUMERIC(4,2),
    balance_score INTEGER CHECK (balance_score BETWEEN 0 AND 100), -- Berg Balance Scale

    -- O: Optimization of Medication Timing
    medication_adherence_pct INTEGER CHECK (medication_adherence_pct BETWEEN 0 AND 100),
    on_time_hours NUMERIC(4,2),
    off_time_hours NUMERIC(4,2),
    wearing_off_episodes INTEGER DEFAULT 0,

    -- B: Bradykinesia & Rigidity Tracking
    finger_tap_count_left INTEGER, -- 30 seconds
    finger_tap_count_right INTEGER,
    hand_opening_speed_left NUMERIC(4,2), -- seconds per cycle
    hand_opening_speed_right NUMERIC(4,2),
    rigidity_score_left INTEGER CHECK (rigidity_score_left BETWEEN 0 AND 4),
    rigidity_score_right INTEGER CHECK (rigidity_score_right BETWEEN 0 AND 4),

    -- E: Exercise & Physical Therapy
    lsvt_big_session_completed BOOLEAN DEFAULT false,
    lsvt_loud_session_completed BOOLEAN DEFAULT false,
    minutes_pt_exercises INTEGER,
    minutes_aerobic_exercise INTEGER,
    minutes_balance_exercises INTEGER,
    exercise_compliance_pct INTEGER CHECK (exercise_compliance_pct BETWEEN 0 AND 100),

    -- R: Real-Time Symptom Monitoring (from wearables)
    fall_detected_count INTEGER DEFAULT 0,
    dyskinesia_episodes_detected INTEGER DEFAULT 0,
    fog_episodes_detected INTEGER DEFAULT 0,
    avg_sleep_quality_score INTEGER CHECK (avg_sleep_quality_score BETWEEN 0 AND 100),

    -- T: Therapeutic Interventions (logged)
    medication_adjustments_made BOOLEAN DEFAULT false,
    medication_adjustment_notes TEXT,
    side_effects_reported TEXT[],

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    UNIQUE(patient_id, tracking_date)
);

CREATE INDEX idx_robert_tracking_patient ON parkinsons_robert_tracking(patient_id);
CREATE INDEX idx_robert_tracking_date ON parkinsons_robert_tracking(tracking_date DESC);

-- =====================================================
-- 7. FORBES FRAMEWORK TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS parkinsons_forbes_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tracking_date DATE NOT NULL,

    -- F: Functional Assessment & Care Planning
    updrs_assessment_id UUID REFERENCES parkinsons_updrs_assessments(id),
    care_plan_reviewed BOOLEAN DEFAULT false,
    care_plan_updated BOOLEAN DEFAULT false,
    multidisciplinary_meeting BOOLEAN DEFAULT false,

    -- O: Ongoing Monitoring & Adjustment
    clinic_visit_completed BOOLEAN DEFAULT false,
    telehealth_visit_completed BOOLEAN DEFAULT false,
    wearable_data_reviewed BOOLEAN DEFAULT false,
    trend_analysis_completed BOOLEAN DEFAULT false,

    -- R: Rehabilitation & Exercise Programs
    lsvt_big_enrollment_status TEXT CHECK (lsvt_big_enrollment_status IN ('not_enrolled', 'enrolled', 'active', 'completed', 'discontinued')),
    lsvt_loud_enrollment_status TEXT CHECK (lsvt_loud_enrollment_status IN ('not_enrolled', 'enrolled', 'active', 'completed', 'discontinued')),
    aquatic_therapy_sessions INTEGER DEFAULT 0,
    group_exercise_attended BOOLEAN DEFAULT false,
    home_exercise_program_adherence_pct INTEGER CHECK (home_exercise_program_adherence_pct BETWEEN 0 AND 100),

    -- B: Behavioral & Cognitive Support
    cognitive_screening_completed BOOLEAN DEFAULT false,
    cognitive_screening_type TEXT, -- 'MoCA', 'PD-CRS'
    cognitive_screening_score INTEGER,
    depression_screening_completed BOOLEAN DEFAULT false,
    depression_score INTEGER, -- GDS score
    anxiety_screening_completed BOOLEAN DEFAULT false,
    anxiety_score INTEGER, -- GAD-7 score
    sleep_disorder_screening BOOLEAN DEFAULT false,
    psychosis_present BOOLEAN DEFAULT false,

    -- E: Education & Caregiver Support
    patient_education_session BOOLEAN DEFAULT false,
    education_topic TEXT,
    caregiver_burden_assessment_completed BOOLEAN DEFAULT false,
    caregiver_zarit_score INTEGER CHECK (caregiver_zarit_score BETWEEN 0 AND 48),
    support_group_attended BOOLEAN DEFAULT false,
    respite_care_utilized BOOLEAN DEFAULT false,

    -- S: Speech & Swallowing Therapy
    speech_eval_completed BOOLEAN DEFAULT false,
    swallow_study_completed BOOLEAN DEFAULT false,
    swallow_study_result TEXT CHECK (swallow_study_result IN ('normal', 'mild_dysphagia', 'moderate_dysphagia', 'severe_dysphagia', 'aspiration_risk')),
    diet_modification TEXT, -- 'regular', 'mechanical_soft', 'pureed', 'thickened_liquids'
    sialorrhea_treatment TEXT, -- 'none', 'glycopyrrolate', 'botox'

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    UNIQUE(patient_id, tracking_date)
);

CREATE INDEX idx_forbes_tracking_patient ON parkinsons_forbes_tracking(patient_id);
CREATE INDEX idx_forbes_tracking_date ON parkinsons_forbes_tracking(tracking_date DESC);

-- =====================================================
-- 8. DBS PROGRAMMING SESSIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS parkinsons_dbs_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    programmer_id UUID NOT NULL REFERENCES auth.users(id),
    session_date TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Device Details
    device_manufacturer TEXT, -- 'Medtronic', 'Abbott', 'Boston Scientific'
    device_model TEXT,
    lead_location TEXT CHECK (lead_location IN ('bilateral_STN', 'bilateral_GPi', 'unilateral_VIM', 'other')),

    -- Programming Parameters
    left_contact_config TEXT, -- '0-', '1+', '2-', 'C+'
    left_amplitude_v NUMERIC(4,2),
    left_pulse_width_us INTEGER,
    left_frequency_hz INTEGER,

    right_contact_config TEXT,
    right_amplitude_v NUMERIC(4,2),
    right_pulse_width_us INTEGER,
    right_frequency_hz INTEGER,

    -- Outcomes
    updrs_part_iii_pre INTEGER,
    updrs_part_iii_post INTEGER,
    improvement_pct NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN updrs_part_iii_pre > 0 THEN
                ((updrs_part_iii_pre - updrs_part_iii_post)::NUMERIC / updrs_part_iii_pre) * 100
            ELSE NULL
        END
    ) STORED,

    -- Side Effects
    side_effects_reported TEXT[],

    -- Battery Status
    battery_life_estimate_months INTEGER,

    -- Notes
    programming_notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_dbs_sessions_patient ON parkinsons_dbs_sessions(patient_id);
CREATE INDEX idx_dbs_sessions_date ON parkinsons_dbs_sessions(session_date DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE parkinsons_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE parkinsons_updrs_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE parkinsons_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE parkinsons_medication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE parkinsons_symptom_diary ENABLE ROW LEVEL SECURITY;
ALTER TABLE parkinsons_robert_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE parkinsons_forbes_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE parkinsons_dbs_sessions ENABLE ROW LEVEL SECURITY;

-- Patients can see their own data
CREATE POLICY parkinsons_patients_user_policy ON parkinsons_patients
    FOR ALL USING (patient_id = auth.uid());

CREATE POLICY updrs_user_policy ON parkinsons_updrs_assessments
    FOR ALL USING (patient_id = auth.uid());

CREATE POLICY meds_user_policy ON parkinsons_medications
    FOR ALL USING (patient_id = auth.uid());

CREATE POLICY med_log_user_policy ON parkinsons_medication_log
    FOR ALL USING (patient_id = auth.uid());

CREATE POLICY symptom_diary_user_policy ON parkinsons_symptom_diary
    FOR ALL USING (patient_id = auth.uid());

CREATE POLICY robert_tracking_user_policy ON parkinsons_robert_tracking
    FOR ALL USING (patient_id = auth.uid());

CREATE POLICY forbes_tracking_user_policy ON parkinsons_forbes_tracking
    FOR ALL USING (patient_id = auth.uid());

CREATE POLICY dbs_sessions_user_policy ON parkinsons_dbs_sessions
    FOR ALL USING (patient_id = auth.uid());

-- Healthcare providers can view via care relationship
CREATE POLICY parkinsons_patients_provider_policy ON parkinsons_patients
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM encounters e
            WHERE e.patient_id = parkinsons_patients.patient_id
              AND e.provider_id = auth.uid()
        )
    );

CREATE POLICY updrs_provider_policy ON parkinsons_updrs_assessments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM encounters e
            WHERE e.patient_id = parkinsons_updrs_assessments.patient_id
              AND e.provider_id = auth.uid()
        )
    );

CREATE POLICY meds_provider_policy ON parkinsons_medications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM encounters e
            WHERE e.patient_id = parkinsons_medications.patient_id
              AND e.provider_id = auth.uid()
        )
    );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE parkinsons_patients IS 'ROBERT/FORBES Framework: Patient registry for Parkinson''s disease management';
COMMENT ON TABLE parkinsons_updrs_assessments IS 'Unified Parkinson''s Disease Rating Scale (UPDRS) - Gold standard assessment';
COMMENT ON TABLE parkinsons_medications IS 'Comprehensive medication tracking with timing optimization';
COMMENT ON TABLE parkinsons_medication_log IS 'Adherence tracking and ON/OFF state correlation with dosing';
COMMENT ON TABLE parkinsons_symptom_diary IS 'Daily patient-reported outcomes and symptom tracking';
COMMENT ON TABLE parkinsons_robert_tracking IS 'ROBERT Framework: Rhythm, Optimization, Bradykinesia, Exercise, Real-time, Therapeutic';
COMMENT ON TABLE parkinsons_forbes_tracking IS 'FORBES Framework: Functional, Ongoing, Rehabilitation, Behavioral, Education, Speech';
COMMENT ON TABLE parkinsons_dbs_sessions IS 'Deep Brain Stimulation programming sessions and outcomes';
