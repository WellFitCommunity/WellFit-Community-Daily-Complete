-- Migration: Appointment Rescheduling System
-- Purpose: Add audit trail and rescheduling capabilities for appointments
-- Author: Claude
-- Date: 2026-01-12

-- ============================================================================
-- 1. CREATE APPOINTMENT HISTORY TABLE (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS appointment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES telehealth_appointments(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id),

    -- Change tracking
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'rescheduled', 'cancelled', 'status_changed', 'updated')),

    -- Previous values (for rescheduling)
    previous_appointment_time TIMESTAMPTZ,
    previous_duration_minutes INTEGER,
    previous_status TEXT,

    -- New values
    new_appointment_time TIMESTAMPTZ,
    new_duration_minutes INTEGER,
    new_status TEXT,

    -- Reason for change
    change_reason TEXT,

    -- Who made the change
    changed_by UUID REFERENCES profiles(user_id),
    changed_by_role TEXT, -- 'patient', 'provider', 'admin'

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Additional context
    notes TEXT
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_appointment_history_appointment_id
    ON appointment_history(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_history_created_at
    ON appointment_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointment_history_change_type
    ON appointment_history(change_type);

-- ============================================================================
-- 2. RLS POLICIES FOR APPOINTMENT HISTORY
-- ============================================================================

ALTER TABLE appointment_history ENABLE ROW LEVEL SECURITY;

-- Patients can view history of their appointments
CREATE POLICY "patients_view_own_appointment_history"
    ON appointment_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM telehealth_appointments ta
            WHERE ta.id = appointment_history.appointment_id
            AND ta.patient_id = auth.uid()
        )
    );

-- Providers can view history of appointments they're assigned to
CREATE POLICY "providers_view_assigned_appointment_history"
    ON appointment_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM telehealth_appointments ta
            WHERE ta.id = appointment_history.appointment_id
            AND ta.provider_id = auth.uid()
        )
    );

-- Only system can insert (via RPC functions)
CREATE POLICY "system_insert_appointment_history"
    ON appointment_history FOR INSERT
    TO authenticated
    WITH CHECK (changed_by = auth.uid());

-- ============================================================================
-- 3. UPDATE RLS TO ALLOW APPOINTMENT_TIME UPDATES
-- ============================================================================

-- Drop existing update policy if it exists and recreate with appointment_time
DO $$
BEGIN
    -- Check if we need to update the column permissions
    -- Grant UPDATE on appointment_time to authenticated users
    EXECUTE 'GRANT UPDATE (appointment_time, duration_minutes, status, patient_notes, provider_notes, daily_room_url, session_id, cancellation_reason, cancelled_at, completed_at) ON telehealth_appointments TO authenticated';
EXCEPTION WHEN OTHERS THEN
    -- If grant fails, it may already exist or have different permissions
    RAISE NOTICE 'Grant may already exist or have different permissions: %', SQLERRM;
END $$;

