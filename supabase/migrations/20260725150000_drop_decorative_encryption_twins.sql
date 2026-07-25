-- ============================================================================
-- Drop the decorative encryption twins — Maria approved 2026-07-25
--
-- Follow-up to audit finding 3 (see 20260725110000 + docs/compliance/
-- PHI_ENCRYPTION_KEY_ROTATION.md §3). Nine columns duplicated a value that
-- also sits in PLAINTEXT in the same row — the ciphertext copy protected
-- nothing ("a lock on an open door"). The plaintext columns are load-bearing
-- (kiosk identity match, search, FHIR, age logic) and CANNOT be dropped
-- without blind-index infrastructure, so the honest posture (ratified by
-- Maria 2026-07-25) is:
--   * Demographics + org identifiers: protected by disk-level encryption at
--     rest + RLS tenant isolation + PHI access audit logging. No pretend
--     column encryption.
--   * Column-level encryption is reserved for high-sensitivity content with
--     NO plaintext copy — risk_assessments (encrypt+NULL trigger) and
--     handoff_packets (client-side encrypt) are UNTOUCHED by this migration,
--     as are all four encrypt/decrypt functions and the CHW *_with_key path.
--
-- Pre-drop verification (2026-07-25, live + code):
--   * 0 code readers of all nine twin columns (every src hit is
--     handoff_packets.*_encrypted — different table, real encryption, stays).
--   * 0 code readers of all nine *_decrypted views; each view decrypts ONLY
--     its twin column (regexp-verified against pg_views definitions).
--   * Only 14 ciphertext values existed (profiles 10, senior_demographics 4)
--     and each duplicates a populated plaintext value in the same row.
--   * Trigger names live-verified from pg_trigger.
-- ============================================================================

-- Views first (they depend on the columns)
DROP VIEW IF EXISTS public.profiles_decrypted;
DROP VIEW IF EXISTS public.senior_demographics_decrypted;
DROP VIEW IF EXISTS public.patient_referrals_decrypted;
DROP VIEW IF EXISTS public.fhir_practitioners_decrypted;
DROP VIEW IF EXISTS public.hc_staff_decrypted;
DROP VIEW IF EXISTS public.billing_providers_decrypted;
DROP VIEW IF EXISTS public.facilities_decrypted;
DROP VIEW IF EXISTS public.hc_organization_decrypted;
DROP VIEW IF EXISTS public.hc_provider_group_decrypted;

-- Dual-write triggers
DROP TRIGGER IF EXISTS encrypt_profiles_dob ON public.profiles;
DROP TRIGGER IF EXISTS encrypt_senior_demographics_dob ON public.senior_demographics;
DROP TRIGGER IF EXISTS encrypt_patient_referrals_dob ON public.patient_referrals;
DROP TRIGGER IF EXISTS encrypt_fhir_practitioners_dob ON public.fhir_practitioners;
DROP TRIGGER IF EXISTS encrypt_hc_staff_dob ON public.hc_staff;
DROP TRIGGER IF EXISTS encrypt_billing_providers_ein ON public.billing_providers;
DROP TRIGGER IF EXISTS encrypt_facilities_tax_id ON public.facilities;
DROP TRIGGER IF EXISTS encrypt_hc_organization_tax_id ON public.hc_organization;
DROP TRIGGER IF EXISTS encrypt_hc_provider_group_tax_id ON public.hc_provider_group;

-- Trigger functions (encrypt_risk_assessments_phi is NOT touched)
DROP FUNCTION IF EXISTS public.encrypt_dob_on_change();
DROP FUNCTION IF EXISTS public.encrypt_tax_id_on_change();

-- The decorative ciphertext columns
ALTER TABLE public.profiles            DROP COLUMN IF EXISTS dob_encrypted;
ALTER TABLE public.senior_demographics DROP COLUMN IF EXISTS date_of_birth_encrypted;
ALTER TABLE public.patient_referrals   DROP COLUMN IF EXISTS patient_dob_encrypted;
ALTER TABLE public.fhir_practitioners  DROP COLUMN IF EXISTS birth_date_encrypted;
ALTER TABLE public.hc_staff            DROP COLUMN IF EXISTS date_of_birth_encrypted;
ALTER TABLE public.billing_providers   DROP COLUMN IF EXISTS ein_encrypted;
ALTER TABLE public.facilities          DROP COLUMN IF EXISTS tax_id_encrypted;
ALTER TABLE public.hc_organization     DROP COLUMN IF EXISTS tax_id_encrypted;
ALTER TABLE public.hc_provider_group   DROP COLUMN IF EXISTS tax_id_encrypted;
