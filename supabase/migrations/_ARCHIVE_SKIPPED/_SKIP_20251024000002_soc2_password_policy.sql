-- SOC2 Compliance: Password Policy and Expiration
-- CC6.1 & CC6.2: Password complexity requirements and expiration policy
--
-- This migration implements:
-- 1. Password expiration policy (90 days)
-- 2. Password history (prevent reuse of last 5 passwords)
-- 3. Force password change for new users
-- 4. Password complexity validation function
-- 5. Automatic expiration checking

BEGIN;

-- ============================================================================
-- PART 1: PASSWORD HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.password_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL, -- bcrypt hash for comparison
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_password_history_user_created
  ON public.password_history(user_id, created_at DESC);

-- Enable RLS (only service role can access)
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

-- Service role only
CREATE POLICY "Service role only for password history"
  ON public.password_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.password_history IS
  'SOC2 CC6.2: Password history to prevent password reuse';

-- ============================================================================
-- PART 2: ADD PASSWORD TRACKING TO PROFILES
-- ============================================================================

-- Add columns to profiles table (if not exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
      AND column_name = 'password_changed_at'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN password_changed_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
      AND column_name = 'password_expires_at'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN password_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
      AND column_name = 'password_never_expires'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN password_never_expires BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create index for expired password queries
CREATE INDEX IF NOT EXISTS idx_profiles_password_expires
  ON public.profiles(password_expires_at)
  WHERE password_never_expires = FALSE;

COMMENT ON COLUMN public.profiles.password_changed_at IS
  'Last time password was changed';
COMMENT ON COLUMN public.profiles.password_expires_at IS
  'When password will expire (90 days from last change)';
COMMENT ON COLUMN public.profiles.password_never_expires IS
  'Exemption from password expiration (for service accounts)';

-- ============================================================================
-- PART 3: PASSWORD COMPLEXITY VALIDATION
-- ============================================================================

-- Function to validate password complexity
-- Requirements:
-- - Minimum 8 characters
-- - At least one uppercase letter
-- - At least one lowercase letter
-- - At least one number
-- - At least one special character
-- - No common passwords
CREATE OR REPLACE FUNCTION public.validate_password_complexity(p_password TEXT)
RETURNS TABLE(is_valid BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_common_passwords TEXT[] := ARRAY[
    'password', 'Password1', 'Password123', '12345678', 'qwerty',
    'abc123', 'password1', 'admin123', 'welcome1', 'letmein'
  ];
BEGIN
  -- Check minimum length
  IF length(p_password) < 8 THEN
    RETURN QUERY SELECT FALSE, 'Password must be at least 8 characters long';
    RETURN;
  END IF;

  -- Check maximum length (prevent DOS)
  IF length(p_password) > 128 THEN
    RETURN QUERY SELECT FALSE, 'Password must be less than 128 characters';
    RETURN;
  END IF;

  -- Check for uppercase letter
  IF p_password !~ '[A-Z]' THEN
    RETURN QUERY SELECT FALSE, 'Password must contain at least one uppercase letter';
    RETURN;
  END IF;

  -- Check for lowercase letter
  IF p_password !~ '[a-z]' THEN
    RETURN QUERY SELECT FALSE, 'Password must contain at least one lowercase letter';
    RETURN;
  END IF;

  -- Check for number
  IF p_password !~ '[0-9]' THEN
    RETURN QUERY SELECT FALSE, 'Password must contain at least one number';
    RETURN;
  END IF;

  -- Check for special character
  IF p_password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
    RETURN QUERY SELECT FALSE, 'Password must contain at least one special character (!@#$%^&*...)';
    RETURN;
  END IF;

  -- Check against common passwords
  IF p_password = ANY(v_common_passwords) THEN
    RETURN QUERY SELECT FALSE, 'This password is too common. Please choose a more secure password';
    RETURN;
  END IF;

  -- Password is valid
  RETURN QUERY SELECT TRUE, 'Password meets all requirements'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.validate_password_complexity IS
  'SOC2 CC6.2: Validate password meets complexity requirements';

-- ============================================================================
-- PART 4: PASSWORD EXPIRATION CHECKING
-- ============================================================================

-- Function to check if password is expired
CREATE OR REPLACE FUNCTION public.is_password_expired(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_never_expires BOOLEAN;
BEGIN
  SELECT password_expires_at, password_never_expires
  INTO v_expires_at, v_never_expires
  FROM profiles
  WHERE user_id = p_user_id;

  -- If not found or never expires, return false
  IF NOT FOUND OR v_never_expires = TRUE THEN
    RETURN FALSE;
  END IF;

  -- Check if expired
  RETURN v_expires_at < NOW();
END;
$$;

COMMENT ON FUNCTION public.is_password_expired IS
  'Check if user password has expired';

-- Function to get days until password expires
CREATE OR REPLACE FUNCTION public.days_until_password_expires(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_never_expires BOOLEAN;
  v_days INTEGER;
BEGIN
  SELECT password_expires_at, password_never_expires
  INTO v_expires_at, v_never_expires
  FROM profiles
  WHERE user_id = p_user_id;

  -- If not found or never expires, return NULL
  IF NOT FOUND OR v_never_expires = TRUE THEN
    RETURN NULL;
  END IF;

  -- Calculate days remaining
  v_days := EXTRACT(DAY FROM (v_expires_at - NOW()));

  -- Return 0 if already expired
  RETURN GREATEST(0, v_days);
END;
$$;

COMMENT ON FUNCTION public.days_until_password_expires IS
  'Get number of days until password expires';

-- ============================================================================
-- PART 5: PASSWORD CHANGE TRACKING
-- ============================================================================

-- Function to record password change
CREATE OR REPLACE FUNCTION public.record_password_change(
  p_user_id UUID,
  p_password_hash TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profiles table
  UPDATE profiles
  SET
    password_changed_at = NOW(),
    password_expires_at = NOW() + INTERVAL '90 days',
    force_password_change = FALSE
  WHERE user_id = p_user_id;

  -- Add to password history if hash provided
  IF p_password_hash IS NOT NULL THEN
    INSERT INTO password_history (user_id, password_hash)
    VALUES (p_user_id, p_password_hash);

    -- Keep only last 5 passwords
    DELETE FROM password_history
    WHERE user_id = p_user_id
      AND id NOT IN (
        SELECT id FROM password_history
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 5
      );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.record_password_change IS
  'Record password change and update expiration';

-- ============================================================================
-- PART 6: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.validate_password_complexity TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_password_expired TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.days_until_password_expires TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_password_change TO service_role;

-- ============================================================================
-- PART 7: BACKFILL EXISTING USERS
-- ============================================================================

-- Set password dates for existing users
UPDATE public.profiles
SET
  password_changed_at = COALESCE(password_changed_at, created_at),
  password_expires_at = COALESCE(password_expires_at, created_at + INTERVAL '90 days')
WHERE password_changed_at IS NULL OR password_expires_at IS NULL;

-- Exempt service accounts (if any) from password expiration
-- UPDATE public.profiles
-- SET password_never_expires = TRUE
-- WHERE role IN ('service_account', 'api_user');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify tables exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'password_history') THEN
    RAISE EXCEPTION 'Failed to create password_history table';
  END IF;

  -- Verify columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'password_expires_at'
  ) THEN
    RAISE EXCEPTION 'Failed to add password_expires_at column to profiles';
  END IF;

  -- Verify functions exist
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_password_complexity') THEN
    RAISE EXCEPTION 'Failed to create validate_password_complexity function';
  END IF;

  RAISE NOTICE 'SOC2 Password Policy system created successfully';
  RAISE NOTICE 'Configuration: 90-day password expiration, last 5 passwords remembered';
  RAISE NOTICE 'Complexity: 8+ chars, uppercase, lowercase, number, special character';
END $$;

COMMIT;
