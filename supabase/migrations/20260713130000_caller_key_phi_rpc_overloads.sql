-- ============================================================================
-- Caller-key PHI RPCs — restore the WellFit Secrets key path (§17 option A)
-- ============================================================================
-- Migration _APPLIED_20260103000001 replaced encrypt/decrypt_phi_text with the
-- fail-closed (data, use_clinical_key) signature and removed the caller-key
-- argument. That orphaned supabase/functions/phi-encrypt (the ONLY consumer of
-- the WellFit Supabase-Secrets PHI_ENCRYPTION_KEY) — every call has failed
-- PGRST202 since 2026-01-03, breaking CHW medication-photo encryption
-- (fails CLOSED — no plaintext was stored; verified 2026-07-13).
--
-- Decision (Maria, 2026-07-13): option A — restore a caller-key path so the
-- §17 two-key architecture stays real: WellFit data under the WellFit
-- Secrets key, the Vault key stays clinical-only, rotation independent, and
-- any pre-2026-01-03 env-key ciphertext stays decryptable.
-- ⚑ FLAGGED FOR AKIMA §17 RATIFICATION alongside the pending
-- RISK_ASSESSMENTS_ENCRYPTION_REVIEW (see that doc's 2026-07-13 addendum).
--
-- Safety posture — preserves EVERYTHING the January fail-safe intended:
--   * FAIL CLOSED: missing/empty key or any crypto error RAISES; there is no
--     fallback key and plaintext is never returned/stored.
--   * SERVICE-ROLE ONLY: EXECUTE revoked from PUBLIC/anon/authenticated —
--     a browser can never pass key material through PostgREST; only edge
--     functions holding the secret server-side (phi-encrypt uses the
--     SB_SECRET_KEY client) can call these.
--   * NEW NAMES (encrypt_phi_text_with_key / decrypt_phi_text_with_key), not
--     overloads of the same name — PostgREST overload resolution on optional
--     args is ambiguity-prone; distinct names keep both paths unambiguous.
--   * IDENTICAL cipher scheme to the live functions (pgcrypto AES,
--     sha256-digested key, base64 transport) — mirrored byte-for-byte from
--     the live pg_proc source so ciphertext is cross-compatible per key.
--
-- Forward-only: NO `-- migrate:down` block. CREATE OR REPLACE, safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.encrypt_phi_text_with_key(
  data TEXT,
  encryption_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_result BYTEA;
BEGIN
  -- Null in, null out (matches encrypt_phi_text)
  IF data IS NULL THEN
    RETURN NULL;
  END IF;

  -- FAIL CLOSED: the caller must supply the key; there is no fallback
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION '[PHI_ENCRYPTION_FAILED] Caller-supplied encryption key is missing or empty';
  END IF;

  encrypted_result := extensions.encrypt(
    data::BYTEA,
    extensions.digest(encryption_key, 'sha256'),
    'aes'
  );

  RETURN encode(encrypted_result, 'base64');

EXCEPTION
  WHEN OTHERS THEN
    -- FAIL CLOSED: never allow unencrypted PHI to be stored
    RAISE EXCEPTION '[PHI_ENCRYPTION_FAILED] Encryption failed - transaction aborted to prevent unencrypted PHI storage. Error: %', SQLERRM
      USING HINT = 'Check encryption key configuration and pgcrypto extension';
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_phi_text_with_key(
  encrypted_data TEXT,
  encryption_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.encrypt_phi_text_with_key(TEXT, TEXT) IS
  'Caller-key PHI encryption for edge functions holding the WellFit Secrets key (§17 two-key architecture). FAIL-CLOSED, service_role-only — browsers can never pass key material. Same cipher scheme as encrypt_phi_text.';
COMMENT ON FUNCTION public.decrypt_phi_text_with_key(TEXT, TEXT) IS
  'Caller-key PHI decryption counterpart of encrypt_phi_text_with_key (§17). FAIL-CLOSED, service_role-only.';

-- SERVICE-ROLE ONLY: a browser must never send key material through PostgREST
REVOKE EXECUTE ON FUNCTION public.encrypt_phi_text_with_key(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_phi_text_with_key(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.encrypt_phi_text_with_key(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_phi_text_with_key(TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.decrypt_phi_text_with_key(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_phi_text_with_key(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrypt_phi_text_with_key(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_phi_text_with_key(TEXT, TEXT) TO service_role;
