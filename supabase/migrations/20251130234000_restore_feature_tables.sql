-- ============================================================================
-- RESTORE: All feature tables that were incorrectly dropped
-- ============================================================================
-- These are FEATURES, not tech debt. Restoring everything except debug tables.
-- ============================================================================

-- ============================================================================
-- REFERRAL SYSTEM - Hospital referrals to WellFit
-- ============================================================================
CREATE TABLE IF NOT EXISTS external_referral_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_name TEXT NOT NULL,
    organization_type TEXT CHECK (organization_type IN ('hospital', 'clinic', 'physician_office', 'insurance', 'community_org', 'other')),
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'standard', 'premium', 'enterprise')),
    is_active BOOLEAN DEFAULT true,
    contract_start_date DATE,
    contract_end_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS patient_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_source_id UUID REFERENCES external_referral_sources(id) ON DELETE SET NULL,
    patient_first_name TEXT NOT NULL,
    patient_last_name TEXT NOT NULL,
    patient_phone TEXT,
    patient_email TEXT,
    patient_dob DATE,
    referral_reason TEXT,
    diagnosis_codes TEXT[],
    priority TEXT DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'emergent')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'enrolled', 'declined', 'unable_to_reach', 'cancelled')),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    referral_date TIMESTAMPTZ DEFAULT now(),
    contacted_date TIMESTAMPTZ,
    enrolled_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS referral_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_source_id UUID REFERENCES external_referral_sources(id) ON DELETE CASCADE,
    patient_referral_id UUID REFERENCES patient_referrals(id) ON DELETE CASCADE,
    report_type TEXT CHECK (report_type IN ('engagement_summary', 'health_update', 'alert_notification', 'monthly_summary')),
    report_period_start DATE,
    report_period_end DATE,
    report_data JSONB,
    generated_at TIMESTAMPTZ DEFAULT now(),
    sent_at TIMESTAMPTZ,
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS referral_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_referral_id UUID REFERENCES patient_referrals(id) ON DELETE CASCADE,
    alert_type TEXT CHECK (alert_type IN ('missed_checkin', 'mood_decline', 'sdoh_flag', 'hospitalization', 'fall', 'medication_issue')),
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS referral_auto_creation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_source_id UUID REFERENCES external_referral_sources(id) ON DELETE CASCADE,
    trigger_condition JSONB NOT NULL,
    auto_assign_to UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS cross_system_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_system TEXT NOT NULL,
    source_patient_id TEXT,
    target_system TEXT NOT NULL,
    target_patient_id TEXT,
    referral_type TEXT,
    status TEXT DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- COMMENTS & COMMUNITY
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS comment_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- ALERTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
    title TEXT NOT NULL,
    message TEXT,
    metadata JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    is_dismissed BOOLEAN DEFAULT false,
    dismissed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- CARE TEAM
-- ============================================================================
CREATE TABLE IF NOT EXISTS care_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    member_name TEXT,
    member_role TEXT NOT NULL,
    member_specialty TEXT,
    member_phone TEXT,
    member_email TEXT,
    is_primary BOOLEAN DEFAULT false,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS care_coordination_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note_type TEXT CHECK (note_type IN ('care_plan', 'progress', 'communication', 'transition', 'other')),
    content TEXT NOT NULL,
    is_confidential BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS interdisciplinary_care_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT NOT NULL,
    team_lead_id UUID REFERENCES auth.users(id),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- HOSPITAL / SHIFT HANDOFF
