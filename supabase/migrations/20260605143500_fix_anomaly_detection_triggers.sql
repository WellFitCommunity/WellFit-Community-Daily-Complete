-- Fix the two anomaly_detections triggers that referenced columns the table never
-- had. Both were silent show-stoppers: ANY insert into anomaly_detections aborted,
-- which is why the table was always empty and the whole behavioral-anomaly subsystem
-- (detection -> alert) was islanded. Verified live 2026-06-05.
--
-- These are pure column-drift bug fixes — the intended behavior is restored, nothing
-- is removed.

-- 1) BEFORE INSERT retention stamp: referenced NEW.created_at (no such column).
--    The real timestamp column is detected_at (defaults to now()).
CREATE OR REPLACE FUNCTION public.update_anomaly_retention()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.retention_expires_at := COALESCE(NEW.detected_at, now()) + INTERVAL '2 years';
  RETURN NEW;
END;
$function$;

-- 2) AFTER INSERT alert creation: referenced NEW.anomaly_type / NEW.risk_score /
--    NEW.details. Real columns are event_type / aggregate_anomaly_score /
--    anomaly_breakdown. Also propagate tenant_id for tenant isolation on the alert.
CREATE OR REPLACE FUNCTION public.create_alert_from_anomaly()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  alert_severity TEXT;
BEGIN
  -- Map risk level to alert severity
  CASE
    WHEN NEW.risk_level = 'CRITICAL' THEN alert_severity := 'critical';
    WHEN NEW.risk_level = 'HIGH' THEN alert_severity := 'high';
    WHEN NEW.risk_level = 'MEDIUM' THEN alert_severity := 'medium';
    ELSE alert_severity := 'low';
  END CASE;

  -- Only create alerts for CRITICAL and HIGH risk anomalies
  IF NEW.risk_level IN ('CRITICAL', 'HIGH') THEN
    INSERT INTO security_alerts (
      severity,
      alert_type,
      title,
      description,
      metadata,
      status,
      affected_user_id,
      detection_method,
      confidence_score,
      tenant_id
    ) VALUES (
      alert_severity,
      'anomalous_behavior',
      format('Anomaly Detected: %s', COALESCE(NEW.event_type, 'behavioral_anomaly')),
      format('Behavioral anomaly detected for user. Risk score: %s',
             ROUND(NEW.aggregate_anomaly_score::numeric, 2)),
      jsonb_build_object(
        'anomaly_id', NEW.id,
        'event_type', NEW.event_type,
        'aggregate_anomaly_score', NEW.aggregate_anomaly_score,
        'risk_level', NEW.risk_level,
        'anomaly_breakdown', NEW.anomaly_breakdown
      ),
      'new',
      NEW.user_id,
      'anomaly',
      NEW.aggregate_anomaly_score::numeric,
      NEW.tenant_id
    );
  END IF;

  RETURN NEW;
END;
$function$;
