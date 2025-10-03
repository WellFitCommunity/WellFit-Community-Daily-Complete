-- Add Scribe Sessions and CCM tracking for Project Atlas
-- Safe migration using CREATE TABLE IF NOT EXISTS
-- migrate:up
begin;

-- 1. SCRIBE_SESSIONS table (Medical scribe recordings and transcriptions)
CREATE TABLE IF NOT EXISTS public.scribe_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add columns if they don't exist
DO $$
BEGIN
  -- Add encounter_id if it doesn't exist (make it optional in case encounters table doesn't exist yet)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'encounter_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'encounters' AND table_schema = 'public') THEN
      ALTER TABLE public.scribe_sessions ADD COLUMN encounter_id uuid REFERENCES public.encounters(id) ON DELETE CASCADE;
    ELSE
      ALTER TABLE public.scribe_sessions ADD COLUMN encounter_id uuid;
    END IF;
  END IF;

  -- Add provider_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'provider_id') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN provider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Add recording details
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'recording_url') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN recording_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'recording_duration_seconds') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN recording_duration_seconds integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'recording_started_at') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN recording_started_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'recording_ended_at') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN recording_ended_at timestamptz;
  END IF;

  -- Add transcription fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'transcription_text') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN transcription_text text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'transcription_status') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN transcription_status text DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'transcription_completed_at') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN transcription_completed_at timestamptz;
  END IF;

  -- Add AI note fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'ai_note_subjective') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN ai_note_subjective text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'ai_note_objective') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN ai_note_objective text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'ai_note_assessment') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN ai_note_assessment text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'ai_note_plan') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN ai_note_plan text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'ai_note_hpi') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN ai_note_hpi text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'ai_note_ros') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN ai_note_ros text;
  END IF;

  -- Add suggested codes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'suggested_cpt_codes') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN suggested_cpt_codes jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'suggested_icd10_codes') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN suggested_icd10_codes jsonb;
  END IF;

  -- Add CCM tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'clinical_time_minutes') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN clinical_time_minutes integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'is_ccm_eligible') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN is_ccm_eligible boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'ccm_complexity') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN ccm_complexity text;
  END IF;

  -- Add metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'model_version') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN model_version text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'processing_metadata') THEN
    ALTER TABLE public.scribe_sessions ADD COLUMN processing_metadata jsonb;
  END IF;
END$$;

-- Create indexes (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'encounter_id') THEN
    CREATE INDEX IF NOT EXISTS idx_scribe_sessions_encounter ON public.scribe_sessions(encounter_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'patient_id') THEN
    CREATE INDEX IF NOT EXISTS idx_scribe_sessions_patient ON public.scribe_sessions(patient_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'provider_id') THEN
    CREATE INDEX IF NOT EXISTS idx_scribe_sessions_provider ON public.scribe_sessions(provider_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scribe_sessions' AND column_name = 'transcription_status') THEN
    CREATE INDEX IF NOT EXISTS idx_scribe_sessions_status ON public.scribe_sessions(transcription_status);
  END IF;
  CREATE INDEX IF NOT EXISTS idx_scribe_sessions_created_at ON public.scribe_sessions(created_at DESC);
END$$;

DROP TRIGGER IF EXISTS trg_scribe_sessions_uat ON public.scribe_sessions;
CREATE TRIGGER trg_scribe_sessions_uat
BEFORE UPDATE ON public.scribe_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.scribe_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scribe_sessions_admin_rw_owner_r" ON public.scribe_sessions;
CREATE POLICY "scribe_sessions_admin_rw_owner_r" ON public.scribe_sessions
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid() OR provider_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid() OR provider_id = auth.uid());

-- 2. CCM_TIME_TRACKING table (Chronic Care Management time tracking)
CREATE TABLE IF NOT EXISTS public.ccm_time_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid,  -- FK to be added later after encounters table is confirmed
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_month date NOT NULL,  -- First day of the month being tracked

  -- Activities tracking
  activities jsonb NOT NULL DEFAULT '[]',
  -- Example: [
  --   {type: "phone_call", duration_minutes: 15, date: "2025-10-03", notes: "Med review"},
  --   {type: "care_coordination", duration_minutes: 10, date: "2025-10-05", notes: "Specialist referral"}
  -- ]

  -- Time totals
  total_minutes integer NOT NULL DEFAULT 0,
  billable_minutes integer NOT NULL DEFAULT 0,

  -- Billing suggestions
  suggested_codes text[] DEFAULT '{}',  -- ['99490', '99491']
  is_compliant boolean DEFAULT false,
  compliance_notes text[],

  -- CMS requirements tracking
  care_plan_updated boolean DEFAULT false,
  care_plan_updated_date date,
  patient_consent_obtained boolean DEFAULT false,
  patient_consent_date date,
  patient_portal_access boolean DEFAULT false,

  -- Status
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'ready_to_bill', 'billed', 'paid')),
  billed_date date,

  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(patient_id, service_month)
);

