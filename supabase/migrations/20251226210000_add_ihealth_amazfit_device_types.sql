-- =====================================================
-- ADD IHEALTH AND AMAZFIT DEVICE TYPES
-- =====================================================
-- Extends wearable_connections device_type to include iHealth and Amazfit

-- Drop the existing constraint
ALTER TABLE wearable_connections DROP CONSTRAINT IF EXISTS wearable_connections_device_type_check;

-- Add the new constraint with ihealth and amazfit
ALTER TABLE wearable_connections ADD CONSTRAINT wearable_connections_device_type_check
CHECK (device_type = ANY (ARRAY[
    'apple_watch'::text,
    'fitbit'::text,
    'garmin'::text,
    'samsung_health'::text,
    'withings'::text,
    'empatica'::text,
    'ihealth'::text,
    'amazfit'::text,
    'other'::text
]));

COMMENT ON TABLE wearable_connections IS 'Stores connections to wearable devices (Apple Watch, Fitbit, Garmin, Samsung Health, Withings, Empatica, iHealth, Amazfit, etc.)';
