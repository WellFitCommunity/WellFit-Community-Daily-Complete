#!/usr/bin/env bash
# Full on-demand docs pipeline: regenerate the feature list + user manual from the
# live codebase (headless Claude), then convert everything to Word (.docx).
#
# Run this when you want a FRESH copy that reflects the current codebase.
# It is the "kick it off and walk away" command — the AI crawl takes ~25-35 min total.
#
# Usage: npm run docs:build      (or: bash scripts/headless/build-docs.sh)
#
# If you only want to re-convert the EXISTING markdown to Word (fast, no AI),
# run `npm run docs:docx` instead.
set -euo pipefail
cd "$(dirname "$0")/../.."

if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: the 'claude' CLI is not on PATH. This pipeline needs Claude Code headless mode." >&2
  echo "       To only convert existing markdown to Word, run: npm run docs:docx" >&2
  exit 1
fi

echo "[1/3] Regenerating FEATURE_LIST.md from the codebase (~10-15 min)..." >&2
bash scripts/headless/generate-feature-list.sh > docs/FEATURE_LIST.md

echo "[2/3] Regenerating USER_MANUAL.md from the codebase (~15-20 min)..." >&2
bash scripts/headless/generate-manual.sh > docs/USER_MANUAL.md

echo "[3/3] Converting all docs to Word (.docx)..." >&2
bash scripts/headless/md-to-docx.sh

echo "" >&2
echo "Done. Fresh Word documents are in docs/manual/" >&2
