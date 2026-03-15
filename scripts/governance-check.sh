#!/usr/bin/env bash
set -uo pipefail

# =============================================================================
# CLAUDE.md Governance Enforcement Script
# =============================================================================
# Converts CLAUDE.md and governance-boundaries.md rules into machine-enforceable
# checks. Intended for CI and pre-commit validation.
#
# Exit 0 = all checks pass
# Exit 1 = one or more violations detected
#
# Note: We use `set -uo pipefail` (no -e) because grep returns exit 1 when
# there are no matches, which would kill pipelines under `set -e` + pipefail.
# Instead, we track failures via the FAIL variable and exit accordingly.
# =============================================================================

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${REPO_ROOT}/src"
FAIL=0
TOTAL_CHECKS=0
PASSED_CHECKS=0

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
pass() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
  printf "  PASS  %s\n" "$1"
}

fail() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  FAIL=1
  printf "  FAIL  %s\n" "$1"
}

section() {
  printf "\n=== %s ===\n" "$1"
}

# Helper: count lines from a grep pipeline, returning 0 on no matches.
# Usage: count_matches <grep pipeline output>
# We use this pattern: RESULT=$( <pipeline> ) || true; COUNT=$(printf "%s" "$RESULT" | wc -l)

# -----------------------------------------------------------------------------
# 1. Import Boundary Violations
# -----------------------------------------------------------------------------
section "Import Boundary Checks"

# Community must NOT import from admin, bed-board, or smart-app
COMMUNITY_ADMIN_VIOLATIONS=$(
  grep -rn \
    -e "from ['\"].*components/admin" \
    -e "import.*components/admin" \
    "${SRC_DIR}/components/community/" 2>/dev/null \
  || true
)

if [ -z "$COMMUNITY_ADMIN_VIOLATIONS" ]; then
  pass "community/ does not import from admin/"
else
  fail "community/ imports from admin/ (forbidden)"
  printf "%s\n" "$COMMUNITY_ADMIN_VIOLATIONS" | head -20
fi

# Admin must NOT import from community (except AdminFeatureToggle.tsx)
ADMIN_COMMUNITY_VIOLATIONS=$(
  grep -rn \
    -e "from ['\"].*components/community" \
    -e "import.*components/community" \
    "${SRC_DIR}/components/admin/" 2>/dev/null \
  | grep -v "AdminFeatureToggle\.tsx" \
  || true
)

if [ -z "$ADMIN_COMMUNITY_VIOLATIONS" ]; then
  pass "admin/ does not import from community/ (AdminFeatureToggle.tsx exempted)"
else
  fail "admin/ imports from community/ (forbidden, except AdminFeatureToggle.tsx)"
  printf "%s\n" "$ADMIN_COMMUNITY_VIOLATIONS" | head -20
fi

# -----------------------------------------------------------------------------
# 2. Forbidden Pattern: `any` type in production code
# -----------------------------------------------------------------------------
section "Forbidden Pattern Checks"

# Match TypeScript type positions only:
#   : any[;,)>\s]  — type annotations
#   <any>          — generic parameters
#   as any         — type casts
# Excludes comment lines to avoid false positives like "has any".
ANY_PATTERN='(:\s*any\s*[;,)>]|<any>|\bas\s+any\b)'
ANY_MATCHES=$(
  grep -rPn \
    --include='*.ts' --include='*.tsx' \
    "$ANY_PATTERN" \
    "${SRC_DIR}/" 2>/dev/null \
  | grep -v '\.test\.' \
  | grep -v '__tests__' \
  | grep -v 'node_modules' \
  | grep -vP ':\d+:\s*(\*|//|/\*\*)' \
  || true
)
ANY_COUNT=0
if [ -n "$ANY_MATCHES" ]; then
  ANY_COUNT=$(printf "%s\n" "$ANY_MATCHES" | wc -l)
fi

if [ "$ANY_COUNT" -eq 0 ]; then
  pass "No \`any\` type usage in production code (0 violations)"
else
  fail "\`any\` type found in production code (${ANY_COUNT} violations)"
  printf "%s\n" "$ANY_MATCHES" | head -10
  if [ "$ANY_COUNT" -gt 10 ]; then
    printf "  ... (showing first 10 of %d)\n" "$ANY_COUNT"
  fi
fi

