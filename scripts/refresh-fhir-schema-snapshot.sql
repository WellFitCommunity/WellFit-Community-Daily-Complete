-- Regenerates the column snapshot consumed by scripts/check-fhir-service-schema.py.
--
-- The schema gate runs in CI, which has NO live-DB credentials, so it diffs FHIR
-- SELECT lists / column maps against a committed snapshot instead of the live DB. Run this
-- after ANY migration that adds/drops/renames a column or table the FHIR code references,
-- then paste the result into the "tables" object of scripts/fhir-schema-snapshot.json
-- (and bump _meta.generated + _meta.table_count).
--
-- Coverage = every public.fhir_* table/view PLUS the non-fhir tables the FHIR MCP server +
-- fhir services reference directly. Keep this IN list in sync with those references.
--
-- How to run: Supabase MCP execute_sql, the SQL editor, or psql against the live project
-- (xkybsjnvuohpqpbkikyn). Returns a single JSON object: { "table": ["col1", ...], ... }.

SELECT json_object_agg(table_name, cols ORDER BY table_name) AS snapshot
FROM (
  SELECT table_name, json_agg(column_name ORDER BY ordinal_position) AS cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      table_name LIKE 'fhir\_%'
      OR table_name IN (
        'profiles',              -- FHIR Patient / demographics
        'allergy_intolerances',  -- backing table for the fhir_allergies view
        'ai_progress_notes',     -- backing table for the fhir_document_references view
        'risk_assessments',      -- FHIR RiskAssessment (export_patient_bundle include_ai)
        'drg_grouping_results'   -- referenced by revenue/DRG lookups
      )
    )
  GROUP BY table_name
) t;
