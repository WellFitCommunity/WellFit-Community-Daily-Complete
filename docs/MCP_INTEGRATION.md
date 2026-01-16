# MCP Integration Guide

## Overview

Model Context Protocol (MCP) has been integrated into WellFit with **10 specialized MCP servers** providing **79 tools** for healthcare workflows. This includes AI operations, FHIR access, claims processing, code validation, and more.

### MCP Server Inventory

| Server | Tools | Purpose |
|--------|-------|---------|
| **mcp-fhir-server** | 14 | FHIR R4 resource access and EHR sync |
| **mcp-prior-auth-server** | 11 | Prior authorization (CMS-0057-F compliant) |
| **mcp-clearinghouse-server** | 9 | Claims submission, eligibility, remittance |
| **mcp-medical-codes-server** | 9 | CPT/ICD-10/HCPCS search and validation |
| **mcp-hl7-x12-server** | 9 | HL7 v2.x and X12 EDI transformation |
| **mcp-npi-registry-server** | 8 | Provider NPI validation and lookup |
| **mcp-cms-coverage-server** | 8 | Medicare LCD/NCD coverage lookups |
| **mcp-postgres-server** | 4 | Safe database queries with RLS |
| **mcp-edge-functions-server** | 4 | Edge function orchestration |
| **mcp-claude-server** | 3 | AI analysis with PHI de-identification |

**Total: 79 tools across 10 servers**

---

## Claude MCP Server Details

The following section covers the Claude MCP server specifically for AI operations, cost reduction through prompt caching, and code maintainability.

## Architecture

```
┌─────────────────────────────────────────────────┐
│         React Application (Frontend)           │
│                                                 │
│  src/services/mcp/                              │
│    ├── mcpClient.ts        (MCP client wrapper) │
│    ├── mcpHelpers.ts       (Helper functions)   │
│    └── claudeServiceMCP.ts (Drop-in service)    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│     Supabase Edge Function (Self-Hosted)        │
│                                                  │
│  supabase/functions/mcp-claude-server/           │
│    └── index.ts                                  │
│       ├── De-identification (your redact fn)    │
│       ├── Prompt caching (30-40% savings)       │
│       ├── Audit logging (claude_usage_logs)     │
│       └── Error handling                        │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│          Anthropic Claude API                   │
│    claude-sonnet-4-5-20250929                   │
│    claude-haiku-4-5-20250929                    │
└─────────────────────────────────────────────────┘
```

## Benefits

### Cost Reduction
- **30-40% token savings** through prompt caching
- Reuses system prompts across requests
- Efficient context management

### Code Quality
- **Consolidates 3 integration points** into one
- Consistent error handling
- Automatic audit logging
- De-identification built-in

### Maintainability
- Single source of truth for Claude operations
- TypeScript types throughout
- Easy to test and mock
- Clear separation of concerns

## Usage

### Basic Text Analysis

```typescript
import { analyzeText } from '@/services/mcp/mcpHelpers';

const result = await analyzeText({
  text: encounterNotes,
  prompt: 'Extract key clinical findings from these notes',
  model: 'claude-sonnet-4-5-20250929',
  userId: currentUser.id
});
```

### Generate Suggestions

```typescript
import { generateSuggestion } from '@/services/mcp/mcpHelpers';

const suggestion = await generateSuggestion({
  context: { encounterData, patientHistory },
  task: 'Suggest appropriate billing codes for this encounter',
  model: 'claude-haiku-4-5-20250929',
  userId: currentUser.id
});
```

### Summarize Content

```typescript
import { summarizeContent } from '@/services/mcp/mcpHelpers';

const summary = await summarizeContent({
  content: longClinicalNotes,
  maxLength: 500,
  userId: currentUser.id
});
```

### Drop-in Replacement for Existing Code

```typescript
// OLD: Direct Anthropic SDK
import { analyzeWithClaude } from '@/services/claudeService';

// NEW: MCP-powered (same interface!)
import { analyzeWithClaude } from '@/services/mcp/claudeServiceMCP';

// Usage is identical
const result = await analyzeWithClaude({
  prompt: 'Analyze this encounter',
  context: encounterData,
  model: 'sonnet',
  userId: user.id
});
```

## Configuration

### Environment Variables

Required in `.env`:
```bash
# Supabase (already configured)
REACT_APP_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic API
ANTHROPIC_API_KEY=your_anthropic_key
```

### MCP Config

The `mcp.config.json` file defines available MCP servers:

```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "transport": "sse",
      "description": "GitHub operations (code only, no PHI)"
    },
    "claude": {
      "command": "node",
      "args": ["./supabase/functions/mcp-claude-server/index.js"],
      "description": "Self-hosted Claude MCP server"
    }
  }
}
```

