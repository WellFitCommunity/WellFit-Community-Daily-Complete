-- =====================================================
-- Add Unique Constraints for FHIR External IDs
-- Prevents duplicate imports from Epic/Cerner/Allscripts
-- =====================================================

-- Unique constraint for fhir_immunizations external sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_fhir_immunizations_external_unique
  ON fhir_immunizations(external_id, external_system)
  WHERE external_id IS NOT NULL AND external_system IS NOT NULL;

-- Unique constraint for fhir_care_plans external sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_fhir_care_plans_external_unique
  ON fhir_care_plans(external_id, external_system)
  WHERE external_id IS NOT NULL AND external_system IS NOT NULL;

-- Comments
COMMENT ON INDEX idx_fhir_immunizations_external_unique IS 'Prevents duplicate immunization imports from external FHIR systems (Epic/Cerner)';
COMMENT ON INDEX idx_fhir_care_plans_external_unique IS 'Prevents duplicate care plan imports from external FHIR systems (Epic/Cerner)';
