-- FHIR Condition Resource Migration
-- Handles diagnoses, problems, and health concerns
-- FHIR R4 Compliant

BEGIN;

-- ============================================================================
-- FHIR CONDITION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FHIR Resource Metadata
  fhir_id TEXT UNIQUE NOT NULL DEFAULT 'Condition/' || gen_random_uuid()::text,

  -- Clinical Status (required)
  clinical_status TEXT NOT NULL CHECK (clinical_status IN (
    'active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'
  )),

  -- Verification Status
  verification_status TEXT NOT NULL CHECK (verification_status IN (
    'unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error'
  )),

  -- Category (problem-list-item, encounter-diagnosis, health-concern)
  category TEXT[] DEFAULT ARRAY['problem-list-item'],
  category_coding_system TEXT[] DEFAULT ARRAY['http://terminology.hl7.org/CodeSystem/condition-category'],

  -- Severity
  severity_code TEXT, -- SNOMED CT severity code
  severity_display TEXT, -- e.g., "Severe", "Moderate", "Mild"
  severity_system TEXT DEFAULT 'http://snomed.info/sct',

  -- Condition Code (required) - ICD-10, SNOMED CT
  code_system TEXT NOT NULL, -- 'http://hl7.org/fhir/sid/icd-10-cm' or 'http://snomed.info/sct'
  code TEXT NOT NULL, -- e.g., "E11.9" (Type 2 diabetes) or "44054006" (Diabetes)
  code_display TEXT NOT NULL, -- Human-readable condition name
  code_text TEXT, -- Free text description

  -- Body Site (where applicable)
  body_site_code TEXT,
  body_site_display TEXT,
  body_site_system TEXT DEFAULT 'http://snomed.info/sct',

  -- Patient Reference (required)
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Encounter Context
  encounter_id UUID, -- Reference to encounters table

  -- Onset (when it started)
  onset_datetime TIMESTAMPTZ,
  onset_age_value DECIMAL,
  onset_age_unit TEXT,
  onset_period_start TIMESTAMPTZ,
  onset_period_end TIMESTAMPTZ,
  onset_range_low DECIMAL,
  onset_range_high DECIMAL,
  onset_string TEXT, -- Free text onset description

  -- Abatement (when it ended/resolved)
  abatement_datetime TIMESTAMPTZ,
  abatement_age_value DECIMAL,
  abatement_age_unit TEXT,
  abatement_period_start TIMESTAMPTZ,
  abatement_period_end TIMESTAMPTZ,
  abatement_range_low DECIMAL,
  abatement_range_high DECIMAL,
  abatement_string TEXT,

  -- Recorded Date
  recorded_date TIMESTAMPTZ DEFAULT NOW(),

  -- Recorder (who recorded this)
  recorder_type TEXT CHECK (recorder_type IN ('Practitioner', 'PractitionerRole', 'Patient', 'RelatedPerson')),
  recorder_id UUID,
  recorder_display TEXT,

  -- Asserter (who confirmed this)
  asserter_type TEXT,
  asserter_id UUID,
  asserter_display TEXT,

  -- Stage (for cancer, etc.)
  stage_summary_code TEXT,
  stage_summary_display TEXT,
  stage_type_code TEXT,
  stage_type_display TEXT,

  -- Evidence
  evidence_code TEXT[], -- SNOMED CT, LOINC observation codes
  evidence_detail_ids UUID[], -- References to Observation, DiagnosticReport

  -- Notes
  note TEXT,

  -- Is this the primary diagnosis?
  is_primary BOOLEAN DEFAULT false,

  -- Rank (for ordering multiple diagnoses)
  rank INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sync tracking
  last_synced_at TIMESTAMPTZ,
  sync_source TEXT, -- 'local', 'epic', 'cerner', etc.
  external_id TEXT -- External system ID
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_patient_id ON public.fhir_conditions(patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_clinical_status ON public.fhir_conditions(clinical_status);
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_code ON public.fhir_conditions(code);
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_code_system ON public.fhir_conditions(code_system);
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_category ON public.fhir_conditions USING GIN(category);
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_encounter_id ON public.fhir_conditions(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_recorded_date ON public.fhir_conditions(recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_is_primary ON public.fhir_conditions(is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_fhir_id ON public.fhir_conditions(fhir_id);
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_external_id ON public.fhir_conditions(external_id) WHERE external_id IS NOT NULL;

-- Active conditions (most important for clinical decision support)
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_active ON public.fhir_conditions(patient_id, clinical_status)
  WHERE clinical_status IN ('active', 'recurrence', 'relapse');

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_fhir_condition_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fhir_condition_updated_at
  BEFORE UPDATE ON public.fhir_conditions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fhir_condition_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.fhir_conditions ENABLE ROW LEVEL SECURITY;

-- Users can view their own conditions
DROP POLICY IF EXISTS "fhir_conditions_user_select" ON public.fhir_conditions;
CREATE POLICY "fhir_conditions_user_select"
  ON public.fhir_conditions FOR SELECT
  USING (patient_id = auth.uid());

-- Staff can view all conditions
DROP POLICY IF EXISTS "fhir_conditions_staff_select" ON public.fhir_conditions;
CREATE POLICY "fhir_conditions_staff_select"
  ON public.fhir_conditions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'caregiver', 'doctor', 'nurse')
    )
  );

-- Only clinical staff can insert
DROP POLICY IF EXISTS "fhir_conditions_staff_insert" ON public.fhir_conditions;
CREATE POLICY "fhir_conditions_staff_insert"
  ON public.fhir_conditions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
    )
  );

