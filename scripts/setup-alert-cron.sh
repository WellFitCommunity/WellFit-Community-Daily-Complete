#!/bin/bash
# Setup and test consecutive missed check-in alerts cron job

set -e

echo "🔧 Setting up consecutive missed check-in alerts cron job..."

# Get project details
PROJECT_REF="xkybsjnvuohpqpbkikyn"
FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/send-consecutive-missed-alerts"

echo "📡 Function URL: $FUNCTION_URL"
echo ""

# Create the cron job SQL
SQL_SCRIPT=$(cat <<'EOF'
-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing job if exists
SELECT cron.unschedule('consecutive-missed-checkin-alerts')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'consecutive-missed-checkin-alerts'
);

-- Create new cron job (runs daily at 3 PM UTC = 10 AM CST)
SELECT cron.schedule(
  'consecutive-missed-checkin-alerts',
  '0 15 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/send-consecutive-missed-alerts',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Verify it was created
SELECT
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname = 'consecutive-missed-checkin-alerts';
EOF
)

echo "📝 Cron job SQL:"
echo "$SQL_SCRIPT"
echo ""

# Save to temp file
TMP_FILE=$(mktemp)
echo "$SQL_SCRIPT" > "$TMP_FILE"

echo "🚀 Applying cron job to database..."
echo "$SQL_SCRIPT" | npx supabase db execute --file -

echo ""
echo "✅ Cron job setup complete!"
echo ""
echo "📊 Cron job details:"
echo "  - Name: consecutive-missed-checkin-alerts"
echo "  - Schedule: Daily at 3:00 PM UTC (10:00 AM CST / 9:00 AM CDT)"
echo "  - Function: send-consecutive-missed-alerts"
echo ""
echo "🧪 To test manually, wait until 10 AM Central Time or check logs:"
echo "  npx supabase functions list | grep send-consecutive"
echo ""
echo "📈 Monitor alerts:"
echo "  SELECT * FROM consecutive_missed_checkins_log ORDER BY alert_sent_at DESC LIMIT 10;"

rm "$TMP_FILE"
