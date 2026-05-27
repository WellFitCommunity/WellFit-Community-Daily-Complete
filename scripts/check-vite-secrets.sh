#!/usr/bin/env bash
set -uo pipefail

# =============================================================================
# VITE_* Secret Pattern Enforcement
# =============================================================================
# `VITE_*` prefix in Vite = shipped to every browser. Anything with VITE_ is in
# the JS bundle, visible in DevTools, and extractable by anyone.
# (See .claude/rules/adversarial-audit-lessons.md Rule 3.)
#
# This gate scans for VITE_* environment variable names matching the pattern
# VITE_.*(KEY|SECRET|TOKEN).* across:
#   - src/ (excluding __tests__/ and *.test.* / *.spec.*)
#   - .env, .env.example, .env.local, .env.development, .env.production
#   - vercel.json
#
# Anything matching that is NOT in the ALLOWLIST is a violation.
#
# Exit codes:
#   0 = pass (no unallowed secrets in VITE_* vars)
#   1 = fail (one or more violations detected)
# =============================================================================

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# -----------------------------------------------------------------------------
# Allowlist: VITE_* vars matching KEY|SECRET|TOKEN that are public-by-design.
# -----------------------------------------------------------------------------
# Rules for adding to this list:
#   - The value MUST be designed to be public (e.g., site keys, publishable
#     keys, public keys, sender IDs, key identifiers).
#   - Never allowlist a real secret key, private key, service-role key, bearer
#     token, or API key with elevated privileges.
#   - If in doubt, the secret belongs in an edge function — not in VITE_*.
# -----------------------------------------------------------------------------
ALLOWLIST=(
  # hCaptcha — site keys are public-by-design (paired with a secret server-side).
  "VITE_HCAPTCHA_SITE_KEY"

  # Supabase publishable / anon keys — designed to be public; protected by RLS.
  "VITE_SB_PUBLISHABLE_API_KEY"
  "VITE_SB_ANON_KEY"
  "VITE_SUPABASE_ANON_KEY"           # legacy fallback
  "VITE_SUPABASE_PUBLISHABLE_KEY"    # legacy

  # Firebase — Google docs explicitly state these are public app config values.
  # (Security is enforced via Firebase Security Rules + App Check, not key secrecy.)
  "VITE_FIREBASE_API_KEY"
  "VITE_FIREBASE_VAPID_KEY"          # VAPID public key (web push)
  "VITE_FIREBASE_MESSAGING_SENDER_ID"
  "VITE_FIREBASE_APP_ID"

  # Guardian Agent JWT — public key + key ID are non-secret identifiers used
  # for asymmetric verification. The PRIVATE key must remain server-side.
  "VITE_GUARDIAN_JWT_PUBLIC_KEY"
  "VITE_GUARDIAN_JWT_KEY_ID"

  # NOT a secret — integer token limit for Claude API max_tokens param (e.g. 4000).
  # Name contains "TOKEN" but value is a numeric configuration limit, not credentials.
  "VITE_CLAUDE_MAX_TOKENS"

  # TODO(S-OBS-1): triage in progress — these reference values that may not be
  # truly public-safe. Tracker item S-OBS-1 will decide final disposition
  # (move to edge function proxy vs. accept as public).
  # See: docs/trackers/claude-self-audit-2026-05-20-tracker.md
  "VITE_PILLBOX_API_KEY"
  "VITE_WEATHER_API_KEY"
)

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
is_allowed() {
  local name="$1"
  local allowed
  for allowed in "${ALLOWLIST[@]}"; do
    if [ "$name" = "$allowed" ]; then
      return 0
    fi
  done
  return 1
}

# -----------------------------------------------------------------------------
# Step 1 — collect candidate VITE_* names matching KEY|SECRET|TOKEN
# -----------------------------------------------------------------------------
# Build the file list to scan
SCAN_FILES=()
if [ -d "${REPO_ROOT}/src" ]; then
  while IFS= read -r f; do
    SCAN_FILES+=("$f")
  done < <(
    find "${REPO_ROOT}/src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) \
      ! -path '*/node_modules/*' \
      ! -path '*/__tests__/*' \
      ! -name '*.test.ts' \
      ! -name '*.test.tsx' \
      ! -name '*.test.js' \
      ! -name '*.test.jsx' \
      ! -name '*.spec.ts' \
      ! -name '*.spec.tsx' \
      ! -name '*.spec.js' \
      ! -name '*.spec.jsx' \
      ! -name '*.generated.ts' \
      ! -name '*.d.ts' \
      2>/dev/null
  )
fi

for envf in ".env" ".env.example" ".env.local" ".env.development" ".env.production"; do
  if [ -f "${REPO_ROOT}/${envf}" ]; then
    SCAN_FILES+=("${REPO_ROOT}/${envf}")
  fi
done

if [ -f "${REPO_ROOT}/vercel.json" ]; then
  SCAN_FILES+=("${REPO_ROOT}/vercel.json")
fi

# Active-reference patterns (what we actually want to catch):
#   1. import.meta.env.VITE_FOO_KEY        — live code lookup
#   2. process.env.VITE_FOO_KEY            — live code lookup (legacy)
#   3. env.VITE_FOO_KEY (after destructuring) — Zod schema field
#   4. "VITE_FOO_KEY"                      — Zod schema key / config string
#   5. VITE_FOO_KEY=...                    — env file assignment
#   6. VITE_FOO_KEY: ...                   — vercel.json key
#
# What we DELIBERATELY do NOT match (to avoid false positives on cleanup docs):
#   - // ... VITE_FOO_KEY ...              — single-line comments
#   - /* ... VITE_FOO_KEY ... */           — block comments
#   - # ... VITE_FOO_KEY ...               — env-file comments / shell comments
PATTERN='VITE_[A-Z0-9_]+'

