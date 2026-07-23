-- L-0 (intake-and-labs-gap-tracker-2026-07-14): trg_flag_critical_labs inserted into
-- public.emergency_alerts — a table that has NEVER existed live — so ANY insert of a
-- critical lab result (abnormal_flag critical_low/critical_high) errored with
-- undefined_table and ROLLED BACK. Normal results stored fine; the most dangerous
-- results were exactly the ones the DB rejected.
--
-- D2 decision (repoint vs create): REPOINT to care_team_alerts — one alert surface,
-- already read by the care-team dashboards and written by the readmission pipeline.
-- emergency_alerts stays nonexistent; its two code callers (EnhancedFhirServiceClass,
-- mobile-sync) are repointed to care_team_alerts in the same commit.

-- 1) Widen care_team_alerts.alert_type CHECK with honest values for the repointed
--    writers (existing semantics reuse existing values: VITAL_ANOMALY→vitals_declining,
--    MISSED_CHECKINS→missed_check_ins, RISK_ESCALATION→pattern_concerning).
ALTER TABLE public.care_team_alerts DROP CONSTRAINT care_team_alerts_alert_type_check;
ALTER TABLE public.care_team_alerts ADD CONSTRAINT care_team_alerts_alert_type_check
  CHECK (alert_type = ANY (ARRAY[
    'patient_stopped_responding'::text,
    'vitals_declining'::text,
    'missed_check_ins'::text,
    'medication_non_adherence'::text,
    'er_visit_detected'::text,
    'readmission_risk_high'::text,
    'urgent_care_visit'::text,
    'pattern_concerning'::text,
    'critical_lab_result'::text,
    'emergency_incident'::text,
    'geofence_breach'::text
  ]));

-- 2) Rewrite the trigger function:
--    * target care_team_alerts (severity 'critical', priority 'emergency')
--    * SECURITY DEFINER — care_team_alerts INSERT RLS is admin-only
--      (care_alerts_admin_and_assigned WITH CHECK is_admin) and the clinician
--      inserting a lab result may not be an admin; DEFINER matches the
--      notify_ld_alert / auto_dispatch_departments trigger precedent.
--    * FAIL-SAFE — an alert-insert failure logs a WARNING and must NEVER roll
--      back the lab result itself.
CREATE OR REPLACE FUNCTION public.flag_critical_lab_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.abnormal_flag IN ('critical_low', 'critical_high') THEN
    BEGIN
      INSERT INTO public.care_team_alerts (
        patient_id,
        alert_type,
        severity,
        priority,
        title,
        description,
        alert_data
      ) VALUES (
        NEW.patient_id,
        'critical_lab_result',
        'critical',
        'emergency',
        'Critical Lab Result: ' || NEW.test_name,
        'Result: ' || NEW.value || ' ' || COALESCE(NEW.unit, '')
          || ' (Ref: ' || COALESCE(NEW.reference_range, 'N/A') || ')',
        jsonb_build_object(
          'lab_result_id', NEW.id,
          'test_name', NEW.test_name,
          'test_code', NEW.test_code,
          'value', NEW.value,
          'abnormal_flag', NEW.abnormal_flag,
          'tenant_id', NEW.tenant_id,
          'source', 'trg_flag_critical_labs'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'flag_critical_lab_results: alert insert failed for lab_result %: %',
        NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.flag_critical_lab_results() IS
  'AFTER INSERT trigger on lab_results: critical_low/critical_high results create a '
  'care_team_alerts row (critical/emergency). Fail-safe: alert failure never blocks '
  'the lab insert. Repointed from nonexistent emergency_alerts 2026-07-23 (L-0).';
