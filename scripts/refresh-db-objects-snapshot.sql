-- Regenerates scripts/db-objects-snapshot.json (consumed by check-db-reference-drift.py).
-- CI has no live-DB creds, so the gate diffs the committed snapshot. Run this after any
-- migration that adds/drops/renames a public table, view, or function, then replace the
-- "tables"/"functions" arrays in the snapshot (and bump _meta.generated).
--
-- Run via Supabase MCP execute_sql / SQL editor / psql against the live project.
SELECT json_build_object(
  'tables',    (SELECT json_agg(table_name ORDER BY table_name)
                FROM information_schema.tables WHERE table_schema='public'),
  'functions', (SELECT json_agg(DISTINCT proname ORDER BY proname)
                FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
) AS snapshot;
