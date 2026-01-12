-- Migration: No-Show Detection System
-- Purpose: Automated detection and tracking of appointment no-shows
-- Created: 2026-01-12

-- =============================================
-- 1. No-Show Policy Configuration (per tenant)
-- =============================================

CREATE TABLE IF NOT EXISTS no_show_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    -- Detection settings
    grace_period_minutes INTEGER NOT NULL DEFAULT 15,
    auto_detect_enabled BOOLEAN DEFAULT true,
    -- Follow-up settings
    followup_enabled BOOLEAN DEFAULT true,
    followup_delay_hours INTEGER DEFAULT 24,
    followup_message_template TEXT DEFAULT 'We missed you at your appointment. Please call to reschedule.',
    -- Thresholds and policies
    warning_threshold INTEGER DEFAULT 2,  -- Number of no-shows before warning
    restriction_threshold INTEGER DEFAULT 3,  -- Number before restrictions apply
    restriction_days INTEGER DEFAULT 30,  -- Days restrictions last
    -- Notification settings
    notify_provider BOOLEAN DEFAULT true,
    notify_care_team BOOLEAN DEFAULT false,
    notify_patient BOOLEAN DEFAULT true,
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(user_id),
    -- Unique per tenant (or null for global default)
    CONSTRAINT unique_tenant_policy UNIQUE (tenant_id)
);

-- Insert default global policy
INSERT INTO no_show_policies (tenant_id, grace_period_minutes, auto_detect_enabled)
VALUES (NULL, 15, true)
ON CONFLICT (tenant_id) DO NOTHING;

-- =============================================
-- 2. Patient No-Show Statistics
-- =============================================

CREATE TABLE IF NOT EXISTS patient_no_show_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES profiles(user_id),
    tenant_id UUID REFERENCES tenants(id),
    -- Statistics
    total_appointments INTEGER DEFAULT 0,
    completed_appointments INTEGER DEFAULT 0,
    no_show_count INTEGER DEFAULT 0,
    cancelled_by_patient INTEGER DEFAULT 0,
    late_cancellations INTEGER DEFAULT 0,  -- Cancelled within 24h
    -- Calculated fields (updated by trigger)
    no_show_rate DECIMAL(5,2) DEFAULT 0.00,  -- Percentage
    consecutive_no_shows INTEGER DEFAULT 0,
    -- Dates
    last_no_show_date TIMESTAMPTZ,
    last_completed_date TIMESTAMPTZ,
    first_appointment_date TIMESTAMPTZ,
    -- Restrictions
    is_restricted BOOLEAN DEFAULT false,
    restriction_start_date TIMESTAMPTZ,
    restriction_end_date TIMESTAMPTZ,
    restriction_reason TEXT,
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_patient_tenant_stats UNIQUE (patient_id, tenant_id)
);

-- =============================================
-- 3. Appointment Attendance Tracking
-- =============================================

CREATE TABLE IF NOT EXISTS appointment_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES telehealth_appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES profiles(user_id),
    -- Join tracking
    patient_joined_at TIMESTAMPTZ,
    provider_joined_at TIMESTAMPTZ,
    -- Session details
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    actual_duration_minutes INTEGER,
    -- Daily.co integration
    daily_session_id TEXT,
    daily_room_name TEXT,
    -- Status tracking
    patient_attended BOOLEAN DEFAULT false,
    provider_attended BOOLEAN DEFAULT false,
    connection_quality TEXT,  -- good, fair, poor
    -- No-show detection
    checked_at TIMESTAMPTZ,
    no_show_detected_at TIMESTAMPTZ,
    marked_no_show_by UUID REFERENCES profiles(user_id),
    marked_no_show_reason TEXT,
    auto_detected BOOLEAN DEFAULT false,
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_appointment_attendance UNIQUE (appointment_id)
);

-- =============================================
-- 4. No-Show Log (Detailed History)
-- =============================================

