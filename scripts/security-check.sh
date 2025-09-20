#!/bin/bash

# WellFit Community Security Check Script
# Run this locally to perform security testing

set -e

echo "🔒 WellFit Community Security Check"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Starting security analysis..."

# 1. NPM Audit
print_status "Running npm audit..."
if npm audit --audit-level=moderate > /dev/null 2>&1; then
    print_success "No npm vulnerabilities found"
else
    print_warning "NPM vulnerabilities detected - run 'npm audit' for details"
fi

# 2. Check for hardcoded secrets
print_status "Scanning for hardcoded secrets..."
SECRET_PATTERNS=(
    "password\s*=\s*['\"][^'\"]{8,}"
    "api[_-]?key\s*[=:]\s*['\"][^'\"]{20,}"
    "secret[_-]?key\s*[=:]\s*['\"][^'\"]{20,}"
    "token\s*[=:]\s*['\"][^'\"]{20,}"
    "-----BEGIN [A-Z ]+-----"
)

SECRETS_FOUND=false
for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -i -E "$pattern" src/ supabase/ --exclude-dir=node_modules --exclude="*.md" --exclude="*.json" 2>/dev/null; then
        print_warning "Potential secret found with pattern: $pattern"
        SECRETS_FOUND=true
    fi
done

if [ "$SECRETS_FOUND" = false ]; then
    print_success "No hardcoded secrets detected"
fi

# 3. Check security headers implementation
print_status "Checking security headers implementation..."

HEADERS_SCORE=0
if grep -r "Content-Security-Policy" supabase/ src/ public/ > /dev/null 2>&1; then
    print_success "Content-Security-Policy implemented"
    ((HEADERS_SCORE++))
else
    print_error "Content-Security-Policy missing"
fi

if grep -r "X-Frame-Options" supabase/ src/ > /dev/null 2>&1; then
    print_success "X-Frame-Options implemented"
    ((HEADERS_SCORE++))
else
    print_error "X-Frame-Options missing"
fi

if grep -r "X-Content-Type-Options" supabase/ src/ > /dev/null 2>&1; then
    print_success "X-Content-Type-Options implemented"
    ((HEADERS_SCORE++))
else
    print_error "X-Content-Type-Options missing"
fi

print_status "Security Headers Score: $HEADERS_SCORE/3"

# 4. Check CORS configuration
print_status "Checking CORS configuration..."

if grep -r "Access-Control-Allow-Origin.*\*" supabase/ src/ > /dev/null 2>&1; then
    print_error "Wildcard CORS detected - security risk!"
else
    print_success "No wildcard CORS found"
fi

if grep -r "ALLOWED_ORIGINS\|allowedOrigins" supabase/ src/ > /dev/null 2>&1; then
    print_success "Origin allowlist implementation found"
else
    print_warning "Origin allowlist not clearly implemented"
fi

# 5. Check for environment variable exposure
print_status "Checking for environment variable exposure..."

if find . -name "*.env*" -not -path "./node_modules/*" -exec grep -l "." {} \; 2>/dev/null | head -1 > /dev/null; then
    print_warning "Environment files detected - ensure they're not committed to git"
    if git ls-files | grep -E "\.env" > /dev/null 2>&1; then
        print_error "Environment files are tracked in git - SECURITY RISK!"
    else
        print_success "Environment files are not tracked in git"
    fi
fi

# 6. Check TypeScript strict mode
print_status "Checking TypeScript configuration..."

if [ -f "tsconfig.json" ]; then
    if grep -q '"strict":\s*true' tsconfig.json; then
        print_success "TypeScript strict mode enabled"
    else
        print_warning "TypeScript strict mode not enabled"
    fi
else
    print_warning "tsconfig.json not found"
fi

# 7. Check for React security patterns
print_status "Checking React security patterns..."

if grep -r "dangerouslySetInnerHTML" src/ > /dev/null 2>&1; then
    print_warning "dangerouslySetInnerHTML usage detected - review for XSS risks"
else
    print_success "No dangerouslySetInnerHTML usage found"
fi

# Summary
echo ""
echo "🔒 Security Check Complete"
echo "========================="

# Calculate overall score
TOTAL_CHECKS=7
PASSED_CHECKS=$HEADERS_SCORE

if [ "$SECRETS_FOUND" = false ]; then
    ((PASSED_CHECKS++))
fi

if ! grep -r "Access-Control-Allow-Origin.*\*" supabase/ src/ > /dev/null 2>&1; then
    ((PASSED_CHECKS++))
fi

if grep -r "ALLOWED_ORIGINS\|allowedOrigins" supabase/ src/ > /dev/null 2>&1; then
    ((PASSED_CHECKS++))
fi

if ! grep -r "dangerouslySetInnerHTML" src/ > /dev/null 2>&1; then
    ((PASSED_CHECKS++))
fi

SCORE=$(( PASSED_CHECKS * 100 / TOTAL_CHECKS ))

if [ $SCORE -ge 80 ]; then
    print_success "Overall Security Score: $SCORE% - GOOD"
elif [ $SCORE -ge 60 ]; then
    print_warning "Overall Security Score: $SCORE% - NEEDS IMPROVEMENT"
else
    print_error "Overall Security Score: $SCORE% - CRITICAL ISSUES"
fi

echo ""
echo "For detailed vulnerability scan, run:"
echo "  npm audit"
echo "  npm run lint:security"
echo ""

# Exit with appropriate code
if [ $SCORE -ge 80 ]; then
    exit 0
else
    exit 1
fi