-- FHIR DiagnosticReport Resource Migration
-- Handles lab results, imaging reports, and diagnostic findings
-- FHIR R4 Compliant

BEGIN;

-- ============================================================================
-- FHIR DIAGNOSTIC REPORT TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_diagnostic_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FHIR Resource Metadata
  fhir_id TEXT UNIQUE NOT NULL DEFAULT 'DiagnosticReport/' || gen_random_uuid()::text,

  -- Status (required)
  status TEXT NOT NULL CHECK (status IN (
    'registered', 'partial', 'preliminary', 'final', 'amended',
    'corrected', 'appended', 'cancelled', 'entered-in-error', 'unknown'
  )),

  -- Category (required for US Core) - LAB, RAD, etc.
  category TEXT[] NOT NULL DEFAULT ARRAY['LAB'],
  category_coding_system TEXT[] DEFAULT ARRAY['http://terminology.hl7.org/CodeSystem/v2-0074'],

  -- Report Code (required) - LOINC
  code_system TEXT NOT NULL DEFAULT 'http://loinc.org',
  code TEXT NOT NULL, -- e.g., "58410-2" (Complete blood count)
  code_display TEXT NOT NULL,
  code_text TEXT,

  -- Patient Reference (required)
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Encounter Context
  encounter_id UUID, -- Reference to encounters table

  -- Effective Time (when the specimen was collected or observation made)
  effective_datetime TIMESTAMPTZ,
  effective_period_start TIMESTAMPTZ,
  effective_period_end TIMESTAMPTZ,

  -- Issued (when the report was released)
  issued TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Performer (who produced the report)
  performer_type TEXT[] DEFAULT ARRAY['Practitioner'],
  performer_id UUID[],
  performer_display TEXT[],

  -- Results Interpreter
  results_interpreter_type TEXT[],
  results_interpreter_id UUID[],
  results_interpreter_display TEXT[],

  -- Specimen (reference to specimen if applicable)
  specimen_id UUID,
  specimen_type TEXT,
  specimen_display TEXT,

  -- Results (references to Observation resources)
  result_observation_ids UUID[], -- Array of observation IDs

  -- Imaging Study (for radiology reports)
  imaging_study_id UUID,

  -- Media (images, PDFs, etc.)
  media_comment TEXT[],
  media_link_url TEXT[],

  -- Conclusion
  conclusion TEXT, -- Clinical interpretation
  conclusion_code TEXT[], -- SNOMED CT coded conclusions
  conclusion_code_display TEXT[],

  -- Presented Form (PDF, image of report)
  presented_form_content_type TEXT, -- 'application/pdf', 'image/jpeg', etc.
  presented_form_url TEXT, -- URL to stored document
  presented_form_title TEXT,
  presented_form_creation TIMESTAMPTZ,

  -- Based On (ServiceRequest, CarePlan)
  based_on_type TEXT[],
  based_on_id UUID[],

  -- Study (for imaging)
  study_uid TEXT, -- DICOM Study Instance UID
  series_uid TEXT, -- DICOM Series Instance UID

  -- Specimen Details
  specimen_received_time TIMESTAMPTZ,
  specimen_collection_time TIMESTAMPTZ,

  -- Report Metadata
  report_version TEXT,
  report_priority TEXT CHECK (report_priority IN ('routine', 'urgent', 'asap', 'stat')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sync tracking
  last_synced_at TIMESTAMPTZ,
  sync_source TEXT, -- 'local', 'epic', 'cerner', 'labcorp', 'quest', etc.
  external_id TEXT -- External system ID
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_fhir_diag_reports_patient_id ON public.fhir_diagnostic_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_diag_reports_status ON public.fhir_diagnostic_reports(status);
CREATE INDEX IF NOT EXISTS idx_fhir_diag_reports_code ON public.fhir_diagnostic_reports(code);
CREATE INDEX IF NOT EXISTS idx_fhir_diag_reports_category ON public.fhir_diagnostic_reports USING GIN(category);
CREATE INDEX IF NOT EXISTS idx_fhir_diag_reports_encounter_id ON public.fhir_diagnostic_reports(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fhir_diag_reports_issued ON public.fhir_diagnostic_reports(issued DESC);
CREATE INDEX IF NOT EXISTS idx_fhir_diag_reports_effective ON public.fhir_diagnostic_reports(effective_datetime DESC) WHERE effective_datetime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fhir_diag_reports_fhir_id ON public.fhir_diagnostic_reports(fhir_id);
CREATE INDEX IF NOT EXISTS idx_fhir_diag_reports_external_id ON public.fhir_diagnostic_reports(external_id) WHERE external_id IS NOT NULL;

-- Composite index for common searches
CREATE INDEX IF NOT EXISTS idx_fhir_diag_reports_patient_category ON public.fhir_diagnostic_reports(patient_id, category);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_fhir_diag_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fhir_diag_report_updated_at
  BEFORE UPDATE ON public.fhir_diagnostic_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fhir_diag_report_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.fhir_diagnostic_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
DROP POLICY IF EXISTS "fhir_diag_reports_user_select" ON public.fhir_diagnostic_reports;
CREATE POLICY "fhir_diag_reports_user_select"
  ON public.fhir_diagnostic_reports FOR SELECT
  USING (patient_id = auth.uid());

-- Staff can view all reports
DROP POLICY IF EXISTS "fhir_diag_reports_staff_select" ON public.fhir_diagnostic_reports;
CREATE POLICY "fhir_diag_reports_staff_select"
  ON public.fhir_diagnostic_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'caregiver', 'doctor', 'nurse', 'lab_tech')
    )
  );

