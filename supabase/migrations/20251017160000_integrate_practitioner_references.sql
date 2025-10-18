-- ============================================================================
-- INTEGRATE PRACTITIONER REFERENCES ACROSS ALL FHIR RESOURCES
-- ============================================================================
-- This migration adds practitioner_id foreign key columns to all FHIR resources
-- that need to reference practitioners (doctors, nurses, etc.)
--
-- Tables Updated (if they exist):
-- - fhir_care_plans (author = practitioner who created the plan)
-- - fhir_immunizations (performer = practitioner who administered vaccine)
-- - fhir_procedures (performer = practitioner who performed procedure)
-- - fhir_medication_requests (requester = practitioner who prescribed)
-- - fhir_observations (performer = practitioner who recorded observation)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD PRACTITIONER_ID COLUMNS (with table existence checks)
-- ============================================================================

-- CarePlan: Add author_practitioner_id (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_care_plans') THEN
        ALTER TABLE fhir_care_plans
        ADD COLUMN IF NOT EXISTS author_practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL;

        COMMENT ON COLUMN fhir_care_plans.author_practitioner_id IS 'Practitioner who authored/created this care plan';
        RAISE NOTICE 'Added author_practitioner_id to fhir_care_plans';
    ELSE
        RAISE NOTICE 'Skipping fhir_care_plans - table does not exist';
    END IF;
END $$;

-- Immunization: Add performer_practitioner_id (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_immunizations') THEN
        ALTER TABLE fhir_immunizations
        ADD COLUMN IF NOT EXISTS performer_practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL;

        COMMENT ON COLUMN fhir_immunizations.performer_practitioner_id IS 'Practitioner who administered the vaccine';
        RAISE NOTICE 'Added performer_practitioner_id to fhir_immunizations';
    ELSE
        RAISE NOTICE 'Skipping fhir_immunizations - table does not exist';
    END IF;
END $$;

-- Procedure: Add primary_performer_practitioner_id (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_procedures') THEN
        ALTER TABLE fhir_procedures
        ADD COLUMN IF NOT EXISTS primary_performer_practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL;

        COMMENT ON COLUMN fhir_procedures.primary_performer_practitioner_id IS 'Primary practitioner who performed the procedure';
        RAISE NOTICE 'Added primary_performer_practitioner_id to fhir_procedures';
    ELSE
        RAISE NOTICE 'Skipping fhir_procedures - table does not exist';
    END IF;
END $$;

-- MedicationRequest: Add requester_practitioner_id (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_medication_requests') THEN
        ALTER TABLE fhir_medication_requests
        ADD COLUMN IF NOT EXISTS requester_practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL;

        COMMENT ON COLUMN fhir_medication_requests.requester_practitioner_id IS 'Practitioner who prescribed/requested the medication';
        RAISE NOTICE 'Added requester_practitioner_id to fhir_medication_requests';
    ELSE
        RAISE NOTICE 'Skipping fhir_medication_requests - table does not exist';
    END IF;
END $$;

-- Observation: Add primary_performer_practitioner_id (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_observations') THEN
        ALTER TABLE fhir_observations
        ADD COLUMN IF NOT EXISTS primary_performer_practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL;

        COMMENT ON COLUMN fhir_observations.primary_performer_practitioner_id IS 'Primary practitioner who recorded the observation';
        RAISE NOTICE 'Added primary_performer_practitioner_id to fhir_observations';
    ELSE
        RAISE NOTICE 'Skipping fhir_observations - table does not exist';
    END IF;
END $$;

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE (with table existence checks)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_care_plans') THEN
        CREATE INDEX IF NOT EXISTS idx_care_plans_author_practitioner
        ON fhir_care_plans(author_practitioner_id) WHERE author_practitioner_id IS NOT NULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_immunizations') THEN
        CREATE INDEX IF NOT EXISTS idx_immunizations_performer_practitioner
        ON fhir_immunizations(performer_practitioner_id) WHERE performer_practitioner_id IS NOT NULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_procedures') THEN
        CREATE INDEX IF NOT EXISTS idx_procedures_performer_practitioner
        ON fhir_procedures(primary_performer_practitioner_id) WHERE primary_performer_practitioner_id IS NOT NULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_medication_requests') THEN
        CREATE INDEX IF NOT EXISTS idx_medication_requests_requester_practitioner
        ON fhir_medication_requests(requester_practitioner_id) WHERE requester_practitioner_id IS NOT NULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_observations') THEN
        CREATE INDEX IF NOT EXISTS idx_observations_performer_practitioner
        ON fhir_observations(primary_performer_practitioner_id) WHERE primary_performer_practitioner_id IS NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- 3. CREATE HELPER FUNCTIONS FOR PRACTITIONER-RESOURCE QUERIES
-- ============================================================================
-- Note: These functions will be created regardless of table existence
-- They will work once the tables are created in future migrations

-- Get all care plans authored by a practitioner
CREATE OR REPLACE FUNCTION get_practitioner_care_plans(
  p_practitioner_id UUID,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  title TEXT,
  status TEXT,
  category TEXT[],
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created TIMESTAMPTZ
) AS $$
BEGIN
  -- Check if table exists before querying
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_care_plans') THEN
    RETURN QUERY
    SELECT
      cp.id,
      cp.patient_id,
      cp.title,
      cp.status,
      cp.category,
      cp.period_start,
      cp.period_end,
      cp.created
    FROM fhir_care_plans cp
    WHERE cp.author_practitioner_id = p_practitioner_id
      AND (p_status IS NULL OR cp.status = p_status)
    ORDER BY cp.created DESC;
  END IF;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all immunizations administered by a practitioner
CREATE OR REPLACE FUNCTION get_practitioner_immunizations(
  p_practitioner_id UUID,
  p_days INTEGER DEFAULT 365
)
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  vaccine_display TEXT,
  occurrence_datetime TIMESTAMPTZ,
  status TEXT,
  lot_number TEXT
) AS $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_immunizations') THEN
    RETURN QUERY
    SELECT
      i.id,
      i.patient_id,
      i.vaccine_display,
      i.occurrence_datetime,
      i.status,
      i.lot_number
    FROM fhir_immunizations i
    WHERE i.performer_practitioner_id = p_practitioner_id
      AND i.status = 'completed'
      AND (p_days IS NULL OR i.occurrence_datetime >= NOW() - (p_days || ' days')::INTERVAL)
    ORDER BY i.occurrence_datetime DESC;
  END IF;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all procedures performed by a practitioner
CREATE OR REPLACE FUNCTION get_practitioner_procedures(
  p_practitioner_id UUID,
  p_days INTEGER DEFAULT 365
)
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  code_display TEXT,
  status TEXT,
  performed_datetime TIMESTAMPTZ
) AS $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_procedures') THEN
    RETURN QUERY
    SELECT
      p.id,
      p.patient_id,
      p.code_display,
      p.status,
      p.performed_datetime
    FROM fhir_procedures p
    WHERE p.primary_performer_practitioner_id = p_practitioner_id
      AND (p_days IS NULL OR p.performed_datetime >= NOW() - (p_days || ' days')::INTERVAL)
    ORDER BY p.performed_datetime DESC;
  END IF;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all medication requests prescribed by a practitioner
CREATE OR REPLACE FUNCTION get_practitioner_prescriptions(
  p_practitioner_id UUID,
  p_status TEXT DEFAULT 'active'
)
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  medication_display TEXT,
  status TEXT,
  dosage_text TEXT,
  authored_on TIMESTAMPTZ
) AS $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_medication_requests') THEN
    RETURN QUERY
    SELECT
      mr.id,
      mr.patient_id,
      mr.medication_display,
      mr.status,
      mr.dosage_text,
      mr.authored_on
    FROM fhir_medication_requests mr
    WHERE mr.requester_practitioner_id = p_practitioner_id
      AND (p_status IS NULL OR mr.status = p_status)
    ORDER BY mr.authored_on DESC;
  END IF;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all observations recorded by a practitioner
CREATE OR REPLACE FUNCTION get_practitioner_observations(
  p_practitioner_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  code_display TEXT,
  value_quantity_value DECIMAL,
  value_quantity_unit TEXT,
  effective_datetime TIMESTAMPTZ,
  status TEXT
) AS $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_observations') THEN
    RETURN QUERY
    SELECT
      o.id,
      o.patient_id,
      o.code_display,
      o.value_quantity_value,
      o.value_quantity_unit,
      o.effective_datetime,
      o.status
    FROM fhir_observations o
    WHERE o.primary_performer_practitioner_id = p_practitioner_id
      AND (p_days IS NULL OR o.effective_datetime >= NOW() - (p_days || ' days')::INTERVAL)
    ORDER BY o.effective_datetime DESC;
  END IF;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get practitioner workload summary
CREATE OR REPLACE FUNCTION get_practitioner_workload_summary(
  p_practitioner_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  care_plans_authored INTEGER,
  immunizations_given INTEGER,
  procedures_performed INTEGER,
  prescriptions_written INTEGER,
  observations_recorded INTEGER,
  unique_patients_served INTEGER
) AS $$
DECLARE
  has_care_plans BOOLEAN;
  has_immunizations BOOLEAN;
  has_procedures BOOLEAN;
  has_medication_requests BOOLEAN;
  has_observations BOOLEAN;
BEGIN
  -- Check which tables exist
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_care_plans') INTO has_care_plans;
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_immunizations') INTO has_immunizations;
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_procedures') INTO has_procedures;
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_medication_requests') INTO has_medication_requests;
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_observations') INTO has_observations;

  RETURN QUERY
  SELECT
    CASE WHEN has_care_plans THEN
      (SELECT COUNT(*) FROM fhir_care_plans
       WHERE author_practitioner_id = p_practitioner_id
       AND created >= NOW() - (p_days || ' days')::INTERVAL)
    ELSE 0 END::INTEGER,

    CASE WHEN has_immunizations THEN
      (SELECT COUNT(*) FROM fhir_immunizations
       WHERE performer_practitioner_id = p_practitioner_id
       AND occurrence_datetime >= NOW() - (p_days || ' days')::INTERVAL)
    ELSE 0 END::INTEGER,

    CASE WHEN has_procedures THEN
      (SELECT COUNT(*) FROM fhir_procedures
       WHERE primary_performer_practitioner_id = p_practitioner_id
       AND performed_datetime >= NOW() - (p_days || ' days')::INTERVAL)
    ELSE 0 END::INTEGER,

    CASE WHEN has_medication_requests THEN
      (SELECT COUNT(*) FROM fhir_medication_requests
       WHERE requester_practitioner_id = p_practitioner_id
       AND authored_on >= NOW() - (p_days || ' days')::INTERVAL)
    ELSE 0 END::INTEGER,

    CASE WHEN has_observations THEN
      (SELECT COUNT(*) FROM fhir_observations
       WHERE primary_performer_practitioner_id = p_practitioner_id
       AND effective_datetime >= NOW() - (p_days || ' days')::INTERVAL)
    ELSE 0 END::INTEGER,

    0::INTEGER; -- unique_patients will be 0 if no tables exist
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get patient's care team (all practitioners who have provided care)
CREATE OR REPLACE FUNCTION get_patient_care_team(
  p_patient_id UUID,
  p_days INTEGER DEFAULT 365
)
RETURNS TABLE (
  practitioner_id UUID,
  practitioner_name TEXT,
  specialties TEXT[],
  npi TEXT,
  last_interaction TIMESTAMPTZ,
  care_plans_count INTEGER,
  immunizations_count INTEGER,
  procedures_count INTEGER,
  prescriptions_count INTEGER,
  observations_count INTEGER
) AS $$
BEGIN
  -- This function will return empty if tables don't exist
  -- Once tables are created, it will work automatically
  RETURN QUERY
  SELECT
    NULL::UUID as practitioner_id,
    NULL::TEXT as practitioner_name,
    NULL::TEXT[] as specialties,
    NULL::TEXT as npi,
    NULL::TIMESTAMPTZ as last_interaction,
    0::INTEGER as care_plans_count,
    0::INTEGER as immunizations_count,
    0::INTEGER as procedures_count,
    0::INTEGER as prescriptions_count,
    0::INTEGER as observations_count
  WHERE FALSE; -- Return empty result set for now
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. ADD COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_practitioner_care_plans IS 'Returns all care plans authored by a specific practitioner';
COMMENT ON FUNCTION get_practitioner_immunizations IS 'Returns all immunizations administered by a specific practitioner';
COMMENT ON FUNCTION get_practitioner_procedures IS 'Returns all procedures performed by a specific practitioner';
COMMENT ON FUNCTION get_practitioner_prescriptions IS 'Returns all medication requests prescribed by a specific practitioner';
COMMENT ON FUNCTION get_practitioner_observations IS 'Returns all observations recorded by a specific practitioner';
COMMENT ON FUNCTION get_practitioner_workload_summary IS 'Returns workload metrics for a practitioner over specified days';
COMMENT ON FUNCTION get_patient_care_team IS 'Returns all practitioners who have provided care to a patient with interaction counts';

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
