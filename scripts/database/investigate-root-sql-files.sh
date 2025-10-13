#!/bin/bash

# ============================================================================
# Investigation Script for Root SQL Files
# ============================================================================
#
# This script checks your Supabase database to determine which root SQL files
# have been applied and which can be safely deleted.
#
# Usage:
#   ./scripts/database/investigate-root-sql-files.sh
#
# Requirements:
#   - Supabase CLI installed
#   - Logged in to Supabase (supabase login)
#   - Linked to project (supabase link)
#
# ============================================================================

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║         🔍 Root SQL Files Investigation                      ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Error: Supabase CLI not found${NC}"
    echo "Install it from: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Check if we're linked to a project
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo "Run: supabase login"
    exit 1
fi

echo -e "${BLUE}Investigating remaining SQL files in root...${NC}"
echo ""

# Create temporary SQL file for investigation
INVESTIGATION_SQL=$(mktemp)

cat > "$INVESTIGATION_SQL" << 'EOF'
-- Investigation Queries for Root SQL Files

-- ============================================================================
-- 1. CHECK PHI ENCRYPTION IMPLEMENTATION
-- ============================================================================

\echo '========================================'
\echo '1. PHI ENCRYPTION INVESTIGATION'
\echo '========================================'
\echo ''

-- Check if check_ins_audit table exists
\echo 'Checking check_ins_audit table...'
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'check_ins_audit')
        THEN '✅ check_ins_audit table EXISTS'
        ELSE '❌ check_ins_audit table DOES NOT EXIST'
    END as table_status;

-- Check for encrypted columns in check_ins_audit
\echo ''
\echo 'Checking encrypted columns in check_ins_audit...'
SELECT
    column_name,
    data_type,
    '✅ ENCRYPTED COLUMN FOUND' as status
FROM information_schema.columns
WHERE table_name = 'check_ins_audit'
  AND column_name LIKE '%encrypted%'
ORDER BY column_name;

-- Check if risk_assessments table exists
\echo ''
\echo 'Checking risk_assessments table...'
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'risk_assessments')
        THEN '✅ risk_assessments table EXISTS'
        ELSE '❌ risk_assessments table DOES NOT EXIST'
    END as table_status;

-- Check for encrypted columns in risk_assessments
\echo ''
\echo 'Checking encrypted columns in risk_assessments...'
SELECT
    column_name,
    data_type,
    '✅ ENCRYPTED COLUMN FOUND' as status
FROM information_schema.columns
WHERE table_name = 'risk_assessments'
  AND column_name LIKE '%encrypted%'
ORDER BY column_name;

-- Check if encryption functions exist
\echo ''
\echo 'Checking PHI encryption functions...'
SELECT
    routine_name,
    routine_type,
    '✅ FUNCTION FOUND' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('encrypt_phi_text', 'decrypt_phi_text', 'encrypt_phi_integer', 'decrypt_phi_integer')
ORDER BY routine_name;

-- ============================================================================
-- 2. CHECK USER QUESTIONS SCHEMA
-- ============================================================================

\echo ''
\echo '========================================'
\echo '2. USER QUESTIONS SCHEMA INVESTIGATION'
\echo '========================================'
\echo ''

-- Check if user_questions table exists
\echo 'Checking user_questions table...'
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_questions')
        THEN '✅ user_questions table EXISTS'
        ELSE '❌ user_questions table DOES NOT EXIST'
    END as table_status;

-- Show user_questions schema if it exists
\echo ''
\echo 'User questions table schema (if exists):'
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_questions'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. SUMMARY
-- ============================================================================

\echo ''
\echo '========================================'
\echo '3. SUMMARY'
\echo '========================================'
\echo ''

-- Count total tables checked
SELECT
    'TABLES CHECKED' as category,
    COUNT(*) as count
FROM (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('check_ins_audit', 'risk_assessments', 'user_questions')
) t;

-- Count encrypted columns found
SELECT
    'ENCRYPTED COLUMNS' as category,
    COUNT(*) as count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%encrypted%';

-- Count encryption functions found
SELECT
    'ENCRYPTION FUNCTIONS' as category,
    COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%phi%';

EOF

echo -e "${BLUE}Running investigation queries...${NC}"
echo ""

# Execute the investigation
# Note: This assumes you have a connection to Supabase
# You may need to adjust this based on your setup

if supabase db diff --help &> /dev/null; then
    # If using Supabase CLI, we need to connect differently
    echo -e "${YELLOW}⚠️  Manual Step Required:${NC}"
    echo ""
    echo "Please run these investigation queries in your Supabase SQL Editor:"
    echo ""
    cat "$INVESTIGATION_SQL"
    echo ""
    echo "Then run: ./scripts/database/process-investigation-results.sh"
else
    echo -e "${YELLOW}⚠️  Cannot automatically query remote database${NC}"
    echo ""
    echo "Investigation queries have been saved to: ${INVESTIGATION_SQL}"
    echo ""
    echo "To investigate:"
    echo "1. Go to Supabase Dashboard → SQL Editor"
    echo "2. Copy the queries from: ${INVESTIGATION_SQL}"
    echo "3. Run them and review results"
fi

# Cleanup
rm "$INVESTIGATION_SQL" 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}Investigation script complete!${NC}"
echo ""
echo "Based on the results, update ROOT_SQL_FILES_ANALYSIS.md with:"
echo "  • Whether PHI encryption is implemented"
echo "  • Whether user_questions schema exists"
echo "  • Which files can be deleted vs archived"
echo ""
