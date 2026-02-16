#!/usr/bin/env bash
# Generate a user manual from the actual codebase — READ-ONLY
# Output: stdout (pipe to file with > docs/USER_MANUAL.md)
# Usage: bash scripts/headless/generate-manual.sh > docs/USER_MANUAL.md
# Time: ~15-20 minutes

set -euo pipefail
cd "$(dirname "$0")/../.."

echo "Generating user manual from codebase..." >&2
echo "This will take ~15-20 minutes." >&2
echo "" >&2

claude -p "
Read CLAUDE.md and docs/PROJECT_STATE.md first to understand the two-product architecture.

Generate a USER MANUAL by crawling the actual codebase. This is for end users (seniors, nurses, doctors, admins), NOT developers. Write in plain language at a 6th-grade reading level where possible. Do NOT invent features — only document what exists.

## Data Sources to Crawl

1. **Routes + components** — Read src/App.tsx for all routes. For each major route, read the component to understand what the user sees and can do.
2. **Registration flows** — Read docs/product/REGISTRATION_FLOWS.md
3. **Feature dashboards** — Read docs/product/FEATURE_DASHBOARDS.md
4. **Voice commands** — Read docs/product/VOICE_COMMANDS.md
5. **Caregiver suite** — Read docs/clinical/CAREGIVER_SUITE.md
6. **My Health Hub** — Read the MyHealthHubPage and related components
7. **Check-in system** — Read src/components/CheckInTracker.tsx and check-in components
8. **Admin panel** — Read src/components/admin/sections/ for all admin sections available
9. **Clinical features** — Read docs/clinical/ for clinical workflow descriptions

## Output Format

# Envision ATLUS I.H.I.S. — User Manual
> For patients, caregivers, nurses, doctors, and administrators

## Getting Started
### Creating Your Account
### Logging In
### Your Dashboard

## For Patients & Seniors (WellFit)
### Daily Check-In
- What it does, how to use it, what happens with your data
### My Health Hub
- Viewing your medications, conditions, lab results, immunizations
### Medicine Cabinet
### Wellness Programs
### Voice Commands
### Getting Help

## For Caregivers
### PIN-Based Access
### Viewing Your Loved One's Health
### Getting Alerts

## For Nurses
### Patient Dashboard
### Bed Management
### Shift Handoff
### Medication Management
### NurseOS (Resilience Hub)

## For Doctors & Providers
### Patient Chart
### Orders & Results
### Clinical Notes
### AI-Assisted Documentation
### Referral Management

## For Administrators
### Admin Dashboard Overview
### Tenant Management
### User Management
### Billing & Claims
### Quality Measures
### AI Cost Monitoring
### Security & Compliance

## Specialty Modules
### Labor & Delivery
### Dental Health
### Neurological Suite
### Physical Therapy
### EMS Integration

## Accessibility Features
- Large text, voice commands, high contrast, touch-friendly design

## Getting Help
- Contact information, support channels

Rules:
- Write for END USERS, not developers
- Use simple language — many users are seniors
- Include the route path for each section (e.g., 'Go to /my-health')
- Only document features that ACTUALLY EXIST
- If a feature is partial, note what works and what is coming soon
- Include tips and common tasks where helpful
- Output clean markdown ready to save to a file
" --allowedTools "Read,Grep,Glob,Bash"
