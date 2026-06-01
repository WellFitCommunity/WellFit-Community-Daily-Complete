#!/usr/bin/env bash
# check-edge-sdk-hygiene.sh — Mechanical guard against edge-function SDK drift.
#
# Catches the failure class that shipped a broken claude-chat (2026-06-01):
#   (1) SDK VERSION SPRAWL  — the same SDK pinned to different versions across
#       functions, so a "known-good" version in one place is unverified in another.
#   (2) TYPE-CHECK COVERAGE GAPS — a function imports an external SDK but is absent
#       from the Deno type-check target list, so its SDK usage is NEVER verified in CI.
#
# This is grep-only and env-independent — it does NOT run `deno check` (which depends
# on network/esm.sh resolution that differs between local and CI). It enforces that the
# curated type-check list CANNOT silently omit an SDK importer, so the existing Deno
# job (which works in CI) is guaranteed to cover every SDK-using function.
#
# Exit 0 = clean. Exit 1 = drift detected.

set -uo pipefail

FUNCTIONS_DIR="supabase/functions"
TYPECHECK_SCRIPT="scripts/deno-typecheck.sh"
FAIL=0

# SDKs to police, with a per-SDK coverage policy:
#   enforce — every importer MUST be in the Deno type-check list (fails CI if not)
#   report  — list importers not type-checked, but do not fail (too many to gate)
# Version-consistency is ALWAYS enforced (one pinned version per SDK).
# Format: "<specifier>|<coverage-policy>"
TRACKED_SDKS=(
  "@anthropic-ai/sdk|enforce"      # complex tool/streaming types — these break silently
  "@supabase/supabase-js|report"   # ~110 importers; gate version, surface coverage gaps
)

red()   { printf "  \033[31mFAIL\033[0m  %s\n" "$1"; FAIL=1; }
ok()    { printf "  \033[32mOK\033[0m    %s\n" "$1"; }
info()  { printf "  ----  %s\n" "$1"; }

# Single source of truth for the type-check target list: parse it out of
# deno-typecheck.sh's HIGH_RISK array so this guard never drifts from the gate.
mapfile -t TYPECHECK_LIST < <(
  sed -n '/^HIGH_RISK=(/,/^)/p' "$TYPECHECK_SCRIPT" \
    | grep -vE '^HIGH_RISK=\(|^\)' \
    | tr -d ' \t'
)

echo "🔍 Edge-function SDK hygiene"
echo "   type-check list has ${#TYPECHECK_LIST[@]} functions"
echo

in_typecheck_list() {
  local fn="$1"
  for x in "${TYPECHECK_LIST[@]}"; do [[ "$x" == "$fn" ]] && return 0; done
  return 1
}

for entry in "${TRACKED_SDKS[@]}"; do
  sdk="${entry%%|*}"
  policy="${entry##*|}"
  echo "── $sdk (coverage: $policy) ──"

  # All distinct pinned versions of this SDK across edge functions.
  mapfile -t versions < <(
    grep -rhoE "${sdk}@[0-9]+\.[0-9]+\.[0-9]+" "$FUNCTIONS_DIR" --include="*.ts" 2>/dev/null \
      | sed -E "s#.*${sdk}@##" | sort -u
  )

  if [[ ${#versions[@]} -eq 0 ]]; then
    info "no pinned importers found"
    echo
    continue
  fi

  # (1) Version consistency — failed for 'enforce' SDKs, reported for 'report' SDKs.
  if [[ ${#versions[@]} -gt 1 ]]; then
    if [[ "$policy" == "enforce" ]]; then
      red "version sprawl: ${#versions[@]} distinct versions pinned — ${versions[*]}"
      info "pin every importer to ONE approved version (see governance-boundaries.md)"
    else
      info "version sprawl (report-only): ${#versions[@]} versions — ${versions[*]} (track separately)"
    fi
  else
    ok "single version pinned: ${versions[0]}"
  fi

  # (2) Coverage: every importer must be in the type-check list.
  mapfile -t importers < <(
    grep -rlE "${sdk}@" "$FUNCTIONS_DIR" --include="*.ts" 2>/dev/null \
      | sed -E 's#'"$FUNCTIONS_DIR"'/([^/]+)/.*#\1#' | sort -u
  )
  local_gap=0
  for fn in "${importers[@]}"; do
    # Skip non-function dirs the path-regex can surface (_shared, __tests__, shared).
    [[ "$fn" == "_shared" || "$fn" == "__tests__" || "$fn" == "shared" ]] && continue
    if in_typecheck_list "$fn"; then
      continue
    fi
    local_gap=$((local_gap + 1))
    if [[ "$policy" == "enforce" ]]; then
      red "$fn imports ${sdk} but is NOT type-checked in CI (add it to ${TYPECHECK_SCRIPT} HIGH_RISK)"
    fi
  done
  if [[ "$policy" == "enforce" ]]; then
    [[ $local_gap -eq 0 ]] && ok "all importers are type-checked"
  else
    info "$local_gap importer(s) not in the type-check list (report-only — track separately)"
  fi
  echo
done

if [[ $FAIL -eq 0 ]]; then
  echo "✅ edge SDK hygiene: clean"
  exit 0
fi
echo "❌ edge SDK hygiene: drift detected (see FAILs above)"
exit 1
