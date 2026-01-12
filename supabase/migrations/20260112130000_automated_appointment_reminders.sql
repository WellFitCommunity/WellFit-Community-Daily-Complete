-- Migration: Automated Appointment Reminders System
-- Purpose: Add infrastructure for automated appointment reminders
-- Author: Claude
-- Date: 2026-01-12

-- ============================================================================
-- 1. CREATE REMINDER PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS appointment_reminder_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id),

    -- Reminder timing preferences (hours before appointment)
    reminder_24h_enabled BOOLEAN DEFAULT true,
    reminder_1h_enabled BOOLEAN DEFAULT true,
    reminder_15m_enabled BOOLEAN DEFAULT false,

    -- Channel preferences
    sms_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,

    -- Do not disturb settings (stored as HH:MM in 24h format)
    dnd_start_time TIME DEFAULT NULL,  -- e.g., '22:00' for 10 PM
    dnd_end_time TIME DEFAULT NULL,    -- e.g., '08:00' for 8 AM

    -- Timezone for DND calculations
    timezone TEXT DEFAULT 'America/Chicago',

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_preferences UNIQUE (user_id)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_reminder_preferences_user_id
    ON appointment_reminder_preferences(user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_reminder_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reminder_preferences_timestamp ON appointment_reminder_preferences;
CREATE TRIGGER trigger_update_reminder_preferences_timestamp
    BEFORE UPDATE ON appointment_reminder_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_reminder_preferences_updated_at();

-- ============================================================================
-- 2. CREATE REMINDER LOG TABLE (Tracks all sent reminders)
-- ============================================================================

CREATE TABLE IF NOT EXISTS appointment_reminder_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES telehealth_appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES profiles(user_id),
    tenant_id UUID REFERENCES tenants(id),

    -- Reminder type
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '1h', '15m', 'custom')),

    -- Delivery channels attempted and their status
    sms_sent BOOLEAN DEFAULT false,
    sms_sid TEXT,  -- Twilio message SID
    sms_status TEXT,  -- 'queued', 'sent', 'delivered', 'failed'
    sms_error TEXT,

    push_sent BOOLEAN DEFAULT false,
    push_status TEXT,
    push_error TEXT,

    email_sent BOOLEAN DEFAULT false,
    email_status TEXT,
    email_error TEXT,

    -- Overall status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'partial', 'failed', 'skipped')),
    skip_reason TEXT,  -- Why reminder was skipped (DND, cancelled appointment, etc.)

    -- Timing
    scheduled_for TIMESTAMPTZ NOT NULL,  -- When reminder was supposed to go out
    sent_at TIMESTAMPTZ,  -- When actually sent
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_reminder_log_appointment_id
    ON appointment_reminder_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_reminder_log_patient_id
    ON appointment_reminder_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_reminder_log_status
    ON appointment_reminder_log(status);
CREATE INDEX IF NOT EXISTS idx_reminder_log_scheduled_for
    ON appointment_reminder_log(scheduled_for);

-- ============================================================================
-- 3. ADD REMINDER TRACKING FIELDS TO APPOINTMENTS
-- ============================================================================

