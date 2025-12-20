-- Fix pgcrypto function calls to use extensions schema prefix
-- The pgcrypto extension is installed in the 'extensions' schema, not public
-- Functions calling pgp_sym_encrypt/decrypt need schema qualification

-- Recreate encrypt_pending_password with schema-qualified call
DROP FUNCTION IF EXISTS public.encrypt_pending_password(text);

CREATE FUNCTION public.encrypt_pending_password(plaintext_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key
  encryption_key := current_setting('app.settings.encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    encryption_key := 'wellfit-db-encryption-' || current_database();
  END IF;

  -- Encrypt password using schema-qualified function
  RETURN extensions.pgp_sym_encrypt(plaintext_password, encryption_key);
END;
$$;

-- Recreate decrypt_pending_password with schema-qualified call
DROP FUNCTION IF EXISTS public.decrypt_pending_password(bytea);

CREATE FUNCTION public.decrypt_pending_password(encrypted_password BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key
  encryption_key := current_setting('app.settings.encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    encryption_key := 'wellfit-db-encryption-' || current_database();
  END IF;

  -- Decrypt password using schema-qualified function
  RETURN extensions.pgp_sym_decrypt(encrypted_password, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Return NULL if decryption fails
    RETURN NULL;
END;
$$;
