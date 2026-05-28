#!/usr/bin/env bash
# =============================================================================
# Comprehensive Pre-Commit Gate
# =============================================================================
# Checks STAGED files only for the bug patterns that AI-as-author code
# consistently produces. Each rule prints a one-line fix hint when it fires.
#
# Built 2026-05-27 after the self-audit Session 6 surfaced repeated AI-shaped
# bug fingerprints (god files, fake values, shadow imports, JSON regex
# stripping, HTML interpolation without escape, etc.). Pre-commit catches
# these at commit time so they never reach a PR, let alone main.
#
# Performance: scans staged diff only (not the whole repo). Typically <2s.
#
# Behavior:
#   - Each check runs independently and collects violations.
#   - Exit 1 if ANY check fails — but ALL violations are reported first so
#     the contributor can fix them in one pass instead of N retries.
#   - Comments (`// foo`, `* foo`, `# foo`) are excluded from the grep so
#     documentation referencing forbidden patterns is not blocked.
#
# Maintenance: see .claude/rules/adversarial-audit-lessons.md for the
# governing rules. New AI-fingerprint patterns get a new `check_*` function
# below + an entry in the report.
# =============================================================================

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# -----------------------------------------------------------------------------
# Gather staged files
# -----------------------------------------------------------------------------
STAGED_ALL=$(git diff --cached --name-only --diff-filter=ACM)

# Source files we care about (TS/TSX/JS/JSX), excluding tests + generated + d.ts
STAGED_SRC=$(echo "$STAGED_ALL" | grep -E '\.(ts|tsx|js|jsx)$' \
  | grep -v '__tests__' \
  | grep -v '\.test\.' \
  | grep -v '\.spec\.' \
  | grep -v '\.d\.ts$' \
  | grep -v '\.generated\.' \
  | grep -v '^public/' \
  || true)

STAGED_EDGE=$(echo "$STAGED_SRC" | grep '^supabase/functions/' || true)
STAGED_CLIENT=$(echo "$STAGED_SRC" | grep '^src/' || true)

# Migrations (excluding _APPLIED_/_DEPLOYED_/_SUPERSEDED_ archives)
STAGED_MIG=$(echo "$STAGED_ALL" \
  | grep -E '^supabase/migrations/[0-9].*\.sql$' \
  || true)

# Nothing to check?
if [ -z "$STAGED_SRC" ] && [ -z "$STAGED_MIG" ]; then
  exit 0
fi

FAIL=0
REPORT=""

# -----------------------------------------------------------------------------
# Helper: scan list of files for a pattern, append to report on hit
# -----------------------------------------------------------------------------
report_violations() {
  local files="$1"
  local pattern="$2"
  local title="$3"
  local fix_hint="$4"

  if [ -z "$files" ]; then
    return 0
  fi

  # Build file list for xargs
  local file_list
  file_list=$(echo "$files" | tr '\n' '\0' | xargs -0 -I{} echo "{}")

  local matches
  matches=$(echo "$files" | xargs grep -nE "$pattern" 2>/dev/null \
    | grep -vE '^[^:]+:[0-9]+:\s*//' \
    | grep -vE '^[^:]+:[0-9]+:\s*\*' \
    | grep -vE '^[^:]+:[0-9]+:\s*#' \
    | head -10)

  if [ -n "$matches" ]; then
    REPORT="${REPORT}
❌ ${title}
   ${fix_hint}
$(echo "$matches" | sed 's/^/     /')
"
    FAIL=1
  fi
}

# =============================================================================
# CLIENT CODE CHECKS (src/ only — browser-bound code)
# =============================================================================

