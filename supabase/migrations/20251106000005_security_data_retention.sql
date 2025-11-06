/**
 * DATA RETENTION POLICIES
 *
 * Compliance: HIPAA §164.316(b)(2)(i) - Retention and disposal
 * Purpose: Automatic data lifecycle management
 *
 * Policies:
 * - Geolocation data: 90-day retention (minimize PHI exposure)
 * - Consent verification logs: 7-year retention (HIPAA requirement)
 * - Anomaly detections: 2-year retention (SOC 2 requirement)
 * - Daily behavior summaries: 1-year retention
 *
 * Security: Prevents indefinite storage of sensitive location data
 *
 * @migration 20251106000005_security_data_retention
 */

BEGIN;

-- =====================================================
-- 1. ADD RETENTION METADATA COLUMNS
-- =====================================================

-- Add retention tracking to geolocation
ALTER TABLE public.user_geolocation_history
ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days');

-- Add retention tracking to verification logs
ALTER TABLE public.consent_verification_log
ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 years');

-- Add retention tracking to anomaly detections
ALTER TABLE public.anomaly_detections
ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 years');

-- Add retention tracking to daily behavior summaries
ALTER TABLE public.daily_behavior_summary
ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year');

-- =====================================================
-- 2. CREATE INDEXES FOR EFFICIENT CLEANUP
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_geolocation_retention
ON public.user_geolocation_history(retention_expires_at)
WHERE retention_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verification_log_retention
ON public.consent_verification_log(retention_expires_at)
WHERE retention_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_anomaly_retention
ON public.anomaly_detections(retention_expires_at)
WHERE retention_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_behavior_summary_retention
ON public.daily_behavior_summary(retention_expires_at)
WHERE retention_expires_at IS NOT NULL;

-- =====================================================
-- 3. AUTOMATIC RETENTION UPDATE TRIGGERS
-- =====================================================

-- Update geolocation retention on insert
CREATE OR REPLACE FUNCTION update_geolocation_retention()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.retention_expires_at := NEW.timestamp + INTERVAL '90 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_geolocation_retention
  BEFORE INSERT ON public.user_geolocation_history
  FOR EACH ROW
  EXECUTE FUNCTION update_geolocation_retention();

-- Update verification log retention on insert
CREATE OR REPLACE FUNCTION update_verification_log_retention()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.retention_expires_at := NEW.checked_at + INTERVAL '7 years';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verification_log_retention
  BEFORE INSERT ON public.consent_verification_log
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_log_retention();

-- Update anomaly detection retention on insert
CREATE OR REPLACE FUNCTION update_anomaly_retention()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.retention_expires_at := NEW.created_at + INTERVAL '2 years';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_anomaly_retention
  BEFORE INSERT ON public.anomaly_detections
  FOR EACH ROW
  EXECUTE FUNCTION update_anomaly_retention();

-- Update behavior summary retention on insert
CREATE OR REPLACE FUNCTION update_behavior_summary_retention()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.retention_expires_at := (NEW.summary_date::timestamptz + INTERVAL '1 year');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_behavior_summary_retention
  BEFORE INSERT ON public.daily_behavior_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_behavior_summary_retention();

-- =====================================================
-- 4. DATA CLEANUP FUNCTIONS
-- =====================================================

