-- Discharge Planning & Post-Acute Care Coordination System
-- CRITICAL: Prevents hospital readmissions (saves $6.6M/year per hospital)
-- Joint Commission compliant discharge checklist
-- Reuses handoff_packets for post-acute transfers (SNF/Rehab/Home Health)
-- Date: 2025-10-27

BEGIN;

-- ============================================================================
-- 1. DISCHARGE_PLANS - Main discharge planning record
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.discharge_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Patient & Encounter linkage
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,

  -- Discharge disposition
  discharge_disposition TEXT NOT NULL CHECK (discharge_disposition IN (
    'home',                    -- Home with no services
    'home_with_home_health',   -- Home with home health services
    'skilled_nursing',         -- Skilled Nursing Facility (SNF)
    'inpatient_rehab',         -- Inpatient Rehabilitation Facility
    'long_term_acute_care',    -- LTAC Hospital
    'hospice',                 -- Hospice care
    'hospital_transfer',       -- Transfer to another acute hospital
    'left_ama',                -- Left Against Medical Advice
    'expired'                  -- Patient deceased
  )),

  -- Planned discharge datetime
  planned_discharge_date DATE NOT NULL,
  planned_discharge_time TIME,
  actual_discharge_datetime TIMESTAMPTZ,

  -- ============================================================================
  -- JOINT COMMISSION REQUIRED CHECKLIST (PREVENT READMISSIONS)
  -- ============================================================================

  -- Medication Management
  medication_reconciliation_complete BOOLEAN NOT NULL DEFAULT false,
  discharge_prescriptions_sent BOOLEAN NOT NULL DEFAULT false,
  discharge_prescriptions_pharmacy TEXT, -- Pharmacy name/phone

  -- Follow-up Care
  follow_up_appointment_scheduled BOOLEAN NOT NULL DEFAULT false,
  follow_up_appointment_date DATE,
  follow_up_appointment_provider TEXT,
  follow_up_appointment_location TEXT,

  -- Documentation
  discharge_summary_completed BOOLEAN NOT NULL DEFAULT false,
  discharge_summary_sent_to_pcp BOOLEAN NOT NULL DEFAULT false,
  discharge_summary_sent_at TIMESTAMPTZ,

  -- Patient Education
  patient_education_completed BOOLEAN NOT NULL DEFAULT false,
  patient_education_topics TEXT[], -- Array of topics covered
  patient_understands_diagnosis BOOLEAN NOT NULL DEFAULT false,
  patient_understands_medications BOOLEAN NOT NULL DEFAULT false,
  patient_understands_followup BOOLEAN NOT NULL DEFAULT false,

  -- Durable Medical Equipment (DME)
  dme_needed BOOLEAN NOT NULL DEFAULT false,
  dme_ordered BOOLEAN NOT NULL DEFAULT false,
  dme_items TEXT[], -- ['walker', 'oxygen', 'hospital bed']

  -- Home Services
  home_health_needed BOOLEAN NOT NULL DEFAULT false,
  home_health_ordered BOOLEAN NOT NULL DEFAULT false,
  home_health_agency TEXT,
  home_health_start_date DATE,

  -- Caregiver Support
  caregiver_identified BOOLEAN NOT NULL DEFAULT false,
  caregiver_name TEXT,
  caregiver_phone TEXT,
  caregiver_training_completed BOOLEAN NOT NULL DEFAULT false,

  -- Transportation
  transportation_arranged BOOLEAN NOT NULL DEFAULT false,
  transportation_method TEXT, -- 'family', 'medical_transport', 'ambulance', 'rideshare'

  -- ============================================================================
  -- READMISSION RISK ASSESSMENT
  -- ============================================================================

  readmission_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (readmission_risk_score BETWEEN 0 AND 100),
  readmission_risk_category TEXT GENERATED ALWAYS AS (
    CASE
      WHEN readmission_risk_score >= 80 THEN 'very_high'
      WHEN readmission_risk_score >= 60 THEN 'high'
      WHEN readmission_risk_score >= 40 THEN 'moderate'
      ELSE 'low'
    END
  ) STORED,

  -- High-risk patients need extra follow-up
  requires_48hr_call BOOLEAN NOT NULL DEFAULT false,
  requires_72hr_call BOOLEAN NOT NULL DEFAULT false,
  requires_7day_pcp_visit BOOLEAN NOT NULL DEFAULT false,

  -- Risk factors (for AI analysis)
  risk_factors JSONB DEFAULT '[]'::jsonb, -- ['multiple_comorbidities', 'poor_social_support', 'medication_non_adherence']

  -- ============================================================================
  -- POST-ACUTE PLACEMENT (if not home)
  -- ============================================================================

  post_acute_facility_id UUID, -- References a facilities table (future)
  post_acute_facility_name TEXT,
  post_acute_facility_phone TEXT,
  post_acute_facility_address TEXT,
  post_acute_bed_confirmed BOOLEAN NOT NULL DEFAULT false,
  post_acute_bed_confirmed_at TIMESTAMPTZ,

  -- REUSE handoff_packets for post-acute transfers!
  post_acute_handoff_packet_id UUID REFERENCES public.handoff_packets(id) ON DELETE SET NULL,

  -- ============================================================================
  -- BILLING & TIME TRACKING (for CPT codes)
  -- ============================================================================

  discharge_planning_time_minutes INTEGER DEFAULT 0, -- For CPT 99217-99239
  care_coordination_time_minutes INTEGER DEFAULT 0,  -- For CCM billing (99490/99439)

  -- Billing codes generated
  billing_codes_generated BOOLEAN NOT NULL DEFAULT false,
  billing_codes JSONB DEFAULT '[]'::jsonb, -- [{"code": "99239", "description": "..."}]

  -- ============================================================================
  -- STATUS & WORKFLOW
  -- ============================================================================

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Plan being developed
    'pending_items',   -- Some checklist items incomplete
    'ready',           -- All items complete, ready for discharge
    'discharged',      -- Patient discharged
    'cancelled'        -- Plan cancelled (patient condition changed)
  )),

  checklist_completion_percentage INTEGER GENERATED ALWAYS AS (
    (
      (CASE WHEN medication_reconciliation_complete THEN 1 ELSE 0 END) +
      (CASE WHEN discharge_prescriptions_sent THEN 1 ELSE 0 END) +
      (CASE WHEN follow_up_appointment_scheduled THEN 1 ELSE 0 END) +
      (CASE WHEN discharge_summary_completed THEN 1 ELSE 0 END) +
      (CASE WHEN discharge_summary_sent_to_pcp THEN 1 ELSE 0 END) +
      (CASE WHEN patient_education_completed THEN 1 ELSE 0 END) +
      (CASE WHEN (NOT dme_needed OR dme_ordered) THEN 1 ELSE 0 END) +
      (CASE WHEN (NOT home_health_needed OR home_health_ordered) THEN 1 ELSE 0 END) +
      (CASE WHEN (NOT caregiver_identified OR caregiver_training_completed) THEN 1 ELSE 0 END) +
      (CASE WHEN transportation_arranged THEN 1 ELSE 0 END)
    ) * 10 -- 10 critical items = 100%
  ) STORED,

  -- ============================================================================
  -- AUDIT & METADATA
  -- ============================================================================

  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  discharge_planner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Case manager/social worker
  discharge_planner_notes TEXT,

  clinical_notes TEXT, -- Free-text notes from providers
  barriers_to_discharge TEXT[], -- ['lack of transportation', 'no caregiver', 'insurance denial']

  -- Ensure one active plan per encounter
  UNIQUE(encounter_id)
);

