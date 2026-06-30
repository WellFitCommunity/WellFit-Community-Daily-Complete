-- Widen wearable_vital_signs.vital_type CHECK constraint
--
-- WHY: The live constraint only allowed 5 values
--   ('heart_rate','blood_pressure','oxygen_saturation','temperature','respiratory_rate').
-- This silently rejected glucometer and scale readings — breaking BOTH the existing
-- manual entry on the Glucometer/Scale device pages (DeviceService.saveGlucoseReading
-- wrote 'glucose', saveWeightReading wrote 'weight') AND the BLE sync path
-- (ble-sync writes 'blood_glucose' / 'weight' / 'body_temperature').
--
-- This migration is additive only. No existing rows use the new values (they could not
-- have been inserted under the old constraint), so no data backfill is required.
--
-- Canonical naming decision (see docs/trackers/ble-vitals-enrollment-tracker.md):
--   glucose is standardized as 'blood_glucose' everywhere; DeviceService is being
--   updated to match in the BLE wiring work. 'glucose' is intentionally NOT added.
--
-- Verified against live DB 2026-06-30 (project xkybsjnvuohpqpbkikyn) before authoring.

ALTER TABLE public.wearable_vital_signs
  DROP CONSTRAINT IF EXISTS wearable_vital_signs_vital_type_check;

ALTER TABLE public.wearable_vital_signs
  ADD CONSTRAINT wearable_vital_signs_vital_type_check
  CHECK (vital_type = ANY (ARRAY[
    'heart_rate',
    'blood_pressure',
    'oxygen_saturation',
    'temperature',
    'respiratory_rate',
    'blood_glucose',
    'weight',
    'body_temperature'
  ]::text[]));

COMMENT ON CONSTRAINT wearable_vital_signs_vital_type_check ON public.wearable_vital_signs
  IS 'Allowed vital_type values. Widened 2026-06-30 to add blood_glucose, weight, body_temperature so glucometer/scale/thermometer readings (manual + BLE) can persist.';
