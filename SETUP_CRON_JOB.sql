-- ============================================================================
-- Setup Cron Job for Pending Registration Cleanup
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Verify pg_cron is available
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
-- If you get a row back, pg_cron is available ✅

-- Step 2: Check if job already exists
SELECT * FROM cron.job WHERE jobname = 'cleanup-pending-registrations';
-- If you get a row back, the job is already scheduled ✅

-- Step 3: Remove existing job (if it exists)
SELECT cron.unschedule('cleanup-pending-registrations');
-- This will return TRUE even if the job doesn't exist

-- Step 4: Schedule the cleanup job to run every 15 minutes
SELECT cron.schedule(
  'cleanup-pending-registrations',  -- Job name
  '*/15 * * * *',                    -- Cron schedule: every 15 minutes
  'SELECT public.cleanup_expired_pending_registrations();'  -- SQL to run
);
-- Should return a job ID number (e.g., 1, 2, 3, etc.)

-- Step 5: Verify the job was created
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname = 'cleanup-pending-registrations';
-- Should show your job details

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test the cleanup function manually (should return 0 if no expired records)
SELECT public.cleanup_expired_pending_registrations();

-- Check cron job history (after waiting 15 minutes)
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-pending-registrations')
ORDER BY start_time DESC
LIMIT 10;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If you get "permission denied" errors:
-- You need to be a superuser or have pg_cron permissions
-- Contact Supabase support OR use external cron instead

-- If pg_cron is not available:
-- Use external cron (GitHub Actions, Vercel Cron, etc.)
-- See deployment checklist for alternatives