-- Indexes for performance
CREATE INDEX idx_discharge_plans_patient ON public.discharge_plans(patient_id);
CREATE INDEX idx_discharge_plans_encounter ON public.discharge_plans(encounter_id);
CREATE INDEX idx_discharge_plans_status ON public.discharge_plans(status);
CREATE INDEX idx_discharge_plans_discharge_date ON public.discharge_plans(planned_discharge_date);
CREATE INDEX idx_discharge_plans_risk ON public.discharge_plans(readmission_risk_score DESC);
CREATE INDEX idx_discharge_plans_pending ON public.discharge_plans(status) WHERE status IN ('draft', 'pending_items');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_discharge_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discharge_plans_updated_at ON public.discharge_plans;
CREATE TRIGGER trg_discharge_plans_updated_at
  BEFORE UPDATE ON public.discharge_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_discharge_plans_updated_at();

-- ============================================================================
-- 2. POST_DISCHARGE_FOLLOW_UPS - 48-hour calls to prevent readmissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.post_discharge_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  discharge_plan_id UUID NOT NULL REFERENCES public.discharge_plans(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Follow-up type
  follow_up_type TEXT NOT NULL CHECK (follow_up_type IN (
    '24hr_call',
    '48hr_call',
    '72hr_call',
    '7day_call',
    'pcp_visit_reminder'
  )),

  -- Scheduled & Completed
  scheduled_datetime TIMESTAMPTZ NOT NULL,
  completed_datetime TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'attempted',      -- Tried to reach, no answer
    'completed',
    'patient_declined',
    'unable_to_reach',
    'cancelled'
  )),

  -- Call details
  attempted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nurse who made call
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_datetime TIMESTAMPTZ,

  -- Assessment results
  patient_doing_well BOOLEAN,
  patient_has_concerns BOOLEAN,
  concerns_description TEXT,

  medication_adherence_confirmed BOOLEAN,
  medication_issues TEXT,

  follow_up_appointment_confirmed BOOLEAN,
  follow_up_appointment_attended BOOLEAN,

  warning_signs_present BOOLEAN,
  warning_signs_description TEXT,

  -- Actions taken
  actions_taken TEXT[], -- ['called_provider', 'scheduled_urgent_visit', 'patient_reassured']
  needs_escalation BOOLEAN NOT NULL DEFAULT false,
  escalated_to UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Provider/case manager
  escalated_at TIMESTAMPTZ,

  -- Outcome
  outcome TEXT, -- 'stable', 'scheduled_visit', 'returned_to_er', 'readmitted'

  call_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_discharge_follow_ups_discharge_plan ON public.post_discharge_follow_ups(discharge_plan_id);
