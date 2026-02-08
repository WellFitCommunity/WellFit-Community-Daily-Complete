-- Fix Broken Database Functions
-- Addresses 7 critical function errors found by `supabase db lint`:
--   1. p.full_name → first_name || ' ' || last_name (3 functions)
--   2. gen_random_bytes() → extensions.gen_random_bytes() (3 functions)
--   3. check_prior_auth_for_claim array operators (1 function)
--
-- These functions would fail at runtime if invoked.
-- PostGIS-related lint errors (addauth, lockrow, etc.) are not ours to fix.

-- =============================================================================
-- FIX 1: get_provider_appointment_stats — p.full_name does not exist
-- =============================================================================
CREATE OR REPLACE FUNCTION get_provider_appointment_stats(
  p_tenant_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  provider_email TEXT,
  total_appointments INTEGER,
  completed INTEGER,
  no_shows INTEGER,
  cancelled INTEGER,
  completion_rate NUMERIC,
  no_show_rate NUMERIC,
  total_hours NUMERIC,
  avg_duration_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ta.provider_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown Provider') AS provider_name,
    COALESCE(p.email, '') AS provider_email,
    COUNT(*)::INTEGER AS total_appointments,
    COUNT(*) FILTER (WHERE ta.status = 'completed')::INTEGER AS completed,
    COUNT(*) FILTER (WHERE ta.status = 'no-show')::INTEGER AS no_shows,
    COUNT(*) FILTER (WHERE ta.status = 'cancelled')::INTEGER AS cancelled,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE ta.status = 'completed')::NUMERIC / COUNT(*)) * 100, 1)
      ELSE 0
    END AS completion_rate,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE ta.status = 'no-show')::NUMERIC / COUNT(*)) * 100, 1)
      ELSE 0
    END AS no_show_rate,
    ROUND(COALESCE(SUM(ta.duration_minutes) FILTER (WHERE ta.status = 'completed'), 0)::NUMERIC / 60, 1) AS total_hours,
    COALESCE(AVG(ta.duration_minutes)::INTEGER, 30) AS avg_duration_minutes
  FROM telehealth_appointments ta
  LEFT JOIN profiles p ON ta.provider_id = p.user_id
  WHERE ta.appointment_time >= p_start_date
    AND ta.appointment_time < p_end_date
    AND (p_tenant_id IS NULL OR ta.tenant_id = p_tenant_id)
  GROUP BY ta.provider_id, p.first_name, p.last_name, p.email
  ORDER BY COUNT(*) DESC;
END;
$$;

-- =============================================================================
-- FIX 2: get_no_show_patterns — p.full_name does not exist
-- =============================================================================
CREATE OR REPLACE FUNCTION get_no_show_patterns(
  p_tenant_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '90 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_by_day_of_week JSONB;
  v_by_hour JSONB;
  v_high_risk_patients JSONB;
BEGIN
  -- No-shows by day of week
  SELECT jsonb_agg(
    jsonb_build_object(
      'dayOfWeek', day_num,
      'dayName', day_name,
      'totalAppointments', total,
      'noShows', no_shows,
      'noShowRate', rate
    ) ORDER BY day_num
  )
  INTO v_by_day_of_week
  FROM (
    SELECT
      EXTRACT(DOW FROM appointment_time)::INTEGER AS day_num,
      TO_CHAR(appointment_time, 'Day') AS day_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'no-show') AS no_shows,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE status = 'no-show')::NUMERIC / COUNT(*)) * 100, 1)
        ELSE 0
      END AS rate
    FROM telehealth_appointments
    WHERE appointment_time >= p_start_date
      AND appointment_time < p_end_date
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    GROUP BY 1, 2
  ) sub;

  -- No-shows by hour of day
  SELECT jsonb_agg(
    jsonb_build_object(
      'hour', hour_num,
      'hourLabel', hour_label,
      'totalAppointments', total,
      'noShows', no_shows,
      'noShowRate', rate
    ) ORDER BY hour_num
  )
  INTO v_by_hour
  FROM (
    SELECT
      EXTRACT(HOUR FROM appointment_time)::INTEGER AS hour_num,
      TO_CHAR(appointment_time, 'HH12 AM') AS hour_label,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'no-show') AS no_shows,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE status = 'no-show')::NUMERIC / COUNT(*)) * 100, 1)
        ELSE 0
      END AS rate
    FROM telehealth_appointments
    WHERE appointment_time >= p_start_date
      AND appointment_time < p_end_date
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    GROUP BY 1, 2
  ) sub;

  -- High-risk patients (most no-shows)
  SELECT jsonb_agg(
    jsonb_build_object(
      'patientId', patient_id,
      'patientName', patient_name,
      'totalAppointments', total,
      'noShowCount', no_shows,
      'noShowRate', rate,
      'isRestricted', is_restricted
    ) ORDER BY no_shows DESC
  )
  INTO v_high_risk_patients
  FROM (
    SELECT
      ta.patient_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS patient_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ta.status = 'no-show') AS no_shows,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE ta.status = 'no-show')::NUMERIC / COUNT(*)) * 100, 1)
        ELSE 0
      END AS rate,
      COALESCE(pns.is_restricted, false) AS is_restricted
    FROM telehealth_appointments ta
    LEFT JOIN profiles p ON ta.patient_id = p.user_id
    LEFT JOIN patient_no_show_stats pns ON ta.patient_id = pns.patient_id
    WHERE ta.appointment_time >= p_start_date
      AND ta.appointment_time < p_end_date
      AND (p_tenant_id IS NULL OR ta.tenant_id = p_tenant_id)
    GROUP BY ta.patient_id, p.first_name, p.last_name, pns.is_restricted
    HAVING COUNT(*) FILTER (WHERE ta.status = 'no-show') > 0
    ORDER BY COUNT(*) FILTER (WHERE ta.status = 'no-show') DESC
    LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'byDayOfWeek', COALESCE(v_by_day_of_week, '[]'::JSONB),
    'byHour', COALESCE(v_by_hour, '[]'::JSONB),
    'highRiskPatients', COALESCE(v_high_risk_patients, '[]'::JSONB)
  );
