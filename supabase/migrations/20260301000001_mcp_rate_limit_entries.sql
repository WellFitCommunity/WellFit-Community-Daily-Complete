-- =====================================================
-- MCP Rate Limit Persistence (P3-1)
-- Purpose: Supabase-backed rate limiting that survives cold starts
-- and is shared across edge function instances.
-- =====================================================

-- Table for persistent rate limit windows
CREATE TABLE IF NOT EXISTS mcp_rate_limit_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rate_key TEXT NOT NULL,              -- e.g., "mcp:claude:user:abc:tenant-1"
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INT NOT NULL DEFAULT 1,
  max_requests INT NOT NULL,
  window_ms INT NOT NULL,
  CONSTRAINT uq_rate_limit_key_window UNIQUE (rate_key, window_start)
);

-- Index for fast lookups by key + recency
CREATE INDEX IF NOT EXISTS idx_mcp_rate_limit_key
  ON mcp_rate_limit_entries (rate_key, window_start DESC);

-- Auto-cleanup: delete expired windows (older than 10 minutes)
-- Run via pg_cron or manual cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM mcp_rate_limit_entries
  WHERE window_start < now() - interval '10 minutes';
END;
$$;

-- RPC for atomic increment-and-check (avoids race conditions)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_rate_key TEXT,
  p_max_requests INT,
  p_window_ms INT
)
RETURNS TABLE(
  allowed BOOLEAN,
  remaining INT,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INT;
  v_window_interval INTERVAL;
BEGIN
  v_window_interval := (p_window_ms || ' milliseconds')::INTERVAL;
  v_window_start := date_trunc('second', now() - v_window_interval);

  -- Try to increment existing window
  UPDATE mcp_rate_limit_entries
  SET request_count = request_count + 1
  WHERE rate_key = p_rate_key
    AND window_start > v_window_start
  RETURNING request_count, mcp_rate_limit_entries.window_start
  INTO v_current_count, v_window_start;

  IF v_current_count IS NOT NULL THEN
    -- Existing window found
    RETURN QUERY SELECT
      v_current_count <= p_max_requests,
      GREATEST(p_max_requests - v_current_count, 0),
      v_window_start + v_window_interval;
    RETURN;
  END IF;

  -- No active window — insert new one
  INSERT INTO mcp_rate_limit_entries (rate_key, window_start, request_count, max_requests, window_ms)
  VALUES (p_rate_key, now(), 1, p_max_requests, p_window_ms)
  ON CONFLICT (rate_key, window_start) DO UPDATE
    SET request_count = mcp_rate_limit_entries.request_count + 1
  RETURNING mcp_rate_limit_entries.request_count, mcp_rate_limit_entries.window_start
  INTO v_current_count, v_window_start;

  RETURN QUERY SELECT
    v_current_count <= p_max_requests,
    GREATEST(p_max_requests - v_current_count, 0),
    v_window_start + v_window_interval;
END;
$$;

-- Grant access to service_role (MCP servers use service role client)
GRANT SELECT, INSERT, UPDATE, DELETE ON mcp_rate_limit_entries TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_rate_limits TO service_role;

-- RLS: Only service_role can access (MCP servers run as service_role)
ALTER TABLE mcp_rate_limit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON mcp_rate_limit_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Comment
COMMENT ON TABLE mcp_rate_limit_entries IS 'Persistent rate limit windows for MCP servers (P3-1). Shared across edge function instances.';
COMMENT ON FUNCTION check_rate_limit IS 'Atomic increment-and-check for MCP rate limiting. Returns allowed/remaining/reset_at.';
