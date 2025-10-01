#!/bin/bash
# Migration Verification Script
# Verifies that all database changes from 2025-10-01 are properly applied
# Usage: ./scripts/verify-migrations.sh [database-url]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database URL (default to local Supabase)
DB_URL="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

echo "🔍 Verifying migrations on database..."
echo "Database: $DB_URL"
echo ""

# Function to run SQL and check result
check_exists() {
    local name="$1"
    local sql="$2"
    local expected="$3"

    result=$(psql "$DB_URL" -t -c "$sql" 2>&1)

    if echo "$result" | grep -q "$expected"; then
        echo -e "${GREEN}✓${NC} $name"
        return 0
    else
        echo -e "${RED}✗${NC} $name"
        echo "   Expected: $expected"
        echo "   Got: $result"
        return 1
    fi
}

# Track failures
FAILURES=0

echo "Checking Tables..."
echo "─────────────────────────────────────────────────"

check_exists "community_moments table" \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='community_moments');" \
    "t" || ((FAILURES++))

check_exists "affirmations table" \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='affirmations');" \
    "t" || ((FAILURES++))

check_exists "check_ins table" \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='check_ins');" \
    "t" || ((FAILURES++))

echo ""
echo "Checking Columns..."
echo "─────────────────────────────────────────────────"

check_exists "profiles.emergency_contact_phone" \
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='emergency_contact_phone');" \
    "t" || ((FAILURES++))

check_exists "profiles.caregiver_phone" \
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='caregiver_phone');" \
    "t" || ((FAILURES++))

check_exists "self_reports.blood_sugar" \
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='self_reports' AND column_name='blood_sugar');" \
    "t" || ((FAILURES++))

check_exists "self_reports.reviewed_at" \
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='self_reports' AND column_name='reviewed_at');" \
    "t" || ((FAILURES++))

check_exists "check_ins.reviewed_by_name" \
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='check_ins' AND column_name='reviewed_by_name');" \
    "t" || ((FAILURES++))

echo ""
echo "Checking Storage Buckets..."
echo "─────────────────────────────────────────────────"

check_exists "community-moments bucket" \
    "SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id='community-moments');" \
    "t" || ((FAILURES++))

echo ""
echo "Checking RLS Policies..."
echo "─────────────────────────────────────────────────"

check_exists "community_moments has RLS enabled" \
    "SELECT relrowsecurity FROM pg_class WHERE relname='community_moments';" \
    "t" || ((FAILURES++))

check_exists "check_ins has RLS enabled" \
    "SELECT relrowsecurity FROM pg_class WHERE relname='check_ins';" \
    "t" || ((FAILURES++))

check_exists "community_moments SELECT policy" \
    "SELECT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='community_moments' AND policyname='community_moments_select_all');" \
    "t" || ((FAILURES++))

echo ""
echo "Checking Data..."
echo "─────────────────────────────────────────────────"

check_exists "affirmations have data" \
    "SELECT COUNT(*) >= 10 FROM affirmations;" \
    "t" || ((FAILURES++))

echo ""
echo "Checking Indexes..."
echo "─────────────────────────────────────────────────"

check_exists "community_moments user_id index" \
    "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='community_moments' AND indexname='idx_community_moments_user_id');" \
    "t" || ((FAILURES++))

check_exists "check_ins user_id index" \
    "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='check_ins' AND indexname='idx_check_ins_user_id');" \
    "t" || ((FAILURES++))

echo ""
echo "════════════════════════════════════════════════"
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo "Your database is properly migrated."
    exit 0
else
    echo -e "${RED}✗ $FAILURES check(s) failed${NC}"
    echo ""
    echo "To fix, run migrations:"
    echo "  supabase db push --db-url \"$DB_URL\""
    echo ""
    echo "Or apply individual migrations:"
    echo "  psql \"$DB_URL\" < supabase/migrations/20251001000000_create_community_moments_and_affirmations.sql"
    echo "  psql \"$DB_URL\" < supabase/migrations/20251001000001_add_emergency_caregiver_contacts.sql"
    echo "  psql \"$DB_URL\" < supabase/migrations/20251001000002_create_check_ins_table.sql"
    echo "  psql \"$DB_URL\" < supabase/migrations/20251001000003_add_self_reports_missing_columns.sql"
    exit 1
fi
