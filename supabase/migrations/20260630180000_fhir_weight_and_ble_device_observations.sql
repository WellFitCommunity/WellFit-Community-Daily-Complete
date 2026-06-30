-- ============================================================================
-- Session C (FHIR sub-item) — Weight in check-in trigger + BLE device → FHIR
-- ============================================================================
-- Purpose:
--   1. Add Body Weight (LOINC 29463-7) to the existing check-in → FHIR
--      Observation trigger (it currently maps HR, SpO2, BP, glucose only).
--   2. Add a NEW trigger on `wearable_vital_signs` so BLE device readings
--      (BP cuff, glucometer, pulse-ox, scale) reach `fhir_observations` the
--      same way check-in vitals already do — closing the "home vitals invisible
--      to external EHR" gap for device-captured readings.
--
-- Verified live before authoring (rule 18):
--   - check_ins.weight exists (numeric, nullable)
--   - fhir_observations.code_system DEFAULT 'http://loinc.org', fhir_id DEFAULT
--     gen_random_uuid()::text  → INSERTs may omit both (NOT NULL satisfied)
--   - fhir_observations.device_id is text → cast wearable device_id (uuid)
--   - no trigger yet on wearable_vital_signs
--   - wearable_vital_signs composite shape: vital_type, value, unit, metadata
--     (BP stores value=systolic, metadata={systolic,diastolic,pulse})
--
-- Tracker: docs/trackers/ble-vitals-enrollment-tracker.md (Session C, FHIR item)
-- Date: 2026-06-30
-- ============================================================================

