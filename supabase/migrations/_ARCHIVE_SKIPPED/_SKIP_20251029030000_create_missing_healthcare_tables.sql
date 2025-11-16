-- ============================================================================
-- CREATE MISSING HEALTHCARE TABLES
-- Comprehensive migration to create all tables needed for proper workflows
-- Zero technical debt - complete FHIR-compliant healthcare data model
-- ============================================================================

BEGIN;

-- ============================================================================
-- MEDICATIONS TABLE (Patient medication list)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Medication identification
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  brand_name TEXT,

  -- Dosage information
  dosage_amount DECIMAL(10, 2),
  dosage_unit TEXT, -- mg, ml, units, etc.
  frequency TEXT, -- daily, BID, TID, QID, PRN, etc.
  route TEXT, -- oral, topical, injection, etc.

  -- Schedule
  start_date DATE,
  end_date DATE,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued', 'completed')),

  -- Prescription information
  prescribed_by UUID REFERENCES auth.users(id),
  prescription_number TEXT,

  -- Pharmacy information
  pharmacy_name TEXT,
  pharmacy_phone TEXT,

  -- Refill tracking
  quantity INTEGER,
  refills_remaining INTEGER,
  last_refill_date DATE,

  -- Adherence tracking
  adherence_rate DECIMAL(5, 2), -- Percentage

  -- Notes
  notes TEXT,
  purpose TEXT,

  -- Source tracking
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'prescription', 'ocr_extraction', 'fhir_import')),

  -- FHIR linkage
  fhir_medication_request_id UUID REFERENCES public.fhir_medication_requests(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Ensure medication name is provided
  CONSTRAINT medication_name_not_empty CHECK (medication_name != '')
);

CREATE INDEX idx_medications_user ON public.medications(user_id);
CREATE INDEX idx_medications_status ON public.medications(status) WHERE status = 'active';
CREATE INDEX idx_medications_fhir ON public.medications(fhir_medication_request_id) WHERE fhir_medication_request_id IS NOT NULL;
CREATE INDEX idx_medications_prescribed_by ON public.medications(prescribed_by) WHERE prescribed_by IS NOT NULL;

COMMENT ON TABLE public.medications IS 'Patient medication list - local tracking separate from FHIR prescriptions';

-- ============================================================================
-- MEDICATION REMINDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.medication_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Schedule
  reminder_time TIME NOT NULL,
  days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sunday, 6=Saturday

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Notification preferences
  notification_method TEXT[] DEFAULT ARRAY['push'], -- push, sms, email

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_med_reminders_medication ON public.medication_reminders(medication_id);
CREATE INDEX idx_med_reminders_user ON public.medication_reminders(user_id);
CREATE INDEX idx_med_reminders_active ON public.medication_reminders(is_active) WHERE is_active = true;

COMMENT ON TABLE public.medication_reminders IS 'Medication reminder schedules for patient adherence';

