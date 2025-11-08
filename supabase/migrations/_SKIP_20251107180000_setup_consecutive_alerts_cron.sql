-- ==============================================================================
-- Migration: Set up cron job for consecutive missed check-in alerts
-- Date: 2025-11-07
-- Author: System Administrator
--
-- PURPOSE:
-- Schedule the send-consecutive-missed-alerts Edge Function to run daily
-- at 10:00 AM Central Time (3:00 PM UTC during CST, 4:00 PM UTC during CDT)
--
-- APPROACH:
-- Uses pg_cron extension to schedule daily HTTP POST to Edge Function
-- ==============================================================================

BEGIN;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing job if it exists (idempotent)
SELECT cron.unschedule('consecutive-missed-checkin-alerts') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'consecutive-missed-checkin-alerts'
);

-- Schedule daily job at 3:00 PM UTC (10:00 AM Central during CST)
-- Note: Adjust to 4:00 PM UTC (16:00) during CDT if needed
SELECT cron.schedule(
  'consecutive-missed-checkin-alerts',
  '0 15 * * *', -- 3:00 PM UTC = 10:00 AM CST = 9:00 AM CDT
  $$
  SELECT
    net.http_post(
      url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/send-consecutive-missed-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) AS request_id;
  $$
);

-- Grant permissions to execute cron jobs
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for consecutive check-in alerts';

COMMIT;

-- Verify the cron job was created
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'consecutive-missed-checkin-alerts';
