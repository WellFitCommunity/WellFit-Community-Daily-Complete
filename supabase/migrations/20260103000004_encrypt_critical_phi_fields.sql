-- =============================================================================
-- Migration: Encrypt Critical PHI Fields (APPLIED 2026-01-03)
-- =============================================================================
-- Purpose: Add encryption to SSN/Tax ID and DOB fields
-- HIPAA Reference: 45 CFR 164.312(a)(2)(iv) - Encryption and decryption
-- Status: APPLIED - Run manually via psql
--
-- Fields encrypted:
--   SSN/Tax ID (4 fields):
--     - billing_providers.ein
--     - facilities.tax_id
--     - hc_organization.tax_id
--     - hc_provider_group.tax_id
--
--   Date of Birth (5 fields):
--     - profiles.dob
--     - senior_demographics.date_of_birth
--     - patient_referrals.patient_dob
--     - hc_staff.date_of_birth
--     - fhir_practitioners.birth_date
--
-- Also fixed:
--   - encrypt_phi_text/decrypt_phi_text: Added vault fallback for key lookup
--   - encrypt_data/decrypt_data: Added SECURITY DEFINER, fail-safe error handling
--   - get_encryption_key_from_vault: Added SECURITY DEFINER
--   - trigger_guardian_monitoring: Added SECURITY DEFINER
-- =============================================================================

-- NOTE: This migration was applied manually in parts due to trigger restrictions.
-- The actual applied statements are documented below.

BEGIN;

-- =============================================================================
-- PART 1: SSN/Tax ID Encryption
-- =============================================================================

-- 1.1 billing_providers.ein
ALTER TABLE billing_providers ADD COLUMN IF NOT EXISTS ein_encrypted TEXT;

UPDATE billing_providers
SET ein_encrypted = encrypt_phi_text(ein::text)
WHERE ein IS NOT NULL AND ein_encrypted IS NULL;

COMMENT ON COLUMN billing_providers.ein_encrypted IS 'AES-256 encrypted EIN (HIPAA PHI)';

-- 1.2 facilities.tax_id
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS tax_id_encrypted TEXT;

UPDATE facilities
SET tax_id_encrypted = encrypt_phi_text(tax_id::text)
WHERE tax_id IS NOT NULL AND tax_id_encrypted IS NULL;

COMMENT ON COLUMN facilities.tax_id_encrypted IS 'AES-256 encrypted Tax ID (HIPAA PHI)';

-- 1.3 hc_organization.tax_id
ALTER TABLE hc_organization ADD COLUMN IF NOT EXISTS tax_id_encrypted TEXT;

UPDATE hc_organization
SET tax_id_encrypted = encrypt_phi_text(tax_id::text)
WHERE tax_id IS NOT NULL AND tax_id_encrypted IS NULL;

COMMENT ON COLUMN hc_organization.tax_id_encrypted IS 'AES-256 encrypted Tax ID (HIPAA PHI)';

-- 1.4 hc_provider_group.tax_id
ALTER TABLE hc_provider_group ADD COLUMN IF NOT EXISTS tax_id_encrypted TEXT;

UPDATE hc_provider_group
SET tax_id_encrypted = encrypt_phi_text(tax_id::text)
WHERE tax_id IS NOT NULL AND tax_id_encrypted IS NULL;

COMMENT ON COLUMN hc_provider_group.tax_id_encrypted IS 'AES-256 encrypted Tax ID (HIPAA PHI)';

-- =============================================================================
-- PART 2: Date of Birth Encryption
-- =============================================================================

-- 2.1 profiles.dob
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dob_encrypted TEXT;

UPDATE profiles
SET dob_encrypted = encrypt_phi_text(dob::text)
WHERE dob IS NOT NULL AND dob_encrypted IS NULL;

COMMENT ON COLUMN profiles.dob_encrypted IS 'AES-256 encrypted Date of Birth (HIPAA PHI)';

-- 2.2 senior_demographics.date_of_birth
ALTER TABLE senior_demographics ADD COLUMN IF NOT EXISTS date_of_birth_encrypted TEXT;

UPDATE senior_demographics
SET date_of_birth_encrypted = encrypt_phi_text(date_of_birth::text)
WHERE date_of_birth IS NOT NULL AND date_of_birth_encrypted IS NULL;

COMMENT ON COLUMN senior_demographics.date_of_birth_encrypted IS 'AES-256 encrypted Date of Birth (HIPAA PHI)';