# -----------------------------------------------------------------------------
# 3. Forbidden Pattern: console.log/error/warn in production code
# -----------------------------------------------------------------------------
CONSOLE_MATCHES=$(
  grep -rn \
    --include='*.ts' --include='*.tsx' \
    -e 'console\.log' -e 'console\.error' -e 'console\.warn' \
    "${SRC_DIR}/" 2>/dev/null \
  | grep -v '\.test\.' \
  | grep -v '__tests__' \
  | grep -v 'setupTests' \
  | grep -v 'node_modules' \
  || true
)
CONSOLE_COUNT=0
if [ -n "$CONSOLE_MATCHES" ]; then
  CONSOLE_COUNT=$(printf "%s\n" "$CONSOLE_MATCHES" | wc -l)
fi

if [ "$CONSOLE_COUNT" -eq 0 ]; then
  pass "No console.log/error/warn in production code (0 violations)"
else
  fail "console.log/error/warn found in production code (${CONSOLE_COUNT} violations)"
  printf "%s\n" "$CONSOLE_MATCHES" | head -10
  if [ "$CONSOLE_COUNT" -gt 10 ]; then
    printf "  ... (showing first 10 of %d)\n" "$CONSOLE_COUNT"
  fi
fi

# -----------------------------------------------------------------------------
# 4. Forbidden Pattern: process.env.REACT_APP_
# -----------------------------------------------------------------------------
REACT_APP_MATCHES=$(
  grep -rn \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    'process\.env\.REACT_APP_' \
    "${SRC_DIR}/" 2>/dev/null \
  | grep -v 'node_modules' \
  || true
)
REACT_APP_COUNT=0
if [ -n "$REACT_APP_MATCHES" ]; then
  REACT_APP_COUNT=$(printf "%s\n" "$REACT_APP_MATCHES" | wc -l)
fi

if [ "$REACT_APP_COUNT" -eq 0 ]; then
  pass "No process.env.REACT_APP_ usage (Vite requires import.meta.env.VITE_*)"
else
  fail "process.env.REACT_APP_ found (${REACT_APP_COUNT} violations — use import.meta.env.VITE_*)"
  printf "%s\n" "$REACT_APP_MATCHES" | head -10
fi

# -----------------------------------------------------------------------------
# 5. Forbidden Pattern: forwardRef (React 19 uses ref as prop)
# -----------------------------------------------------------------------------
FORWARD_REF_MATCHES=$(
  grep -rn \
    --include='*.ts' --include='*.tsx' \
    'forwardRef' \
    "${SRC_DIR}/" 2>/dev/null \
  | grep -v '\.test\.' \
  | grep -v '__tests__' \
  | grep -v 'node_modules' \
  | grep -vP ':\d+:\s*(\*|//|/\*\*)' \
  || true
)
FORWARD_REF_COUNT=0
if [ -n "$FORWARD_REF_MATCHES" ]; then
  FORWARD_REF_COUNT=$(printf "%s\n" "$FORWARD_REF_MATCHES" | wc -l)
fi

if [ "$FORWARD_REF_COUNT" -eq 0 ]; then
  pass "No forwardRef usage (React 19 passes ref as prop)"
else
  fail "forwardRef found (${FORWARD_REF_COUNT} violations — React 19 uses ref as prop)"
  printf "%s\n" "$FORWARD_REF_MATCHES" | head -10
fi

# -----------------------------------------------------------------------------
# 6. Forbidden Pattern: CORS/CSP wildcards
# -----------------------------------------------------------------------------
CSP_WILDCARD_MATCHES=$(
  grep -rn \
    -e 'frame-ancestors \*' -e "frame-ancestors '\*'" \
    -e 'connect-src \*' -e "connect-src '\*'" \
    "${REPO_ROOT}/" 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '\.git/' \
  | grep -v 'build/' \
  | grep -v 'dist/' \
  | grep -v '\.md:' \
  | grep -v 'governance-check\.sh' \
  || true
)
CSP_WILDCARD_COUNT=0
if [ -n "$CSP_WILDCARD_MATCHES" ]; then
  CSP_WILDCARD_COUNT=$(printf "%s\n" "$CSP_WILDCARD_MATCHES" | wc -l)
fi

if [ "$CSP_WILDCARD_COUNT" -eq 0 ]; then
  pass "No CSP wildcard (frame-ancestors *, connect-src *) violations"