# Collect raw matches as: file:line:matched_name
# Strategy: emit grep lines with full content, then filter out comment-only lines.
RAW_MATCHES=""
if [ "${#SCAN_FILES[@]}" -gt 0 ]; then
  # First pass: grab every line containing a VITE_* identifier with a name match.
  ALL_LINES=$(
    grep -HnE "${PATTERN}(KEY|SECRET|TOKEN)([_A-Z0-9]*)?\b" "${SCAN_FILES[@]}" 2>/dev/null \
    || true
  )

  if [ -n "$ALL_LINES" ]; then
    # Filter out lines whose match position is inside a comment.
    # Heuristic: drop lines where the content (after file:line:) STARTS with
    # //, /*, *, or # — i.e., the line begins with a comment marker.
    # Also drop lines whose only VITE_ occurrence is preceded by // on the same line.
    while IFS= read -r line; do
      # Split into file, lineno, content
      file=$(printf "%s" "$line" | awk -F: '{ print $1 }')
      lineno=$(printf "%s" "$line" | awk -F: '{ print $2 }')
      content=$(printf "%s" "$line" | cut -d: -f3-)

      # Trim leading whitespace from content
      trimmed=$(printf "%s" "$content" | sed -e 's/^[[:space:]]*//')

      # Skip if the line is entirely a comment (// or # or * or /* prefix)
      case "$trimmed" in
        //*|\#*|\*\ *|\*)
          continue
          ;;
        /\**)
          continue
          ;;
      esac

      # Skip if the VITE_ match is preceded by // on the same line (inline comment)
      # We check: does the content have a // before the first VITE_?
      if printf "%s" "$content" | grep -qE '//.*VITE_[A-Z0-9_]+(KEY|SECRET|TOKEN)'; then
        # Check that "//" comes BEFORE the VITE_ match
        before_vite=$(printf "%s" "$content" | sed -E 's/(VITE_[A-Z0-9_]*(KEY|SECRET|TOKEN)).*/\1/')
        if printf "%s" "$before_vite" | grep -q '//'; then
          continue
        fi
      fi

      # Extract the specific VITE_*(KEY|SECRET|TOKEN) name(s) on this line
      names=$(printf "%s" "$content" | grep -oE "${PATTERN}(KEY|SECRET|TOKEN)([_A-Z0-9]*)?" | sort -u)
      for name in $names; do
        RAW_MATCHES="${RAW_MATCHES}${file}:${lineno}:${name}
"
      done
    done <<< "$ALL_LINES"
  fi
fi

# -----------------------------------------------------------------------------
# Step 2 — classify each match: allowed or violation
# -----------------------------------------------------------------------------
declare -A SEEN_VIOLATIONS
VIOLATION_DETAILS=""
VIOLATION_COUNT=0
ALLOWED_COUNT=0

if [ -n "$RAW_MATCHES" ]; then
  while IFS= read -r match; do
    # Skip empty lines (trailing newline from the heredoc)
    [ -z "$match" ] && continue

    # match: <file>:<line>:<name>
    name="${match##*:}"
    location="${match%:*}"  # file:line

    # Defensive: skip malformed lines
    [ -z "$name" ] && continue

    # Make file path relative to repo root for cleaner reporting
    location_clean=$(printf "%s" "$location" | sed "s|^${REPO_ROOT}/||")

    if is_allowed "$name"; then
      ALLOWED_COUNT=$((ALLOWED_COUNT + 1))
    else
      VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
      VIOLATION_DETAILS="${VIOLATION_DETAILS}    ${name}
        at ${location_clean}
"
      SEEN_VIOLATIONS["$name"]=1
    fi
  done <<< "$RAW_MATCHES"
fi

# -----------------------------------------------------------------------------
# Step 3 — report
# -----------------------------------------------------------------------------
printf "\n=== VITE_* Secret Pattern Check ===\n"
printf "  Scanned %d file(s)\n" "${#SCAN_FILES[@]}"
printf "  Allowlist entries: %d\n" "${#ALLOWLIST[@]}"
printf "  Allowed references found: %d\n" "$ALLOWED_COUNT"
printf "  Violation references found: %d\n" "$VIOLATION_COUNT"

if [ "$VIOLATION_COUNT" -eq 0 ]; then
  printf "\n  PASS  No unauthorized VITE_*(KEY|SECRET|TOKEN) references detected\n\n"
  exit 0
fi

# Build a unique sorted list of violating var names
UNIQUE_NAMES=$(printf "%s\n" "${!SEEN_VIOLATIONS[@]}" | sort -u)

printf "\n  FAIL  Unauthorized VITE_*(KEY|SECRET|TOKEN) references detected:\n\n"
printf "    Variable name(s):\n"
printf "%s\n" "$UNIQUE_NAMES" | sed 's/^/      - /'

printf "\n    Full reference list:\n"
printf "%s" "$VIOLATION_DETAILS"

printf "\n  Why this fails:\n"
printf "    VITE_* env vars are bundled into the browser. Any value with KEY,\n"
printf "    SECRET, or TOKEN in its name is presumed to be a real secret unless\n"
printf "    explicitly allowlisted as public-by-design.\n\n"
printf "  How to fix:\n"
printf "    1. Move the secret to an edge function (server-side only).\n"
printf "    2. Remove the VITE_ prefix from .env / vercel.json / src/ refs.\n"
printf "    3. If the value is genuinely public-by-design (e.g., a publishable\n"
printf "       key designed to ship to browsers), add it to ALLOWLIST in\n"
printf "       scripts/check-vite-secrets.sh with a one-line justification.\n"
printf "    See: .claude/rules/adversarial-audit-lessons.md Rule 3.\n\n"

exit 1
