-- Create fhir_encounters view to fix naming mismatch
-- Issue: Code references fhir_encounters but table is named encounters
-- This view provides backwards compatibility

-- Drop table or view if exists (try table first, then view)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fhir_encounters') THEN
    EXECUTE 'DROP TABLE public.fhir_encounters CASCADE';
  ELSIF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'fhir_encounters') THEN
    EXECUTE 'DROP VIEW public.fhir_encounters CASCADE';
  END IF;
END
$$;

-- Create view pointing to encounters table
CREATE VIEW fhir_encounters AS
SELECT * FROM encounters;

-- Grant permissions
GRANT SELECT ON fhir_encounters TO authenticated;
GRANT SELECT ON fhir_encounters TO anon;

-- Add comment
COMMENT ON VIEW fhir_encounters IS 'Compatibility view for encounters table - some code references fhir_encounters';
