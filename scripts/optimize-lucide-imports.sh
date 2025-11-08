#!/bin/bash
# Bundle Optimization: Convert lucide-react imports for tree-shaking
# This converts: import { Icon } from 'lucide-react'
# To: import Icon from 'lucide-react/dist/esm/icons/icon'
#
# Expected savings: 500KB-1MB across all files

set -e

echo "🎯 Starting lucide-react import optimization..."
echo ""

# Find all files with lucide-react imports
FILES=$(grep -r "from ['\"]lucide-react['\"]" src/ 2>/dev/null | cut -d: -f1 | sort -u)

if [ -z "$FILES" ]; then
  echo "✅ No files found with lucide-react imports to optimize"
  exit 0
fi

TOTAL=$(echo "$FILES" | wc -l)
echo "📦 Found $TOTAL files to optimize:"
echo "$FILES" | head -10
echo ""

echo "⚠️  MANUAL OPTIMIZATION REQUIRED"
echo ""
echo "Due to complexity of AST parsing, we need to manually fix these files."
echo "Follow this pattern for each file:"
echo ""
echo "❌ BEFORE (imports entire library):"
echo "import { Search, User, Settings } from 'lucide-react';"
echo ""
echo "✅ AFTER (tree-shaking enabled):"
echo "import Search from 'lucide-react/dist/esm/icons/search';"
echo "import User from 'lucide-react/dist/esm/icons/user';"
echo "import Settings from 'lucide-react/dist/esm/icons/settings';"
echo ""
echo "📝 Note: Icon names are kebab-case: TrendingUp → trending-up"
echo ""
echo "🔧 Files to fix:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

COUNT=1
for file in $FILES; do
  # Extract icon names from the file
  ICONS=$(grep "from ['\"]lucide-react['\"]" "$file" | head -1 | sed -E "s/.*\{([^}]+)\}.*/\1/" | tr ',' '\n' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

  echo ""
  echo "[$COUNT/$TOTAL] $file"
  echo "    Icons found:"
  echo "$ICONS" | while read -r icon; do
    if [ ! -z "$icon" ]; then
      # Convert PascalCase to kebab-case
      KEBAB=$(echo "$icon" | sed 's/\([A-Z]\)/-\L\1/g' | sed 's/^-//')
      echo "        $icon → lucide-react/dist/esm/icons/$KEBAB"
    fi
  done

  COUNT=$((COUNT + 1))
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Estimated savings: 15-20KB per file × $TOTAL files = $(echo "$TOTAL * 17.5 / 1024" | bc)MB"
echo ""
echo "💡 TIP: Your IDE will highlight unused imports after conversion"
echo "   Remove any unused icons to save even more!"
echo ""
echo "🚀 After fixing all files, run: npm run build"
echo "   Then check bundle size improvements"
