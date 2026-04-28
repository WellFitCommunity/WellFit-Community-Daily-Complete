#!/bin/bash
# PostToolUse hook for Edit|Write — enforces CLAUDE.md mechanical rules
# Reads tool input from stdin, greps the modified file for forbidden patterns,
# exits 2 with violations to surface them back to Claude.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Only check source files — skip everything outside src/, supabase/, scripts/
case "$FILE_PATH" in
  */src/*|*/supabase/functions/*|*/scripts/*) ;;
  *) exit 0 ;;
esac

# Skip test files for some patterns (tests can use console.log, any types loosely)
IS_TEST=false
case "$FILE_PATH" in
  *__tests__*|*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) IS_TEST=true ;;
esac

# Skip the hook script itself + governance docs
case "$FILE_PATH" in
  *.claude/hooks/*|*CLAUDE.md|*.claude/rules/*) exit 0 ;;
esac

VIOLATIONS=""

check() {
  local pattern="$1"
  local message="$2"
  local matches
  matches=$(grep -nE "$pattern" "$FILE_PATH" 2>/dev/null | head -5)
  if [ -n "$matches" ]; then
    VIOLATIONS="${VIOLATIONS}
- ${message}
${matches}
"
  fi
}

if [ "$IS_TEST" = false ]; then
  # console.* in production code — auditLogger required
  check '(^|[^/])(console\.(log|error|warn|info|debug))' "console.* found — use auditLogger instead"
fi

# : any type — must use unknown + type guards
check '(:|<)\s*any(\s|\[|>|,|;|\)|$)' "': any' type found — use unknown + type guards"

# forwardRef — React 19 passes ref as prop
check 'forwardRef' "forwardRef found — React 19 passes ref as prop directly"

# process.env in client code (allowed in scripts/, edge functions use Deno.env)
case "$FILE_PATH" in
  */src/*)
    check 'process\.env\.' "process.env found — use import.meta.env.VITE_* in Vite/React 19"
    ;;
esac

# CORS / CSP wildcards — explicit ALLOWED_ORIGINS only
check '(frame-ancestors|connect-src|Access-Control-Allow-Origin)[^;]*\*' "CORS/CSP wildcard found — use explicit ALLOWED_ORIGINS"
check 'WHITE_LABEL_MODE\s*=\s*["'\'']?true' "WHITE_LABEL_MODE=true found — bypasses explicit origin checks"

# catch (err: any) — must be unknown
check 'catch\s*\(\s*[a-zA-Z_]+\s*:\s*any\s*\)' "catch with ': any' — use ': unknown' and narrow with instanceof Error"

if [ -n "$VIOLATIONS" ]; then
  printf 'CLAUDE.md violations in %s:\n%s\n' "$FILE_PATH" "$VIOLATIONS" >&2
  echo "Fix the above before continuing. See CLAUDE.md and .claude/rules/typescript.md." >&2
  exit 2
fi

exit 0