CREATE TABLE IF NOT EXISTS no_show_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES telehealth_appointments(id),
    patient_id UUID NOT NULL REFERENCES profiles(user_id),
    provider_id UUID REFERENCES profiles(user_id),
    tenant_id UUID REFERENCES tenants(id),
    -- Detection details
    scheduled_time TIMESTAMPTZ NOT NULL,
    grace_period_minutes INTEGER NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    detection_method TEXT NOT NULL CHECK (detection_method IN ('automatic', 'manual_provider', 'manual_admin')),
    -- Actions taken
    provider_notified BOOLEAN DEFAULT false,
    patient_notified BOOLEAN DEFAULT false,
    care_team_notified BOOLEAN DEFAULT false,
    followup_scheduled BOOLEAN DEFAULT false,
    followup_appointment_id UUID REFERENCES telehealth_appointments(id),
    -- Patient stats at time of no-show
    patient_no_show_count_at_time INTEGER,
    patient_consecutive_at_time INTEGER,
    -- Notes
    notes TEXT,
    created_by UUID REFERENCES profiles(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. Indexes for Performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_no_show_policies_tenant ON no_show_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_no_show_stats_patient ON patient_no_show_stats(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_no_show_stats_tenant ON patient_no_show_stats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_no_show_stats_restricted ON patient_no_show_stats(is_restricted) WHERE is_restricted = true;
CREATE INDEX IF NOT EXISTS idx_appointment_attendance_appointment ON appointment_attendance(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_attendance_patient ON appointment_attendance(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointment_attendance_no_show ON appointment_attendance(no_show_detected_at) WHERE no_show_detected_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_no_show_log_patient ON no_show_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_no_show_log_appointment ON no_show_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_no_show_log_detected ON no_show_log(detected_at);

-- =============================================
-- 6. Function: Get No-Show Policy
-- =============================================

CREATE OR REPLACE FUNCTION get_no_show_policy(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
    grace_period_minutes INTEGER,
    auto_detect_enabled BOOLEAN,
    followup_enabled BOOLEAN,
    followup_delay_hours INTEGER,
    followup_message_template TEXT,
    warning_threshold INTEGER,
    restriction_threshold INTEGER,
    restriction_days INTEGER,
    notify_provider BOOLEAN,
    notify_care_team BOOLEAN,
    notify_patient BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(t.grace_period_minutes, g.grace_period_minutes),
        COALESCE(t.auto_detect_enabled, g.auto_detect_enabled),
        COALESCE(t.followup_enabled, g.followup_enabled),
        COALESCE(t.followup_delay_hours, g.followup_delay_hours),
        COALESCE(t.followup_message_template, g.followup_message_template),
        COALESCE(t.warning_threshold, g.warning_threshold),
        COALESCE(t.restriction_threshold, g.restriction_threshold),
        COALESCE(t.restriction_days, g.restriction_days),
        COALESCE(t.notify_provider, g.notify_provider),
        COALESCE(t.notify_care_team, g.notify_care_team),
        COALESCE(t.notify_patient, g.notify_patient)
    FROM no_show_policies g
    LEFT JOIN no_show_policies t ON t.tenant_id = p_tenant_id
    WHERE g.tenant_id IS NULL
    LIMIT 1;
END;
$$;

-- =============================================
-- 7. Function: Detect Expired Appointments
-- =============================================

CREATE OR REPLACE FUNCTION detect_expired_appointments(
    p_tenant_id UUID DEFAULT NULL,
    p_batch_size INTEGER DEFAULT 100
)
RETURNS TABLE (
    appointment_id UUID,
    patient_id UUID,
    patient_name TEXT,
    provider_id UUID,
    provider_name TEXT,
    appointment_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    grace_period_minutes INTEGER,
    minutes_overdue INTEGER,
    patient_no_show_count INTEGER,
    patient_phone TEXT,
    patient_email TEXT,
    tenant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_grace_period INTEGER;
BEGIN
    -- Get grace period from policy
    SELECT nsp.grace_period_minutes INTO v_grace_period
    FROM get_no_show_policy(p_tenant_id) nsp;

    v_grace_period := COALESCE(v_grace_period, 15);

    RETURN QUERY
    SELECT
        ta.id AS appointment_id,
        ta.patient_id,
        COALESCE(pat.full_name, 'Unknown') AS patient_name,
        ta.provider_id,
        COALESCE(prov.full_name, 'Unknown') AS provider_name,
        ta.appointment_time,
        ta.duration_minutes,
        v_grace_period AS grace_period_minutes,
        EXTRACT(EPOCH FROM (NOW() - (ta.appointment_time + (ta.duration_minutes || ' minutes')::INTERVAL)))::INTEGER / 60 AS minutes_overdue,
        COALESCE(stats.no_show_count, 0)::INTEGER AS patient_no_show_count,
        pat.phone AS patient_phone,
        pat.email AS patient_email,
        ta.tenant_id
    FROM telehealth_appointments ta
    JOIN profiles pat ON ta.patient_id = pat.user_id
    LEFT JOIN profiles prov ON ta.provider_id = prov.user_id
    LEFT JOIN patient_no_show_stats stats ON stats.patient_id = ta.patient_id
        AND (stats.tenant_id = ta.tenant_id OR (stats.tenant_id IS NULL AND ta.tenant_id IS NULL))
    LEFT JOIN appointment_attendance aa ON aa.appointment_id = ta.id
    WHERE ta.status IN ('scheduled', 'confirmed', 'in-progress')
      AND (p_tenant_id IS NULL OR ta.tenant_id = p_tenant_id)
      -- Appointment end time + grace period has passed
      AND (ta.appointment_time + (ta.duration_minutes || ' minutes')::INTERVAL + (v_grace_period || ' minutes')::INTERVAL) < NOW()
      -- Patient didn't attend
      AND (aa.patient_attended IS NULL OR aa.patient_attended = false)
      -- Not already detected as no-show
      AND aa.no_show_detected_at IS NULL
    ORDER BY ta.appointment_time ASC
    LIMIT p_batch_size;
END;
$$;

-- =============================================
-- 8. Function: Mark Appointment as No-Show
-- =============================================

CREATE OR REPLACE FUNCTION mark_appointment_no_show(
    p_appointment_id UUID,
    p_detection_method TEXT DEFAULT 'automatic',
    p_notes TEXT DEFAULT NULL,
    p_marked_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment RECORD;
    v_policy RECORD;
    v_current_stats RECORD;
    v_new_no_show_count INTEGER;
    v_new_consecutive INTEGER;
    v_should_restrict BOOLEAN := false;
BEGIN
    -- Get appointment details
    SELECT ta.*, t.id AS tenant_uuid
    INTO v_appointment
    FROM telehealth_appointments ta
    LEFT JOIN tenants t ON ta.tenant_id = t.id
    WHERE ta.id = p_appointment_id;

    IF v_appointment IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Appointment not found'
        );
    END IF;

    IF v_appointment.status = 'no-show' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Appointment already marked as no-show'
        );
    END IF;

    IF v_appointment.status NOT IN ('scheduled', 'confirmed', 'in-progress') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cannot mark completed or cancelled appointments as no-show'
        );
    END IF;

    -- Get policy
    SELECT * INTO v_policy FROM get_no_show_policy(v_appointment.tenant_id);

    -- Get current patient stats
    SELECT * INTO v_current_stats
    FROM patient_no_show_stats
    WHERE patient_id = v_appointment.patient_id
      AND (tenant_id = v_appointment.tenant_id OR (tenant_id IS NULL AND v_appointment.tenant_id IS NULL));

    -- Calculate new stats
    v_new_no_show_count := COALESCE(v_current_stats.no_show_count, 0) + 1;
    v_new_consecutive := COALESCE(v_current_stats.consecutive_no_shows, 0) + 1;
    v_should_restrict := v_new_no_show_count >= v_policy.restriction_threshold;

    -- Update appointment status
    UPDATE telehealth_appointments
    SET status = 'no-show',
        updated_at = NOW()
    WHERE id = p_appointment_id;

    -- Insert or update attendance record
    INSERT INTO appointment_attendance (
        appointment_id,
        patient_id,
        patient_attended,
        provider_attended,
        no_show_detected_at,
        marked_no_show_by,
        marked_no_show_reason,
        auto_detected,
        checked_at
    ) VALUES (
        p_appointment_id,
        v_appointment.patient_id,
        false,
        true,  -- Assume provider was ready
        NOW(),
        p_marked_by,
        p_notes,
        p_detection_method = 'automatic',
        NOW()
    )
    ON CONFLICT (appointment_id) DO UPDATE SET
        patient_attended = false,
        no_show_detected_at = NOW(),
        marked_no_show_by = p_marked_by,
        marked_no_show_reason = p_notes,
        auto_detected = p_detection_method = 'automatic',
        checked_at = NOW(),
        updated_at = NOW();

    -- Insert or update patient stats
    INSERT INTO patient_no_show_stats (
        patient_id,
        tenant_id,
        total_appointments,
        no_show_count,
        no_show_rate,
        consecutive_no_shows,
        last_no_show_date,
        first_appointment_date,
        is_restricted,
        restriction_start_date,
        restriction_end_date,
        restriction_reason
    ) VALUES (
        v_appointment.patient_id,
        v_appointment.tenant_id,
        1,
        1,
        100.00,
        1,
        NOW(),
        v_appointment.appointment_time,
        v_should_restrict,
        CASE WHEN v_should_restrict THEN NOW() ELSE NULL END,
        CASE WHEN v_should_restrict THEN NOW() + (v_policy.restriction_days || ' days')::INTERVAL ELSE NULL END,
        CASE WHEN v_should_restrict THEN 'Exceeded no-show threshold' ELSE NULL END
    )
    ON CONFLICT (patient_id, tenant_id) DO UPDATE SET
        no_show_count = patient_no_show_stats.no_show_count + 1,
        no_show_rate = ((patient_no_show_stats.no_show_count + 1)::DECIMAL / GREATEST(patient_no_show_stats.total_appointments, 1)) * 100,
        consecutive_no_shows = patient_no_show_stats.consecutive_no_shows + 1,
        last_no_show_date = NOW(),
        is_restricted = v_should_restrict,
        restriction_start_date = CASE WHEN v_should_restrict AND NOT patient_no_show_stats.is_restricted THEN NOW() ELSE patient_no_show_stats.restriction_start_date END,
        restriction_end_date = CASE WHEN v_should_restrict THEN NOW() + (v_policy.restriction_days || ' days')::INTERVAL ELSE patient_no_show_stats.restriction_end_date END,
        restriction_reason = CASE WHEN v_should_restrict THEN 'Exceeded no-show threshold' ELSE patient_no_show_stats.restriction_reason END,
        updated_at = NOW();

    -- Log to no_show_log
    INSERT INTO no_show_log (
        appointment_id,
        patient_id,
        provider_id,
        tenant_id,
        scheduled_time,
        grace_period_minutes,
        detection_method,
        patient_no_show_count_at_time,
        patient_consecutive_at_time,
        notes,
        created_by
    ) VALUES (
        p_appointment_id,
        v_appointment.patient_id,
        v_appointment.provider_id,
        v_appointment.tenant_id,
        v_appointment.appointment_time,
        v_policy.grace_period_minutes,
        p_detection_method,
        v_new_no_show_count,
        v_new_consecutive,
        p_notes,
        p_marked_by
    );

    -- Log to appointment history
    INSERT INTO appointment_history (
        appointment_id,
        change_type,
        previous_status,
        new_status,
        change_reason,
        changed_by,
        changed_by_role
    ) VALUES (
        p_appointment_id,
        'status_changed',
        v_appointment.status,
        'no-show',
        COALESCE(p_notes, 'Marked as no-show: ' || p_detection_method),
        p_marked_by,
        CASE WHEN p_detection_method = 'automatic' THEN 'system' ELSE 'provider' END
    );

    RETURN jsonb_build_object(
        'success', true,
        'appointment_id', p_appointment_id,
        'patient_id', v_appointment.patient_id,
        'new_no_show_count', v_new_no_show_count,
        'consecutive_no_shows', v_new_consecutive,
        'is_restricted', v_should_restrict,
        'should_notify_provider', v_policy.notify_provider,
        'should_notify_patient', v_policy.notify_patient,
        'should_notify_care_team', v_policy.notify_care_team,
        'followup_enabled', v_policy.followup_enabled
    );
END;
$$;

-- =============================================
-- 9. Function: Get Patient No-Show Statistics
-- =============================================

CREATE OR REPLACE FUNCTION get_patient_no_show_stats(
    p_patient_id UUID,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    patient_id UUID,
    total_appointments INTEGER,
    completed_appointments INTEGER,
    no_show_count INTEGER,
    cancelled_by_patient INTEGER,
    late_cancellations INTEGER,
    no_show_rate DECIMAL(5,2),
    consecutive_no_shows INTEGER,
    last_no_show_date TIMESTAMPTZ,
    last_completed_date TIMESTAMPTZ,
    is_restricted BOOLEAN,
    restriction_end_date TIMESTAMPTZ,
    restriction_reason TEXT,
    risk_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_policy RECORD;
BEGIN
    -- Get policy for risk level calculation
    SELECT * INTO v_policy FROM get_no_show_policy(p_tenant_id);

    RETURN QUERY
    SELECT
        stats.patient_id,
        COALESCE(stats.total_appointments, 0),
        COALESCE(stats.completed_appointments, 0),
        COALESCE(stats.no_show_count, 0),
        COALESCE(stats.cancelled_by_patient, 0),
        COALESCE(stats.late_cancellations, 0),
        COALESCE(stats.no_show_rate, 0.00),
        COALESCE(stats.consecutive_no_shows, 0),
        stats.last_no_show_date,
        stats.last_completed_date,
        COALESCE(stats.is_restricted, false),
        stats.restriction_end_date,
        stats.restriction_reason,
        CASE
            WHEN stats.is_restricted THEN 'high'
            WHEN stats.no_show_count >= v_policy.warning_threshold THEN 'medium'
            WHEN stats.no_show_count > 0 THEN 'low'
            ELSE 'none'
        END AS risk_level
    FROM patient_no_show_stats stats
    WHERE stats.patient_id = p_patient_id
      AND (p_tenant_id IS NULL OR stats.tenant_id = p_tenant_id OR stats.tenant_id IS NULL);
END;
$$;

-- =============================================
-- 10. Function: Record Patient Attendance
-- =============================================

CREATE OR REPLACE FUNCTION record_patient_attendance(
    p_appointment_id UUID,
    p_joined_at TIMESTAMPTZ DEFAULT NOW(),
    p_daily_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment RECORD;
BEGIN
    -- Get appointment
    SELECT * INTO v_appointment
    FROM telehealth_appointments
    WHERE id = p_appointment_id;

    IF v_appointment IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Appointment not found');
    END IF;

    -- Insert or update attendance
    INSERT INTO appointment_attendance (
        appointment_id,
        patient_id,
        patient_joined_at,
        patient_attended,
        daily_session_id,
        daily_room_name,
        actual_start_time
    ) VALUES (
        p_appointment_id,
        v_appointment.patient_id,
        p_joined_at,
        true,
        p_daily_session_id,
        v_appointment.daily_room_name,
        p_joined_at
    )
    ON CONFLICT (appointment_id) DO UPDATE SET
        patient_joined_at = COALESCE(appointment_attendance.patient_joined_at, p_joined_at),
        patient_attended = true,
        daily_session_id = COALESCE(p_daily_session_id, appointment_attendance.daily_session_id),
        actual_start_time = COALESCE(appointment_attendance.actual_start_time, p_joined_at),
        updated_at = NOW();

    -- Update appointment status to in-progress if scheduled/confirmed
    IF v_appointment.status IN ('scheduled', 'confirmed') THEN
        UPDATE telehealth_appointments
        SET status = 'in-progress',
            updated_at = NOW()
        WHERE id = p_appointment_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'appointment_id', p_appointment_id,
        'patient_attended', true,
        'joined_at', p_joined_at
    );
END;
$$;

-- =============================================
-- 11. Function: Reset Consecutive No-Shows on Completed
-- =============================================

CREATE OR REPLACE FUNCTION reset_consecutive_no_shows()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- When an appointment is completed, reset consecutive no-shows
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE patient_no_show_stats
        SET consecutive_no_shows = 0,
            completed_appointments = completed_appointments + 1,
            total_appointments = total_appointments + 1,
            last_completed_date = NOW(),
            no_show_rate = (no_show_count::DECIMAL / GREATEST(total_appointments + 1, 1)) * 100,
            updated_at = NOW()
        WHERE patient_id = NEW.patient_id
          AND (tenant_id = NEW.tenant_id OR (tenant_id IS NULL AND NEW.tenant_id IS NULL));

        -- Check if restriction should be lifted
        UPDATE patient_no_show_stats
        SET is_restricted = false,
            restriction_end_date = NULL,
            restriction_reason = NULL
        WHERE patient_id = NEW.patient_id
          AND (tenant_id = NEW.tenant_id OR (tenant_id IS NULL AND NEW.tenant_id IS NULL))
          AND is_restricted = true
          AND restriction_end_date < NOW();
    END IF;

    -- Track new appointments
    IF TG_OP = 'INSERT' AND NEW.status IN ('scheduled', 'confirmed') THEN
        INSERT INTO patient_no_show_stats (patient_id, tenant_id, total_appointments, first_appointment_date)
        VALUES (NEW.patient_id, NEW.tenant_id, 1, NEW.appointment_time)
        ON CONFLICT (patient_id, tenant_id) DO UPDATE SET
            total_appointments = patient_no_show_stats.total_appointments + 1,
            first_appointment_date = COALESCE(patient_no_show_stats.first_appointment_date, NEW.appointment_time),
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for appointment status changes
DROP TRIGGER IF EXISTS trigger_track_appointment_stats ON telehealth_appointments;
CREATE TRIGGER trigger_track_appointment_stats
    AFTER INSERT OR UPDATE OF status ON telehealth_appointments
    FOR EACH ROW
    EXECUTE FUNCTION reset_consecutive_no_shows();

-- =============================================
-- 12. Function: Check Patient Restriction Status
-- =============================================

CREATE OR REPLACE FUNCTION check_patient_restriction(
    p_patient_id UUID,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    is_restricted BOOLEAN,
    restriction_end_date TIMESTAMPTZ,
    restriction_reason TEXT,
    no_show_count INTEGER,
    warning_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_policy RECORD;
BEGIN
    SELECT * INTO v_policy FROM get_no_show_policy(p_tenant_id);

    RETURN QUERY
    SELECT
        COALESCE(stats.is_restricted, false) AND (stats.restriction_end_date IS NULL OR stats.restriction_end_date > NOW()),
        stats.restriction_end_date,
        stats.restriction_reason,
        COALESCE(stats.no_show_count, 0),
        CASE
            WHEN stats.is_restricted THEN 'restricted'
            WHEN COALESCE(stats.no_show_count, 0) >= v_policy.restriction_threshold THEN 'critical'
            WHEN COALESCE(stats.no_show_count, 0) >= v_policy.warning_threshold THEN 'warning'
            ELSE 'good'
        END
    FROM patient_no_show_stats stats
    WHERE stats.patient_id = p_patient_id
      AND (stats.tenant_id = p_tenant_id OR (stats.tenant_id IS NULL AND p_tenant_id IS NULL));

    -- If no stats exist, return clean record
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::TIMESTAMPTZ, NULL::TEXT, 0, 'good'::TEXT;
    END IF;
END;
$$;

-- =============================================
-- 13. RLS Policies
-- =============================================

ALTER TABLE no_show_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_no_show_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_show_log ENABLE ROW LEVEL SECURITY;

-- No-show policies: Admins can manage, providers can read
CREATE POLICY "Admins can manage no-show policies"
    ON no_show_policies
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Providers can read no-show policies"
    ON no_show_policies
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role IN ('provider', 'admin', 'super_admin')
        )
    );

-- Patient stats: Providers and care team can view their patients
CREATE POLICY "Providers can view patient no-show stats"
    ON patient_no_show_stats
    FOR SELECT
    TO authenticated
    USING (
        patient_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role IN ('provider', 'admin', 'super_admin', 'care_coordinator')
        )
    );

CREATE POLICY "System can manage patient stats"
    ON patient_no_show_stats
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Attendance: Can view own or as provider
CREATE POLICY "Users can view relevant attendance"
    ON appointment_attendance
    FOR SELECT
    TO authenticated
    USING (
        patient_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM telehealth_appointments ta
            WHERE ta.id = appointment_attendance.appointment_id
            AND ta.provider_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "System can manage attendance"
    ON appointment_attendance
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- No-show log: Providers and admins
CREATE POLICY "Providers can view no-show logs"
    ON no_show_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role IN ('provider', 'admin', 'super_admin', 'care_coordinator')
        )
    );

CREATE POLICY "System can insert no-show logs"
    ON no_show_log
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- =============================================
-- 14. Grant Permissions
-- =============================================

GRANT SELECT ON no_show_policies TO authenticated;
GRANT SELECT ON patient_no_show_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON appointment_attendance TO authenticated;
GRANT SELECT, INSERT ON no_show_log TO authenticated;

GRANT EXECUTE ON FUNCTION get_no_show_policy TO authenticated;
GRANT EXECUTE ON FUNCTION detect_expired_appointments TO authenticated;
GRANT EXECUTE ON FUNCTION mark_appointment_no_show TO authenticated;
GRANT EXECUTE ON FUNCTION get_patient_no_show_stats TO authenticated;
GRANT EXECUTE ON FUNCTION record_patient_attendance TO authenticated;
GRANT EXECUTE ON FUNCTION check_patient_restriction TO authenticated;

-- =============================================
-- 15. Comments
-- =============================================

COMMENT ON TABLE no_show_policies IS 'Per-tenant configuration for no-show detection and handling';
COMMENT ON TABLE patient_no_show_stats IS 'Aggregate statistics of patient appointment attendance';
COMMENT ON TABLE appointment_attendance IS 'Tracks actual attendance for each appointment';
COMMENT ON TABLE no_show_log IS 'Detailed log of all no-show events for audit and analytics';
COMMENT ON FUNCTION detect_expired_appointments IS 'Returns appointments that have passed their grace period without patient attendance';
COMMENT ON FUNCTION mark_appointment_no_show IS 'Marks an appointment as no-show and updates all related statistics';
COMMENT ON FUNCTION record_patient_attendance IS 'Records when a patient joins their appointment session';
