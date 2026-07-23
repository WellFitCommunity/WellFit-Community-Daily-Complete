-- Honest alert types for Guardian self-reports (2026-07-23).
--
-- Investigation of the 3 escalated HIGH 'unauthorized_api_access' alerts from
-- 2026-07-10 06:45 found they were NOT access-control events: they were the
-- browser Guardian's failed self-healing reports for an mcp-postgres-server
-- outage (redeployed healthy 2026-07-11). DatabaseAuditLogger maps category
-- 'api_failure' -> alert_type 'unauthorized_api_access' because the CHECK enum
-- had no honest value — an availability blip masquerading as a security breach
-- in the alert log is a compliance problem.
--
-- Also: createBlockedActionAlert writes alert_type 'guardian_action_blocked',
-- which is NOT in the enum — every such insert has failed the CHECK silently
-- (the 2026-07-10 blocked-retry events produced zero alert rows).
--
-- Live-verified current enum before writing (rule 18): failed_login_spike,
-- unusual_phi_access, privilege_escalation, mfa_bypass_attempt,
-- bulk_data_export, after_hours_access, suspicious_ip, brute_force_attack,
-- account_takeover, data_exfiltration, unauthorized_api_access,
-- database_schema_change, security_policy_violation, anomalous_behavior,
-- guardian_approval_required, database_error, slow_query.

ALTER TABLE public.security_alerts
  DROP CONSTRAINT security_alerts_alert_type_check;

ALTER TABLE public.security_alerts
  ADD CONSTRAINT security_alerts_alert_type_check CHECK (alert_type = ANY (ARRAY[
    'failed_login_spike'::text,
    'unusual_phi_access'::text,
    'privilege_escalation'::text,
    'mfa_bypass_attempt'::text,
    'bulk_data_export'::text,
    'after_hours_access'::text,
    'suspicious_ip'::text,
    'brute_force_attack'::text,
    'account_takeover'::text,
    'data_exfiltration'::text,
    'unauthorized_api_access'::text,
    'database_schema_change'::text,
    'security_policy_violation'::text,
    'anomalous_behavior'::text,
    'guardian_approval_required'::text,
    'database_error'::text,
    'slow_query'::text,
    -- New (2026-07-23): honest self-report types for the Guardian agent.
    'api_failure'::text,            -- availability failure of an API/edge function (NOT an access event)
    'guardian_action_blocked'::text -- Guardian healing action stopped by its own safety constraints
  ]));

COMMENT ON CONSTRAINT security_alerts_alert_type_check ON public.security_alerts IS
  'Allowed alert_type values. api_failure and guardian_action_blocked added 2026-07-23 so Guardian availability self-reports stop masquerading as unauthorized_api_access (and blocked-action alerts stop failing the CHECK silently).';
