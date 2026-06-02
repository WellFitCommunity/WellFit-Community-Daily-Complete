-- Regenerates the column snapshot consumed by scripts/check-fhir-service-schema.py.
--
-- The schema gate runs in CI, which has NO live-DB credentials, so it diffs service
-- SELECT lists against a committed snapshot instead of the live DB. Run this after ANY
-- migration that adds/drops/renames a fhir_* column or table, then paste the result into
-- the "tables" object of scripts/fhir-schema-snapshot.json (and bump _meta.generated).
--
-- How to run: Supabase MCP execute_sql, the SQL editor, or psql against the live project
-- (xkybsjnvuohpqpbkikyn). Returns a single JSON object: { "fhir_x": ["col1", ...], ... }.

SELECT json_object_agg(table_name, cols ORDER BY table_name) AS snapshot
FROM (
  SELECT table_name, json_agg(column_name ORDER BY ordinal_position) AS cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name LIKE 'fhir\_%'
  GROUP BY table_name
) t;