else
  fail "CSP wildcard violations found (${CSP_WILDCARD_COUNT})"
  printf "%s\n" "$CSP_WILDCARD_MATCHES" | head -10
fi

# -----------------------------------------------------------------------------
# 7. Forbidden Pattern: WHITE_LABEL_MODE=true
# -----------------------------------------------------------------------------
WLM_MATCHES=$(
  grep -rn 'WHITE_LABEL_MODE=true' \
    "${REPO_ROOT}/" 2>/dev/null \
  | grep -v 'node_modules' \
  | grep -v '\.git/' \
  | grep -v 'build/' \
  | grep -v 'dist/' \
  | grep -v '\.md:' \
  | grep -v 'governance-check\.sh' \
  || true
)
WLM_COUNT=0
if [ -n "$WLM_MATCHES" ]; then
  WLM_COUNT=$(printf "%s\n" "$WLM_MATCHES" | wc -l)
fi

if [ "$WLM_COUNT" -eq 0 ]; then
  pass "No WHITE_LABEL_MODE=true found"
else
  fail "WHITE_LABEL_MODE=true found (${WLM_COUNT} violations — use ALLOWED_ORIGINS)"
  printf "%s\n" "$WLM_MATCHES" | head -10
fi

# -----------------------------------------------------------------------------
# 8. File Size Limit: 600 lines max for .ts/.tsx in src/
#    Uses a baseline allowlist for pre-existing files. Only NEW files over
#    600 lines fail CI. Pre-existing violations are reported as warnings.
# -----------------------------------------------------------------------------
section "File Size Checks (600-line max)"

BASELINE_FILE="${REPO_ROOT}/scripts/god-file-baseline.txt"

OVERSIZED_FILES=$(
  find "${SRC_DIR}" -type f \( -name '*.ts' -o -name '*.tsx' \) \
    ! -path '*/node_modules/*' \
    ! -path '*/__tests__/*' \
    ! -name '*.test.*' \
    ! -name '*.spec.*' \
    ! -name '*.generated.*' \
    ! -name '*.d.ts' \
    -exec wc -l {} + 2>/dev/null \
  | grep -v ' total$' \
  | awk '$1 > 600 { print $0 }' \
  | sort -rn \
  || true
)

OVERSIZED_COUNT=0
NEW_VIOLATIONS=0
BASELINE_COUNT=0

if [ -n "$OVERSIZED_FILES" ]; then
  OVERSIZED_COUNT=$(printf "%s\n" "$OVERSIZED_FILES" | wc -l)

  # Separate new violations from baselined (pre-existing) ones
  if [ -f "$BASELINE_FILE" ]; then
    while IFS= read -r line; do
      # Extract the file path (second field after line count)
      filepath=$(echo "$line" | awk '{ gsub(/.*src\//, "src/", $2); print $2 }')
      if ! grep -qxF "$filepath" "$BASELINE_FILE" 2>/dev/null; then
        NEW_VIOLATIONS=$((NEW_VIOLATIONS + 1))
        printf "    NEW: %s\n" "$line"
      else
        BASELINE_COUNT=$((BASELINE_COUNT + 1))
      fi
    done <<< "$OVERSIZED_FILES"
  else
    # No baseline file — all violations are new
    NEW_VIOLATIONS=$OVERSIZED_COUNT
  fi
fi

if [ "$NEW_VIOLATIONS" -eq 0 ]; then
  pass "No NEW files exceed 600 lines (${BASELINE_COUNT} pre-existing baselined)"
else
  fail "${NEW_VIOLATIONS} NEW file(s) exceed the 600-line limit (${BASELINE_COUNT} pre-existing baselined)"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
section "Summary"

FAILED_CHECKS=$((TOTAL_CHECKS - PASSED_CHECKS))

printf "\n"
printf "  Total checks:  %d\n" "$TOTAL_CHECKS"
printf "  Passed:        %d\n" "$PASSED_CHECKS"
printf "  Failed:        %d\n" "$FAILED_CHECKS"
printf "\n"

if [ "$FAIL" -eq 0 ]; then
  printf "  ALL GOVERNANCE CHECKS PASSED\n\n"
  exit 0
else
  printf "  GOVERNANCE VIOLATIONS DETECTED — see failures above\n\n"
  exit 1
fi
