-- Prometheus Metrics System
-- Purpose: Infrastructure and healthcare metrics collection for monitoring
-- Integration: Prometheus /metrics endpoint for scraping

-- ============================================================================
-- 1. SYSTEM METRICS TABLE
-- ============================================================================

-- Create table with new schema if it doesn't exist at all
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  metric_value NUMERIC,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns for Prometheus compatibility if table exists with old schema
DO $$
BEGIN
  -- Add metric_name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_metrics' AND column_name = 'metric_name') THEN
    ALTER TABLE system_metrics ADD COLUMN metric_name TEXT;
    -- Populate metric_name from metric_type for existing records
    UPDATE system_metrics SET metric_name = metric_type WHERE metric_name IS NULL;
  END IF;

  -- Add metric_help column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_metrics' AND column_name = 'metric_help') THEN
    ALTER TABLE system_metrics ADD COLUMN metric_help TEXT;
  END IF;

  -- Add labels column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_metrics' AND column_name = 'labels') THEN
    ALTER TABLE system_metrics ADD COLUMN labels JSONB DEFAULT '{}';
    -- Copy metadata to labels for existing records
    UPDATE system_metrics SET labels = COALESCE(metadata, '{}') WHERE labels IS NULL;
  END IF;

  -- Add value column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_metrics' AND column_name = 'value') THEN
    ALTER TABLE system_metrics ADD COLUMN value NUMERIC;
    -- Copy metric_value to value for existing records
    UPDATE system_metrics SET value = COALESCE(metric_value, 0) WHERE value IS NULL;
  END IF;

  -- Add bucket_le column (for histograms)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_metrics' AND column_name = 'bucket_le') THEN
    ALTER TABLE system_metrics ADD COLUMN bucket_le NUMERIC;
  END IF;

  -- Add quantile column (for summaries)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_metrics' AND column_name = 'quantile') THEN
    ALTER TABLE system_metrics ADD COLUMN quantile NUMERIC;
  END IF;

  -- Add source column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_metrics' AND column_name = 'source') THEN
    ALTER TABLE system_metrics ADD COLUMN source TEXT DEFAULT 'application';
  END IF;

  -- Add tenant_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_metrics' AND column_name = 'tenant_id') THEN
    ALTER TABLE system_metrics ADD COLUMN tenant_id UUID;
  END IF;
END $$;

-- ============================================================================
-- 2. AGGREGATED METRICS VIEW
-- ============================================================================

-- Latest values for each metric (for gauges)
CREATE OR REPLACE VIEW metrics_latest AS
SELECT DISTINCT ON (metric_name, labels)
  metric_name,
  metric_type,
  metric_help,
  labels,
  value,
  recorded_at
FROM system_metrics
ORDER BY metric_name, labels, recorded_at DESC;

