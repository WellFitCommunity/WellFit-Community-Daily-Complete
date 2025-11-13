-- Verify the cron job was created successfully
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job
WHERE jobname = 'consecutive-missed-checkin-alerts';