-- Only clinical staff and lab techs can insert
DROP POLICY IF EXISTS "fhir_diag_reports_staff_insert" ON public.fhir_diagnostic_reports;
CREATE POLICY "fhir_diag_reports_staff_insert"
  ON public.fhir_diagnostic_reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'doctor', 'nurse', 'lab_tech')
    )
  );

-- Only clinical staff can update
DROP POLICY IF EXISTS "fhir_diag_reports_staff_update" ON public.fhir_diagnostic_reports;
CREATE POLICY "fhir_diag_reports_staff_update"
  ON public.fhir_diagnostic_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'doctor', 'nurse', 'lab_tech')
    )
  );

-- Only admins can delete
DROP POLICY IF EXISTS "fhir_diag_reports_admin_delete" ON public.fhir_diagnostic_reports;
CREATE POLICY "fhir_diag_reports_admin_delete"
  ON public.fhir_diagnostic_reports FOR DELETE
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

-- Get recent diagnostic reports for a patient
CREATE OR REPLACE FUNCTION public.get_recent_diagnostic_reports(
  patient_id_param UUID,
  limit_param INTEGER DEFAULT 20
)
RETURNS SETOF public.fhir_diagnostic_reports
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_diagnostic_reports
  WHERE patient_id = patient_id_param
    AND status IN ('final', 'amended', 'corrected')
  ORDER BY issued DESC
  LIMIT limit_param;
END;
$$;

-- Get lab reports for a patient
CREATE OR REPLACE FUNCTION public.get_lab_reports(
  patient_id_param UUID,
  days_back INTEGER DEFAULT 90
)
RETURNS SETOF public.fhir_diagnostic_reports
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_diagnostic_reports
  WHERE patient_id = patient_id_param
    AND 'LAB' = ANY(category)
    AND issued > NOW() - (days_back || ' days')::INTERVAL
  ORDER BY issued DESC;
END;
$$;

-- Get imaging reports for a patient
CREATE OR REPLACE FUNCTION public.get_imaging_reports(
  patient_id_param UUID,
  days_back INTEGER DEFAULT 365
)
RETURNS SETOF public.fhir_diagnostic_reports
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_diagnostic_reports
  WHERE patient_id = patient_id_param
    AND ('RAD' = ANY(category) OR 'IMG' = ANY(category))
    AND issued > NOW() - (days_back || ' days')::INTERVAL
  ORDER BY issued DESC;
END;
$$;

-- Search reports by code (LOINC)
CREATE OR REPLACE FUNCTION public.search_diagnostic_reports_by_code(
  patient_id_param UUID,
  loinc_code TEXT
)
RETURNS SETOF public.fhir_diagnostic_reports
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_diagnostic_reports
  WHERE patient_id = patient_id_param
    AND code = loinc_code
  ORDER BY issued DESC;
END;
$$;

-- Get pending/preliminary reports
CREATE OR REPLACE FUNCTION public.get_pending_reports(patient_id_param UUID)
RETURNS SETOF public.fhir_diagnostic_reports
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_diagnostic_reports
  WHERE patient_id = patient_id_param
    AND status IN ('registered', 'partial', 'preliminary')
  ORDER BY issued DESC;
END;
$$;

COMMIT;

-- migrate:down
BEGIN;

DROP FUNCTION IF EXISTS public.get_pending_reports(UUID);
DROP FUNCTION IF EXISTS public.search_diagnostic_reports_by_code(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_imaging_reports(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_lab_reports(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_recent_diagnostic_reports(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.update_fhir_diag_report_updated_at();
DROP TABLE IF EXISTS public.fhir_diagnostic_reports CASCADE;

COMMIT;