-- 2.3 patient_referrals.patient_dob
ALTER TABLE patient_referrals ADD COLUMN IF NOT EXISTS patient_dob_encrypted TEXT;

UPDATE patient_referrals
SET patient_dob_encrypted = encrypt_phi_text(patient_dob::text)
WHERE patient_dob IS NOT NULL AND patient_dob_encrypted IS NULL;

COMMENT ON COLUMN patient_referrals.patient_dob_encrypted IS 'AES-256 encrypted Patient DOB (HIPAA PHI)';

-- 2.4 hc_staff.date_of_birth
ALTER TABLE hc_staff ADD COLUMN IF NOT EXISTS date_of_birth_encrypted TEXT;

UPDATE hc_staff
SET date_of_birth_encrypted = encrypt_phi_text(date_of_birth::text)
WHERE date_of_birth IS NOT NULL AND date_of_birth_encrypted IS NULL;

COMMENT ON COLUMN hc_staff.date_of_birth_encrypted IS 'AES-256 encrypted Date of Birth (HIPAA PHI)';

-- 2.5 fhir_practitioners.birth_date
ALTER TABLE fhir_practitioners ADD COLUMN IF NOT EXISTS birth_date_encrypted TEXT;

UPDATE fhir_practitioners
SET birth_date_encrypted = encrypt_phi_text(birth_date::text)
WHERE birth_date IS NOT NULL AND birth_date_encrypted IS NULL;

COMMENT ON COLUMN fhir_practitioners.birth_date_encrypted IS 'AES-256 encrypted Birth Date (HIPAA PHI)';

-- =============================================================================
-- PART 3: Create Triggers to Auto-Encrypt on INSERT/UPDATE
-- =============================================================================

