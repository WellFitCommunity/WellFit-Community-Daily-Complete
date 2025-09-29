-- Fix billing system permissions and role references
-- migrate:up
begin;

-- 1. Fix is_admin function to reference correct table (user_roles not roles)
CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = p_uid AND r.role IN ('admin','super_admin')
  );
$$;

-- 2. Add SDOH and billing-specific tables for enhanced system

-- Create encounters table if it doesn't exist (needed by claims table)
CREATE TABLE IF NOT EXISTS public.encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  date_of_service date NOT NULL,
  claim_frequency_code text,
  subscriber_relation_code text,
  payer_id uuid REFERENCES public.billing_payers(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON public.encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_service_date ON public.encounters(date_of_service);

CREATE TRIGGER IF NOT EXISTS trg_encounters_uat
BEFORE UPDATE ON public.encounters
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encounters_admin_rw_owner_r" ON public.encounters;
CREATE POLICY "encounters_admin_rw_owner_r" ON public.encounters
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- Create encounter_procedures table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.encounter_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  code text NOT NULL,
  charge_amount numeric(12,2),
  units numeric(12,2) DEFAULT 1,
  modifiers text[],
  service_date date,
  diagnosis_pointers integer[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounter_procedures_encounter ON public.encounter_procedures(encounter_id);

CREATE TRIGGER IF NOT EXISTS trg_encounter_procedures_uat
BEFORE UPDATE ON public.encounter_procedures
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.encounter_procedures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encounter_procedures_admin_rw" ON public.encounter_procedures;
CREATE POLICY "encounter_procedures_admin_rw" ON public.encounter_procedures
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_procedures.encounter_id AND e.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_procedures.encounter_id AND e.created_by = auth.uid())
  );

-- Create encounter_diagnoses table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.encounter_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  code text NOT NULL,
  sequence integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounter_diagnoses_encounter ON public.encounter_diagnoses(encounter_id);

CREATE TRIGGER IF NOT EXISTS trg_encounter_diagnoses_uat
BEFORE UPDATE ON public.encounter_diagnoses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.encounter_diagnoses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encounter_diagnoses_admin_rw" ON public.encounter_diagnoses;
CREATE POLICY "encounter_diagnoses_admin_rw" ON public.encounter_diagnoses
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_diagnoses.encounter_id AND e.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_diagnoses.encounter_id AND e.created_by = auth.uid())
  );

-- Create patients table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  dob date,
  gender text,
  address_line1 text,
  city text,
  state text,
  zip text,
  member_id text,
  ssn text,
  phone text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON public.patients(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_patients_member_id ON public.patients(member_id);

CREATE TRIGGER IF NOT EXISTS trg_patients_uat
BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patients_admin_rw_owner_r" ON public.patients;
CREATE POLICY "patients_admin_rw_owner_r" ON public.patients
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- Create clinical_notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('assessment', 'plan', 'subjective', 'objective', 'general')),
  content text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_encounter ON public.clinical_notes(encounter_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_type ON public.clinical_notes(type);

CREATE TRIGGER IF NOT EXISTS trg_clinical_notes_uat
BEFORE UPDATE ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_notes_admin_rw" ON public.clinical_notes;
CREATE POLICY "clinical_notes_admin_rw" ON public.clinical_notes
  USING (
    public.is_admin(auth.uid()) OR
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = clinical_notes.encounter_id AND e.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = clinical_notes.encounter_id AND e.created_by = auth.uid())
  );

-- 3. Add Z-code and SDOH support to ICD-10 table
DO $$
BEGIN
  -- Add SDOH category column if it doesn't exist
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
END$$;

-- 4. Insert common Z-codes for SDOH
INSERT INTO public.code_icd10 (code, "desc", chapter, billable, status, sdoh_category, complexity_weight) VALUES
  ('Z590', 'Homelessness', 'Z00-Z99', true, 'active', 'housing', 3),
  ('Z591', 'Inadequate housing', 'Z00-Z99', true, 'active', 'housing', 2),
  ('Z593', 'Problems related to housing and economic circumstances, food insecurity', 'Z00-Z99', true, 'active', 'nutrition', 2),
  ('Z598', 'Other problems related to housing and economic circumstances', 'Z00-Z99', true, 'active', 'transportation', 2),
  ('Z602', 'Problems related to living alone', 'Z00-Z99', true, 'active', 'social', 1),
  ('Z596', 'Low income', 'Z00-Z99', true, 'active', 'financial', 2)
ON CONFLICT (code) DO UPDATE SET
  sdoh_category = EXCLUDED.sdoh_category,
  complexity_weight = EXCLUDED.complexity_weight;

