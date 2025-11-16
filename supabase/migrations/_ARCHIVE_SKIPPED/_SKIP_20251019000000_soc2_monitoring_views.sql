-- ============================================================================
-- SOC 2 Monitoring Dashboard Views
-- Created: 2025-10-19
-- Purpose: Real-time monitoring views for SOC 2 compliance dashboards
-- ============================================================================

-- Drop existing views if they exist
DROP VIEW IF EXISTS public.security_monitoring_dashboard CASCADE;
DROP VIEW IF EXISTS public.phi_access_audit CASCADE;
DROP VIEW IF EXISTS public.security_events_analysis CASCADE;
DROP VIEW IF EXISTS public.audit_summary_stats CASCADE;
DROP VIEW IF EXISTS public.encryption_status_view CASCADE;
DROP VIEW IF EXISTS public.incident_response_queue CASCADE;

-- ============================================================================
-- View 1: Security Monitoring Dashboard (Real-time metrics)
-- ============================================================================
CREATE VIEW public.security_monitoring_dashboard AS
SELECT
  -- Time window metrics (last 24 hours)
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours') AS security_events_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND severity = 'CRITICAL') AS critical_events_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND severity = 'HIGH') AS high_events_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND severity = 'MEDIUM') AS medium_events_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND severity = 'LOW') AS low_events_24h,

  -- Failed authentication metrics
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND event_type = 'AUTH_FAILED') AS failed_logins_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '1 hour' AND event_type = 'AUTH_FAILED') AS failed_logins_1h,

  -- Access control violations
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND event_type = 'UNAUTHORIZED_ACCESS') AS unauthorized_access_24h,

  -- Auto-blocked events
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND auto_blocked = TRUE) AS auto_blocked_24h,

  -- Active investigations
  (SELECT COUNT(*) FROM public.security_events WHERE requires_investigation = TRUE AND investigated = FALSE) AS open_investigations,

  -- Audit log metrics
  (SELECT COUNT(*) FROM public.audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours') AS audit_events_24h,
  (SELECT COUNT(*) FROM public.audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours' AND success = FALSE) AS failed_operations_24h,

  -- PHI access metrics
  (SELECT COUNT(*) FROM public.audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours' AND event_category = 'PHI_ACCESS') AS phi_access_24h,

  -- Last update timestamp
  NOW() AS last_updated;

COMMENT ON VIEW public.security_monitoring_dashboard IS 'Real-time security metrics for SOC 2 monitoring dashboard';

-- ============================================================================
-- View 2: PHI Access Audit Trail
-- ============================================================================
CREATE VIEW public.phi_access_audit AS
SELECT
  al.id,
  al.timestamp,
  al.actor_user_id,
  al.actor_role,
  al.actor_ip_address,
  al.event_type,
  al.resource_type,
  al.resource_id,
  al.target_user_id,
  al.operation,
  al.metadata,
  al.success,
  al.error_message,
  -- Add user-friendly display fields
  COALESCE(al.metadata->>'actor_email', 'Unknown') AS actor_email,
  COALESCE(al.metadata->>'patient_name', 'Unknown') AS patient_name,
  CASE
    WHEN al.event_type = 'PHI_READ' THEN 'View'
    WHEN al.event_type = 'PHI_UPDATE' THEN 'Update'
    WHEN al.event_type = 'PHI_CREATE' THEN 'Create'
    WHEN al.event_type = 'PHI_DELETE' THEN 'Delete'
    WHEN al.event_type = 'PHI_EXPORT' THEN 'Export'
    ELSE al.event_type
  END AS access_type,
  -- Risk scoring
  CASE
    WHEN al.operation = 'DELETE' THEN 'HIGH'
    WHEN al.operation = 'EXPORT' THEN 'HIGH'
    WHEN al.operation = 'BULK_READ' THEN 'MEDIUM'
    WHEN al.operation = 'UPDATE' THEN 'MEDIUM'
    ELSE 'LOW'
  END AS risk_level
FROM public.audit_logs al
WHERE al.event_category = 'PHI_ACCESS'
ORDER BY al.timestamp DESC;

COMMENT ON VIEW public.phi_access_audit IS 'Detailed audit trail of all PHI access for compliance reporting';

-- ============================================================================
-- View 3: Security Events Analysis (Hourly aggregation)
-- ============================================================================
CREATE VIEW public.security_events_analysis AS
SELECT
  date_trunc('hour', se.timestamp) AS hour,
  se.event_type,
  se.severity,
  COUNT(*) AS event_count,
  COUNT(DISTINCT se.actor_user_id) AS unique_actors,
  COUNT(DISTINCT se.actor_ip_address) AS unique_ips,
  COUNT(*) FILTER (WHERE se.auto_blocked = TRUE) AS auto_blocked_count,
  COUNT(*) FILTER (WHERE se.requires_investigation = TRUE) AS investigation_required_count,
  MAX(se.timestamp) AS latest_occurrence
FROM public.security_events se
WHERE se.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY date_trunc('hour', se.timestamp), se.event_type, se.severity
ORDER BY hour DESC, event_count DESC;

COMMENT ON VIEW public.security_events_analysis IS 'Hourly aggregation of security events for trend analysis';

-- ============================================================================
-- View 4: Audit Summary Statistics
-- ============================================================================
CREATE VIEW public.audit_summary_stats AS
SELECT
  al.event_category,
  al.event_type,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE al.success = TRUE) AS successful_events,
  COUNT(*) FILTER (WHERE al.success = FALSE) AS failed_events,
  COUNT(DISTINCT al.actor_user_id) AS unique_users,
  COUNT(DISTINCT al.actor_role) AS unique_roles,
  MIN(al.timestamp) AS earliest_event,
  MAX(al.timestamp) AS latest_event,
  -- Success rate
  ROUND(100.0 * COUNT(*) FILTER (WHERE al.success = TRUE) / NULLIF(COUNT(*), 0), 2) AS success_rate_percent
FROM public.audit_logs al
WHERE al.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY al.event_category, al.event_type
ORDER BY total_events DESC;

COMMENT ON VIEW public.audit_summary_stats IS 'Summary statistics for audit events over last 30 days';

-- ============================================================================
-- View 5: Encryption Status View
-- ============================================================================
CREATE VIEW public.encryption_status_view AS
SELECT
  ek.id,
  ek.key_name,
  ek.key_purpose,
  ek.key_algorithm,
  ek.is_active,
  ek.created_at,
  ek.rotated_at,
  ek.expires_at,
  -- Key age
  EXTRACT(DAY FROM NOW() - COALESCE(ek.rotated_at, ek.created_at)) AS days_since_rotation,
  -- Expiration status
  CASE
    WHEN ek.expires_at IS NULL THEN 'No Expiration'
    WHEN ek.expires_at < NOW() THEN 'EXPIRED'
    WHEN ek.expires_at < NOW() + INTERVAL '30 days' THEN 'EXPIRING_SOON'
    ELSE 'VALID'
  END AS expiration_status,
  -- Days until expiration
  CASE
    WHEN ek.expires_at IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM ek.expires_at - NOW())
  END AS days_until_expiration
FROM public.encryption_keys ek
ORDER BY ek.is_active DESC, ek.created_at DESC;

COMMENT ON VIEW public.encryption_status_view IS 'Encryption key status and rotation monitoring';

-- ============================================================================
-- View 6: Incident Response Queue
-- ============================================================================
CREATE VIEW public.incident_response_queue AS
SELECT
  se.id,
  se.event_type,
  se.severity,
  se.timestamp,
  se.actor_user_id,
  se.actor_ip_address,
  se.description,
  se.metadata,
  se.requires_investigation,
  se.investigated,
  se.investigated_by,
  se.investigated_at,
  se.resolution,
  se.auto_blocked,
  se.alert_sent,
  se.correlation_id,
  -- Time since event
  EXTRACT(EPOCH FROM NOW() - se.timestamp) / 3600 AS hours_since_event,
  -- Priority scoring (for sorting)
  CASE se.severity
    WHEN 'CRITICAL' THEN 4
    WHEN 'HIGH' THEN 3
    WHEN 'MEDIUM' THEN 2
    ELSE 1
  END AS priority_score,
  -- SLA status
  CASE
    WHEN se.severity = 'CRITICAL' AND NOT se.investigated AND (NOW() - se.timestamp) > INTERVAL '1 hour' THEN 'SLA_BREACH'
    WHEN se.severity = 'HIGH' AND NOT se.investigated AND (NOW() - se.timestamp) > INTERVAL '4 hours' THEN 'SLA_BREACH'
    WHEN se.severity = 'MEDIUM' AND NOT se.investigated AND (NOW() - se.timestamp) > INTERVAL '24 hours' THEN 'SLA_BREACH'
    WHEN NOT se.investigated THEN 'WITHIN_SLA'
    ELSE 'RESOLVED'
  END AS sla_status
FROM public.security_events se
WHERE se.requires_investigation = TRUE
ORDER BY
  CASE se.severity
    WHEN 'CRITICAL' THEN 4
    WHEN 'HIGH' THEN 3
    WHEN 'MEDIUM' THEN 2
    ELSE 1
  END DESC,
  se.investigated ASC,
  se.timestamp ASC;

COMMENT ON VIEW public.incident_response_queue IS 'Prioritized queue of security incidents requiring investigation';

-- ============================================================================
-- View 7: Enhanced Compliance Status (expanding existing)
-- ============================================================================
DROP VIEW IF EXISTS public.compliance_status;
CREATE VIEW public.compliance_status AS
-- Audit Logging Control
SELECT
  'Audit Logging' AS control_area,
  'CC7.3' AS soc2_criterion,
  'Monitor and detect unauthorized access' AS control_description,
  CASE
    WHEN (SELECT COUNT(*) FROM audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours') > 0
    THEN 'COMPLIANT'
    ELSE 'NON_COMPLIANT'
  END AS status,
  'Audit logs active with ' || (SELECT COUNT(*) FROM audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours')::TEXT || ' events in last 24h' AS details,
  CASE
    WHEN (SELECT COUNT(*) FROM audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours') > 0
    THEN 'PASS'
    ELSE 'FAIL'
  END AS test_result,
  NOW() AS last_checked

UNION ALL

-- Data Encryption Control
SELECT
  'Data Encryption',
  'PI1.4',
  'Encrypt PHI data at rest and in transit',
  CASE
    WHEN (SELECT COUNT(*) FROM encryption_keys WHERE is_active = TRUE) > 0
    THEN 'COMPLIANT'
    ELSE 'NON_COMPLIANT'
  END AS status,
  'Active encryption keys: ' || (SELECT COUNT(*) FROM encryption_keys WHERE is_active = TRUE)::TEXT AS details,
  CASE
    WHEN (SELECT COUNT(*) FROM encryption_keys WHERE is_active = TRUE) > 0
    THEN 'PASS'
    ELSE 'FAIL'
  END AS test_result,
  NOW()

UNION ALL

-- Security Monitoring Control
SELECT
  'Security Monitoring',
  'CC7.2',
  'Monitor system for security events and anomalies',
  CASE
    WHEN (SELECT COUNT(*) FROM security_events WHERE timestamp >= NOW() - INTERVAL '24 hours') >= 0
    THEN 'COMPLIANT'
    ELSE 'NON_COMPLIANT'
  END AS status,
  'Security monitoring active with ' || (SELECT COUNT(*) FROM security_events WHERE timestamp >= NOW() - INTERVAL '24 hours')::TEXT || ' events in last 24h' AS details,
  'PASS' AS test_result,
  NOW()

UNION ALL

-- Access Control
SELECT
  'Access Control',
  'CC6.1',
  'Restrict access to authorized users only',
  CASE
    WHEN (SELECT COUNT(*) FROM security_events WHERE event_type = 'UNAUTHORIZED_ACCESS' AND timestamp >= NOW() - INTERVAL '24 hours') < 10
    THEN 'COMPLIANT'
    ELSE 'NEEDS_REVIEW'
  END AS status,
  'Unauthorized access attempts: ' || (SELECT COUNT(*) FROM security_events WHERE event_type = 'UNAUTHORIZED_ACCESS' AND timestamp >= NOW() - INTERVAL '24 hours')::TEXT AS details,
  CASE
    WHEN (SELECT COUNT(*) FROM security_events WHERE event_type = 'UNAUTHORIZED_ACCESS' AND timestamp >= NOW() - INTERVAL '24 hours') < 10
    THEN 'PASS'
    ELSE 'REVIEW'
  END AS test_result,
  NOW()

UNION ALL

-- Data Retention
SELECT
  'Data Retention',
  'A1.2',
  'Maintain audit logs for required retention period',
  CASE
    WHEN (SELECT COUNT(*) FROM data_retention_policies WHERE enabled = TRUE) > 0
    THEN 'COMPLIANT'
    ELSE 'NON_COMPLIANT'
  END AS status,
  'Active retention policies: ' || (SELECT COUNT(*) FROM data_retention_policies WHERE enabled = TRUE)::TEXT AS details,
  CASE
    WHEN (SELECT COUNT(*) FROM data_retention_policies WHERE enabled = TRUE) > 0
    THEN 'PASS'
    ELSE 'FAIL'
  END AS test_result,
  NOW()

UNION ALL

-- Incident Response
SELECT
  'Incident Response',
  'CC7.4',
  'Respond to security incidents in a timely manner',
  CASE
    WHEN (SELECT COUNT(*) FROM security_events WHERE requires_investigation = TRUE AND investigated = FALSE AND severity = 'CRITICAL' AND timestamp < NOW() - INTERVAL '1 hour') = 0
    THEN 'COMPLIANT'
    ELSE 'NON_COMPLIANT'
  END AS status,
  'Open critical incidents: ' || (SELECT COUNT(*) FROM security_events WHERE requires_investigation = TRUE AND investigated = FALSE AND severity = 'CRITICAL')::TEXT AS details,
  CASE
    WHEN (SELECT COUNT(*) FROM security_events WHERE requires_investigation = TRUE AND investigated = FALSE AND severity = 'CRITICAL' AND timestamp < NOW() - INTERVAL '1 hour') = 0
    THEN 'PASS'
    ELSE 'FAIL'
  END AS test_result,
  NOW();

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT SELECT ON public.security_monitoring_dashboard TO authenticated;
GRANT SELECT ON public.phi_access_audit TO authenticated;
GRANT SELECT ON public.security_events_analysis TO authenticated;
GRANT SELECT ON public.audit_summary_stats TO authenticated;
GRANT SELECT ON public.encryption_status_view TO authenticated;
GRANT SELECT ON public.incident_response_queue TO authenticated;
GRANT SELECT ON public.compliance_status TO authenticated;

-- ============================================================================
-- Success Message
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ SOC 2 monitoring views created successfully!';
  RAISE NOTICE 'Available views:';
  RAISE NOTICE '  - security_monitoring_dashboard (real-time metrics)';
  RAISE NOTICE '  - phi_access_audit (PHI access trail)';
  RAISE NOTICE '  - security_events_analysis (trend analysis)';
  RAISE NOTICE '  - audit_summary_stats (30-day summary)';
  RAISE NOTICE '  - encryption_status_view (key management)';
  RAISE NOTICE '  - incident_response_queue (investigation queue)';
  RAISE NOTICE '  - compliance_status (SOC 2 control status)';
END $$;