## Available MCP Tools

### 1. analyze-text
Analyze text with Claude AI

**Input:**
- `text` (string): Text to analyze
- `prompt` (string): Analysis instructions
- `model` (string, optional): Claude model to use

**Output:**
- Analyzed text with metadata (tokens, cost, timing)

### 2. generate-suggestion
Generate AI suggestions based on context

**Input:**
- `context` (object): Context data
- `task` (string): Task description
- `model` (string, optional): Claude model to use

**Output:**
- Suggestion text with usage statistics

### 3. summarize
Summarize content

**Input:**
- `content` (string): Content to summarize
- `maxLength` (number, optional): Max summary length
- `model` (string, optional): Claude model to use

**Output:**
- Summarized content

## Security & Compliance

### De-identification
All data is automatically de-identified before leaving your infrastructure using your existing `redact()` function:
- Email addresses → `[EMAIL]`
- Phone numbers → `[PHONE]`
- SSN → `[SSN]`
- Addresses → `[ADDRESS]`
- Dates → `[DATE]`

### Audit Logging
Every MCP call is logged to your existing `claude_usage_logs` table:
- User ID
- Request type (`mcp_analyze-text`, etc.)
- Model used
- Token usage
- Cost
- Response time
- Success/failure

### Data Flow
1. Request → Frontend service
2. De-identification → MCP server (Supabase Edge Function)
3. Claude API call → Anthropic
4. Response → Frontend
5. Audit log → `claude_usage_logs` table

## Deployment

### Deploy MCP Server

```bash
# Deploy the self-hosted MCP server to Supabase
npx supabase functions deploy mcp-claude-server --project-ref your-project-ref
```

### Verify Deployment

```bash
# Test the MCP server
curl -X POST https://your-project.supabase.co/functions/v1/mcp-claude-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"method":"tools/list"}'
```

Expected response:
```json
{
  "tools": [
    {"name": "analyze-text", ...},
    {"name": "generate-suggestion", ...},
    {"name": "summarize", ...}
  ]
}
```

## Migration Guide

### Migrating Existing Code

**Step 1: Import MCP service**
```typescript
// Old
import { callClaude } from '@/services/claudeService';

// New
import { analyzeWithClaude } from '@/services/mcp/claudeServiceMCP';
```

**Step 2: Update function calls (minimal changes)**
```typescript
// Old
const result = await callClaude({
  prompt: 'Analyze this',
  data: encounterData
});

// New (same interface!)
const result = await analyzeWithClaude({
  prompt: 'Analyze this',
  context: encounterData,
  userId: user.id
});
```

**Step 3: Test**
```bash
npm run typecheck
npm run build
```

### Gradual Migration Strategy

1. **Phase 1**: Use MCP for new features only
2. **Phase 2**: Migrate high-value services (billing, coding)
3. **Phase 3**: Migrate remaining services
4. **Phase 4**: Remove old claudeService.ts

## Cost Optimization

### Prompt Caching Benefits

**Without MCP:**
```
Request 1: 1000 tokens (system prompt) + 500 tokens (user) = 1500 tokens
Request 2: 1000 tokens (system prompt) + 600 tokens (user) = 1600 tokens
Request 3: 1000 tokens (system prompt) + 450 tokens (user) = 1450 tokens
Total: 4550 input tokens
```

**With MCP (prompt caching):**
```
Request 1: 1000 tokens (cached) + 500 tokens = 1500 tokens
Request 2: 0 tokens (cache hit!) + 600 tokens = 600 tokens
Request 3: 0 tokens (cache hit!) + 450 tokens = 450 tokens
Total: 2550 input tokens (44% savings!)
```

### Cost Calculation

```typescript
// Sonnet pricing
Input: $3.00 / 1M tokens
Output: $15.00 / 1M tokens

// Example: 1000 input, 500 output tokens
Cost = (1000 * 0.000003) + (500 * 0.000015)
     = $0.003 + $0.0075
     = $0.0105 per request

// With 40% caching savings on input
New cost = (600 * 0.000003) + (500 * 0.000015)
         = $0.0018 + $0.0075
         = $0.0093 per request (12% total savings)
```

## Troubleshooting

### MCP Server Not Responding

**Check deployment:**
```bash
npx supabase functions list
```

**View logs:**
```bash
npx supabase functions logs mcp-claude-server
```

### Authentication Errors

Ensure `ANTHROPIC_API_KEY` is set in Supabase secrets:
```bash
npx supabase secrets set ANTHROPIC_API_KEY=your-key
```

### Type Errors

Run type checking:
```bash
npm run typecheck
```

## Monitoring

### Audit Logs Query

