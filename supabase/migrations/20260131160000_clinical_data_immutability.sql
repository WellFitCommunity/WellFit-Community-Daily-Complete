-- =============================================================================
-- Clinical Data Immutability
-- =============================================================================
-- Purpose: Add triggers to prevent unauthorized modification of clinical records
--          after they reach a finalized state.
--
-- HIPAA Reference: 45 CFR 164.312(c)(1) - Integrity controls
-- Medical Records: Legal requirement to maintain unaltered clinical documentation
-- Billing Compliance: Claims cannot be modified after submission
--
-- Tables Protected:
--   - encounters (after status leaves draft/scheduled/in-progress)
--   - encounter_procedures (linked to finalized encounters)
--   - encounter_diagnoses (linked to finalized encounters)
--   - clinical_notes (after creation - append-only corrections)
--   - claims (after submitted_at is set)
--   - claim_lines (linked to submitted claims)
--   - patient_consents (revoked_at cannot be unset once set)
--
-- Design Principle: Allow edits while in draft/active state, lock after finalization
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Encounter Immutability (status-based)
-- =============================================================================
-- Encounters are immutable once they leave draft/scheduled/in-progress status
-- This prevents retroactive changes to completed medical encounters

CREATE OR REPLACE FUNCTION prevent_finalized_encounter_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow modifications while encounter is in editable states
  IF OLD.status IN ('draft', 'scheduled', 'in-progress', 'arrived', 'triaged') THEN
    RETURN NEW;
  END IF;

  -- Block modifications to finalized encounters
  RAISE EXCEPTION '[CLINICAL_IMMUTABILITY_VIOLATION] Cannot % finalized encounter (status: %). Medical records are immutable after completion for HIPAA compliance.',
    TG_OP, OLD.status
    USING HINT = 'Encounters cannot be modified after status changes to completed/cancelled/billed. Create an addendum instead.';

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_finalized_encounter_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow deletion only for draft encounters
  IF OLD.status = 'draft' THEN
    RETURN OLD;
  END IF;

  -- Block deletion of any non-draft encounter
  RAISE EXCEPTION '[CLINICAL_IMMUTABILITY_VIOLATION] Cannot delete encounter (status: %). Medical records cannot be deleted for HIPAA compliance.',
    OLD.status
    USING HINT = 'Encounters can only be deleted while in draft status. Use cancellation workflow instead.';

  RETURN NULL;
END;
$$;

-- Apply to encounters table
DROP TRIGGER IF EXISTS prevent_encounters_update ON encounters;
DROP TRIGGER IF EXISTS prevent_encounters_delete ON encounters;

CREATE TRIGGER prevent_encounters_update
  BEFORE UPDATE ON encounters
  FOR EACH ROW
  EXECUTE FUNCTION prevent_finalized_encounter_modification();

CREATE TRIGGER prevent_encounters_delete
  BEFORE DELETE ON encounters
  FOR EACH ROW
  EXECUTE FUNCTION prevent_finalized_encounter_deletion();

COMMENT ON FUNCTION prevent_finalized_encounter_modification() IS
  'HIPAA compliance: Prevents modification of medical encounters after finalization.';

-- =============================================================================
-- 2. Encounter Procedures Immutability (linked to parent encounter)
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_encounter_procedure_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  encounter_status TEXT;
BEGIN
  -- Get parent encounter status
  SELECT status INTO encounter_status
  FROM encounters
  WHERE id = OLD.encounter_id;

  -- Allow modifications while encounter is editable
  IF encounter_status IS NULL OR encounter_status IN ('draft', 'scheduled', 'in-progress', 'arrived', 'triaged') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Block modifications when encounter is finalized
  RAISE EXCEPTION '[CLINICAL_IMMUTABILITY_VIOLATION] Cannot % procedure on finalized encounter (status: %). Billing codes are immutable after encounter completion.',
    TG_OP, encounter_status
    USING HINT = 'Procedures cannot be modified after the parent encounter is finalized.';

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS prevent_encounter_procedures_update ON encounter_procedures;
DROP TRIGGER IF EXISTS prevent_encounter_procedures_delete ON encounter_procedures;

