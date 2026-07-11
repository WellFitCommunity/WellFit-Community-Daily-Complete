-- ============================================================================
-- Restore SOC 2 monitoring views (islanded — never existed live)
-- ============================================================================
-- The SOC2/Security/Guardian dashboards read five aggregate views that were
-- defined in 20251019000001_soc2_views_clean.sql but are NOT present in the
-- live DB (verified 2026-07-11 via information_schema / to_regclass). Their
-- absence is the bulk of the dashboards' console-error wall (each read 404s,
-- the service swallows the error and returns []/null, so the dashboards render
-- empty). This restores them, ADAPTED to the CURRENT live column set — the
-- 2025-10 definitions drifted:
--   * security_events.actor_ip_address  ->  security_events.ip_address
--   * data_retention_policies.enabled   ->  data_retention_policies.is_active
-- and hardened to `security_invoker = on` (supabase.md §3 — the 2025 defs were
-- DEFINER, an RLS-bypass hole) + explicit GRANT (supabase.md §2a). RLS verified
-- to admit super_admin / tenant_admin reads, so the views return rows.
--
-- NOT restored here (deliberate): encryption_status_view — the live
-- encryption_keys table has LOST key_purpose / key_algorithm, so the view can
-- only be restored after a schema decision (do not fabricate those fields).
-- audit_summary_stats already exists live and is left untouched.
--
-- Forward-only: NO `-- migrate:down` block (db push executes down blocks; see
-- the migrate:down + db push footgun). Every object is CREATE OR REPLACE, safe
-- to re-run.
-- ============================================================================

-- 1) Real-time security metrics (single-row aggregate over security_events + audit_logs)
CREATE OR REPLACE VIEW public.security_monitoring_dashboard
WITH (security_invoker = on) AS
SELECT
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours') AS security_events_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND severity = 'CRITICAL') AS critical_events_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND severity = 'HIGH') AS high_events_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND severity = 'MEDIUM') AS medium_events_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND severity = 'LOW') AS low_events_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND event_type = 'AUTH_FAILED') AS failed_logins_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '1 hour' AND event_type = 'AUTH_FAILED') AS failed_logins_1h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND event_type = 'UNAUTHORIZED_ACCESS') AS unauthorized_access_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours' AND auto_blocked = TRUE) AS auto_blocked_24h,
  (SELECT COUNT(*) FROM public.security_events WHERE requires_investigation = TRUE AND investigated = FALSE) AS open_investigations,
  (SELECT COUNT(*) FROM public.audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours') AS audit_events_24h,
  (SELECT COUNT(*) FROM public.audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours' AND success = FALSE) AS failed_operations_24h,
  (SELECT COUNT(*) FROM public.audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours' AND event_category = 'PHI_ACCESS') AS phi_access_24h,
  NOW() AS last_updated;

GRANT SELECT ON public.security_monitoring_dashboard TO authenticated;

-- 2) PHI access audit trail (view over audit_logs, PHI_ACCESS category only).
-- actor_email / patient_name are derived from audit metadata (COALESCE -> 'Unknown'),
-- NOT raw PHI columns. Admin/super_admin gated via security_invoker + audit_logs RLS.
CREATE OR REPLACE VIEW public.phi_access_audit
WITH (security_invoker = on) AS
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

GRANT SELECT ON public.phi_access_audit TO authenticated;

-- 3) Hourly security-event trends (7-day window).
-- ADAPTED: se.actor_ip_address -> se.ip_address (2025 def referenced a column
-- that no longer exists on security_events).
CREATE OR REPLACE VIEW public.security_events_analysis
WITH (security_invoker = on) AS
SELECT
  date_trunc('hour', se.timestamp) AS hour,
  se.event_type,
  se.severity,
  COUNT(*) AS event_count,
  COUNT(DISTINCT se.actor_user_id) AS unique_actors,
  COUNT(DISTINCT se.ip_address) AS unique_ips,
  COUNT(*) FILTER (WHERE se.auto_blocked = TRUE) AS auto_blocked_count,
  COUNT(*) FILTER (WHERE se.requires_investigation = TRUE) AS investigation_required_count,
  MAX(se.timestamp) AS latest_occurrence
FROM public.security_events se
WHERE se.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY date_trunc('hour', se.timestamp), se.event_type, se.severity
ORDER BY hour DESC, event_count DESC;

GRANT SELECT ON public.security_events_analysis TO authenticated;

-- 4) Incident response queue (open investigations with SLA scoring).
-- ADAPTED: se.ip_address aliased AS actor_ip_address to match the service's
-- IncidentResponseItem contract (which uses actor_ip_address).
CREATE OR REPLACE VIEW public.incident_response_queue
WITH (security_invoker = on) AS
SELECT
  se.id,
  se.event_type,
  se.severity,
  se.timestamp,
  se.actor_user_id,
  se.ip_address AS actor_ip_address,
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
  EXTRACT(EPOCH FROM NOW() - se.timestamp) / 3600 AS hours_since_event,
  CASE se.severity
    WHEN 'CRITICAL' THEN 4
    WHEN 'HIGH' THEN 3
    WHEN 'MEDIUM' THEN 2
    ELSE 1
  END AS priority_score,
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