if [ -n "$STAGED_CLIENT" ]; then

  # ---------------------------------------------------------------------------
  # 1. console.log/error/warn/info/debug in client code (HIPAA §164.312)
  #    Edge functions are allowed to use console; client code must use
  #    auditLogger.
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_CLIENT" \
    '(^|[^/])(console\.(log|error|warn|info|debug))' \
    "console.* found in client code (CLAUDE.md #3)" \
    "Use src/services/auditLogger.ts — browser code must not log to console."

  # ---------------------------------------------------------------------------
  # 2. process.env.* in client code — must be import.meta.env.VITE_*
  #    React 19 / Vite migration. CRA patterns dominate AI training data.
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_CLIENT" \
    'process\.env\.' \
    "process.env.* found in client code (CLAUDE.md #7)" \
    "Use import.meta.env.VITE_* — this codebase is Vite, not Create React App."

  # ---------------------------------------------------------------------------
  # 3. forwardRef — React 19 passes ref as a regular prop
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_CLIENT" \
    '\bforwardRef\s*\(' \
    "forwardRef found (React 19)" \
    "React 19 passes ref as a regular prop — no wrapper needed."

fi

# =============================================================================
# ALL SOURCE FILES (src/ + supabase/functions/)
# =============================================================================

if [ -n "$STAGED_SRC" ]; then

  # ---------------------------------------------------------------------------
  # 4. ': any' type — must use 'unknown' + type guards
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_SRC" \
    '(:|<)\s*any(\s|\[|>|,|;|\)|$)' \
    ": any type found (CLAUDE.md #2)" \
    "Use 'unknown' + type guards. See .claude/rules/typescript.md."

  # ---------------------------------------------------------------------------
  # 5. catch (err: any) — must be 'catch (err: unknown)'
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_SRC" \
    'catch\s*\(\s*[a-zA-Z_]+\s*:\s*any\s*\)' \
    "catch with ': any' (CLAUDE.md error template)" \
    "Use 'catch (err: unknown)' then narrow with 'err instanceof Error'."

  # ---------------------------------------------------------------------------
  # 6. 'as Error' cast — must be instanceof Error narrowing
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_SRC" \
    '\bas\s+Error\b' \
    "'as Error' cast found" \
    "Use: err instanceof Error ? err : new Error(String(err))"

  # ---------------------------------------------------------------------------
  # 7. CORS/CSP wildcards — explicit ALLOWED_ORIGINS only
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_SRC" \
    '(frame-ancestors|connect-src|Access-Control-Allow-Origin)[^;]*\*' \
    "CORS/CSP wildcard found (CLAUDE.md #10)" \
    "Use explicit ALLOWED_ORIGINS env var. Wildcards fail HIPAA §164.312(e)(1)."

  report_violations "$STAGED_SRC" \
    'WHITE_LABEL_MODE\s*=\s*["'\'']?true' \
    "WHITE_LABEL_MODE=true found" \
    "Bypasses origin enforcement — explicit approval from Maria required."

  # ---------------------------------------------------------------------------
  # 8. ```json regex stripping — must use structured output (tool_use)
  #    AI training pattern: parse Claude's text as JSON via regex.
  #    Anthropic supports forced tool_choice — use that instead.
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_SRC" \
    'replace\([^)]*```json' \
    "\`\`\`json regex stripping found (CLAUDE.md #16)" \
    "Use Anthropic tool_choice forced output. See ai-nurseos-burnout-advisor for the pattern."

  # ---------------------------------------------------------------------------
  # 9. atob() JWT decoding instead of supabase.auth.getUser()
  #    Reading a JWT payload != verifying it. Forged JWTs decode fine.
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_SRC" \
    'atob\([^)]*\.split\([^)]*\)\[1\]' \
    "atob() JWT decoding (adversarial-audit-lessons #6)" \
    "Use supabase.auth.getUser(token) — atob() reads, doesn't verify."

  # ---------------------------------------------------------------------------
  # 10. profiles.id queries — column is user_id, not id
  #     This bug has been introduced + fixed multiple times.
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_SRC" \
    "from\s*\(\s*['\"]profiles['\"]\s*\)[^;]*\.eq\s*\(\s*['\"]id['\"]" \
    "profiles.id query (adversarial-audit-lessons #8)" \
    "The column is profiles.user_id, NOT id. Period."

  # ---------------------------------------------------------------------------
  # 11. SELECT * in Supabase queries — column-explicit only
  #     Performance + PHI exposure risk. We fixed 270 files for this already.
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_SRC" \
    "\.select\s*\(\s*['\"]\*['\"]\s*\)" \
    ".select('*') found (.claude/rules/supabase.md §9)" \
    "Specify explicit columns. Wildcards waste bandwidth and may expose PHI."

  # ---------------------------------------------------------------------------
  # 12. functions.invoke with underscores — directory names usually use dashes,
  # but some legitimately use underscores (admin_end_session, admin_register,
  # admin_set_pin, admin_start_session). Only flag if the invoked function
  # directory does NOT exist — i.e. the underscored name is a typo, not a
  # real underscore-named function. Same pattern as rule #16's
  # `TO service_role` exemption: verify against reality, don't blanket-block.
  # ---------------------------------------------------------------------------
  if [ -n "$STAGED_SRC" ]; then
    invoke_hits=$(echo "$STAGED_SRC" | xargs grep -nE "functions\.invoke\s*\(\s*['\"][a-z]+_[a-z_]+['\"]" 2>/dev/null \
      | grep -vE '^[^:]+:[0-9]+:\s*//' \
      | grep -vE '^[^:]+:[0-9]+:\s*\*' \
      | grep -vE '^[^:]+:[0-9]+:\s*#')
    real_violations=""
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      # Extract the function name from inside the quotes
      fn_name=$(echo "$line" | grep -oE "functions\.invoke\s*\(\s*['\"][a-z]+_[a-z_]+['\"]" | grep -oE "['\"][a-z]+_[a-z_]+['\"]" | tr -d "'\"" | head -1)
      [ -z "$fn_name" ] && continue
      # Real violation only if the function directory does NOT exist
      if [ ! -d "supabase/functions/$fn_name" ]; then
        real_violations="${real_violations}${line}
"
      fi
    done <<< "$invoke_hits"
    if [ -n "$real_violations" ]; then
      REPORT="${REPORT}
❌ functions.invoke with underscores (adversarial-audit-lessons #7)
   Edge function names use DASHES (send-email, not send_email). Check ls supabase/functions/.
$(echo "$real_violations" | grep -v '^$' | head -10 | sed 's/^/     /')
"
      FAIL=1
    fi
  fi

  # ---------------------------------------------------------------------------
  # 13. Shadow import TDZ pattern (CR-1) — const X = ... ?? X
  #     Same class as the 80-day Compass Riley V2 outage.
  # ---------------------------------------------------------------------------
  # Multi-line pattern — use perl
  if [ -n "$STAGED_EDGE" ]; then
    local_shadow=""
    for f in $STAGED_EDGE; do
      [ ! -f "$f" ] && continue
      hits=$(perl -0777 -ne '
        while (/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*Deno\.env\.get\(\s*["\x27][^"\x27]+["\x27]\s*\)(?:\s*\?\?\s*[^;\n]+?)*?\s*\?\?\s*\1\b/g) {
          my $name = $1;
          my $line = (substr($_, 0, $-[0]) =~ tr/\n//) + 1;
          print "$ARGV:$line: $name\n";
        }
      ' "$f" 2>/dev/null)
      if [ -n "$hits" ]; then
        local_shadow="${local_shadow}${hits}\n"
      fi
    done
    if [ -n "$local_shadow" ]; then
      REPORT="${REPORT}
❌ Shadow-import TDZ pattern (adversarial-audit-lessons #5)
   const X = Deno.env.get(\"X\") ?? X — TDZ ReferenceError at module load when env missing.
   Drop the local const; _shared/env.ts already handles fallback chain.
$(echo -e "$local_shadow" | grep -v '^$' | sed 's/^/     /')
"
      FAIL=1
    fi
  fi

  # ---------------------------------------------------------------------------
  # 14. Hardcoded fake values in clinical/admin UI
  #     Pattern: 'usage_count: 0' or 'last_used: null' followed by a comment
  #     about tracking not being implemented. AI training pattern: ship UI
  #     before schema; explain it away with a comment.
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_SRC" \
    '(usage_count|use_count|last_used|last_used_at):\s*(0|null)[^,]*//\s*(not\s+tracked|TODO|fake|placeholder|hardcoded)' \
    "Hardcoded fake DB values with 'not tracked' comment" \
    "Don't ship UI that lies. Either implement tracking or remove the column. See API-3 plan."

  # ---------------------------------------------------------------------------
  # 15. Math.max/min spread on potentially unbounded array
  #     Stack overflow risk on ~10k+ element arrays.
  # ---------------------------------------------------------------------------
  report_violations "$STAGED_SRC" \
    'Math\.(max|min)\s*\(\s*\.\.\.' \
    "Math.max/min spread on array (stack overflow risk on large arrays)" \
    "Use arr.reduce((acc, v) => Math.max(acc, v), -Infinity) for unbounded inputs."

fi

# =============================================================================
# MIGRATION CHECKS (supabase/migrations/*.sql)
# =============================================================================

if [ -n "$STAGED_MIG" ]; then

  # ---------------------------------------------------------------------------
  # 16. WITH CHECK (true) on audit/security tables — spoofable identity
  #
  # Exemption: per adversarial-audit-lessons #4, a policy scoped TO service_role
  # may use WITH CHECK (true) because service_role bypasses RLS anyway and the
  # `TO service_role` clause itself blocks authenticated/anon from using it.
  # We detect this per-policy-block (CREATE POLICY ... ;) so a service_role
  # INSERT policy in the same file as a user-facing policy doesn't accidentally
  # mask a real violation.
  # ---------------------------------------------------------------------------
  local_audit_check_true=""
  for f in $STAGED_MIG; do
    [ ! -f "$f" ] && continue
    # Only inspect files that touch an audit/security table
    if grep -lE 'ON\s+public\.(audit_logs|phi_access_logs|admin_audit_log|.*_audit_log|.*_log)\b' "$f" >/dev/null 2>&1; then
      hits=$(awk '
        BEGIN { in_block=0; check_true_line=0; to_service_role=0; block_text="" }
        /CREATE[[:space:]]+POLICY/ {
          in_block=1; check_true_line=0; to_service_role=0; block_text=$0
          next
        }
        in_block {
          block_text = block_text "\n" $0
          if ($0 ~ /WITH[[:space:]]+CHECK[[:space:]]*\([[:space:]]*true[[:space:]]*\)/) {
            check_true_line = NR
          }
          if ($0 ~ /^[[:space:]]*TO[[:space:]]+service_role([[:space:],]|$)/) {
            to_service_role = 1
          }
          # End of policy block: a line ending with ;
          if ($0 ~ /;[[:space:]]*$/) {
            if (check_true_line > 0 && to_service_role == 0) {
              print check_true_line ":  WITH CHECK (true);"
            }
            in_block=0; check_true_line=0; to_service_role=0; block_text=""
          }
        }
      ' "$f")
      if [ -n "$hits" ]; then
        local_audit_check_true="${local_audit_check_true}${f}:\n${hits}\n"
      fi
    fi
  done
  if [ -n "$local_audit_check_true" ]; then
    REPORT="${REPORT}
❌ WITH CHECK (true) on audit/security table (adversarial-audit-lessons #4)
   Audit identity columns MUST enforce auth.uid() in WITH CHECK.
   Otherwise actor_user_id is spoofable — fatal for HIPAA audit trail.
$(echo -e "$local_audit_check_true" | sed 's/^/     /')
"
    FAIL=1
  fi

  # ---------------------------------------------------------------------------
  # 17. RLS policy with USING but no WITH CHECK on tenant-scoped tables
  #     This is the exact gap we found on api_keys today (API-3a).
  # ---------------------------------------------------------------------------
  local_missing_with_check=""
  for f in $STAGED_MIG; do
    [ ! -f "$f" ] && continue
    # Find policies that:
    #   (a) reference tenant_id in USING
    #   (b) are FOR ALL or FOR INSERT/UPDATE
    #   (c) do NOT have a WITH CHECK clause
    # This is approximate (SQL parsing in bash is fragile), so the
    # gate prints a WARNING to inspect, not a hard FAIL.
    hits=$(awk '
      /CREATE POLICY/,/;/ {
        block = block "\n" $0
        if (/;/) {
          if (block ~ /tenant_id/ && (block ~ /FOR ALL/ || block ~ /FOR INSERT/ || block ~ /FOR UPDATE/)) {
            if (block !~ /WITH CHECK/) {
              # Extract policy name
              match(block, /CREATE POLICY[[:space:]]+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/, m)
              print FILENAME ": policy " m[1] " on tenant table — has USING but no WITH CHECK"
            }
          }
          block = ""
        }
      }
    ' "$f" 2>/dev/null)
    if [ -n "$hits" ]; then
      local_missing_with_check="${local_missing_with_check}${hits}\n"
    fi
  done
  if [ -n "$local_missing_with_check" ]; then
    REPORT="${REPORT}
⚠️  RLS policy on tenant table missing WITH CHECK clause
   This is the EXACT gap that almost shipped on api_keys (API-3a, 2026-05-27).
   FOR ALL / FOR INSERT / FOR UPDATE policies need WITH CHECK matching USING
   to prevent cross-tenant writes. If this is intentional (e.g., read-only
   policy), add a comment explaining why.
$(echo -e "$local_missing_with_check" | grep -v '^$' | sed 's/^/     /')
"
    FAIL=1
  fi

fi

# =============================================================================
# FILE-SIZE GATE — only if there's a staged change that would push a file over
# =============================================================================
if [ -n "$STAGED_SRC" ]; then
  over_600=""
  for f in $STAGED_SRC; do
    [ ! -f "$f" ] && continue
    lines=$(wc -l < "$f")
    if [ "$lines" -gt 600 ]; then
      # Check if already in baseline (pre-existing god file)
      if ! grep -qxF "$f" scripts/god-file-baseline.txt 2>/dev/null \
         && ! grep -qxF "$f" scripts/god-file-baseline-functions.txt 2>/dev/null; then
        over_600="${over_600}${f}: ${lines} lines\n"
      fi
    fi
  done
  if [ -n "$over_600" ]; then
    REPORT="${REPORT}
❌ File exceeds 600-line limit (CLAUDE.md #12)
   Decompose into focused modules. See ApiKeyManager/ for the barrel-export pattern.
$(echo -e "$over_600" | sed 's/^/     /')
"
    FAIL=1
  fi
fi

# =============================================================================
# REPORT + EXIT
# =============================================================================

if [ "$FAIL" -eq 0 ]; then
  echo "✅ Pre-commit gate passed (all staged files clean)"
  exit 0
fi

echo "
🚫 COMMIT BLOCKED — Pre-commit gate found violations:
$REPORT

Fix the above and re-commit. See:
  - CLAUDE.md (root governance)
  - .claude/rules/adversarial-audit-lessons.md (the 'why' for each rule)
  - .claude/rules/typescript.md (type rules)
  - .claude/rules/supabase.md (DB rules)

If you genuinely need to bypass (e.g., emergency hotfix), git commit --no-verify
is available BUT requires explicit justification in the commit message.
" >&2

exit 1
