-- ============================================================================
-- Add Account Lockout Stub Functions
-- ============================================================================
-- Purpose: Provide stub functions for account lockout checking to prevent 500 errors
-- These are non-blocking stubs that always return "not locked"
-- The full lockout system can be implemented later when needed
-- ============================================================================

-- Drop existing functions if they exist (idempotent)
DROP FUNCTION IF EXISTS public.is_account_locked(TEXT);
DROP FUNCTION IF EXISTS public.get_failed_login_count(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.record_login_attempt(TEXT, TEXT, BOOLEAN, UUID, TEXT, TEXT, TEXT, JSONB);

-- ============================================================================
-- is_account_locked: Stub that always returns false (not locked)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_account_locked(p_identifier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Stub implementation: always return false (not locked)
  -- Full lockout system can be implemented later with account_lockouts table
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.is_account_locked IS
  'Stub function to check if account is locked. Currently always returns false.';

-- ============================================================================
-- get_failed_login_count: Stub that always returns 0
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_failed_login_count(
  p_identifier TEXT,
  p_minutes INTEGER DEFAULT 15
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Stub implementation: always return 0 (no failed attempts)
  -- Full tracking system can be implemented later with login_attempts table
  RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.get_failed_login_count IS
  'Stub function to get failed login count. Currently always returns 0.';

-- ============================================================================
-- record_login_attempt: Stub that does nothing (no-op)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_success BOOLEAN,
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Stub implementation: no-op
  -- Full logging system can be implemented later with login_attempts table
  -- For now, we rely on Supabase's built-in auth audit logs
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.record_login_attempt IS
  'Stub function to record login attempts. Currently a no-op.';

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.is_account_locked TO anon;
GRANT EXECUTE ON FUNCTION public.is_account_locked TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_locked TO service_role;

GRANT EXECUTE ON FUNCTION public.get_failed_login_count TO anon;
GRANT EXECUTE ON FUNCTION public.get_failed_login_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_failed_login_count TO service_role;

GRANT EXECUTE ON FUNCTION public.record_login_attempt TO anon;
GRANT EXECUTE ON FUNCTION public.record_login_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_attempt TO service_role;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_account_locked') THEN
    RAISE EXCEPTION 'Failed to create is_account_locked function';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_failed_login_count') THEN
    RAISE EXCEPTION 'Failed to create get_failed_login_count function';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_login_attempt') THEN
    RAISE EXCEPTION 'Failed to create record_login_attempt function';
  END IF;

  RAISE NOTICE 'Account lockout stub functions created successfully';
END;
$$;
