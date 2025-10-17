-- FHIR Procedure Resource Migration
-- Handles medical procedures, interventions, and operations
-- FHIR R4 Compliant

BEGIN;

-- ============================================================================
-- FHIR PROCEDURE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FHIR Resource Metadata
  fhir_id TEXT UNIQUE NOT NULL DEFAULT 'Procedure/' || gen_random_uuid()::text,

  -- Status (required)
  status TEXT NOT NULL CHECK (status IN (
    'preparation', 'in-progress', 'not-done', 'on-hold', 'stopped',
    'completed', 'entered-in-error', 'unknown'
  )),

  -- Status Reason
  status_reason_code TEXT,
  status_reason_display TEXT,

  -- Category
  category_code TEXT,
  category_display TEXT,
  category_system TEXT DEFAULT 'http://snomed.info/sct',

  -- Procedure Code (required) - CPT, SNOMED CT, ICD-10-PCS
  code_system TEXT NOT NULL, -- CPT: http://www.ama-assn.org/go/cpt
  code TEXT NOT NULL, -- e.g., "80061" (Lipid panel)
  code_display TEXT NOT NULL,
  code_text TEXT,

  -- Patient Reference (required)
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Encounter Context
  encounter_id UUID, -- Reference to encounters table

  -- Performed Time
  performed_datetime TIMESTAMPTZ,
  performed_period_start TIMESTAMPTZ,
  performed_period_end TIMESTAMPTZ,
  performed_string TEXT, -- Free text timing
  performed_age_value DECIMAL,
  performed_age_unit TEXT,

  -- Recorder (who recorded this)
  recorder_type TEXT CHECK (recorder_type IN ('Patient', 'RelatedPerson', 'Practitioner', 'PractitionerRole')),
  recorder_id UUID,
  recorder_display TEXT,

  -- Asserter (who asserted this occurred)
  asserter_type TEXT,
  asserter_id UUID,
  asserter_display TEXT,

  -- Performers (who did the procedure)
  performer_function_code TEXT[], -- Role of performer
  performer_function_display TEXT[],
  performer_actor_type TEXT[], -- Practitioner, Organization, etc.
  performer_actor_id UUID[],
  performer_actor_display TEXT[],
  performer_on_behalf_of_id UUID[], -- Organization

  -- Location
  location_id UUID,
  location_display TEXT,

  -- Reason for Procedure
  reason_code TEXT[], -- SNOMED CT, ICD-10
  reason_code_display TEXT[],
  reason_reference_type TEXT[], -- Condition, Observation, etc.
  reason_reference_id UUID[],

  -- Body Site
  body_site_code TEXT,
  body_site_display TEXT,
  body_site_system TEXT DEFAULT 'http://snomed.info/sct',
  body_site_text TEXT,

  -- Outcome
  outcome_code TEXT,
  outcome_display TEXT,
  outcome_text TEXT,

  -- Report (DiagnosticReport, DocumentReference)
  report_type TEXT[],
  report_id UUID[],

  -- Complications
  complication_code TEXT[],
  complication_display TEXT[],
  complication_detail_id UUID[], -- Reference to Condition

  -- Follow Up
  follow_up_code TEXT[],
  follow_up_display TEXT[],

  -- Notes
  note TEXT,

  -- Used (devices, medications, substances used)
  used_reference_type TEXT[],
  used_reference_id UUID[],
  used_code TEXT[],
  used_display TEXT[],

  -- Based On (CarePlan, ServiceRequest)
  based_on_type TEXT[],
  based_on_id UUID[],

  -- Part Of (larger procedure this is part of)
  part_of_type TEXT,
  part_of_id UUID,

  -- Billing Information
  billing_code TEXT, -- CPT code for billing
  billing_modifier TEXT[], -- CPT modifiers
  billing_charge_amount DECIMAL,
  billing_units INTEGER DEFAULT 1,

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
CREATE INDEX IF NOT EXISTS idx_fhir_procedures_patient_id ON public.fhir_procedures(patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_procedures_status ON public.fhir_procedures(status);
CREATE INDEX IF NOT EXISTS idx_fhir_procedures_code ON public.fhir_procedures(code);
CREATE INDEX IF NOT EXISTS idx_fhir_procedures_code_system ON public.fhir_procedures(code_system);
CREATE INDEX IF NOT EXISTS idx_fhir_procedures_encounter_id ON public.fhir_procedures(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fhir_procedures_performed ON public.fhir_procedures(performed_datetime DESC) WHERE performed_datetime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fhir_procedures_category ON public.fhir_procedures(category_code) WHERE category_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fhir_procedures_fhir_id ON public.fhir_procedures(fhir_id);
CREATE INDEX IF NOT EXISTS idx_fhir_procedures_external_id ON public.fhir_procedures(external_id) WHERE external_id IS NOT NULL;

-- Composite index for billing queries
CREATE INDEX IF NOT EXISTS idx_fhir_procedures_billing ON public.fhir_procedures(patient_id, billing_code)
  WHERE billing_code IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_fhir_procedure_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fhir_procedure_updated_at
  BEFORE UPDATE ON public.fhir_procedures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fhir_procedure_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.fhir_procedures ENABLE ROW LEVEL SECURITY;

-- Users can view their own procedures
DROP POLICY IF EXISTS "fhir_procedures_user_select" ON public.fhir_procedures;
CREATE POLICY "fhir_procedures_user_select"
  ON public.fhir_procedures FOR SELECT
  USING (patient_id = auth.uid());

-- Staff can view all procedures
DROP POLICY IF EXISTS "fhir_procedures_staff_select" ON public.fhir_procedures;
CREATE POLICY "fhir_procedures_staff_select"
  ON public.fhir_procedures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'caregiver', 'doctor', 'nurse')
    )
  );

