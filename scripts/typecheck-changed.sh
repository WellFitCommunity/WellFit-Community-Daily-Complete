#!/usr/bin/env bash
# Scoped typecheck — only reports TypeScript errors in files changed since last commit
# Usage: bash scripts/typecheck-changed.sh [base-ref]
#   base-ref defaults to HEAD (uncommitted changes) or HEAD~1 (if nothing uncommitted)

set -euo pipefail

BASE="${1:-}"

# Determine which files changed
if [ -n "$BASE" ]; then
  CHANGED=$(git diff --name-only "$BASE" -- 'src/*.ts' 'src/*.tsx' 2>/dev/null || true)
elif [ -n "$(git diff --name-only -- 'src/*.ts' 'src/*.tsx' 2>/dev/null)" ]; then
  # Uncommitted changes
  CHANGED=$(git diff --name-only -- 'src/*.ts' 'src/*.tsx' 2>/dev/null; git diff --name-only --cached -- 'src/*.ts' 'src/*.tsx' 2>/dev/null)
else
  # No uncommitted changes — compare to previous commit
  CHANGED=$(git diff --name-only HEAD~1 -- 'src/*.ts' 'src/*.tsx' 2>/dev/null || true)
fi

# Deduplicate
CHANGED=$(echo "$CHANGED" | sort -u | grep -v '^$' || true)

if [ -z "$CHANGED" ]; then
  echo "✅ typecheck (scoped): no .ts/.tsx files changed — nothing to check"
  exit 0
fi

FILE_COUNT=$(echo "$CHANGED" | wc -l | tr -d ' ')
echo "🔍 Scoped typecheck: checking errors in $FILE_COUNT changed file(s)..."

# Build grep pattern from changed file paths
PATTERN=$(echo "$CHANGED" | sed 's/[.[\*^$()+?{|\\]/\\&/g' | paste -sd'|' -)

# Run full tsc but filter output to only changed files
TSC_OUTPUT=$(NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit --pretty false 2>&1 || true)

if [ -z "$TSC_OUTPUT" ]; then
  echo "✅ typecheck (scoped): 0 errors in changed files (0 errors project-wide)"
  exit 0
fi

# Filter to only errors in changed files
SCOPED_ERRORS=$(echo "$TSC_OUTPUT" | grep -E "$PATTERN" || true)

if [ -z "$SCOPED_ERRORS" ]; then
  # Count total project errors for awareness
  TOTAL=$(echo "$TSC_OUTPUT" | grep -c "error TS" || echo "0")
  echo "✅ typecheck (scoped): 0 errors in changed files ($TOTAL pre-existing project-wide)"
  exit 0
fi

ERROR_COUNT=$(echo "$SCOPED_ERRORS" | grep -c "error TS" || echo "0")
echo "❌ typecheck (scoped): $ERROR_COUNT error(s) in changed files:"
echo ""
echo "$SCOPED_ERRORS"
exit 1
