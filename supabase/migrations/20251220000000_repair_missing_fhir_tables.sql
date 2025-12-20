-- Repair Migration: Create Missing FHIR Tables
-- fhir_conditions and fhir_diagnostic_reports were not created despite migrations being marked as applied
-- This migration safely creates them if they don't exist

BEGIN;

-- ============================================================================
-- FHIR CONDITIONS TABLE (Diagnoses, Problems, Health Concerns)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT UNIQUE NOT NULL DEFAULT 'Condition/' || gen_random_uuid()::text,

  -- Clinical Status (required)
  clinical_status TEXT NOT NULL CHECK (clinical_status IN (
    'active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'
  )),

  -- Verification Status
  verification_status TEXT NOT NULL CHECK (verification_status IN (
    'unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error'
  )),

  -- Category
  category TEXT[] DEFAULT ARRAY['problem-list-item'],
  category_coding_system TEXT[] DEFAULT ARRAY['http://terminology.hl7.org/CodeSystem/condition-category'],

  -- Severity
  severity_code TEXT,
  severity_display TEXT,
  severity_system TEXT DEFAULT 'http://snomed.info/sct',

  -- Condition Code (required) - ICD-10, SNOMED CT
  code_system TEXT NOT NULL,
  code TEXT NOT NULL,
  code_display TEXT NOT NULL,
  code_text TEXT,

  -- Body Site
  body_site_code TEXT,
  body_site_display TEXT,
  body_site_system TEXT DEFAULT 'http://snomed.info/sct',

  -- Patient Reference (required)
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Encounter Context
  encounter_id UUID,

  -- Onset
  onset_datetime TIMESTAMPTZ,
  onset_age_value DECIMAL,
  onset_age_unit TEXT,
  onset_period_start TIMESTAMPTZ,
  onset_period_end TIMESTAMPTZ,
  onset_string TEXT,

  -- Abatement
  abatement_datetime TIMESTAMPTZ,
  abatement_string TEXT,

  -- Recorded Date
  recorded_date TIMESTAMPTZ DEFAULT NOW(),

  -- Recorder
  recorder_type TEXT,
  recorder_id UUID,
  recorder_display TEXT,

  -- Asserter
  asserter_type TEXT,
  asserter_id UUID,
  asserter_display TEXT,

  -- Stage (for cancer, etc.)
  stage_summary_code TEXT,
  stage_summary_display TEXT,

  -- Evidence
  evidence_code TEXT[],
  evidence_detail_ids UUID[],

  -- Notes
  note TEXT,

  -- Primary diagnosis flag
  is_primary BOOLEAN DEFAULT false,
  rank INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sync tracking
  last_synced_at TIMESTAMPTZ,
  sync_source TEXT,
  external_id TEXT,

  -- Tenant isolation
  tenant_id UUID
);