END;
$$;

-- =============================================================================
-- FIX 3: log_manual_config_change — p.full_name does not exist
-- =============================================================================
CREATE OR REPLACE FUNCTION log_manual_config_change(
  p_tenant_id UUID,
  p_config_table TEXT,
  p_field_name TEXT,
  p_old_value JSONB,
  p_new_value JSONB,
  p_reason TEXT,
  p_approval_ticket TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_role TEXT;
  v_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT
      COALESCE(p.first_name || ' ' || p.last_name, p.display_name, u.email),
      p.role
    INTO v_user_name, v_user_role
    FROM auth.users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id = v_user_id;
  END IF;

  INSERT INTO tenant_config_audit (
    tenant_id,
    config_table,
    field_name,
    action,
    old_value,
    new_value,
    changed_by_user_id,
    changed_by_name,
    changed_by_role,
    change_source,
    reason,
    approval_ticket
  ) VALUES (
    p_tenant_id,
    p_config_table,
    p_field_name,
    'UPDATE',
    p_old_value,
    p_new_value,
    v_user_id,
    v_user_name,
    v_user_role,
    'manual',
    p_reason,
    p_approval_ticket
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FIX 4: create_mcp_key — gen_random_bytes() and digest() need extensions prefix
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_mcp_key(
    p_name VARCHAR(255),
    p_scopes TEXT[],
    p_tenant_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    key_id UUID,
    raw_key TEXT,
    key_prefix VARCHAR(12)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_raw_key TEXT;
    v_prefix VARCHAR(12);
    v_hash TEXT;
    v_id UUID;
BEGIN
    -- Verify caller is super_admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.user_id = auth.uid()
        AND r.name = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Only super_admin can create MCP keys';
    END IF;

    -- Generate key: mcp_ + 32 random hex chars
    v_raw_key := 'mcp_' || encode(extensions.gen_random_bytes(16), 'hex');
    v_prefix := substring(v_raw_key from 1 for 12);
    v_hash := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');

    -- Insert key
    INSERT INTO mcp_keys (
        key_hash, key_prefix, name, description, scopes,
        created_by, tenant_id, expires_at
    ) VALUES (
        v_hash, v_prefix, p_name, p_description, p_scopes,
        auth.uid(), p_tenant_id, p_expires_at
    )
    RETURNING id INTO v_id;

    -- Return the raw key (only time it's ever returned)
    RETURN QUERY SELECT v_id, v_raw_key, v_prefix;
END;
$$;

-- =============================================================================
-- FIX 5: create_caregiver_session — gen_random_bytes() needs extensions prefix
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_caregiver_session(
    p_senior_id UUID,
    p_senior_name TEXT,
    p_senior_phone TEXT,
    p_caregiver_name TEXT,
    p_caregiver_phone TEXT,
    p_client_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_duration_minutes INT DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_token TEXT;
    v_session_token_hash TEXT;
    v_expires_at TIMESTAMPTZ;
    v_access_log_id BIGINT;
    v_session_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Generate session token
    v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_session_token_hash := encode(sha256(v_session_token::bytea), 'hex');
    v_expires_at := NOW() + (p_session_duration_minutes || ' minutes')::INTERVAL;

    -- Get tenant_id from senior's profile
    SELECT tenant_id INTO v_tenant_id
    FROM public.profiles
    WHERE user_id = p_senior_id;

    -- Create access log entry
    INSERT INTO public.caregiver_access_log (
        senior_id,
        senior_name,
        senior_phone,
        caregiver_name,
        caregiver_phone,
        access_time,
        session_expires_at,
        client_ip,
        user_agent,
        is_active,
        tenant_id
    ) VALUES (
        p_senior_id,
        p_senior_name,
        p_senior_phone,
        p_caregiver_name,
        p_caregiver_phone,
        NOW(),
        v_expires_at,
        p_client_ip,
        p_user_agent,
        TRUE,
        v_tenant_id
    )
    RETURNING id INTO v_access_log_id;

    -- Create session
    INSERT INTO public.caregiver_sessions (
        access_log_id,
        session_token_hash,
        senior_id,
        caregiver_name,
        caregiver_phone,
        expires_at
    ) VALUES (
        v_access_log_id,
        v_session_token_hash,
        p_senior_id,
        p_caregiver_name,
        p_caregiver_phone,
        v_expires_at
    )
    RETURNING id INTO v_session_id;

    -- Return session info
    RETURN json_build_object(
        'success', TRUE,
        'session_token', v_session_token,
        'session_id', v_session_id,
        'access_log_id', v_access_log_id,
        'expires_at', v_expires_at
    );
END;
$$;

-- =============================================================================
-- FIX 6: generate_totp_backup_codes — gen_random_bytes() needs extensions prefix
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_totp_backup_codes()
RETURNS TEXT[] AS $$
DECLARE
  codes TEXT[] := '{}';
  i INT;
  code TEXT;
BEGIN
  -- Generate 10 random 8-character alphanumeric codes
  FOR i IN 1..10 LOOP
    code := upper(substring(encode(extensions.gen_random_bytes(6), 'hex') from 1 for 8));
    code := substring(code from 1 for 4) || '-' || substring(code from 5 for 4);
    codes := array_append(codes, code);
  END LOOP;

  RETURN codes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FIX 7: check_prior_auth_for_claim — invalid array operators (& and -)
-- PostgreSQL uses && for overlap but has no & (intersection) or - (difference)
-- for arrays. Must use subqueries with INTERSECT/EXCEPT instead.
-- =============================================================================
CREATE OR REPLACE FUNCTION check_prior_auth_for_claim(
  p_tenant_id UUID,
  p_patient_id UUID,
  p_service_codes TEXT[],
  p_date_of_service DATE
)
RETURNS TABLE (
  requires_prior_auth BOOLEAN,
  existing_auth_id UUID,
  existing_auth_number VARCHAR,
  auth_status prior_auth_status,
  auth_expires_at TIMESTAMPTZ,
  missing_codes TEXT[]
) AS $$
DECLARE
  v_existing_auth RECORD;
  v_covered_codes TEXT[];
  v_missing_codes TEXT[];
BEGIN
  -- Find existing valid prior auth
  SELECT
    pa.id,
    pa.auth_number,
    pa.status,
    pa.expires_at,
    pa.service_codes
  INTO v_existing_auth
  FROM prior_authorizations pa
  WHERE pa.tenant_id = p_tenant_id
    AND pa.patient_id = p_patient_id
    AND pa.status = 'approved'
    AND (pa.expires_at IS NULL OR pa.expires_at > NOW())
    AND (pa.service_start_date IS NULL OR pa.service_start_date <= p_date_of_service)
    AND (pa.service_end_date IS NULL OR pa.service_end_date >= p_date_of_service)
    AND pa.service_codes && p_service_codes
  ORDER BY pa.created_at DESC
  LIMIT 1;

  IF v_existing_auth.id IS NOT NULL THEN
    -- Array intersection: codes covered by existing auth
    v_covered_codes := ARRAY(
      SELECT unnest(v_existing_auth.service_codes)
      INTERSECT
      SELECT unnest(p_service_codes)
    );
    -- Array difference: requested codes NOT in existing auth
    v_missing_codes := ARRAY(
      SELECT unnest(p_service_codes)
      EXCEPT
      SELECT unnest(v_existing_auth.service_codes)
    );

    RETURN QUERY SELECT
      COALESCE(array_length(v_missing_codes, 1), 0) > 0,
      v_existing_auth.id,
      v_existing_auth.auth_number,
      v_existing_auth.status,
      v_existing_auth.expires_at,
      v_missing_codes;
  ELSE
    -- No existing auth found
    RETURN QUERY SELECT
      TRUE,
      NULL::UUID,
      NULL::VARCHAR,
      NULL::prior_auth_status,
      NULL::TIMESTAMPTZ,
      p_service_codes;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
