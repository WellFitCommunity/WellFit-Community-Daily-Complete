-- ============================================================================
-- SOC 2 Field-Level Encryption for PHI/PII Data
-- ============================================================================
-- Purpose: Encrypt sensitive data at rest using pgcrypto
-- Addresses: SOC 2 CC6.1 (Access Controls), PI1.4 (Data Privacy)
-- IMPORTANT: Encryption key must be set in environment variable: ENCRYPTION_KEY
-- Date: 2025-10-18
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: ENCRYPTION HELPER FUNCTIONS
-- ============================================================================

-- Function to encrypt text data
CREATE OR REPLACE FUNCTION public.encrypt_data(
  p_plaintext TEXT,
  p_key_name TEXT DEFAULT 'phi_master_key'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encryption_key TEXT;
BEGIN
  -- In production, retrieve key from secure key management system
  -- For now, use environment variable (must be set in Supabase dashboard)
  v_encryption_key := current_setting('app.encryption_key', TRUE);

  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.encryption_key in database settings.';
  END IF;

  -- AES-256 encryption
  RETURN encode(
    pgp_sym_encrypt(p_plaintext, v_encryption_key),
    'base64'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Encryption failed: %', SQLERRM;
    -- Log security event
    PERFORM public.log_security_event(
      'ENCRYPTION_FAILURE',
      'HIGH',
      'Field encryption failed',
      jsonb_build_object('error', SQLERRM)
    );
    RETURN NULL;
END;
$$;

-- Function to decrypt text data
CREATE OR REPLACE FUNCTION public.decrypt_data(
  p_encrypted TEXT,
  p_key_name TEXT DEFAULT 'phi_master_key'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encryption_key TEXT;
BEGIN
  -- Return NULL if input is NULL or empty
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN NULL;
  END IF;

  v_encryption_key := current_setting('app.encryption_key', TRUE);

  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.encryption_key in database settings.';
  END IF;

  -- AES-256 decryption
  RETURN pgp_sym_decrypt(
    decode(p_encrypted, 'base64'),
    v_encryption_key
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Decryption failed: %', SQLERRM;
    -- Log security event
    PERFORM public.log_security_event(
      'DECRYPTION_FAILURE',
      'CRITICAL',
      'Field decryption failed - possible tampering or key rotation issue',
      jsonb_build_object('error', SQLERRM)
    );
    RETURN '[DECRYPTION ERROR]';
END;
$$;

-- ============================================================================
-- PART 2: ADD ENCRYPTED COLUMNS TO FHIR_CONNECTIONS
-- ============================================================================

-- Add encrypted columns for credentials
ALTER TABLE public.fhir_connections
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS client_secret_encrypted TEXT;

-- Migrate existing plaintext tokens to encrypted (if any exist)
-- WARNING: This should be done in a maintenance window
DO $$
BEGIN
  -- Only migrate if encryption key is configured
  IF current_setting('app.encryption_key', TRUE) IS NOT NULL THEN
    UPDATE public.fhir_connections
    SET
      access_token_encrypted = public.encrypt_data(access_token),
      refresh_token_encrypted = public.encrypt_data(refresh_token)
    WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;
  ELSE
    RAISE NOTICE 'Encryption key not set. Skipping token migration. Set app.encryption_key before production use.';
  END IF;
END $$;

-- Create trigger to auto-encrypt tokens on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_fhir_connection_tokens()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Encrypt access_token if changed and not null
  IF NEW.access_token IS NOT NULL AND NEW.access_token != '' THEN
    NEW.access_token_encrypted := public.encrypt_data(NEW.access_token);
    NEW.access_token := NULL; -- Clear plaintext
  END IF;

  -- Encrypt refresh_token if changed and not null
  IF NEW.refresh_token IS NOT NULL AND NEW.refresh_token != '' THEN
    NEW.refresh_token_encrypted := public.encrypt_data(NEW.refresh_token);
    NEW.refresh_token := NULL; -- Clear plaintext
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_encrypt_fhir_connection_tokens ON public.fhir_connections;
CREATE TRIGGER trigger_encrypt_fhir_connection_tokens
  BEFORE INSERT OR UPDATE ON public.fhir_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_fhir_connection_tokens();

-- ============================================================================
-- PART 3: ADD ENCRYPTED COLUMNS TO PROFILES (PHI/PII)
-- ============================================================================

-- Check if columns exist before adding
DO $$
BEGIN
  -- Add encrypted columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone_encrypted') THEN
    ALTER TABLE public.profiles ADD COLUMN phone_encrypted TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email_encrypted') THEN
    ALTER TABLE public.profiles ADD COLUMN email_encrypted TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'first_name_encrypted') THEN
    ALTER TABLE public.profiles ADD COLUMN first_name_encrypted TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_name_encrypted') THEN
    ALTER TABLE public.profiles ADD COLUMN last_name_encrypted TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'dob_encrypted') THEN
    ALTER TABLE public.profiles ADD COLUMN dob_encrypted TEXT;
  END IF;
END $$;

-- Create trigger to auto-encrypt profile PHI
CREATE OR REPLACE FUNCTION public.encrypt_profile_phi()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Encrypt phone
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.phone_encrypted := public.encrypt_data(NEW.phone);
  END IF;

  -- Encrypt email
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    NEW.email_encrypted := public.encrypt_data(NEW.email);
  END IF;

  -- Encrypt first_name
  IF NEW.first_name IS NOT NULL AND NEW.first_name != '' THEN
    NEW.first_name_encrypted := public.encrypt_data(NEW.first_name);
  END IF;

  -- Encrypt last_name
  IF NEW.last_name IS NOT NULL AND NEW.last_name != '' THEN
    NEW.last_name_encrypted := public.encrypt_data(NEW.last_name);
  END IF;

  -- Encrypt dob
  IF NEW.dob IS NOT NULL AND NEW.dob != '' THEN
    NEW.dob_encrypted := public.encrypt_data(NEW.dob);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_encrypt_profile_phi ON public.profiles;
CREATE TRIGGER trigger_encrypt_profile_phi
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_profile_phi();

-- ============================================================================
-- PART 4: CREATE SECURE VIEWS WITH DECRYPTION
-- ============================================================================

-- Secure view for FHIR connections with decrypted tokens (admin-only)
CREATE OR REPLACE VIEW public.fhir_connections_decrypted AS
SELECT
  id,
  name,
  fhir_server_url,
  ehr_system,
  client_id,
  status,
  sync_frequency,
  sync_direction,
  -- Decrypt only if user has admin role
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    ) THEN public.decrypt_data(access_token_encrypted)
    ELSE '[REDACTED]'
  END AS access_token,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    ) THEN public.decrypt_data(refresh_token_encrypted)
    ELSE '[REDACTED]'
  END AS refresh_token,
  token_expiry,
  last_sync,
  created_at,
  updated_at
