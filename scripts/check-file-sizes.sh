#!/usr/bin/env bash
set -uo pipefail

# =============================================================================
# 600-Line File Size Enforcement
# =============================================================================
# Scans .ts/.tsx files in src/ AND supabase/functions/ for files exceeding the
# 600-line limit defined in CLAUDE.md Commandment #12.
#
# Pre-existing god files are allowlisted via baseline files. ONLY NEW god files
# (not in baseline) fail CI. Baselined files are reported as warnings.
#
# Baseline files:
#   - scripts/god-file-baseline.txt          (src/)
#   - scripts/god-file-baseline-functions.txt (supabase/functions/)
#
# Excludes:
#   - __tests__/ directories
#   - *.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx
#   - *.generated.ts (auto-generated)
#   - *.d.ts (type declarations)
#   - src/types/database.generated.ts (explicit per tracker)
#
# Exit codes:
#   0 = pass (no NEW god files)
#   1 = fail (one or more NEW god files detected)
#
# Note: We use `set -uo pipefail` (no -e) because grep/find returns exit 1
# when there are no matches. We track failures via the FAIL variable.
# =============================================================================

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${REPO_ROOT}/src"
FUNCTIONS_DIR="${REPO_ROOT}/supabase/functions"
BASELINE_SRC="${REPO_ROOT}/scripts/god-file-baseline.txt"
BASELINE_FUNCTIONS="${REPO_ROOT}/scripts/god-file-baseline-functions.txt"
LINE_LIMIT=600
FAIL=0

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
section() {
  printf "\n=== %s ===\n" "$1"
}

# Scan a directory and emit "<lines> <relative-path>" for files > LINE_LIMIT.
# Args:
#   $1 = directory to scan (absolute path)
#   $2 = repo-relative prefix to strip (e.g., "src" or "supabase/functions")
scan_dir() {
  local scan_root="$1"
  local _rel_prefix_unused="$2"

  if [ ! -d "$scan_root" ]; then
    return 0
  fi

  find "$scan_root" -type f \( -name '*.ts' -o -name '*.tsx' \) \
    ! -path '*/node_modules/*' \
    ! -path '*/__tests__/*' \
    ! -name '*.test.ts' \
    ! -name '*.test.tsx' \
    ! -name '*.spec.ts' \
    ! -name '*.spec.tsx' \
    ! -name '*.generated.ts' \
    ! -name '*.generated.tsx' \
    ! -name '*.d.ts' \
    ! -path '*/database.generated.ts' \
    -exec wc -l {} + 2>/dev/null \
    | grep -v ' total$' \
    | awk -v limit="$LINE_LIMIT" '$1 > limit { print $0 }' \
    | sort -rn
}

# Compare oversized files against a baseline file.
# Args:
#   $1 = oversized scan output ("<lines> <path>" lines)
#   $2 = baseline file path (each line is a repo-relative path)
#   $3 = repo prefix to recognize in scan output (e.g., "src/" or "supabase/functions/")
#   $4 = human label for messages (e.g., "src/" or "supabase/functions/")
# Sets globals: BASELINE_COUNT, NEW_VIOLATIONS, NEW_VIOLATION_LINES
compare_against_baseline() {
  local oversized="$1"
  local baseline="$2"
  local prefix="$3"
  local label="$4"

  BASELINE_COUNT=0
  NEW_VIOLATIONS=0
  NEW_VIOLATION_LINES=""

  if [ -z "$oversized" ]; then
    return 0
  fi

  while IFS= read -r line; do
    # Each line looks like:    "  1234 /abs/path/file.ts"
    # Strip leading whitespace and split into lines + path.
    local lines path rel
    lines=$(printf "%s" "$line" | awk '{ print $1 }')
    path=$(printf "%s" "$line" | awk '{ $1=""; sub(/^ /,""); print }')

    # Convert to repo-relative path. We anchor on the known prefix.
    rel=$(printf "%s" "$path" | sed "s|^${REPO_ROOT}/||")

    # Defensive: ensure rel begins with the expected prefix
    case "$rel" in
      "${prefix}"*) ;;
      *)
        # Could not normalize — treat as NEW (conservative)
        NEW_VIOLATIONS=$((NEW_VIOLATIONS + 1))
        NEW_VIOLATION_LINES="${NEW_VIOLATION_LINES}    NEW (${label}): ${lines} lines  ${rel}
