-- Fix Guardian Cron Monitoring - pg_net http_post returns bigint (request_id), not status_code
-- This migration fixes the trigger_guardian_monitoring function

-- Create a function to call Guardian monitoring (FIXED VERSION)
CREATE OR REPLACE FUNCTION trigger_guardian_monitoring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  -- Get Supabase URL and service role key from vault (secure storage)
  -- Note: In production, these should be stored in Supabase secrets/vault
  -- For now, Guardian will use its own environment variables when invoked

  supabase_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.service_role_key', true);

  IF supabase_url IS NULL THEN
    -- Fallback: try to get from public setting if vault not configured
    supabase_url := 'https://xkybsjnvuohpqpbkikyn.supabase.co';
  END IF;

  -- Call Guardian agent monitoring via pg_net
  -- net.http_post returns a request_id (bigint), not a response
  -- The request is made asynchronously
  request_id := net.http_post(
    url := supabase_url || '/functions/v1/guardian-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'action', 'monitor'
    )
  );

  -- Log the request ID
  RAISE NOTICE 'Guardian monitoring triggered with request_id: %', request_id;

  -- Log to our custom table
  INSERT INTO guardian_cron_log (job_name, status, details)
  VALUES (
    'guardian-automated-monitoring',
    'triggered',
    jsonb_build_object('request_id', request_id, 'timestamp', now())
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail if Guardian call fails - just log it
    RAISE WARNING 'Guardian monitoring failed: %', SQLERRM;

    -- Log the failure
    INSERT INTO guardian_cron_log (job_name, status, details)
    VALUES (
      'guardian-automated-monitoring',
      'failed',
      jsonb_build_object('error', SQLERRM, 'timestamp', now())
    );
END;
$$;

-- Grant execute permission to postgres role
GRANT EXECUTE ON FUNCTION trigger_guardian_monitoring() TO postgres;

-- Comment on function
COMMENT ON FUNCTION trigger_guardian_monitoring() IS
  'Triggers Guardian monitoring via HTTP POST using pg_net. Called by cron every 5 minutes. Returns immediately as pg_net makes async requests.';