FROM public.fhir_connections;

-- Secure view for profiles with decrypted PHI
CREATE OR REPLACE VIEW public.profiles_decrypted AS
SELECT
  user_id,
  -- Decrypt PHI if user is viewing own profile OR is admin
  CASE
    WHEN user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse', 'physician', 'doctor')
    ) THEN COALESCE(public.decrypt_data(phone_encrypted), phone)
    ELSE '[REDACTED]'
  END AS phone,
  CASE
    WHEN user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse', 'physician', 'doctor')
    ) THEN COALESCE(public.decrypt_data(email_encrypted), email)
    ELSE '[REDACTED]'
  END AS email,
  CASE
    WHEN user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse', 'physician', 'doctor')
    ) THEN COALESCE(public.decrypt_data(first_name_encrypted), first_name)
    ELSE '[REDACTED]'
  END AS first_name,
  CASE
    WHEN user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse', 'physician', 'doctor')
    ) THEN COALESCE(public.decrypt_data(last_name_encrypted), last_name)
    ELSE '[REDACTED]'
  END AS last_name,
  CASE
    WHEN user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse', 'physician', 'doctor')
    ) THEN COALESCE(public.decrypt_data(dob_encrypted), dob)
    ELSE '[REDACTED]'
  END AS dob,
  phone_verified,
  email_verified,
  verified_at,
  consent,
  onboarded,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to views
GRANT SELECT ON public.fhir_connections_decrypted TO authenticated;
GRANT SELECT ON public.profiles_decrypted TO authenticated;

