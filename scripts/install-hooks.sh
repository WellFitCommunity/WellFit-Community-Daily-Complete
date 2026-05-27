#!/usr/bin/env bash
# Install git hooks for WellFit / Envision Atlus.
#
# Reinstalls `.git/hooks/pre-commit` from the tracked source. Run this once
# after cloning the repo (and any time the hook script changes — though the
# hook just exec's scripts/pre-commit-checks.sh, so changes to the rules
# themselves don't require reinstalling).
#
# Why this lives in scripts/ instead of being auto-installed: .git/hooks/
# is not in version control, so we can't ship the hook directly. Husky was
# considered but adds a dependency. This script is the simplest manual path.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -d .git ]; then
  echo "❌ Not a git repository (.git/ not found at $REPO_ROOT)"
  exit 1
fi

mkdir -p .git/hooks

# Write the pre-commit hook stub (it just delegates to the tracked script)
cat > .git/hooks/pre-commit <<'EOF'
#!/usr/bin/env bash
# Pre-commit gate — delegates to the tracked script.
# To reinstall: bash scripts/install-hooks.sh

REPO_ROOT="$(git rev-parse --show-toplevel)"

if [ ! -x "$REPO_ROOT/scripts/pre-commit-checks.sh" ]; then
  echo "⚠️  Pre-commit script missing or not executable:"
  echo "   $REPO_ROOT/scripts/pre-commit-checks.sh"
  echo "Run: chmod +x scripts/pre-commit-checks.sh"
  exit 0
fi

exec "$REPO_ROOT/scripts/pre-commit-checks.sh"
EOF

chmod +x .git/hooks/pre-commit
chmod +x scripts/pre-commit-checks.sh

echo "✅ Pre-commit hook installed at .git/hooks/pre-commit"
echo "   Delegates to scripts/pre-commit-checks.sh (17 rules)"
echo ""
echo "Test with: git commit (an empty commit will run the gate but pass)"
echo "Bypass once (emergency only): git commit --no-verify"