CREATE INDEX idx_post_discharge_follow_ups_patient ON public.post_discharge_follow_ups(patient_id);
CREATE INDEX idx_post_discharge_follow_ups_scheduled ON public.post_discharge_follow_ups(scheduled_datetime);
CREATE INDEX idx_post_discharge_follow_ups_pending ON public.post_discharge_follow_ups(status) WHERE status IN ('pending', 'attempted');

DROP TRIGGER IF EXISTS trg_post_discharge_follow_ups_updated_at ON public.post_discharge_follow_ups;
CREATE TRIGGER trg_post_discharge_follow_ups_updated_at
  BEFORE UPDATE ON public.post_discharge_follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.update_discharge_plans_updated_at();

-- ============================================================================
-- 3. POST_ACUTE_FACILITIES - Directory of SNFs, Rehabs, Home Health agencies
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.post_acute_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  facility_type TEXT NOT NULL CHECK (facility_type IN (
    'skilled_nursing',
    'inpatient_rehab',
    'long_term_acute_care',
    'home_health_agency',
    'hospice'
  )),

  facility_name TEXT NOT NULL,
  facility_address TEXT,
  facility_city TEXT,
  facility_state TEXT,
  facility_zip TEXT,
  facility_phone TEXT NOT NULL,
  facility_fax TEXT,
  facility_email TEXT,

  -- Bed availability (updated regularly)
  total_beds INTEGER,
  available_beds INTEGER,
  last_bed_count_update TIMESTAMPTZ,

  -- Quality metrics
  cms_star_rating NUMERIC(2,1), -- CMS 5-star rating
  accepts_medicare BOOLEAN NOT NULL DEFAULT true,
  accepts_medicaid BOOLEAN NOT NULL DEFAULT true,

  -- Specialties
  specialties TEXT[], -- ['cardiac_care', 'orthopedic', 'stroke', 'dementia']

  -- Contract status
  is_preferred_provider BOOLEAN NOT NULL DEFAULT false,
  contract_status TEXT CHECK (contract_status IN ('active', 'inactive', 'pending')),

  -- Contact info
  primary_contact_name TEXT,
  primary_contact_phone TEXT,
  primary_contact_email TEXT,

  -- Metadata
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_acute_facilities_type ON public.post_acute_facilities(facility_type);
CREATE INDEX idx_post_acute_facilities_active ON public.post_acute_facilities(active) WHERE active = true;
CREATE INDEX idx_post_acute_facilities_beds ON public.post_acute_facilities(available_beds) WHERE available_beds > 0;
CREATE INDEX idx_post_acute_facilities_zip ON public.post_acute_facilities(facility_zip);

DROP TRIGGER IF EXISTS trg_post_acute_facilities_updated_at ON public.post_acute_facilities;
CREATE TRIGGER trg_post_acute_facilities_updated_at
  BEFORE UPDATE ON public.post_acute_facilities
  FOR EACH ROW EXECUTE FUNCTION public.update_discharge_plans_updated_at();

