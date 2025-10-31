-- Rate Limiting Infrastructure for Edge Functions
-- Supports distributed rate limiting across all Supabase edge functions
-- Date: 2025-10-31

CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- Format: "keyPrefix:user_id" or "keyPrefix:ip_address"
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient time-window queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_identifier_time
  ON rate_limit_attempts(identifier, attempted_at DESC);

-- Index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_attempted_at
  ON rate_limit_attempts(attempted_at);

-- Enable RLS (only system can write, admins can read for monitoring)
ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Admins can view all rate limit attempts for monitoring
CREATE POLICY "Admins can view rate limit attempts"
  ON rate_limit_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Service role can insert attempts (edge functions use service role)
CREATE POLICY "Service role can insert rate limit attempts"
  ON rate_limit_attempts FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can delete old attempts (cleanup)
CREATE POLICY "Service role can delete old rate limit attempts"
  ON rate_limit_attempts FOR DELETE
  TO service_role
  USING (true);

-- Function to cleanup old rate limit attempts (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_attempts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete attempts older than 24 hours
  DELETE FROM rate_limit_attempts
  WHERE attempted_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log cleanup operation
  INSERT INTO security_events (
    event_type,
    severity,
    description,
    metadata
  ) VALUES (
    'rate_limit_cleanup',
    'info',
    'Cleaned up old rate limit attempts',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'timestamp', NOW()
    )
  );

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for rate limit monitoring
CREATE OR REPLACE VIEW rate_limit_monitoring AS
SELECT
  SPLIT_PART(identifier, ':', 1) as key_prefix,
  SPLIT_PART(identifier, ':', 2) as entity,
  COUNT(*) as attempt_count,
  MIN(attempted_at) as first_attempt,
  MAX(attempted_at) as last_attempt,
  MAX(attempted_at) - MIN(attempted_at) as time_span
FROM rate_limit_attempts
WHERE attempted_at > NOW() - INTERVAL '1 hour'
GROUP BY identifier
HAVING COUNT(*) > 10  -- Only show potentially problematic patterns
ORDER BY attempt_count DESC;

-- Grant access to monitoring view
GRANT SELECT ON rate_limit_monitoring TO authenticated;

COMMENT ON TABLE rate_limit_attempts IS 'Distributed rate limiting for edge functions. Stores attempt history for sliding window rate limits.';
COMMENT ON FUNCTION cleanup_old_rate_limit_attempts IS 'Removes rate limit attempts older than 24 hours. Run daily via pg_cron.';
COMMENT ON VIEW rate_limit_monitoring IS 'Real-time view of rate limit patterns for security monitoring.';
