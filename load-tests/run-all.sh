#!/bin/bash
# Methodist Healthcare - Run All Load Tests
# Duration: ~53 minutes total

set -e

echo "=== Methodist Healthcare Load Testing Suite ==="
echo "Duration: ~53 minutes total"
echo ""

# Check if SUPABASE_ANON_KEY is set
if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: SUPABASE_ANON_KEY not set"
    echo ""
    echo "Set it with:"
    echo "  export SUPABASE_ANON_KEY=\$(grep REACT_APP_SUPABASE_ANON_KEY .env | cut -d '=' -f2)"
    exit 1
fi

# Create results directory
mkdir -p load-tests/results

# Timestamp for this test run
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "✅ Starting test run at $TIMESTAMP"
echo ""

# Test 1: Methodist Baseline (26 minutes)
echo "📊 Test 1/3: Methodist Baseline (26 minutes)"
echo "   Testing 120-180 concurrent users..."
k6 run load-tests/methodist-baseline.js --out json=load-tests/results/baseline-$TIMESTAMP.json
echo "✅ Baseline test complete"
echo ""

# Test 2: Multi-Tenant Isolation (11 minutes)
echo "📊 Test 2/3: Multi-Tenant Isolation (11 minutes)"
echo "   Testing 4 tenants simultaneously..."
k6 run load-tests/multi-tenant-isolation.js --out json=load-tests/results/isolation-$TIMESTAMP.json
echo "✅ Isolation test complete"
echo ""

# Test 3: Database Connection Stress (16 minutes)
echo "📊 Test 3/3: Database Connection Stress (16 minutes)"
echo "   Testing connection pool limits..."
k6 run load-tests/db-connection-stress.js --out json=load-tests/results/db-stress-$TIMESTAMP.json
echo "✅ Database stress test complete"
echo ""

echo "=== All Tests Complete ==="
echo ""
echo "Results saved to:"
echo "  - load-tests/results/baseline-$TIMESTAMP.json"
echo "  - load-tests/results/isolation-$TIMESTAMP.json"
echo "  - load-tests/results/db-stress-$TIMESTAMP.json"
echo ""
echo "Review results above for Methodist readiness assessment."
