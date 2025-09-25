-- Complete PHI Encryption Setup - For EXISTING Tables (check_ins_audit + risk_assessments)
-- Run this for your specific table setup: check_ins_audit exists, risk_assessments exists

BEGIN;

-- Step 1: Add encrypted columns to existing check_ins_audit table
ALTER TABLE public.check_ins_audit
ADD COLUMN IF NOT EXISTS emotional_state_encrypted text,
ADD COLUMN IF NOT EXISTS heart_rate_encrypted text,
ADD COLUMN IF NOT EXISTS pulse_oximeter_encrypted text,
ADD COLUMN IF NOT EXISTS bp_systolic_encrypted text,
ADD COLUMN IF NOT EXISTS bp_diastolic_encrypted text,
ADD COLUMN IF NOT EXISTS glucose_mg_dl_encrypted text;

-- Step 2: Add encrypted columns to existing risk_assessments table
ALTER TABLE public.risk_assessments
ADD COLUMN IF NOT EXISTS assessment_notes_encrypted text,
ADD COLUMN IF NOT EXISTS risk_factors_encrypted text,
ADD COLUMN IF NOT EXISTS recommended_actions_encrypted text;

-- Step 3: Create encryption functions (if not already present)
CREATE OR REPLACE FUNCTION encrypt_phi_text(data text, encryption_key text default null)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  key_to_use text;
BEGIN
  -- Use provided key or fall back to environment variable
  key_to_use := coalesce(encryption_key, current_setting('app.phi_encryption_key', true));

  -- Return null for null input
  IF data IS NULL THEN
    RETURN null;
  END IF;

  -- Encrypt the data using AES
  RETURN encode(encrypt(data::bytea, key_to_use::bytea, 'aes'), 'base64');
EXCEPTION
  WHEN others THEN
    -- Log the error and return null to prevent data exposure
    RAISE warning 'PHI encryption failed: %', sqlerrm;
    RETURN null;
END$$;

CREATE OR REPLACE FUNCTION decrypt_phi_text(encrypted_data text, encryption_key text default null)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  key_to_use text;
BEGIN
  -- Use provided key or fall back to environment variable
  key_to_use := coalesce(encryption_key, current_setting('app.phi_encryption_key', true));

  -- Return null for null input
  IF encrypted_data IS NULL THEN
    RETURN null;
  END IF;

  -- Decrypt the data
  RETURN convert_from(decrypt(decode(encrypted_data, 'base64'), key_to_use::bytea, 'aes'), 'utf8');
EXCEPTION
  WHEN others THEN
    -- Log the error and return null to prevent application crashes
    RAISE warning 'PHI decryption failed: %', sqlerrm;
    RETURN null;
END$$;

CREATE OR REPLACE FUNCTION encrypt_phi_integer(data integer, encryption_key text default null)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF data IS NULL THEN
    RETURN null;
  END IF;

  RETURN encrypt_phi_text(data::text, encryption_key);
END$$;

CREATE OR REPLACE FUNCTION decrypt_phi_integer(encrypted_data text, encryption_key text default null)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  decrypted_text text;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN null;
  END IF;

  decrypted_text := decrypt_phi_text(encrypted_data, encryption_key);

  IF decrypted_text IS NULL THEN
    RETURN null;
  END IF;

  RETURN decrypted_text::integer;
EXCEPTION
  WHEN others THEN
    RAISE warning 'PHI integer decryption failed: %', sqlerrm;
    RETURN null;
END$$;

-- Step 4: Create triggers to automatically encrypt data for check_ins_audit
CREATE OR REPLACE FUNCTION encrypt_check_ins_audit_phi()
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

-- Step 5: Create triggers to automatically encrypt data for risk_assessments
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

-- Step 6: Create the encryption triggers
DROP TRIGGER IF EXISTS encrypt_check_ins_audit_phi_trigger ON public.check_ins_audit;
CREATE TRIGGER encrypt_check_ins_audit_phi_trigger
  BEFORE INSERT OR UPDATE ON public.check_ins_audit
  FOR EACH ROW EXECUTE FUNCTION encrypt_check_ins_audit_phi();

DROP TRIGGER IF EXISTS encrypt_risk_assessments_phi_trigger ON public.risk_assessments;
CREATE TRIGGER encrypt_risk_assessments_phi_trigger
  BEFORE INSERT OR UPDATE ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION encrypt_risk_assessments_phi();

-- Step 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_check_ins_audit_user_id ON public.check_ins_audit (user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_audit_timestamp ON public.check_ins_audit (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_audit_created_at ON public.check_ins_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_audit_emergency ON public.check_ins_audit (is_emergency) WHERE is_emergency = true;

CREATE INDEX IF NOT EXISTS idx_risk_assessments_patient_id ON public.risk_assessments (patient_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_assessor_id ON public.risk_assessments (assessor_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_created_at ON public.risk_assessments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_risk_level ON public.risk_assessments (risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_valid_until ON public.risk_assessments (valid_until);

-- Step 8: Enable RLS (if not already enabled)
ALTER TABLE public.check_ins_audit ENABLE row level security;
ALTER TABLE public.risk_assessments ENABLE row level security;

-- Step 9: Create RLS policies for check_ins_audit
DROP POLICY IF EXISTS "check_ins_audit_select_own" ON public.check_ins_audit;
CREATE POLICY "check_ins_audit_select_own"
ON public.check_ins_audit
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "check_ins_audit_insert_own" ON public.check_ins_audit;
CREATE POLICY "check_ins_audit_insert_own"
ON public.check_ins_audit
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admin can see all check-ins
DROP POLICY IF EXISTS "check_ins_audit_admin_all" ON public.check_ins_audit;
CREATE POLICY "check_ins_audit_admin_all"
ON public.check_ins_audit
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role_code IN (1, 2, 3) -- admin, super_admin, staff
  )
);

-- Step 10: Create RLS policies for risk_assessments (if not exist)
DROP POLICY IF EXISTS "risk_assessments_select_own" ON public.risk_assessments;
CREATE POLICY "risk_assessments_select_own"
ON public.risk_assessments
FOR SELECT
USING (auth.uid() = patient_id);

-- Healthcare staff can view all assessments
DROP POLICY IF EXISTS "risk_assessments_healthcare_select_all" ON public.risk_assessments;
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
DROP POLICY IF EXISTS "risk_assessments_healthcare_insert" ON public.risk_assessments;
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
DROP POLICY IF EXISTS "risk_assessments_healthcare_update_own" ON public.risk_assessments;
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

-- Step 11: Create decrypted views
CREATE OR REPLACE VIEW check_ins_audit_decrypted AS
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
FROM public.check_ins_audit;

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

-- Step 12: Set permissions
ALTER VIEW check_ins_audit_decrypted OWNER TO postgres;
ALTER VIEW risk_assessments_decrypted OWNER TO postgres;

GRANT SELECT ON check_ins_audit_decrypted TO authenticated;
GRANT SELECT ON risk_assessments_decrypted TO authenticated;

-- Step 13: Add comments
COMMENT ON TABLE public.check_ins_audit IS 'Health check-ins audit table with encrypted PHI data';
COMMENT ON TABLE public.risk_assessments IS 'Healthcare risk assessments with encrypted PHI data';
COMMENT ON VIEW check_ins_audit_decrypted IS 'Decrypted view of check_ins_audit table for authorized access';
COMMENT ON VIEW risk_assessments_decrypted IS 'Decrypted view of risk_assessments table for authorized access';

COMMIT;

-- Success message
SELECT 'PHI Encryption setup complete for check_ins_audit and risk_assessments tables! 🔐✅' as status;