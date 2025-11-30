-- Migration: Caregiver Access Log System
-- Purpose: Create audit logging for caregiver access to senior data (HIPAA compliance)
-- Date: 2024-11-30

-- ============================================================================
-- CAREGIVER ACCESS LOG TABLE
-- ============================================================================
-- This table logs every instance of a caregiver accessing a senior's data.
-- Required for HIPAA compliance - we must know WHO accessed PHI and WHEN.

CREATE TABLE IF NOT EXISTS public.caregiver_access_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Senior being accessed
    senior_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    senior_name TEXT NOT NULL,
    senior_phone TEXT,

    -- Caregiver accessing (self-reported - no account required)
    caregiver_name TEXT NOT NULL,
    caregiver_phone TEXT NOT NULL,

    -- Access metadata
    access_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_expires_at TIMESTAMPTZ NOT NULL,
    session_ended_at TIMESTAMPTZ,

    -- Security tracking
    client_ip INET,
    user_agent TEXT,

    -- What was accessed
    pages_viewed TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Session status
    is_active BOOLEAN DEFAULT TRUE,

    -- Tenant isolation
    tenant_id UUID REFERENCES public.tenants(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_caregiver_access_log_senior_id
    ON public.caregiver_access_log(senior_id);

CREATE INDEX IF NOT EXISTS idx_caregiver_access_log_access_time
    ON public.caregiver_access_log(access_time DESC);

CREATE INDEX IF NOT EXISTS idx_caregiver_access_log_caregiver_phone
    ON public.caregiver_access_log(caregiver_phone);

CREATE INDEX IF NOT EXISTS idx_caregiver_access_log_active_sessions
    ON public.caregiver_access_log(is_active, session_expires_at)
    WHERE is_active = TRUE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.caregiver_access_log ENABLE ROW LEVEL SECURITY;

-- Policy: Seniors can view their own access logs
CREATE POLICY "Seniors can view their own access logs"
    ON public.caregiver_access_log
    FOR SELECT
    USING (senior_id = auth.uid());

-- Policy: Admins can view all access logs for their tenant
CREATE POLICY "Admins can view tenant access logs"
    ON public.caregiver_access_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (tenant_id IS NULL OR tenant_id = caregiver_access_log.tenant_id)
        )
    );

-- Policy: Allow anonymous inserts for caregiver access logging
-- This is necessary because caregivers don't have accounts
CREATE POLICY "Allow anonymous caregiver access logging"
    ON public.caregiver_access_log
    FOR INSERT
    WITH CHECK (TRUE);

-- Policy: Allow updates to session status (for ending sessions)
CREATE POLICY "Allow session updates"
    ON public.caregiver_access_log
    FOR UPDATE
    USING (TRUE)
    WITH CHECK (TRUE);

-- ============================================================================
-- CAREGIVER SESSIONS TABLE (for active session management)
-- ============================================================================
-- Tracks active caregiver sessions with 30-minute timeout

CREATE TABLE IF NOT EXISTS public.caregiver_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to access log
    access_log_id BIGINT REFERENCES public.caregiver_access_log(id) ON DELETE CASCADE,

    -- Session token (stored hashed)
    session_token_hash TEXT NOT NULL,

    -- Senior being accessed
    senior_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Caregiver info
    caregiver_name TEXT NOT NULL,
    caregiver_phone TEXT NOT NULL,

    -- Session timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),

    -- Status
    is_valid BOOLEAN DEFAULT TRUE
);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_caregiver_sessions_token
    ON public.caregiver_sessions(session_token_hash);

CREATE INDEX IF NOT EXISTS idx_caregiver_sessions_valid
    ON public.caregiver_sessions(is_valid, expires_at)
    WHERE is_valid = TRUE;

-- RLS for sessions
ALTER TABLE public.caregiver_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for session management
CREATE POLICY "Allow caregiver session management"
    ON public.caregiver_sessions
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

-- ============================================================================
-- FUNCTION: Create caregiver session
-- ============================================================================

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
    v_session_token := encode(gen_random_bytes(32), 'hex');
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

