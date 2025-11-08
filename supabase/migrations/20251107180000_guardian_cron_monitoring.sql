-- Guardian Automated Monitoring - Cron Job Setup
-- This migration sets up automatic health checks every 5 minutes

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call Guardian monitoring
CREATE OR REPLACE FUNCTION trigger_guardian_monitoring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  response_status int;
  response_body text;
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
  -- This runs Guardian's monitoring checks
  SELECT INTO response_status, response_body
    status_code, content
  FROM net.http_post(
    url := supabase_url || '/functions/v1/guardian-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'action', 'monitor'
    )
  );

  -- Log the result
  IF response_status >= 200 AND response_status < 300 THEN
    RAISE NOTICE 'Guardian monitoring executed successfully: %', response_status;
  ELSE
    RAISE WARNING 'Guardian monitoring returned status %: %', response_status, response_body;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail if Guardian call fails - just log it
    RAISE WARNING 'Guardian monitoring failed: %', SQLERRM;
END;
$$;

-- Schedule Guardian to run every 5 minutes
-- cron format: minute hour day month weekday
-- */5 * * * * = every 5 minutes
SELECT cron.schedule(
  'guardian-automated-monitoring',  -- job name
  '*/5 * * * *',                    -- every 5 minutes
  $$SELECT trigger_guardian_monitoring();$$
);

-- Schedule a daily summary email at 8 AM UTC
-- This will call Guardian with a 'daily-summary' action
SELECT cron.schedule(
  'guardian-daily-summary',
  '0 8 * * *',  -- 8 AM UTC every day
  $$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/guardian-agent',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "analyze"}'::jsonb
  );
  $$
);

-- Create a table to log cron job executions (optional but helpful)
CREATE TABLE IF NOT EXISTS guardian_cron_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name text NOT NULL,
  executed_at timestamptz DEFAULT now(),
  status text,
  details jsonb
);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_guardian_cron_log_executed_at
ON guardian_cron_log(executed_at DESC);

-- Function to log cron executions
CREATE OR REPLACE FUNCTION log_guardian_cron_execution(
  p_job_name text,
  p_status text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO guardian_cron_log (job_name, status, details)
  VALUES (p_job_name, p_status, p_details);

  -- Keep only last 30 days of logs
  DELETE FROM guardian_cron_log
  WHERE executed_at < now() - interval '30 days';
END;
$$;

-- Grant execute permission to postgres role
GRANT EXECUTE ON FUNCTION trigger_guardian_monitoring() TO postgres;
GRANT EXECUTE ON FUNCTION log_guardian_cron_execution(text, text, jsonb) TO postgres;

-- Comment on objects
COMMENT ON FUNCTION trigger_guardian_monitoring() IS
  'Triggers Guardian monitoring via HTTP POST. Called by cron every 5 minutes.';

COMMENT ON TABLE guardian_cron_log IS
  'Logs Guardian cron job executions for debugging and monitoring.';

-- View to check cron job status
CREATE OR REPLACE VIEW guardian_cron_status AS
SELECT
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname LIKE 'guardian-%'
ORDER BY jobname;

COMMENT ON VIEW guardian_cron_status IS
  'Shows status of all Guardian cron jobs.';

-- To verify cron jobs are created, run:
-- SELECT * FROM guardian_cron_status;

-- To manually test Guardian monitoring:
-- SELECT trigger_guardian_monitoring();

-- To disable cron jobs if needed:
-- SELECT cron.unschedule('guardian-automated-monitoring');
-- SELECT cron.unschedule('guardian-daily-summary');
