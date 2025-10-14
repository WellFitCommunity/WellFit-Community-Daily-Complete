#!/bin/bash
# scripts/accessibility-test.sh
# Automated accessibility testing script

set -e

echo "🔍 WellFit Community Accessibility Testing"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if app is running
check_app_running() {
  echo -e "${BLUE}[INFO]${NC} Checking if app is running..."
  if ! curl -s http://localhost:3000 > /dev/null; then
    echo -e "${RED}[ERROR]${NC} App is not running at http://localhost:3000"
    echo "Please start the app with: npm start"
    exit 1
  fi
  echo -e "${GREEN}[PASS]${NC} App is running"
}

# Install dependencies if needed
install_tools() {
  echo -e "${BLUE}[INFO]${NC} Checking accessibility testing tools..."

  # Check for pa11y
  if ! command -v pa11y &> /dev/null; then
    echo -e "${YELLOW}[WARN]${NC} pa11y not found. Installing..."
    npm install -g pa11y pa11y-ci
  fi

  # Check for axe-core
  if ! npm list @axe-core/cli &> /dev/null; then
    echo -e "${YELLOW}[WARN]${NC} @axe-core/cli not found. Installing locally..."
    npm install --save-dev @axe-core/cli
  fi

  echo -e "${GREEN}[PASS]${NC} Tools ready"
}

# Run pa11y tests
run_pa11y() {
  echo -e "${BLUE}[INFO]${NC} Running pa11y accessibility tests..."

  PAGES=(
    "http://localhost:3000"
    "http://localhost:3000/login"
    "http://localhost:3000/register"
  )

  ERRORS=0

  for PAGE in "${PAGES[@]}"; do
    echo -e "${BLUE}[INFO]${NC} Testing: $PAGE"
    if pa11y --standard WCAG2AA --reporter cli "$PAGE"; then
      echo -e "${GREEN}[PASS]${NC} $PAGE"
    else
      echo -e "${RED}[FAIL]${NC} $PAGE"
      ((ERRORS++))
    fi
  done

  if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}[PASS]${NC} All pa11y tests passed"
  else
    echo -e "${RED}[FAIL]${NC} $ERRORS page(s) failed pa11y tests"
    return 1
  fi
}

# Run axe-core tests
run_axe() {
  echo -e "${BLUE}[INFO]${NC} Running axe-core accessibility tests..."

  if npx @axe-core/cli http://localhost:3000 --exit; then
    echo -e "${GREEN}[PASS]${NC} axe-core tests passed"
  else
    echo -e "${RED}[FAIL]${NC} axe-core tests failed"
    return 1
  fi
}

# Check HTML validity
check_html_validity() {
  echo -e "${BLUE}[INFO]${NC} Checking HTML validity..."

  # This is a basic check - you might want to use https://validator.w3.org/nu/
  echo -e "${YELLOW}[WARN]${NC} HTML validation requires manual check at https://validator.w3.org/nu/"
  echo "Please validate: http://localhost:3000"
}

# Check for common accessibility issues
check_common_issues() {
  echo -e "${BLUE}[INFO]${NC} Checking for common accessibility issues in source..."

  ISSUES=0

  # Check for images without alt text
  echo -e "${BLUE}[INFO]${NC} Checking for images without alt attributes..."
  if grep -r "<img" src/ --include="*.tsx" --include="*.jsx" | grep -v 'alt=' | grep -v 'alt=""' > /dev/null; then
    echo -e "${YELLOW}[WARN]${NC} Found images without alt attributes"
    grep -r "<img" src/ --include="*.tsx" --include="*.jsx" | grep -v 'alt=' | grep -v 'alt=""' || true
    ((ISSUES++))
  else
    echo -e "${GREEN}[PASS]${NC} All images have alt attributes"
  fi

  # Check for buttons without accessible names
  echo -e "${BLUE}[INFO]${NC} Checking for buttons without accessible text..."
  if grep -r "<button>" src/ --include="*.tsx" --include="*.jsx" | grep -v "aria-label" | grep -v ">" | grep "<button>$" > /dev/null; then
    echo -e "${YELLOW}[WARN]${NC} Found buttons that may not have accessible text"
    ((ISSUES++))
  fi

  # Check for missing form labels
  echo -e "${BLUE}[INFO]${NC} Checking for inputs without labels..."
  if grep -r "<input" src/ --include="*.tsx" --include="*.jsx" | grep -v 'aria-label' | grep -v 'id=' | head -n 5 > /dev/null; then
    echo -e "${YELLOW}[WARN]${NC} Found inputs that may not have associated labels"
    ((ISSUES++))
  fi

  # Check for missing lang attribute
  echo -e "${BLUE}[INFO]${NC} Checking for lang attribute in HTML..."
  if ! grep -r 'lang=' public/index.html > /dev/null; then
    echo -e "${YELLOW}[WARN]${NC} HTML lang attribute may be missing"
    ((ISSUES++))
  else
    echo -e "${GREEN}[PASS]${NC} HTML lang attribute found"
  fi

  if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}[PASS]${NC} No common accessibility issues found in source"
  else
    echo -e "${YELLOW}[WARN]${NC} $ISSUES potential accessibility issue(s) found"
  fi
}

# Generate accessibility report
generate_report() {
  echo -e "${BLUE}[INFO]${NC} Generating accessibility report..."

  REPORT_DIR="./accessibility-reports"
  mkdir -p "$REPORT_DIR"

  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  REPORT_FILE="$REPORT_DIR/a11y-report-$TIMESTAMP.txt"

  {
    echo "WellFit Community Accessibility Report"
    echo "Generated: $(date)"
    echo "========================================"
    echo ""
    echo "See docs/ACCESSIBILITY_AUDIT_GUIDE.md for full testing checklist"
    echo ""
    echo "Automated Tests:"
    echo "- pa11y: See output above"
    echo "- axe-core: See output above"
    echo ""
    echo "Manual Testing Required:"
    echo "- Screen reader testing (NVDA, VoiceOver, JAWS)"
    echo "- Keyboard navigation testing"
    echo "- Color contrast verification"
    echo "- Zoom testing (200%)"
    echo "- Focus indicator visibility"
    echo ""
    echo "Next Steps:"
    echo "1. Review automated test failures above"
    echo "2. Perform manual screen reader testing"
    echo "3. Complete keyboard navigation testing"
    echo "4. Verify color contrast ratios"
    echo "5. Sign off using docs/ACCESSIBILITY_AUDIT_GUIDE.md checklist"
  } > "$REPORT_FILE"

  echo -e "${GREEN}[PASS]${NC} Report saved to: $REPORT_FILE"
}

# Main execution
main() {
  check_app_running
  install_tools

  echo ""
  run_pa11y || true

  echo ""
  run_axe || true

  echo ""
  check_html_validity

  echo ""
  check_common_issues

  echo ""
  generate_report

  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${GREEN}✓${NC} Automated accessibility testing complete"
  echo ""
  echo "Next steps:"
  echo "1. Review any failures above"
  echo "2. Perform manual testing using docs/ACCESSIBILITY_AUDIT_GUIDE.md"
  echo "3. Test with screen readers (VoiceOver, NVDA)"
  echo "4. Complete keyboard navigation testing"
  echo ""
}

main "$@"