-- 5. Insert common CCM CPT codes
INSERT INTO public.code_cpt (code, short_desc, long_desc, status) VALUES
  ('99490', 'CCM services, first 20 min', 'Chronic care management services, first 20 minutes of clinical staff time directed by a physician or other qualified health care professional, per calendar month', 'active'),
  ('99491', 'CCM services, additional 20 min', 'Chronic care management services, each additional 20 minutes of clinical staff time directed by a physician or other qualified health care professional, per calendar month', 'active'),
  ('99487', 'Complex CCM, first 60 min', 'Complex chronic care management services, first 60 minutes of clinical staff time directed by a physician or other qualified health care professional, per calendar month', 'active'),
  ('99489', 'Complex CCM, additional 30 min', 'Complex chronic care management services, each additional 30 minutes of clinical staff time directed by a physician or other qualified health care professional, per calendar month', 'active')
ON CONFLICT (code) DO UPDATE SET
  short_desc = EXCLUDED.short_desc,
  long_desc = EXCLUDED.long_desc,
  status = EXCLUDED.status;

-- 6. Create SDOH-specific tables

-- SDOH assessments table
CREATE TABLE IF NOT EXISTS public.sdoh_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  encounter_id uuid REFERENCES public.encounters(id) ON DELETE CASCADE,
  assessment_date date NOT NULL DEFAULT now()::date,
  housing_instability jsonb,      -- {zCode: 'Z59.0', severity: 'severe', impact: 'high', documented: true}
  food_insecurity jsonb,
  transportation_barriers jsonb,
  social_isolation jsonb,
  financial_insecurity jsonb,
  education_barriers jsonb,
  employment_concerns jsonb,
  overall_complexity_score integer DEFAULT 0,
  ccm_eligible boolean DEFAULT false,
  ccm_tier text CHECK (ccm_tier IN ('standard', 'complex', 'non-eligible')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdoh_assessments_patient ON public.sdoh_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_assessments_encounter ON public.sdoh_assessments(encounter_id);
CREATE INDEX IF NOT EXISTS idx_sdoh_assessments_date ON public.sdoh_assessments(assessment_date);

CREATE TRIGGER trg_sdoh_assessments_uat
BEFORE UPDATE ON public.sdoh_assessments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sdoh_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdoh_assessments_admin_rw_owner_r" ON public.sdoh_assessments
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- CCM time tracking table
CREATE TABLE IF NOT EXISTS public.ccm_time_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  service_date date NOT NULL DEFAULT now()::date,
  activities jsonb NOT NULL DEFAULT '[]',  -- Array of CCM activities with duration, type, etc.
  total_minutes integer NOT NULL DEFAULT 0,
  billable_minutes integer NOT NULL DEFAULT 0,
  suggested_codes text[] DEFAULT '{}',
  is_compliant boolean DEFAULT false,
  compliance_notes text[],
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccm_time_tracking_encounter ON public.ccm_time_tracking(encounter_id);
CREATE INDEX IF NOT EXISTS idx_ccm_time_tracking_patient ON public.ccm_time_tracking(patient_id);
CREATE INDEX IF NOT EXISTS idx_ccm_time_tracking_date ON public.ccm_time_tracking(service_date);

CREATE TRIGGER trg_ccm_time_tracking_uat
BEFORE UPDATE ON public.ccm_time_tracking
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ccm_time_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ccm_time_tracking_admin_rw_owner_r" ON public.ccm_time_tracking
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- CMS documentation table
CREATE TABLE IF NOT EXISTS public.cms_documentation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  consent_obtained boolean DEFAULT false,
  consent_date date,
  care_plan_updated boolean DEFAULT false,
  care_plan_date date,
  patient_access_provided boolean DEFAULT false,
  communication_log jsonb DEFAULT '[]',
  quality_measures jsonb DEFAULT '[]',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cms_documentation_encounter ON public.cms_documentation(encounter_id);
CREATE INDEX IF NOT EXISTS idx_cms_documentation_patient ON public.cms_documentation(patient_id);

CREATE TRIGGER trg_cms_documentation_uat
BEFORE UPDATE ON public.cms_documentation
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cms_documentation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_documentation_admin_rw_owner_r" ON public.cms_documentation
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

commit;

-- migrate:down
begin;

-- Drop SDOH and CCM specific tables
DROP TABLE IF EXISTS public.cms_documentation CASCADE;
DROP TABLE IF EXISTS public.ccm_time_tracking CASCADE;
DROP TABLE IF EXISTS public.sdoh_assessments CASCADE;

-- Drop encounter-related tables
DROP TABLE IF EXISTS public.clinical_notes CASCADE;
DROP TABLE IF EXISTS public.encounter_diagnoses CASCADE;
DROP TABLE IF EXISTS public.encounter_procedures CASCADE;
DROP TABLE IF EXISTS public.encounters CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;

-- Remove SDOH columns from code_icd10
ALTER TABLE public.code_icd10 DROP COLUMN IF EXISTS sdoh_category;
ALTER TABLE public.code_icd10 DROP COLUMN IF EXISTS complexity_weight;

commit;