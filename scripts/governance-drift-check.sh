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

# --- Drift detection configuration ---
# Numeric scale baselines come from CLAUDE.md "Current Status" and the scale
# table at the bottom of governance-boundaries.md. They are informational —
# drift past DRIFT_THRESHOLD only emits a warning line, never fails the build.
DOC_COMMUNITY_COMPONENTS=15
DOC_ADMIN_COMPONENTS=71
DOC_EDGE_FUNCTIONS=144
DOC_SERVICES=503
DOC_TESTS=11554
DOC_AI_EDGE_SKILLS=28
DOC_TABLES=248
GOD_FILE_LIMIT=600
DRIFT_THRESHOLD=10  # percent
STALE_DAYS=90

GOVERNANCE_DOC="$REPO_ROOT/.claude/rules/governance-boundaries.md"
GOD_FILE_BASELINE="$REPO_ROOT/scripts/god-file-baseline.txt"

# Parse the MCP server list from governance-boundaries.md S9 (single source
# of truth). The table rows look like: "| `mcp-foo-server` | T2 | ... |".
# Anything between backticks in the S9 table is taken as a server name.
parse_documented_mcp_servers() {
  awk '
    /^### S9\. MCP Servers/ { in_s9 = 1; next }
    /^### S10\./           { in_s9 = 0 }
    in_s9 && /^\| `mcp-/ {
      match($0, /`mcp-[a-z0-9-]+`/)
      if (RSTART > 0) {
        name = substr($0, RSTART + 1, RLENGTH - 2)
        print name
      }
    }
  ' "$GOVERNANCE_DOC"
}

readarray -t DOCUMENTED_MCP_SERVERS < <(parse_documented_mcp_servers)
DOC_MCP_SERVERS=${#DOCUMENTED_MCP_SERVERS[@]}

# Parse the documented tier (T1/T2/T3) for each S9 row, plus a "target" flag.
# Emits tab-separated: name <TAB> Tcode <TAB> target|-
# A tier cell annotated "(target)" marks an intentional, accepted code/doc gap
# (e.g. a stub server not yet raised to its eventual tier) and is reported as
# an exception, not drift.
parse_documented_mcp_tiers() {
  awk '
    /^### S9\. MCP Servers/ { in_s9 = 1; next }
    /^### S10\./           { in_s9 = 0 }
    in_s9 && /^\| `mcp-/ {
      if (!match($0, /`mcp-[a-z0-9-]+`/)) next
      name = substr($0, RSTART + 1, RLENGTH - 2)
      n = split($0, cols, "|")
      tiercell = cols[3]
      tcode = ""
      if (match(tiercell, /T[1-3]/)) tcode = substr(tiercell, RSTART, RLENGTH)
      istarget = (tiercell ~ /target/) ? "target" : "-"
      print name "\t" tcode "\t" istarget
    }
  ' "$GOVERNANCE_DOC"
}

# Map a server's declared SERVER_CONFIG.tier string to the T1/T2/T3 scale.
map_tier_to_code() {
  case "$1" in
    external_api) echo "T1" ;;
    user_scoped)  echo "T2" ;;
    admin)        echo "T3" ;;
    *)            echo "?"  ;;
  esac
}

# Read the declared tier string from a server's index.ts (empty if none).
# The trailing `|| true` is REQUIRED: under `set -euo pipefail`, a server that
# declares no tier (e.g. mcp-chain-orchestrator) makes the leading grep return
# non-zero (no match), which `pipefail` propagates and `set -e` would treat as
# fatal at the `raw_tier=$(...)` call site — killing the whole gate before it
# reaches the "no tier declared" guard. Never let this function exit non-zero.
declared_tier_string() {
  local index_file="$1"
  [ -f "$index_file" ] || return 0
  grep -hoE "tier:[[:space:]]*[\"'][a-z_]+[\"']" "$index_file" 2>/dev/null \
    | head -1 | grep -oE "[a-z_]+" | tail -1 || true
}

if [ "$DOC_MCP_SERVERS" -eq 0 ]; then
  echo "ERROR: Failed to parse MCP server list from $GOVERNANCE_DOC S9 section." >&2
  echo "       Verify that section heading '### S9. MCP Servers' is present" >&2
  echo "       and that the table rows use the format: | \`mcp-name\` | tier | purpose |" >&2
  exit 2
fi

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
# Pre-existing files in scripts/god-file-baseline.txt are warnings.
# Only NEW files over the limit fail the build.
# ============================================================
echo "[3/7] God Files (>${GOD_FILE_LIMIT} lines)"

god_files=()
while IFS= read -r line; do
  god_files+=("$line")
