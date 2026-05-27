#!/usr/bin/env bash
set -uo pipefail

# =============================================================================
# Shadow Import / TDZ Self-Reference Enforcement
# =============================================================================
# Detects the pattern:
#
#     const FOO = Deno.env.get("BAR") ?? FOO;
#     //    ^^^                          ^^^   <- same identifier
#
# This is broken because the const binding is in the Temporal Dead Zone (TDZ)
# while its own initializer evaluates. If Deno.env.get("BAR") returns a falsy
# value, the ?? falls through to FOO, which throws ReferenceError because the
# binding is not yet initialized.
#
# When env is set, it short-circuits and the bug stays hidden. When env is
# missing in a new region or after a key rotation, the function crashes at
# module load. This is the same class of bug as the 80-day Compass Riley V2
# TDZ outage (commit b57f2406).
#
# See .claude/rules/adversarial-audit-lessons.md Rule 5.
#
# Scope: supabase/functions/ (.ts files only — Deno runtime). Excludes:
#   - __tests__/
#   - *.test.ts, *.spec.ts
#
# Exit codes:
#   0 = pass (no shadow imports)
#   1 = fail (one or more shadow imports detected)
# =============================================================================

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTIONS_DIR="${REPO_ROOT}/supabase/functions"
FAIL=0

if [ ! -d "$FUNCTIONS_DIR" ]; then
  printf "  PASS  No supabase/functions/ directory to scan\n"
  exit 0
fi

# Collect candidate files.
FILES=()
while IFS= read -r f; do
  FILES+=("$f")
done < <(
  find "$FUNCTIONS_DIR" -type f -name '*.ts' \
    ! -path '*/__tests__/*' \
    ! -name '*.test.ts' \
    ! -name '*.spec.ts' \
    ! -name '*.d.ts' \
    2>/dev/null
)

if [ "${#FILES[@]}" -eq 0 ]; then
  printf "  PASS  No edge function .ts files found\n"
  exit 0
fi

# -----------------------------------------------------------------------------
# Multi-line shadow detection.
#
# Pattern (regex):
#   const\s+([A-Z_][A-Z0-9_]*)        — left-hand identifier (captured)
#   \s*=\s*
#   Deno\.env\.get\(\s*["'][^"']+["']\s*\)   — Deno.env.get("...") call
#   (?:\s*\?\?\s*[^;]+?)*?            — optional intermediate ?? fallbacks
#   \s*\?\?\s*\1                      — final fallback that references same name
#   \b
#
# We use perl -0777 to slurp each file so the regex matches across newlines.
# -----------------------------------------------------------------------------
VIOLATIONS=""
VIOLATION_COUNT=0

for f in "${FILES[@]}"; do
  rel=$(printf "%s" "$f" | sed "s|^${REPO_ROOT}/||")
  matches=$(perl -0777 -ne '
    while (/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*Deno\.env\.get\(\s*["\x27][^"\x27]+["\x27]\s*\)(?:\s*\?\?\s*[^;\n]+?)*?\s*\?\?\s*\1\b/g) {
      my $name = $1;
      my $pre  = substr($_, 0, $-[0]);
      my $line = ($pre =~ tr/\n//) + 1;
      print "    $name (line $line)\n";
    }
  ' "$f" 2>/dev/null)

  if [ -n "$matches" ]; then
    VIOLATIONS="${VIOLATIONS}  ${rel}:
${matches}
"
    # Count individual matches
    count=$(printf "%s" "$matches" | wc -l)
    VIOLATION_COUNT=$((VIOLATION_COUNT + count))
    FAIL=1
  fi
done

# -----------------------------------------------------------------------------
# Report
# -----------------------------------------------------------------------------
printf "\n=== Shadow Import / TDZ Check ===\n"
printf "  Scanned %d edge function .ts file(s)\n" "${#FILES[@]}"

if [ "$FAIL" -eq 0 ]; then
  printf "  PASS  No shadow-import TDZ patterns detected\n\n"
  exit 0
fi

printf "  FAIL  %d shadow-import pattern(s) detected:\n\n" "$VIOLATION_COUNT"
printf "%s" "$VIOLATIONS"

printf "\n  Why this fails:\n"
printf "    const FOO = Deno.env.get(\"FOO\") ?? FOO;\n"
printf "    is broken — when env is missing, FOO is referenced in its own TDZ\n"
printf "    initializer and throws ReferenceError at module load.\n\n"
printf "  How to fix:\n"
printf "    The values in supabase/functions/_shared/env.ts already handle the\n"
printf "    new-key/legacy-key fallback chain. Drop the redundant local const\n"
printf "    and use the imported identifier directly. If you need a renamed\n"
printf "    local, rename via the import: \`import { SB_SECRET_KEY as MY_NAME }\`.\n\n"
printf "  See: .claude/rules/adversarial-audit-lessons.md Rule 5.\n\n"

exit 1