-- Add fields for tracking reminder status per type
DO $$
BEGIN
    -- 24-hour reminder
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'telehealth_appointments' AND column_name = 'reminder_24h_sent'
    ) THEN
        ALTER TABLE telehealth_appointments ADD COLUMN reminder_24h_sent BOOLEAN DEFAULT false;
        ALTER TABLE telehealth_appointments ADD COLUMN reminder_24h_sent_at TIMESTAMPTZ;
    END IF;

    -- 1-hour reminder
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'telehealth_appointments' AND column_name = 'reminder_1h_sent'
    ) THEN
        ALTER TABLE telehealth_appointments ADD COLUMN reminder_1h_sent BOOLEAN DEFAULT false;
        ALTER TABLE telehealth_appointments ADD COLUMN reminder_1h_sent_at TIMESTAMPTZ;
    END IF;

    -- 15-minute reminder
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'telehealth_appointments' AND column_name = 'reminder_15m_sent'
    ) THEN
        ALTER TABLE telehealth_appointments ADD COLUMN reminder_15m_sent BOOLEAN DEFAULT false;
        ALTER TABLE telehealth_appointments ADD COLUMN reminder_15m_sent_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- 4. FUNCTION TO GET APPOINTMENTS NEEDING REMINDERS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_appointments_needing_reminders(
    p_reminder_type TEXT,  -- '24h', '1h', or '15m'
    p_batch_size INTEGER DEFAULT 100
)
RETURNS TABLE (
    appointment_id UUID,
    patient_id UUID,
    patient_name TEXT,
    patient_phone TEXT,
    patient_email TEXT,
    provider_name TEXT,
    appointment_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    encounter_type TEXT,
    reason_for_visit TEXT,
    tenant_id UUID,
    -- Preferences
    sms_enabled BOOLEAN,
    push_enabled BOOLEAN,
    email_enabled BOOLEAN,
    dnd_start_time TIME,
    dnd_end_time TIME,
    timezone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hours_before INTEGER;
    v_reminder_column TEXT;
BEGIN
    -- Determine hours before appointment for each reminder type
    CASE p_reminder_type
        WHEN '24h' THEN
            v_hours_before := 24;
            v_reminder_column := 'reminder_24h_sent';
        WHEN '1h' THEN
            v_hours_before := 1;
            v_reminder_column := 'reminder_1h_sent';
        WHEN '15m' THEN
            v_hours_before := 0;  -- Special handling for 15 minutes
            v_reminder_column := 'reminder_15m_sent';
        ELSE
            RAISE EXCEPTION 'Invalid reminder type: %', p_reminder_type;
    END CASE;

    RETURN QUERY
    SELECT
        ta.id as appointment_id,
        ta.patient_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'Patient') as patient_name,
        p.phone as patient_phone,
        p.email as patient_email,
        COALESCE(pr.first_name || ' ' || pr.last_name, 'Provider') as provider_name,
        ta.appointment_time,
        ta.duration_minutes,
        ta.encounter_type,
        ta.reason_for_visit,
        ta.tenant_id,
        -- Get preferences with defaults
        COALESCE(arp.sms_enabled, true) as sms_enabled,
        COALESCE(arp.push_enabled, true) as push_enabled,
        COALESCE(arp.email_enabled, false) as email_enabled,
        arp.dnd_start_time,
        arp.dnd_end_time,
        COALESCE(arp.timezone, 'America/Chicago') as timezone
    FROM telehealth_appointments ta
    JOIN profiles p ON p.user_id = ta.patient_id
    LEFT JOIN profiles pr ON pr.user_id = ta.provider_id
    LEFT JOIN appointment_reminder_preferences arp ON arp.user_id = ta.patient_id
    WHERE
        -- Only active appointments
        ta.status IN ('scheduled', 'confirmed')
        -- Check the correct reminder hasn't been sent
        AND (
            (p_reminder_type = '24h' AND (ta.reminder_24h_sent IS NULL OR ta.reminder_24h_sent = false))
            OR (p_reminder_type = '1h' AND (ta.reminder_1h_sent IS NULL OR ta.reminder_1h_sent = false))
            OR (p_reminder_type = '15m' AND (ta.reminder_15m_sent IS NULL OR ta.reminder_15m_sent = false))
        )
        -- Check if user has this reminder type enabled (or default to enabled)
        AND (
            (p_reminder_type = '24h' AND COALESCE(arp.reminder_24h_enabled, true))
            OR (p_reminder_type = '1h' AND COALESCE(arp.reminder_1h_enabled, true))
            OR (p_reminder_type = '15m' AND COALESCE(arp.reminder_15m_enabled, false))
        )
        -- Appointment is within the reminder window
        AND (
            (p_reminder_type = '24h' AND ta.appointment_time BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours')
            OR (p_reminder_type = '1h' AND ta.appointment_time BETWEEN NOW() + INTERVAL '55 minutes' AND NOW() + INTERVAL '65 minutes')
            OR (p_reminder_type = '15m' AND ta.appointment_time BETWEEN NOW() + INTERVAL '10 minutes' AND NOW() + INTERVAL '20 minutes')
        )
    ORDER BY ta.appointment_time ASC
    LIMIT p_batch_size;
END;
$$;

-- ============================================================================
-- 5. FUNCTION TO MARK REMINDER AS SENT
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_reminder_sent(
    p_appointment_id UUID,
    p_reminder_type TEXT,
    p_sms_sent BOOLEAN DEFAULT false,
    p_sms_sid TEXT DEFAULT NULL,
    p_push_sent BOOLEAN DEFAULT false,
    p_email_sent BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_patient_id UUID;
    v_tenant_id UUID;
    v_status TEXT;
    v_log_id UUID;
BEGIN
    -- Get appointment info
    SELECT patient_id, tenant_id INTO v_patient_id, v_tenant_id
    FROM telehealth_appointments
    WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Appointment not found');
    END IF;

    -- Determine overall status
    IF p_sms_sent OR p_push_sent OR p_email_sent THEN
        IF (p_sms_sent AND p_push_sent) OR (p_sms_sent AND p_email_sent) OR (p_push_sent AND p_email_sent) THEN
            v_status := 'sent';
        ELSE
            v_status := 'partial';
        END IF;
    ELSE
        v_status := 'failed';
    END IF;

    -- Update appointment reminder flag
    CASE p_reminder_type
        WHEN '24h' THEN
            UPDATE telehealth_appointments
            SET reminder_24h_sent = true, reminder_24h_sent_at = NOW()
            WHERE id = p_appointment_id;
        WHEN '1h' THEN
            UPDATE telehealth_appointments
            SET reminder_1h_sent = true, reminder_1h_sent_at = NOW()
            WHERE id = p_appointment_id;
        WHEN '15m' THEN
            UPDATE telehealth_appointments
            SET reminder_15m_sent = true, reminder_15m_sent_at = NOW()
            WHERE id = p_appointment_id;
    END CASE;

    -- Also update the legacy reminder_sent flag for backward compatibility
    UPDATE telehealth_appointments
    SET reminder_sent = true
    WHERE id = p_appointment_id;

    -- Log the reminder
    INSERT INTO appointment_reminder_log (
        appointment_id,
        patient_id,
        tenant_id,
        reminder_type,
        sms_sent,
        sms_sid,
        sms_status,
        push_sent,
        push_status,
        email_sent,
        email_status,
        status,
        scheduled_for,
        sent_at
    ) VALUES (
        p_appointment_id,
        v_patient_id,
        v_tenant_id,
        p_reminder_type,
        p_sms_sent,
        p_sms_sid,
        CASE WHEN p_sms_sent THEN 'sent' ELSE 'not_attempted' END,
        p_push_sent,
        CASE WHEN p_push_sent THEN 'sent' ELSE 'not_attempted' END,
        p_email_sent,
        CASE WHEN p_email_sent THEN 'sent' ELSE 'not_attempted' END,
        v_status,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
        'success', true,
        'log_id', v_log_id,
        'status', v_status
    );
END;
$$;

-- ============================================================================
-- 6. FUNCTION TO RESET REMINDERS (for rescheduled appointments)
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_appointment_reminders(
    p_appointment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE telehealth_appointments
    SET
        reminder_sent = false,
        reminder_24h_sent = false,
        reminder_24h_sent_at = NULL,
        reminder_1h_sent = false,
        reminder_1h_sent_at = NULL,
        reminder_15m_sent = false,
        reminder_15m_sent_at = NULL,
        notification_sent = false
    WHERE id = p_appointment_id;

    RETURN FOUND;
END;
$$;

-- ============================================================================
-- 7. UPDATE RESCHEDULE FUNCTION TO RESET REMINDERS
-- ============================================================================

-- Note: The reschedule_appointment function already resets reminder_sent and notification_sent
-- This is an enhancement to also reset the new granular reminder fields

CREATE OR REPLACE FUNCTION reset_reminders_on_reschedule()
RETURNS TRIGGER AS $$
BEGIN
    -- When appointment time changes, reset all reminder flags
    IF OLD.appointment_time IS DISTINCT FROM NEW.appointment_time THEN
        NEW.reminder_sent := false;
        NEW.reminder_24h_sent := false;
        NEW.reminder_24h_sent_at := NULL;
        NEW.reminder_1h_sent := false;
        NEW.reminder_1h_sent_at := NULL;
        NEW.reminder_15m_sent := false;
        NEW.reminder_15m_sent_at := NULL;
        NEW.notification_sent := false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reset_reminders_on_reschedule ON telehealth_appointments;
CREATE TRIGGER trigger_reset_reminders_on_reschedule
    BEFORE UPDATE OF appointment_time ON telehealth_appointments
    FOR EACH ROW
    EXECUTE FUNCTION reset_reminders_on_reschedule();

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

ALTER TABLE appointment_reminder_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_reminder_log ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own preferences
CREATE POLICY "users_manage_own_reminder_preferences"
    ON appointment_reminder_preferences
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admins can view all preferences
CREATE POLICY "admins_view_all_reminder_preferences"
    ON appointment_reminder_preferences
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Users can view their own reminder logs
CREATE POLICY "users_view_own_reminder_logs"
    ON appointment_reminder_log
    FOR SELECT
    TO authenticated
    USING (patient_id = auth.uid());

-- System can insert logs (service role)
CREATE POLICY "system_insert_reminder_logs"
    ON appointment_reminder_log
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Admins can view all logs
CREATE POLICY "admins_view_all_reminder_logs"
    ON appointment_reminder_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- ============================================================================
-- 9. GET/UPDATE USER REMINDER PREFERENCES FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_reminder_preferences(
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    reminder_24h_enabled BOOLEAN,
    reminder_1h_enabled BOOLEAN,
    reminder_15m_enabled BOOLEAN,
    sms_enabled BOOLEAN,
    push_enabled BOOLEAN,
    email_enabled BOOLEAN,
    dnd_start_time TIME,
    dnd_end_time TIME,
    timezone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    RETURN QUERY
    SELECT
        v_user_id as user_id,
        COALESCE(arp.reminder_24h_enabled, true) as reminder_24h_enabled,
        COALESCE(arp.reminder_1h_enabled, true) as reminder_1h_enabled,
        COALESCE(arp.reminder_15m_enabled, false) as reminder_15m_enabled,
        COALESCE(arp.sms_enabled, true) as sms_enabled,
        COALESCE(arp.push_enabled, true) as push_enabled,
        COALESCE(arp.email_enabled, false) as email_enabled,
        arp.dnd_start_time,
        arp.dnd_end_time,
        COALESCE(arp.timezone, 'America/Chicago') as timezone
    FROM profiles p
    LEFT JOIN appointment_reminder_preferences arp ON arp.user_id = p.user_id
    WHERE p.user_id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_user_reminder_preferences(
    p_reminder_24h_enabled BOOLEAN DEFAULT NULL,
    p_reminder_1h_enabled BOOLEAN DEFAULT NULL,
    p_reminder_15m_enabled BOOLEAN DEFAULT NULL,
    p_sms_enabled BOOLEAN DEFAULT NULL,
    p_push_enabled BOOLEAN DEFAULT NULL,
    p_email_enabled BOOLEAN DEFAULT NULL,
    p_dnd_start_time TIME DEFAULT NULL,
    p_dnd_end_time TIME DEFAULT NULL,
    p_timezone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Upsert preferences
    INSERT INTO appointment_reminder_preferences (
        user_id,
        reminder_24h_enabled,
        reminder_1h_enabled,
        reminder_15m_enabled,
        sms_enabled,
        push_enabled,
        email_enabled,
        dnd_start_time,
        dnd_end_time,
        timezone
    ) VALUES (
        v_user_id,
        COALESCE(p_reminder_24h_enabled, true),
        COALESCE(p_reminder_1h_enabled, true),
        COALESCE(p_reminder_15m_enabled, false),
        COALESCE(p_sms_enabled, true),
        COALESCE(p_push_enabled, true),
        COALESCE(p_email_enabled, false),
        p_dnd_start_time,
        p_dnd_end_time,
        COALESCE(p_timezone, 'America/Chicago')
    )
    ON CONFLICT (user_id) DO UPDATE SET
        reminder_24h_enabled = COALESCE(p_reminder_24h_enabled, appointment_reminder_preferences.reminder_24h_enabled),
        reminder_1h_enabled = COALESCE(p_reminder_1h_enabled, appointment_reminder_preferences.reminder_1h_enabled),
        reminder_15m_enabled = COALESCE(p_reminder_15m_enabled, appointment_reminder_preferences.reminder_15m_enabled),
        sms_enabled = COALESCE(p_sms_enabled, appointment_reminder_preferences.sms_enabled),
        push_enabled = COALESCE(p_push_enabled, appointment_reminder_preferences.push_enabled),
        email_enabled = COALESCE(p_email_enabled, appointment_reminder_preferences.email_enabled),
        dnd_start_time = COALESCE(p_dnd_start_time, appointment_reminder_preferences.dnd_start_time),
        dnd_end_time = COALESCE(p_dnd_end_time, appointment_reminder_preferences.dnd_end_time),
        timezone = COALESCE(p_timezone, appointment_reminder_preferences.timezone),
        updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_appointments_needing_reminders(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_reminder_sent(UUID, TEXT, BOOLEAN, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_appointment_reminders(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_reminder_preferences(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_reminder_preferences(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TIME, TIME, TEXT) TO authenticated;

-- ============================================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE appointment_reminder_preferences IS 'User preferences for appointment reminders (timing, channels, DND)';
COMMENT ON TABLE appointment_reminder_log IS 'Audit log of all appointment reminders sent';
COMMENT ON FUNCTION get_appointments_needing_reminders IS 'Get appointments that need reminders of a specific type (24h, 1h, 15m)';
COMMENT ON FUNCTION mark_reminder_sent IS 'Mark a reminder as sent and log the delivery status';
COMMENT ON FUNCTION reset_appointment_reminders IS 'Reset all reminder flags for a rescheduled appointment';
COMMENT ON FUNCTION get_user_reminder_preferences IS 'Get reminder preferences for current user or specified user';
COMMENT ON FUNCTION update_user_reminder_preferences IS 'Update reminder preferences for current user';
