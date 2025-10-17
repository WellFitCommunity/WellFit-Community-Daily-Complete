-- ============================================================================
-- FHIR R4 OBSERVATION RESOURCE
-- Complete implementation supporting vitals, labs, social history, and clinical observations
-- US Core Observation Profiles: Vital Signs, Laboratory, Social History
-- ============================================================================

BEGIN;

-- ============================================================================
-- OBSERVATION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_observations (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,

  -- FHIR Status (required)
  status TEXT NOT NULL CHECK (status IN (
    'registered', 'preliminary', 'final', 'amended',
    'corrected', 'cancelled', 'entered-in-error', 'unknown'
  )),

  -- Category (required for US Core) - FHIR R4 uses array
  category TEXT[] NOT NULL DEFAULT ARRAY['vital-signs']::TEXT[],
  category_coding_system TEXT[] DEFAULT ARRAY['http://terminology.hl7.org/CodeSystem/observation-category']::TEXT[],

  -- Code (required) - What was observed (LOINC preferred)
  code_system TEXT NOT NULL DEFAULT 'http://loinc.org',
  code TEXT NOT NULL,
  code_display TEXT NOT NULL,
  code_text TEXT,

  -- Subject (required)
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Encounter reference
  encounter_id UUID,

  -- Effective DateTime/Period (when observation was made)
  effective_datetime TIMESTAMPTZ,
  effective_period_start TIMESTAMPTZ,
  effective_period_end TIMESTAMPTZ,

  -- Issued (when result was made available)
  issued TIMESTAMPTZ DEFAULT NOW(),

  -- Performers (who was responsible)
  performer_type TEXT[],
  performer_id TEXT[],
  performer_display TEXT[],

  -- Value[x] - Support multiple value types
  value_quantity_value DECIMAL(10, 3),
  value_quantity_unit TEXT,
  value_quantity_code TEXT,
  value_quantity_system TEXT DEFAULT 'http://unitsofmeasure.org',

  value_codeable_concept_code TEXT,
  value_codeable_concept_display TEXT,
  value_codeable_concept_system TEXT,

  value_string TEXT,
  value_boolean BOOLEAN,
  value_integer INTEGER,
  value_range_low DECIMAL(10, 3),
  value_range_high DECIMAL(10, 3),
  value_ratio_numerator DECIMAL(10, 3),
  value_ratio_denominator DECIMAL(10, 3),
  value_sampled_data JSONB,
  value_time TIME,
  value_datetime TIMESTAMPTZ,
  value_period_start TIMESTAMPTZ,
  value_period_end TIMESTAMPTZ,

  -- Data Absent Reason (if no value)
  data_absent_reason_code TEXT,
  data_absent_reason_display TEXT,

  -- Interpretation (normal, abnormal, critical, etc.)
  interpretation_code TEXT[],
  interpretation_display TEXT[],
  interpretation_system TEXT[] DEFAULT ARRAY['http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation']::TEXT[],

  -- Notes/Comments
  note TEXT,

  -- Body Site
  body_site_code TEXT,
  body_site_display TEXT,
  body_site_system TEXT DEFAULT 'http://snomed.info/sct',

  -- Method
  method_code TEXT,
  method_display TEXT,
  method_system TEXT,

  -- Specimen
  specimen_id TEXT,
  specimen_display TEXT,

  -- Device
  device_id TEXT,
  device_display TEXT,

  -- Reference Range
  reference_range_low DECIMAL(10, 3),
  reference_range_high DECIMAL(10, 3),
  reference_range_type_code TEXT,
  reference_range_type_display TEXT,
  reference_range_applies_to_code TEXT[],
  reference_range_age_low DECIMAL(5, 2),
  reference_range_age_high DECIMAL(5, 2),
  reference_range_text TEXT,

  -- Components (for complex observations like BP)
  components JSONB DEFAULT '[]'::jsonb,

  -- Has Member (related observations)
  has_member_ids TEXT[],

  -- Derived From (source observations)
  derived_from_ids TEXT[],

  -- Based On (what this observation fulfills)
  based_on_type TEXT[],
  based_on_id TEXT[],

  -- Part Of (larger event this is part of)
  part_of_type TEXT[],
  part_of_id TEXT[],

  -- Focus (what observation is about if not patient)
  focus_type TEXT,
  focus_id TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  sync_source TEXT,
  external_id TEXT,

  -- Legacy compatibility (link to old check_ins table)
  check_in_id BIGINT REFERENCES public.check_ins(id) ON DELETE SET NULL
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX idx_fhir_observations_patient ON public.fhir_observations(patient_id);
CREATE INDEX idx_fhir_observations_code ON public.fhir_observations(code);
CREATE INDEX idx_fhir_observations_status ON public.fhir_observations(status);
CREATE INDEX idx_fhir_observations_effective_datetime ON public.fhir_observations(effective_datetime DESC);
CREATE INDEX idx_fhir_observations_issued ON public.fhir_observations(issued DESC);

-- Category index (GIN for array search)
CREATE INDEX idx_fhir_observations_category ON public.fhir_observations USING GIN (category);

-- Composite indexes for common queries
CREATE INDEX idx_fhir_observations_patient_category ON public.fhir_observations(patient_id, category);
CREATE INDEX idx_fhir_observations_patient_code ON public.fhir_observations(patient_id, code);
CREATE INDEX idx_fhir_observations_patient_date ON public.fhir_observations(patient_id, effective_datetime DESC);

-- Encounter index
CREATE INDEX idx_fhir_observations_encounter ON public.fhir_observations(encounter_id) WHERE encounter_id IS NOT NULL;

-- External sync index
CREATE INDEX idx_fhir_observations_external ON public.fhir_observations(external_id) WHERE external_id IS NOT NULL;

-- Components JSONB index
CREATE INDEX idx_fhir_observations_components ON public.fhir_observations USING GIN (components);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.fhir_observations ENABLE ROW LEVEL SECURITY;

-- Patients can view their own observations
CREATE POLICY fhir_observations_select_own
ON public.fhir_observations FOR SELECT
USING (patient_id = auth.uid());

-- Staff can view all observations
CREATE POLICY fhir_observations_select_staff
ON public.fhir_observations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff', 'doctor', 'nurse', 'lab_tech')
  )
);

