#!/bin/bash
#
# Test Daily Backup Verification Edge Function
# This script tests the deployed Edge Function with proper authentication
#

echo "🔍 Testing Daily Backup Verification Edge Function..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
  echo "❌ Error: .env file not found"
  echo "Please create .env file with SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

# Load environment variables
source .env

# Check if service role key is set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env"
  echo ""
  echo "To fix this:"
  echo "1. Go to: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/settings/api"
  echo "2. Copy the 'service_role' key (NOT the anon key)"
  echo "3. Add to .env file: SUPABASE_SERVICE_ROLE_KEY=eyJhbGc..."
  exit 1
fi

echo "✅ Service role key found"
echo ""

# Call the Edge Function
echo "📡 Calling Edge Function..."
echo ""

RESPONSE=$(curl -s -X POST \
  "https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/daily-backup-verification" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json")

# Check if response is valid JSON
if echo "$RESPONSE" | jq . >/dev/null 2>&1; then
  echo "📥 Response:"
  echo "$RESPONSE" | jq .

  # Check success status
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

  if [ "$SUCCESS" = "true" ]; then
    echo ""
    echo "✅ Backup verification completed successfully!"
    echo ""
    echo "📊 Verification ID: $(echo "$RESPONSE" | jq -r '.result.verification_id')"
    echo "📊 Record Count: $(echo "$RESPONSE" | jq -r '.record_count')"
    echo "📊 Status: $(echo "$RESPONSE" | jq -r '.status')"
  else
    echo ""
    echo "⚠️  Backup verification returned with errors"
    echo "Error: $(echo "$RESPONSE" | jq -r '.error // "Unknown error"')"
  fi
else
  echo "❌ Error: Invalid response from Edge Function"
  echo "Response: $RESPONSE"
  exit 1
fi

echo ""
echo "🔎 Checking database logs..."
echo ""

# Query the backup_verification_logs table
PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-us-west-1.pooler.supabase.com -p 6543 -U postgres.xkybsjnvuohpqpbkikyn -d postgres -c "
SELECT
  id,
  verification_status,
  record_count_actual,
  data_integrity_check_passed,
  automated_job_id,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM backup_verification_logs
ORDER BY created_at DESC
LIMIT 1;
"

echo ""
echo "✅ Test complete!"
echo ""
echo "Next step: Schedule this to run daily in Supabase Dashboard"
echo "URL: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/functions/daily-backup-verification"
