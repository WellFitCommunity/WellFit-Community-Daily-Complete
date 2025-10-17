-- FHIR MedicationRequest Resource Migration
-- Handles prescriptions, refills, and medication orders
-- FHIR R4 Compliant

BEGIN;

-- ============================================================================
-- FHIR MEDICATION REQUEST TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_medication_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FHIR Resource Metadata
  fhir_id TEXT UNIQUE NOT NULL DEFAULT 'MedicationRequest/' || gen_random_uuid()::text,
  status TEXT NOT NULL CHECK (status IN ('active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown')),
  intent TEXT NOT NULL CHECK (intent IN ('proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option')),

  -- Patient Reference
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Medication Information
  medication_code_system TEXT, -- RxNorm, NDC, SNOMED CT
  medication_code TEXT NOT NULL,
  medication_display TEXT NOT NULL, -- e.g., "Lisinopril 10mg tablet"
  medication_text TEXT, -- Free text medication name

  -- Dosage Instructions
  dosage_text TEXT, -- Human-readable dosage (e.g., "Take 1 tablet by mouth daily")
  dosage_timing_frequency INTEGER, -- How many times per period
  dosage_timing_period DECIMAL,
  dosage_timing_period_unit TEXT CHECK (dosage_timing_period_unit IN ('s', 'min', 'h', 'd', 'wk', 'mo', 'a')),
  dosage_route_code TEXT, -- SNOMED CT route code
  dosage_route_display TEXT, -- e.g., "Oral", "Intravenous"
  dosage_dose_quantity DECIMAL,
  dosage_dose_unit TEXT, -- e.g., "mg", "mL", "tablet"
  dosage_dose_code TEXT, -- UCUM code

  -- Additional Instructions
  dosage_additional_instruction TEXT[], -- Array of additional instructions
  dosage_patient_instruction TEXT, -- Instructions for patient
  dosage_as_needed_boolean BOOLEAN DEFAULT false,
  dosage_as_needed_reason TEXT,

  -- Supply and Dispensing
  dispense_quantity DECIMAL,
  dispense_unit TEXT,
  dispense_expected_supply_duration DECIMAL,
  dispense_expected_supply_duration_unit TEXT,
  number_of_repeats_allowed INTEGER DEFAULT 0,

  -- Validity Period
  validity_period_start TIMESTAMPTZ,
  validity_period_end TIMESTAMPTZ,

  -- Dates
  authored_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Requester (Prescriber)
  requester_type TEXT CHECK (requester_type IN ('Practitioner', 'PractitionerRole', 'Organization', 'Patient', 'RelatedPerson', 'Device')),
  requester_id UUID, -- Can reference profiles table or practitioners
  requester_display TEXT, -- e.g., "Dr. John Smith"

  -- Performer (Dispenser)
  performer_type TEXT,
  performer_id UUID,
  performer_display TEXT,

  -- Reason for Medication
  reason_code TEXT[], -- ICD-10, SNOMED CT codes
  reason_reference UUID[], -- Reference to Condition resources

  -- Priority
  priority TEXT CHECK (priority IN ('routine', 'urgent', 'asap', 'stat')),

  -- Supporting Information
  category TEXT[], -- e.g., "inpatient", "outpatient", "community", "discharge"

  -- Notes
  note TEXT,

  -- Substitution
  substitution_allowed BOOLEAN DEFAULT true,
  substitution_reason_code TEXT,

  -- Prior Prescription
  prior_prescription_id UUID REFERENCES public.fhir_medication_requests(id),

  -- Based On (CarePlan, etc.)
  based_on_type TEXT,
  based_on_id UUID,

  -- Reported By
  reported_boolean BOOLEAN DEFAULT false,
  reported_reference_type TEXT,
  reported_reference_id UUID,

  -- Encounter Context
  encounter_id UUID, -- Reference to encounters table

  -- Insurance/Coverage
  insurance_id UUID, -- Reference to insurance/coverage

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
CREATE INDEX IF NOT EXISTS idx_fhir_med_requests_patient_id ON public.fhir_medication_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_med_requests_status ON public.fhir_medication_requests(status) WHERE status IN ('active', 'on-hold');
CREATE INDEX IF NOT EXISTS idx_fhir_med_requests_medication_code ON public.fhir_medication_requests(medication_code);
CREATE INDEX IF NOT EXISTS idx_fhir_med_requests_authored_on ON public.fhir_medication_requests(authored_on DESC);
CREATE INDEX IF NOT EXISTS idx_fhir_med_requests_encounter_id ON public.fhir_medication_requests(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fhir_med_requests_requester ON public.fhir_medication_requests(requester_id) WHERE requester_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fhir_med_requests_fhir_id ON public.fhir_medication_requests(fhir_id);
CREATE INDEX IF NOT EXISTS idx_fhir_med_requests_external_id ON public.fhir_medication_requests(external_id) WHERE external_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_fhir_med_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fhir_med_request_updated_at
  BEFORE UPDATE ON public.fhir_medication_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fhir_med_request_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.fhir_medication_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own medication requests
DROP POLICY IF EXISTS "fhir_med_requests_user_select" ON public.fhir_medication_requests;
CREATE POLICY "fhir_med_requests_user_select"
  ON public.fhir_medication_requests FOR SELECT
  USING (patient_id = auth.uid());

-- Admins, caregivers, and prescribers can view all
DROP POLICY IF EXISTS "fhir_med_requests_staff_select" ON public.fhir_medication_requests;
CREATE POLICY "fhir_med_requests_staff_select"
  ON public.fhir_medication_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'caregiver', 'doctor', 'nurse')
    )
  );

