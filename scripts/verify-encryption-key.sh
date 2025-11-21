#!/bin/bash

################################################################################
# Verify Encryption Key Setup
# Checks if app.encryption_key is configured in Supabase
################################################################################

set -e

echo "🔐 Verifying Encryption Key Setup"
echo "================================="

# Check database encryption key
echo ""
echo "Checking database encryption key (app.encryption_key)..."

RESULT=$(PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-us-west-1.pooler.supabase.com -p 6543 -U postgres.xkybsjnvuohpqpbkikyn -d postgres -t -c "SELECT current_setting('app.encryption_key', TRUE);" 2>&1)

if [ -z "$RESULT" ] || [ "$RESULT" == " " ]; then
  echo "❌ FAIL: app.encryption_key is NOT set in Supabase database"
  echo ""
  echo "ACTION REQUIRED:"
  echo "1. Go to: https://supabase.com/dashboard"
  echo "2. Select your WellFit project"
  echo "3. Go to: Project Settings → Database → Custom PostgreSQL Configuration"
  echo "4. Add parameter:"
  echo "   - Name: app.encryption_key"
  echo "   - Value: IQMXJA9zLS8aKNquolnedh1m8LJeX5y6O1anMaNyZdw="
  echo "5. Save and restart database"
  echo ""
  exit 1
else
  echo "✅ PASS: app.encryption_key is set in Supabase database"
  echo "   Key prefix: ${RESULT:0:10}..."
fi

# Check environment variable encryption key
echo ""
echo "Checking environment variable (PHI_ENCRYPTION_KEY)..."

if grep -q "PHI_ENCRYPTION_KEY=" .env 2>/dev/null; then
  echo "✅ PASS: PHI_ENCRYPTION_KEY found in .env file"
  KEY_VALUE=$(grep "PHI_ENCRYPTION_KEY=" .env | cut -d= -f2)
  echo "   Key value: ${KEY_VALUE:0:20}..."
else
  echo "❌ FAIL: PHI_ENCRYPTION_KEY not found in .env file"
  exit 1
fi

# Test encryption functions
echo ""
echo "Testing encryption functions..."

TEST_RESULT=$(PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-us-west-1.pooler.supabase.com -p 6543 -U postgres.xkybsjnvuohpqpbkikyn -d postgres -t -c "SELECT public.encrypt_data('test123');" 2>&1)

if [ $? -eq 0 ]; then
  echo "✅ PASS: Encryption function works"
else
  echo "❌ FAIL: Encryption function failed"
  echo "   Error: $TEST_RESULT"
  exit 1
fi

echo ""
echo "================================="
echo "✅ All encryption checks PASSED!"
echo "================================="
echo ""
echo "Summary:"
echo "  - Database encryption key (app.encryption_key): ✅ SET"
echo "  - Environment encryption key (PHI_ENCRYPTION_KEY): ✅ SET"
echo "  - Encryption functions: ✅ WORKING"
echo ""
echo "Your encryption setup is complete!"
