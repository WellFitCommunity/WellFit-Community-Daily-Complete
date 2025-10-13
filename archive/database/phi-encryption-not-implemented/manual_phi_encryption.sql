-- PHI Encryption Functions Only (Safe to run)
-- Run this in Supabase Dashboard SQL Editor

BEGIN;

-- Enable the pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to encrypt sensitive text fields
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

-- Create a function to decrypt sensitive text fields
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

-- Create a function to encrypt integer fields (for vital signs)
CREATE OR REPLACE FUNCTION encrypt_phi_integer(data integer, encryption_key text default null)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF data IS NULL THEN
    RETURN null;
  END IF;

  RETURN encrypt_phi_text(data::text, encryption_key);
END$$;

-- Create a function to decrypt integer fields
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

-- Add comments for documentation
COMMENT ON FUNCTION encrypt_phi_text IS 'Encrypts sensitive text data using AES encryption';
COMMENT ON FUNCTION decrypt_phi_text IS 'Decrypts sensitive text data using AES encryption';
COMMENT ON FUNCTION encrypt_phi_integer IS 'Encrypts sensitive integer data using AES encryption';
COMMENT ON FUNCTION decrypt_phi_integer IS 'Decrypts sensitive integer data using AES encryption';

COMMIT;