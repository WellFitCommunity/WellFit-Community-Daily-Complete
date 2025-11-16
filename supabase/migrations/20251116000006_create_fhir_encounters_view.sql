-- Create fhir_encounters view to fix naming mismatch
-- Issue: Code references fhir_encounters but table is named encounters
-- This view provides backwards compatibility

-- Drop view if it exists
DROP VIEW IF EXISTS fhir_encounters;

-- Create view pointing to encounters table
CREATE VIEW fhir_encounters AS
SELECT * FROM encounters;

-- Grant permissions
GRANT SELECT ON fhir_encounters TO authenticated;
GRANT SELECT ON fhir_encounters TO anon;

-- Add comment
COMMENT ON VIEW fhir_encounters IS 'Compatibility view for encounters table - some code references fhir_encounters';
