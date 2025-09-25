-- Complete PHI Encryption Setup - For EXISTING Tables
-- Run this AFTER the basic encryption functions are installed
-- This assumes check_ins and risk_assessments tables already exist

BEGIN;

-- Step 1: Add encrypted columns to existing tables
ALTER TABLE public.check_ins
ADD COLUMN IF NOT EXISTS emotional_state_encrypted text,
ADD COLUMN IF NOT EXISTS heart_rate_encrypted text,
ADD COLUMN IF NOT EXISTS pulse_oximeter_encrypted text,
ADD COLUMN IF NOT EXISTS bp_systolic_encrypted text,
ADD COLUMN IF NOT EXISTS bp_diastolic_encrypted text,
ADD COLUMN IF NOT EXISTS glucose_mg_dl_encrypted text;

ALTER TABLE public.risk_assessments
ADD COLUMN IF NOT EXISTS assessment_notes_encrypted text,
ADD COLUMN IF NOT EXISTS risk_factors_encrypted text,
ADD COLUMN IF NOT EXISTS recommended_actions_encrypted text;

-- Step 2: Create triggers to automatically encrypt data on insert/update for check_ins
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

-- Step 3: Create triggers to automatically encrypt data for risk_assessments
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

-- Step 4: Create the encryption triggers
DROP TRIGGER IF EXISTS encrypt_check_ins_phi_trigger ON public.check_ins;
CREATE TRIGGER encrypt_check_ins_phi_trigger
  BEFORE INSERT OR UPDATE ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION encrypt_check_ins_phi();

DROP TRIGGER IF EXISTS encrypt_risk_assessments_phi_trigger ON public.risk_assessments;
CREATE TRIGGER encrypt_risk_assessments_phi_trigger
  BEFORE INSERT OR UPDATE ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION encrypt_risk_assessments_phi();

-- Step 5: Create views that automatically decrypt data for authorized users
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

-- Step 6: Set up permissions for the decrypted views
ALTER VIEW check_ins_decrypted OWNER TO postgres;
ALTER VIEW risk_assessments_decrypted OWNER TO postgres;

-- Grant appropriate permissions
GRANT SELECT ON check_ins_decrypted TO authenticated;
GRANT SELECT ON risk_assessments_decrypted TO authenticated;

-- Step 7: Add comments
COMMENT ON VIEW check_ins_decrypted IS 'Decrypted view of check_ins table for authorized access';
COMMENT ON VIEW risk_assessments_decrypted IS 'Decrypted view of risk_assessments table for authorized access';

COMMIT;

-- Success message
SELECT 'PHI Encryption setup complete for existing tables! 🔐✅' as status;