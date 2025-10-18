-- ============================================================================
-- INTEGRATE PRACTITIONER REFERENCES ACROSS ALL FHIR RESOURCES
-- ============================================================================
-- This migration adds practitioner_id foreign key columns to all FHIR resources
-- that need to reference practitioners (doctors, nurses, etc.)
--
-- Tables Updated:
-- - fhir_care_plans (author = practitioner who created the plan)
-- - fhir_immunizations (performer = practitioner who administered vaccine)
-- - fhir_procedures (performer = practitioner who performed procedure)
-- - fhir_medication_requests (requester = practitioner who prescribed)
-- - fhir_observations (performer = practitioner who recorded observation)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD PRACTITIONER_ID COLUMNS
-- ============================================================================

-- CarePlan: Add author_practitioner_id
ALTER TABLE fhir_care_plans
ADD COLUMN IF NOT EXISTS author_practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL;

COMMENT ON COLUMN fhir_care_plans.author_practitioner_id IS 'Practitioner who authored/created this care plan';

-- Immunization: Add performer_practitioner_id
ALTER TABLE fhir_immunizations
ADD COLUMN IF NOT EXISTS performer_practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL;

COMMENT ON COLUMN fhir_immunizations.performer_practitioner_id IS 'Practitioner who administered the vaccine';

-- Procedure: Add primary_performer_practitioner_id
-- Note: Procedures can have multiple performers, but we add a primary one for convenience
ALTER TABLE fhir_procedures
ADD COLUMN IF NOT EXISTS primary_performer_practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL;

COMMENT ON COLUMN fhir_procedures.primary_performer_practitioner_id IS 'Primary practitioner who performed the procedure';

-- MedicationRequest: Add requester_practitioner_id
ALTER TABLE fhir_medication_requests
ADD COLUMN IF NOT EXISTS requester_practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL;

COMMENT ON COLUMN fhir_medication_requests.requester_practitioner_id IS 'Practitioner who prescribed/requested the medication';

-- Observation: Add primary_performer_practitioner_id
-- Note: Observations can have multiple performers, but we add a primary one for convenience
ALTER TABLE fhir_observations
ADD COLUMN IF NOT EXISTS primary_performer_practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL;

COMMENT ON COLUMN fhir_observations.primary_performer_practitioner_id IS 'Primary practitioner who recorded the observation';

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_care_plans_author_practitioner
ON fhir_care_plans(author_practitioner_id) WHERE author_practitioner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_immunizations_performer_practitioner
ON fhir_immunizations(performer_practitioner_id) WHERE performer_practitioner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_procedures_performer_practitioner
ON fhir_procedures(primary_performer_practitioner_id) WHERE primary_performer_practitioner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_medication_requests_requester_practitioner
ON fhir_medication_requests(requester_practitioner_id) WHERE requester_practitioner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_observations_performer_practitioner
ON fhir_observations(primary_performer_practitioner_id) WHERE primary_performer_practitioner_id IS NOT NULL;