CREATE TRIGGER prevent_encounter_procedures_update
  BEFORE UPDATE ON encounter_procedures
  FOR EACH ROW
  EXECUTE FUNCTION prevent_encounter_procedure_modification();

CREATE TRIGGER prevent_encounter_procedures_delete
  BEFORE DELETE ON encounter_procedures
  FOR EACH ROW
  EXECUTE FUNCTION prevent_encounter_procedure_modification();

-- =============================================================================
-- 3. Encounter Diagnoses Immutability (linked to parent encounter)
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_encounter_diagnosis_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  encounter_status TEXT;
BEGIN
  -- Get parent encounter status
  SELECT status INTO encounter_status
  FROM encounters
  WHERE id = OLD.encounter_id;

  -- Allow modifications while encounter is editable
  IF encounter_status IS NULL OR encounter_status IN ('draft', 'scheduled', 'in-progress', 'arrived', 'triaged') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Block modifications when encounter is finalized
  RAISE EXCEPTION '[CLINICAL_IMMUTABILITY_VIOLATION] Cannot % diagnosis on finalized encounter (status: %). Diagnosis codes are immutable after encounter completion.',
    TG_OP, encounter_status
    USING HINT = 'Diagnoses cannot be modified after the parent encounter is finalized.';

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS prevent_encounter_diagnoses_update ON encounter_diagnoses;
DROP TRIGGER IF EXISTS prevent_encounter_diagnoses_delete ON encounter_diagnoses;

CREATE TRIGGER prevent_encounter_diagnoses_update
  BEFORE UPDATE ON encounter_diagnoses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_encounter_diagnosis_modification();

CREATE TRIGGER prevent_encounter_diagnoses_delete
  BEFORE DELETE ON encounter_diagnoses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_encounter_diagnosis_modification();

-- =============================================================================
-- 4. Clinical Notes Immutability (append-only after creation)
-- =============================================================================
-- Clinical notes cannot be modified or deleted after creation
-- Corrections must be made via addendum (new note referencing original)

CREATE OR REPLACE FUNCTION prevent_clinical_note_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION '[CLINICAL_IMMUTABILITY_VIOLATION] Cannot % clinical note. Medical documentation is immutable for legal compliance.',
    TG_OP
    USING HINT = 'Clinical notes cannot be modified or deleted. Create an addendum note instead.';

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS prevent_clinical_notes_update ON clinical_notes;
DROP TRIGGER IF EXISTS prevent_clinical_notes_delete ON clinical_notes;

CREATE TRIGGER prevent_clinical_notes_update
  BEFORE UPDATE ON clinical_notes
  FOR EACH ROW
  EXECUTE FUNCTION prevent_clinical_note_modification();

CREATE TRIGGER prevent_clinical_notes_delete
  BEFORE DELETE ON clinical_notes
  FOR EACH ROW
  EXECUTE FUNCTION prevent_clinical_note_modification();

-- =============================================================================
-- 5. Claims Immutability (after submission)
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_submitted_claim_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow modifications while claim is not yet submitted
  IF OLD.submitted_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block modifications to submitted claims
  RAISE EXCEPTION '[BILLING_IMMUTABILITY_VIOLATION] Cannot % submitted claim (submitted: %). Claims are immutable after submission to clearinghouse.',
    TG_OP, OLD.submitted_at
    USING HINT = 'Claims cannot be modified after submission. Use void/rebill workflow instead.';

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_submitted_claim_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow deletion only for unsubmitted claims
  IF OLD.submitted_at IS NULL THEN
    RETURN OLD;
  END IF;

  -- Block deletion of submitted claims
  RAISE EXCEPTION '[BILLING_IMMUTABILITY_VIOLATION] Cannot delete submitted claim. Claims are immutable after submission for audit compliance.'
    USING HINT = 'Submitted claims cannot be deleted. Use void workflow instead.';

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS prevent_claims_update ON claims;
DROP TRIGGER IF EXISTS prevent_claims_delete ON claims;

CREATE TRIGGER prevent_claims_update
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION prevent_submitted_claim_modification();

CREATE TRIGGER prevent_claims_delete
  BEFORE DELETE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION prevent_submitted_claim_deletion();