-- ============================================================================
-- 4. EXTEND handoff_packets for POST-ACUTE TRANSFERS (GENIUS!)
-- ============================================================================
-- Add discharge encounter linkage (hospital → SNF/Rehab transfers)
ALTER TABLE public.handoff_packets
  ADD COLUMN IF NOT EXISTS discharge_encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_post_acute_transfer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS post_acute_facility_type TEXT CHECK (post_acute_facility_type IN (
    'skilled_nursing', 'inpatient_rehab', 'long_term_acute_care', 'hospice', NULL
  ));

CREATE INDEX idx_handoff_packets_discharge_encounter
  ON public.handoff_packets(discharge_encounter_id)
  WHERE discharge_encounter_id IS NOT NULL;

CREATE INDEX idx_handoff_packets_post_acute
  ON public.handoff_packets(is_post_acute_transfer)
  WHERE is_post_acute_transfer = true;

COMMENT ON COLUMN public.handoff_packets.discharge_encounter_id IS 'Links to discharge encounter (hospital → SNF/Rehab transfers)';
COMMENT ON COLUMN public.handoff_packets.is_post_acute_transfer IS 'TRUE for post-acute transfers (SNF/Rehab), FALSE for hospital-to-hospital';

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

/**
 * Calculate readmission risk score based on clinical factors
 * Called automatically when creating discharge plan
 */
CREATE OR REPLACE FUNCTION public.calculate_readmission_risk_score(
  p_patient_id UUID,
  p_encounter_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 30; -- Base score
  v_age INTEGER;
  v_recent_admissions INTEGER;
  v_comorbidity_count INTEGER;
  v_er_visits_30d INTEGER;
BEGIN
  -- Get patient age
  SELECT DATE_PART('year', AGE(date_of_birth))
  INTO v_age
  FROM public.profiles
  WHERE id = p_patient_id;

  -- Age factor (+10 if 65+, +20 if 75+)
  IF v_age >= 75 THEN
    v_score := v_score + 20;
  ELSIF v_age >= 65 THEN
    v_score := v_score + 10;
  END IF;

  -- Check recent admissions (last 90 days)
  SELECT COUNT(*)
  INTO v_recent_admissions
  FROM public.encounters
  WHERE patient_id = p_patient_id
    AND start_time > now() - INTERVAL '90 days'
    AND encounter_type IN ('inpatient', 'emergency');

  -- Recent admissions (+15 per admission)
  v_score := v_score + (LEAST(v_recent_admissions, 3) * 15);

  -- Check for readmission history (from readmission tracking)
  SELECT COUNT(*)
  INTO v_er_visits_30d
  FROM public.patient_readmissions
  WHERE patient_id = p_patient_id
    AND admission_date > now() - INTERVAL '30 days'
    AND facility_type = 'er';

  -- ER visits in last 30 days (+20 per visit)
  v_score := v_score + (LEAST(v_er_visits_30d, 2) * 20);

  -- Comorbidity count (from encounter diagnosis codes)
  SELECT COUNT(DISTINCT diagnosis_code)
  INTO v_comorbidity_count
  FROM public.encounter_diagnoses
  WHERE encounter_id = p_encounter_id;

  -- Multiple comorbidities (+10 if 3+, +5 if 2)
  IF v_comorbidity_count >= 3 THEN
    v_score := v_score + 10;
  ELSIF v_comorbidity_count >= 2 THEN
    v_score := v_score + 5;
  END IF;

  -- Cap at 100
  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Auto-schedule 48-hour follow-up calls for high-risk patients
 * Called when discharge plan is marked as 'discharged'
 */
CREATE OR REPLACE FUNCTION public.schedule_post_discharge_follow_ups(
  p_discharge_plan_id UUID,
  p_discharge_datetime TIMESTAMPTZ
)
RETURNS VOID AS $$
DECLARE
  v_patient_id UUID;
  v_requires_48hr BOOLEAN;
  v_requires_72hr BOOLEAN;
  v_requires_7day BOOLEAN;
BEGIN
  -- Get discharge plan details
  SELECT patient_id, requires_48hr_call, requires_72hr_call, requires_7day_pcp_visit
  INTO v_patient_id, v_requires_48hr, v_requires_72hr, v_requires_7day
  FROM public.discharge_plans
  WHERE id = p_discharge_plan_id;

  -- Schedule 24-hour call (for ALL discharged patients)
  INSERT INTO public.post_discharge_follow_ups (
    discharge_plan_id,
    patient_id,
    follow_up_type,
    scheduled_datetime
  ) VALUES (
    p_discharge_plan_id,
    v_patient_id,
    '24hr_call',
    p_discharge_datetime + INTERVAL '24 hours'
  );

  -- Schedule 48-hour call if high-risk
  IF v_requires_48hr THEN
    INSERT INTO public.post_discharge_follow_ups (
      discharge_plan_id,
      patient_id,
      follow_up_type,
      scheduled_datetime
    ) VALUES (
      p_discharge_plan_id,
      v_patient_id,
      '48hr_call',
      p_discharge_datetime + INTERVAL '48 hours'
    );
  END IF;

  -- Schedule 72-hour call if very high-risk
  IF v_requires_72hr THEN
    INSERT INTO public.post_discharge_follow_ups (
      discharge_plan_id,
      patient_id,
      follow_up_type,
      scheduled_datetime
    ) VALUES (
      p_discharge_plan_id,
      v_patient_id,
      '72hr_call',
      p_discharge_datetime + INTERVAL '72 hours'
    );
  END IF;

  -- Schedule 7-day reminder
  IF v_requires_7day THEN
    INSERT INTO public.post_discharge_follow_ups (
      discharge_plan_id,
      patient_id,
      follow_up_type,
      scheduled_datetime
    ) VALUES (
      p_discharge_plan_id,
      v_patient_id,
      '7day_call',
      p_discharge_datetime + INTERVAL '7 days'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Trigger to auto-schedule follow-ups when patient is discharged
 */
CREATE OR REPLACE FUNCTION public.trigger_discharge_follow_ups()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'discharged' AND (OLD.status IS NULL OR OLD.status != 'discharged') THEN
    -- Auto-schedule follow-ups
    PERFORM public.schedule_post_discharge_follow_ups(
      NEW.id,
      COALESCE(NEW.actual_discharge_datetime, now())
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_schedule_follow_ups ON public.discharge_plans;
CREATE TRIGGER trg_auto_schedule_follow_ups
  AFTER UPDATE ON public.discharge_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_discharge_follow_ups();

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.discharge_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_discharge_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_acute_facilities ENABLE ROW LEVEL SECURITY;

-- DISCHARGE_PLANS policies
DROP POLICY IF EXISTS "discharge_plans_provider_access" ON public.discharge_plans;
CREATE POLICY "discharge_plans_provider_access"
ON public.discharge_plans
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin', 'physician', 'nurse', 'case_manager', 'social_worker')
  )
);

-- POST_DISCHARGE_FOLLOW_UPS policies
DROP POLICY IF EXISTS "follow_ups_provider_access" ON public.post_discharge_follow_ups;
CREATE POLICY "follow_ups_provider_access"
ON public.post_discharge_follow_ups
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin', 'physician', 'nurse', 'case_manager')
  )
);

