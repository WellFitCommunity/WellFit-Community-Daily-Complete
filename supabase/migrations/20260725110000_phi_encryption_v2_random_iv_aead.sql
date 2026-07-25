-- ============================================================================
-- PHI encryption v2 — replace deterministic raw AES with PGP (random session
-- key + salted-iterated KDF + integrity protection)
--
-- External audit finding 3 (Claude Cowork, 2026-07-25): encrypt_phi_text and
-- both *_with_key variants used pgcrypto raw `encrypt(data, digest(key,
-- 'sha256'), 'aes')` — AES-CBC with a ZERO IV and a bare-hash KDF:
--   * DETERMINISTIC: identical plaintext → identical ciphertext. Same DOBs /
--     names are identifiable and frequency-analysable without decryption.
--   * UNAUTHENTICATED: ciphertext can be modified without detection.
--   * WEAK KDF: bare SHA-256 of the key.
--
-- v2 primitive: pgp_sym_encrypt with cipher-algo=aes256 and S2K mode 3
-- (salted + iterated, max count). PGP generates a RANDOM session key per
-- encryption (non-deterministic ciphertext), derives keys through a real
-- S2K KDF, and embeds an MDC integrity check (tampering fails decryption).
-- This is the pragmatic in-database step the audit recommends; a KMS-backed
-- envelope scheme remains the long-term answer.
--
-- FORMAT VERSIONING: v2 ciphertext is stored as  'v2:' || base64(pgp).
-- The base64 alphabet contains no ':' so the prefix is unambiguous. decrypt
-- functions accept BOTH formats — unprefixed values take the legacy raw-AES
-- path, so pre-existing rows stay readable during/after migration.
--
-- KEY SELECTION, GRANTS, ERROR CONTRACTS UNCHANGED: same
-- (data, use_clinical_key) signatures, same Vault/GUC resolution (§17), same
-- fail-closed '[PHI_ENCRYPTION_FAILED]'/'[PHI_DECRYPTION_FAILED]' raises.
-- CREATE OR REPLACE preserves existing ACLs (the *_with_key pair stays
-- service_role-only).
--
-- RE-ENCRYPTION PASS (bottom): live counts on 2026-07-25 showed 14 legacy
-- ciphertext rows total (10 profiles.dob_encrypted + 4
-- senior_demographics.date_of_birth_encrypted), every one with a plaintext
-- twin — those re-encrypt FROM PLAINTEXT. The ciphertext-only columns
-- (risk_assessments, handoff_packets) held 0 rows; decrypt→re-encrypt
-- statements are included so the pass is complete regardless.
-- Retained plaintext twins are NOT dropped here — that is a separate,
-- irreversible decision (inventory in docs/compliance/PHI_ENCRYPTION_KEY_ROTATION.md).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- encrypt_phi_text (two-key selector — §17)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encrypt_phi_text(data TEXT, use_clinical_key BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Return null for null input (intentional - null in, null out)
  IF data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get encryption key from appropriate source
  IF use_clinical_key THEN
    -- Envision Atlus (Clinical): Read from Vault
    SELECT decrypted_secret INTO encryption_key
    FROM vault.decrypted_secrets
    WHERE name = 'app_encryption_key'
    LIMIT 1;

    IF encryption_key IS NULL OR encryption_key = '' THEN
      RAISE EXCEPTION '[PHI_ENCRYPTION_FAILED] Clinical encryption key not found in Vault. Check app_encryption_key';
    END IF;
  ELSE
    -- WellFit Community: Try Supabase Secrets first, then fall back to Vault
    encryption_key := current_setting('app.settings.PHI_ENCRYPTION_KEY', true);

    IF encryption_key IS NULL OR encryption_key = '' THEN
      -- Fall back to vault key
      SELECT decrypted_secret INTO encryption_key
      FROM vault.decrypted_secrets
      WHERE name = 'app_encryption_key'
      LIMIT 1;
    END IF;

    IF encryption_key IS NULL OR encryption_key = '' THEN
      RAISE EXCEPTION '[PHI_ENCRYPTION_FAILED] WellFit encryption key not found. Ensure PHI_ENCRYPTION_KEY is set in Supabase Secrets or app_encryption_key in Vault';
    END IF;
  END IF;

  -- v2: PGP symmetric — random session key (non-deterministic), AES-256,
  -- S2K salted+iterated KDF, MDC integrity. Versioned prefix for migration.
  RETURN 'v2:' || encode(
    extensions.pgp_sym_encrypt(
      data,
      encryption_key,
      'cipher-algo=aes256, s2k-mode=3, s2k-count=65011712'
    ),
    'base64'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- FAIL CLOSED: Do NOT allow unencrypted PHI to be stored
    RAISE EXCEPTION '[PHI_ENCRYPTION_FAILED] Encryption failed - transaction aborted to prevent unencrypted PHI storage. Error: %', SQLERRM
      USING HINT = 'Check encryption key configuration and pgcrypto extension';
END;
$$;

-- ---------------------------------------------------------------------------
-- decrypt_phi_text (two-key selector — §17); accepts v2 AND legacy formats
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decrypt_phi_text(encrypted_data TEXT, use_clinical_key BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encryption_key TEXT;
  decrypted_result BYTEA;
BEGIN
  -- Return null for null input
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get encryption key from appropriate source
  IF use_clinical_key THEN
    SELECT decrypted_secret INTO encryption_key
    FROM vault.decrypted_secrets
    WHERE name = 'app_encryption_key'
    LIMIT 1;

    IF encryption_key IS NULL OR encryption_key = '' THEN
      RAISE EXCEPTION '[PHI_DECRYPTION_FAILED] Clinical encryption key not found in Vault. Check app_encryption_key';
    END IF;
  ELSE
    encryption_key := current_setting('app.settings.PHI_ENCRYPTION_KEY', true);

    IF encryption_key IS NULL OR encryption_key = '' THEN
      SELECT decrypted_secret INTO encryption_key
      FROM vault.decrypted_secrets
      WHERE name = 'app_encryption_key'
      LIMIT 1;
    END IF;

    IF encryption_key IS NULL OR encryption_key = '' THEN
      RAISE EXCEPTION '[PHI_DECRYPTION_FAILED] WellFit encryption key not found.';
    END IF;
  END IF;

  IF encrypted_data LIKE 'v2:%' THEN
    -- v2: PGP symmetric (integrity-checked — tampering raises)
    RETURN extensions.pgp_sym_decrypt(
      decode(substring(encrypted_data FROM 4), 'base64'),
      encryption_key
    );
  END IF;

  -- Legacy (pre-2026-07-25): raw AES-CBC, zero IV, sha256(key). Kept ONLY so
  -- rows encrypted before the v2 migration remain readable. New writes are
  -- always v2.
  decrypted_result := extensions.decrypt(
    decode(encrypted_data, 'base64'),
    extensions.digest(encryption_key, 'sha256'),
    'aes'
  );

  RETURN convert_from(decrypted_result, 'utf8');

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '[PHI_DECRYPTION_FAILED] Decryption failed - possible key mismatch or data corruption. Error: %', SQLERRM
      USING HINT = 'Verify encryption key matches the key used during encryption.';
END;
$$;

-- ---------------------------------------------------------------------------
-- encrypt_phi_text_with_key (caller-supplied key — WellFit phi-encrypt edge
-- fn path, §17 option A; ACLs unchanged: service_role-only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encrypt_phi_text_with_key(data TEXT, encryption_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Null in, null out (matches encrypt_phi_text)
  IF data IS NULL THEN
    RETURN NULL;
  END IF;

  -- FAIL CLOSED: the caller must supply the key; there is no fallback
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION '[PHI_ENCRYPTION_FAILED] Caller-supplied encryption key is missing or empty';
  END IF;

  RETURN 'v2:' || encode(
    extensions.pgp_sym_encrypt(
      data,
      encryption_key,
      'cipher-algo=aes256, s2k-mode=3, s2k-count=65011712'
    ),
    'base64'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- FAIL CLOSED: never allow unencrypted PHI to be stored
    RAISE EXCEPTION '[PHI_ENCRYPTION_FAILED] Encryption failed - transaction aborted to prevent unencrypted PHI storage. Error: %', SQLERRM
      USING HINT = 'Check encryption key configuration and pgcrypto extension';
END;
$$;

-- ---------------------------------------------------------------------------
-- decrypt_phi_text_with_key (caller-supplied key; accepts v2 AND legacy)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decrypt_phi_text_with_key(encrypted_data TEXT, encryption_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  decrypted_result BYTEA;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;

  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION '[PHI_DECRYPTION_FAILED] Caller-supplied encryption key is missing or empty';
  END IF;

  IF encrypted_data LIKE 'v2:%' THEN
    RETURN extensions.pgp_sym_decrypt(
      decode(substring(encrypted_data FROM 4), 'base64'),
      encryption_key
    );
  END IF;

  -- Legacy format (pre-2026-07-25)
  decrypted_result := extensions.decrypt(
    decode(encrypted_data, 'base64'),
    extensions.digest(encryption_key, 'sha256'),
    'aes'
  );

  RETURN convert_from(decrypted_result, 'utf8');

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '[PHI_DECRYPTION_FAILED] Decryption failed - possible key mismatch or data corruption. Error: %', SQLERRM
      USING HINT = 'Verify encryption key matches the key used during encryption.';
END;
$$;

COMMENT ON FUNCTION public.encrypt_phi_text(TEXT, BOOLEAN) IS
  'PHI encryption v2 (2026-07-25): pgp_sym_encrypt AES-256, random session key (non-deterministic), S2K salted+iterated KDF, MDC integrity. Output ''v2:''+base64. Two-key selector per .claude/rules/supabase.md §17. Fail-closed.';
COMMENT ON FUNCTION public.decrypt_phi_text(TEXT, BOOLEAN) IS
  'PHI decryption v2: accepts ''v2:'' PGP format AND legacy raw-AES base64 (pre-2026-07-25 rows). Two-key selector per §17. Fail-closed.';
COMMENT ON FUNCTION public.encrypt_phi_text_with_key(TEXT, TEXT) IS
  'PHI encryption v2, caller-supplied key (service_role-only; WellFit phi-encrypt edge fn). pgp_sym AES-256, non-deterministic, integrity-checked. Fail-closed.';
COMMENT ON FUNCTION public.decrypt_phi_text_with_key(TEXT, TEXT) IS
  'PHI decryption v2, caller-supplied key (service_role-only). Accepts v2 and legacy formats. Fail-closed.';

-- ---------------------------------------------------------------------------
-- Re-encryption pass: upgrade every legacy ciphertext to v2.
-- Columns WITH a plaintext twin re-encrypt from plaintext (no dependence on
-- legacy decryption). Ciphertext-only columns use decrypt→encrypt with the
-- same key flag their writer uses (risk_assessments/handoff_packets: clinical).
-- BEFORE-UPDATE encrypt triggers on these tables skip when the plaintext
-- column is unchanged/NULL, so they do not clobber these updates.
-- ---------------------------------------------------------------------------
-- Transaction-local: the profiles guard trigger RAISES when auth.uid() is
-- NULL (migrations run as postgres, no JWT). Disable trigger firing for the
-- re-encryption UPDATEs only — resets automatically at transaction end. The
-- BEFORE-UPDATE encrypt triggers are also skipped, which is correct here:
-- we are writing the v2 ciphertext directly.
SET LOCAL session_replication_role = replica;

DO $$
DECLARE
  n INTEGER;
BEGIN
  UPDATE profiles SET dob_encrypted = encrypt_phi_text(dob::text, false)
    WHERE dob IS NOT NULL AND dob_encrypted IS NOT NULL AND dob_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'profiles.dob_encrypted → v2: % rows', n;

  UPDATE senior_demographics SET date_of_birth_encrypted = encrypt_phi_text(date_of_birth::text, false)
    WHERE date_of_birth IS NOT NULL AND date_of_birth_encrypted IS NOT NULL AND date_of_birth_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'senior_demographics.date_of_birth_encrypted → v2: % rows', n;

  UPDATE patient_referrals SET patient_dob_encrypted = encrypt_phi_text(patient_dob::text, false)
    WHERE patient_dob IS NOT NULL AND patient_dob_encrypted IS NOT NULL AND patient_dob_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'patient_referrals.patient_dob_encrypted → v2: % rows', n;

  UPDATE fhir_practitioners SET birth_date_encrypted = encrypt_phi_text(birth_date::text, false)
    WHERE birth_date IS NOT NULL AND birth_date_encrypted IS NOT NULL AND birth_date_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'fhir_practitioners.birth_date_encrypted → v2: % rows', n;

  UPDATE hc_staff SET date_of_birth_encrypted = encrypt_phi_text(date_of_birth::text, false)
    WHERE date_of_birth IS NOT NULL AND date_of_birth_encrypted IS NOT NULL AND date_of_birth_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'hc_staff.date_of_birth_encrypted → v2: % rows', n;

  UPDATE billing_providers SET ein_encrypted = encrypt_phi_text(ein::text, false)
    WHERE ein IS NOT NULL AND ein_encrypted IS NOT NULL AND ein_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'billing_providers.ein_encrypted → v2: % rows', n;

  UPDATE facilities SET tax_id_encrypted = encrypt_phi_text(tax_id::text, false)
    WHERE tax_id IS NOT NULL AND tax_id_encrypted IS NOT NULL AND tax_id_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'facilities.tax_id_encrypted → v2: % rows', n;

  UPDATE hc_organization SET tax_id_encrypted = encrypt_phi_text(tax_id::text, false)
    WHERE tax_id IS NOT NULL AND tax_id_encrypted IS NOT NULL AND tax_id_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'hc_organization.tax_id_encrypted → v2: % rows', n;

  UPDATE hc_provider_group SET tax_id_encrypted = encrypt_phi_text(tax_id::text, false)
    WHERE tax_id IS NOT NULL AND tax_id_encrypted IS NOT NULL AND tax_id_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'hc_provider_group.tax_id_encrypted → v2: % rows', n;

  -- Ciphertext-only columns (no plaintext twin) — clinical key, decrypt→encrypt.
  -- 0 rows at authoring time; included for completeness.
  UPDATE risk_assessments SET assessment_notes_encrypted = encrypt_phi_text(decrypt_phi_text(assessment_notes_encrypted, true), true)
    WHERE assessment_notes_encrypted IS NOT NULL AND assessment_notes_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'risk_assessments.assessment_notes_encrypted → v2: % rows', n;

  UPDATE risk_assessments SET risk_factors_encrypted = encrypt_phi_text(decrypt_phi_text(risk_factors_encrypted, true), true)
    WHERE risk_factors_encrypted IS NOT NULL AND risk_factors_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'risk_assessments.risk_factors_encrypted → v2: % rows', n;

  UPDATE risk_assessments SET recommended_actions_encrypted = encrypt_phi_text(decrypt_phi_text(recommended_actions_encrypted, true), true)
    WHERE recommended_actions_encrypted IS NOT NULL AND recommended_actions_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'risk_assessments.recommended_actions_encrypted → v2: % rows', n;

  UPDATE handoff_packets SET patient_name_encrypted = encrypt_phi_text(decrypt_phi_text(patient_name_encrypted, true), true)
    WHERE patient_name_encrypted IS NOT NULL AND patient_name_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'handoff_packets.patient_name_encrypted → v2: % rows', n;

  UPDATE handoff_packets SET patient_dob_encrypted = encrypt_phi_text(decrypt_phi_text(patient_dob_encrypted, true), true)
    WHERE patient_dob_encrypted IS NOT NULL AND patient_dob_encrypted NOT LIKE 'v2:%';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'handoff_packets.patient_dob_encrypted → v2: % rows', n;
END $$;