done < <(find "$REPO_ROOT/src" \( -name '*.ts' -o -name '*.tsx' \) \
  ! -path '*/__tests__/*' ! -path '*/node_modules/*' \
  ! -name '*.test.*' ! -name '*.spec.*' \
  ! -name '*.generated.*' ! -name '*.d.ts' \
  -exec awk -v limit="$GOD_FILE_LIMIT" \
  'END { if (NR > limit) printf "%s %d\n", FILENAME, NR }' {} \; 2>/dev/null)

new_god_files=0
baselined_god_files=0
for gf in "${god_files[@]}"; do
  filepath=$(echo "$gf" | awk '{print $1}')
  linecount=$(echo "$gf" | awk '{print $2}')
  relative="${filepath#"$REPO_ROOT/"}"

  if [ -f "$GOD_FILE_BASELINE" ] && grep -qxF "$relative" "$GOD_FILE_BASELINE"; then
    baselined_god_files=$(( baselined_god_files + 1 ))
  else
    new_god_files=$(( new_god_files + 1 ))
    echo "    NEW: ${relative}: ${linecount} lines"
  fi
done

if [ ${#god_files[@]} -eq 0 ]; then
  echo "  [PASS] No violations found"
elif [ "$new_god_files" -eq 0 ]; then
  echo "  [PASS] 0 new, ${baselined_god_files} pre-existing (see ${GOD_FILE_BASELINE#"$REPO_ROOT/"})"
else
  echo "  [FAIL] ${new_god_files} new file(s) over ${GOD_FILE_LIMIT} lines (${baselined_god_files} pre-existing baselined)"
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
  echo "  Undocumented MCP servers (${#undocumented_mcp[@]} not in governance-boundaries.md S9):"
  for u in "${undocumented_mcp[@]}"; do
    echo "    + ${u}"
  done
  echo "  Fix: add a row to the S9 table in .claude/rules/governance-boundaries.md"
  EXIT_CODE=1
fi

# Tier drift: compare each server's documented S9 tier against the tier
# declared in its index.ts (SERVER_CONFIG.tier). A tier is a SECURITY control
# (it selects anon-key+RLS vs service-key+RLS-bypass), so — unlike the numeric
# architecture/schema drift above — a mismatch HARD-FAILS the build. Warn-only
# on a security gate is how an under-protected server reaches production and is
# then ignored. The only accepted gap is a row explicitly annotated "(target)"
# in S9: an intentional, reviewed, documented stub (e.g. clearinghouse) carrying
# its own written go-live remediation note. That annotation is the deliberate
# escape valve — it does not stop production, but it forces an explicit Tier-3
# decision in the governance doc rather than a silent pass. An UNKNOWN tier
# (cannot map to T1/T2/T3) also fails: an unverifiable gate is a broken gate.
tier_mismatches=0
tier_targets=0
tier_unknown=0
while IFS=$'\t' read -r srv doc_tier is_target; do
  [ -n "$srv" ] || continue
  index_file="$REPO_ROOT/supabase/functions/${srv}/index.ts"
  [ -f "$index_file" ] || continue   # presence drift already reported above
  raw_tier=$(declared_tier_string "$index_file")
  if [ -z "$raw_tier" ]; then
    continue   # server declares no tier (e.g. orchestrator) — nothing to compare
  fi
  code_tier=$(map_tier_to_code "$raw_tier")
  if [ "$code_tier" = "?" ]; then
    echo "    UNKNOWN tier '${raw_tier}' in ${srv}/index.ts (cannot map to T1/T2/T3)"
    tier_unknown=$(( tier_unknown + 1 ))
    continue
  fi
  if [ "$code_tier" != "$doc_tier" ]; then
    if [ "$is_target" = "target" ]; then
      echo "    EXCEPTION: ${srv} doc=${doc_tier} (target) vs code=${code_tier} (${raw_tier}) — intentional gap"
      tier_targets=$(( tier_targets + 1 ))
    else
      echo "    TIER DRIFT: ${srv} doc=${doc_tier} vs code=${code_tier} (${raw_tier})"
      tier_mismatches=$(( tier_mismatches + 1 ))
    fi
  fi
done < <(parse_documented_mcp_tiers)

if [ "$tier_mismatches" -eq 0 ] && [ "$tier_unknown" -eq 0 ]; then
  echo "  Tier alignment: OK (${tier_targets} accepted target exception(s))"
else
  echo "  Tier alignment: ${tier_mismatches} drift(s) + ${tier_unknown} unknown(s) [FAIL — fix S9 tier OR server SERVER_CONFIG.tier, or annotate '(target)' in S9 with a justification], ${tier_targets} accepted target exception(s)"
  EXIT_CODE=1
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
  echo "Result: FAIL — critical drift (new god files, missing/undocumented MCP servers, or MCP tier drift)"
fi

exit "$EXIT_CODE"
