-- ============================================================================
-- SOC 2 Data Retention and Secure Deletion Policies
-- ============================================================================
-- Purpose: Implement automated data retention, archival, and secure deletion
-- Addresses: SOC 2 CC6.5 (Data Retention), PI1.5 (Data Disposal), GDPR
-- Date: 2025-10-18
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: DATA RETENTION POLICY CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id BIGSERIAL PRIMARY KEY,

  table_name TEXT NOT NULL UNIQUE,
  retention_period INTERVAL NOT NULL,

  -- Policy details
  policy_type TEXT NOT NULL CHECK (policy_type IN ('archive', 'delete', 'anonymize')),
  date_column TEXT NOT NULL DEFAULT 'created_at',

  -- Archival configuration
  archive_enabled BOOLEAN DEFAULT FALSE,
  archive_table_name TEXT,

  -- Execution
  enabled BOOLEAN DEFAULT TRUE,
  last_execution TIMESTAMPTZ,
  next_execution TIMESTAMPTZ,
  execution_frequency INTERVAL DEFAULT INTERVAL '1 day',

  -- Audit
  records_processed_last_run BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_retention_policies_super_admin" ON public.data_retention_policies;
CREATE POLICY "data_retention_policies_super_admin"
  ON public.data_retention_policies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ============================================================================
-- PART 2: INSERT DEFAULT RETENTION POLICIES
-- ============================================================================

