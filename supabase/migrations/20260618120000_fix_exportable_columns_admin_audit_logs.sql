-- Fix get_exportable_columns allowlist: admin_audit_log (singular) does not
-- exist live — the real admin-action audit table is admin_audit_logs (plural,
-- created in 20251015120000_claude_billing_monitoring.sql). The singular name
-- was drift (its CREATEs in 20251111/20251202 were superseded). With the
-- singular name allowlisted, the bulk-export "audit_logs" data path threw
-- (array_agg over a nonexistent table → empty → resolveSelectColumns error).
-- Repoint the allowlist entry to the live plural table so the export resolves
-- the real column set. Function body otherwise unchanged.
CREATE OR REPLACE FUNCTION public.get_exportable_columns(p_table text)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed CONSTANT TEXT[] := ARRAY[
    'check_ins', 'ai_risk_assessments', 'profiles', 'claims',
    'encounters', 'admin_audit_logs', 'self_reports'
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
