-- ==============================================================================
-- Migration: Create cron job for consecutive missed check-in alerts
-- Date: 2025-11-07
-- Simple cron job creation without extension management
-- ==============================================================================

-- Drop existing job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('consecutive-missed-checkin-alerts');
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Create the cron job (daily at 3 PM UTC = 10 AM CST)
SELECT cron.schedule(
  'consecutive-missed-checkin-alerts',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/send-consecutive-missed-alerts',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Verify the job was created
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'consecutive-missed-checkin-alerts';
