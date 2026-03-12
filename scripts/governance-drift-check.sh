#!/usr/bin/env bash
set -euo pipefail

# Governance Drift Validation Script
# Detects when actual codebase state has drifted from governance documentation claims.
# Usage: ./scripts/governance-drift-check.sh [--skip-tests]

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_TESTS=false
EXIT_CODE=0

for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=true ;;
    --help|-h)
      echo "Usage: $0 [--skip-tests]"
      echo "  --skip-tests  Skip the slow npm test count check"
      exit 0
      ;;
    *) echo "Unknown argument: $arg"; exit 2 ;;
  esac
done

# --- Documented baselines from governance-boundaries.md and CLAUDE.md ---
DOC_COMMUNITY_COMPONENTS=15
DOC_ADMIN_COMPONENTS=71
DOC_EDGE_FUNCTIONS=144
DOC_SERVICES=503
DOC_TESTS=10893
DOC_AI_EDGE_SKILLS=28
DOC_TABLES=248
DOC_MCP_SERVERS=11
GOD_FILE_LIMIT=600
DRIFT_THRESHOLD=10  # percent
STALE_DAYS=90

# Documented MCP servers (from governance-boundaries.md S9)
DOCUMENTED_MCP_SERVERS=(
  mcp-claude-server
  mcp-fhir-server
  mcp-hl7-x12-server
  mcp-prior-auth-server
  mcp-clearinghouse-server
  mcp-cms-coverage-server
  mcp-npi-registry-server
  mcp-postgres-server
  mcp-medical-codes-server
  mcp-edge-functions-server
  mcp-medical-coding-server
)

# --- Utility functions ---

drift_check() {
  local actual=$1 documented=$2
  if [ "$documented" -eq 0 ]; then
    echo "DRIFT"
    return
  fi
  local diff=$(( actual - documented ))
  if [ "$diff" -lt 0 ]; then diff=$(( -diff )); fi
  local pct=$(( (diff * 100) / documented ))
  if [ "$pct" -gt "$DRIFT_THRESHOLD" ]; then
    echo "DRIFT (+/- ${pct}%)"
  else
    echo "OK (+/- ${pct}%)"
  fi
}

days_since_modified() {
  local filepath="$1"
  if [ ! -f "$filepath" ]; then
    echo "MISSING"
    return
  fi
  local mod_epoch
  mod_epoch=$(stat -c %Y "$filepath" 2>/dev/null || stat -f %m "$filepath" 2>/dev/null)
  local now_epoch
  now_epoch=$(date +%s)
  echo $(( (now_epoch - mod_epoch) / 86400 ))
}

# --- Begin report ---

echo ""
echo "GOVERNANCE DRIFT REPORT — $(date '+%Y-%m-%d %H:%M:%S')"
echo "====================================="
echo ""

# ============================================================
# [1/7] Architecture Boundaries
# ============================================================
echo "[1/7] Architecture Boundaries"

# Community components: community/ + check-in/ (both System A per governance)
community_count=$(find "$REPO_ROOT/src/components/community" -name '*.tsx' 2>/dev/null | wc -l)
checkin_count=$(find "$REPO_ROOT/src/components/check-in" -name '*.tsx' 2>/dev/null | wc -l)
actual_community=$(( community_count + checkin_count ))
echo "  Community components: ${actual_community} (documented: ~${DOC_COMMUNITY_COMPONENTS}) [$(drift_check "$actual_community" "$DOC_COMMUNITY_COMPONENTS")]"

# Admin components: top-level .tsx files only (matches governance "71 admin components" claim)
actual_admin=$(find "$REPO_ROOT/src/components/admin" -maxdepth 1 -name '*.tsx' 2>/dev/null | wc -l)
actual_admin_all=$(find "$REPO_ROOT/src/components/admin" -name '*.tsx' 2>/dev/null | wc -l)
echo "  Admin components (top-level): ${actual_admin} (documented: ~${DOC_ADMIN_COMPONENTS}) [$(drift_check "$actual_admin" "$DOC_ADMIN_COMPONENTS")]"
echo "  Admin components (all, incl. subdirs): ${actual_admin_all}"

# Edge functions: directories under supabase/functions/, excluding _shared
actual_edge=$(find "$REPO_ROOT/supabase/functions" -mindepth 1 -maxdepth 1 -type d \
  ! -name '_shared' ! -name 'node_modules' 2>/dev/null | wc -l)
echo "  Edge functions: ${actual_edge} (documented: ~${DOC_EDGE_FUNCTIONS}) [$(drift_check "$actual_edge" "$DOC_EDGE_FUNCTIONS")]"

# Service files
actual_services=$(find "$REPO_ROOT/src/services" -name '*.ts' -o -name '*.tsx' 2>/dev/null | wc -l)
echo "  Services: ${actual_services} (documented: ~${DOC_SERVICES}) [$(drift_check "$actual_services" "$DOC_SERVICES")]"

echo ""

# ============================================================
# [2/7] Schema State
# ============================================================
echo "[2/7] Schema State"

migration_count=$(find "$REPO_ROOT/supabase/migrations" -name '*.sql' 2>/dev/null | wc -l)
echo "  Migration files: ${migration_count}"

# Approximate table count from CREATE TABLE statements across all migrations
if [ "$migration_count" -gt 0 ]; then
  approx_tables=$(grep -rioh 'CREATE TABLE[^(]*' "$REPO_ROOT/supabase/migrations/"*.sql 2>/dev/null \
    | grep -i 'IF NOT EXISTS\|CREATE TABLE' | wc -l)
  echo "  Approx CREATE TABLE statements: ${approx_tables} (documented: ~${DOC_TABLES}) [$(drift_check "$approx_tables" "$DOC_TABLES")]"
