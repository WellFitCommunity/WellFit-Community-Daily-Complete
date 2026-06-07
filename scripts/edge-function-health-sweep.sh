#!/usr/bin/env bash
# =============================================================================
# edge-function-health-sweep.sh — ping every deployed edge function and report
# ALIVE / MISSING / FAILING, without redeploying or triggering side effects.
#
# WHY: "is everything deployed and booting?" needs a real answer. A bad import or
# crash-on-boot makes a function return 5xx; a name mismatch returns 404. This
# sweep surfaces both in one pass.
#
# PROBE: an HTTP OPTIONS request (CORS preflight). It is exempt from JWT
# verification at the gateway and is handled by each function's
# `handleOptions(req)` early-return — so it proves the function booted WITHOUT
# running any business logic, DB write, or message send. The gateway still
# requires an apikey/Authorization header even when verify_jwt=false, so we send
# the PUBLIC publishable/anon key (read from env or .env — never hardcoded).
#
# CLASSIFICATION (by HTTP status):
#   2xx / 400 / 401 / 403 / 405 / 426 -> ALIVE  (booted & responded; 426=WebSocket
#                                                 endpoint correctly rejecting non-WS)
#   404                               -> MISSING (slug not deployed / name mismatch)
#   5xx / 000(timeout, after 1 retry) -> FAILING (FLAG ONLY — see caveat below)
#
# ⚠️ A "FAILING" flag is a SIGNAL TO INVESTIGATE, NOT a confirmed outage. A function
# can return 5xx/000 to this synthetic preflight probe and still work perfectly on
# its real path (browser supabase.functions.invoke / cron POST with the right payload
# and headers). Confirmed example (2026-06-06): verify-hcaptcha probed 000 but hCaptcha
# works on every login — a false positive. Before declaring any flagged function broken,
# CROSS-CHECK live edge logs (mcp get_logs edge-function) for a recent successful 2xx on
# its REAL method/path. Only a real-traffic error is a real outage.
#
# SLUG SOURCE: scripts/live-edge-functions.json (refresh via MCP
# list_edge_functions for project xkybsjnvuohpqpbkikyn, or `supabase functions list`).
#
# USAGE:
#   bash scripts/edge-function-health-sweep.sh
# Exit 0 = all ALIVE. Exit 1 = at least one MISSING or FAILING.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAP="$ROOT/scripts/live-edge-functions.json"
ENV_FILE="$ROOT/.env"

# --- Resolve URL + public key from env, falling back to .env (no secrets echoed)
getval() { # getval VAR1 VAR2 ... -> first non-empty from shell env then .env
  local v
  for v in "$@"; do
    if [ -n "${!v:-}" ]; then printf '%s' "${!v}"; return 0; fi
  done
  if [ -f "$ENV_FILE" ]; then
    for v in "$@"; do
      local line; line=$(grep -E "^${v}=" "$ENV_FILE" | head -1 | cut -d= -f2-)
      line="${line%\"}"; line="${line#\"}"
      if [ -n "$line" ]; then printf '%s' "$line"; return 0; fi
    done
  fi
  return 1
}

BASE_URL="$(getval SB_URL VITE_SB_URL VITE_SUPABASE_URL || true)"
APIKEY="$(getval SB_PUBLISHABLE_API_KEY VITE_SB_PUBLISHABLE_API_KEY SB_ANON_KEY VITE_SB_ANON_KEY VITE_SUPABASE_ANON_KEY || true)"

if [ -z "$BASE_URL" ] || [ -z "$APIKEY" ]; then
  echo "ERROR: could not resolve Supabase URL and/or publishable key from env or .env." >&2
  echo "  Set SB_URL and SB_PUBLISHABLE_API_KEY (or the VITE_ equivalents)." >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"
FN_URL="$BASE_URL/functions/v1"

if [ ! -f "$SNAP" ]; then
  echo "ERROR: $SNAP missing. Refresh from MCP list_edge_functions / supabase CLI." >&2
  exit 2
fi

mapfile -t SLUGS < <(python3 -c "import json,sys; print('\n'.join(sorted(x['slug'] for x in json.load(open('$SNAP'))['functions'])))")
echo "Probing ${#SLUGS[@]} functions at $FN_URL (OPTIONS, no side effects)..."
echo

probe() { # probe <slug> -> "<status> <slug>"
  local slug="$1" code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X OPTIONS \
    -H "apikey: $APIKEY" -H "Authorization: Bearer $APIKEY" \
    "$FN_URL/$slug" 2>/dev/null)
  # Retry once on timeout/no-response to avoid cold-start false positives.
  if [ "${code:-000}" = "000" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -X OPTIONS \
      -H "apikey: $APIKEY" -H "Authorization: Bearer $APIKEY" \
      "$FN_URL/$slug" 2>/dev/null)
  fi
  printf '%s %s\n' "${code:-000}" "$slug"
}
export -f probe
export FN_URL APIKEY

# Probe in parallel (8 at a time), then classify deterministically in sorted order.
RESULTS=$(printf '%s\n' "${SLUGS[@]}" | xargs -P 8 -I{} bash -c 'probe "$@"' _ {})

alive=0; missing=0; failing=0
miss_list=""; fail_list=""
while read -r code slug; do
  [ -z "$slug" ] && continue
  case "$code" in
    2*|400|401|403|405|426) state="ALIVE";   alive=$((alive+1)) ;;
    404)                    state="MISSING"; missing=$((missing+1)); miss_list+=" $slug" ;;
    *)                      state="FAILING"; failing=$((failing+1)); fail_list+=" $slug($code)" ;;
  esac
  printf '  %-9s %-4s %s\n' "$state" "$code" "$slug"
done < <(printf '%s\n' "$RESULTS" | sort -k2)

echo
echo "================ SUMMARY ================"
echo "  ALIVE:   $alive"
echo "  MISSING: $missing${miss_list:+ ->$miss_list}"
echo "  FAILING: $failing${fail_list:+ ->$fail_list}"
echo "========================================"
if [ "$missing" -gt 0 ] || [ "$failing" -gt 0 ]; then
  echo "Investigate MISSING (name mismatch / not deployed) and FAILING (boot error)." >&2
  exit 1
fi
echo "All functions ALIVE."
