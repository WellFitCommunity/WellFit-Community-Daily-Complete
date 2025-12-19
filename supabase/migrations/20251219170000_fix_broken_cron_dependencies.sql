-- ============================================================================
-- Fix Broken Cron Job Dependencies
-- ============================================================================
-- Creates missing functions that cron jobs depend on.
-- Removes orphaned cron jobs for materialized views that no longer exist.
-- ============================================================================

-- ============================================================================
-- 1. CONNECTION POOL METRICS TABLE AND FUNCTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS connection_pool_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_connections INTEGER NOT NULL,
  active_connections INTEGER NOT NULL,
  idle_connections INTEGER NOT NULL,
  waiting_connections INTEGER DEFAULT 0,
  max_connections INTEGER NOT NULL,
  utilization_percent DECIMAL(5,2) NOT NULL,
  avg_connection_age_seconds INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS connection_pool_metrics_recorded_at_idx
  ON connection_pool_metrics(recorded_at);

CREATE OR REPLACE FUNCTION capture_connection_pool_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_active INTEGER;
  v_idle INTEGER;
  v_max INTEGER;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE state = 'active'),
    count(*) FILTER (WHERE state = 'idle')
  INTO v_total, v_active, v_idle
  FROM pg_stat_activity
  WHERE datname = current_database();

  SELECT setting::integer INTO v_max
  FROM pg_settings
  WHERE name = 'max_connections';

  INSERT INTO connection_pool_metrics (
    total_connections,
    active_connections,
    idle_connections,
    max_connections,
    utilization_percent
  ) VALUES (
    v_total,
    v_active,
    v_idle,
    v_max,
    (v_total::decimal / NULLIF(v_max, 0)::decimal * 100)
  );

  -- Cleanup old metrics (keep last 7 days)
  DELETE FROM connection_pool_metrics
  WHERE recorded_at < NOW() - INTERVAL '7 days';
END;
$$;

-- ============================================================================
-- 2. CHECK ALERT ESCALATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_alert_escalation()
RETURNS void AS $$
DECLARE
  alert_record RECORD;
  escalation_threshold INTERVAL := '15 minutes';
BEGIN
  FOR alert_record IN
    SELECT id, severity, title, created_at, escalation_level
    FROM security_alerts
    WHERE status = 'new'
      AND escalated = false
      AND created_at < NOW() - escalation_threshold
  LOOP
    UPDATE security_alerts
    SET
      escalated = true,
      escalated_at = NOW(),
      escalation_level = COALESCE(alert_record.escalation_level, 0) + 1,
      status = 'escalated',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'escalation_reason', 'No response within 15 minutes',
        'escalated_at', NOW()
      ),
      updated_at = NOW()
    WHERE id = alert_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION capture_connection_pool_metrics() TO service_role;
GRANT EXECUTE ON FUNCTION check_alert_escalation() TO service_role;

-- ============================================================================
-- 4. REMOVE ORPHANED CRON JOBS (materialized views don't exist)
-- ============================================================================

DO $$
BEGIN
  -- These cron jobs reference materialized views that were never created
  -- because the skipped migrations assumed a different schema
  PERFORM cron.unschedule('refresh-encounter-summary-cache');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('refresh-billing-summary-cache');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('refresh-patient-summary-cache');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('refresh-fhir-resource-cache');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 5. RE-ADD WORKING CRON JOBS
-- ============================================================================

-- Remove old versions first (if exist)
DO $$
BEGIN
  PERFORM cron.unschedule('capture-connection-metrics');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-security-alert-escalation');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add connection pool metrics capture (every 5 minutes)
SELECT cron.schedule(
  'capture-connection-metrics',
  '*/5 * * * *',
  'SELECT capture_connection_pool_metrics()'
);

-- Add security alert escalation check (every 5 minutes)
SELECT cron.schedule(
  'check-security-alert-escalation',
  '*/5 * * * *',
  'SELECT check_alert_escalation()'
);

-- ============================================================================
-- COMPLETION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixed cron job dependencies:';
  RAISE NOTICE '  + capture_connection_pool_metrics() function created';
  RAISE NOTICE '  + check_alert_escalation() function created';
  RAISE NOTICE '  + capture-connection-metrics cron job scheduled';
  RAISE NOTICE '  + check-security-alert-escalation cron job scheduled';
  RAISE NOTICE '  - Removed orphaned materialized view refresh jobs';
END $$;