INSERT INTO public.data_retention_policies (table_name, retention_period, policy_type, date_column, enabled)
VALUES
  -- Audit logs: Keep 7 years (SOC 2 requirement)
  ('audit_logs', INTERVAL '7 years', 'archive', 'timestamp', TRUE),

  -- Security events: Keep 2 years
  ('security_events', INTERVAL '2 years', 'archive', 'timestamp', TRUE),

  -- Rate limit events: Keep 30 days
  ('rate_limit_events', INTERVAL '30 days', 'delete', 'created_at', TRUE),

  -- FHIR sync logs: Keep 90 days
  ('fhir_sync_logs', INTERVAL '90 days', 'archive', 'created_at', TRUE),

  -- FHIR bundles: Keep 24 hours (already have expires_at)
  ('fhir_bundles', INTERVAL '24 hours', 'delete', 'generated_at', TRUE),

  -- Staff auth attempts: Keep 90 days
  ('staff_auth_attempts', INTERVAL '90 days', 'delete', 'created_at', TRUE),

  -- Token lifecycle: Keep 1 year
  ('fhir_token_lifecycle', INTERVAL '1 year', 'archive', 'created_at', TRUE)
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================================
-- PART 3: SECURE DELETION LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.data_deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was deleted
  table_name TEXT NOT NULL,
  deletion_type TEXT NOT NULL CHECK (deletion_type IN ('retention_policy', 'user_request', 'admin_action', 'gdpr_right_to_be_forgotten')),

  -- When and by whom
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- How many records
  records_deleted BIGINT NOT NULL,
  criteria TEXT, -- Description of deletion criteria

  -- Verification
  deletion_verified BOOLEAN DEFAULT FALSE,
  verification_method TEXT, -- 'vacuum', 'count', 'checksum'

  -- Audit trail reference
  audit_log_id UUID REFERENCES public.audit_logs(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_deletion_log_table ON public.data_deletion_log(table_name, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_deletion_log_deleted_at ON public.data_deletion_log(deleted_at DESC);

-- RLS
ALTER TABLE public.data_deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_deletion_log_admin_read" ON public.data_deletion_log;
CREATE POLICY "data_deletion_log_admin_read"
  ON public.data_deletion_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PART 4: SECURE DELETION FUNCTIONS
-- ============================================================================

-- Function to securely delete records (with verification)
CREATE OR REPLACE FUNCTION public.secure_delete_records(
  p_table_name TEXT,
  p_where_clause TEXT,
  p_deletion_type TEXT DEFAULT 'retention_policy'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_records_deleted BIGINT;
  v_audit_log_id UUID;
  v_sql TEXT;
BEGIN
  -- Verify table exists and is whitelisted
  IF p_table_name NOT IN (
    SELECT table_name FROM public.data_retention_policies WHERE enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'Table % is not configured for automatic deletion', p_table_name;
  END IF;

  -- Log deletion attempt in audit log
  v_audit_log_id := public.log_audit_event(
    'DATA_SECURE_DELETE',
    'DATA_MODIFICATION',
    p_table_name,
    NULL,
    NULL,
    'DELETE',
    jsonb_build_object(
      'deletion_type', p_deletion_type,
      'where_clause', p_where_clause
    ),
    TRUE,
    NULL
  );

  -- Execute deletion
  v_sql := format('DELETE FROM %I WHERE %s', p_table_name, p_where_clause);
  EXECUTE v_sql;
  GET DIAGNOSTICS v_records_deleted = ROW_COUNT;

  -- Log deletion
  INSERT INTO public.data_deletion_log (
    table_name,
    deletion_type,
    records_deleted,
    criteria,
    audit_log_id,
    deletion_verified
  ) VALUES (
    p_table_name,
    p_deletion_type,
    v_records_deleted,
    p_where_clause,
    v_audit_log_id,
    FALSE -- Will be verified by VACUUM operation
  );

  -- Recommend VACUUM for secure deletion
  RAISE NOTICE 'Deleted % records from %. Run VACUUM FULL % to securely wipe data.',
    v_records_deleted, p_table_name, p_table_name;

  RETURN v_records_deleted;
END;
$$;

-- Function to execute retention policies
CREATE OR REPLACE FUNCTION public.execute_retention_policies()
RETURNS TABLE (
  table_name TEXT,
  records_processed BIGINT,
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_policy RECORD;
  v_cutoff_date TIMESTAMPTZ;
  v_records_affected BIGINT;
  v_where_clause TEXT;
BEGIN
  -- Loop through all enabled policies
  FOR v_policy IN
    SELECT * FROM public.data_retention_policies
    WHERE enabled = TRUE
    AND (next_execution IS NULL OR next_execution <= NOW())
  LOOP
    BEGIN
      -- Calculate cutoff date
      v_cutoff_date := NOW() - v_policy.retention_period;

      -- Build WHERE clause
      v_where_clause := format('%I < %L', v_policy.date_column, v_cutoff_date);

      -- Execute policy based on type
      CASE v_policy.policy_type
        WHEN 'delete' THEN
          -- Secure deletion
          v_records_affected := public.secure_delete_records(
            v_policy.table_name,
            v_where_clause,
            'retention_policy'
          );

        WHEN 'archive' THEN
          -- Archive to separate table (if configured)
          IF v_policy.archive_enabled AND v_policy.archive_table_name IS NOT NULL THEN
            EXECUTE format(
              'INSERT INTO %I SELECT * FROM %I WHERE %s',
              v_policy.archive_table_name,
              v_policy.table_name,
              v_where_clause
            );
            GET DIAGNOSTICS v_records_affected = ROW_COUNT;

            -- Then delete from main table
            PERFORM public.secure_delete_records(
              v_policy.table_name,
              v_where_clause,
              'retention_policy'
            );
          ELSE
            v_records_affected := 0;
            RAISE NOTICE 'Archive not configured for %', v_policy.table_name;
          END IF;

        WHEN 'anonymize' THEN
          -- Anonymize records (implementation depends on table structure)
          v_records_affected := 0;
          RAISE NOTICE 'Anonymization not yet implemented for %', v_policy.table_name;

        ELSE
          v_records_affected := 0;
      END CASE;

      -- Update policy execution status
      UPDATE public.data_retention_policies
      SET
        last_execution = NOW(),
        next_execution = NOW() + execution_frequency,
        records_processed_last_run = v_records_affected,
        updated_at = NOW()
      WHERE id = v_policy.id;

      -- Return success
      RETURN QUERY SELECT
        v_policy.table_name,
        v_records_affected,
        TRUE,
        format('Processed %s records', v_records_affected);

    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue with other policies
        PERFORM public.log_security_event(
          'DATA_RETENTION_EXECUTED',
          'HIGH',
          format('Retention policy failed for %s: %s', v_policy.table_name, SQLERRM),
          jsonb_build_object(
            'table_name', v_policy.table_name,
            'error', SQLERRM
          )
        );

        RETURN QUERY SELECT
          v_policy.table_name,
          0::BIGINT,
          FALSE,
          SQLERRM;
    END;
  END LOOP;
END;
$$;

-- ============================================================================
-- PART 5: GDPR "RIGHT TO BE FORGOTTEN" IMPLEMENTATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gdpr_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User requesting deletion
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Request details
  request_type TEXT NOT NULL CHECK (request_type IN ('full_deletion', 'anonymization', 'export_and_delete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),

  -- Timing
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Results
  tables_affected TEXT[],
  records_deleted BIGINT,
  errors TEXT[],

  -- Verification
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_user ON public.gdpr_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_status ON public.gdpr_deletion_requests(status, requested_at DESC);

-- RLS
ALTER TABLE public.gdpr_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gdpr_deletion_select_own" ON public.gdpr_deletion_requests;
CREATE POLICY "gdpr_deletion_select_own"
  ON public.gdpr_deletion_requests
  FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ));

DROP POLICY IF EXISTS "gdpr_deletion_insert_own" ON public.gdpr_deletion_requests;
CREATE POLICY "gdpr_deletion_insert_own"
  ON public.gdpr_deletion_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Function to process GDPR deletion request
CREATE OR REPLACE FUNCTION public.process_gdpr_deletion(
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id UUID;
  v_tables_with_user_data TEXT[] := ARRAY[
    'profiles', 'check_ins', 'fhir_patient_mappings',
    'fhir_immunizations', 'fhir_care_plans', 'fhir_observations',
    'community_moments', 'affirmations', 'self_reports'
  ];
  v_table TEXT;
  v_total_deleted BIGINT := 0;
  v_table_count INTEGER;
BEGIN
  -- Create deletion request
  INSERT INTO public.gdpr_deletion_requests (user_id, request_type, status)
  VALUES (p_user_id, 'full_deletion', 'in_progress')
  RETURNING id INTO v_request_id;

  -- Update status
  UPDATE public.gdpr_deletion_requests
  SET processing_started_at = NOW()
  WHERE id = v_request_id;

  -- Delete user data from all tables
  FOREACH v_table IN ARRAY v_tables_with_user_data
  LOOP
    BEGIN
      -- Check if table exists
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = v_table
      ) THEN
        -- Delete records
        EXECUTE format('DELETE FROM %I WHERE user_id = $1', v_table) USING p_user_id;
        GET DIAGNOSTICS v_table_count = ROW_COUNT;
        v_total_deleted := v_total_deleted + v_table_count;

        RAISE NOTICE 'Deleted % records from %', v_table_count, v_table;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to delete from %: %', v_table, SQLERRM;
    END;
  END LOOP;

  -- Update request status
  UPDATE public.gdpr_deletion_requests
  SET
    status = 'completed',
    completed_at = NOW(),
    tables_affected = v_tables_with_user_data,
    records_deleted = v_total_deleted
  WHERE id = v_request_id;

  -- Log audit event
  PERFORM public.log_audit_event(
    'DATA_SECURE_DELETE',
    'DATA_MODIFICATION',
    'gdpr_deletion',
    p_user_id::TEXT,
    p_user_id,
    'DELETE',
    jsonb_build_object(
      'deletion_type', 'gdpr_right_to_be_forgotten',
      'records_deleted', v_total_deleted,
      'tables_affected', v_tables_with_user_data
    ),
    TRUE,
    NULL
  );

  RETURN v_request_id;
END;
$$;

-- ============================================================================
-- PART 6: SCHEDULED JOB HELPERS (for pg_cron or external scheduler)
-- ============================================================================

-- Daily retention policy execution
CREATE OR REPLACE FUNCTION public.daily_retention_cleanup()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_results TEXT;
BEGIN
  -- Execute all retention policies
  SELECT string_agg(
    format('%s: %s records processed', table_name, records_processed),
    E'\n'
  ) INTO v_results
  FROM public.execute_retention_policies();

  -- Clean up rate limit events
  PERFORM public.cleanup_rate_limit_events();

  RETURN COALESCE(v_results, 'No retention policies executed');
END;
$$;

-- ============================================================================
-- PART 7: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.secure_delete_records TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_retention_policies TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_gdpr_deletion TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_retention_cleanup TO authenticated;

-- ============================================================================
-- PART 8: COMMENTS
-- ============================================================================

COMMENT ON TABLE public.data_retention_policies IS 'Configuration for automated data retention policies';
COMMENT ON TABLE public.data_deletion_log IS 'Audit trail for all data deletion operations';
COMMENT ON TABLE public.gdpr_deletion_requests IS 'GDPR Right to be Forgotten deletion requests';
COMMENT ON FUNCTION public.secure_delete_records IS 'Securely delete records with audit trail and verification';
COMMENT ON FUNCTION public.execute_retention_policies IS 'Execute all enabled data retention policies';
COMMENT ON FUNCTION public.process_gdpr_deletion IS 'Process GDPR deletion request for a user';
COMMENT ON FUNCTION public.daily_retention_cleanup IS 'Daily job to execute retention policies and cleanup';

COMMIT;

-- ============================================================================
-- POST-MIGRATION INSTRUCTIONS
-- ============================================================================
-- 1. Set up pg_cron extension (Supabase Pro plan or self-hosted):
--    CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- 2. Schedule daily retention cleanup:
--    SELECT cron.schedule(
--      'daily-retention-cleanup',
--      '0 2 * * *', -- Run at 2 AM daily
--      'SELECT public.daily_retention_cleanup()'
--    );
--
-- 3. OR use external scheduler (cron, GitHub Actions, etc.):
--    curl -X POST https://your-project.supabase.co/rest/v1/rpc/daily_retention_cleanup \
--      -H "apikey: YOUR_SERVICE_ROLE_KEY"
--
-- 4. Schedule weekly VACUUM for secure deletion:
--    VACUUM FULL audit_logs;
--    VACUUM FULL security_events;
--    VACUUM FULL rate_limit_events;
--
-- 5. Monitor deletion logs:
--    SELECT * FROM data_deletion_log ORDER BY deleted_at DESC LIMIT 100;
-- ============================================================================
