-- ============================================================================
-- Rate Limiting for audit_logs Anonymous Inserts
-- ============================================================================
-- Purpose: Prevent DoS attacks while preserving pre-auth audit logging
-- Date: 2026-01-18
--
-- Security rationale:
-- - Anon inserts are REQUIRED for capturing pre-auth events (login failures, etc)
-- - Without rate limiting, attackers could flood the audit log
-- - Rate limit: 100 inserts per 5-minute window per fingerprint
-- ============================================================================

-- ============================================================================
-- 1. Create rate limiting function
-- ============================================================================
CREATE OR REPLACE FUNCTION check_audit_log_rate_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count integer;
  rate_limit integer := 100;  -- Max inserts per window
  window_minutes integer := 5; -- Time window in minutes
BEGIN
  -- Count recent inserts from same user_agent in the time window
  -- This is a simple fingerprint - not perfect, but deters casual abuse
  SELECT COUNT(*) INTO recent_count
  FROM audit_logs
  WHERE timestamp > NOW() - (window_minutes || ' minutes')::interval
    AND actor_user_agent = current_setting('request.headers', true)::json->>'user-agent';

  -- Allow if under rate limit
  RETURN recent_count < rate_limit;
END;
$$;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION check_audit_log_rate_limit() TO anon;

-- ============================================================================
-- 2. Update anon insert policy with rate limiting
-- ============================================================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "audit_logs_anon_insert" ON audit_logs;

-- Create new policy with rate limiting check
CREATE POLICY "audit_logs_anon_insert_rate_limited"
  ON audit_logs
  FOR INSERT
  TO anon
  WITH CHECK (
    check_audit_log_rate_limit()
  );

-- ============================================================================
-- 3. Add index to support rate limit queries
-- ============================================================================
-- Note: timestamp DESC allows efficient recent-records lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_rate_limit
  ON audit_logs (timestamp DESC, actor_user_agent);

-- ============================================================================
-- 4. Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Audit Log Rate Limiting Applied';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Rate limit: 100 inserts per 5-minute window per user-agent';
  RAISE NOTICE 'Anon inserts preserved for pre-auth logging';
  RAISE NOTICE 'Index created for efficient rate limit checking';
  RAISE NOTICE '=================================================================';
END $$;
