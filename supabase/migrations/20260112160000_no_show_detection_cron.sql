-- No-Show Detection Cron Schedule
-- Runs every 15 minutes during business hours to detect and mark no-shows

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to invoke the edge function
CREATE OR REPLACE FUNCTION invoke_no_show_detection()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_url TEXT;
  v_service_role_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Get project URL from environment or use default
  v_project_url := current_setting('app.settings.supabase_url', true);
  IF v_project_url IS NULL THEN
    v_project_url := 'https://xkybsjnvuohpqpbkikyn.supabase.co';
  END IF;

  -- Get service role key from vault (if available) or environment
  BEGIN
    SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_role_key := current_setting('app.settings.service_role_key', true);
  END;

  -- If no service role key, use CRON_SECRET approach
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    -- Call with CRON_SECRET header
    SELECT net.http_post(
      url := v_project_url || '/functions/v1/detect-no-shows',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', current_setting('app.settings.cron_secret', true)
      ),
      body := jsonb_build_object(
        'batch_size', 50,
        'source', 'pg_cron'
      )
    ) INTO v_request_id;
  ELSE
    -- Call with service role key
    SELECT net.http_post(
      url := v_project_url || '/functions/v1/detect-no-shows',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'batch_size', 50,
        'source', 'pg_cron'
      )
    ) INTO v_request_id;
  END IF;

  -- Log the invocation
  INSERT INTO no_show_cron_log (request_id, invoked_at)
  VALUES (v_request_id, NOW())
  ON CONFLICT DO NOTHING;

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail
  RAISE WARNING 'No-show detection cron failed: %', SQLERRM;
END;
$$;

-- Create a simple log table to track cron invocations
CREATE TABLE IF NOT EXISTS no_show_cron_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id BIGINT,
  invoked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for cleanup
CREATE INDEX IF NOT EXISTS idx_no_show_cron_log_invoked
ON no_show_cron_log(invoked_at);

-- Enable RLS
ALTER TABLE no_show_cron_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can view cron logs
CREATE POLICY "Super admins can view cron logs"
ON no_show_cron_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- ============================================================================
-- Schedule the cron job
-- Runs every 15 minutes from 6 AM to 10 PM (typical business hours)
-- ============================================================================

-- Remove existing job if it exists
SELECT cron.unschedule('detect-no-shows')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'detect-no-shows'
);

-- Schedule new job - every 15 minutes
SELECT cron.schedule(
  'detect-no-shows',           -- job name
  '*/15 * * * *',              -- every 15 minutes
  $$SELECT invoke_no_show_detection()$$
);

-- ============================================================================
-- Alternative: Business hours only schedule (optional)
-- Uncomment to use instead of 24/7 schedule
-- ============================================================================
-- SELECT cron.unschedule('detect-no-shows');
-- SELECT cron.schedule(
--   'detect-no-shows',
--   '*/15 6-22 * * *',         -- every 15 min, 6 AM to 10 PM
--   $$SELECT invoke_no_show_detection()$$
-- );

-- ============================================================================
-- Cleanup old cron logs (runs daily at midnight)
-- ============================================================================
SELECT cron.unschedule('cleanup-no-show-cron-logs')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-no-show-cron-logs'
);

SELECT cron.schedule(
  'cleanup-no-show-cron-logs',
  '0 0 * * *',                 -- daily at midnight
  $$DELETE FROM no_show_cron_log WHERE invoked_at < NOW() - INTERVAL '7 days'$$
);

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION invoke_no_show_detection TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION invoke_no_show_detection IS
'Invokes the detect-no-shows edge function via HTTP. Called by pg_cron every 15 minutes.';

COMMENT ON TABLE no_show_cron_log IS
'Tracks invocations of the no-show detection cron job for monitoring.';
