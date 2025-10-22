-- SOC2 Compliance: Rate Limiting and Account Lockout
-- CC6.1: Protection against brute force attacks and unauthorized access
--
-- This migration implements:
-- 1. Login attempt tracking
-- 2. Rate limiting (max 5 failed attempts in 15 minutes)
-- 3. Account lockout (15 minute temporary lockout after 5 failures)
-- 4. Automatic unlock after lockout period
-- 5. Security event logging

BEGIN;

-- ============================================================================
-- PART 1: CREATE LOGIN ATTEMPTS TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL, -- email or phone
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('password', 'pin', 'mfa')),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_created
  ON public.login_attempts(identifier, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_created
  ON public.login_attempts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created
  ON public.login_attempts(ip_address, created_at DESC);

-- Enable RLS (service role only can write)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can view login attempts
CREATE POLICY "Admins can view all login attempts"
  ON public.login_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Service role can insert (from Edge Functions)
CREATE POLICY "Service role can insert login attempts"
  ON public.login_attempts FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON TABLE public.login_attempts IS
  'SOC2 CC6.1: Login attempt tracking for rate limiting and security monitoring';

-- ============================================================================
-- PART 2: CREATE ACCOUNT LOCKOUTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_lockouts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL, -- email or phone
  lockout_type TEXT NOT NULL CHECK (lockout_type IN ('rate_limit', 'manual', 'security_event')),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ NOT NULL,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for automatic, user_id for manual
  unlock_reason TEXT,
  unlocked_at TIMESTAMPTZ,
  unlocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  CONSTRAINT valid_lockout_period CHECK (locked_until > locked_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_account_lockouts_identifier
  ON public.account_lockouts(identifier, locked_until DESC);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_user
  ON public.account_lockouts(user_id, locked_until DESC);

-- Note: Cannot use NOW() in index predicate, so we use a simpler unique constraint
-- Active lockouts are determined at query time
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_lockouts_active_identifier
  ON public.account_lockouts(identifier)
  WHERE unlocked_at IS NULL;

-- Enable RLS
ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;

-- Admins can view all lockouts
CREATE POLICY "Admins can view all lockouts"
  ON public.account_lockouts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Service role can manage lockouts
CREATE POLICY "Service role can manage lockouts"
  ON public.account_lockouts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can manually unlock accounts
CREATE POLICY "Admins can unlock accounts"
  ON public.account_lockouts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE public.account_lockouts IS
  'SOC2 CC6.1: Account lockout tracking for brute force protection';

-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION public.is_account_locked(p_identifier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  -- Check if there's an active lockout
  SELECT EXISTS (
    SELECT 1 FROM account_lockouts
    WHERE identifier = p_identifier
      AND unlocked_at IS NULL
      AND locked_until > NOW()
  ) INTO v_locked;

  RETURN COALESCE(v_locked, FALSE);
END;
$$;

COMMENT ON FUNCTION public.is_account_locked IS
  'Check if an account (by email/phone) is currently locked';

-- Function to get failed login count in time window
CREATE OR REPLACE FUNCTION public.get_failed_login_count(
  p_identifier TEXT,
  p_minutes INTEGER DEFAULT 15
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  FROM login_attempts
  WHERE identifier = p_identifier
    AND success = FALSE
    AND created_at > (NOW() - (p_minutes || ' minutes')::INTERVAL)
  INTO v_count;

  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.get_failed_login_count IS
  'Get count of failed login attempts for identifier in last N minutes';

-- Function to record login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_success BOOLEAN,
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed_count INTEGER;
  v_lockout_minutes INTEGER := 15;
  v_max_attempts INTEGER := 5;
BEGIN
  -- Insert login attempt
  INSERT INTO login_attempts (
    user_id,
    identifier,
    attempt_type,
    success,
    ip_address,
    user_agent,
    error_message,
    metadata
  ) VALUES (
    p_user_id,
    p_identifier,
    p_attempt_type,
    p_success,
    p_ip_address,
    p_user_agent,
    p_error_message,
    p_metadata
  );

  -- If failed attempt, check if we need to lock the account
  IF p_success = FALSE THEN
    v_failed_count := get_failed_login_count(p_identifier, v_lockout_minutes);

    -- Lock account if max attempts exceeded
    IF v_failed_count >= v_max_attempts THEN
      -- Only create lockout if one doesn't already exist
      INSERT INTO account_lockouts (
        user_id,
        identifier,
        lockout_type,
        locked_until,
        metadata
      )
      SELECT
        p_user_id,
        p_identifier,
        'rate_limit',
        NOW() + (v_lockout_minutes || ' minutes')::INTERVAL,
        jsonb_build_object(
          'failed_attempts', v_failed_count,
          'ip_address', p_ip_address
        )
      WHERE NOT EXISTS (
        SELECT 1 FROM account_lockouts
        WHERE identifier = p_identifier
          AND unlocked_at IS NULL
          AND locked_until > NOW()
      );

      -- Raise notice for logging
      RAISE NOTICE 'Account locked for % after % failed attempts', p_identifier, v_failed_count;
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.record_login_attempt IS
  'Record login attempt and auto-lock account if max failures exceeded';

-- Function to unlock account (manual or automatic)
CREATE OR REPLACE FUNCTION public.unlock_account(
  p_identifier TEXT,
  p_unlocked_by UUID DEFAULT NULL,
  p_unlock_reason TEXT DEFAULT 'Manual unlock'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE account_lockouts
  SET
    unlocked_at = NOW(),
    unlocked_by = p_unlocked_by,
    unlock_reason = p_unlock_reason
  WHERE identifier = p_identifier
    AND unlocked_at IS NULL
    AND locked_until > NOW();

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated > 0;
END;
$$;

COMMENT ON FUNCTION public.unlock_account IS
  'Manually unlock a locked account';

-- ============================================================================
-- PART 4: AUTOMATIC CLEANUP
-- ============================================================================

-- Function to clean up old login attempts (keep last 90 days for audit)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM login_attempts
  WHERE created_at < (NOW() - INTERVAL '90 days');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_login_attempts IS
  'Clean up login attempts older than 90 days (SOC2 data retention)';

-- ============================================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION public.is_account_locked TO service_role;
GRANT EXECUTE ON FUNCTION public.get_failed_login_count TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_attempt TO service_role;
GRANT EXECUTE ON FUNCTION public.unlock_account TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_login_attempts TO service_role;

-- Grant execute to authenticated users for read-only functions
GRANT EXECUTE ON FUNCTION public.is_account_locked TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_failed_login_count TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify tables exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'login_attempts') THEN
    RAISE EXCEPTION 'Failed to create login_attempts table';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'account_lockouts') THEN
    RAISE EXCEPTION 'Failed to create account_lockouts table';
  END IF;

  -- Verify functions exist
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_account_locked') THEN
    RAISE EXCEPTION 'Failed to create is_account_locked function';
  END IF;

  RAISE NOTICE 'SOC2 Rate Limiting and Account Lockout system created successfully';
  RAISE NOTICE 'Configuration: Max 5 failed attempts in 15 minutes = 15 minute lockout';
END $$;

COMMIT;
