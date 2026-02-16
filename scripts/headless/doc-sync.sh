#!/usr/bin/env bash
# Check if documentation matches current code state — READ-ONLY
# Usage: bash scripts/headless/doc-sync.sh
# Time: ~5 minutes

set -euo pipefail
cd "$(dirname "$0")/../.."

echo "Starting documentation sync check (read-only)..."
echo ""

claude -p "
Read CLAUDE.md and docs/PROJECT_STATE.md first.

Audit documentation accuracy by checking:

1. Test count in CLAUDE.md — run 'npm test' and compare actual vs documented count
2. Test count in docs/PROJECT_STATE.md — compare to actual
3. Skills listed in CLAUDE.md — verify each skill folder exists in .claude/skills/
4. Feature flags in CLAUDE.md — verify they match .env or .env.example
5. Active trackers in PROJECT_STATE.md — verify each tracker file exists and check if status is current
6. Route documentation — spot-check 5 routes mentioned in docs exist in src/App.tsx

For each mismatch found, report:
- Document and line/section
- What it says vs what is actual
- Suggested correction

Summary: number of documents checked, mismatches found, documents that are current.
" --allowedTools "Read,Grep,Glob,Bash"
