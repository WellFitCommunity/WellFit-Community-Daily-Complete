-- ============================================================================
-- Fix: allow alert_type = 'guardian_approval_required' on security_alerts
-- ============================================================================
--
-- DISCOVERED 2026-05-29 (GRD-6 live proof): create_guardian_review_ticket()
-- inserts a security_alerts row with alert_type='guardian_approval_required',
-- but security_alerts_alert_type_check never included that value. Every call
-- therefore raised a CHECK violation, so NO Guardian review ticket could be
-- created — the entire approval workflow was dead at the DB layer
-- (guardian_review_tickets has 0 rows in production, consistent with this).
--
-- Migration drift: the RPC's value and the constraint's allowlist diverged.
-- Fix = widen the allowlist to include the value the RPC was written to use.
-- Non-destructive (adds one permitted value; existing rows unaffected).
-- ============================================================================

BEGIN;

ALTER TABLE public.security_alerts
  DROP CONSTRAINT IF EXISTS security_alerts_alert_type_check;

ALTER TABLE public.security_alerts
  ADD CONSTRAINT security_alerts_alert_type_check CHECK (
    alert_type = ANY (ARRAY[
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
      'guardian_approval_required'
    ]::text[])
  );

COMMIT;
