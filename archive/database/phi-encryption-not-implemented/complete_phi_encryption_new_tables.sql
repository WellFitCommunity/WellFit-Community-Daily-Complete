-- Complete PHI Encryption Setup - For NEW Tables
-- Run this if check_ins and risk_assessments tables DON'T exist yet
-- This creates the tables WITH encryption columns from the start

BEGIN;

-- Step 1: Create check_ins table with encrypted columns
CREATE TABLE IF NOT EXISTS public.check_ins (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  label text NOT NULL,
  is_emergency boolean DEFAULT false NOT NULL,

  -- Original columns (will be cleared by trigger after encryption)
  emotional_state text,
  heart_rate integer CHECK (heart_rate > 0 AND heart_rate < 300),
  pulse_oximeter integer CHECK (pulse_oximeter >= 0 AND pulse_oximeter <= 100),
  bp_systolic integer CHECK (bp_systolic > 0 AND bp_systolic < 300),
  bp_diastolic integer CHECK (bp_diastolic > 0 AND bp_diastolic < 200),
  glucose_mg_dl integer CHECK (glucose_mg_dl > 0 AND glucose_mg_dl < 1000),

  -- Encrypted columns (where actual data is stored)
  emotional_state_encrypted text,
  heart_rate_encrypted text,
  pulse_oximeter_encrypted text,
  bp_systolic_encrypted text,
  bp_diastolic_encrypted text,
  glucose_mg_dl_encrypted text,

  created_at timestamptz DEFAULT now() NOT NULL
);

-- Step 2: Create risk_assessments table with encrypted columns
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assessor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Risk Assessment Data
  risk_level text NOT NULL CHECK (risk_level IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
  priority text NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),

  -- Assessment Categories
  medical_risk_score integer CHECK (medical_risk_score >= 1 AND medical_risk_score <= 10),
  mobility_risk_score integer CHECK (mobility_risk_score >= 1 AND mobility_risk_score <= 10),
  cognitive_risk_score integer CHECK (cognitive_risk_score >= 1 AND cognitive_risk_score <= 10),
  social_risk_score integer CHECK (social_risk_score >= 1 AND social_risk_score <= 10),

  -- Overall Assessment
  overall_score decimal(3,1) CHECK (overall_score >= 1.0 AND overall_score <= 10.0),

  -- Original columns (will be cleared by trigger after encryption)
  assessment_notes text,
  risk_factors text[], -- Array of identified risk factors
  recommended_actions text[], -- Array of recommended interventions

  -- Encrypted columns (where actual data is stored)
  assessment_notes_encrypted text,
  risk_factors_encrypted text,
  recommended_actions_encrypted text,

  -- Follow-up Information
  next_assessment_due date,
  review_frequency text CHECK (review_frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly')),

  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Assessment validity period
  valid_until timestamptz DEFAULT (now() + interval '30 days') NOT NULL
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_check_ins_user_id ON public.check_ins (user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_timestamp ON public.check_ins (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_created_at ON public.check_ins (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_emergency ON public.check_ins (is_emergency) WHERE is_emergency = true;

CREATE INDEX IF NOT EXISTS idx_risk_assessments_patient_id ON public.risk_assessments (patient_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_assessor_id ON public.risk_assessments (assessor_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_created_at ON public.risk_assessments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_risk_level ON public.risk_assessments (risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_valid_until ON public.risk_assessments (valid_until);

-- Step 4: Create encryption trigger functions (same as existing tables version)
CREATE OR REPLACE FUNCTION encrypt_check_ins_phi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Encrypt sensitive fields if they're being set
  IF NEW.emotional_state IS NOT NULL THEN
    NEW.emotional_state_encrypted := encrypt_phi_text(NEW.emotional_state);
    NEW.emotional_state := null; -- Clear plaintext
  END IF;

  IF NEW.heart_rate IS NOT NULL THEN
    NEW.heart_rate_encrypted := encrypt_phi_integer(NEW.heart_rate);
    NEW.heart_rate := null; -- Clear plaintext
  END IF;

  IF NEW.pulse_oximeter IS NOT NULL THEN
    NEW.pulse_oximeter_encrypted := encrypt_phi_integer(NEW.pulse_oximeter);
    NEW.pulse_oximeter := null; -- Clear plaintext
  END IF;

  IF NEW.bp_systolic IS NOT NULL THEN
    NEW.bp_systolic_encrypted := encrypt_phi_integer(NEW.bp_systolic);
    NEW.bp_systolic := null; -- Clear plaintext
  END IF;

  IF NEW.bp_diastolic IS NOT NULL THEN
    NEW.bp_diastolic_encrypted := encrypt_phi_integer(NEW.bp_diastolic);
    NEW.bp_diastolic := null; -- Clear plaintext
  END IF;

  IF NEW.glucose_mg_dl IS NOT NULL THEN
    NEW.glucose_mg_dl_encrypted := encrypt_phi_integer(NEW.glucose_mg_dl);
    NEW.glucose_mg_dl := null; -- Clear plaintext
  END IF;

  RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION encrypt_risk_assessments_phi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Encrypt sensitive fields if they're being set
  IF NEW.assessment_notes IS NOT NULL THEN
    NEW.assessment_notes_encrypted := encrypt_phi_text(NEW.assessment_notes);
    NEW.assessment_notes := null; -- Clear plaintext
  END IF;

  IF NEW.risk_factors IS NOT NULL THEN
    NEW.risk_factors_encrypted := encrypt_phi_text(array_to_string(NEW.risk_factors, '|'));
    NEW.risk_factors := null; -- Clear plaintext
  END IF;

  IF NEW.recommended_actions IS NOT NULL THEN
    NEW.recommended_actions_encrypted := encrypt_phi_text(array_to_string(NEW.recommended_actions, '|'));
    NEW.recommended_actions := null; -- Clear plaintext
  END IF;

  RETURN NEW;
END$$;

-- Step 5: Create the encryption triggers
CREATE TRIGGER encrypt_check_ins_phi_trigger
  BEFORE INSERT OR UPDATE ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION encrypt_check_ins_phi();

CREATE TRIGGER encrypt_risk_assessments_phi_trigger
  BEFORE INSERT OR UPDATE ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION encrypt_risk_assessments_phi();

-- Step 6: Create updated_at trigger for risk_assessments
CREATE OR REPLACE FUNCTION public.tg_risk_assessments_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

CREATE TRIGGER trg_risk_assessments_updated_at
  BEFORE UPDATE ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.tg_risk_assessments_updated_at();

-- Step 7: Enable RLS
ALTER TABLE public.check_ins ENABLE row level security;
ALTER TABLE public.risk_assessments ENABLE row level security;

-- Step 8: Create RLS policies for check_ins
CREATE POLICY "check_ins_select_own"
ON public.check_ins
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "check_ins_insert_own"
ON public.check_ins
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admin can see all check-ins
CREATE POLICY "check_ins_admin_all"
ON public.check_ins
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role_code IN (1, 2, 3) -- admin, super_admin, staff
  )
);

-- Step 9: Create RLS policies for risk_assessments
CREATE POLICY "risk_assessments_select_own"
ON public.risk_assessments
FOR SELECT
USING (auth.uid() = patient_id);

-- Healthcare staff can view all assessments
CREATE POLICY "risk_assessments_healthcare_select_all"
ON public.risk_assessments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role_code IN (1, 2, 3, 12) -- admin, super_admin, staff, nurse
  )
);

-- Healthcare staff can insert assessments
CREATE POLICY "risk_assessments_healthcare_insert"
ON public.risk_assessments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = assessor_id AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role_code IN (1, 2, 3, 12) -- admin, super_admin, staff, nurse
  )
);

-- Healthcare staff can update assessments they created
CREATE POLICY "risk_assessments_healthcare_update_own"
ON public.risk_assessments
FOR UPDATE
TO authenticated
USING (
  auth.uid() = assessor_id AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role_code IN (1, 2, 3, 12) -- admin, super_admin, staff, nurse
  )
);