fi

echo ""

# ============================================================
# [3/7] God Files (>600 lines)
# ============================================================
echo "[3/7] God Files (>${GOD_FILE_LIMIT} lines)"

god_files=()
while IFS= read -r line; do
  god_files+=("$line")
done < <(find "$REPO_ROOT/src" \( -name '*.ts' -o -name '*.tsx' \) \
  ! -path '*/__tests__/*' ! -path '*/node_modules/*' \
  -exec awk -v limit="$GOD_FILE_LIMIT" -v root="$REPO_ROOT" \
  'END { if (NR > limit) printf "%s %d\n", FILENAME, NR }' {} \; 2>/dev/null)

if [ ${#god_files[@]} -eq 0 ]; then
  echo "  [PASS] No violations found"
else
  echo "  [FAIL] ${#god_files[@]} file(s) over ${GOD_FILE_LIMIT} lines:"
  for gf in "${god_files[@]}"; do
    filepath=$(echo "$gf" | awk '{print $1}')
    linecount=$(echo "$gf" | awk '{print $2}')
    relative="${filepath#"$REPO_ROOT/"}"
    echo "    ${relative}: ${linecount} lines"
  done
  EXIT_CODE=1
fi

echo ""

# ============================================================
# [4/7] Test Baseline
# ============================================================
echo "[4/7] Test Baseline"

if [ "$SKIP_TESTS" = true ]; then
  echo "  [SKIPPED] --skip-tests flag set"
else
  echo "  Running tests (this may take a minute)..."
  test_output=$(cd "$REPO_ROOT" && npx vitest run --reporter=json 2>/dev/null || true)
  actual_tests=$(echo "$test_output" | grep -o '"numPassedTests":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
  actual_failed=$(echo "$test_output" | grep -o '"numFailedTests":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
  actual_suites=$(echo "$test_output" | grep -o '"numPassedTestSuites":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")

  if [ "$actual_tests" = "0" ]; then
    echo "  [WARN] Could not parse test count from vitest output"
  else
    diff_tests=$(( actual_tests - DOC_TESTS ))
    if [ "$diff_tests" -lt 0 ]; then diff_tests=$(( -diff_tests )); fi
    if [ "$diff_tests" -gt 50 ]; then
      status="DRIFT (delta: ${diff_tests})"
    else
      status="OK (delta: ${diff_tests})"
    fi
    echo "  Current: ${actual_tests} passed, ${actual_failed} failed, ${actual_suites} suites (documented: ${DOC_TESTS}) [${status}]"
  fi
fi

echo ""

# ============================================================
# [5/7] AI Skills
# ============================================================
echo "[5/7] AI Skills"

actual_ai_edge=$(find "$REPO_ROOT/supabase/functions" -mindepth 1 -maxdepth 1 -type d -name 'ai-*' 2>/dev/null | wc -l)
echo "  AI edge functions: ${actual_ai_edge} (documented: ${DOC_AI_EDGE_SKILLS}) [$(drift_check "$actual_ai_edge" "$DOC_AI_EDGE_SKILLS")]"

echo ""

# ============================================================
# [6/7] MCP Servers
# ============================================================
echo "[6/7] MCP Servers"

mcp_present=0
mcp_missing=()
for server in "${DOCUMENTED_MCP_SERVERS[@]}"; do
  if [ -f "$REPO_ROOT/supabase/functions/${server}/index.ts" ]; then
    mcp_present=$(( mcp_present + 1 ))
  else
    mcp_missing+=("$server")
  fi
done

# Also detect undocumented MCP servers
undocumented_mcp=()
while IFS= read -r dir; do
  name=$(basename "$dir")
  found=false
  for doc in "${DOCUMENTED_MCP_SERVERS[@]}"; do
    if [ "$name" = "$doc" ]; then found=true; break; fi
  done
  if [ "$found" = false ]; then
    undocumented_mcp+=("$name")
  fi
done < <(find "$REPO_ROOT/supabase/functions" -mindepth 1 -maxdepth 1 -type d -name 'mcp-*' 2>/dev/null)

if [ ${#mcp_missing[@]} -eq 0 ]; then
  echo "  Documented: ${mcp_present}/${DOC_MCP_SERVERS} present [OK]"
else
  echo "  Documented: ${mcp_present}/${DOC_MCP_SERVERS} present [MISSING]"
  for m in "${mcp_missing[@]}"; do
    echo "    MISSING: ${m}"
  done
  EXIT_CODE=1
fi

if [ ${#undocumented_mcp[@]} -gt 0 ]; then
  echo "  Undocumented MCP servers (${#undocumented_mcp[@]} not in governance-boundaries.md):"
  for u in "${undocumented_mcp[@]}"; do
    echo "    + ${u}"
  done
fi

echo ""

# ============================================================
# [7/7] Governance Freshness
# ============================================================
echo "[7/7] Governance Freshness"

governance_files=(
  "CLAUDE.md"
  ".claude/rules/governance-boundaries.md"
  "docs/PROJECT_STATE.md"
)

for gf in "${governance_files[@]}"; do
  full_path="$REPO_ROOT/$gf"
  days=$(days_since_modified "$full_path")
  if [ "$days" = "MISSING" ]; then
    echo "  ${gf}: MISSING"
  elif [ "$days" -gt "$STALE_DAYS" ]; then
    echo "  ${gf}: last modified ${days} days ago [STALE]"
  else
    echo "  ${gf}: last modified ${days} days ago [OK]"
  fi
done

echo ""
echo "====================================="

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "Result: PASS — no critical drift detected"
else
  echo "Result: FAIL — critical issues found (god files or missing MCP servers)"
fi

exit "$EXIT_CODE"
