-- ============================================================================
-- SOC 2 Comprehensive Audit Triggers for PHI Access
-- ============================================================================
-- Purpose: Automatic audit logging for all PHI access operations
-- Addresses: SOC 2 CC7.2 (Monitoring), CC7.3 (Audit Logging), HIPAA
-- Date: 2025-10-18
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: GENERIC AUDIT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_phi_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type TEXT;
  v_operation TEXT;
  v_resource_id TEXT;
  v_target_user_id UUID;
  v_metadata JSONB;
BEGIN
  -- Determine operation type
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'PHI_WRITE';
    v_operation := 'INSERT';
    v_resource_id := COALESCE(NEW.id::TEXT, NEW.user_id::TEXT);
    v_target_user_id := NEW.user_id;
    v_metadata := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', 'INSERT'
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'PHI_UPDATE';
    v_operation := 'UPDATE';
    v_resource_id := COALESCE(NEW.id::TEXT, NEW.user_id::TEXT);
    v_target_user_id := NEW.user_id;
    v_metadata := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', 'UPDATE',
      'fields_changed', (
        SELECT jsonb_object_agg(key, TRUE)
        FROM jsonb_each_text(to_jsonb(NEW)) new_row
        JOIN jsonb_each_text(to_jsonb(OLD)) old_row USING (key)
        WHERE new_row.value != old_row.value
      )
    );

  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'PHI_DELETE';
    v_operation := 'DELETE';
    v_resource_id := COALESCE(OLD.id::TEXT, OLD.user_id::TEXT);
    v_target_user_id := OLD.user_id;
    v_metadata := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', 'DELETE'
    );
  END IF;

  -- Log audit event (async - don't block operation)
  PERFORM public.log_audit_event(
    v_event_type,
    'PHI_ACCESS',
    TG_TABLE_NAME,
    v_resource_id,
    v_target_user_id,
    v_operation,
    v_metadata,
    TRUE,
    NULL
  );

  -- Return appropriate row
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Never block operation due to audit logging failure
    RAISE WARNING 'Audit trigger failed for %.%: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
END;
$$;

-- ============================================================================
-- PART 2: ATTACH AUDIT TRIGGERS TO PHI TABLES
-- ============================================================================

-- Profiles table (PHI/PII)
DROP TRIGGER IF EXISTS trigger_audit_profiles ON public.profiles;
CREATE TRIGGER trigger_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_phi_access();

-- Check-ins table (health data)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'check_ins') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_audit_check_ins ON public.check_ins';
    EXECUTE 'CREATE TRIGGER trigger_audit_check_ins
      AFTER INSERT OR UPDATE OR DELETE ON public.check_ins
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_phi_access()';
  END IF;
END $$;

-- FHIR Patient Mappings (PHI)
DROP TRIGGER IF EXISTS trigger_audit_fhir_patient_mappings ON public.fhir_patient_mappings;
CREATE TRIGGER trigger_audit_fhir_patient_mappings
  AFTER INSERT OR UPDATE OR DELETE ON public.fhir_patient_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_phi_access();

-- FHIR Immunizations (PHI)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_immunizations') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_audit_fhir_immunizations ON public.fhir_immunizations';
    EXECUTE 'CREATE TRIGGER trigger_audit_fhir_immunizations
      AFTER INSERT OR UPDATE OR DELETE ON public.fhir_immunizations
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_phi_access()';
  END IF;
END $$;

-- FHIR Care Plans (PHI)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_care_plans') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_audit_fhir_care_plans ON public.fhir_care_plans';
    EXECUTE 'CREATE TRIGGER trigger_audit_fhir_care_plans
      AFTER INSERT OR UPDATE OR DELETE ON public.fhir_care_plans
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_phi_access()';
  END IF;
END $$;

-- FHIR Observations (PHI)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fhir_observations') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_audit_fhir_observations ON public.fhir_observations';
    EXECUTE 'CREATE TRIGGER trigger_audit_fhir_observations
      AFTER INSERT OR UPDATE OR DELETE ON public.fhir_observations
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_phi_access()';
  END IF;
END $$;