GRANT SELECT ON public.incident_response_queue TO authenticated;

-- 5) SOC 2 control compliance snapshot.
-- ADAPTED: data_retention_policies.enabled -> data_retention_policies.is_active
-- (the live column). encryption_keys.is_active is real; no other drift.
CREATE OR REPLACE VIEW public.compliance_status
WITH (security_invoker = on) AS
SELECT
  'Audit Logging' AS control_area,
  'CC7.3' AS soc2_criterion,
  'Monitor and detect unauthorized access' AS control_description,
  CASE
    WHEN (SELECT COUNT(*) FROM public.audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours') > 0
    THEN 'COMPLIANT' ELSE 'NON_COMPLIANT'
  END AS status,
  'Audit logs active with ' || (SELECT COUNT(*) FROM public.audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours')::TEXT || ' events in last 24h' AS details,
  CASE
    WHEN (SELECT COUNT(*) FROM public.audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours') > 0
    THEN 'PASS' ELSE 'FAIL'
  END AS test_result,
  NOW() AS last_checked
UNION ALL
SELECT
  'Data Encryption', 'PI1.4', 'Encrypt PHI data at rest and in transit',
  CASE
    WHEN (SELECT COUNT(*) FROM public.encryption_keys WHERE is_active = TRUE) > 0
    THEN 'COMPLIANT' ELSE 'NON_COMPLIANT'
  END,
  'Active encryption keys: ' || (SELECT COUNT(*) FROM public.encryption_keys WHERE is_active = TRUE)::TEXT,
  CASE
    WHEN (SELECT COUNT(*) FROM public.encryption_keys WHERE is_active = TRUE) > 0
    THEN 'PASS' ELSE 'FAIL'
  END,
  NOW()
UNION ALL
SELECT
  'Security Monitoring', 'CC7.2', 'Monitor system for security events and anomalies',
  CASE
    WHEN (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours') >= 0
    THEN 'COMPLIANT' ELSE 'NON_COMPLIANT'
  END,
  'Security monitoring active with ' || (SELECT COUNT(*) FROM public.security_events WHERE timestamp >= NOW() - INTERVAL '24 hours')::TEXT || ' events in last 24h',
  'PASS',
  NOW()
UNION ALL
SELECT
  'Access Control', 'CC6.1', 'Restrict access to authorized users only',
  CASE
    WHEN (SELECT COUNT(*) FROM public.security_events WHERE event_type = 'UNAUTHORIZED_ACCESS' AND timestamp >= NOW() - INTERVAL '24 hours') < 10
    THEN 'COMPLIANT' ELSE 'NEEDS_REVIEW'
  END,
  'Unauthorized access attempts: ' || (SELECT COUNT(*) FROM public.security_events WHERE event_type = 'UNAUTHORIZED_ACCESS' AND timestamp >= NOW() - INTERVAL '24 hours')::TEXT,
  CASE
    WHEN (SELECT COUNT(*) FROM public.security_events WHERE event_type = 'UNAUTHORIZED_ACCESS' AND timestamp >= NOW() - INTERVAL '24 hours') < 10
    THEN 'PASS' ELSE 'REVIEW'
  END,
  NOW()
UNION ALL
SELECT
  'Data Retention', 'A1.2', 'Maintain audit logs for required retention period',
  CASE
    WHEN (SELECT COUNT(*) FROM public.data_retention_policies WHERE is_active = TRUE) > 0
    THEN 'COMPLIANT' ELSE 'NON_COMPLIANT'
  END,
  'Active retention policies: ' || (SELECT COUNT(*) FROM public.data_retention_policies WHERE is_active = TRUE)::TEXT,
  CASE
    WHEN (SELECT COUNT(*) FROM public.data_retention_policies WHERE is_active = TRUE) > 0
    THEN 'PASS' ELSE 'FAIL'
  END,
  NOW()
UNION ALL
SELECT
  'Incident Response', 'CC7.4', 'Respond to security incidents in a timely manner',
  CASE
    WHEN (SELECT COUNT(*) FROM public.security_events WHERE requires_investigation = TRUE AND investigated = FALSE AND severity = 'CRITICAL' AND timestamp < NOW() - INTERVAL '1 hour') = 0
    THEN 'COMPLIANT' ELSE 'NON_COMPLIANT'
  END,
  'Open critical incidents: ' || (SELECT COUNT(*) FROM public.security_events WHERE requires_investigation = TRUE AND investigated = FALSE AND severity = 'CRITICAL')::TEXT,
  CASE
    WHEN (SELECT COUNT(*) FROM public.security_events WHERE requires_investigation = TRUE AND investigated = FALSE AND severity = 'CRITICAL' AND timestamp < NOW() - INTERVAL '1 hour') = 0
    THEN 'PASS' ELSE 'FAIL'
  END,
  NOW();

GRANT SELECT ON public.compliance_status TO authenticated;
