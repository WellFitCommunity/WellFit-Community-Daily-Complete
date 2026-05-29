-- ============================================================================
-- bulk-export repair foundation: export_jobs columns + dynamic-column RPC
-- ============================================================================
--
-- (1) bulk-export/index.ts has been writing six columns that do not exist on
--     export_jobs, so the job-creation INSERT failed and the exporter was
--     non-functional. Live columns (2026-05-29) were:
--       id, user_id, export_type, export_format, filters, status, file_path,
--       file_size, started_at, completed_at, error_message, created_at,
--       tenant_id, sha256_hex, integrity_algorithm
--     This adds the missing progress-tracking / expiry / download-url / requester
--     columns the code expects (Maria's call: make the code's features work).
--
-- (2) get_exportable_columns(): the bulk/ccda exporters resolve their SELECT
--     column lists at runtime (instead of SELECT *) so exports stay complete on
--     schema changes AND avoid the literal '*' the pre-commit gate forbids.
--     PostgREST cannot read information_schema directly, so this RPC exposes the
--     column names for a fixed allowlist of export tables only.
-- ============================================================================

BEGIN;

-- 1. Missing export_jobs columns ---------------------------------------------
ALTER TABLE public.export_jobs ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.export_jobs ADD COLUMN IF NOT EXISTS total_records INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.export_jobs ADD COLUMN IF NOT EXISTS processed_records INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.export_jobs ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.export_jobs ADD COLUMN IF NOT EXISTS download_url TEXT;
ALTER TABLE public.export_jobs ADD COLUMN IF NOT EXISTS requested_by UUID;

COMMENT ON COLUMN public.export_jobs.progress IS 'Percent complete (0-100) for the background export job.';
COMMENT ON COLUMN public.export_jobs.download_url IS 'Signed download URL for the finished export (time-limited).';
COMMENT ON COLUMN public.export_jobs.requested_by IS 'auth.users.id of the admin who requested the export (audit).';

-- 2. Dynamic export column resolver ------------------------------------------
CREATE OR REPLACE FUNCTION public.get_exportable_columns(p_table TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed CONSTANT TEXT[] := ARRAY[
    'check_ins', 'ai_risk_assessments', 'profiles', 'claims',
    'encounters', 'admin_audit_log', 'self_reports'
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
$$;

REVOKE EXECUTE ON FUNCTION public.get_exportable_columns(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exportable_columns(TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_exportable_columns IS
  'Returns the public column names for an allowlisted export table (ordinal order). Backs runtime SELECT-column resolution in bulk-export/ccda-export so exports stay complete without a literal SELECT *. SECURITY DEFINER, locked search_path.';

COMMIT;
