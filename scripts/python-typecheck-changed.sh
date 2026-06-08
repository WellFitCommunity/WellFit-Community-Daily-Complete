#!/usr/bin/env bash
# Python scoped verification — mirrors scripts/typecheck-changed.sh for the ml/ tree.
# Runs mypy (strict) + ruff + pytest. Phase 0: scoped to ml/. The 5 existing
# scripts/*.py are hardened incrementally (see python-ai-integration-tracker P0-5),
# so they are NOT in the strict gate yet — do not retro-break them.
#
# Usage: bash scripts/python-typecheck-changed.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VENV="ml/.venv"
if [[ ! -x "$VENV/bin/python" ]]; then
  echo "❌ venv missing — run: python3 -m venv ml/.venv && ml/.venv/bin/pip install -r ml/requirements.txt"
  exit 2
fi

BIN="$VENV/bin"
fail=0

echo "── mypy (strict) ──────────────────────────────"
"$BIN/mypy" ml || fail=1

echo "── ruff ───────────────────────────────────────"
"$BIN/ruff" check ml || fail=1

echo "── pytest ─────────────────────────────────────"
"$BIN/pytest" ml/tests || fail=1

if [[ "$fail" -ne 0 ]]; then
  echo "❌ Python checkpoint FAILED — fix before commit (.claude/rules/python.md §12)"
  exit 1
fi
echo "✅ Python checkpoint: mypy 0 / ruff 0 / pytest green (ml/)"
