#!/usr/bin/env bash
# ============================================================
# Integration Test Runner
#
# Runs Deno-based integration tests against LIVE Supabase.
# These tests make real HTTP calls to deployed edge functions
# and verify database state using the TEST-0001 tenant.
#
# Usage:
#   ./scripts/test-integration.sh              # Run all integration tests
#   ./scripts/test-integration.sh critical     # Run Track 2 (critical paths) only
#   ./scripts/test-integration.sh mcp          # Run MCP server tests only
#
# Required env vars (auto-loaded from .env.local if present):
#   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$PROJECT_ROOT/supabase/functions/__tests__"

# Load env from .env.local if not already set
if [[ -z "${SUPABASE_URL:-}" ]] && [[ -f "$PROJECT_ROOT/.env.local" ]]; then
  echo "📋 Loading environment from .env.local..."
  set -a
  # Export VITE_ vars as their non-VITE equivalents for Deno
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    # Strip quotes from value
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"

    export "$key=$value"

    # Map VITE_ vars to non-VITE for Deno
    if [[ "$key" == "VITE_SUPABASE_URL" && -z "${SUPABASE_URL:-}" ]]; then
      export SUPABASE_URL="$value"
    fi
    if [[ "$key" == "VITE_SUPABASE_ANON_KEY" && -z "${SUPABASE_ANON_KEY:-}" ]]; then
      export SUPABASE_ANON_KEY="$value"
    fi
    if [[ "$key" == "SB_SECRET_KEY" && -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
      export SUPABASE_SERVICE_ROLE_KEY="$value"
    fi
    if [[ "$key" == "SB_SERVICE_ROLE_KEY" && -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
      export SUPABASE_SERVICE_ROLE_KEY="$value"
    fi
    if [[ "$key" == "MCP_ADMIN_KEY" && -z "${MCP_ADMIN_KEY:-}" ]]; then
      export MCP_ADMIN_KEY="$value"
    fi
  done < "$PROJECT_ROOT/.env.local"
  set +a
fi

# Add Deno to PATH if installed locally
if [[ -d "$HOME/.deno/bin" ]]; then
  export PATH="$HOME/.deno/bin:$PATH"
fi

# Validate required env
if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "❌ SUPABASE_URL not set. Set it in .env.local or export it."
  exit 1
fi
if [[ -z "${SUPABASE_ANON_KEY:-}" ]]; then
  echo "❌ SUPABASE_ANON_KEY not set. Set it in .env.local or export it."
  exit 1
fi

echo "🧪 Integration Test Runner"
echo "   Supabase URL: ${SUPABASE_URL:0:40}..."
echo "   Anon Key:     ${SUPABASE_ANON_KEY:0:20}..."
echo "   Service Role: ${SUPABASE_SERVICE_ROLE_KEY:+SET}${SUPABASE_SERVICE_ROLE_KEY:-NOT SET}"
echo "   MCP Admin:    ${MCP_ADMIN_KEY:+SET}${MCP_ADMIN_KEY:-NOT SET}"
echo ""

# Determine which tests to run
FILTER="${1:-all}"
DENO_FLAGS="--allow-net --allow-env --allow-read"

case "$FILTER" in
  critical)
    echo "🎯 Running Track 2: Critical Path Tests"
    TEST_FILES="$TEST_DIR/critical-path-integration.test.ts"
    ;;
  mcp)
    echo "🎯 Running MCP Server Integration Tests"
    TEST_FILES="$TEST_DIR/mcp-integration.test.ts"
    ;;
  all)
    echo "🎯 Running ALL integration tests"
    TEST_FILES="$TEST_DIR/*-integration.test.ts $TEST_DIR/mcp-integration.test.ts"
    ;;
  *)
    echo "🎯 Running tests matching: $FILTER"
    TEST_FILES="$TEST_DIR/$FILTER"
    ;;
esac

# Run with Deno
PASS=0
FAIL=0
TOTAL=0

for test_file in $TEST_FILES; do
  if [[ ! -f "$test_file" ]]; then
    echo "⚠️  Skipping (not found): $test_file"
    continue
  fi

  TOTAL=$((TOTAL + 1))
  echo ""
  echo "━━━ $(basename "$test_file") ━━━"

  if deno test $DENO_FLAGS "$test_file" 2>&1; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
done

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Integration Test Summary"
echo "   Files: $TOTAL | Passed: $PASS | Failed: $FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $FAIL -gt 0 ]]; then
  echo "❌ $FAIL file(s) had failures"
  exit 1
else
  echo "✅ All integration tests passed"
  exit 0
fi