CREATE INDEX IF NOT EXISTS idx_ccm_time_tracking_encounter ON public.ccm_time_tracking(encounter_id);
CREATE INDEX IF NOT EXISTS idx_ccm_time_tracking_patient ON public.ccm_time_tracking(patient_id);
CREATE INDEX IF NOT EXISTS idx_ccm_time_tracking_month ON public.ccm_time_tracking(service_month);
CREATE INDEX IF NOT EXISTS idx_ccm_time_tracking_status ON public.ccm_time_tracking(status);

DROP TRIGGER IF EXISTS trg_ccm_time_tracking_uat ON public.ccm_time_tracking;
CREATE TRIGGER trg_ccm_time_tracking_uat
BEFORE UPDATE ON public.ccm_time_tracking
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ccm_time_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ccm_time_tracking_admin_rw_owner_r" ON public.ccm_time_tracking;
CREATE POLICY "ccm_time_tracking_admin_rw_owner_r" ON public.ccm_time_tracking
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- 3. SDOH_ASSESSMENTS table (Social Determinants of Health)
CREATE TABLE IF NOT EXISTS public.sdoh_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encounter_id uuid,  -- FK to be added later after encounters table is confirmed
  assessment_date date NOT NULL DEFAULT now()::date,

  -- SDOH categories (each stores: {zCode: string, severity: string, impact: string, documented: boolean, notes: string})
  housing_instability jsonb,       -- Z59.0, Z59.1, Z59.8
  food_insecurity jsonb,            -- Z59.4
  transportation_barriers jsonb,    -- Z59.82
  social_isolation jsonb,           -- Z60.2
  financial_insecurity jsonb,       -- Z59.6
  education_barriers jsonb,         -- Z55.x
  employment_concerns jsonb,        -- Z56.x

  -- Scoring
  overall_complexity_score integer DEFAULT 0,  -- 0-100 based on number and severity of SDOH

  -- CCM eligibility based on SDOH
  ccm_eligible boolean DEFAULT false,
  ccm_tier text CHECK (ccm_tier IN ('standard', 'complex', 'non-eligible')),
  ccm_justification text,

  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdoh_assessments_patient ON public.sdoh_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_assessments_encounter ON public.sdoh_assessments(encounter_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_assessments_date ON public.sdoh_assessments(assessment_date);
CREATE INDEX IF NOT EXISTS idx_sdoh_assessments_ccm_eligible ON public.sdoh_assessments(ccm_eligible);

DROP TRIGGER IF EXISTS trg_sdoh_assessments_uat ON public.sdoh_assessments;
CREATE TRIGGER trg_sdoh_assessments_uat
BEFORE UPDATE ON public.sdoh_assessments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sdoh_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sdoh_assessments_admin_rw_owner_r" ON public.sdoh_assessments;
CREATE POLICY "sdoh_assessments_admin_rw_owner_r" ON public.sdoh_assessments
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- 4. CMS_DOCUMENTATION table (CMS compliance tracking)
CREATE TABLE IF NOT EXISTS public.cms_documentation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid,  -- FK to be added later after encounters table is confirmed
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Required CMS elements
  consent_obtained boolean DEFAULT false,
  consent_date date,
  consent_method text,  -- verbal, written, electronic

  care_plan_created boolean DEFAULT false,
  care_plan_created_date date,
  care_plan_last_updated date,
  care_plan_url text,

  patient_access_provided boolean DEFAULT false,
  patient_portal_enabled boolean DEFAULT false,
  patient_portal_last_access timestamptz,

  -- Communication log
  communication_log jsonb DEFAULT '[]',
  -- Example: [{date: "2025-10-03", type: "phone", duration: 15, summary: "Med review"}]

  -- Quality measures
  quality_measures jsonb DEFAULT '{}',
  -- Example: {
  --   "blood_pressure_controlled": true,
  --   "diabetes_a1c_tested": true,
  --   "medication_reconciliation": true
  -- }

  -- Compliance status
  is_compliant boolean DEFAULT false,
  compliance_checklist jsonb,
  compliance_notes text,

  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cms_documentation_encounter ON public.cms_documentation(encounter_id);
CREATE INDEX IF NOT EXISTS idx_cms_documentation_patient ON public.cms_documentation(patient_id);
CREATE INDEX IF NOT EXISTS idx_cms_documentation_compliant ON public.cms_documentation(is_compliant);

DROP TRIGGER IF EXISTS trg_cms_documentation_uat ON public.cms_documentation;
CREATE TRIGGER trg_cms_documentation_uat
BEFORE UPDATE ON public.cms_documentation
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cms_documentation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cms_documentation_admin_rw_owner_r" ON public.cms_documentation;
CREATE POLICY "cms_documentation_admin_rw_owner_r" ON public.cms_documentation
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- Add SDOH columns to code_icd10 if they don't exist
DO $$
BEGIN
  -- Check if code_icd10 table exists first
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'code_icd10' AND table_schema = 'public') THEN
    -- Add sdoh_category column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'code_icd10' AND column_name = 'sdoh_category' AND table_schema = 'public'
    ) THEN
      ALTER TABLE public.code_icd10 ADD COLUMN sdoh_category text;
    END IF;

    -- Add complexity_weight column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'code_icd10' AND column_name = 'complexity_weight' AND table_schema = 'public'
    ) THEN
      ALTER TABLE public.code_icd10 ADD COLUMN complexity_weight integer DEFAULT 0;
    END IF;
  END IF;