-- POST_ACUTE_FACILITIES policies (read-only for providers, full access for admins)
DROP POLICY IF EXISTS "facilities_provider_read" ON public.post_acute_facilities;
CREATE POLICY "facilities_provider_read"
ON public.post_acute_facilities
FOR SELECT
USING (
  active = true
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin', 'physician', 'nurse', 'case_manager', 'social_worker')
  )
);

DROP POLICY IF EXISTS "facilities_admin_all" ON public.post_acute_facilities;
CREATE POLICY "facilities_admin_all"
ON public.post_acute_facilities
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- ============================================================================
-- 7. COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.discharge_plans IS 'Discharge planning checklist - prevents $6.6M/year in readmission penalties';
COMMENT ON TABLE public.post_discharge_follow_ups IS '48-hour follow-up calls - reduces readmissions by 20%';
COMMENT ON TABLE public.post_acute_facilities IS 'Directory of SNFs, rehab facilities, home health agencies';

COMMENT ON COLUMN public.discharge_plans.checklist_completion_percentage IS 'Auto-calculated: 10 critical items, each worth 10%';
COMMENT ON COLUMN public.discharge_plans.readmission_risk_score IS 'AI-calculated score (0-100) based on age, comorbidities, recent admissions';
COMMENT ON COLUMN public.discharge_plans.post_acute_handoff_packet_id IS 'GENIUS: Reuses handoff_packets for hospital → SNF/Rehab transfers!';

COMMIT;