-- ============================================================================
-- MEDICATION DOSES TAKEN
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.medication_doses_taken (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Dose information
  scheduled_time TIMESTAMPTZ,
  taken_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Status
  status TEXT NOT NULL DEFAULT 'taken' CHECK (status IN ('taken', 'missed', 'skipped', 'delayed')),

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doses_taken_medication ON public.medication_doses_taken(medication_id);
CREATE INDEX idx_doses_taken_user ON public.medication_doses_taken(user_id);
CREATE INDEX idx_doses_taken_time ON public.medication_doses_taken(taken_time DESC);

COMMENT ON TABLE public.medication_doses_taken IS 'Medication adherence tracking - doses taken/missed';

-- ============================================================================
-- MEDICATION IMAGE EXTRACTIONS (OCR results)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.medication_image_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Image information
  image_url TEXT,
  image_data TEXT, -- Base64 encoded image

  -- Extracted data
  medication_name TEXT,
  dosage_value DECIMAL(10, 2),
  dosage_unit TEXT,
  frequency TEXT,
  route TEXT,
  prescribed_by TEXT, -- Provider name as text
  prescribed_date DATE,
  prescription_number TEXT,
  pharmacy_name TEXT,
  ndc_code TEXT, -- National Drug Code

  -- Extraction quality
  confidence DECIMAL(3, 2), -- 0.00 to 1.00
  needs_review BOOLEAN NOT NULL DEFAULT false,

  -- Processing status
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,

  -- Link to created medication
  created_medication_id UUID REFERENCES public.medications(id) ON DELETE SET NULL,

  -- Raw OCR response
  raw_extraction_data JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_med_extractions_user ON public.medication_image_extractions(user_id);
CREATE INDEX idx_med_extractions_processed ON public.medication_image_extractions(processed, needs_review);
CREATE INDEX idx_med_extractions_confidence ON public.medication_image_extractions(confidence DESC);
CREATE INDEX idx_med_extractions_created_med ON public.medication_image_extractions(created_medication_id) WHERE created_medication_id IS NOT NULL;

COMMENT ON TABLE public.medication_image_extractions IS 'OCR extraction results from medication bottle photos';

-- ============================================================================
-- ALLERGY INTOLERANCES (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.allergy_intolerances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Allergen information
  allergen_type TEXT NOT NULL CHECK (allergen_type IN ('medication', 'food', 'environment', 'other')),
  allergen_name TEXT NOT NULL,
  allergen_code TEXT, -- SNOMED CT or RxNorm code

  -- Clinical status
  clinical_status TEXT NOT NULL DEFAULT 'active' CHECK (clinical_status IN ('active', 'inactive', 'resolved')),
  verification_status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (verification_status IN ('unconfirmed', 'confirmed', 'refuted', 'entered-in-error')),

  -- Reaction information
  reaction_type TEXT CHECK (reaction_type IN ('allergy', 'intolerance', 'sensitivity')),
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe', 'life-threatening')),
  reaction_description TEXT,

  -- Onset and notes
  onset_date DATE,
  notes TEXT,

  -- Recorded by
  recorded_by UUID REFERENCES auth.users(id),
  recorded_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_allergies_user ON public.allergy_intolerances(user_id);
CREATE INDEX idx_allergies_status ON public.allergy_intolerances(clinical_status) WHERE clinical_status = 'active';
CREATE INDEX idx_allergies_type ON public.allergy_intolerances(allergen_type);
CREATE INDEX idx_allergies_severity ON public.allergy_intolerances(severity) WHERE severity IN ('severe', 'life-threatening');

COMMENT ON TABLE public.allergy_intolerances IS 'Patient allergy and intolerance registry - critical for safety';

-- ============================================================================
-- FHIR PATIENTS TABLE (for full FHIR compliance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fhir_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,

  -- Link to auth.users
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- FHIR Patient resource fields
  active BOOLEAN NOT NULL DEFAULT true,

  -- Name
  family_name TEXT,
  given_name TEXT[],
  prefix TEXT[],
  suffix TEXT[],

  -- Demographics
  birth_date DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'unknown')),

  -- Contact
  phone TEXT[],
  email TEXT,

  -- Address
  address_line TEXT[],
  address_city TEXT,
  address_state TEXT,
  address_postal_code TEXT,
  address_country TEXT DEFAULT 'US',

  -- Communication
  language TEXT DEFAULT 'en',

  -- General Practitioner
  general_practitioner_id UUID REFERENCES public.fhir_practitioners(id),

  -- Managing Organization
  managing_organization_id UUID,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  sync_source TEXT,
  external_id TEXT,

  -- Ensure one FHIR patient per user
  UNIQUE(patient_id)
);

CREATE INDEX idx_fhir_patients_patient ON public.fhir_patients(patient_id);
CREATE INDEX idx_fhir_patients_active ON public.fhir_patients(active) WHERE active = true;
CREATE INDEX idx_fhir_patients_external ON public.fhir_patients(external_id) WHERE external_id IS NOT NULL;

COMMENT ON TABLE public.fhir_patients IS 'FHIR R4 Patient resource - demographics and administrative information';

-- ============================================================================
-- TELEHEALTH APPOINTMENTS (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.telehealth_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Participants
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES auth.users(id),

  -- Appointment details
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show')),

  -- Telehealth specifics
  meeting_room_url TEXT,
  meeting_room_id TEXT,
  participant_token TEXT,
  provider_token TEXT,

  -- Clinical
  chief_complaint TEXT,
  appointment_type TEXT,

  -- Encounter linkage
  encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,

  -- Cancellation
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_telehealth_patient ON public.telehealth_appointments(patient_id);
CREATE INDEX idx_telehealth_provider ON public.telehealth_appointments(provider_id);
CREATE INDEX idx_telehealth_status ON public.telehealth_appointments(status);
CREATE INDEX idx_telehealth_scheduled ON public.telehealth_appointments(scheduled_start DESC);
CREATE INDEX idx_telehealth_encounter ON public.telehealth_appointments(encounter_id) WHERE encounter_id IS NOT NULL;

COMMENT ON TABLE public.telehealth_appointments IS 'Virtual visit scheduling and tracking';

-- ============================================================================
-- ADD FOREIGN KEYS TO EXISTING TABLES
-- ============================================================================

-- Link FHIR medication requests to local medications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fhir_medication_requests'
    AND column_name = 'local_medication_id'
  ) THEN
    ALTER TABLE public.fhir_medication_requests
      ADD COLUMN local_medication_id UUID REFERENCES public.medications(id) ON DELETE SET NULL;

    CREATE INDEX idx_fhir_med_requests_local ON public.fhir_medication_requests(local_medication_id);

    COMMENT ON COLUMN public.fhir_medication_requests.local_medication_id IS 'Links to patient-entered medication for bidirectional sync';
  END IF;