-- =============================================================================
-- 6. Claim Lines Immutability (linked to parent claim)
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_claim_line_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  claim_submitted_at TIMESTAMPTZ;
BEGIN
  -- Get parent claim submission status
  SELECT submitted_at INTO claim_submitted_at
  FROM claims
  WHERE id = OLD.claim_id;

  -- Allow modifications while claim is not submitted
  IF claim_submitted_at IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Block modifications when claim is submitted
  RAISE EXCEPTION '[BILLING_IMMUTABILITY_VIOLATION] Cannot % line item on submitted claim. Billing details are immutable after submission.',
    TG_OP
    USING HINT = 'Claim lines cannot be modified after the parent claim is submitted.';

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS prevent_claim_lines_update ON claim_lines;
DROP TRIGGER IF EXISTS prevent_claim_lines_delete ON claim_lines;

CREATE TRIGGER prevent_claim_lines_update
  BEFORE UPDATE ON claim_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_claim_line_modification();

CREATE TRIGGER prevent_claim_lines_delete
  BEFORE DELETE ON claim_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_claim_line_modification();

-- =============================================================================
-- 7. Patient Consent Revocation Immutability
-- =============================================================================
-- Once a consent is revoked (revoked_at is set), it cannot be "un-revoked"
-- A new consent must be created instead

CREATE OR REPLACE FUNCTION prevent_consent_unrevoke()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If consent was revoked and someone tries to clear revoked_at
  IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION '[CONSENT_IMMUTABILITY_VIOLATION] Cannot un-revoke a revoked consent. Consent revocations are permanent for HIPAA compliance.'
      USING HINT = 'Revoked consents cannot be restored. Create a new consent record instead.';
    RETURN NULL;
  END IF;

  -- Allow other modifications (including initial revocation)
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_revoked_consent_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Block deletion of revoked consents (audit trail requirement)
  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION '[CONSENT_IMMUTABILITY_VIOLATION] Cannot delete revoked consent record. Consent audit trail must be preserved.'
      USING HINT = 'Revoked consent records cannot be deleted for compliance.';
    RETURN NULL;
  END IF;

  -- Allow deletion of non-revoked consents (e.g., draft/pending)
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_patient_consents_unrevoke ON patient_consents;
DROP TRIGGER IF EXISTS prevent_patient_consents_delete ON patient_consents;

CREATE TRIGGER prevent_patient_consents_unrevoke
  BEFORE UPDATE ON patient_consents
  FOR EACH ROW
  EXECUTE FUNCTION prevent_consent_unrevoke();

CREATE TRIGGER prevent_patient_consents_delete
  BEFORE DELETE ON patient_consents
  FOR EACH ROW
  EXECUTE FUNCTION prevent_revoked_consent_deletion();

-- =============================================================================
-- 8. Verification
-- =============================================================================

DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE t.tgname LIKE 'prevent_%'
  AND c.relname IN ('encounters', 'encounter_procedures', 'encounter_diagnoses',
                    'clinical_notes', 'claims', 'claim_lines', 'patient_consents');

  RAISE NOTICE 'Clinical data immutability migration complete. % triggers created on 7 tables.', trigger_count;
END $$;

COMMIT;

-- =============================================================================
-- Post-migration notes
-- =============================================================================
--
-- Tables Protected:
--   - encounters: Immutable after status leaves draft/scheduled/in-progress
--   - encounter_procedures: Follows parent encounter status
--   - encounter_diagnoses: Follows parent encounter status
--   - clinical_notes: Fully immutable (append-only model)
--   - claims: Immutable after submitted_at is set
--   - claim_lines: Follows parent claim submission status
--   - patient_consents: revoked_at cannot be unset; revoked records cannot be deleted
--
-- Allowed Operations:
--   - Creating new records (always allowed)
--   - Updating draft/in-progress encounters
--   - Updating unsubmitted claims
--   - Revoking consents (setting revoked_at)
--   - Deleting draft encounters and unsubmitted claims
--
-- Blocked Operations:
--   - Modifying finalized encounters
--   - Modifying submitted claims
--   - Modifying clinical notes
--   - Un-revoking consents
--   - Deleting finalized records
--
-- =============================================================================
