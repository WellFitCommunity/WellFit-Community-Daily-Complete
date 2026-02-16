#!/usr/bin/env bash
# Generate a comprehensive feature list from the actual codebase — READ-ONLY
# Output: stdout (pipe to file with > docs/FEATURE_LIST.md)
# Usage: bash scripts/headless/generate-feature-list.sh > docs/FEATURE_LIST.md
# Time: ~10-15 minutes

set -euo pipefail
cd "$(dirname "$0")/../.."

echo "Generating feature list from codebase..." >&2
echo "This will take ~10-15 minutes." >&2
echo "" >&2

claude -p "
Read CLAUDE.md and docs/PROJECT_STATE.md first to understand the two-product architecture (WellFit + Envision Atlus).

Generate a comprehensive FEATURE LIST document by crawling the actual codebase. Do NOT invent features — only document what exists.

## Data Sources to Crawl

1. **Routes** — Read src/App.tsx and any route config files. Every route = a user-facing feature.
2. **Admin panel sections** — Read src/components/admin/sections/ for all registered admin dashboard sections.
3. **Edge functions** — List all folders in supabase/functions/ (exclude _shared). Each is a backend capability.
4. **AI skills** — Query the ai_skills references in the codebase (Grep for skill_key or skill registrations).
5. **MCP servers** — List MCP server configs in .mcp.json or similar.
6. **Database tables** — Count tables by category from the governance boundary map in CLAUDE.md.
7. **Existing feature docs** — Scan docs/features/, docs/product/, docs/clinical/ for feature descriptions.

## Output Format

Generate a markdown document with this structure:

# Envision ATLUS I.H.I.S. — Feature List
> Intelligent Healthcare Interoperability System
> Version: [date]
> Products: WellFit (Community) + Envision Atlus (Clinical)

## Platform Overview
- Brief 3-sentence description of what the platform does
- Key stats (number of features, AI services, integrations, database tables)

## WellFit — Community Wellness Platform
### For Seniors & Members
- List each user-facing feature with 1-line description (from routes + components)
### For Caregivers
- Caregiver-specific features
### For Community Organizations
- Org-level features

## Envision Atlus — Clinical Care Engine
### Clinical Workflows
- Bed management, encounters, orders, etc.
### Revenue Cycle
- Billing, claims, ERA, eligibility, superbills
### Clinical Safety
- Medication safety, result escalation, audit trails
### Specialty Modules
- L&D, Dental, Neuro, Physical Therapy, etc.

## AI-Powered Services
- List every AI service with what it does and which Claude model it uses
- Group by: Clinical AI, Community AI, Shared AI

## Healthcare Interoperability
- FHIR R4, HL7 v2.x, X12 EDI, clearinghouse, NPI registry, CMS coverage

## Security & Compliance
- HIPAA controls, SOC2 readiness, encryption, audit logging, RLS

## Infrastructure
- Multi-tenant, white-label, MCP servers, edge functions count

Rules:
- Only list features that ACTUALLY EXIST in the codebase
- Include route paths where applicable
- Note if a feature is partial or complete based on tracker status
- Keep descriptions to 1 line each — this is a feature list, not a manual
- Output clean markdown ready to save to a file
" --allowedTools "Read,Grep,Glob,Bash"