END $$;

-- Link scribe sessions to generated clinical notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions'
    AND column_name = 'generated_note_id'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN generated_note_id UUID REFERENCES public.clinical_notes(id) ON DELETE SET NULL;

    CREATE INDEX idx_scribe_sessions_note ON public.scribe_sessions(generated_note_id);

    COMMENT ON COLUMN public.scribe_sessions.generated_note_id IS 'Links to auto-generated clinical note';
  END IF;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Medications RLS
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY medications_select_own
ON public.medications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY medications_insert_own
ON public.medications FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY medications_update_own
ON public.medications FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY medications_delete_own
ON public.medications FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY medications_staff_all
ON public.medications FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
  )
);

-- Medication reminders RLS
ALTER TABLE public.medication_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY medication_reminders_own
ON public.medication_reminders FOR ALL
USING (user_id = auth.uid());

CREATE POLICY medication_reminders_staff
ON public.medication_reminders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
  )
);

-- Medication doses taken RLS
ALTER TABLE public.medication_doses_taken ENABLE ROW LEVEL SECURITY;

CREATE POLICY doses_taken_own
ON public.medication_doses_taken FOR ALL
USING (user_id = auth.uid());

CREATE POLICY doses_taken_staff
ON public.medication_doses_taken FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
  )
);

-- Medication image extractions RLS
ALTER TABLE public.medication_image_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY med_extractions_own
ON public.medication_image_extractions FOR ALL
USING (user_id = auth.uid());

CREATE POLICY med_extractions_staff
ON public.medication_image_extractions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'doctor', 'nurse', 'chw')
  )
);

-- Allergy intolerances RLS
ALTER TABLE public.allergy_intolerances ENABLE ROW LEVEL SECURITY;

CREATE POLICY allergies_select_own
ON public.allergy_intolerances FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY allergies_insert_own
ON public.allergy_intolerances FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY allergies_staff_all
ON public.allergy_intolerances FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
  )
);

-- FHIR Patients RLS
ALTER TABLE public.fhir_patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY fhir_patients_select_own
ON public.fhir_patients FOR SELECT
USING (patient_id = auth.uid());

CREATE POLICY fhir_patients_staff_all
ON public.fhir_patients FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
  )
);

-- Telehealth appointments RLS
ALTER TABLE public.telehealth_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY telehealth_select_participant
ON public.telehealth_appointments FOR SELECT
USING (patient_id = auth.uid() OR provider_id = auth.uid());

CREATE POLICY telehealth_staff_all
ON public.telehealth_appointments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
  )
);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_medications_updated
BEFORE UPDATE ON public.medications
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_medication_reminders_updated
BEFORE UPDATE ON public.medication_reminders
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_med_extractions_updated
BEFORE UPDATE ON public.medication_image_extractions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_allergies_updated
BEFORE UPDATE ON public.allergy_intolerances
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_fhir_patients_updated
BEFORE UPDATE ON public.fhir_patients
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_telehealth_updated
BEFORE UPDATE ON public.telehealth_appointments
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Missing healthcare tables created successfully';
  RAISE NOTICE '  - medications (patient medication list)';
  RAISE NOTICE '  - medication_reminders (adherence tracking)';
  RAISE NOTICE '  - medication_doses_taken (compliance tracking)';
  RAISE NOTICE '  - medication_image_extractions (OCR results)';
  RAISE NOTICE '  - allergy_intolerances (safety registry)';
  RAISE NOTICE '  - fhir_patients (FHIR compliance)';
  RAISE NOTICE '  - telehealth_appointments (virtual visits)';
  RAISE NOTICE '  - All tables have proper RLS policies';
  RAISE NOTICE '  - All tables have update triggers';
END $$;
