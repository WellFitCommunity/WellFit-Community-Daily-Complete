-- Migration: Appointment Double-Booking Prevention
-- Purpose: Prevent scheduling overlapping appointments for the same provider
-- Critical Bug Fix: Providers could have multiple appointments at the same time

-- ============================================================================
-- ENABLE btree_gist EXTENSION (required for exclusion constraints with ranges)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- CREATE INDEX FOR CONFLICT CHECKING
-- ============================================================================
-- Composite index for efficient conflict queries (end time is calculated on the fly)
CREATE INDEX IF NOT EXISTS idx_telehealth_appointments_provider_time_conflict
ON telehealth_appointments (provider_id, appointment_time, duration_minutes)
WHERE status NOT IN ('cancelled', 'no-show');

-- ============================================================================
-- EXCLUSION CONSTRAINT TO PREVENT OVERLAPPING APPOINTMENTS
-- ============================================================================
-- This constraint uses a GiST index to efficiently prevent overlapping time ranges
-- for the same provider. It only applies to non-cancelled appointments.
--
-- Note: PostgreSQL exclusion constraints can't use WHERE clauses directly,
-- so we use a trigger-based approach for active appointments only.

-- ============================================================================
-- TRIGGER FUNCTION: CHECK FOR APPOINTMENT CONFLICTS
-- ============================================================================
CREATE OR REPLACE FUNCTION check_appointment_conflict()
RETURNS TRIGGER AS $$
DECLARE
    v_end_time TIMESTAMPTZ;
    v_conflict_count INTEGER;
    v_conflicting_patient TEXT;
    v_conflicting_time TEXT;
BEGIN
    -- Calculate end time for the new/updated appointment
    v_end_time := NEW.appointment_time + (NEW.duration_minutes || ' minutes')::INTERVAL;

    -- Only check for non-cancelled, non-no-show appointments
    IF NEW.status IN ('cancelled', 'no-show') THEN
        RETURN NEW;
    END IF;

    -- Check for overlapping appointments for the same provider
    -- Two time ranges overlap if: start1 < end2 AND start2 < end1
    SELECT COUNT(*),
           MIN(p.first_name || ' ' || p.last_name),
           MIN(TO_CHAR(ta.appointment_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI'))
    INTO v_conflict_count, v_conflicting_patient, v_conflicting_time
    FROM telehealth_appointments ta
    LEFT JOIN profiles p ON p.user_id = ta.patient_id
    WHERE ta.provider_id = NEW.provider_id
      AND ta.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND ta.status NOT IN ('cancelled', 'no-show')
      AND ta.appointment_time < v_end_time
      AND (ta.appointment_time + (ta.duration_minutes || ' minutes')::INTERVAL) > NEW.appointment_time;

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'APPOINTMENT_CONFLICT: Provider already has an appointment at this time. Conflicting appointment with % at %',
            COALESCE(v_conflicting_patient, 'Unknown Patient'),
            v_conflicting_time
        USING ERRCODE = 'unique_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_check_appointment_conflict ON telehealth_appointments;

-- Create the trigger
CREATE TRIGGER trigger_check_appointment_conflict
    BEFORE INSERT OR UPDATE OF appointment_time, duration_minutes, status, provider_id
    ON telehealth_appointments
    FOR EACH ROW
    EXECUTE FUNCTION check_appointment_conflict();

-- ============================================================================
-- HELPER FUNCTION: CHECK FOR CONFLICTS (for UI pre-validation)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_appointment_availability(
    p_provider_id UUID,
    p_appointment_time TIMESTAMPTZ,
    p_duration_minutes INTEGER,
    p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE (
    has_conflict BOOLEAN,
    conflict_count INTEGER,
    conflicting_appointments JSONB
) AS $$
DECLARE
    v_end_time TIMESTAMPTZ;
BEGIN
    v_end_time := p_appointment_time + (p_duration_minutes || ' minutes')::INTERVAL;

    RETURN QUERY
    SELECT
        COUNT(*) > 0 AS has_conflict,
        COUNT(*)::INTEGER AS conflict_count,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', ta.id,
                    'patient_name', COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
                    'appointment_time', ta.appointment_time,
                    'duration_minutes', ta.duration_minutes,
                    'encounter_type', ta.encounter_type
                )
            ) FILTER (WHERE ta.id IS NOT NULL),
            '[]'::JSONB
        ) AS conflicting_appointments
    FROM telehealth_appointments ta
    LEFT JOIN profiles p ON p.user_id = ta.patient_id
    WHERE ta.provider_id = p_provider_id
      AND ta.id != COALESCE(p_exclude_appointment_id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND ta.status NOT IN ('cancelled', 'no-show')
      AND ta.appointment_time < v_end_time
      AND (ta.appointment_time + (ta.duration_minutes || ' minutes')::INTERVAL) > p_appointment_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_appointment_availability(UUID, TIMESTAMPTZ, INTEGER, UUID) TO authenticated;

-- ============================================================================
-- COMMENT DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION check_appointment_conflict() IS
'Trigger function that prevents double-booking by checking for overlapping appointments for the same provider';

COMMENT ON FUNCTION check_appointment_availability(UUID, TIMESTAMPTZ, INTEGER, UUID) IS
'RPC function for UI to check if a proposed appointment time conflicts with existing appointments';
