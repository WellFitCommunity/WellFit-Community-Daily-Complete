#!/bin/bash
# Logging Infrastructure Smoke Test
# Tests that all audit tables are receiving data correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database connection details
DB_HOST="aws-0-us-west-1.pooler.supabase.com"
DB_PORT="6543"
DB_USER="postgres.xkybsjnvuohpqpbkikyn"
DB_NAME="postgres"
DB_PASSWORD="MyDaddyLovesMeToo1"

# Supabase project details
SUPABASE_URL="https://xkybsjnvuohpqpbkikyn.supabase.co"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

echo "================================================"
echo "   LOGGING INFRASTRUCTURE SMOKE TEST"
echo "================================================"
echo ""

# Helper function to run SQL
run_sql() {
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1"
}

# Helper function to print test result
print_result() {
    local test_name="$1"
    local result="$2"

    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
    elif [ "$result" = "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} $test_name"
    else
        echo -e "${RED}✗${NC} $test_name"
    fi
}

# Test 1: Verify tables exist
echo "=== Test 1: Database Tables ==="
tables=("audit_logs" "claude_api_audit" "phi_access_log" "security_events")
for table in "${tables[@]}"; do
    count=$(run_sql "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename='$table';")
    if [ "$count" -eq 1 ]; then
        print_result "Table $table exists" "PASS"
    else
        print_result "Table $table exists" "FAIL"
        exit 1
    fi
done
echo ""

# Test 2: Verify RPC functions exist
echo "=== Test 2: Helper Functions ==="
functions=("log_phi_access" "log_security_event")
for func in "${functions[@]}"; do
    count=$(run_sql "SELECT COUNT(*) FROM pg_proc WHERE proname='$func';")
    if [ "$count" -ge 1 ]; then
        print_result "Function $func exists" "PASS"
    else
        print_result "Function $func exists" "FAIL"
        exit 1
    fi
done
echo ""

# Test 3: Check table row counts
echo "=== Test 3: Table Row Counts ==="
for table in "${tables[@]}"; do
    count=$(run_sql "SELECT COUNT(*) FROM $table;")
    echo "  $table: $count rows"
done
echo ""

# Test 4: Verify table schemas
echo "=== Test 4: Table Schemas ==="

# Check audit_logs has critical columns
critical_cols=("event_type" "event_category" "operation" "resource_type" "success" "timestamp")
for col in "${critical_cols[@]}"; do
    exists=$(run_sql "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='$col';")
    if [ "$exists" -eq 1 ]; then
        print_result "audit_logs.$col exists" "PASS"
    else
        print_result "audit_logs.$col exists" "FAIL"
        exit 1
    fi
done
echo ""

# Test 5: Test RPC functions work
echo "=== Test 5: RPC Function Tests ==="

# Test log_phi_access (if we have a valid user_id)
# For now, just verify the function signature
log_phi_access_params=$(run_sql "SELECT COUNT(*) FROM information_schema.parameters WHERE specific_name=(SELECT specific_name FROM information_schema.routines WHERE routine_name='log_phi_access' LIMIT 1);")
if [ "$log_phi_access_params" -ge 6 ]; then
    print_result "log_phi_access has correct parameters" "PASS"
else
    print_result "log_phi_access has correct parameters" "WARN"
fi

log_security_event_params=$(run_sql "SELECT COUNT(*) FROM information_schema.parameters WHERE specific_name=(SELECT specific_name FROM information_schema.routines WHERE routine_name='log_security_event' LIMIT 1);")
if [ "$log_security_event_params" -ge 3 ]; then
    print_result "log_security_event has correct parameters" "PASS"
else
    print_result "log_security_event has correct parameters" "WARN"
fi
echo ""

# Test 6: Verify RLS policies
echo "=== Test 6: Row Level Security Policies ==="
for table in "${tables[@]}"; do
    rls_enabled=$(run_sql "SELECT relrowsecurity FROM pg_class WHERE relname='$table';")
    if [ "$rls_enabled" = "t" ]; then
        print_result "RLS enabled on $table" "PASS"
    else
        print_result "RLS enabled on $table" "FAIL"
    fi

    policy_count=$(run_sql "SELECT COUNT(*) FROM pg_policies WHERE tablename='$table';")
    if [ "$policy_count" -ge 1 ]; then
        print_result "$table has $policy_count policies" "PASS"
    else
        print_result "$table has policies" "WARN"
    fi
done
echo ""

# Test 7: Verify indexes exist
echo "=== Test 7: Performance Indexes ==="
indexes=("idx_audit_logs_event_type" "idx_audit_logs_timestamp" "idx_claude_audit_user_id" "idx_phi_access_accessor_user_id")
for idx in "${indexes[@]}"; do
    exists=$(run_sql "SELECT COUNT(*) FROM pg_indexes WHERE indexname='$idx';")
    if [ "$exists" -eq 1 ]; then
        print_result "Index $idx exists" "PASS"
    else
        print_result "Index $idx exists" "WARN"
    fi
done
echo ""

# Test 8: Check for recent audit events (if any)
echo "=== Test 8: Recent Audit Events ==="
recent_audit=$(run_sql "SELECT COUNT(*) FROM audit_logs WHERE timestamp >= NOW() - INTERVAL '1 hour';")
recent_claude=$(run_sql "SELECT COUNT(*) FROM claude_api_audit WHERE created_at >= NOW() - INTERVAL '1 hour';")
recent_phi=$(run_sql "SELECT COUNT(*) FROM phi_access_log WHERE accessed_at >= NOW() - INTERVAL '1 hour';")
recent_security=$(run_sql "SELECT COUNT(*) FROM security_events WHERE timestamp >= NOW() - INTERVAL '1 hour';")

echo "  Recent events (last hour):"
echo "    audit_logs: $recent_audit"
echo "    claude_api_audit: $recent_claude"
echo "    phi_access_log: $recent_phi"
echo "    security_events: $recent_security"

total_recent=$((recent_audit + recent_claude + recent_phi + recent_security))
if [ "$total_recent" -gt 0 ]; then
    print_result "System has recent audit activity" "PASS"
else
    print_result "System has recent audit activity" "WARN"
    echo "  ⚠ This may be expected if no one has used the system yet"
fi
echo ""

# Test 9: Verify views exist
echo "=== Test 9: Reporting Views ==="
views=("claude_cost_by_user" "phi_access_by_patient" "audit_logs_daily_summary" "security_events_unresolved")
for view in "${views[@]}"; do
    exists=$(run_sql "SELECT COUNT(*) FROM pg_views WHERE viewname='$view';")
    if [ "$exists" -eq 1 ]; then
        print_result "View $view exists" "PASS"
    else
        print_result "View $view exists" "WARN"
    fi
done
echo ""

# Summary
echo "================================================"
echo "   SMOKE TEST COMPLETE"
echo "================================================"
echo ""
echo "Next Steps:"
echo "1. Test Edge Functions by triggering actual requests"
echo "2. Verify audit_logs table receives entries"
echo "3. Check claude_api_audit for API call tracking"
echo "4. Confirm phi_access_log captures admin panel access"
echo ""
echo "To manually test logging:"
echo "  1. Attempt a login (success or failure)"
echo "  2. Check: SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 5;"
echo ""