-- Staff can create observations
CREATE POLICY fhir_observations_insert_staff
ON public.fhir_observations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff', 'doctor', 'nurse', 'lab_tech')
  )
);

-- Patients can insert their own vitals/observations
CREATE POLICY fhir_observations_insert_own
ON public.fhir_observations FOR INSERT
WITH CHECK (patient_id = auth.uid());

-- Staff can update observations
CREATE POLICY fhir_observations_update_staff
ON public.fhir_observations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'staff', 'doctor', 'nurse', 'lab_tech')
  )
);

-- Admin can delete observations
CREATE POLICY fhir_observations_delete_admin
ON public.fhir_observations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Caregivers can view patient observations if granted
CREATE POLICY fhir_observations_select_caregiver
ON public.fhir_observations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.caregiver_view_grants
    WHERE senior_user_id = patient_id
    AND caregiver_user_id = auth.uid()
    AND expires_at > NOW()
  )
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get vital signs for a patient
CREATE OR REPLACE FUNCTION get_patient_vital_signs(
  patient_id_param UUID,
  days_param INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  code TEXT,
  code_display TEXT,
  value DECIMAL,
  unit TEXT,
  effective_datetime TIMESTAMPTZ,
  interpretation TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.code,
    o.code_display,
    o.value_quantity_value,
    o.value_quantity_unit,
    o.effective_datetime,
    o.interpretation_display[1],
    o.status
  FROM public.fhir_observations o
  WHERE o.patient_id = patient_id_param
    AND 'vital-signs' = ANY(o.category)
    AND o.status IN ('final', 'amended', 'corrected')
    AND o.effective_datetime >= NOW() - (days_param || ' days')::INTERVAL
  ORDER BY o.effective_datetime DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get laboratory results for a patient
CREATE OR REPLACE FUNCTION get_patient_lab_results(
  patient_id_param UUID,
  days_param INTEGER DEFAULT 90
)
RETURNS TABLE (
  id UUID,
  code TEXT,
  code_display TEXT,
  value DECIMAL,
  unit TEXT,
  effective_datetime TIMESTAMPTZ,
  interpretation TEXT,
  reference_range TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.code,
    o.code_display,
    o.value_quantity_value,
    o.value_quantity_unit,
    o.effective_datetime,
    o.interpretation_display[1],
    CASE
      WHEN o.reference_range_low IS NOT NULL AND o.reference_range_high IS NOT NULL
      THEN o.reference_range_low::TEXT || '-' || o.reference_range_high::TEXT || ' ' || COALESCE(o.value_quantity_unit, '')
      ELSE o.reference_range_text
    END,
    o.status
  FROM public.fhir_observations o
  WHERE o.patient_id = patient_id_param
    AND 'laboratory' = ANY(o.category)
    AND o.status IN ('final', 'amended', 'corrected')
    AND o.effective_datetime >= NOW() - (days_param || ' days')::INTERVAL
  ORDER BY o.effective_datetime DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get social history observations (smoking, alcohol, etc.)
CREATE OR REPLACE FUNCTION get_patient_social_history(
  patient_id_param UUID
)
RETURNS TABLE (
  id UUID,
  code TEXT,
  code_display TEXT,
  value_display TEXT,
  effective_datetime TIMESTAMPTZ,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.code,
    o.code_display,
    COALESCE(
      o.value_codeable_concept_display,
      o.value_string,
      o.value_quantity_value::TEXT || ' ' || COALESCE(o.value_quantity_unit, '')
    ),
    o.effective_datetime,
    o.status
  FROM public.fhir_observations o
  WHERE o.patient_id = patient_id_param
    AND 'social-history' = ANY(o.category)
    AND o.status IN ('final', 'amended', 'corrected')
  ORDER BY o.effective_datetime DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get observations by code (for trending specific values)
CREATE OR REPLACE FUNCTION get_observations_by_code(
  patient_id_param UUID,
  code_param TEXT,
  days_param INTEGER DEFAULT 365
)
RETURNS TABLE (
  id UUID,
  value DECIMAL,
  unit TEXT,
  effective_datetime TIMESTAMPTZ,
  interpretation TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.value_quantity_value,
    o.value_quantity_unit,
    o.effective_datetime,
    o.interpretation_display[1],
    o.status
  FROM public.fhir_observations o
  WHERE o.patient_id = patient_id_param
    AND o.code = code_param
    AND o.status IN ('final', 'amended', 'corrected')
    AND o.effective_datetime >= NOW() - (days_param || ' days')::INTERVAL
  ORDER BY o.effective_datetime ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate existing check_ins to FHIR observations
CREATE OR REPLACE FUNCTION migrate_check_ins_to_observations()
RETURNS INTEGER AS $$
DECLARE
  migrated_count INTEGER := 0;
  check_in_record RECORD;
BEGIN
  -- Loop through check_ins that haven't been migrated yet
  FOR check_in_record IN
    SELECT ci.*
    FROM public.check_ins ci
    LEFT JOIN public.fhir_observations fo ON fo.check_in_id = ci.id
    WHERE fo.id IS NULL
  LOOP
    -- Migrate heart rate
    IF check_in_record.heart_rate IS NOT NULL THEN
      INSERT INTO public.fhir_observations (
        patient_id, status, category, code, code_display,
        value_quantity_value, value_quantity_unit, value_quantity_code,
        effective_datetime, issued, check_in_id
      ) VALUES (
        check_in_record.user_id, 'final', ARRAY['vital-signs'],
        '8867-4', 'Heart rate',
        check_in_record.heart_rate, '/min', '/min',
        check_in_record.timestamp, check_in_record.created_at, check_in_record.id
      );
      migrated_count := migrated_count + 1;
    END IF;

    -- Migrate oxygen saturation
    IF check_in_record.pulse_oximeter IS NOT NULL THEN
      INSERT INTO public.fhir_observations (
        patient_id, status, category, code, code_display,
        value_quantity_value, value_quantity_unit, value_quantity_code,
        effective_datetime, issued, check_in_id
      ) VALUES (
        check_in_record.user_id, 'final', ARRAY['vital-signs'],
        '2708-6', 'Oxygen saturation',
        check_in_record.pulse_oximeter, '%', '%',
        check_in_record.timestamp, check_in_record.created_at, check_in_record.id
      );
      migrated_count := migrated_count + 1;
    END IF;

    -- Migrate blood pressure (as single observation with components)
    IF check_in_record.bp_systolic IS NOT NULL AND check_in_record.bp_diastolic IS NOT NULL THEN
      INSERT INTO public.fhir_observations (
        patient_id, status, category, code, code_display,
        effective_datetime, issued, check_in_id,
        components
      ) VALUES (
        check_in_record.user_id, 'final', ARRAY['vital-signs'],
        '85354-9', 'Blood pressure panel',
        check_in_record.timestamp, check_in_record.created_at, check_in_record.id,
        jsonb_build_array(
          jsonb_build_object(
            'code', '8480-6',
            'display', 'Systolic blood pressure',
            'value', check_in_record.bp_systolic,
            'unit', 'mmHg'
          ),
          jsonb_build_object(
            'code', '8462-4',
            'display', 'Diastolic blood pressure',
            'value', check_in_record.bp_diastolic,
            'unit', 'mmHg'
          )
        )
      );
      migrated_count := migrated_count + 1;
    END IF;

    -- Migrate glucose
    IF check_in_record.glucose_mg_dl IS NOT NULL THEN
      INSERT INTO public.fhir_observations (
        patient_id, status, category, code, code_display,
        value_quantity_value, value_quantity_unit, value_quantity_code,
        effective_datetime, issued, check_in_id
      ) VALUES (
        check_in_record.user_id, 'final', ARRAY['vital-signs'],
        '2339-0', 'Glucose',
        check_in_record.glucose_mg_dl, 'mg/dL', 'mg/dL',
        check_in_record.timestamp, check_in_record.created_at, check_in_record.id
      );
      migrated_count := migrated_count + 1;
    END IF;
  END LOOP;

  RETURN migrated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_fhir_observations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_fhir_observations_timestamp
BEFORE UPDATE ON public.fhir_observations
FOR EACH ROW
EXECUTE FUNCTION update_fhir_observations_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.fhir_observations IS 'FHIR R4 Observation resource - vitals, labs, social history, clinical observations (US Core compliant)';
COMMENT ON COLUMN public.fhir_observations.category IS 'US Core categories: vital-signs, laboratory, social-history, survey, exam, therapy, activity, imaging, procedure';
COMMENT ON COLUMN public.fhir_observations.code IS 'LOINC code for what was observed (e.g., 8867-4 for heart rate)';
COMMENT ON COLUMN public.fhir_observations.components IS 'For complex observations like BP: [{code, display, value, unit}]';
COMMENT ON COLUMN public.fhir_observations.interpretation_code IS 'Interpretation codes: N (normal), H (high), L (low), HH (critical high), LL (critical low)';

COMMIT;

-- Run migration from check_ins to observations
SELECT migrate_check_ins_to_observations();
