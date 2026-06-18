-- Expand get_exportable_columns allowlist to cover the full EHI export set used
-- by user-data-management/exportUserData (21st Century Cures Act / GDPR full
-- data export). That function previously used literal SELECT * on 20 tables
-- (forbidden by .claude/rules/supabase.md §9); it now uses the runtime
-- resolveSelectColumns() resolver (same pattern as bulk-export/ccda-export),
-- which keeps the federal export COMPLETE on schema changes without a literal *.
-- The resolver only returns column NAMES from information_schema; it does not
-- decrypt or widen what the (already service-role) caller can read. All 18 new
-- tables were verified to exist live before authoring (col_count > 0 each).
-- profiles + encounters were already allowlisted.
CREATE OR REPLACE FUNCTION public.get_exportable_columns(p_table text)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed CONSTANT TEXT[] := ARRAY[
    -- bulk-export set
    'check_ins', 'ai_risk_assessments', 'profiles', 'claims',
    'encounters', 'admin_audit_logs', 'self_reports',
    -- user-data-management EHI export set
    'check_ins_decrypted', 'community_moments', 'alerts', 'medications',
    'fhir_medication_requests', 'allergy_intolerances', 'fhir_conditions',
    'fhir_procedures', 'fhir_immunizations', 'fhir_observations', 'lab_results',
    'fhir_diagnostic_reports', 'clinical_notes', 'fhir_care_plans',
    'fhir_care_teams', 'fhir_goals', 'sdoh_assessments', 'fhir_provenance'
  ];
  v_cols TEXT[];
BEGIN
  -- Allowlist only: callers cannot introspect arbitrary tables.
  IF NOT (p_table = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'TABLE_NOT_EXPORTABLE: % is not an allowed export table', p_table;
  END IF;

  SELECT array_agg(column_name::text ORDER BY ordinal_position)
  INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table;

  RETURN COALESCE(v_cols, ARRAY[]::TEXT[]);
END;
$function$;