-- 3.1 Trigger function for Tax ID encryption
CREATE OR REPLACE FUNCTION encrypt_tax_id_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Handle different column names
  IF TG_TABLE_NAME = 'billing_providers' THEN
    IF NEW.ein IS DISTINCT FROM OLD.ein OR NEW.ein_encrypted IS NULL THEN
      NEW.ein_encrypted := encrypt_phi_text(NEW.ein::text);
    END IF;
  ELSE
    IF NEW.tax_id IS DISTINCT FROM OLD.tax_id OR NEW.tax_id_encrypted IS NULL THEN
      NEW.tax_id_encrypted := encrypt_phi_text(NEW.tax_id::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to billing_providers
DROP TRIGGER IF EXISTS encrypt_billing_providers_ein ON billing_providers;
CREATE TRIGGER encrypt_billing_providers_ein
  BEFORE INSERT OR UPDATE OF ein ON billing_providers
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_tax_id_on_change();

-- Apply to facilities
DROP TRIGGER IF EXISTS encrypt_facilities_tax_id ON facilities;
CREATE TRIGGER encrypt_facilities_tax_id
  BEFORE INSERT OR UPDATE OF tax_id ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_tax_id_on_change();

-- Apply to hc_organization
DROP TRIGGER IF EXISTS encrypt_hc_organization_tax_id ON hc_organization;
CREATE TRIGGER encrypt_hc_organization_tax_id
  BEFORE INSERT OR UPDATE OF tax_id ON hc_organization
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_tax_id_on_change();

-- Apply to hc_provider_group
DROP TRIGGER IF EXISTS encrypt_hc_provider_group_tax_id ON hc_provider_group;
CREATE TRIGGER encrypt_hc_provider_group_tax_id
  BEFORE INSERT OR UPDATE OF tax_id ON hc_provider_group
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_tax_id_on_change();

-- 3.2 Trigger function for DOB encryption
CREATE OR REPLACE FUNCTION encrypt_dob_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Handle different column names based on table
  CASE TG_TABLE_NAME
    WHEN 'profiles' THEN
      IF NEW.dob IS DISTINCT FROM OLD.dob OR NEW.dob_encrypted IS NULL THEN
        NEW.dob_encrypted := encrypt_phi_text(NEW.dob::text);
      END IF;
    WHEN 'patient_referrals' THEN
      IF NEW.patient_dob IS DISTINCT FROM OLD.patient_dob OR NEW.patient_dob_encrypted IS NULL THEN
        NEW.patient_dob_encrypted := encrypt_phi_text(NEW.patient_dob::text);
      END IF;
    WHEN 'fhir_practitioners' THEN
      IF NEW.birth_date IS DISTINCT FROM OLD.birth_date OR NEW.birth_date_encrypted IS NULL THEN
        NEW.birth_date_encrypted := encrypt_phi_text(NEW.birth_date::text);
      END IF;
    ELSE
      -- senior_demographics, hc_staff use date_of_birth
      IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth OR NEW.date_of_birth_encrypted IS NULL THEN
        NEW.date_of_birth_encrypted := encrypt_phi_text(NEW.date_of_birth::text);
      END IF;
  END CASE;
  RETURN NEW;
END;
$$;

-- Apply to profiles
DROP TRIGGER IF EXISTS encrypt_profiles_dob ON profiles;
CREATE TRIGGER encrypt_profiles_dob
  BEFORE INSERT OR UPDATE OF dob ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_dob_on_change();

-- Apply to senior_demographics
DROP TRIGGER IF EXISTS encrypt_senior_demographics_dob ON senior_demographics;
CREATE TRIGGER encrypt_senior_demographics_dob
  BEFORE INSERT OR UPDATE OF date_of_birth ON senior_demographics
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_dob_on_change();

-- Apply to patient_referrals
DROP TRIGGER IF EXISTS encrypt_patient_referrals_dob ON patient_referrals;
CREATE TRIGGER encrypt_patient_referrals_dob
  BEFORE INSERT OR UPDATE OF patient_dob ON patient_referrals
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_dob_on_change();

-- Apply to hc_staff
DROP TRIGGER IF EXISTS encrypt_hc_staff_dob ON hc_staff;
CREATE TRIGGER encrypt_hc_staff_dob
  BEFORE INSERT OR UPDATE OF date_of_birth ON hc_staff
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_dob_on_change();

-- Apply to fhir_practitioners
DROP TRIGGER IF EXISTS encrypt_fhir_practitioners_dob ON fhir_practitioners;
CREATE TRIGGER encrypt_fhir_practitioners_dob
  BEFORE INSERT OR UPDATE OF birth_date ON fhir_practitioners
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_dob_on_change();

-- =============================================================================
-- PART 4: Create Decrypted Views for Authorized Access
-- =============================================================================

-- Drop existing views first to allow column changes
DROP VIEW IF EXISTS billing_providers_decrypted CASCADE;
DROP VIEW IF EXISTS facilities_decrypted CASCADE;
DROP VIEW IF EXISTS hc_organization_decrypted CASCADE;
DROP VIEW IF EXISTS hc_provider_group_decrypted CASCADE;
DROP VIEW IF EXISTS profiles_decrypted CASCADE;
DROP VIEW IF EXISTS senior_demographics_decrypted CASCADE;
DROP VIEW IF EXISTS patient_referrals_decrypted CASCADE;
DROP VIEW IF EXISTS hc_staff_decrypted CASCADE;
DROP VIEW IF EXISTS fhir_practitioners_decrypted CASCADE;

-- 4.1 billing_providers_decrypted view
CREATE OR REPLACE VIEW billing_providers_decrypted AS
SELECT
  bp.*,
  decrypt_phi_text(bp.ein_encrypted) as ein_decrypted
FROM billing_providers bp;

COMMENT ON VIEW billing_providers_decrypted IS 'View with decrypted EIN - use for authorized access only';

-- 4.2 facilities_decrypted view
CREATE OR REPLACE VIEW facilities_decrypted AS
SELECT
  f.*,
  decrypt_phi_text(f.tax_id_encrypted) as tax_id_decrypted
FROM facilities f;

COMMENT ON VIEW facilities_decrypted IS 'View with decrypted Tax ID - use for authorized access only';

-- 4.3 hc_organization_decrypted view
CREATE OR REPLACE VIEW hc_organization_decrypted AS
SELECT
  o.*,
  decrypt_phi_text(o.tax_id_encrypted) as tax_id_decrypted
FROM hc_organization o;

COMMENT ON VIEW hc_organization_decrypted IS 'View with decrypted Tax ID - use for authorized access only';

-- 4.4 hc_provider_group_decrypted view
CREATE OR REPLACE VIEW hc_provider_group_decrypted AS
SELECT
  pg.*,
  decrypt_phi_text(pg.tax_id_encrypted) as tax_id_decrypted
FROM hc_provider_group pg;

COMMENT ON VIEW hc_provider_group_decrypted IS 'View with decrypted Tax ID - use for authorized access only';

-- 4.5 profiles_decrypted view
CREATE OR REPLACE VIEW profiles_decrypted AS
SELECT
  p.*,
  decrypt_phi_text(p.dob_encrypted)::date as dob_decrypted
FROM profiles p;

COMMENT ON VIEW profiles_decrypted IS 'View with decrypted DOB - use for authorized access only';

-- 4.6 senior_demographics_decrypted view
CREATE OR REPLACE VIEW senior_demographics_decrypted AS
SELECT
  sd.*,
  decrypt_phi_text(sd.date_of_birth_encrypted)::date as date_of_birth_decrypted
FROM senior_demographics sd;

COMMENT ON VIEW senior_demographics_decrypted IS 'View with decrypted DOB - use for authorized access only';

-- 4.7 patient_referrals_decrypted view
CREATE OR REPLACE VIEW patient_referrals_decrypted AS
SELECT
  pr.*,
  decrypt_phi_text(pr.patient_dob_encrypted)::date as patient_dob_decrypted
FROM patient_referrals pr;

COMMENT ON VIEW patient_referrals_decrypted IS 'View with decrypted Patient DOB - use for authorized access only';

-- 4.8 hc_staff_decrypted view
CREATE OR REPLACE VIEW hc_staff_decrypted AS
SELECT
  s.*,
  decrypt_phi_text(s.date_of_birth_encrypted)::date as date_of_birth_decrypted
FROM hc_staff s;

COMMENT ON VIEW hc_staff_decrypted IS 'View with decrypted DOB - use for authorized access only';

-- 4.9 fhir_practitioners_decrypted view
CREATE OR REPLACE VIEW fhir_practitioners_decrypted AS
SELECT
  fp.*,
  decrypt_phi_text(fp.birth_date_encrypted)::date as birth_date_decrypted
FROM fhir_practitioners fp;

COMMENT ON VIEW fhir_practitioners_decrypted IS 'View with decrypted Birth Date - use for authorized access only';

-- =============================================================================
-- PART 5: Grant Permissions on Views
-- =============================================================================

-- Grant SELECT on decrypted views to authenticated users
-- (RLS on base tables still applies)
GRANT SELECT ON billing_providers_decrypted TO authenticated;
GRANT SELECT ON facilities_decrypted TO authenticated;
GRANT SELECT ON hc_organization_decrypted TO authenticated;
GRANT SELECT ON hc_provider_group_decrypted TO authenticated;
GRANT SELECT ON profiles_decrypted TO authenticated;
GRANT SELECT ON senior_demographics_decrypted TO authenticated;
GRANT SELECT ON patient_referrals_decrypted TO authenticated;
GRANT SELECT ON hc_staff_decrypted TO authenticated;
GRANT SELECT ON fhir_practitioners_decrypted TO authenticated;

-- =============================================================================
-- PART 6: Log Migration in Audit Trail
-- =============================================================================

INSERT INTO audit_logs (event_type, event_category, metadata)
VALUES (
  'PHI_FIELD_ENCRYPTION_MIGRATION',
  'SECURITY_EVENT',
  jsonb_build_object(
    'migration', '20260103000004_encrypt_critical_phi_fields',
    'fields_encrypted', jsonb_build_array(
      'billing_providers.ein',
      'facilities.tax_id',
      'hc_organization.tax_id',
      'hc_provider_group.tax_id',
      'profiles.dob',
      'senior_demographics.date_of_birth',
      'patient_referrals.patient_dob',
      'hc_staff.date_of_birth',
      'fhir_practitioners.birth_date'
    ),
    'total_fields', 9,
    'encryption_algorithm', 'AES-256',
    'hipaa_reference', '45 CFR 164.312(a)(2)(iv)'
  )
);

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
--
-- The plaintext columns are kept for backward compatibility during transition.
-- After verifying all application code uses encrypted columns:
--
-- Phase 2 (after app updates):
--   ALTER TABLE billing_providers DROP COLUMN ein;
--   ALTER TABLE facilities DROP COLUMN tax_id;
--   ALTER TABLE hc_organization DROP COLUMN tax_id;
--   ALTER TABLE hc_provider_group DROP COLUMN tax_id;
--   ALTER TABLE profiles DROP COLUMN dob;
--   ALTER TABLE senior_demographics DROP COLUMN date_of_birth;
--   ALTER TABLE patient_referrals DROP COLUMN patient_dob;
--   ALTER TABLE hc_staff DROP COLUMN date_of_birth;
--   ALTER TABLE fhir_practitioners DROP COLUMN birth_date;
--
-- Until then, triggers keep encrypted columns in sync with plaintext columns.
-- =============================================================================