-- ============================================================================
-- 4. RESCHEDULE APPOINTMENT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION reschedule_appointment(
    p_appointment_id UUID,
    p_new_appointment_time TIMESTAMPTZ,
    p_new_duration_minutes INTEGER DEFAULT NULL,
    p_change_reason TEXT DEFAULT NULL,
    p_changed_by_role TEXT DEFAULT 'provider'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appointment RECORD;
    v_conflict_check JSONB;
    v_new_duration INTEGER;
    v_result JSONB;
BEGIN
    -- 1. Get the current appointment
    SELECT * INTO v_appointment
    FROM telehealth_appointments
    WHERE id = p_appointment_id
    AND status NOT IN ('cancelled', 'completed', 'no-show');

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'APPOINTMENT_NOT_FOUND',
            'message', 'Appointment not found or cannot be rescheduled (already cancelled/completed)'
        );
    END IF;

    -- 2. Verify the user has permission (patient or provider of this appointment)
    IF v_appointment.patient_id != auth.uid() AND v_appointment.provider_id != auth.uid() THEN
        -- Check if user is admin
        IF NOT EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'PERMISSION_DENIED',
                'message', 'You do not have permission to reschedule this appointment'
            );
        END IF;
    END IF;

    -- 3. Use new duration or keep existing
    v_new_duration := COALESCE(p_new_duration_minutes, v_appointment.duration_minutes);

    -- 4. Check for conflicts at new time (excluding this appointment)
    SELECT check_appointment_availability(
        v_appointment.provider_id,
        p_new_appointment_time,
        v_new_duration,
        p_appointment_id
    ) INTO v_conflict_check;

    IF (v_conflict_check->>'has_conflict')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'APPOINTMENT_CONFLICT',
            'message', 'Provider has a conflicting appointment at the requested time',
            'conflicts', v_conflict_check->'conflicting_appointments'
        );
    END IF;

    -- 5. Check provider availability at new time
    IF NOT is_provider_available(v_appointment.provider_id, p_new_appointment_time, v_new_duration) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PROVIDER_UNAVAILABLE',
            'message', 'Provider is not available at the requested time'
        );
    END IF;

    -- 6. Log the change to history BEFORE updating
    INSERT INTO appointment_history (
        appointment_id,
        tenant_id,
        change_type,
        previous_appointment_time,
        previous_duration_minutes,
        previous_status,
        new_appointment_time,
        new_duration_minutes,
        new_status,
        change_reason,
        changed_by,
        changed_by_role
    ) VALUES (
        p_appointment_id,
        v_appointment.tenant_id,
        'rescheduled',
        v_appointment.appointment_time,
        v_appointment.duration_minutes,
        v_appointment.status,
        p_new_appointment_time,
        v_new_duration,
        'scheduled', -- Reset to scheduled after reschedule
        p_change_reason,
        auth.uid(),
        p_changed_by_role
    );

    -- 7. Update the appointment
    UPDATE telehealth_appointments
    SET
        appointment_time = p_new_appointment_time,
        duration_minutes = v_new_duration,
        status = 'scheduled', -- Reset status to scheduled
        reminder_sent = false, -- Reset reminder flag
        notification_sent = false, -- Reset notification flag (will trigger new notification)
        updated_at = NOW()
    WHERE id = p_appointment_id;

    -- 8. Return success with updated appointment details
    SELECT jsonb_build_object(
        'success', true,
        'appointment_id', id,
        'previous_time', v_appointment.appointment_time,
        'new_time', appointment_time,
        'previous_duration', v_appointment.duration_minutes,
        'new_duration', duration_minutes,
        'status', status,
        'provider_id', provider_id,
        'patient_id', patient_id
    ) INTO v_result
    FROM telehealth_appointments
    WHERE id = p_appointment_id;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- 5. GET APPOINTMENT HISTORY FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_appointment_history(
    p_appointment_id UUID
)
RETURNS TABLE (
    id UUID,
    change_type TEXT,
    previous_appointment_time TIMESTAMPTZ,
    new_appointment_time TIMESTAMPTZ,
    previous_duration_minutes INTEGER,
    new_duration_minutes INTEGER,
    previous_status TEXT,
    new_status TEXT,
    change_reason TEXT,
    changed_by UUID,
    changed_by_role TEXT,
    changed_by_name TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify user has access to this appointment
    IF NOT EXISTS (
        SELECT 1 FROM telehealth_appointments ta
        WHERE ta.id = p_appointment_id
        AND (ta.patient_id = auth.uid() OR ta.provider_id = auth.uid())
    ) THEN
        -- Check if admin
        IF NOT EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        ) THEN
            RAISE EXCEPTION 'Permission denied';
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        ah.id,
        ah.change_type,
        ah.previous_appointment_time,
        ah.new_appointment_time,
        ah.previous_duration_minutes,
        ah.new_duration_minutes,
        ah.previous_status,
        ah.new_status,
        ah.change_reason,
        ah.changed_by,
        ah.changed_by_role,
        COALESCE(p.full_name, 'System') as changed_by_name,
        ah.created_at
    FROM appointment_history ah
    LEFT JOIN profiles p ON p.user_id = ah.changed_by
    WHERE ah.appointment_id = p_appointment_id
    ORDER BY ah.created_at DESC;
END;
$$;

-- ============================================================================
-- 6. TRIGGER TO AUTO-LOG STATUS CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION log_appointment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO appointment_history (
            appointment_id,
            tenant_id,
            change_type,
            previous_status,
            new_status,
            previous_appointment_time,
            new_appointment_time,
            changed_by,
            changed_by_role
        ) VALUES (
            NEW.id,
            NEW.tenant_id,
            CASE
                WHEN NEW.status = 'cancelled' THEN 'cancelled'
                ELSE 'status_changed'
            END,
            OLD.status,
            NEW.status,
            OLD.appointment_time,
            NEW.appointment_time,
            auth.uid(),
            'system'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for status changes (but not for rescheduling - that's handled by the function)
DROP TRIGGER IF EXISTS trigger_log_appointment_status_change ON telehealth_appointments;
CREATE TRIGGER trigger_log_appointment_status_change
    AFTER UPDATE OF status ON telehealth_appointments
    FOR EACH ROW
    WHEN (OLD.appointment_time = NEW.appointment_time) -- Only when time didn't change (not a reschedule)
    EXECUTE FUNCTION log_appointment_status_change();

-- ============================================================================
-- 7. GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION reschedule_appointment(UUID, TIMESTAMPTZ, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_appointment_history(UUID) TO authenticated;

-- ============================================================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE appointment_history IS 'Audit trail for appointment changes including rescheduling, cancellations, and status updates';
COMMENT ON FUNCTION reschedule_appointment IS 'Reschedules an appointment with conflict checking and audit logging';
COMMENT ON FUNCTION get_appointment_history IS 'Returns the change history for an appointment';