-- ============================================================================
-- 3. CREATE HELPER FUNCTIONS FOR PRACTITIONER-RESOURCE QUERIES
-- ============================================================================

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
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM fhir_care_plans
     WHERE author_practitioner_id = p_practitioner_id
     AND created >= NOW() - (p_days || ' days')::INTERVAL)::INTEGER,

    (SELECT COUNT(*) FROM fhir_immunizations
     WHERE performer_practitioner_id = p_practitioner_id
     AND occurrence_datetime >= NOW() - (p_days || ' days')::INTERVAL)::INTEGER,

    (SELECT COUNT(*) FROM fhir_procedures
     WHERE primary_performer_practitioner_id = p_practitioner_id
     AND performed_datetime >= NOW() - (p_days || ' days')::INTERVAL)::INTEGER,

    (SELECT COUNT(*) FROM fhir_medication_requests
     WHERE requester_practitioner_id = p_practitioner_id
     AND authored_on >= NOW() - (p_days || ' days')::INTERVAL)::INTEGER,

    (SELECT COUNT(*) FROM fhir_observations
     WHERE primary_performer_practitioner_id = p_practitioner_id
     AND effective_datetime >= NOW() - (p_days || ' days')::INTERVAL)::INTEGER,

    (SELECT COUNT(DISTINCT patient_id) FROM (
      SELECT patient_id FROM fhir_care_plans WHERE author_practitioner_id = p_practitioner_id
      UNION
      SELECT patient_id FROM fhir_immunizations WHERE performer_practitioner_id = p_practitioner_id
      UNION
      SELECT patient_id FROM fhir_procedures WHERE primary_performer_practitioner_id = p_practitioner_id
      UNION
      SELECT patient_id FROM fhir_medication_requests WHERE requester_practitioner_id = p_practitioner_id
      UNION
      SELECT patient_id FROM fhir_observations WHERE primary_performer_practitioner_id = p_practitioner_id
    ) AS all_patients)::INTEGER;
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
  RETURN QUERY
  WITH practitioner_interactions AS (
    -- Care plans
    SELECT
      cp.author_practitioner_id as pract_id,
      MAX(cp.created) as last_date,
      COUNT(*) as count_val,
      'care_plan' as resource_type
    FROM fhir_care_plans cp
    WHERE cp.patient_id = p_patient_id
      AND cp.author_practitioner_id IS NOT NULL
      AND cp.created >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY cp.author_practitioner_id

    UNION ALL

    -- Immunizations
    SELECT
      i.performer_practitioner_id,
      MAX(i.occurrence_datetime),
      COUNT(*),
      'immunization'
    FROM fhir_immunizations i
    WHERE i.patient_id = p_patient_id
      AND i.performer_practitioner_id IS NOT NULL
      AND i.occurrence_datetime >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY i.performer_practitioner_id

    UNION ALL

    -- Procedures
    SELECT
      pr.primary_performer_practitioner_id,
      MAX(pr.performed_datetime),
      COUNT(*),
      'procedure'
    FROM fhir_procedures pr
    WHERE pr.patient_id = p_patient_id
      AND pr.primary_performer_practitioner_id IS NOT NULL
      AND pr.performed_datetime >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY pr.primary_performer_practitioner_id

    UNION ALL

    -- Prescriptions
    SELECT
      mr.requester_practitioner_id,
      MAX(mr.authored_on),
      COUNT(*),
      'prescription'
    FROM fhir_medication_requests mr
    WHERE mr.patient_id = p_patient_id
      AND mr.requester_practitioner_id IS NOT NULL
      AND mr.authored_on >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY mr.requester_practitioner_id

    UNION ALL

    -- Observations
    SELECT
      o.primary_performer_practitioner_id,
      MAX(o.effective_datetime),
      COUNT(*),
      'observation'
    FROM fhir_observations o
    WHERE o.patient_id = p_patient_id
      AND o.primary_performer_practitioner_id IS NOT NULL
      AND o.effective_datetime >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY o.primary_performer_practitioner_id
  )
  SELECT
    fp.id,
    (COALESCE(fp.prefix[1] || ' ', '') ||
     fp.given_names[1] || ' ' ||
     fp.family_name ||
     COALESCE(', ' || fp.suffix[1], ''))::TEXT as practitioner_name,
    fp.specialties,
    fp.npi,
    MAX(pi.last_date) as last_interaction,
    COALESCE(SUM(CASE WHEN pi.resource_type = 'care_plan' THEN pi.count_val ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN pi.resource_type = 'immunization' THEN pi.count_val ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN pi.resource_type = 'procedure' THEN pi.count_val ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN pi.resource_type = 'prescription' THEN pi.count_val ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN pi.resource_type = 'observation' THEN pi.count_val ELSE 0 END), 0)::INTEGER
  FROM practitioner_interactions pi
  JOIN fhir_practitioners fp ON fp.id = pi.pract_id
  WHERE fp.active = true
  GROUP BY fp.id, fp.prefix, fp.given_names, fp.family_name, fp.suffix, fp.specialties, fp.npi
  ORDER BY MAX(pi.last_date) DESC;
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
