#!/usr/bin/env bash
# deno-typecheck.sh — Type-check high-risk edge functions using Deno's built-in checker
# Usage: bash scripts/deno-typecheck.sh [--all]
#
# By default checks the 20 highest-risk functions (auth, messaging, PHI, billing).
# Pass --all to check every edge function (slow, may have upstream lib type issues).

set -euo pipefail

FUNCTIONS_DIR="supabase/functions"
# Absolute path: Deno 2.x resolves --config relative to the file being checked,
# not the CWD, so a relative path would silently fail on every function.
DENO_CONFIG="$(realpath "$FUNCTIONS_DIR/deno.json")"

# Ensure deno is available
if ! command -v deno &>/dev/null; then
  echo "❌ Deno not found. Install: curl -fsSL https://deno.land/x/install/install.sh | sh"
  exit 1
fi

# High-risk functions that handle auth, PHI, messaging, or billing
HIGH_RISK=(
  send-sms
  send-email
  send-push-notification
  send-slack-notification
  guardian-agent
  claude-chat
  login
  register
  envision-login
  admin_register
  smart-authorize
  smart-token
  create-checkin
  enhanced-fhir-export
  fhir-r4
  generate-837p
  ai-readmission-predictor
  ai-soap-note-generator
  send-team-alert
  export-status
  bed-management
  fitbit-webhook
  # Anthropic-SDK importers — MUST stay covered (enforced by check-edge-sdk-hygiene.sh).
  coding-suggest
  mcp-claude-server
  ai-medication-instructions
)

if [[ "${1:-}" == "--all" ]]; then
  echo "🔍 Checking ALL edge functions (this may take a while)..."
  TARGETS=()
  for dir in "$FUNCTIONS_DIR"/*/; do
    if [[ -f "${dir}index.ts" ]]; then
      TARGETS+=("${dir}index.ts")
    fi
  done
else
  echo "🔍 Checking ${#HIGH_RISK[@]} high-risk edge functions..."
  TARGETS=()
  for fn in "${HIGH_RISK[@]}"; do
    if [[ -f "$FUNCTIONS_DIR/$fn/index.ts" ]]; then
      TARGETS+=("$FUNCTIONS_DIR/$fn/index.ts")
    else
      echo "  ⚠ $fn/index.ts not found, skipping"
    fi
  done
fi

# Dependencies are integrity-pinned by supabase/functions/deno.lock and cached in
# CI (DENO_DIR), so `deno check` resolves imports from the local cache rather than
# re-fetching esm.sh on every run. `deno check` exits non-zero ONLY on a genuine
# type error — no retry/tolerance logic, so real defects are never masked.
ERRORS=0
CHECKED=0

for target in "${TARGETS[@]}"; do
  fn_name=$(basename "$(dirname "$target")")
  if output=$(deno check --config "$DENO_CONFIG" "$target" 2>&1); then
    CHECKED=$((CHECKED + 1))
  else
    echo "  ❌ $fn_name has type errors"
    echo "$output" | sed 's/^/      /'
    ERRORS=$((ERRORS + 1))
    CHECKED=$((CHECKED + 1))
  fi
done

echo ""
echo "✅ deno check: $CHECKED functions checked, $ERRORS with type errors"

if [[ $ERRORS -gt 0 ]]; then
  exit 1
fi
