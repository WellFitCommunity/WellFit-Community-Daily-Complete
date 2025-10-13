#!/bin/bash

# WellFit Documentation Consolidation Script
# This script reorganizes 50+ markdown files into a structured docs/ folder
#
# IMPORTANT: Review this script before running!
# Run with: bash consolidate-docs.sh

set -e  # Exit on error

echo "🗂️  WellFit Documentation Consolidation"
echo "======================================"
echo ""

# Confirm before proceeding
read -p "This will reorganize markdown files. Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

# Create new directory structure
echo "📁 Creating directory structure..."
mkdir -p docs/features
mkdir -p docs/database
mkdir -p docs/security
mkdir -p archive/handoffs
mkdir -p archive/assessments
mkdir -p archive/fixes

echo "✅ Directories created"
echo ""

# ====================
# 1. OFFLINE FEATURES
# ====================
echo "📦 Consolidating: OFFLINE FEATURES..."

# Merge offline docs into single comprehensive guide
cat > docs/OFFLINE_GUIDE.md << 'OFFLINE_EOF'
# WellFit Offline Mode - Complete Guide

> **Built with faith for rural American seniors**
> This implementation allows WellFit to work completely offline - perfect for rural areas, hospitals, and doctor's offices with unreliable internet.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Features](#features)
3. [Deployment](#deployment)
4. [User Guide](#user-guide)
5. [Technical Details](#technical-details)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

OFFLINE_EOF

# Append content from existing files (you'll need to review/edit these merges)
echo "## Quick Start" >> docs/OFFLINE_GUIDE.md
echo "" >> docs/OFFLINE_GUIDE.md
echo "See sections below from README_OFFLINE.txt, OFFLINE_MODE.md, OFFLINE_SUMMARY.md" >> docs/OFFLINE_GUIDE.md
echo "" >> docs/OFFLINE_GUIDE.md
echo "**TODO: Merge content from:**" >> docs/OFFLINE_GUIDE.md
echo "- README_OFFLINE.txt" >> docs/OFFLINE_GUIDE.md
echo "- OFFLINE_MODE.md" >> docs/OFFLINE_GUIDE.md
echo "- OFFLINE_SUMMARY.md" >> docs/OFFLINE_GUIDE.md
echo "- DEPLOYMENT_OFFLINE.md (deployment sections)" >> docs/OFFLINE_GUIDE.md

# Move HIPAA compliance (keep separate for legal reasons)
mv HIPAA_COMPLIANCE.md docs/HIPAA_COMPLIANCE.md 2>/dev/null || echo "⚠️  HIPAA_COMPLIANCE.md already moved or not found"

# Archive original offline files
mv README_OFFLINE.txt archive/ 2>/dev/null || echo "⚠️  README_OFFLINE.txt already moved"
mv OFFLINE_MODE.md archive/ 2>/dev/null || echo "⚠️  OFFLINE_MODE.md already moved"
mv OFFLINE_SUMMARY.md archive/ 2>/dev/null || echo "⚠️  OFFLINE_SUMMARY.md already moved"

echo "✅ Offline features consolidated"
echo ""

# ====================
# 2. DEPLOYMENT
# ====================
echo "📦 Consolidating: DEPLOYMENT..."

cat > docs/DEPLOYMENT_GUIDE.md << 'DEPLOY_EOF'
# WellFit Deployment Guide

Complete guide for deploying WellFit to production (Vercel).

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Deployment Steps](#deployment-steps)
4. [Offline Mode Deployment](#offline-mode-deployment)
5. [Verification Checklist](#verification-checklist)
6. [Troubleshooting](#troubleshooting)

---

**TODO: Merge content from:**
- DEPLOYMENT_CHECKLIST.md
- DEPLOYMENT_READINESS_REPORT.md
- DEPLOYMENT_SUMMARY.md
- DEPLOYMENT_OFFLINE.md (offline-specific sections)

DEPLOY_EOF

# Archive deployment docs
mv DEPLOYMENT_CHECKLIST.md archive/ 2>/dev/null || true
mv DEPLOYMENT_READINESS_REPORT.md archive/assessments/ 2>/dev/null || true
mv DEPLOYMENT_SUMMARY.md archive/ 2>/dev/null || true
mv DEPLOYMENT_OFFLINE.md archive/ 2>/dev/null || true

echo "✅ Deployment docs consolidated"
echo ""

# ====================
# 3. HANDOFF DOCS
# ====================
echo "📦 Archiving: HANDOFF DOCUMENTS..."

mv HANDOFF_FINAL_SUMMARY.md archive/handoffs/ 2>/dev/null || true
mv HANDOFF_ENCRYPTION_CONFIRMED.md archive/handoffs/ 2>/dev/null || true
mv HANDOFF_QUICK_START.md archive/handoffs/ 2>/dev/null || true
mv GOOD_NIGHT.md archive/handoffs/ 2>/dev/null || true

echo "✅ Handoff docs archived"
echo ""

# ====================
# 4. MIGRATION/DATABASE
# ====================
echo "📦 Consolidating: DATABASE & MIGRATION..."

cat > docs/database/MIGRATION_GUIDE.md << 'MIGRATION_EOF'
# Database Migration Guide

Complete guide for database migrations and schema changes.

**TODO: Merge content from:**
- DATABASE_MIGRATION_GUIDE.md
- MIGRATION_INSTRUCTIONS.md
- MIGRATION_MANUAL_STEPS.md
- MIGRATION_STATUS.md

MIGRATION_EOF

cat > docs/database/MULTITENANCY.md << 'TENANT_EOF'
# Multi-Tenancy Guide

Guide for multi-tenant setup and management.

**TODO: Merge content from:**
- MIGRATION_AND_MULTITENANCY_NOTES.md
- TENANT_SETUP.md
- TENANT_VERIFICATION_REPORT.md
- RECOMMENDED_TABLE_USAGE.md

TENANT_EOF

# Archive migration docs
mv DATABASE_MIGRATION_GUIDE.md archive/ 2>/dev/null || true
mv MIGRATION_INSTRUCTIONS.md archive/ 2>/dev/null || true
mv MIGRATION_MANUAL_STEPS.md archive/ 2>/dev/null || true
mv MIGRATION_STATUS.md archive/ 2>/dev/null || true
mv MIGRATION_AND_MULTITENANCY_NOTES.md archive/ 2>/dev/null || true
mv TENANT_VERIFICATION_REPORT.md archive/assessments/ 2>/dev/null || true

# Move active tenant docs
mv TENANT_SETUP.md docs/database/ 2>/dev/null || true
mv RECOMMENDED_TABLE_USAGE.md docs/database/ 2>/dev/null || true

echo "✅ Database docs consolidated"
echo ""

# ====================
# 5. ADMIN FIXES
# ====================
echo "📦 Archiving: ADMIN FIXES..."

mv ADMIN_ACCESS_RESTORED.md archive/fixes/ 2>/dev/null || true
mv ADMIN_NAVIGATION_FIX.md archive/fixes/ 2>/dev/null || true
mv FIXES_DOCUMENTATION.md archive/fixes/ 2>/dev/null || true
mv BILLING_403_FIX.md archive/fixes/ 2>/dev/null || true
mv NAVIGATION_IMPROVEMENTS.md archive/fixes/ 2>/dev/null || true

echo "✅ Admin fixes archived"
echo ""

# ====================
# 6. SECURITY/COMPLIANCE
# ====================
echo "📦 Consolidating: SECURITY & COMPLIANCE..."

cat > docs/security/OVERVIEW.md << 'SECURITY_EOF'
# Security Overview

Complete security documentation for WellFit.

**TODO: Merge content from:**
- SECURITY.md
- SECURITY_AUDIT_REPORT.md
- MULTI_TENANT_SECURITY_ANALYSIS.md

SECURITY_EOF

cat > docs/COMPLIANCE.md << 'COMPLIANCE_EOF'
# Compliance Documentation

HIPAA, SOC2, and compliance information.

**TODO: Merge content from:**
- COMPLIANCE_DOCUMENTATION.md
- SOC2_READINESS_ASSESSMENT.md
- HIPAA_COMPLIANCE.md (reference)

COMPLIANCE_EOF

# Archive security docs
mv SECURITY_AUDIT_REPORT.md archive/assessments/ 2>/dev/null || true
mv MULTI_TENANT_SECURITY_ANALYSIS.md docs/security/ 2>/dev/null || true
mv SOC2_READINESS_ASSESSMENT.md archive/assessments/ 2>/dev/null || true
mv COMPLIANCE_DOCUMENTATION.md archive/ 2>/dev/null || true

# Keep SECURITY.md in root but create reference
if [ -f SECURITY.md ]; then
    cp SECURITY.md docs/security/SECURITY.md
fi

echo "✅ Security docs consolidated"
echo ""

# ====================
# 7. FEATURE DOCS
# ====================
echo "📦 Organizing: FEATURE DOCUMENTATION..."

# Move feature docs to organized structure
mv FREQUENT_FLYER_SYSTEM_DOCUMENTATION.md docs/features/frequent-flyer-system.md 2>/dev/null || true
mv PATIENT_HANDOFF_IMPLEMENTATION.md docs/features/patient-handoff.md 2>/dev/null || true
mv FHIR_AI_DOCUMENTATION.md docs/features/fhir-ai.md 2>/dev/null || true
mv FHIR_FORM_BUILDER_GUIDE.md docs/features/fhir-form-builder.md 2>/dev/null || true
mv AI_DASHBOARD_INTEGRATION_SUMMARY.md docs/features/ai-dashboard.md 2>/dev/null || true
mv METRIC_SYSTEM.md docs/features/metric-system.md 2>/dev/null || true
mv HOLISTIC_RISK_FRAMEWORK.md docs/features/risk-framework.md 2>/dev/null || true

# Combine authentication docs
cat > docs/features/authentication.md << 'AUTH_EOF'
# Authentication System

Complete authentication guide including passkeys and biometric auth.

**TODO: Merge content from:**
- PASSKEY_SETUP.md

AUTH_EOF

mv PASSKEY_SETUP.md archive/ 2>/dev/null || true

echo "✅ Feature docs organized"
echo ""

# ====================
# 8. ASSESSMENTS/REPORTS
# ====================
echo "📦 Archiving: ASSESSMENTS & REPORTS..."

mv CODEBASE_EVALUATION_REPORT.md archive/assessments/ 2>/dev/null || true
mv TECHNICAL_ASSESSMENT.md archive/assessments/ 2>/dev/null || true
mv IMPROVEMENT_ROADMAP.md archive/assessments/ 2>/dev/null || true
mv SENIOR_DASHBOARD_SUMMARY.md archive/assessments/ 2>/dev/null || true

echo "✅ Assessments archived"
echo ""

# ====================
# 9. SETUP/CONFIG
# ====================
echo "📦 Organizing: SETUP & CONFIG..."

mv CLAUDE_SETUP_GUIDE.md docs/CLAUDE_SETUP.md 2>/dev/null || true
mv STYLE_GUIDE.md docs/STYLE_GUIDE.md 2>/dev/null || true

# Keep CLAUDE.md in root (it's used by Claude Code)
echo "✅ CLAUDE.md kept in root"

echo "✅ Setup docs organized"
echo ""

# ====================
# 10. PROJECT/ATLAS DOCS
# ====================
echo "📦 Archiving: PROJECT DOCUMENTATION..."

mv PROJECT_ATLAS_README.md archive/assessments/ 2>/dev/null || true
mv ATLAS_COMPLETE.md archive/assessments/ 2>/dev/null || true

echo "✅ Project docs archived"
echo ""

# ====================
# 11. MISC/OTHER
# ====================
echo "📦 Organizing: MISCELLANEOUS..."

mv QUICK_REFERENCE_CHANGES.md archive/ 2>/dev/null || true
mv DATA_HANDLING_GUIDE.md docs/DATA_HANDLING.md 2>/dev/null || true
mv IMPLEMENTATION_SUMMARY.md archive/assessments/ 2>/dev/null || true
mv emergency_alert_trigger_setup.md docs/features/emergency-alerts.md 2>/dev/null || true
mv test-security-fixes.md archive/fixes/ 2>/dev/null || true
mv sbom-summary.md docs/security/sbom-summary.md 2>/dev/null || true

# Keep error.txt where it is (likely a log file)
echo "✅ Miscellaneous docs organized"
echo ""

# ====================
# 12. CREATE INDEX
# ====================
echo "📦 Creating documentation index..."

cat > docs/README.md << 'INDEX_EOF'
# WellFit Documentation

Complete documentation for the WellFit Community Daily application.

## 📚 Documentation Structure

### Core Guides
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - How to deploy WellFit
- [Offline Mode Guide](OFFLINE_GUIDE.md) - Complete offline functionality guide
- [HIPAA Compliance](HIPAA_COMPLIANCE.md) - HIPAA compliance documentation
- [Compliance Overview](COMPLIANCE.md) - SOC2 and other compliance
- [Data Handling](DATA_HANDLING.md) - Data handling best practices
- [Style Guide](STYLE_GUIDE.md) - Code style guidelines

### Setup & Configuration
- [Claude Setup](CLAUDE_SETUP.md) - Setting up Claude Code for this project

### Database
- [Migration Guide](database/MIGRATION_GUIDE.md) - Database migrations
- [Multi-Tenancy](database/MULTITENANCY.md) - Multi-tenant setup
- [Tenant Setup](database/TENANT_SETUP.md) - Setting up new tenants
- [Table Usage](database/RECOMMENDED_TABLE_USAGE.md) - Database table guidelines

### Features
- [Frequent Flyer System](features/frequent-flyer-system.md) - High-risk patient monitoring
- [Patient Handoff](features/patient-handoff.md) - Care transition system
- [FHIR Integration](features/fhir-ai.md) - FHIR AI documentation
- [FHIR Form Builder](features/fhir-form-builder.md) - Dynamic form system
- [AI Dashboard](features/ai-dashboard.md) - AI insights dashboard
- [Metric System](features/metric-system.md) - Health metrics tracking
- [Risk Framework](features/risk-framework.md) - Holistic risk assessment
- [Authentication](features/authentication.md) - Passkey & biometric auth
- [Emergency Alerts](features/emergency-alerts.md) - Emergency alert system

### Security
- [Security Overview](security/OVERVIEW.md) - Complete security documentation
- [Multi-Tenant Security](security/MULTI_TENANT_SECURITY_ANALYSIS.md) - Tenant isolation
- [SBOM Summary](security/sbom-summary.md) - Software bill of materials

### Archives
Historical documents, completed assessments, and resolved fixes are in the [archive/](../archive/) folder.

---

**Need help?** Start with the [Deployment Guide](DEPLOYMENT_GUIDE.md) or [Offline Mode Guide](OFFLINE_GUIDE.md).
INDEX_EOF

echo "✅ Documentation index created"
echo ""

# ====================
# FINAL SUMMARY
# ====================
echo ""
echo "======================================"
echo "✅ Consolidation Complete!"
echo "======================================"
echo ""
echo "📁 New structure:"
echo "   docs/"
echo "   ├── README.md (index)"
echo "   ├── DEPLOYMENT_GUIDE.md"
echo "   ├── OFFLINE_GUIDE.md"
echo "   ├── HIPAA_COMPLIANCE.md"
echo "   ├── COMPLIANCE.md"
echo "   ├── features/"
echo "   ├── database/"
echo "   └── security/"
echo ""
echo "📦 Archived:"
echo "   archive/"
echo "   ├── handoffs/"
echo "   ├── assessments/"
echo "   └── fixes/"
echo ""
echo "⚠️  NEXT STEPS:"
echo "   1. Review the generated stub files in docs/"
echo "   2. Manually merge content from archive/ into new files"
echo "   3. Update README.md to reference new docs structure"
echo "   4. Delete archive/ when content is fully merged"
echo ""
echo "🔍 Review changes:"
echo "   git status"
echo "   git diff"
echo ""