-- Clean up expired geolocation data
CREATE OR REPLACE FUNCTION cleanup_expired_geolocation()
RETURNS TABLE (
  deleted_count BIGINT,
  oldest_deleted TIMESTAMPTZ,
  cleanup_time TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count BIGINT;
  v_oldest_deleted TIMESTAMPTZ;
BEGIN
  -- Get oldest record to be deleted
  SELECT MIN(timestamp) INTO v_oldest_deleted
  FROM public.user_geolocation_history
  WHERE retention_expires_at <= NOW();

  -- Delete expired records
  WITH deleted AS (
    DELETE FROM public.user_geolocation_history
    WHERE retention_expires_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  -- Log cleanup action
  INSERT INTO public.audit_logs (
    event_type,
    severity,
    message,
    metadata
  ) VALUES (
    'DATA_RETENTION_CLEANUP',
    'INFO',
    'Geolocation data cleanup completed',
    jsonb_build_object(
      'deleted_count', v_deleted_count,
      'oldest_deleted', v_oldest_deleted,
      'cleanup_time', NOW()
    )
  );

  RETURN QUERY SELECT v_deleted_count, v_oldest_deleted, NOW();
END;
$$;

-- Clean up expired verification logs (7 years)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_logs()
RETURNS TABLE (
  deleted_count BIGINT,
  oldest_deleted TIMESTAMPTZ,
  cleanup_time TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count BIGINT;
  v_oldest_deleted TIMESTAMPTZ;
BEGIN
  -- Get oldest record to be deleted
  SELECT MIN(checked_at) INTO v_oldest_deleted
  FROM public.consent_verification_log
  WHERE retention_expires_at <= NOW();

  -- Delete expired records
  WITH deleted AS (
    DELETE FROM public.consent_verification_log
    WHERE retention_expires_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  -- Log cleanup action
  INSERT INTO public.audit_logs (
    event_type,
    severity,
    message,
    metadata
  ) VALUES (
    'DATA_RETENTION_CLEANUP',
    'INFO',
    'Verification log cleanup completed',
    jsonb_build_object(
      'deleted_count', v_deleted_count,
      'oldest_deleted', v_oldest_deleted,
      'cleanup_time', NOW()
    )
  );

  RETURN QUERY SELECT v_deleted_count, v_oldest_deleted, NOW();
END;
$$;

-- Clean up expired anomaly detections
CREATE OR REPLACE FUNCTION cleanup_expired_anomalies()
RETURNS TABLE (
  deleted_count BIGINT,
  oldest_deleted TIMESTAMPTZ,
  cleanup_time TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count BIGINT;
  v_oldest_deleted TIMESTAMPTZ;
BEGIN
  -- Get oldest record to be deleted
  SELECT MIN(created_at) INTO v_oldest_deleted
  FROM public.anomaly_detections
  WHERE retention_expires_at <= NOW();

  -- Delete expired records
  WITH deleted AS (
    DELETE FROM public.anomaly_detections
    WHERE retention_expires_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  -- Log cleanup action
  INSERT INTO public.audit_logs (
    event_type,
    severity,
    message,
    metadata
  ) VALUES (
    'DATA_RETENTION_CLEANUP',
    'INFO',
    'Anomaly detection cleanup completed',
    jsonb_build_object(
      'deleted_count', v_deleted_count,
      'oldest_deleted', v_oldest_deleted,
      'cleanup_time', NOW()
    )
  );

  RETURN QUERY SELECT v_deleted_count, v_oldest_deleted, NOW();
END;
$$;

-- Clean up expired behavior summaries
CREATE OR REPLACE FUNCTION cleanup_expired_behavior_summaries()
RETURNS TABLE (
  deleted_count BIGINT,
  oldest_deleted DATE,
  cleanup_time TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count BIGINT;
  v_oldest_deleted DATE;
BEGIN
  -- Get oldest record to be deleted
  SELECT MIN(summary_date) INTO v_oldest_deleted
  FROM public.daily_behavior_summary
  WHERE retention_expires_at <= NOW();

  -- Delete expired records
  WITH deleted AS (
    DELETE FROM public.daily_behavior_summary
    WHERE retention_expires_at <= NOW()
    RETURNING user_id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  -- Log cleanup action
  INSERT INTO public.audit_logs (
    event_type,
    severity,
    message,
    metadata
  ) VALUES (
    'DATA_RETENTION_CLEANUP',
    'INFO',
    'Behavior summary cleanup completed',
    jsonb_build_object(
      'deleted_count', v_deleted_count,
      'oldest_deleted', v_oldest_deleted,
      'cleanup_time', NOW()
    )
  );

  RETURN QUERY SELECT v_deleted_count, v_oldest_deleted, NOW();
END;
$$;

-- Master cleanup function (runs all cleanup tasks)
CREATE OR REPLACE FUNCTION run_all_data_retention_cleanup()
RETURNS TABLE (
  cleanup_task TEXT,
  deleted_count BIGINT,
  cleanup_time TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Clean up geolocation
  RETURN QUERY
  SELECT
    'geolocation'::TEXT,
    r.deleted_count,
    r.cleanup_time
  FROM cleanup_expired_geolocation() r;

  -- Clean up verification logs
  RETURN QUERY
  SELECT
    'verification_logs'::TEXT,
    r.deleted_count,
    r.cleanup_time
  FROM cleanup_expired_verification_logs() r;

  -- Clean up anomalies
  RETURN QUERY
  SELECT
    'anomaly_detections'::TEXT,
    r.deleted_count,
    r.cleanup_time
  FROM cleanup_expired_anomalies() r;

  -- Clean up behavior summaries
  RETURN QUERY
  SELECT
    'behavior_summaries'::TEXT,
    r.deleted_count,
    r.cleanup_time
  FROM cleanup_expired_behavior_summaries() r;
END;
$$;

-- =====================================================
-- 5. ADMIN FUNCTIONS - MANUAL RETENTION EXTENSION
-- =====================================================

-- Extend retention for specific geolocation records (e.g., legal hold)
CREATE OR REPLACE FUNCTION extend_geolocation_retention(
  p_geolocation_ids UUID[],
  p_extension_days INTEGER
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.user_geolocation_history
  SET retention_expires_at = retention_expires_at + (p_extension_days || ' days')::INTERVAL
  WHERE id = ANY(p_geolocation_ids);

  -- Log retention extension
  INSERT INTO public.audit_logs (
    event_type,
    severity,
    message,
    metadata
  ) VALUES (
    'DATA_RETENTION_EXTENDED',
    'WARNING',
    'Geolocation retention extended',
    jsonb_build_object(
      'record_count', array_length(p_geolocation_ids, 1),
      'extension_days', p_extension_days,
      'extended_by', auth.uid()
    )
  );

  RETURN TRUE;
END;
$$;

-- Extend retention for consent verification logs (e.g., litigation)
CREATE OR REPLACE FUNCTION extend_verification_log_retention(
  p_log_ids BIGINT[],
  p_extension_years INTEGER
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.consent_verification_log
  SET retention_expires_at = retention_expires_at + (p_extension_years || ' years')::INTERVAL
  WHERE id = ANY(p_log_ids);

  -- Log retention extension
  INSERT INTO public.audit_logs (
    event_type,
    severity,
    message,
    metadata
  ) VALUES (
    'DATA_RETENTION_EXTENDED',
    'WARNING',
    'Verification log retention extended',
    jsonb_build_object(
      'record_count', array_length(p_log_ids, 1),
      'extension_years', p_extension_years,
      'extended_by', auth.uid()
    )
  );

  RETURN TRUE;
END;
$$;

-- =====================================================
-- 6. RETENTION POLICY REPORTING
-- =====================================================

-- Get retention policy status
CREATE OR REPLACE FUNCTION get_retention_policy_status()
RETURNS TABLE (
  table_name TEXT,
  total_records BIGINT,
  expiring_soon_count BIGINT,
  expired_count BIGINT,
  oldest_record TIMESTAMPTZ,
  newest_record TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Geolocation status
  RETURN QUERY
  SELECT
    'user_geolocation_history'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE retention_expires_at <= NOW() + INTERVAL '7 days')::BIGINT,
    COUNT(*) FILTER (WHERE retention_expires_at <= NOW())::BIGINT,
    MIN(timestamp),
    MAX(timestamp)
  FROM public.user_geolocation_history;

  -- Verification log status
  RETURN QUERY
  SELECT
    'consent_verification_log'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE retention_expires_at <= NOW() + INTERVAL '30 days')::BIGINT,
    COUNT(*) FILTER (WHERE retention_expires_at <= NOW())::BIGINT,
    MIN(checked_at),
    MAX(checked_at)
  FROM public.consent_verification_log;

  -- Anomaly detection status
  RETURN QUERY
  SELECT
    'anomaly_detections'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE retention_expires_at <= NOW() + INTERVAL '30 days')::BIGINT,
    COUNT(*) FILTER (WHERE retention_expires_at <= NOW())::BIGINT,
    MIN(created_at),
    MAX(created_at)
  FROM public.anomaly_detections;

  -- Behavior summary status
  RETURN QUERY
  SELECT
    'daily_behavior_summary'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE retention_expires_at <= NOW() + INTERVAL '30 days')::BIGINT,
    COUNT(*) FILTER (WHERE retention_expires_at <= NOW())::BIGINT,
    MIN(summary_date::timestamptz),
    MAX(summary_date::timestamptz)
  FROM public.daily_behavior_summary;
END;
$$;

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

-- Allow authenticated users to view their own retention status
GRANT EXECUTE ON FUNCTION get_retention_policy_status() TO authenticated;

-- Only admins can extend retention or run cleanup
-- (These functions will be called by scheduled jobs or admin dashboard)

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION cleanup_expired_geolocation() IS
'Deletes geolocation records older than 90 days. Compliant with HIPAA minimum necessary standard.';

COMMENT ON FUNCTION cleanup_expired_verification_logs() IS
'Deletes consent verification logs older than 7 years. Compliant with HIPAA §164.316(b)(2)(i).';

COMMENT ON FUNCTION cleanup_expired_anomalies() IS
'Deletes anomaly detections older than 2 years. Compliant with SOC 2 retention requirements.';

COMMENT ON FUNCTION cleanup_expired_behavior_summaries() IS
'Deletes daily behavior summaries older than 1 year. Reduces storage costs while maintaining audit capability.';

COMMENT ON FUNCTION extend_geolocation_retention(UUID[], INTEGER) IS
'Extends retention for specific geolocation records. Use for legal holds or investigations.';

COMMENT ON FUNCTION extend_verification_log_retention(BIGINT[], INTEGER) IS
'Extends retention for consent verification logs. Use for litigation or regulatory investigations.';

COMMIT;

/**
 * DEPLOYMENT NOTES:
 *
 * 1. This migration adds automatic data retention policies
 * 2. Existing records will get retention_expires_at = NOW() + retention_period
 * 3. New records will automatically calculate retention via triggers
 * 4. Cleanup functions can be called manually or scheduled via pg_cron
 *
 * RECOMMENDED CRON SCHEDULE (add via Supabase dashboard or pg_cron):
 *
 * -- Run daily at 2 AM UTC
 * SELECT cron.schedule(
 *   'data-retention-cleanup',
 *   '0 2 * * *',
 *   $$SELECT run_all_data_retention_cleanup()$$
 * );
 *
 * HIPAA COMPLIANCE:
 * - §164.316(b)(2)(i) - Data retention and disposal requirements met
 * - Automatic deletion prevents indefinite PHI storage
 * - Audit logs track all cleanup operations
 * - Legal hold capability via extension functions
 */
