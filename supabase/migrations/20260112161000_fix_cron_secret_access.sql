-- Fix cron secret access for no-show detection
-- Store cron secret in a secure config table

-- Create config table if not exists
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only service role can access
CREATE POLICY "Service role only"
ON system_config
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Store the cron secret (this will be updated via dashboard or API)
INSERT INTO system_config (key, value, encrypted)
VALUES ('cron_secret', 'e096585fe4ec8b2280a853f229386e3708b0326ac3541a07a131afd5e8a0f307', false)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Update the invoke function to read from config table
CREATE OR REPLACE FUNCTION invoke_no_show_detection()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_url TEXT := 'https://xkybsjnvuohpqpbkikyn.supabase.co';
  v_cron_secret TEXT;
  v_request_id BIGINT;
BEGIN
  -- Get cron secret from config table
  SELECT value INTO v_cron_secret
  FROM system_config
  WHERE key = 'cron_secret';

  IF v_cron_secret IS NULL THEN
    RAISE WARNING 'CRON_SECRET not configured in system_config table';
    RETURN;
  END IF;

  -- Call edge function with cron secret
  SELECT net.http_post(
    url := v_project_url || '/functions/v1/detect-no-shows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_cron_secret
    ),
    body := jsonb_build_object(
      'batch_size', 50,
      'source', 'pg_cron'
    )
  ) INTO v_request_id;

  -- Log the invocation
  INSERT INTO no_show_cron_log (request_id, invoked_at)
  VALUES (v_request_id, NOW());

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the cron job
  RAISE WARNING 'No-show detection cron failed: %', SQLERRM;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION invoke_no_show_detection TO service_role;

COMMENT ON TABLE system_config IS
'Secure configuration storage for system secrets and settings. Access restricted to service_role.';
