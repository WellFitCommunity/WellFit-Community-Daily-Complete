-- Migration: Provider Availability System
-- Purpose: Functions for checking provider availability and generating time slots
-- Builds on existing fhir_practitioners.availability_hours and fhir_practitioner_roles

-- ============================================================================
-- PROVIDER BLOCKED TIMES TABLE
-- ============================================================================
-- Stores vacation, PTO, and blocked time periods for providers
CREATE TABLE IF NOT EXISTS provider_blocked_times (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT,

    -- Time range
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,

    -- Metadata
    reason TEXT,  -- 'vacation', 'pto', 'training', 'meeting', 'personal', 'other'
    description TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSONB,  -- For future recurring blocks

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(user_id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provider_blocked_times_provider ON provider_blocked_times(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_blocked_times_time_range ON provider_blocked_times(provider_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_provider_blocked_times_tenant ON provider_blocked_times(tenant_id);

-- RLS
ALTER TABLE provider_blocked_times ENABLE ROW LEVEL SECURITY;

-- Providers can view and manage their own blocked times
CREATE POLICY "Providers can manage own blocked times"
    ON provider_blocked_times FOR ALL
    USING (auth.uid() = provider_id);

-- Admins can view all blocked times in their tenant
CREATE POLICY "Admins can view blocked times"
    ON provider_blocked_times FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- ============================================================================
-- FUNCTION: Get provider's weekly availability hours
-- ============================================================================
CREATE OR REPLACE FUNCTION get_provider_availability_hours(p_provider_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_availability JSONB;
BEGIN
    -- First try to get from fhir_practitioners
    SELECT fp.availability_hours
    INTO v_availability
    FROM fhir_practitioners fp
    WHERE fp.user_id = p_provider_id
    AND fp.active = true;

    -- If found, return it
    IF v_availability IS NOT NULL THEN
        RETURN v_availability;
    END IF;

    -- Default availability if not set (Mon-Fri 9am-5pm)
    RETURN jsonb_build_object(
        'monday', jsonb_build_object('start', '09:00', 'end', '17:00'),
        'tuesday', jsonb_build_object('start', '09:00', 'end', '17:00'),
        'wednesday', jsonb_build_object('start', '09:00', 'end', '17:00'),
        'thursday', jsonb_build_object('start', '09:00', 'end', '17:00'),
        'friday', jsonb_build_object('start', '09:00', 'end', '17:00')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Check if provider is available at a specific time
-- ============================================================================
CREATE OR REPLACE FUNCTION is_provider_available(
    p_provider_id UUID,
    p_start_time TIMESTAMPTZ,
    p_duration_minutes INTEGER
)
RETURNS TABLE (
    is_available BOOLEAN,
    reason TEXT,
    conflicting_appointment_id UUID,
    blocked_time_id UUID
) AS $$
DECLARE
    v_end_time TIMESTAMPTZ;
    v_day_name TEXT;
    v_availability JSONB;
    v_day_hours JSONB;
    v_time_only TIME;
    v_day_start TIME;
    v_day_end TIME;
    v_conflict_apt UUID;
    v_conflict_block UUID;
BEGIN
    v_end_time := p_start_time + (p_duration_minutes || ' minutes')::INTERVAL;
    v_day_name := LOWER(TO_CHAR(p_start_time, 'day'));
    v_day_name := TRIM(v_day_name);  -- Remove trailing spaces
    v_time_only := p_start_time::TIME;

    -- Get provider's availability hours
    v_availability := get_provider_availability_hours(p_provider_id);
    v_day_hours := v_availability->v_day_name;

    -- Check 1: Is this day in provider's working days?
    IF v_day_hours IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Provider does not work on ' || v_day_name, NULL::UUID, NULL::UUID;
        RETURN;
    END IF;

    -- Check 2: Is this time within provider's working hours?
    v_day_start := (v_day_hours->>'start')::TIME;
    v_day_end := (v_day_hours->>'end')::TIME;

    IF v_time_only < v_day_start OR (v_time_only + (p_duration_minutes || ' minutes')::INTERVAL)::TIME > v_day_end THEN
        RETURN QUERY SELECT FALSE,
            'Outside working hours (' || v_day_start::TEXT || ' - ' || v_day_end::TEXT || ')',
            NULL::UUID, NULL::UUID;
        RETURN;
    END IF;

    -- Check 3: Is there a blocked time period?
    SELECT id INTO v_conflict_block
    FROM provider_blocked_times
    WHERE provider_id = p_provider_id
    AND start_time < v_end_time
    AND end_time > p_start_time
    LIMIT 1;

    IF v_conflict_block IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, 'Provider has blocked time', NULL::UUID, v_conflict_block;
        RETURN;
    END IF;

    -- Check 4: Is there a conflicting appointment?
    SELECT id INTO v_conflict_apt
    FROM telehealth_appointments
    WHERE provider_id = p_provider_id
    AND status NOT IN ('cancelled', 'no-show')
    AND appointment_time < v_end_time
    AND (appointment_time + (duration_minutes || ' minutes')::INTERVAL) > p_start_time
    LIMIT 1;

    IF v_conflict_apt IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, 'Provider has existing appointment', v_conflict_apt, NULL::UUID;
        RETURN;
    END IF;

    -- All checks passed
    RETURN QUERY SELECT TRUE, NULL::TEXT, NULL::UUID, NULL::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Get available time slots for a provider on a date
-- ============================================================================
CREATE OR REPLACE FUNCTION get_available_slots(
    p_provider_id UUID,
    p_date DATE,
    p_duration_minutes INTEGER DEFAULT 30,
    p_slot_interval_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
    slot_start TIMESTAMPTZ,
    slot_end TIMESTAMPTZ,
    is_available BOOLEAN
) AS $$
DECLARE
    v_day_name TEXT;
    v_availability JSONB;
    v_day_hours JSONB;
    v_day_start TIME;
    v_day_end TIME;
    v_current_slot TIMESTAMPTZ;
    v_slot_end TIMESTAMPTZ;
    v_slot_available BOOLEAN;
BEGIN
    v_day_name := LOWER(TO_CHAR(p_date, 'day'));
    v_day_name := TRIM(v_day_name);

    -- Get provider's availability hours
    v_availability := get_provider_availability_hours(p_provider_id);
    v_day_hours := v_availability->v_day_name;

    -- If provider doesn't work this day, return empty
    IF v_day_hours IS NULL THEN
        RETURN;
    END IF;

    v_day_start := (v_day_hours->>'start')::TIME;
    v_day_end := (v_day_hours->>'end')::TIME;

    -- Generate slots for the day
    v_current_slot := p_date + v_day_start;

    WHILE (v_current_slot::TIME + (p_duration_minutes || ' minutes')::INTERVAL)::TIME <= v_day_end LOOP
        v_slot_end := v_current_slot + (p_duration_minutes || ' minutes')::INTERVAL;

        -- Check if this slot is available
        SELECT avail.is_available INTO v_slot_available
        FROM is_provider_available(p_provider_id, v_current_slot, p_duration_minutes) avail;

        RETURN QUERY SELECT v_current_slot, v_slot_end, v_slot_available;

        v_current_slot := v_current_slot + (p_slot_interval_minutes || ' minutes')::INTERVAL;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Update provider availability hours
-- ============================================================================
CREATE OR REPLACE FUNCTION update_provider_availability(
    p_provider_id UUID,
    p_availability_hours JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    v_practitioner_id UUID;
BEGIN
    -- Get practitioner ID
    SELECT id INTO v_practitioner_id
    FROM fhir_practitioners
    WHERE user_id = p_provider_id;

    -- If practitioner exists, update
    IF v_practitioner_id IS NOT NULL THEN
        UPDATE fhir_practitioners
        SET availability_hours = p_availability_hours,
            updated_at = NOW()
        WHERE id = v_practitioner_id;
        RETURN TRUE;
    END IF;

    -- If no practitioner record exists, create one
    INSERT INTO fhir_practitioners (user_id, availability_hours, active)
    VALUES (p_provider_id, p_availability_hours, true);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_provider_availability_hours(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_provider_available(UUID, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_slots(UUID, DATE, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_provider_availability(UUID, JSONB) TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON provider_blocked_times TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE provider_blocked_times IS
'Stores vacation, PTO, and blocked time periods for healthcare providers';

COMMENT ON FUNCTION get_provider_availability_hours(UUID) IS
'Returns the weekly availability hours for a provider from fhir_practitioners table';

COMMENT ON FUNCTION is_provider_available(UUID, TIMESTAMPTZ, INTEGER) IS
'Checks if a provider is available at a specific time, considering working hours, blocked times, and existing appointments';

COMMENT ON FUNCTION get_available_slots(UUID, DATE, INTEGER, INTEGER) IS
'Generates available appointment slots for a provider on a specific date';

COMMENT ON FUNCTION update_provider_availability(UUID, JSONB) IS
'Updates or creates provider availability hours in fhir_practitioners table';

-- ============================================================================
-- TRIGGER: Auto-set tenant_id on provider_blocked_times
-- ============================================================================
CREATE OR REPLACE FUNCTION set_blocked_time_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM profiles
        WHERE user_id = NEW.provider_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_blocked_time_tenant ON provider_blocked_times;
CREATE TRIGGER trigger_set_blocked_time_tenant
    BEFORE INSERT ON provider_blocked_times
    FOR EACH ROW
    EXECUTE FUNCTION set_blocked_time_tenant_id();