-- Only prescribers can insert new requests
DROP POLICY IF EXISTS "fhir_med_requests_prescriber_insert" ON public.fhir_medication_requests;
CREATE POLICY "fhir_med_requests_prescriber_insert"
  ON public.fhir_medication_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
    )
  );

-- Only prescribers can update requests
DROP POLICY IF EXISTS "fhir_med_requests_prescriber_update" ON public.fhir_medication_requests;
CREATE POLICY "fhir_med_requests_prescriber_update"
  ON public.fhir_medication_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
    )
  );

-- Only admins can delete
DROP POLICY IF EXISTS "fhir_med_requests_admin_delete" ON public.fhir_medication_requests;
CREATE POLICY "fhir_med_requests_admin_delete"
  ON public.fhir_medication_requests FOR DELETE
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

-- Get active medication requests for a patient
CREATE OR REPLACE FUNCTION public.get_active_medication_requests(patient_id_param UUID)
RETURNS SETOF public.fhir_medication_requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_medication_requests
  WHERE patient_id = patient_id_param
    AND status IN ('active', 'on-hold')
  ORDER BY authored_on DESC;
END;
$$;

-- Check for drug-drug interactions (placeholder for future enhancement)
CREATE OR REPLACE FUNCTION public.check_drug_interactions(
  patient_id_param UUID,
  new_medication_code TEXT
)
RETURNS TABLE (
  has_interaction BOOLEAN,
  interaction_severity TEXT,
  interacting_medication TEXT,
  interaction_description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Placeholder: Real implementation would integrate with drug interaction API
  -- For now, return no interactions
  RETURN QUERY
  SELECT
    false as has_interaction,
    'none'::TEXT as interaction_severity,
    ''::TEXT as interacting_medication,
    ''::TEXT as interaction_description
  LIMIT 0;
END;
$$;

-- Check medication against allergies (integrates with allergy_intolerances table)
CREATE OR REPLACE FUNCTION public.check_medication_allergy_from_request(
  patient_id_param UUID,
  medication_display_param TEXT
)
RETURNS TABLE (
  has_allergy BOOLEAN,
  allergy_id UUID,
  allergen_name TEXT,
  criticality TEXT,
  severity TEXT,
  reaction_description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    true as has_allergy,
    ai.id,
    ai.allergen_name,
    ai.criticality,
    ai.severity,
    ai.reaction_description
  FROM public.allergy_intolerances ai
  WHERE ai.user_id = patient_id_param
    AND ai.clinical_status = 'active'
    AND ai.allergen_type = 'medication'
    AND (
      LOWER(ai.allergen_name) = LOWER(medication_display_param)
      OR LOWER(medication_display_param) LIKE '%' || LOWER(ai.allergen_name) || '%'
    );
END;
$$;

-- Get medication history for a patient
CREATE OR REPLACE FUNCTION public.get_medication_history(
  patient_id_param UUID,
  limit_param INTEGER DEFAULT 50
)
RETURNS SETOF public.fhir_medication_requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_medication_requests
  WHERE patient_id = patient_id_param
  ORDER BY authored_on DESC
  LIMIT limit_param;
END;
$$;

COMMIT;

-- migrate:down
BEGIN;

DROP FUNCTION IF EXISTS public.get_medication_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.check_medication_allergy_from_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.check_drug_interactions(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_active_medication_requests(UUID);
DROP FUNCTION IF EXISTS public.update_fhir_med_request_updated_at();
DROP TABLE IF EXISTS public.fhir_medication_requests CASCADE;

COMMIT;