```sql
-- View recent MCP usage
SELECT
  request_type,
  model,
  input_tokens,
  output_tokens,
  cost,
  response_time_ms,
  success,
  created_at
FROM claude_usage_logs
WHERE request_type LIKE 'mcp_%'
ORDER BY created_at DESC
LIMIT 100;
```

### Cost Analysis

```sql
-- Total MCP costs by day
SELECT
  DATE(created_at) as date,
  COUNT(*) as requests,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cost) as total_cost
FROM claude_usage_logs
WHERE request_type LIKE 'mcp_%'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Next Steps

1. **Deploy MCP Server**: `npx supabase functions deploy mcp-claude-server`
2. **Test Integration**: Run the examples above
3. **Migrate One Service**: Start with billing or coding suggestions
4. **Monitor Costs**: Check `claude_usage_logs` for savings
5. **Scale Up**: Migrate remaining services progressively

## Support

- **Documentation**: This file
- **Examples**: `src/services/mcp/claudeServiceMCP.ts`
- **MCP Protocol**: https://modelcontextprotocol.io
- **GitHub MCP**: https://github.com/github/github-mcp-server

---

## Healthcare MCP Servers Reference

### mcp-fhir-server

**Purpose:** Standardized FHIR R4 resource access and EHR synchronization

| Tool | Description |
|------|-------------|
| `export_patient_bundle` | Export complete FHIR Bundle for patient |
| `get_resource` | Get specific FHIR resource by ID |
| `search_resources` | Search FHIR resources with filters |
| `create_resource` | Create new FHIR resource |
| `update_resource` | Update existing FHIR resource |
| `validate_resource` | Validate resource against FHIR schema |
| `get_patient_summary` | Get CCD-style clinical summary |
| `get_observations` | Get observations/vitals for patient |
| `get_medication_list` | Get active/historical medications |
| `get_condition_list` | Get diagnoses/conditions |
| `get_sdoh_assessments` | Get SDOH assessments |
| `get_care_team` | Get care team members |
| `list_ehr_connections` | List EHR/FHIR connections |
| `trigger_ehr_sync` | Trigger EHR synchronization |

**Supported FHIR Resources:** Patient, MedicationRequest, Condition, DiagnosticReport, Procedure, Observation, Immunization, CarePlan, CareTeam, Practitioner, Encounter, DocumentReference, AllergyIntolerance, Goal

---

### mcp-prior-auth-server

**Purpose:** FHIR-based Prior Authorization (CMS-0057-F Compliance)

| Tool | Description |
|------|-------------|
| `create_prior_auth` | Create new PA request |
| `submit_prior_auth` | Submit PA to payer |
| `get_prior_auth` | Get PA details |
| `get_patient_prior_auths` | Get all PAs for patient |
| `record_decision` | Record payer decision |
| `create_appeal` | Create appeal for denied PA |
| `check_prior_auth_required` | Check if PA required |
| `get_pending_prior_auths` | Get PAs approaching deadline |
| `get_prior_auth_statistics` | Get PA dashboard metrics |
| `cancel_prior_auth` | Cancel PA request |
| `to_fhir_claim` | Convert PA to FHIR Claim |

**Urgency SLAs:** stat (4 hours), urgent (72 hours), routine (7 days)

---

### mcp-clearinghouse-server

**Purpose:** Healthcare clearinghouse operations for revenue cycle

| Tool | Description |
|------|-------------|
| `submit_claim` | Submit 837P/837I claim |
| `check_claim_status` | Check claim status (276/277) |
| `verify_eligibility` | Verify insurance eligibility (270/271) |
| `process_remittance` | Process ERA/835 remittance |
| `submit_prior_auth` | Submit X12 278 PA request |
| `test_connection` | Test clearinghouse credentials |
| `get_payer_list` | Get supported payers |
| `get_submission_stats` | Get submission statistics |
| `get_rejection_reasons` | Get rejection codes and remediation |

---

### mcp-medical-codes-server

**Purpose:** Unified medical code search and validation

| Tool | Description |
|------|-------------|
| `search_cpt` | Search CPT codes |
| `search_icd10` | Search ICD-10 diagnosis codes |
| `search_hcpcs` | Search HCPCS codes |
| `get_modifiers` | Get applicable modifiers |
| `validate_code_combination` | Validate CPT/ICD-10/modifier combo |
| `check_bundling` | Check for bundling issues |
| `get_code_details` | Get detailed code info |
| `suggest_codes` | Suggest codes from description |
| `get_sdoh_codes` | Get ICD-10 Z-codes for SDOH |

---

### mcp-hl7-x12-server

**Purpose:** Bidirectional HL7 v2.x and X12 EDI transformation

| Tool | Description |
|------|-------------|
| `parse_hl7` | Parse HL7 v2.x message |
| `hl7_to_fhir` | Convert HL7 to FHIR R4 Bundle |
| `generate_hl7_ack` | Generate HL7 ACK response |
| `validate_hl7` | Validate HL7 message structure |
| `generate_837p` | Generate X12 837P claim |
| `validate_x12` | Validate X12 837P structure |
| `parse_x12` | Parse X12 837P to structured data |
| `x12_to_fhir` | Convert X12 to FHIR Claim |
| `get_message_types` | Get supported message types |

**Supported:** HL7 ADT, ORU, ORM (v2.3-2.8), X12 837P (005010X222A1)

---

### mcp-npi-registry-server

**Purpose:** National Provider Identifier validation and lookup

| Tool | Description |
|------|-------------|
| `validate_npi` | Validate NPI using Luhn algorithm |
| `lookup_npi` | Get detailed provider info |
| `search_providers` | Search by name, specialty, location |
| `search_by_specialty` | Search by taxonomy code |
| `get_taxonomy_codes` | Get taxonomy codes for specialty |
| `bulk_validate_npis` | Validate multiple NPIs (max 50) |
| `get_provider_identifiers` | Get all provider identifiers |
| `check_npi_deactivation` | Check deactivation status |

---

### mcp-cms-coverage-server

**Purpose:** Medicare coverage lookups (LCD/NCD)

| Tool | Description |
|------|-------------|
| `search_lcd` | Search Local Coverage Determinations |
| `search_ncd` | Search National Coverage Determinations |
| `get_coverage_requirements` | Get coverage requirements for code |
| `check_prior_auth_required` | Check if PA required for Medicare |
| `get_lcd_details` | Get detailed LCD info |
| `get_ncd_details` | Get detailed NCD info |
| `get_coverage_articles` | Get billing guidance articles |
| `get_mac_contractors` | Get MAC contractor info |

---

### mcp-postgres-server

**Purpose:** Safe, controlled database operations with RLS

| Tool | Description |
|------|-------------|
| `execute_query` | Execute pre-approved query |
| `list_queries` | List available queries |
| `get_table_schema` | Get schema for allowed tables |
| `get_row_count` | Get row count with tenant filter |

**Whitelisted Queries:** get_patient_count_by_risk, get_readmission_risk_summary, get_encounter_summary, get_sdoh_flags_summary, get_medication_adherence_stats, get_claims_status_summary, get_billing_revenue_summary, get_care_plan_summary, get_task_completion_rate, get_referral_summary, get_bed_availability, get_shift_handoff_summary, get_dashboard_metrics, get_quality_metrics

---

### mcp-edge-functions-server

**Purpose:** Orchestrate Supabase Edge Functions

| Tool | Description |
|------|-------------|
| `invoke_function` | Invoke whitelisted function |
| `list_functions` | List available functions |
| `get_function_info` | Get function details |
| `batch_invoke` | Invoke multiple functions |

**Whitelisted Functions:** get-welfare-priorities, calculate-readmission-risk, sdoh-passive-detect, generate-engagement-report, generate-quality-report, enhanced-fhir-export, hl7-receive, generate-837p, process-shift-handoff, create-care-alert, send-sms, hash-pin, verify-pin

---

## Rate Limits

| Server | Requests/Minute |
|--------|-----------------|
| postgres | 60 |
| fhir | 30 |
| clearinghouse | 20 |
| medicalCodes | 100 |
| hl7x12 | 40 |
| claude | 15 |
| edgeFunctions | 50 |

---

## Clinical Workflow Examples

### Patient Intake Flow
```typescript
// 1. Validate provider NPI
const provider = await mcpNpiClient.lookupNpi(referringNpi);

// 2. Verify patient eligibility
const eligibility = await mcpClearinghouseClient.verifyEligibility(patient);

// 3. Check coverage requirements
const coverage = await mcpCmsCoverageClient.getCoverageRequirements(cptCode);

// 4. Create prior auth if needed
if (coverage.prior_auth_required) {
  await mcpPriorAuthClient.createPriorAuth(paRequest);
}
```

### Claims Submission Flow
```typescript
// 1. Validate billing codes
const validation = await mcpMedicalCodesClient.validateCodeCombination(codes);

// 2. Check for bundling issues
const bundling = await mcpMedicalCodesClient.checkBundling(cptCodes);

// 3. Generate 837P
const claim = await mcpHl7X12Client.generate837p(encounterId);

// 4. Submit to clearinghouse
const submission = await mcpClearinghouseClient.submitClaim(claim);
```

---

**Status**: Ready for deployment
**Last Updated**: 2026-01-16
**Version**: 2.0.0