-- ============================================================================
-- 1. Check-in trigger function — add Body Weight (LOINC 29463-7)
--    Full redefinition (CREATE OR REPLACE) preserving all existing mappings.
--    Also adds SET search_path = public (required for SECURITY DEFINER).
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_checkin_to_fhir_observation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Body weight → LOINC 29463-7  (NEW)
  IF NEW.weight IS NOT NULL THEN
    INSERT INTO public.fhir_observations (
      patient_id, status, category, code, code_display,
      value_quantity_value, value_quantity_unit, value_quantity_code,
      effective_datetime, issued, check_in_id, sync_source
    ) VALUES (
      NEW.user_id, 'final', ARRAY['vital-signs'],
      '29463-7', 'Body weight',
      NEW.weight, 'lb', '[lb_av]',
      COALESCE(NEW.timestamp, now()), now(), NEW.id, 'check_in_trigger'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. NEW: BLE device reading → FHIR Observation trigger function
--    Maps the composite-row wearable_vital_signs shape to LOINC observations.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_wearable_to_fhir_observation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia numeric;
BEGIN
  -- Blood pressure: value=systolic, metadata={systolic,diastolic,pulse}
  IF NEW.vital_type = 'blood_pressure' THEN
    v_dia := NULLIF(NEW.metadata->>'diastolic', '')::numeric;
    IF v_dia IS NOT NULL THEN
      INSERT INTO public.fhir_observations (
        patient_id, tenant_id, status, category, code, code_display,
        effective_datetime, issued, device_id, sync_source, components
      ) VALUES (
        NEW.user_id, NEW.tenant_id, 'final', ARRAY['vital-signs'],
        '85354-9', 'Blood pressure panel',
        NEW.measured_at, now(), NEW.device_id::text, 'ble_device_trigger',
        jsonb_build_array(
          jsonb_build_object(
            'code', '8480-6', 'display', 'Systolic blood pressure',
            'value', COALESCE(NULLIF(NEW.metadata->>'systolic','')::numeric, NEW.value),
            'unit', 'mmHg'
          ),
          jsonb_build_object(
            'code', '8462-4', 'display', 'Diastolic blood pressure',
            'value', v_dia, 'unit', 'mmHg'
          )
        )
      );
    ELSE
      -- Diastolic absent → record systolic only (LOINC 8480-6)
      INSERT INTO public.fhir_observations (
        patient_id, tenant_id, status, category, code, code_display,
        value_quantity_value, value_quantity_unit, value_quantity_code,
        effective_datetime, issued, device_id, sync_source
      ) VALUES (
        NEW.user_id, NEW.tenant_id, 'final', ARRAY['vital-signs'],
        '8480-6', 'Systolic blood pressure',
        NEW.value, 'mmHg', 'mm[Hg]',
        NEW.measured_at, now(), NEW.device_id::text, 'ble_device_trigger'
      );
    END IF;

  ELSIF NEW.vital_type = 'blood_glucose' THEN
    INSERT INTO public.fhir_observations (
      patient_id, tenant_id, status, category, code, code_display,
      value_quantity_value, value_quantity_unit, value_quantity_code,
      effective_datetime, issued, device_id, sync_source
    ) VALUES (
      NEW.user_id, NEW.tenant_id, 'final', ARRAY['vital-signs'],
      '2339-0', 'Glucose',
      NEW.value, COALESCE(NEW.unit, 'mg/dL'), 'mg/dL',
      NEW.measured_at, now(), NEW.device_id::text, 'ble_device_trigger'
    );

  ELSIF NEW.vital_type = 'oxygen_saturation' THEN
    INSERT INTO public.fhir_observations (
      patient_id, tenant_id, status, category, code, code_display,
      value_quantity_value, value_quantity_unit, value_quantity_code,
      effective_datetime, issued, device_id, sync_source
    ) VALUES (
      NEW.user_id, NEW.tenant_id, 'final', ARRAY['vital-signs'],
      '2708-6', 'Oxygen saturation',
      NEW.value, '%', '%',
      NEW.measured_at, now(), NEW.device_id::text, 'ble_device_trigger'
    );

  ELSIF NEW.vital_type = 'weight' THEN
    INSERT INTO public.fhir_observations (
      patient_id, tenant_id, status, category, code, code_display,
      value_quantity_value, value_quantity_unit, value_quantity_code,
      effective_datetime, issued, device_id, sync_source
    ) VALUES (
      NEW.user_id, NEW.tenant_id, 'final', ARRAY['vital-signs'],
      '29463-7', 'Body weight',
      NEW.value, COALESCE(NEW.unit, 'lb'), '[lb_av]',
      NEW.measured_at, now(), NEW.device_id::text, 'ble_device_trigger'
    );

  ELSIF NEW.vital_type = 'heart_rate' THEN
    INSERT INTO public.fhir_observations (
      patient_id, tenant_id, status, category, code, code_display,
      value_quantity_value, value_quantity_unit, value_quantity_code,
      effective_datetime, issued, device_id, sync_source
    ) VALUES (
      NEW.user_id, NEW.tenant_id, 'final', ARRAY['vital-signs'],
      '8867-4', 'Heart rate',
      NEW.value, '/min', '/min',
      NEW.measured_at, now(), NEW.device_id::text, 'ble_device_trigger'
    );

  ELSIF NEW.vital_type IN ('temperature', 'body_temperature') THEN
    INSERT INTO public.fhir_observations (
      patient_id, tenant_id, status, category, code, code_display,
      value_quantity_value, value_quantity_unit, value_quantity_code,
      effective_datetime, issued, device_id, sync_source
    ) VALUES (
      NEW.user_id, NEW.tenant_id, 'final', ARRAY['vital-signs'],
      '8310-5', 'Body temperature',
      NEW.value, COALESCE(NEW.unit, 'degF'), COALESCE(NEW.unit, 'degF'),
      NEW.measured_at, now(), NEW.device_id::text, 'ble_device_trigger'
    );
  END IF;
  -- Unmapped vital_types are intentionally ignored (no-op).

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. Attach wearable trigger (AFTER INSERT — never blocks the device write)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_wearable_to_fhir_observation ON public.wearable_vital_signs;

CREATE TRIGGER trg_wearable_to_fhir_observation
  AFTER INSERT ON public.wearable_vital_signs
  FOR EACH ROW
  EXECUTE FUNCTION fn_wearable_to_fhir_observation();

-- ============================================================================
-- 4. Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'FHIR weight + BLE device observation triggers installed';
  RAISE NOTICE 'check-in: added Body weight 29463-7 (now HR/SpO2/BP/glucose/weight)';
  RAISE NOTICE 'wearable: BP 85354-9, glucose 2339-0, SpO2 2708-6, weight 29463-7,';
  RAISE NOTICE '          HR 8867-4, temp 8310-5 (sync_source = ble_device_trigger)';
  RAISE NOTICE '=================================================================';
END $$;
