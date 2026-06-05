-- guardian-agent raises operational alerts (database errors, slow queries) that had
-- no matching value in the security_alerts.alert_type CHECK enum. Guardian's alert
-- INSERT therefore failed the CHECK for those checks. Add the two missing types so
-- the alert is recorded with its true category instead of being mislabeled or dropped.

ALTER TABLE public.security_alerts
  DROP CONSTRAINT IF EXISTS security_alerts_alert_type_check;

ALTER TABLE public.security_alerts
  ADD CONSTRAINT security_alerts_alert_type_check
  CHECK (alert_type = ANY (ARRAY[
    'failed_login_spike',
    'unusual_phi_access',
    'privilege_escalation',
    'mfa_bypass_attempt',
    'bulk_data_export',
    'after_hours_access',
    'suspicious_ip',
    'brute_force_attack',
    'account_takeover',
    'data_exfiltration',
    'unauthorized_api_access',
    'database_schema_change',
    'security_policy_violation',
    'anomalous_behavior',
    'guardian_approval_required',
    'database_error',
    'slow_query'
  ]::text[]));