"
        continue
        ;;
    esac

    if [ -f "$baseline" ] && grep -qxF "$rel" "$baseline" 2>/dev/null; then
      BASELINE_COUNT=$((BASELINE_COUNT + 1))
    else
      NEW_VIOLATIONS=$((NEW_VIOLATIONS + 1))
      NEW_VIOLATION_LINES="${NEW_VIOLATION_LINES}    NEW (${label}): ${lines} lines  ${rel}
"
    fi
  done <<< "$oversized"
}

# -----------------------------------------------------------------------------
# Scan src/
# -----------------------------------------------------------------------------
section "File Size Check: src/ (.ts/.tsx, > ${LINE_LIMIT} lines)"

OVERSIZED_SRC=$(scan_dir "$SRC_DIR" "src")
compare_against_baseline "$OVERSIZED_SRC" "$BASELINE_SRC" "src/" "src/"
SRC_BASELINE=$BASELINE_COUNT
SRC_NEW=$NEW_VIOLATIONS
SRC_NEW_LINES="$NEW_VIOLATION_LINES"

if [ "$SRC_NEW" -gt 0 ]; then
  FAIL=1
  printf "  FAIL  %d NEW god file(s) in src/ (baseline: %d pre-existing)\n" "$SRC_NEW" "$SRC_BASELINE"
  printf "%s" "$SRC_NEW_LINES"
else
  printf "  PASS  No NEW god files in src/ (%d pre-existing baselined)\n" "$SRC_BASELINE"
fi

# -----------------------------------------------------------------------------
# Scan supabase/functions/
# -----------------------------------------------------------------------------
section "File Size Check: supabase/functions/ (.ts/.tsx, > ${LINE_LIMIT} lines)"

OVERSIZED_FUNCTIONS=$(scan_dir "$FUNCTIONS_DIR" "supabase/functions")
compare_against_baseline "$OVERSIZED_FUNCTIONS" "$BASELINE_FUNCTIONS" "supabase/functions/" "supabase/functions/"
FN_BASELINE=$BASELINE_COUNT
FN_NEW=$NEW_VIOLATIONS
FN_NEW_LINES="$NEW_VIOLATION_LINES"

if [ "$FN_NEW" -gt 0 ]; then
  FAIL=1
  printf "  FAIL  %d NEW god file(s) in supabase/functions/ (baseline: %d pre-existing)\n" "$FN_NEW" "$FN_BASELINE"
  printf "%s" "$FN_NEW_LINES"
else
  printf "  PASS  No NEW god files in supabase/functions/ (%d pre-existing baselined)\n" "$FN_BASELINE"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
section "Summary"

TOTAL_BASELINE=$((SRC_BASELINE + FN_BASELINE))
TOTAL_NEW=$((SRC_NEW + FN_NEW))

printf "\n"
printf "  Baseline (pre-existing god files): %d\n" "$TOTAL_BASELINE"
printf "    - src/                          : %d\n" "$SRC_BASELINE"
printf "    - supabase/functions/           : %d\n" "$FN_BASELINE"
printf "  NEW violations (> %d lines)       : %d\n" "$LINE_LIMIT" "$TOTAL_NEW"
printf "\n"

if [ "$FAIL" -eq 0 ]; then
  printf "  FILE SIZE CHECK PASSED\n"
  printf "  Note: %d pre-existing god files remain in the baseline.\n" "$TOTAL_BASELINE"
  printf "  See docs/trackers/god-file-decomposition-tracker.md for the remediation plan.\n\n"
  exit 0
else
  printf "  FILE SIZE CHECK FAILED — see NEW violations above\n"
  printf "  Either decompose the file into < %d-line modules,\n" "$LINE_LIMIT"
  printf "  or (only if approved by Maria) add it to the appropriate baseline file:\n"
  printf "    - src/                  -> scripts/god-file-baseline.txt\n"
  printf "    - supabase/functions/   -> scripts/god-file-baseline-functions.txt\n\n"
  exit 1
fi