-- ============================================================================
-- FUNCTION: Validate caregiver session
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_caregiver_session(
    p_session_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_token_hash TEXT;
    v_session RECORD;
BEGIN
    v_session_token_hash := encode(sha256(p_session_token::bytea), 'hex');

    SELECT
        cs.*,
        cal.senior_name,
        cal.pages_viewed
    INTO v_session
    FROM public.caregiver_sessions cs
    JOIN public.caregiver_access_log cal ON cal.id = cs.access_log_id
    WHERE cs.session_token_hash = v_session_token_hash
    AND cs.is_valid = TRUE
    AND cs.expires_at > NOW();

    IF NOT FOUND THEN
        RETURN json_build_object(
            'valid', FALSE,
            'error', 'Session expired or invalid'
        );
    END IF;

    -- Update last activity
    UPDATE public.caregiver_sessions
    SET last_activity_at = NOW()
    WHERE id = v_session.id;

    RETURN json_build_object(
        'valid', TRUE,
        'session_id', v_session.id,
        'senior_id', v_session.senior_id,
        'senior_name', v_session.senior_name,
        'caregiver_name', v_session.caregiver_name,
        'expires_at', v_session.expires_at,
        'pages_viewed', v_session.pages_viewed
    );
END;
$$;

-- ============================================================================
-- FUNCTION: End caregiver session
-- ============================================================================

CREATE OR REPLACE FUNCTION public.end_caregiver_session(
    p_session_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_token_hash TEXT;
    v_session_id UUID;
    v_access_log_id BIGINT;
BEGIN
    v_session_token_hash := encode(sha256(p_session_token::bytea), 'hex');

    -- Find and invalidate session
    UPDATE public.caregiver_sessions
    SET is_valid = FALSE
    WHERE session_token_hash = v_session_token_hash
    RETURNING id, access_log_id INTO v_session_id, v_access_log_id;

    IF v_session_id IS NULL THEN
        RETURN json_build_object('success', FALSE, 'error', 'Session not found');
    END IF;

    -- Update access log
    UPDATE public.caregiver_access_log
    SET
        session_ended_at = NOW(),
        is_active = FALSE,
        updated_at = NOW()
    WHERE id = v_access_log_id;

    RETURN json_build_object('success', TRUE);
END;
$$;

-- ============================================================================
-- FUNCTION: Log page view
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_caregiver_page_view(
    p_session_token TEXT,
    p_page_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_token_hash TEXT;
    v_access_log_id BIGINT;
BEGIN
    v_session_token_hash := encode(sha256(p_session_token::bytea), 'hex');

    -- Get access log id from valid session
    SELECT cs.access_log_id INTO v_access_log_id
    FROM public.caregiver_sessions cs
    WHERE cs.session_token_hash = v_session_token_hash
    AND cs.is_valid = TRUE
    AND cs.expires_at > NOW();

    IF v_access_log_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Append page to pages_viewed array (if not already there)
    UPDATE public.caregiver_access_log
    SET
        pages_viewed = CASE
            WHEN p_page_name = ANY(pages_viewed) THEN pages_viewed
            ELSE array_append(pages_viewed, p_page_name)
        END,
        updated_at = NOW()
    WHERE id = v_access_log_id;

    -- Update last activity on session
    UPDATE public.caregiver_sessions
    SET last_activity_at = NOW()
    WHERE access_log_id = v_access_log_id;

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- FUNCTION: Get senior's access history (for "who viewed my data")
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_access_history(
    p_limit INT DEFAULT 50
)
RETURNS TABLE (
    id BIGINT,
    caregiver_name TEXT,
    caregiver_phone TEXT,
    access_time TIMESTAMPTZ,
    session_ended_at TIMESTAMPTZ,
    pages_viewed TEXT[],
    client_ip INET
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cal.id,
        cal.caregiver_name,
        cal.caregiver_phone,
        cal.access_time,
        cal.session_ended_at,
        cal.pages_viewed,
        cal.client_ip
    FROM public.caregiver_access_log cal
    WHERE cal.senior_id = auth.uid()
    ORDER BY cal.access_time DESC
    LIMIT p_limit;
END;
$$;

-- ============================================================================
-- CLEANUP JOB: Expire old sessions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_caregiver_sessions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT;
BEGIN
    -- Invalidate expired sessions
    WITH expired AS (
        UPDATE public.caregiver_sessions
        SET is_valid = FALSE
        WHERE is_valid = TRUE
        AND expires_at < NOW()
        RETURNING access_log_id
    )
    UPDATE public.caregiver_access_log
    SET
        is_active = FALSE,
        session_ended_at = COALESCE(session_ended_at, NOW()),
        updated_at = NOW()
    WHERE id IN (SELECT access_log_id FROM expired);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.caregiver_access_log IS 'HIPAA-compliant audit log of caregiver access to senior health data';
COMMENT ON TABLE public.caregiver_sessions IS 'Active caregiver sessions with 30-minute timeout';
COMMENT ON FUNCTION public.create_caregiver_session IS 'Creates a new caregiver session after PIN verification';
COMMENT ON FUNCTION public.validate_caregiver_session IS 'Validates an active session token';
COMMENT ON FUNCTION public.end_caregiver_session IS 'Ends a caregiver session and logs the end time';
COMMENT ON FUNCTION public.get_my_access_history IS 'Returns access history for the authenticated senior';
