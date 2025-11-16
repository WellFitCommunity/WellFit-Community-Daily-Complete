-- ==============================================================================
-- Migration: Set up cron job for consecutive missed check-in alerts
-- Date: 2025-11-07
-- Author: System Administrator
--
-- PURPOSE:
-- Schedule the send-consecutive-missed-alerts Edge Function to run daily
-- at 10:00 AM Central Time using pg_cron
-- ==============================================================================

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Drop existing job if it exists (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('consecutive-missed-checkin-alerts')
  FROM cron.job
  WHERE jobname = 'consecutive-missed-checkin-alerts';
EXCEPTION
  WHEN undefined_table THEN
    -- cron.job table doesn't exist yet, skip
    NULL;
  WHEN others THEN
    -- Job doesn't exist, skip
    NULL;
END $$;

-- Create the cron job
-- Runs daily at 3:00 PM UTC (10:00 AM CST / 9:00 AM CDT)
SELECT cron.schedule(
  'consecutive-missed-checkin-alerts',  -- job name
  '0 15 * * *',                          -- schedule (3 PM UTC)
  $$
  SELECT extensions.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/send-consecutive-missed-alerts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for consecutive check-in alerts and system monitoring';

COMMIT;

-- Display the created job
SELECT
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname = 'consecutive-missed-checkin-alerts';