-- Only clinical staff can insert
DROP POLICY IF EXISTS "fhir_procedures_staff_insert" ON public.fhir_procedures;
CREATE POLICY "fhir_procedures_staff_insert"
  ON public.fhir_procedures FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
    )
  );

-- Only clinical staff can update
DROP POLICY IF EXISTS "fhir_procedures_staff_update" ON public.fhir_procedures;
CREATE POLICY "fhir_procedures_staff_update"
  ON public.fhir_procedures FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
    )
  );

-- Only admins can delete
DROP POLICY IF EXISTS "fhir_procedures_admin_delete" ON public.fhir_procedures;
CREATE POLICY "fhir_procedures_admin_delete"
  ON public.fhir_procedures FOR DELETE
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

-- Get recent procedures for a patient
CREATE OR REPLACE FUNCTION public.get_recent_procedures(
  patient_id_param UUID,
  limit_param INTEGER DEFAULT 20
)
RETURNS SETOF public.fhir_procedures
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_procedures
  WHERE patient_id = patient_id_param
    AND status IN ('completed', 'in-progress')
  ORDER BY COALESCE(performed_datetime, performed_period_start, created_at) DESC
  LIMIT limit_param;
END;
$$;

-- Get procedures by encounter
CREATE OR REPLACE FUNCTION public.get_procedures_by_encounter(encounter_id_param UUID)
RETURNS SETOF public.fhir_procedures
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_procedures
  WHERE encounter_id = encounter_id_param
  ORDER BY COALESCE(performed_datetime, performed_period_start) DESC;
END;
$$;

-- Search procedures by code (CPT, SNOMED)
CREATE OR REPLACE FUNCTION public.search_procedures_by_code(
  patient_id_param UUID,
  code_param TEXT
)
RETURNS SETOF public.fhir_procedures
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_procedures
  WHERE patient_id = patient_id_param
    AND code = code_param
  ORDER BY COALESCE(performed_datetime, performed_period_start) DESC;
END;
$$;

-- Get surgical procedures for a patient
CREATE OR REPLACE FUNCTION public.get_surgical_procedures(
  patient_id_param UUID,
  days_back INTEGER DEFAULT 365
)
RETURNS SETOF public.fhir_procedures
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_procedures
  WHERE patient_id = patient_id_param
    AND category_code IN ('387713003', '71388002') -- SNOMED: surgical procedure
    AND COALESCE(performed_datetime, performed_period_start) > NOW() - (days_back || ' days')::INTERVAL
  ORDER BY COALESCE(performed_datetime, performed_period_start) DESC;
END;
$$;

-- Get procedures for billing
CREATE OR REPLACE FUNCTION public.get_billable_procedures(
  patient_id_param UUID,
  encounter_id_param UUID DEFAULT NULL
)
RETURNS SETOF public.fhir_procedures
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF encounter_id_param IS NOT NULL THEN
    RETURN QUERY
    SELECT * FROM public.fhir_procedures
    WHERE encounter_id = encounter_id_param
      AND billing_code IS NOT NULL
      AND status = 'completed'
    ORDER BY performed_datetime DESC;
  ELSE
    RETURN QUERY
    SELECT * FROM public.fhir_procedures
    WHERE patient_id = patient_id_param
      AND billing_code IS NOT NULL
      AND status = 'completed'
    ORDER BY performed_datetime DESC;
  END IF;
END;
$$;

COMMIT;

-- migrate:down
BEGIN;

DROP FUNCTION IF EXISTS public.get_billable_procedures(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_surgical_procedures(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.search_procedures_by_code(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_procedures_by_encounter(UUID);
DROP FUNCTION IF EXISTS public.get_recent_procedures(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.update_fhir_procedure_updated_at();
DROP TABLE IF EXISTS public.fhir_procedures CASCADE;

COMMIT;