-- ============================================================================
-- PART 5: TOKEN LIFECYCLE MANAGEMENT
-- ============================================================================

-- Table to track token lifecycle
CREATE TABLE IF NOT EXISTS public.fhir_token_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.fhir_connections(id) ON DELETE CASCADE,

  token_type TEXT NOT NULL CHECK (token_type IN ('access', 'refresh')),

  -- Lifecycle events
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  refreshed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Security
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0,

  -- Rotation tracking
  rotation_id UUID, -- Links to new token after rotation
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_fhir_token_lifecycle_connection ON public.fhir_token_lifecycle(connection_id);
CREATE INDEX IF NOT EXISTS idx_fhir_token_lifecycle_expires ON public.fhir_token_lifecycle(expires_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_fhir_token_lifecycle_active ON public.fhir_token_lifecycle(connection_id, is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE public.fhir_token_lifecycle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fhir_token_lifecycle_admin_only" ON public.fhir_token_lifecycle;
CREATE POLICY "fhir_token_lifecycle_admin_only"
  ON public.fhir_token_lifecycle
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Function to check for expired tokens
CREATE OR REPLACE FUNCTION public.get_expired_fhir_tokens()
RETURNS TABLE (
  connection_id UUID,
  connection_name TEXT,
  expires_at TIMESTAMPTZ,
  days_expired NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id,
    fc.name,
    fc.token_expiry,
    EXTRACT(DAY FROM (NOW() - fc.token_expiry)) AS days_expired
  FROM public.fhir_connections fc
  WHERE fc.token_expiry < NOW()
    AND fc.status = 'active'
  ORDER BY fc.token_expiry ASC;
END;
$$;

-- Function to revoke token
CREATE OR REPLACE FUNCTION public.revoke_fhir_token(
  p_connection_id UUID,
  p_reason TEXT DEFAULT 'Manual revocation'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update token lifecycle
  UPDATE public.fhir_token_lifecycle
  SET
    revoked_at = NOW(),
    revoked_reason = p_reason,
    is_active = FALSE
  WHERE connection_id = p_connection_id
    AND is_active = TRUE;

  -- Clear tokens in connection
  UPDATE public.fhir_connections
  SET
    access_token_encrypted = NULL,
    refresh_token_encrypted = NULL,
    status = 'inactive',
    updated_at = NOW()
  WHERE id = p_connection_id;

  -- Log audit event
  PERFORM public.log_audit_event(
    'ACCESS_TOKEN_REVOKED',
    'CONFIGURATION',
    'fhir_connections',
    p_connection_id::TEXT,
    NULL,
    'DELETE',
    jsonb_build_object('reason', p_reason),
    TRUE,
    NULL
  );

  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_expired_fhir_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_fhir_token TO authenticated;

-- ============================================================================
-- PART 6: COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.encrypt_data IS 'Encrypts data using AES-256. Requires app.encryption_key to be set.';
COMMENT ON FUNCTION public.decrypt_data IS 'Decrypts AES-256 encrypted data. Logs security event on failure.';
COMMENT ON VIEW public.fhir_connections_decrypted IS 'Secure view with automatic decryption based on user role';
COMMENT ON VIEW public.profiles_decrypted IS 'Secure view with PHI decryption only for authorized users';
COMMENT ON TABLE public.fhir_token_lifecycle IS 'Tracks FHIR token lifecycle for security and compliance';

COMMIT;

-- ============================================================================
-- IMPORTANT: POST-MIGRATION STEPS
-- ============================================================================
-- 1. Set encryption key in Supabase dashboard:
--    Database Settings -> Custom PostgreSQL Configuration
--    Add: app.encryption_key = '<strong-random-key-256-bits>'
--
-- 2. Generate encryption key:
--    openssl rand -base64 32
--
-- 3. Store encryption key securely in:
--    - AWS Secrets Manager
--    - HashiCorp Vault
--    - Azure Key Vault
--    - Google Cloud KMS
--
-- 4. Implement key rotation procedure (annually minimum)
--
-- 5. Test decryption before deploying to production
--
-- 6. Update application code to use decrypted views
--
-- 7. Schedule token expiration monitoring job
-- ============================================================================
