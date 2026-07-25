-- Repair create_alert_from_critical_security_event(): the alert trigger was
-- KILLING every HIGH/CRITICAL security_events insert platform-wide.
--
-- Live evidence (2026-07-24, rolled-back probe):
--   * security_events has ZERO rows since inception. Every writer failed on
--     one of: lowercase severity vs the UPPERCASE CHECK, missing description
--     (NOT NULL), a nonexistent created_at column — and any correctly-shaped
--     HIGH/CRITICAL insert then errored inside THIS trigger:
--       - NEW.user_agent does not exist (live column: actor_user_agent)
--       - alert_type mapping 'unauthorized_access' is not in the
--         security_alerts_alert_type_check allowlist
--     AFTER INSERT trigger error => the security event itself ROLLED BACK.
--     (Same landmine class as trg_flag_critical_labs, repaired 20260723210000.)
--
-- Repair (fail-safe pattern): live columns only, honest CHECK-legal mappings,
-- and the alert INSERT wrapped in EXCEPTION — a failed alert can never again
-- destroy the security event it was meant to escalate. SECURITY DEFINER so
-- browser-side (authenticated) security events still produce alerts even
-- though only service_role writes security_alerts directly.

CREATE OR REPLACE FUNCTION public.create_alert_from_critical_security_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.severity IN ('HIGH', 'CRITICAL') THEN
    BEGIN
      INSERT INTO security_alerts (
        severity,
        alert_type,
        title,
        description,
        metadata,
        status,
        affected_user_id,
        tenant_id,
        detection_method
      ) VALUES (
        LOWER(NEW.severity),
        CASE NEW.category
          WHEN 'authentication' THEN 'brute_force_attack'
          WHEN 'authorization' THEN 'security_policy_violation'
          WHEN 'data_access' THEN 'data_exfiltration'
          ELSE 'anomalous_behavior'
        END,
        NEW.event_type,
        NEW.description,
        jsonb_build_object(
          'security_event_id', NEW.id,
          'category', NEW.category,
          'ip_address', NEW.ip_address::TEXT,
          'user_agent', NEW.actor_user_agent
        ),
        'new',
        NEW.user_id,
        NEW.tenant_id,
        CASE WHEN NEW.detection_method IN ('rule_based','threshold','anomaly','manual')
             THEN NEW.detection_method ELSE NULL END
      ) ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Fail-safe: preserve the security event even if alerting breaks again.
      RAISE WARNING 'create_alert_from_critical_security_event failed: % (security_event % preserved)', SQLERRM, NEW.id;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.create_alert_from_critical_security_event() IS
  'AFTER INSERT on security_events: spawns a security_alerts row for HIGH/CRITICAL events. Fail-safe — alert failure warns instead of rolling back the security event. Repaired 20260724 (user_agent -> actor_user_agent, CHECK-legal alert_type mapping, tenant_id carried).';