-- Lab Results (PHI)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lab_results') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_audit_lab_results ON public.lab_results';
    EXECUTE 'CREATE TRIGGER trigger_audit_lab_results
      AFTER INSERT OR UPDATE OR DELETE ON public.lab_results
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_phi_access()';
  END IF;
END $$;

-- ============================================================================
-- PART 3: AUDIT TRIGGER FOR FHIR CONNECTIONS (CONFIG CHANGES)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_fhir_connection_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type TEXT;
  v_metadata JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'FHIR_CONNECTION_CREATED';
    v_metadata := jsonb_build_object(
      'connection_name', NEW.name,
      'ehr_system', NEW.ehr_system,
      'sync_frequency', NEW.sync_frequency
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'FHIR_CONNECTION_UPDATED';
    v_metadata := jsonb_build_object(
      'connection_name', NEW.name,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'fields_changed', (
        SELECT jsonb_object_agg(key, jsonb_build_object('old', old_row.value, 'new', new_row.value))
        FROM jsonb_each_text(to_jsonb(NEW)) new_row
        JOIN jsonb_each_text(to_jsonb(OLD)) old_row USING (key)
        WHERE new_row.value != old_row.value
        AND key NOT IN ('access_token', 'refresh_token', 'access_token_encrypted', 'refresh_token_encrypted', 'updated_at')
      )
    );

  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'FHIR_CONNECTION_DELETED';
    v_metadata := jsonb_build_object(
      'connection_name', OLD.name,
      'ehr_system', OLD.ehr_system
    );
  END IF;

  PERFORM public.log_audit_event(
    v_event_type,
    'CONFIGURATION',
    'fhir_connections',
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    NULL,
    TG_OP,
    v_metadata,
    TRUE,
    NULL
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_fhir_connections ON public.fhir_connections;
CREATE TRIGGER trigger_audit_fhir_connections
  AFTER INSERT OR UPDATE OR DELETE ON public.fhir_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_fhir_connection_changes();

-- ============================================================================
-- PART 4: AUDIT TRIGGER FOR ROLE CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'ROLE_ASSIGNED';
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'ROLE_REVOKED';
  ELSE
    v_event_type := 'ROLE_MODIFIED';
  END IF;

  PERFORM public.log_audit_event(
    v_event_type,
    'AUTHORIZATION',
    'user_roles',
    COALESCE(NEW.user_id::TEXT, OLD.user_id::TEXT),
    COALESCE(NEW.user_id, OLD.user_id),
    TG_OP,
    jsonb_build_object(
      'role', COALESCE(NEW.role, OLD.role),
      'timestamp', NOW()
    ),
    TRUE,
    NULL
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_user_roles ON public.user_roles;
CREATE TRIGGER trigger_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_role_changes();

-- ============================================================================
-- PART 5: AUDIT LOG INTEGRITY MONITORING
-- ============================================================================

-- Function to detect audit log tampering
CREATE OR REPLACE FUNCTION public.verify_audit_log_integrity(
  p_audit_log_id UUID
)
RETURNS TABLE (
  is_valid BOOLEAN,
  expected_checksum TEXT,
  actual_checksum TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log RECORD;
  v_computed_checksum TEXT;
BEGIN
  -- Get audit log record
  SELECT * INTO v_log
  FROM public.audit_logs
  WHERE id = p_audit_log_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, 'Audit log not found';
    RETURN;
  END IF;

  -- Compute checksum
  v_computed_checksum := encode(
    digest(
      COALESCE(v_log.actor_user_id::TEXT, '') ||
      v_log.event_type ||
      COALESCE(v_log.resource_id, '') ||
      v_log.timestamp::TEXT,
      'sha256'
    ),
    'hex'
  );

  -- Compare
  RETURN QUERY SELECT
    v_log.checksum = v_computed_checksum,
    v_log.checksum,
    v_computed_checksum,
    CASE
      WHEN v_log.checksum = v_computed_checksum THEN 'Integrity verified'
      ELSE 'TAMPERING DETECTED - checksum mismatch'
    END;
END;
$$;

-- Function to verify audit log continuity (no gaps in timestamps)
CREATE OR REPLACE FUNCTION public.detect_audit_log_gaps(
  p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  gap_start TIMESTAMPTZ,
  gap_end TIMESTAMPTZ,
  gap_duration INTERVAL,
  missing_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Detect suspicious gaps in audit logs (>5 minutes with no entries)
  RETURN QUERY
  WITH audit_timeline AS (
    SELECT
      timestamp,
      LEAD(timestamp) OVER (ORDER BY timestamp) AS next_timestamp
    FROM public.audit_logs
    WHERE timestamp BETWEEN p_start_time AND p_end_time
  )
  SELECT
    timestamp AS gap_start,
    next_timestamp AS gap_end,
    next_timestamp - timestamp AS gap_duration,
    0::BIGINT AS missing_count
  FROM audit_timeline
  WHERE next_timestamp - timestamp > INTERVAL '5 minutes'
  ORDER BY gap_duration DESC;
END;
$$;

-- ============================================================================
-- PART 6: AUDIT REPORTING FUNCTIONS
-- ============================================================================

-- Function to get PHI access summary for a user
CREATE OR REPLACE FUNCTION public.get_phi_access_report(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  read_count BIGINT,
  write_count BIGINT,
  update_count BIGINT,
  delete_count BIGINT,
  export_count BIGINT,
  failed_attempts BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins can run this report
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can generate PHI access reports';
  END IF;

  RETURN QUERY
  SELECT
    timestamp::DATE AS date,
    COUNT(*) FILTER (WHERE event_type = 'PHI_READ') AS read_count,
    COUNT(*) FILTER (WHERE event_type = 'PHI_WRITE') AS write_count,
    COUNT(*) FILTER (WHERE event_type = 'PHI_UPDATE') AS update_count,
    COUNT(*) FILTER (WHERE event_type = 'PHI_DELETE') AS delete_count,
    COUNT(*) FILTER (WHERE event_type = 'PHI_EXPORT') AS export_count,
    COUNT(*) FILTER (WHERE success = FALSE) AS failed_attempts
  FROM public.audit_logs
  WHERE actor_user_id = p_user_id
    AND timestamp >= NOW() - (p_days || ' days')::INTERVAL
    AND event_category = 'PHI_ACCESS'
  GROUP BY timestamp::DATE
  ORDER BY date DESC;
END;
$$;

-- Function to get recent security events summary
CREATE OR REPLACE FUNCTION public.get_security_events_summary(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  severity TEXT,
  event_type TEXT,
  event_count BIGINT,
  latest_occurrence TIMESTAMPTZ,
  requires_investigation BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.severity,
    se.event_type,
    COUNT(*) AS event_count,
    MAX(se.timestamp) AS latest_occurrence,
    BOOL_OR(se.requires_investigation) AS requires_investigation
  FROM public.security_events se
  WHERE se.timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY se.severity, se.event_type
  ORDER BY
    CASE severity
      WHEN 'CRITICAL' THEN 1
      WHEN 'HIGH' THEN 2
      WHEN 'MEDIUM' THEN 3
      WHEN 'LOW' THEN 4
    END,
    event_count DESC;
END;
$$;

-- ============================================================================
-- PART 7: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.verify_audit_log_integrity TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_audit_log_gaps TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_phi_access_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_events_summary TO authenticated;

-- ============================================================================
-- PART 8: COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.audit_phi_access IS 'Generic audit trigger for PHI access logging';
COMMENT ON FUNCTION public.audit_fhir_connection_changes IS 'Audit trigger for FHIR connection configuration changes';
COMMENT ON FUNCTION public.audit_role_changes IS 'Audit trigger for role assignments and revocations';
COMMENT ON FUNCTION public.verify_audit_log_integrity IS 'Verify checksum integrity of audit log entries';
COMMENT ON FUNCTION public.detect_audit_log_gaps IS 'Detect suspicious gaps in audit log timeline';
COMMENT ON FUNCTION public.get_phi_access_report IS 'Generate PHI access report for compliance audits';
COMMENT ON FUNCTION public.get_security_events_summary IS 'Get security events summary for monitoring dashboard';

COMMIT;