-- ============================================================================
-- 3. HEALTHCARE METRICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW healthcare_metrics AS
SELECT
  -- User metrics
  (SELECT COUNT(*) FROM profiles WHERE role IN ('member', 'patient')) as total_patients,
  (SELECT COUNT(*) FROM profiles WHERE role IN ('provider', 'nurse', 'care_coordinator')) as total_clinical_staff,
  -- Join to auth.users for last_sign_in_at
  (SELECT COUNT(*) FROM profiles p JOIN auth.users u ON p.user_id = u.id WHERE u.last_sign_in_at > NOW() - INTERVAL '7 days') as active_users_7d,

  -- Engagement metrics
  (SELECT COUNT(*) FROM check_ins WHERE created_at > NOW() - INTERVAL '24 hours') as check_ins_24h,
  (SELECT COUNT(*) FROM check_ins WHERE created_at > NOW() - INTERVAL '7 days') as check_ins_7d,

  -- Order metrics (with IF EXISTS checks via COALESCE for missing tables)
  COALESCE((SELECT COUNT(*) FROM lab_orders WHERE ordered_at > NOW() - INTERVAL '24 hours'), 0) as lab_orders_24h,
  COALESCE((SELECT COUNT(*) FROM lab_orders WHERE sla_breached = TRUE AND order_status NOT IN ('resulted', 'cancelled')), 0) as lab_orders_sla_breach,
  COALESCE((SELECT COUNT(*) FROM imaging_orders WHERE ordered_at > NOW() - INTERVAL '24 hours'), 0) as imaging_orders_24h,
  COALESCE((SELECT COUNT(*) FROM imaging_orders WHERE sla_breached = TRUE AND order_status NOT IN ('finalized', 'cancelled')), 0) as imaging_orders_sla_breach,

  -- Audit metrics (audit_logs and security_events use "timestamp" column)
  (SELECT COUNT(*) FROM audit_logs WHERE timestamp > NOW() - INTERVAL '24 hours') as audit_events_24h,
  COALESCE((SELECT COUNT(*) FROM security_events WHERE timestamp > NOW() - INTERVAL '24 hours'), 0) as security_events_24h,
  COALESCE((SELECT COUNT(*) FROM security_events WHERE severity = 'CRITICAL' AND timestamp > NOW() - INTERVAL '24 hours'), 0) as critical_security_events_24h,

  -- Alert metrics
  COALESCE((SELECT COUNT(*) FROM guardian_alerts WHERE status = 'pending'), 0) as pending_alerts,
  COALESCE((SELECT COUNT(*) FROM guardian_alerts WHERE severity = 'critical' AND status = 'pending'), 0) as critical_pending_alerts,

  -- Backup/DR metrics
  COALESCE((SELECT COUNT(*) FROM backup_verification_logs WHERE verification_timestamp > NOW() - INTERVAL '24 hours' AND verification_status = 'success'), 0) as successful_backups_24h,
  COALESCE((SELECT COUNT(*) FROM disaster_recovery_drills WHERE status = 'completed' AND actual_end > NOW() - INTERVAL '30 days'), 0) as drills_completed_30d,

  -- Timestamp
  NOW() as collected_at;

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded ON system_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- Record a metric
CREATE OR REPLACE FUNCTION record_metric(
  p_name TEXT,
  p_type TEXT,
  p_value NUMERIC,
  p_labels JSONB DEFAULT '{}',
  p_help TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO system_metrics (
    metric_name,
    metric_type,
    metric_help,
    labels,
    value
  ) VALUES (
    p_name,
    p_type,
    p_help,
    p_labels,
    p_value
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Increment a counter
CREATE OR REPLACE FUNCTION increment_counter(
  p_name TEXT,
  p_labels JSONB DEFAULT '{}',
  p_increment NUMERIC DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  -- Get current value and increment
  INSERT INTO system_metrics (
    metric_name,
    metric_type,
    labels,
    value
  )
  SELECT
    p_name,
    'counter',
    p_labels,
    COALESCE(
      (SELECT value FROM system_metrics
       WHERE metric_name = p_name AND labels = p_labels
       ORDER BY recorded_at DESC LIMIT 1),
      0
    ) + p_increment;
END;
$$ LANGUAGE plpgsql;

-- Get metrics in Prometheus format
CREATE OR REPLACE FUNCTION get_prometheus_metrics()
RETURNS TEXT AS $$
DECLARE
  v_output TEXT := '';
  v_healthcare RECORD;
  v_metric RECORD;
BEGIN
  -- Get healthcare metrics
  SELECT * INTO v_healthcare FROM healthcare_metrics;

  -- Build Prometheus output
  v_output := v_output || '# HELP wellfit_total_patients Total number of patients' || E'\n';
  v_output := v_output || '# TYPE wellfit_total_patients gauge' || E'\n';
  v_output := v_output || 'wellfit_total_patients ' || COALESCE(v_healthcare.total_patients, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_total_clinical_staff Total clinical staff' || E'\n';
  v_output := v_output || '# TYPE wellfit_total_clinical_staff gauge' || E'\n';
  v_output := v_output || 'wellfit_total_clinical_staff ' || COALESCE(v_healthcare.total_clinical_staff, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_active_users_7d Active users in last 7 days' || E'\n';
  v_output := v_output || '# TYPE wellfit_active_users_7d gauge' || E'\n';
  v_output := v_output || 'wellfit_active_users_7d ' || COALESCE(v_healthcare.active_users_7d, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_check_ins_24h Check-ins in last 24 hours' || E'\n';
  v_output := v_output || '# TYPE wellfit_check_ins_24h gauge' || E'\n';
  v_output := v_output || 'wellfit_check_ins_24h ' || COALESCE(v_healthcare.check_ins_24h, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_check_ins_7d Check-ins in last 7 days' || E'\n';
  v_output := v_output || '# TYPE wellfit_check_ins_7d gauge' || E'\n';
  v_output := v_output || 'wellfit_check_ins_7d ' || COALESCE(v_healthcare.check_ins_7d, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_lab_orders_24h Lab orders in last 24 hours' || E'\n';
  v_output := v_output || '# TYPE wellfit_lab_orders_24h gauge' || E'\n';
  v_output := v_output || 'wellfit_lab_orders_24h ' || COALESCE(v_healthcare.lab_orders_24h, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_lab_orders_sla_breach Lab orders with SLA breach' || E'\n';
  v_output := v_output || '# TYPE wellfit_lab_orders_sla_breach gauge' || E'\n';
  v_output := v_output || 'wellfit_lab_orders_sla_breach ' || COALESCE(v_healthcare.lab_orders_sla_breach, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_imaging_orders_24h Imaging orders in last 24 hours' || E'\n';
  v_output := v_output || '# TYPE wellfit_imaging_orders_24h gauge' || E'\n';
  v_output := v_output || 'wellfit_imaging_orders_24h ' || COALESCE(v_healthcare.imaging_orders_24h, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_imaging_orders_sla_breach Imaging orders with SLA breach' || E'\n';
  v_output := v_output || '# TYPE wellfit_imaging_orders_sla_breach gauge' || E'\n';
  v_output := v_output || 'wellfit_imaging_orders_sla_breach ' || COALESCE(v_healthcare.imaging_orders_sla_breach, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_audit_events_24h Audit events in last 24 hours' || E'\n';
  v_output := v_output || '# TYPE wellfit_audit_events_24h gauge' || E'\n';
  v_output := v_output || 'wellfit_audit_events_24h ' || COALESCE(v_healthcare.audit_events_24h, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_security_events_24h Security events in last 24 hours' || E'\n';
  v_output := v_output || '# TYPE wellfit_security_events_24h gauge' || E'\n';
  v_output := v_output || 'wellfit_security_events_24h ' || COALESCE(v_healthcare.security_events_24h, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_critical_security_events_24h Critical security events in last 24 hours' || E'\n';
  v_output := v_output || '# TYPE wellfit_critical_security_events_24h gauge' || E'\n';
  v_output := v_output || 'wellfit_critical_security_events_24h ' || COALESCE(v_healthcare.critical_security_events_24h, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_pending_alerts Pending alerts' || E'\n';
  v_output := v_output || '# TYPE wellfit_pending_alerts gauge' || E'\n';
  v_output := v_output || 'wellfit_pending_alerts ' || COALESCE(v_healthcare.pending_alerts, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_critical_pending_alerts Critical pending alerts' || E'\n';
  v_output := v_output || '# TYPE wellfit_critical_pending_alerts gauge' || E'\n';
  v_output := v_output || 'wellfit_critical_pending_alerts ' || COALESCE(v_healthcare.critical_pending_alerts, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_successful_backups_24h Successful backups in last 24 hours' || E'\n';
  v_output := v_output || '# TYPE wellfit_successful_backups_24h gauge' || E'\n';
  v_output := v_output || 'wellfit_successful_backups_24h ' || COALESCE(v_healthcare.successful_backups_24h, 0) || E'\n\n';

  v_output := v_output || '# HELP wellfit_drills_completed_30d DR drills completed in last 30 days' || E'\n';
  v_output := v_output || '# TYPE wellfit_drills_completed_30d gauge' || E'\n';
  v_output := v_output || 'wellfit_drills_completed_30d ' || COALESCE(v_healthcare.drills_completed_30d, 0) || E'\n\n';

  -- Add custom metrics from system_metrics table
  FOR v_metric IN
    SELECT DISTINCT ON (metric_name, labels)
      metric_name,
      metric_type,
      metric_help,
      labels,
      value
    FROM system_metrics
    WHERE recorded_at > NOW() - INTERVAL '5 minutes'
    ORDER BY metric_name, labels, recorded_at DESC
  LOOP
    IF v_metric.metric_help IS NOT NULL THEN
      v_output := v_output || '# HELP ' || v_metric.metric_name || ' ' || v_metric.metric_help || E'\n';
    END IF;
    v_output := v_output || '# TYPE ' || v_metric.metric_name || ' ' || v_metric.metric_type || E'\n';

    -- Format labels if present
    IF v_metric.labels IS NOT NULL AND v_metric.labels != '{}' THEN
      v_output := v_output || v_metric.metric_name || '{' ||
        (SELECT string_agg(key || '="' || value || '"', ',')
         FROM jsonb_each_text(v_metric.labels)) || '} ';
    ELSE
      v_output := v_output || v_metric.metric_name || ' ';
    END IF;

    v_output := v_output || v_metric.value || E'\n';
  END LOOP;

  RETURN v_output;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old metrics (retain 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM system_metrics
  WHERE recorded_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Admins can view metrics
CREATE POLICY "Admins can view metrics"
  ON system_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- System can insert metrics
CREATE POLICY "System can insert metrics"
  ON system_metrics FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- Grant access to views
GRANT SELECT ON metrics_latest TO authenticated;
GRANT SELECT ON healthcare_metrics TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE system_metrics IS 'Raw metric storage for Prometheus-compatible monitoring';
COMMENT ON VIEW metrics_latest IS 'Latest value for each metric';
COMMENT ON VIEW healthcare_metrics IS 'Aggregated healthcare metrics for dashboard';
COMMENT ON FUNCTION get_prometheus_metrics IS 'Returns metrics in Prometheus text format';
COMMENT ON FUNCTION record_metric IS 'Record a single metric value';
COMMENT ON FUNCTION increment_counter IS 'Increment a counter metric';