END$$;

-- Insert common Z-codes for SDOH (if code_icd10 table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'code_icd10' AND table_schema = 'public') THEN
    INSERT INTO public.code_icd10 (code, "desc", chapter, billable, status, sdoh_category, complexity_weight) VALUES
      ('Z590', 'Homelessness', 'Z00-Z99', true, 'active', 'housing', 3),
      ('Z591', 'Inadequate housing', 'Z00-Z99', true, 'active', 'housing', 2),
      ('Z593', 'Problems related to living alone', 'Z00-Z99', true, 'active', 'social', 1),
      ('Z594', 'Lack of adequate food', 'Z00-Z99', true, 'active', 'nutrition', 2),
      ('Z598', 'Other problems related to housing and economic circumstances', 'Z00-Z99', true, 'active', 'housing', 2),
      ('Z596', 'Low income', 'Z00-Z99', true, 'active', 'financial', 2),
      ('Z602', 'Problems related to living alone', 'Z00-Z99', true, 'active', 'social', 1),
      ('Z5982', 'Transportation insecurity', 'Z00-Z99', true, 'active', 'transportation', 2)
    ON CONFLICT (code) DO UPDATE SET
      sdoh_category = EXCLUDED.sdoh_category,
      complexity_weight = EXCLUDED.complexity_weight;
  END IF;
END$$;

-- Insert common CCM CPT codes (if code_cpt table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'code_cpt' AND table_schema = 'public') THEN
    INSERT INTO public.code_cpt (code, short_desc, long_desc, status) VALUES
      ('99490', 'CCM services, first 20 min', 'Chronic care management services, first 20 minutes of clinical staff time directed by a physician or other qualified health care professional, per calendar month', 'active'),
      ('99491', 'CCM services, additional 20 min', 'Chronic care management services, each additional 20 minutes of clinical staff time directed by a physician or other qualified health care professional, per calendar month', 'active'),
      ('99487', 'Complex CCM, first 60 min', 'Complex chronic care management services, first 60 minutes of clinical staff time directed by a physician or other qualified health care professional, per calendar month', 'active'),
      ('99489', 'Complex CCM, additional 30 min', 'Complex chronic care management services, each additional 30 minutes of clinical staff time directed by a physician or other qualified health care professional, per calendar month', 'active')
    ON CONFLICT (code) DO UPDATE SET
      short_desc = EXCLUDED.short_desc,
      long_desc = EXCLUDED.long_desc,
      status = EXCLUDED.status;
  END IF;
END$$;

-- Comments for documentation
COMMENT ON TABLE public.scribe_sessions IS 'AI medical scribe sessions with transcription and clinical note generation';
COMMENT ON TABLE public.ccm_time_tracking IS 'Chronic Care Management time tracking for monthly billing';
COMMENT ON TABLE public.sdoh_assessments IS 'Social Determinants of Health assessments for complex care management';
COMMENT ON TABLE public.cms_documentation IS 'CMS compliance documentation for CCM billing requirements';

commit;

-- migrate:down
begin;

DROP TABLE IF EXISTS public.cms_documentation CASCADE;
DROP TABLE IF EXISTS public.sdoh_assessments CASCADE;
DROP TABLE IF EXISTS public.ccm_time_tracking CASCADE;
DROP TABLE IF EXISTS public.scribe_sessions CASCADE;

-- Remove SDOH columns from code_icd10 if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'code_icd10' AND table_schema = 'public') THEN
    ALTER TABLE public.code_icd10 DROP COLUMN IF EXISTS sdoh_category;
    ALTER TABLE public.code_icd10 DROP COLUMN IF EXISTS complexity_weight;
  END IF;
END$$;

commit;