-- Step 10: Create decrypted views (same as existing tables version)
CREATE OR REPLACE VIEW check_ins_decrypted AS
SELECT
  id,
  user_id,
  timestamp,
  label,
  is_emergency,
  decrypt_phi_text(emotional_state_encrypted) as emotional_state,
  decrypt_phi_integer(heart_rate_encrypted) as heart_rate,
  decrypt_phi_integer(pulse_oximeter_encrypted) as pulse_oximeter,
  decrypt_phi_integer(bp_systolic_encrypted) as bp_systolic,
  decrypt_phi_integer(bp_diastolic_encrypted) as bp_diastolic,
  decrypt_phi_integer(glucose_mg_dl_encrypted) as glucose_mg_dl,
  created_at
FROM public.check_ins;

CREATE OR REPLACE VIEW risk_assessments_decrypted AS
SELECT
  id,
  patient_id,
  assessor_id,
  risk_level,
  priority,
  medical_risk_score,
  mobility_risk_score,
  cognitive_risk_score,
  social_risk_score,
  overall_score,
  decrypt_phi_text(assessment_notes_encrypted) as assessment_notes,
  string_to_array(decrypt_phi_text(risk_factors_encrypted), '|') as risk_factors,
  string_to_array(decrypt_phi_text(recommended_actions_encrypted), '|') as recommended_actions,
  next_assessment_due,
  review_frequency,
  created_at,
  updated_at,
  valid_until
FROM public.risk_assessments;

-- Step 11: Set permissions
ALTER VIEW check_ins_decrypted OWNER TO postgres;
ALTER VIEW risk_assessments_decrypted OWNER TO postgres;

GRANT SELECT ON check_ins_decrypted TO authenticated;
GRANT SELECT ON risk_assessments_decrypted TO authenticated;

-- Step 12: Add comments
COMMENT ON TABLE public.check_ins IS 'Health check-ins with encrypted PHI data';
COMMENT ON TABLE public.risk_assessments IS 'Healthcare risk assessments with encrypted PHI data';
COMMENT ON VIEW check_ins_decrypted IS 'Decrypted view of check_ins table for authorized access';
COMMENT ON VIEW risk_assessments_decrypted IS 'Decrypted view of risk_assessments table for authorized access';

COMMIT;

-- Success message
SELECT 'PHI Encryption tables and setup complete! 🔐✅' as status;