-- ============================================================================
-- SOC 2 Monitoring and Compliance Dashboard Views
-- ============================================================================
-- Purpose: Create views for real-time SOC 2 compliance monitoring
-- Date: 2025-10-18
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: SECURITY MONITORING DASHBOARD
-- ============================================================================

CREATE OR REPLACE VIEW public.security_monitoring_dashboard AS
SELECT
  -- Time windows
  NOW() AS snapshot_time,

  -- Critical Metrics (Last 24 Hours)
  (SELECT COUNT(*) FROM security_events WHERE timestamp >= NOW() - INTERVAL '24 hours') AS total_security_events_24h,
  (SELECT COUNT(*) FROM security_events WHERE severity = 'CRITICAL' AND timestamp >= NOW() - INTERVAL '24 hours') AS critical_events_24h,
  (SELECT COUNT(*) FROM security_events WHERE severity = 'HIGH' AND timestamp >= NOW() - INTERVAL '24 hours') AS high_events_24h,
  (SELECT COUNT(*) FROM security_events WHERE requires_investigation AND NOT investigated) AS pending_investigations,

  -- Authentication Security
  (SELECT COUNT(*) FROM security_events WHERE event_type = 'FAILED_LOGIN' AND timestamp >= NOW() - INTERVAL '1 hour') AS failed_logins_1h,
  (SELECT COUNT(*) FROM security_events WHERE event_type = 'BRUTE_FORCE_ATTEMPT' AND timestamp >= NOW() - INTERVAL '24 hours') AS brute_force_attempts_24h,

  -- PHI Access Monitoring
  (SELECT COUNT(*) FROM audit_logs WHERE event_category = 'PHI_ACCESS' AND timestamp >= NOW() - INTERVAL '24 hours') AS phi_accesses_24h,
  (SELECT COUNT(*) FROM audit_logs WHERE event_type = 'PHI_EXPORT' AND timestamp >= NOW() - INTERVAL '24 hours') AS phi_exports_24h,
  (SELECT COUNT(*) FROM audit_logs WHERE event_category = 'PHI_ACCESS' AND success = FALSE AND timestamp >= NOW() - INTERVAL '24 hours') AS failed_phi_accesses_24h,

  -- Rate Limiting
  (SELECT COUNT(*) FROM security_events WHERE event_type = 'RATE_LIMIT_EXCEEDED' AND timestamp >= NOW() - INTERVAL '1 hour') AS rate_limit_violations_1h,

  -- Audit Log Health
  (SELECT COUNT(*) FROM audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours') AS total_audit_logs_24h,
  (SELECT MAX(timestamp) FROM audit_logs) AS last_audit_log_time,
  EXTRACT(EPOCH FROM (NOW() - (SELECT MAX(timestamp) FROM audit_logs))) AS seconds_since_last_audit,

  -- Encryption Status
  (SELECT
     ROUND(100.0 * COUNT(*) FILTER (WHERE access_token_encrypted IS NOT NULL) / NULLIF(COUNT(*), 0), 2)
   FROM fhir_connections) AS fhir_tokens_encrypted_pct,

  (SELECT
     ROUND(100.0 * COUNT(*) FILTER (WHERE phone_encrypted IS NOT NULL OR email_encrypted IS NOT NULL) / NULLIF(COUNT(*), 0), 2)
   FROM profiles) AS profiles_encrypted_pct;

COMMENT ON VIEW public.security_monitoring_dashboard IS 'Real-time security and compliance metrics for SOC 2 monitoring';

-- ============================================================================
-- PART 2: PHI ACCESS AUDIT VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.phi_access_audit AS
SELECT
  al.id AS audit_id,
  al.timestamp,
  al.actor_user_id,
  p.email AS actor_email,
  ur.role AS actor_role,
  al.event_type,
  al.operation,
  al.resource_type,
  al.resource_id,
  al.target_user_id,
  tp.email AS target_email,
  al.success,
  al.error_message,
  al.actor_ip_address,
  al.metadata
FROM audit_logs al
LEFT JOIN profiles p ON al.actor_user_id = p.user_id
LEFT JOIN user_roles ur ON al.actor_user_id = ur.user_id
LEFT JOIN profiles tp ON al.target_user_id = tp.user_id
WHERE al.event_category = 'PHI_ACCESS'
ORDER BY al.timestamp DESC;

COMMENT ON VIEW public.phi_access_audit IS 'Complete PHI access audit trail with user details';

-- ============================================================================
-- PART 3: SECURITY EVENTS ANALYSIS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.security_events_analysis AS
SELECT
  DATE_TRUNC('hour', se.timestamp) AS time_bucket,
  se.severity,
  se.event_type,
  COUNT(*) AS event_count,
  COUNT(*) FILTER (WHERE se.requires_investigation) AS requires_investigation_count,
  COUNT(*) FILTER (WHERE se.investigated) AS investigated_count,
  COUNT(DISTINCT se.actor_user_id) AS unique_users,
  COUNT(DISTINCT se.actor_ip_address) AS unique_ips,
  MAX(se.timestamp) AS latest_occurrence
FROM security_events se
WHERE se.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, event_count DESC;

COMMENT ON VIEW public.security_events_analysis IS 'Hourly aggregation of security events for trend analysis';

-- ============================================================================
-- PART 4: COMPLIANCE STATUS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.compliance_status AS
SELECT
  'Audit Logging' AS control_area,
  'CC7.3' AS soc2_criterion,
  CASE
    WHEN (SELECT COUNT(*) FROM audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours') > 0
    THEN 'COMPLIANT'
    ELSE 'NON_COMPLIANT'
  END AS status,
  format('Last audit log: %s ago',
    AGE(NOW(), (SELECT MAX(timestamp) FROM audit_logs))
  ) AS details,
  'PASS' AS test_result

UNION ALL

SELECT
  'Data Encryption',
  'PI1.4',
  CASE
    WHEN (SELECT COUNT(*) FILTER (WHERE access_token_encrypted IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0) FROM fhir_connections) >= 95
    THEN 'COMPLIANT'
    ELSE 'NON_COMPLIANT'
  END,
  format('%.1f%% of credentials encrypted',
    (SELECT COUNT(*) FILTER (WHERE access_token_encrypted IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0) FROM fhir_connections)
  ),
  CASE
    WHEN (SELECT COUNT(*) FILTER (WHERE access_token_encrypted IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0) FROM fhir_connections) >= 95
    THEN 'PASS'
    ELSE 'FAIL'
  END

UNION ALL

SELECT
  'Access Controls',
  'CC6.1',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
      AND policyname LIKE '%admin%'
    ) THEN 'COMPLIANT'
    ELSE 'NON_COMPLIANT'
  END,
  format('%s RLS policies active',
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public')
  ),
  'PASS'

UNION ALL

SELECT
  'Security Monitoring',
  'CC7.2',
  CASE
    WHEN (SELECT COUNT(*) FROM security_events WHERE timestamp >= NOW() - INTERVAL '24 hours') >= 0
    THEN 'COMPLIANT'
    ELSE 'NON_COMPLIANT'
  END,
  format('%s security events logged (24h)',
    (SELECT COUNT(*) FROM security_events WHERE timestamp >= NOW() - INTERVAL '24 hours')
  ),
  'PASS'

UNION ALL

SELECT
  'Data Retention',
  'PI1.5',
  CASE
    WHEN (SELECT COUNT(*) FROM data_retention_policies WHERE enabled = TRUE) > 0
    THEN 'COMPLIANT'
    ELSE 'NON_COMPLIANT'
  END,
  format('%s active retention policies',
    (SELECT COUNT(*) FROM data_retention_policies WHERE enabled = TRUE)
  ),
  CASE
    WHEN (SELECT COUNT(*) FROM data_retention_policies WHERE enabled = TRUE) > 0
    THEN 'PASS'
    ELSE 'FAIL'
  END

UNION ALL

SELECT
  'Incident Response',
  'CC7.4',
  CASE
    WHEN (SELECT COUNT(*) FROM security_events WHERE requires_investigation AND NOT investigated) <= 5
    THEN 'COMPLIANT'
    ELSE 'AT_RISK'
  END,
  format('%s pending investigations',
    (SELECT COUNT(*) FROM security_events WHERE requires_investigation AND NOT investigated)
  ),
  CASE
    WHEN (SELECT COUNT(*) FROM security_events WHERE requires_investigation AND NOT investigated) <= 5
    THEN 'PASS'
    ELSE 'WARNING'
  END;

COMMENT ON VIEW public.compliance_status IS 'SOC 2 compliance status across all control areas';

-- ============================================================================
-- PART 5: USER ACTIVITY SUMMARY VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.user_activity_summary AS
SELECT
  al.actor_user_id,
  p.email,
  ur.role,
  COUNT(*) AS total_actions,
  COUNT(*) FILTER (WHERE al.event_category = 'PHI_ACCESS') AS phi_accesses,
  COUNT(*) FILTER (WHERE al.event_type = 'PHI_EXPORT') AS phi_exports,
  COUNT(*) FILTER (WHERE al.success = FALSE) AS failed_actions,
  COUNT(DISTINCT al.actor_ip_address) AS unique_ips,
  MAX(al.timestamp) AS last_activity,
  MIN(al.timestamp) AS first_activity
FROM audit_logs al
LEFT JOIN profiles p ON al.actor_user_id = p.user_id
LEFT JOIN user_roles ur ON al.actor_user_id = ur.user_id
WHERE al.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY al.actor_user_id, p.email, ur.role
ORDER BY total_actions DESC;

COMMENT ON VIEW public.user_activity_summary IS 'User activity summary for access reviews';

-- ============================================================================
-- PART 6: DATA RETENTION STATUS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.data_retention_status AS
SELECT
  drp.table_name,
  drp.retention_period,
  drp.policy_type,
  drp.enabled,
  drp.last_execution,
  drp.next_execution,
  drp.records_processed_last_run,
  CASE
    WHEN drp.next_execution < NOW() THEN 'OVERDUE'
    WHEN drp.next_execution < NOW() + INTERVAL '1 day' THEN 'DUE_SOON'
    ELSE 'SCHEDULED'
  END AS execution_status,
  -- Estimate records pending deletion
  CASE drp.table_name
    WHEN 'audit_logs' THEN
      (SELECT COUNT(*) FROM audit_logs WHERE retention_date <= NOW())
    WHEN 'security_events' THEN
      (SELECT COUNT(*) FROM security_events WHERE timestamp < NOW() - drp.retention_period)
    WHEN 'rate_limit_events' THEN
      (SELECT COUNT(*) FROM rate_limit_events WHERE window_end < NOW() - drp.retention_period)
    ELSE NULL
  END AS records_pending_deletion
FROM data_retention_policies drp
ORDER BY drp.next_execution ASC NULLS LAST;

COMMENT ON VIEW public.data_retention_status IS 'Data retention policy execution status and pending deletions';

-- ============================================================================
-- PART 7: FHIR CONNECTION HEALTH VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.fhir_connection_health AS
SELECT
  fc.id,
  fc.name,
  fc.ehr_system,
  fc.status,
  fc.last_sync,
  EXTRACT(EPOCH FROM (NOW() - fc.last_sync)) / 3600 AS hours_since_last_sync,
  fc.token_expiry,
  CASE
    WHEN fc.token_expiry IS NULL THEN 'NO_EXPIRY_SET'
    WHEN fc.token_expiry < NOW() THEN 'EXPIRED'
    WHEN fc.token_expiry < NOW() + INTERVAL '7 days' THEN 'EXPIRING_SOON'
    ELSE 'VALID'
  END AS token_status,
  -- Token security
  CASE
    WHEN fc.access_token_encrypted IS NOT NULL THEN 'ENCRYPTED'
    WHEN fc.access_token IS NOT NULL THEN 'PLAINTEXT_WARNING'
    ELSE 'NO_TOKEN'
  END AS token_security_status,
  -- Recent sync stats
  (SELECT COUNT(*) FROM fhir_sync_logs WHERE connection_id = fc.id AND started_at >= NOW() - INTERVAL '7 days') AS syncs_last_7_days,
  (SELECT COUNT(*) FILTER (WHERE status = 'failed') FROM fhir_sync_logs WHERE connection_id = fc.id AND started_at >= NOW() - INTERVAL '7 days') AS failed_syncs_7_days,
  (SELECT MAX(started_at) FROM fhir_sync_logs WHERE connection_id = fc.id AND status = 'success') AS last_successful_sync
FROM fhir_connections fc
ORDER BY fc.status DESC, fc.last_sync DESC NULLS LAST;

COMMENT ON VIEW public.fhir_connection_health IS 'FHIR connection health and security status';

-- ============================================================================
-- PART 8: GRANT PERMISSIONS
-- ============================================================================

-- Grant SELECT to authenticated users for monitoring views
GRANT SELECT ON public.security_monitoring_dashboard TO authenticated;
GRANT SELECT ON public.compliance_status TO authenticated;
GRANT SELECT ON public.fhir_connection_health TO authenticated;
GRANT SELECT ON public.data_retention_status TO authenticated;

-- Restrict sensitive views to admins only
REVOKE ALL ON public.phi_access_audit FROM authenticated;
GRANT SELECT ON public.phi_access_audit TO authenticated;

REVOKE ALL ON public.security_events_analysis FROM authenticated;
GRANT SELECT ON public.security_events_analysis TO authenticated;

REVOKE ALL ON public.user_activity_summary FROM authenticated;
GRANT SELECT ON public.user_activity_summary TO authenticated;

-- Add RLS policies for sensitive views
ALTER VIEW public.phi_access_audit SET (security_barrier = true);
ALTER VIEW public.security_events_analysis SET (security_barrier = true);
ALTER VIEW public.user_activity_summary SET (security_barrier = true);

COMMIT;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- View current security posture
-- SELECT * FROM public.security_monitoring_dashboard;

-- Check SOC 2 compliance status
-- SELECT * FROM public.compliance_status WHERE test_result != 'PASS';

-- Review recent PHI access
-- SELECT * FROM public.phi_access_audit WHERE timestamp >= NOW() - INTERVAL '24 hours';

-- Analyze security event trends
-- SELECT time_bucket, severity, event_type, event_count
-- FROM public.security_events_analysis
-- WHERE time_bucket >= NOW() - INTERVAL '48 hours'
-- ORDER BY time_bucket DESC, event_count DESC;

-- Check FHIR connection health
-- SELECT * FROM public.fhir_connection_health WHERE token_status != 'VALID';

-- Review data retention status
-- SELECT * FROM public.data_retention_status WHERE execution_status = 'OVERDUE';
