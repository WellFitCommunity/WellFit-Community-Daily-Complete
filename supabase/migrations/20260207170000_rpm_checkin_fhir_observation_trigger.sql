-- ============================================================================
-- RPM Check-in → FHIR Observation Trigger
-- ============================================================================
-- Purpose: Automatically create fhir_observations when check_ins are inserted
-- with vital sign data, making home vitals visible to external EHR systems.
--
-- Uses same LOINC mappings as migrate_check_ins_to_observations() from
-- 20251017120000_fhir_observations.sql but runs as a trigger (real-time)
-- rather than a batch migration.
--
-- Date: 2026-02-07
-- ============================================================================

-- ============================================================================
-- 1. Trigger Function
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_checkin_to_fhir_observation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Heart rate → LOINC 8867-4
  IF NEW.heart_rate IS NOT NULL THEN
    INSERT INTO public.fhir_observations (
      patient_id, status, category, code, code_display,
      value_quantity_value, value_quantity_unit, value_quantity_code,
      effective_datetime, issued, check_in_id, sync_source
    ) VALUES (
      NEW.user_id, 'final', ARRAY['vital-signs'],
      '8867-4', 'Heart rate',
      NEW.heart_rate, '/min', '/min',
      COALESCE(NEW.timestamp, now()), now(), NEW.id, 'check_in_trigger'
    );
  END IF;

  -- Oxygen saturation → LOINC 2708-6
  IF NEW.pulse_oximeter IS NOT NULL THEN
    INSERT INTO public.fhir_observations (
      patient_id, status, category, code, code_display,
      value_quantity_value, value_quantity_unit, value_quantity_code,
      effective_datetime, issued, check_in_id, sync_source
    ) VALUES (
      NEW.user_id, 'final', ARRAY['vital-signs'],
      '2708-6', 'Oxygen saturation',
      NEW.pulse_oximeter, '%', '%',
      COALESCE(NEW.timestamp, now()), now(), NEW.id, 'check_in_trigger'
    );
  END IF;

  -- Blood pressure panel → LOINC 85354-9 (with systolic/diastolic components)
  IF NEW.bp_systolic IS NOT NULL AND NEW.bp_diastolic IS NOT NULL THEN
    INSERT INTO public.fhir_observations (
      patient_id, status, category, code, code_display,
      effective_datetime, issued, check_in_id, sync_source,
      components
    ) VALUES (
      NEW.user_id, 'final', ARRAY['vital-signs'],
      '85354-9', 'Blood pressure panel',
      COALESCE(NEW.timestamp, now()), now(), NEW.id, 'check_in_trigger',
      jsonb_build_array(
        jsonb_build_object(
          'code', '8480-6',
          'display', 'Systolic blood pressure',
          'value', NEW.bp_systolic,
          'unit', 'mmHg'
        ),
        jsonb_build_object(
          'code', '8462-4',
          'display', 'Diastolic blood pressure',
          'value', NEW.bp_diastolic,
          'unit', 'mmHg'
        )
      )
    );
  END IF;

  -- Glucose → LOINC 2339-0
  IF NEW.glucose_mg_dl IS NOT NULL THEN
    INSERT INTO public.fhir_observations (
      patient_id, status, category, code, code_display,
      value_quantity_value, value_quantity_unit, value_quantity_code,
      effective_datetime, issued, check_in_id, sync_source
    ) VALUES (
      NEW.user_id, 'final', ARRAY['vital-signs'],
      '2339-0', 'Glucose',
      NEW.glucose_mg_dl, 'mg/dL', 'mg/dL',
      COALESCE(NEW.timestamp, now()), now(), NEW.id, 'check_in_trigger'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Attach Trigger (AFTER INSERT to avoid blocking check-in writes)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_checkin_to_fhir_observation ON public.check_ins;

CREATE TRIGGER trg_checkin_to_fhir_observation
  AFTER INSERT ON public.check_ins
  FOR EACH ROW
  EXECUTE FUNCTION fn_checkin_to_fhir_observation();

-- ============================================================================
-- 3. Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'RPM Check-in → FHIR Observation Trigger Migration Complete';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Trigger: trg_checkin_to_fhir_observation on check_ins AFTER INSERT';
  RAISE NOTICE 'LOINC mappings: 8867-4 (HR), 2708-6 (SpO2), 85354-9 (BP), 2339-0 (glucose)';
  RAISE NOTICE 'sync_source = ''check_in_trigger'' to distinguish from batch migration';
  RAISE NOTICE '=================================================================';
END $$;