-- Only clinical staff can update
DROP POLICY IF EXISTS "fhir_conditions_staff_update" ON public.fhir_conditions;
CREATE POLICY "fhir_conditions_staff_update"
  ON public.fhir_conditions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
    )
  );

-- Only admins can delete
DROP POLICY IF EXISTS "fhir_conditions_admin_delete" ON public.fhir_conditions;
CREATE POLICY "fhir_conditions_admin_delete"
  ON public.fhir_conditions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get active conditions (problem list) for a patient
CREATE OR REPLACE FUNCTION public.get_active_conditions(patient_id_param UUID)
RETURNS SETOF public.fhir_conditions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_conditions
  WHERE patient_id = patient_id_param
    AND clinical_status IN ('active', 'recurrence', 'relapse')
  ORDER BY is_primary DESC NULLS LAST, rank NULLS LAST, recorded_date DESC;
END;
$$;

-- Get problem list (active diagnoses)
CREATE OR REPLACE FUNCTION public.get_problem_list(patient_id_param UUID)
RETURNS SETOF public.fhir_conditions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_conditions
  WHERE patient_id = patient_id_param
    AND clinical_status IN ('active', 'recurrence', 'relapse')
    AND 'problem-list-item' = ANY(category)
  ORDER BY is_primary DESC NULLS LAST, rank NULLS LAST, recorded_date DESC;
END;
$$;

-- Get encounter diagnoses
CREATE OR REPLACE FUNCTION public.get_encounter_diagnoses(encounter_id_param UUID)
RETURNS SETOF public.fhir_conditions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_conditions
  WHERE encounter_id = encounter_id_param
    AND 'encounter-diagnosis' = ANY(category)
  ORDER BY rank NULLS LAST, is_primary DESC NULLS LAST;
END;
$$;

-- Get condition history for a patient
CREATE OR REPLACE FUNCTION public.get_condition_history(
  patient_id_param UUID,
  limit_param INTEGER DEFAULT 100
)
RETURNS SETOF public.fhir_conditions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_conditions
  WHERE patient_id = patient_id_param
  ORDER BY recorded_date DESC
  LIMIT limit_param;
END;
$$;

-- Search conditions by code (ICD-10, SNOMED)
CREATE OR REPLACE FUNCTION public.search_conditions_by_code(
  code_param TEXT,
  limit_param INTEGER DEFAULT 50
)
RETURNS SETOF public.fhir_conditions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_conditions
  WHERE code = code_param
  ORDER BY recorded_date DESC
  LIMIT limit_param;
END;
$$;

-- Get chronic conditions for a patient
CREATE OR REPLACE FUNCTION public.get_chronic_conditions(patient_id_param UUID)
RETURNS SETOF public.fhir_conditions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_conditions
  WHERE patient_id = patient_id_param
    AND clinical_status = 'active'
    AND (
      -- Conditions that have been active for > 90 days
      onset_datetime < NOW() - INTERVAL '90 days'
      OR onset_period_start < NOW() - INTERVAL '90 days'
    )
  ORDER BY recorded_date DESC;
END;
$$;

COMMIT;

-- migrate:down
BEGIN;

DROP FUNCTION IF EXISTS public.get_chronic_conditions(UUID);
DROP FUNCTION IF EXISTS public.search_conditions_by_code(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_condition_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_encounter_diagnoses(UUID);
DROP FUNCTION IF EXISTS public.get_problem_list(UUID);
DROP FUNCTION IF EXISTS public.get_active_conditions(UUID);
DROP FUNCTION IF EXISTS public.update_fhir_condition_updated_at();
DROP TABLE IF EXISTS public.fhir_conditions CASCADE;

COMMIT;