-- Indexes for fhir_conditions
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_patient_id ON public.fhir_conditions(patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_clinical_status ON public.fhir_conditions(clinical_status);
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_code ON public.fhir_conditions(code);
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_fhir_id ON public.fhir_conditions(fhir_id);
CREATE INDEX IF NOT EXISTS idx_fhir_conditions_tenant_id ON public.fhir_conditions(tenant_id) WHERE tenant_id IS NOT NULL;

-- RLS for fhir_conditions
ALTER TABLE public.fhir_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fhir_conditions_select_own" ON public.fhir_conditions;
CREATE POLICY "fhir_conditions_select_own"
  ON public.fhir_conditions FOR SELECT
  USING (patient_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

DROP POLICY IF EXISTS "fhir_conditions_insert_admin" ON public.fhir_conditions;
CREATE POLICY "fhir_conditions_insert_admin"
  ON public.fhir_conditions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

DROP POLICY IF EXISTS "fhir_conditions_update_admin" ON public.fhir_conditions;
CREATE POLICY "fhir_conditions_update_admin"
  ON public.fhir_conditions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

-- ============================================================================
-- FHIR DIAGNOSTIC REPORTS TABLE (Lab Results, Imaging Reports)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_diagnostic_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT UNIQUE NOT NULL DEFAULT 'DiagnosticReport/' || gen_random_uuid()::text,

  -- Status (required)
  status TEXT NOT NULL CHECK (status IN (
    'registered', 'partial', 'preliminary', 'final', 'amended',
    'corrected', 'appended', 'cancelled', 'entered-in-error', 'unknown'
  )),

  -- Category - LAB, RAD, etc.
  category TEXT[] NOT NULL DEFAULT ARRAY['LAB'],
  category_coding_system TEXT[] DEFAULT ARRAY['http://terminology.hl7.org/CodeSystem/v2-0074'],

  -- Report Code (required) - LOINC
  code_system TEXT NOT NULL DEFAULT 'http://loinc.org',
  code TEXT NOT NULL,
  code_display TEXT NOT NULL,
  code_text TEXT,

  -- Patient Reference (required)
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Encounter Context
  encounter_id UUID,

  -- Effective Time
  effective_datetime TIMESTAMPTZ,
  effective_period_start TIMESTAMPTZ,
  effective_period_end TIMESTAMPTZ,

  -- Issued
  issued TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Performer
  performer_type TEXT[] DEFAULT ARRAY['Practitioner'],
  performer_id UUID[],
  performer_display TEXT[],

  -- Results (references to Observation resources)
  result_observation_ids UUID[],

  -- Conclusion
  conclusion TEXT,
  conclusion_code TEXT[],
  conclusion_code_display TEXT[],

  -- Presented Form (PDF, image)
  presented_form_content_type TEXT,
  presented_form_url TEXT,
  presented_form_title TEXT,

  -- Report Metadata
  report_priority TEXT CHECK (report_priority IN ('routine', 'urgent', 'asap', 'stat')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sync tracking
  last_synced_at TIMESTAMPTZ,
  sync_source TEXT,
  external_id TEXT,

  -- Tenant isolation
  tenant_id UUID
);

-- Indexes for fhir_diagnostic_reports
CREATE INDEX IF NOT EXISTS idx_fhir_diagnostic_reports_patient_id ON public.fhir_diagnostic_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_diagnostic_reports_status ON public.fhir_diagnostic_reports(status);
CREATE INDEX IF NOT EXISTS idx_fhir_diagnostic_reports_code ON public.fhir_diagnostic_reports(code);
CREATE INDEX IF NOT EXISTS idx_fhir_diagnostic_reports_fhir_id ON public.fhir_diagnostic_reports(fhir_id);
CREATE INDEX IF NOT EXISTS idx_fhir_diagnostic_reports_issued ON public.fhir_diagnostic_reports(issued DESC);
CREATE INDEX IF NOT EXISTS idx_fhir_diagnostic_reports_tenant_id ON public.fhir_diagnostic_reports(tenant_id) WHERE tenant_id IS NOT NULL;

-- RLS for fhir_diagnostic_reports
ALTER TABLE public.fhir_diagnostic_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fhir_diagnostic_reports_select_own" ON public.fhir_diagnostic_reports;
CREATE POLICY "fhir_diagnostic_reports_select_own"
  ON public.fhir_diagnostic_reports FOR SELECT
  USING (patient_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

DROP POLICY IF EXISTS "fhir_diagnostic_reports_insert_admin" ON public.fhir_diagnostic_reports;
CREATE POLICY "fhir_diagnostic_reports_insert_admin"
  ON public.fhir_diagnostic_reports FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

DROP POLICY IF EXISTS "fhir_diagnostic_reports_update_admin" ON public.fhir_diagnostic_reports;
CREATE POLICY "fhir_diagnostic_reports_update_admin"
  ON public.fhir_diagnostic_reports FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

-- ============================================================================
-- HELPER FUNCTION: Map self_reports to FHIR Observations
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_self_report_to_fhir_observation(
  report_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report RECORD;
  v_observation_id UUID;
BEGIN
  -- Get the self report
  SELECT * INTO v_report FROM public.self_reports WHERE id = report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Self report not found: %', report_id;
  END IF;

  -- Create vital signs observation (blood pressure)
  IF v_report.bp_systolic IS NOT NULL AND v_report.bp_diastolic IS NOT NULL THEN
    INSERT INTO public.fhir_observations (
      patient_id,
      status,
      category,
      code_system,
      code,
      code_display,
      effective_datetime,
      value_quantity_value,
      value_quantity_unit,
      components,
      tenant_id
    ) VALUES (
      v_report.user_id,
      'final',
      ARRAY['vital-signs'],
      'http://loinc.org',
      '85354-9',
      'Blood pressure panel',
      v_report.created_at,
      v_report.bp_systolic, -- Systolic as main value
      'mmHg',
      jsonb_build_array(
        jsonb_build_object(
          'code', '8480-6',
          'display', 'Systolic blood pressure',
          'value', v_report.bp_systolic,
          'unit', 'mmHg'
        ),
        jsonb_build_object(
          'code', '8462-4',
          'display', 'Diastolic blood pressure',
          'value', v_report.bp_diastolic,
          'unit', 'mmHg'
        )
      ),
      v_report.tenant_id
    )
    RETURNING id INTO v_observation_id;
  END IF;

  -- Create heart rate observation
  IF v_report.heart_rate IS NOT NULL THEN
    INSERT INTO public.fhir_observations (
      patient_id,
      status,
      category,
      code_system,
      code,
      code_display,
      effective_datetime,
      value_quantity_value,
      value_quantity_unit,
      value_quantity_code,
      tenant_id
    ) VALUES (
      v_report.user_id,
      'final',
      ARRAY['vital-signs'],
      'http://loinc.org',
      '8867-4',
      'Heart rate',
      v_report.created_at,
      v_report.heart_rate,
      '/min',
      '{beats}/min',
      v_report.tenant_id
    );
  END IF;

  -- Create SpO2 observation
  IF v_report.spo2 IS NOT NULL OR v_report.blood_oxygen IS NOT NULL THEN
    INSERT INTO public.fhir_observations (
      patient_id,
      status,
      category,
      code_system,
      code,
      code_display,
      effective_datetime,
      value_quantity_value,
      value_quantity_unit,
      tenant_id
    ) VALUES (
      v_report.user_id,
      'final',
      ARRAY['vital-signs'],
      'http://loinc.org',
      '2708-6',
      'Oxygen saturation in Arterial blood',
      v_report.created_at,
      COALESCE(v_report.spo2, v_report.blood_oxygen),
      '%',
      v_report.tenant_id
    );
  END IF;

  -- Create blood glucose observation
  IF v_report.blood_sugar IS NOT NULL THEN
    INSERT INTO public.fhir_observations (
      patient_id,
      status,
      category,
      code_system,
      code,
      code_display,
      effective_datetime,
      value_quantity_value,
      value_quantity_unit,
      tenant_id
    ) VALUES (
      v_report.user_id,
      'final',
      ARRAY['laboratory'],
      'http://loinc.org',
      '2339-0',
      'Glucose [Mass/volume] in Blood',
      v_report.created_at,
      v_report.blood_sugar,
      'mg/dL',
      v_report.tenant_id
    );
  END IF;

  -- Create weight observation
  IF v_report.weight IS NOT NULL THEN
    INSERT INTO public.fhir_observations (
      patient_id,
      status,
      category,
      code_system,
      code,
      code_display,
      effective_datetime,
      value_quantity_value,
      value_quantity_unit,
      tenant_id
    ) VALUES (
      v_report.user_id,
      'final',
      ARRAY['vital-signs'],
      'http://loinc.org',
      '29463-7',
      'Body weight',
      v_report.created_at,
      v_report.weight,
      'lb',
      v_report.tenant_id
    );
  END IF;

  RETURN v_observation_id;
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: Batch sync all unsynced self_reports
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_all_self_reports_to_fhir()
RETURNS TABLE(synced_count INTEGER, error_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report RECORD;
  v_synced INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  FOR v_report IN
    SELECT sr.id
    FROM public.self_reports sr
    LEFT JOIN public.fhir_observations fo ON fo.patient_id = sr.user_id
      AND DATE(fo.effective_datetime) = DATE(sr.created_at)
    WHERE fo.id IS NULL
    ORDER BY sr.created_at DESC
    LIMIT 1000
  LOOP
    BEGIN
      PERFORM public.sync_self_report_to_fhir_observation(v_report.id);
      v_synced := v_synced + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_synced, v_errors;
END;
$$;

-- ============================================================================
-- FHIR EXPORT VIEW: Patient Bundle
-- ============================================================================
CREATE OR REPLACE VIEW public.fhir_patient_bundle AS
SELECT
  p.id as patient_id,
  jsonb_build_object(
    'resourceType', 'Bundle',
    'type', 'collection',
    'timestamp', NOW(),
    'entry', (
      SELECT jsonb_agg(jsonb_build_object(
        'resource', jsonb_build_object(
          'resourceType', 'Observation',
          'id', fo.fhir_id,
          'status', fo.status,
          'category', (
            SELECT jsonb_agg(jsonb_build_object(
              'coding', jsonb_build_array(jsonb_build_object(
                'system', 'http://terminology.hl7.org/CodeSystem/observation-category',
                'code', cat
              ))
            ))
            FROM unnest(fo.category) cat
          ),
          'code', jsonb_build_object(
            'coding', jsonb_build_array(jsonb_build_object(
              'system', fo.code_system,
              'code', fo.code,
              'display', fo.code_display
            ))
          ),
          'subject', jsonb_build_object(
            'reference', 'Patient/' || fo.patient_id::text
          ),
          'effectiveDateTime', fo.effective_datetime,
          'valueQuantity', CASE WHEN fo.value_quantity_value IS NOT NULL THEN
            jsonb_build_object(
              'value', fo.value_quantity_value,
              'unit', fo.value_quantity_unit,
              'system', 'http://unitsofmeasure.org',
              'code', COALESCE(fo.value_quantity_code, fo.value_quantity_unit)
            )
          END,
          'component', fo.components
        )
      ))
      FROM public.fhir_observations fo
      WHERE fo.patient_id = p.id
    )
  ) as bundle
FROM public.profiles p;

COMMIT;
