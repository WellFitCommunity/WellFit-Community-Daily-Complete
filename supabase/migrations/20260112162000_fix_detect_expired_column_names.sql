-- Fix column references in detect_expired_appointments function
-- The profiles table uses first_name and last_name, not full_name

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
        COALESCE(TRIM(COALESCE(pat.first_name, '') || ' ' || COALESCE(pat.last_name, '')), 'Unknown') AS patient_name,
        ta.provider_id,
        COALESCE(TRIM(COALESCE(prov.first_name, '') || ' ' || COALESCE(prov.last_name, '')), 'Unknown') AS provider_name,
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

COMMENT ON FUNCTION detect_expired_appointments IS 'Returns appointments that have passed their grace period without patient attendance. Fixed to use first_name/last_name columns.';