-- ============================================================================
CREATE TABLE IF NOT EXISTS hospital_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    floor_number TEXT,
    phone_extension TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS handoff_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_name TEXT NOT NULL,
    section_order INTEGER,
    is_required BOOLEAN DEFAULT false,
    template_content TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS shift_handoff_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id UUID REFERENCES handoff_sections(id),
    override_content TEXT,
    override_reason TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS shift_handoff_override_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    override_id UUID REFERENCES shift_handoff_overrides(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT now(),
    details JSONB,
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS patient_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    department_id UUID REFERENCES hospital_departments(id),
    room_number TEXT,
    bed_number TEXT,
    location_type TEXT CHECK (location_type IN ('inpatient', 'emergency', 'outpatient', 'observation', 'icu', 'or')),
    admitted_at TIMESTAMPTZ,
    discharged_at TIMESTAMPTZ,
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- BILLING / CLAIMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS claim_flag_types (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'info',
    auto_hold BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS claim_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    file_path TEXT,
    attachment_type TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS claim_denials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL,
    denial_code TEXT,
    denial_reason TEXT,
    denial_date DATE,
    appeal_deadline DATE,
    appeal_status TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS claim_review_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL,
    reviewer_id UUID REFERENCES auth.users(id),
    review_action TEXT NOT NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS clearinghouse_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clearinghouse_name TEXT NOT NULL,
    api_endpoint TEXT,
    credentials_encrypted TEXT,
    is_active BOOLEAN DEFAULT true,
    last_submission_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS denial_appeal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    denial_id UUID,
    appeal_level INTEGER DEFAULT 1,
    appeal_date DATE,
    appeal_status TEXT,
    appeal_outcome TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS remittances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_name TEXT,
    check_number TEXT,
    check_date DATE,
    total_amount DECIMAL(12,2),
    file_path TEXT,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- MEDICAL CODES REFERENCE
-- ============================================================================
CREATE TABLE IF NOT EXISTS code_cpt (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    category TEXT,
    work_rvu DECIMAL(8,4),
    facility_pe_rvu DECIMAL(8,4),
    non_facility_pe_rvu DECIMAL(8,4),
    mp_rvu DECIMAL(8,4),
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS code_hcpcs (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    category TEXT,
    pricing_indicator TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS code_icd10 (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    category TEXT,
    chapter TEXT,
    is_billable BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS code_modifiers (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    modifier_type TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS cpt_code_reference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    description TEXT,
    category TEXT,
    subcategory TEXT,
    work_rvu DECIMAL(8,4),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PHYSICAL THERAPY
-- ============================================================================
CREATE TABLE IF NOT EXISTS pt_exercise_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_name TEXT NOT NULL,
    description TEXT,
    body_region TEXT,
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    equipment_needed TEXT[],
    video_url TEXT,
    image_url TEXT,
    instructions TEXT[],
    precautions TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS pt_quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID REFERENCES auth.users(id),
    metric_type TEXT NOT NULL,
    metric_value DECIMAL(10,2),
    metric_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS pt_team_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    recipient_ids UUID[],
    message_type TEXT,
    subject TEXT,
    content TEXT NOT NULL,
    is_urgent BOOLEAN DEFAULT false,
    read_by UUID[],
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS pt_telehealth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES auth.users(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    session_type TEXT,
    status TEXT DEFAULT 'scheduled',
    video_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS pt_wearable_enhanced_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    treatment_plan_id UUID,
    measurement_date DATE,
    steps_count INTEGER,
    active_minutes INTEGER,
    range_of_motion JSONB,
    gait_metrics JSONB,
    pain_correlation JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- QUESTIONNAIRES
-- ============================================================================
CREATE TABLE IF NOT EXISTS question_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    questions JSONB NOT NULL,
    scoring_logic JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS question_assignments (
    question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES question_templates(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    due_date DATE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES question_assignments(question_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES question_templates(id),
    responses JSONB NOT NULL,
    score DECIMAL(10,2),
    completed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS questionnaire_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES question_templates(id) ON DELETE CASCADE,
    deployment_name TEXT,
    target_audience TEXT,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS questionnaire_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES question_templates(id) ON DELETE CASCADE,
    deployment_id UUID REFERENCES questionnaire_deployments(id) ON DELETE CASCADE,
    total_responses INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2),
    average_score DECIMAL(10,2),
    score_distribution JSONB,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- MOBILE APP
-- ============================================================================
CREATE TABLE IF NOT EXISTS mobile_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_type TEXT,
    device_model TEXT,
    os_version TEXT,
    app_version TEXT,
    push_token TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS mobile_vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES mobile_devices(id),
    vital_type TEXT NOT NULL,
    vital_value DECIMAL(10,2),
    vital_unit TEXT,
    measured_at TIMESTAMPTZ DEFAULT now(),
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS mobile_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES mobile_devices(id),
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT,
    pending_uploads INTEGER DEFAULT 0,
    pending_downloads INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS mobile_emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_relationship TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS mobile_emergency_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL,
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    location_address TEXT,
    status TEXT DEFAULT 'active',
    contacted_emergency_services BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- MENTAL HEALTH ADVANCED
-- ============================================================================
CREATE TABLE IF NOT EXISTS mental_health_quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES auth.users(id),
    metric_type TEXT NOT NULL,
    metric_value DECIMAL(10,2),
    measurement_period_start DATE,
    measurement_period_end DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS mental_health_trigger_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trigger_name TEXT NOT NULL,
    trigger_description TEXT,
    severity TEXT,
    coping_strategies TEXT[],
    identified_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS mh_wearable_biomarkers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    biomarker_type TEXT NOT NULL,
    biomarker_value DECIMAL(10,4),
    measurement_time TIMESTAMPTZ DEFAULT now(),
    device_source TEXT,
    correlation_mood_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- PARKINSON'S MODULE
-- ============================================================================
CREATE TABLE IF NOT EXISTS parkinsons_patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    diagnosis_date DATE,
    hoehn_yahr_stage TEXT,
    primary_symptoms TEXT[],
    dbs_implant BOOLEAN DEFAULT false,
    dbs_implant_date DATE,
    neurologist_name TEXT,
    neurologist_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS parkinsons_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES parkinsons_patients(id) ON DELETE CASCADE,
    medication_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    timing_instructions TEXT,
    is_active BOOLEAN DEFAULT true,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS parkinsons_medication_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id UUID REFERENCES parkinsons_medications(id) ON DELETE CASCADE,
    taken_at TIMESTAMPTZ DEFAULT now(),
    was_on_time BOOLEAN,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS parkinsons_symptom_diary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES parkinsons_patients(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    tremor_severity INTEGER CHECK (tremor_severity >= 0 AND tremor_severity <= 10),
    rigidity_severity INTEGER CHECK (rigidity_severity >= 0 AND rigidity_severity <= 10),
    bradykinesia_severity INTEGER CHECK (bradykinesia_severity >= 0 AND bradykinesia_severity <= 10),
    dyskinesia_present BOOLEAN DEFAULT false,
    on_off_state TEXT CHECK (on_off_state IN ('on', 'off', 'wearing_off')),
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
    sleep_quality TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS parkinsons_updrs_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES parkinsons_patients(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL,
    assessor_id UUID REFERENCES auth.users(id),
    part_i_score INTEGER,
    part_ii_score INTEGER,
    part_iii_score INTEGER,
    part_iv_score INTEGER,
    total_score INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS parkinsons_dbs_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES parkinsons_patients(id) ON DELETE CASCADE,
    session_date TIMESTAMPTZ NOT NULL,
    programmer_name TEXT,
    settings_changed JSONB,
    battery_status TEXT,
    patient_response TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS parkinsons_forbes_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES parkinsons_patients(id) ON DELETE CASCADE,
    updrs_assessment_id UUID REFERENCES parkinsons_updrs_assessments(id),
    tracking_date DATE,
    freezing_episodes INTEGER,
    fall_count INTEGER,
    balance_score INTEGER,
    gait_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS parkinsons_robert_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES parkinsons_patients(id) ON DELETE CASCADE,
    tracking_date DATE,
    cognitive_score INTEGER,
    speech_clarity INTEGER,
    swallowing_difficulty INTEGER,
    constipation_severity INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- SECURITY & SYSTEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS mfa_enrollment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mfa_type TEXT NOT NULL CHECK (mfa_type IN ('totp', 'sms', 'email', 'webauthn')),
    secret_encrypted TEXT,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS passkey_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge TEXT NOT NULL,
    challenge_type TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name TEXT NOT NULL UNIQUE,
    key_version INTEGER DEFAULT 1,
    public_key TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    rotated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS security_vulnerabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vulnerability_id TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    title TEXT NOT NULL,
    description TEXT,
    affected_component TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'accepted', 'false_positive')),
    discovered_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS vulnerability_remediation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vulnerability_id UUID REFERENCES security_vulnerabilities(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS penetration_test_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name TEXT NOT NULL,
    test_type TEXT,
    executed_by TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    findings_count INTEGER,
    report_path TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- MISC
-- ============================================================================
CREATE TABLE IF NOT EXISTS memory_lane_trivia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT,
    option_d TEXT,
    correct_answer TEXT NOT NULL,
    era TEXT,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    category TEXT,
    explanation TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT,
    auth_key TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ehr_patient_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ehr_system TEXT NOT NULL,
    ehr_patient_id TEXT NOT NULL,
    mapping_status TEXT DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    export_type TEXT NOT NULL,
    export_format TEXT DEFAULT 'csv',
    filters JSONB,
    status TEXT DEFAULT 'pending',
    file_path TEXT,
    file_size INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    retention_days INTEGER NOT NULL,
    archive_before_delete BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_name TEXT NOT NULL,
    status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    last_check_at TIMESTAMPTZ DEFAULT now(),
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB,
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS system_health_check (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_name TEXT NOT NULL,
    check_type TEXT,
    target_endpoint TEXT,
    expected_status INTEGER,
    actual_status INTEGER,
    response_time_ms INTEGER,
    is_healthy BOOLEAN,
    error_message TEXT,
    checked_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS unified_care_plan_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_plan_type TEXT NOT NULL,
    source_plan_id UUID,
    linked_plan_type TEXT,
    linked_plan_id UUID,
    link_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================
DO $$
DECLARE
    tbl TEXT;
    tbls TEXT[] := ARRAY[
        'external_referral_sources', 'patient_referrals', 'referral_reports', 'referral_alerts',
        'referral_auto_creation_rules', 'cross_system_referrals', 'comments', 'comment_reports',
        'alerts', 'care_team_members', 'care_coordination_notes', 'interdisciplinary_care_teams',
        'hospital_departments', 'handoff_sections', 'shift_handoff_overrides', 'shift_handoff_override_log',
        'patient_locations', 'claim_attachments', 'claim_denials', 'claim_review_history',
        'clearinghouse_config', 'denial_appeal_history', 'remittances', 'pt_exercise_library',
        'pt_quality_metrics', 'pt_team_communications', 'pt_telehealth_sessions', 'pt_wearable_enhanced_outcomes',
        'question_templates', 'question_assignments', 'questionnaire_responses', 'questionnaire_deployments',
        'questionnaire_analytics', 'mobile_devices', 'mobile_vitals', 'mobile_sync_status',
        'mobile_emergency_contacts', 'mobile_emergency_incidents', 'mental_health_quality_metrics',
        'mental_health_trigger_conditions', 'mh_wearable_biomarkers', 'parkinsons_patients',
        'parkinsons_medications', 'parkinsons_medication_log', 'parkinsons_symptom_diary',
        'parkinsons_updrs_assessments', 'parkinsons_dbs_sessions', 'parkinsons_forbes_tracking',
        'parkinsons_robert_tracking', 'mfa_enrollment', 'password_history', 'passkey_challenges',
        'encryption_keys', 'security_vulnerabilities', 'vulnerability_remediation_log',
        'penetration_test_executions', 'memory_lane_trivia', 'push_subscriptions', 'ehr_patient_mappings',
        'export_jobs', 'data_retention_policies', 'system_health', 'system_health_check',
        'unified_care_plan_links'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', tbl);
    END LOOP;
    RAISE NOTICE 'Enabled RLS on all restored tables';
END $$;

-- Summary
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'FEATURE TABLES RESTORED';
    RAISE NOTICE 'Total tables now: %', table_count;
    RAISE NOTICE '========================================';
END $$;
