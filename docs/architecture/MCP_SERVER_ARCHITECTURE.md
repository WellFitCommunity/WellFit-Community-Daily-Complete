# MCP Server Architecture — Envision ATLUS I.H.I.S.

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**
> Proprietary and confidential.

**Last Updated:** 2026-03-05
**Total Servers:** 14
**Total Tools:** 128
**Total Browser Clients:** 13
**Pre-Built Chains:** 2

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [How It All Fits Together](#how-it-all-fits-together)
3. [The 14 MCP Servers](#the-14-mcp-servers)
4. [Shared Infrastructure](#shared-infrastructure)
5. [Chain Orchestration — How Servers Talk to Each Other](#chain-orchestration)
6. [Pre-Built Chains](#pre-built-chains)
7. [Architecture Assessment — What's Working Well](#whats-working-well)
8. [Drawbacks and Gaps](#drawbacks-and-gaps)
9. [Recommendations](#recommendations)
10. [Quick Reference Tables](#quick-reference-tables)

---

## Executive Summary

The MCP (Model Context Protocol) infrastructure is the **interoperability backbone** of Envision ATLUS. It consists of 14 specialized servers deployed as Supabase Edge Functions, each owning a specific healthcare domain. They share common security, rate limiting, input validation, and audit infrastructure (~2,244 lines of shared utilities).

**The architecture is in good shape.** The servers are well-separated by concern, consistently structured, and secured with multi-layered authentication. The two main areas for improvement are: (1) a missing browser client for the cultural competency server, and (2) the chain orchestrator's `max_retries` field is defined but not yet executed.

---

## How It All Fits Together

```
                          ┌──────────────────────────┐
                          │     Browser (Admin UI)    │
                          │  src/services/mcp/*.ts    │
                          └──────────┬───────────────┘
                                     │ Supabase Edge Function invoke
                                     │ (Authorization: Bearer JWT)
                                     ▼
              ┌─────────────────────────────────────────────┐
              │          SHARED INFRASTRUCTURE               │
              │  ┌─────────┐ ┌──────────┐ ┌──────────────┐ │
              │  │Auth Gate│ │Rate Limit│ │Input Validate│ │
              │  │(JWKS +  │ │(In-mem + │ │(Schema per   │ │
              │  │ MCP Key)│ │Persistent│ │   tool)      │ │
              │  └─────────┘ └──────────┘ └──────────────┘ │
              │  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
              │  │  Audit   │ │ Identity │ │ JWKS Cache  │ │
              │  │  Logger  │ │ Resolver │ │ (fast JWT)  │ │
              │  └──────────┘ └──────────┘ └─────────────┘ │
              └─────────────────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
    ┌──────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
    │  TIER 1     │          │  TIER 2     │          │  TIER 3     │
    │ External API│          │ User-Scoped │          │ Admin/Clin. │
    │             │          │             │          │             │
    │ NPI Registry│          │ HL7/X12     │          │ FHIR        │
    │ PubMed      │          │ Clearinghse │          │ Prior Auth  │
    │ CMS Coverage│          │             │          │ Postgres    │
    │ Med Codes   │          │             │          │ Med Coding  │
    │             │          │             │          │ Claude AI   │
    │             │          │             │          │ Edge Funcs  │
    │             │          │             │          │ Cultural Cx │
    │             │          │             │          │ Chain Orch. │
    └──────┬──────┘          └──────┬──────┘          └──────┬──────┘
           │                         │                         │
    ┌──────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
    │ External    │          │ Supabase DB │          │ Supabase DB │
    │ APIs (CMS,  │          │ (RLS scope) │          │ (svc role)  │
    │ NCBI, NPPES)│          │             │          │             │
    └─────────────┘          └─────────────┘          └─────────────┘
```

### Authentication Tiers

| Tier | Auth Required | DB Access | Rate Limiting | Servers |
|------|--------------|-----------|---------------|---------|
| **1 — External API** | None | Optional (graceful) | In-memory only | NPI, PubMed, CMS Coverage, Medical Codes |
| **2 — User-Scoped** | Anon key + RLS | Per-user isolation | In-memory + persistent | HL7/X12, Clearinghouse |
| **3 — Admin/Clinical** | Service role + JWT/MCP-Key | Full access | In-memory + persistent + identity-based | FHIR, Prior Auth, Postgres, Medical Coding, Claude, Edge Functions, Cultural Competency, Chain Orchestrator |

---

## The 14 MCP Servers

### 1. mcp-claude-server — AI Operations

| | |
|---|---|
| **Purpose** | Claude AI integration with cost optimization and prompt caching |
| **Tier** | 3 (Admin) |
| **Client** | `mcpClient.ts` + `mcpHelpers.ts` |
| **Tools** | `analyze-text`, `generate-suggestion`, `summarize`, `ping` |

**How it works:** Wraps the Anthropic API. Every call is tracked in `claude_usage_logs` with token counts (input/output) and cost. Supports model routing — Haiku for fast lookups, Sonnet for complex analysis. The cost optimizer (`mcp-cost-optimizer.ts`) selects the cheapest model that meets the task requirements.

**Data flow:** Browser → Edge Function → Anthropic API → response cached + cost logged → Browser

---

### 2. mcp-postgres-server — Safe Database Queries

| | |
|---|---|
| **Purpose** | Controlled database access through pre-approved whitelisted queries |
| **Tier** | 3 (Admin) |
| **Client** | `mcpPostgresClient.ts` |
| **Tools** | `execute_query`, `list_queries`, `get_table_schema`, `get_row_count`, `ping` |

**How it works:** Maintains a whitelist of named queries (e.g., `dashboard_metrics`, `patient_risk_distribution`, `bed_availability`). The browser sends a query name + optional parameters — never raw SQL. The server looks up the query definition, applies parameters safely, and executes. This prevents SQL injection by design.

**Whitelisted queries:** Dashboard metrics, patient risk distribution, readmission risk summary, encounter summary, SDOH flags, medication adherence stats, claims status, billing revenue, care plan summary, task completion rate, referral summary, bed availability, shift handoff summary, quality metrics.

---

### 3. mcp-edge-functions-server — Workflow Orchestration

| | |
|---|---|
| **Purpose** | Invoke and monitor other Supabase Edge Functions |
| **Tier** | 3 (Admin) |
| **Client** | `mcpEdgeFunctionsClient.ts` |
| **Tools** | `invoke_function`, `list_functions`, `get_function_info`, `batch_invoke`, `ping` |

**How it works:** Acts as a gateway to 13 whitelisted edge functions. The browser specifies which function to call and what arguments to pass. The server validates the function name against its whitelist, calls the function via `fetch()` to the Supabase functions endpoint, and returns the result. Batch mode executes functions sequentially.

**Whitelisted functions:** `get-welfare-priorities`, `calculate-readmission-risk`, `sdoh-passive-detect`, `generate-engagement-report`, `generate-quality-report`, `enhanced-fhir-export`, `hl7-receive`, `generate-837p`, `process-shift-handoff`, `create-care-alert`, `send-sms`, `hash-pin`, `verify-pin`

---

### 4. mcp-medical-codes-server — CPT/ICD-10/HCPCS Lookups

| | |
|---|---|
| **Purpose** | Medical code search, validation, bundling checks, and AI-powered code suggestion |
| **Tier** | 1 (External API — can also query local DB) |
| **Client** | `mcpMedicalCodesClient.ts` |
| **Tools** | `search_cpt`, `search_icd10`, `search_hcpcs`, `get_modifiers`, `validate_code_combination`, `check_bundling`, `get_code_details`, `suggest_codes`, `get_sdoh_codes`, `ping` |

**How it works:** Queries the `code_cpt`, `code_icd`, `code_hcpcs`, and `code_modifiers` database tables. Validates code combinations against CMS bundling rules (e.g., detecting when two CPT codes should be reported together or when a modifier is required). The `suggest_codes` tool uses Claude AI to suggest appropriate codes from a free-text clinical description.

---

### 5. mcp-fhir-server — FHIR R4 Interoperability

| | |
|---|---|
| **Purpose** | Full FHIR R4 resource CRUD, patient bundle export, EHR synchronization |
| **Tier** | 3 (Admin) |
| **Client** | `mcpFHIRClient.ts` |
| **Scope** | `mcp:fhir` |
| **Tools** | `export_patient_bundle`, `get_resource`, `search_resources`, `create_resource`, `update_resource`, `validate_resource`, `get_patient_summary`, `get_observations`, `get_medication_list`, `get_condition_list`, `get_sdoh_assessments`, `get_care_team`, `list_ehr_connections`, `trigger_ehr_sync`, `ping` |

**How it works:** Maps 18 FHIR resource types to Supabase tables (`fhir_patients`, `fhir_conditions`, `fhir_medication_requests`, `fhir_observations`, etc.). The `export_patient_bundle` tool assembles a complete FHIR Bundle containing all resources for a patient — medications, conditions, labs, immunizations, care plans, care team, allergies, and more. The `trigger_ehr_sync` tool connects to external EHR systems for pull/push/bidirectional synchronization.

**18 FHIR Resource Types:** Patient, MedicationRequest, Condition, DiagnosticReport, Procedure, Observation, Immunization, CarePlan, CareTeam, Practitioner, PractitionerRole, Encounter, DocumentReference, AllergyIntolerance, Goal, Location, Organization, Medication

---

### 6. mcp-hl7-x12-server — Healthcare Message Transformation

| | |
|---|---|
| **Purpose** | Bidirectional transformation between HL7 v2.x, X12 837P, and FHIR R4 |
| **Tier** | 2 (User-Scoped) |
| **Client** | `mcpHL7X12Client.ts` |
| **Tools** | `parse_hl7`, `hl7_to_fhir`, `validate_hl7`, `generate_hl7_ack`, `generate_837p`, `validate_x12`, `parse_x12`, `x12_to_fhir`, `get_message_types`, `ping` |

**How it works:** Parses HL7 pipe-delimited messages (ADT, ORM, ORU, etc.) into structured segments and fields. Generates X12 837P professional claims from encounter data (patient demographics, provider NPI, diagnosis codes, procedure codes, charges). Converts between all three formats — HL7 messages become FHIR Bundles, X12 claims become FHIR Claim resources, and vice versa. The `generate_hl7_ack` tool creates proper ACK/NAK responses (AA, AE, AR codes).

---

### 7. mcp-clearinghouse-server — EDI Claims & Eligibility

| | |
|---|---|
| **Purpose** | Submit claims, verify insurance eligibility, process remittances via clearinghouses |
| **Tier** | 2 (User-Scoped) |
| **Client** | `mcpClearinghouseClient.ts` |
| **Tools** | `submit_claim`, `check_claim_status`, `verify_eligibility`, `process_remittance`, `submit_prior_auth`, `test_connection`, `get_payer_list`, `get_submission_stats`, `get_rejection_reasons`, `ping` |

**How it works:** Formats and submits 837P/837I claims to healthcare clearinghouses (Waystar, Change Healthcare, Availity). Sends 270 eligibility inquiry transactions and processes 271 responses to verify patient insurance coverage before billing. Processes ERA/835 remittance advice to match payments to claims. Tracks submissions in `clearinghouse_batches` and `claims` tables. The `get_rejection_reasons` tool provides remediation guidance for denied claims.

---

### 8. mcp-prior-auth-server — Prior Authorization Lifecycle

| | |
|---|---|
| **Purpose** | CMS-0057-F compliant prior authorization management (Da Vinci PAS / FHIR R4) |
| **Tier** | 3 (Admin) |
| **Client** | `mcpPriorAuthClient.ts` |
| **Scope** | `mcp:prior_auth` |
| **Tools** | `create_prior_auth`, `submit_prior_auth`, `get_prior_auth`, `get_patient_prior_auths`, `record_decision`, `create_appeal`, `check_prior_auth_required`, `get_pending_prior_auths`, `get_prior_auth_statistics`, `cancel_prior_auth`, `to_fhir_claim`, `ping` |

**How it works:** Manages the full prior authorization lifecycle: create request → submit to payer → receive decision (approved/denied/partial/pended) → appeal if denied. Stores all PA records in the database with full audit trail. The `check_prior_auth_required` tool determines if a PA is needed for specific service codes before the provider orders them. The `to_fhir_claim` tool converts PA records to FHIR Claim resources for interoperability. Tracks approaching deadlines via `get_pending_prior_auths`.

---

### 9. mcp-cms-coverage-server — Medicare Coverage Lookups

| | |
|---|---|
| **Purpose** | LCD/NCD lookups, coverage requirements, and prior auth rules from CMS |
| **Tier** | 1 (External API) |
| **Client** | `mcpCMSCoverageClient.ts` |
| **Tools** | `search_lcd`, `search_ncd`, `get_coverage_requirements`, `check_prior_auth_required`, `get_lcd_details`, `get_ncd_details`, `get_coverage_articles`, `get_mac_contractors`, `ping` |

**How it works:** Calls the CMS Medicare Coverage Database API. Searches Local Coverage Determinations (LCDs — regional rules) and National Coverage Determinations (NCDs — nationwide rules) by keyword, HCPCS code, or contractor. Returns coverage criteria, medical necessity documentation requirements, billing/coding guidance, and Medicare Administrative Contractor (MAC) info by state.

---

### 10. mcp-npi-registry-server — Provider Validation

| | |
|---|---|
| **Purpose** | NPI number validation and provider lookup via CMS NPPES |
| **Tier** | 1 (External API) |
| **Client** | `mcpNPIRegistryClient.ts` |
| **Tools** | `validate_npi`, `lookup_npi`, `search_providers`, `search_by_specialty`, `get_taxonomy_codes`, `bulk_validate_npis`, `get_provider_identifiers`, `check_npi_deactivation`, `ping` |

**How it works:** Calls the CMS NPI Registry API (NPPES). Validates 10-digit NPI numbers using the Luhn check algorithm and confirms active status. Searches by provider name, specialty (taxonomy code), or location. Returns detailed provider information: state licenses, DEA numbers, practice addresses, taxonomy codes, and credentials. The `bulk_validate_npis` tool validates up to 50 NPIs in a single call.

---

### 11. mcp-pubmed-server — Biomedical Literature

| | |
|---|---|
| **Purpose** | PubMed article search, abstracts, citations, and clinical trial lookup |
| **Tier** | 1 (External API) |
| **Client** | `mcpPubMedClient.ts` |
| **Tools** | `search_pubmed`, `search_clinical_trials`, `get_article_summary`, `get_article_abstract`, `get_article_citations`, `get_mesh_terms`, `ping` |

**How it works:** Calls NCBI Entrez E-utilities (`esearch.fcgi`, `esummary.fcgi`, `efetch.fcgi`, `elink.fcgi`). Searches PubMed by keywords, MeSH terms, author, date range, and article type. The `search_clinical_trials` tool filters specifically for clinical trial publications by condition, intervention, and phase. Returns article metadata (title, authors, journal, DOI), full abstracts with MeSH indexing terms, and citation graphs (articles that cite a given article).

---

### 12. mcp-cultural-competency-server — Population-Specific Context

| | |
|---|---|
| **Purpose** | Cultural context profiles for 8 populations, used by AI clinical skills |
| **Tier** | 2 (User-Scoped) |
| **Client** | None (gap — see [Drawbacks](#drawbacks-and-gaps)) |
| **Tools** | `get_cultural_context`, `get_communication_guidance`, `get_clinical_considerations`, `get_barriers_to_care`, `get_sdoh_codes`, `check_drug_interaction_cultural`, `get_trust_building_guidance`, `seed_profiles`, `ping` |

**How it works:** Maintains profiles for 8 populations: veterans, unhoused, Latino, Black/African American, isolated elderly, Indigenous, immigrant/refugee, and LGBTQ+ elderly. Each profile contains communication guidance (medication discussions, diagnosis delivery, discharge instructions), clinical risk factors, screening recommendations, barriers to care with mitigation strategies, SDOH Z-codes, traditional remedy × medication interactions, and trust-building strategies with historical context. Profiles are stored in the `cultural_competency_profiles` database table with hardcoded fallback. Wired into 7 AI clinical skills and the Compass Riley reasoning tree trigger.

**8 Populations:** `veterans`, `unhoused`, `latino`, `black_aa`, `isolated_elderly`, `indigenous`, `immigrant_refugee`, `lgbtq_elderly`

---

### 13. mcp-medical-coding-server — Revenue Cycle & DRG

| | |
|---|---|
| **Purpose** | Payer reimbursement rules, AI-powered DRG grouping, charge aggregation, revenue optimization |
| **Tier** | 3 (Admin) |
| **Client** | `mcpMedicalCodingClient.ts` |
| **Tools** | `get_payer_rules`, `upsert_payer_rule`, `aggregate_daily_charges`, `get_daily_snapshot`, `save_daily_snapshot`, `run_drg_grouper`, `get_drg_result`, `optimize_daily_revenue`, `validate_charge_completeness`, `get_revenue_projection`, `ping` |

**How it works:** The revenue cycle engine. Queries `payer_reimbursement_rules` for Medicare DRG base rates, Medicaid per diem tiers, commercial case rates, TRICARE, and workers comp. The `run_drg_grouper` tool uses a 3-pass MS-DRG methodology: evaluates the encounter at base DRG, then with CC (complication/comorbidity), then with MCC (major CC) — selects the highest clinically justified level. The `aggregate_daily_charges` tool pulls all billable activity from 5 source tables (labs, imaging, meds, procedures, nursing) for a calendar day. The `optimize_daily_revenue` tool uses AI to identify missing codes, documentation gaps, and upgrade opportunities. **All AI suggestions are advisory only — never auto-filed.**

---

### 14. mcp-chain-orchestrator — Multi-Server Pipelines

| | |
|---|---|
| **Purpose** | Orchestrate multi-step workflows that call multiple MCP servers in sequence |
| **Tier** | 3 (Admin) |
| **Client** | `chainOrchestrationService.ts` (HTTP, not MCP protocol) |
| **Routes** | `POST /start`, `/resume`, `/approve`, `/cancel`, `/status` |

**How it works:** This is the conductor — it doesn't do clinical work itself, it sequences the servers that do. Chain definitions are stored in the database (`mcp_chain_definitions` + `mcp_chain_step_definitions`). Each step specifies which MCP server to call, what tool to invoke, and how to map output from one step into input for the next using JSONPath expressions (e.g., `$.steps.validate_codes.output.valid`). Supports **approval gates** where the chain pauses for physician review before continuing. Supports **conditional steps** that only execute if a condition is met. See [Chain Orchestration](#chain-orchestration) for the full architecture.

---

## Shared Infrastructure

All 14 servers share 8 foundational modules (~2,244 lines):

| Module | Lines | What It Does |
|--------|-------|-------------|
| **mcpAuthGate.ts** | 591 | Dual-path authentication: X-MCP-KEY (machine-to-machine) or Bearer JWT (user session). JWKS fast-path eliminates 100-300ms auth.getUser() round-trip. Role verification against `profiles` table. |
| **mcpServerBase.ts** | 431 | Server initialization per tier. Response factories for MCP protocol. In-memory rate limit fallback. Body size limits (512KB default, 2MB for FHIR). Provenance metadata. |
| **mcpRateLimiter.ts** | 410 | Two-layer rate limiting: (1) in-memory per-IP for DoS protection (<1ms), (2) persistent via Supabase RPC for per-identity fairness (~30ms). Cross-instance via database. Per-server limits (15/min for Claude, 100/min for NPI lookups). |
| **mcpInputValidator.ts** | 401 | Declarative schema validation per tool. Medical code format checks (CPT, HCPCS, ICD-10 with Luhn). UUID, NPI, date, state code, zip code validation. Batch array validation. |
| **mcpIdentity.ts** | 125 | Extracts tenant ID from authentication context. Priority: caller identity > tool arguments. Logs security events for tenant mismatches. |
| **mcpAudit.ts** | 117 | Unified audit logging to `mcp_audit_logs` table. Server-scoped audit functions. Fallback to `claude_usage_logs` if primary table unavailable. |
| **mcpJwksVerifier.ts** | 82 | Local JWT verification using Supabase JWKS endpoint. Caches keys. Eliminates network round-trip for token validation. Graceful fallback on failure. |
| **mcpQueryTimeout.ts** | 87 | Query timeout enforcement for long-running database operations. |

### Server Request Lifecycle

Every request flows through this pipeline:

```
1. CORS check (OPTIONS → preflight response)
2. Body size limit check (reject if too large)
3. In-memory rate limit (per-IP, <1ms)
4. JSON-RPC method routing
   ├── "initialize" → server capabilities
   ├── "tools/list" → tool definitions (with auth for Tier 3)
   └── "tools/call" →
       5. Auth gate (Tier 2: anon key, Tier 3: JWKS/MCP-Key + role check)
       6. Persistent rate limit (per-identity, ~30ms)
       7. Tenant resolution (from auth, not user args)
       8. Input validation (schema per tool)
       9. Tool execution (domain logic)
      10. Audit logging (async, non-blocking)
      11. MCP response with metadata
```

---

## Chain Orchestration

The chain orchestrator is the **only mechanism** for server-to-server communication. No MCP server calls another directly — all cross-server flows go through the orchestrator.

### How Chains Work

```
Chain Definition (database)
  ┌──────────────────────────────────────────────────────┐
  │ Step 1: mcp-medical-codes → validate_code_combination│
  │         ↓ output feeds into step 2                   │
  │ Step 2: mcp-cms-coverage → check_prior_auth_required │
  │         ↓ conditional gate                           │
  │ Step 3: mcp-prior-auth → create_prior_auth           │
  │         ⏸ APPROVAL GATE (physician reviews)          │
  │         ↓ after approval                             │
  │ Step 4: mcp-hl7-x12 → generate_837p                 │
  │         ↓ output is the final claim                  │
  │ Step 5: mcp-clearinghouse → submit_claim             │
  └──────────────────────────────────────────────────────┘
```

**Step execution:**
1. Orchestrator loads chain definition + step definitions from database
2. For each step: resolves input by mapping prior step outputs via JSONPath
3. Calls the target MCP server via HTTP `fetch()` with service role auth
4. Stores the result in `mcp_chain_step_results`
5. If next step `requires_approval`: chain pauses, status = `awaiting_approval`
6. Physician reviews and calls `POST /approve` to continue or `POST /cancel` to abort
7. If step has a `condition_expression`: evaluates against prior outputs, skips if false
8. Repeat until all steps complete

**Input mapping example:**
```json
{
  "patient_id": "$.input.patient_id",
  "encounter_id": "$.input.encounter_id",
  "prior_auth_id": "$.steps.create_prior_auth.auth_id"
}
```

**Database tables:**
| Table | Purpose |
|-------|---------|
| `mcp_chain_definitions` | Chain templates (name, steps, version) |
| `mcp_chain_step_definitions` | Step config (server, tool, input mapping, approval flag, condition) |
| `mcp_chain_runs` | Execution instances (status, current step, started_by, tenant_id) |
| `mcp_chain_step_results` | Per-step outcomes (output, duration, approval decision) |

---

## Pre-Built Chains

### Chain 1: Claims Submission Pipeline (`claims_pipeline`)

**Purpose:** End-to-end claim submission — validate codes, check coverage, create prior auth if needed, generate 837P, submit to clearinghouse.

| Step | Server | Tool | Approval? | Conditional? |
|------|--------|------|-----------|-------------|
| 1. Validate Code Combination | mcp-medical-codes | `validate_code_combination` | No | No |
| 2. Check Prior Auth Required | mcp-cms-coverage | `check_prior_auth_required` | No | No |
| 3. Create Prior Authorization | mcp-prior-auth | `create_prior_auth` | **Yes (physician)** | **Yes** — only if step 2 says PA required |
| 4. Generate 837P Claim | mcp-hl7-x12 | `generate_837p` | No | No |
| 5. Submit to Clearinghouse | mcp-clearinghouse | `submit_claim` | No | No (placeholder) |

**4 MCP servers coordinated.** Step 3 is conditional — it only executes if the CMS coverage lookup says prior auth is required. Step 5 is a placeholder — 837P generates successfully but auto-submission to clearinghouse is not yet connected.

### Chain 2: Medical Coding Revenue Pipeline (`medical_coding_revenue`)

**Purpose:** End-to-end inpatient revenue — aggregate charges, snapshot, DRG grouping, revenue projection, optimization, validation.

| Step | Server | Tool | Approval? |
|------|--------|------|-----------|
| 1. Aggregate Daily Charges | mcp-medical-coding | `aggregate_daily_charges` | No |
| 2. Save Charge Snapshot | mcp-medical-coding | `save_daily_snapshot` | No |
| 3. Run DRG Grouper | mcp-medical-coding | `run_drg_grouper` | **Yes (physician)** |
| 4. Calculate Revenue Projection | mcp-medical-coding | `get_revenue_projection` | No |
| 5. Optimize Daily Revenue | mcp-medical-coding | `optimize_daily_revenue` | No |
| 6. Validate Charge Completeness | mcp-medical-coding | `validate_charge_completeness` | No |

**Single server, 6-step pipeline.** Step 3 pauses for physician approval of the AI-assigned DRG code before proceeding to revenue calculation. All steps feed forward — step 1's charge aggregation feeds into step 2's snapshot, step 3's DRG feeds into step 4's revenue projection.

### Client-Side Chain: NPI-to-FHIR Mapper

**File:** `src/services/mcp/npiToFHIRMapper.ts`

**Purpose:** Browser-side coordination between NPI Registry and FHIR servers for provider registration.

**Flow:** NPI Registry `lookup_npi` → Transform to FHIR Practitioner → FHIR `create_resource`

This is a lightweight, client-side chain used by the `BillingProviderForm` component. It doesn't go through the chain orchestrator because it's a simple 2-step mapping without approval gates.

---

## Architecture Assessment — What's Working Well

### Separation of Concerns
Each server owns exactly one domain. The medical codes server doesn't know about claims. The FHIR server doesn't know about billing. The clearinghouse server doesn't know about clinical notes. This means:
- Servers can be deployed, updated, and scaled independently
- A bug in one server doesn't cascade to others
- Teams can own specific servers without stepping on each other

### Consistent Structure
All 14 servers follow the same request lifecycle (auth → rate limit → validate → execute → audit). This means debugging any server follows the same pattern — you know where to look for auth failures, validation errors, and business logic issues.

### Defense in Depth
Security is layered, not single-point:
- **Layer 1:** Body size limits prevent resource exhaustion
- **Layer 2:** In-memory rate limiting blocks DoS (<1ms)
- **Layer 3:** Auth gate verifies identity (JWKS or MCP-Key)
- **Layer 4:** Persistent rate limiting enforces per-identity fairness
- **Layer 5:** Tenant isolation — tenant ID comes from auth, not user input
- **Layer 6:** Input validation catches malformed data before business logic
- **Layer 7:** Audit logging creates an immutable trail

### Graceful Degradation
Every layer has a fallback:
- JWKS verification fails → falls back to `auth.getUser()` (slower but functional)
- Persistent rate limit RPC fails → falls back to in-memory (less accurate but still safe)
- Supabase client unavailable → Tier 1 servers still work (they call external APIs)
- Primary audit table unavailable → falls back to `claude_usage_logs`

### Healthcare Compliance
- **HIPAA audit trail:** All MCP operations logged with user, operation, tenant, timestamp
- **Advisory-only AI:** DRG grouper, revenue optimizer, and code suggester never auto-file — physician approval required
- **Tenant isolation:** RLS policies + identity-based tenant resolution prevent cross-tenant data access
- **Approval gates:** Chain orchestrator pauses for physician review on clinical AI decisions

---

## Drawbacks and Gaps

### 1. Missing Browser Client for Cultural Competency Server

**Severity:** Medium
**Impact:** The `mcp-cultural-competency-server` has no type-safe browser client at `src/services/mcp/mcpCulturalCompetencyClient.ts`. It's called via direct edge function invoke or through AI skill edge functions. This means:
- No TypeScript type safety when calling cultural competency tools from the browser
- Inconsistent with every other server (all 12 others have clients)
- Error handling is ad-hoc at each call site

**Fix:** ~2 hours to create a client following the existing pattern.

### 2. Chain Retry Logic Not Implemented

**Severity:** Medium
**Impact:** The `max_retries` field exists in `mcp_chain_step_definitions` but the chain engine doesn't execute retries. If a step fails (e.g., transient network error to CMS API), the chain fails and requires manual `resumeChain()`. This is fine for physician-reviewed workflows but fragile for automated pipelines.

**Fix:** ~4 hours to add retry loop in `chainEngine.ts` with exponential backoff.

### 3. Claims Pipeline Step 5 is a Placeholder

**Severity:** Low (expected)
**Impact:** The clearinghouse submission step generates the 837P successfully but doesn't actually submit to a clearinghouse. Manual submission is required. This is by design — clearinghouse integration requires contract setup with Waystar/Change Healthcare/Availity.

**Fix:** Production integration when a clearinghouse contract is in place.

### 4. No Chain Definition Admin UI

**Severity:** Low
**Impact:** Chain definitions are managed via database (SQL inserts or Supabase UI). There's no admin panel to create/edit/test chains visually. The `ChainOrchestrationPanel` exists for monitoring and approving runs, but not for authoring chain definitions.

**Fix:** ~8 hours to build a chain definition editor.

### 5. Error Response Format Variation

**Severity:** Low
**Impact:** While all servers use JSON-RPC error format, the specific error codes and metadata shapes vary slightly between servers. Not a functional issue — the browser clients handle this — but it makes cross-server error aggregation harder.

**Fix:** ~2 hours to create a shared error code enum and standardize metadata shape.

### 6. Serial-Only Chain Execution

**Severity:** Low
**Impact:** The chain orchestrator executes steps sequentially even when steps are independent (no data dependency between them). For example, in a hypothetical chain where steps 2 and 3 are independent, they still run one after the other.

**Fix:** ~8 hours to add parallel step detection and execution.

### 7. Cost Tracking Not Unified

**Severity:** Low
**Impact:** Claude AI costs are tracked in `mcp_cost_metrics`. All MCP operations are logged in `mcp_audit_logs`. But there's no single dashboard view that shows total MCP infrastructure cost (AI tokens + external API calls + database query time).

**Fix:** ~4 hours to create an aggregated cost view.

### 8. Service Role Key in Chain Orchestrator

**Severity:** Medium (security)
**Impact:** The chain orchestrator uses the service role key (`SB_SECRET_KEY`) for internal server-to-server calls. If error messages or logs expose the key, it could be compromised. The key is currently used safely (in `Authorization` headers only), but there's no dedicated internal-only auth mechanism.

**Fix:** Consider scoped MCP keys for internal service accounts to reduce blast radius.

---

## Recommendations

### Immediate (Next Session)

1. **Create `mcpCulturalCompetencyClient.ts`** — Follow the existing client pattern. Export typed functions for all 8 tools. Add to `mcp/index.ts` exports.

### Short-Term (Next 2-3 Sessions)

2. **Implement chain retry logic** — Add exponential backoff in `chainEngine.ts` for failed steps with `max_retries > 0`.
3. **Standardize error codes** — Create `mcpErrors.ts` with shared error code enum and response builder.

### Medium-Term (When Convenient)

4. **Chain definition admin UI** — Visual editor for creating/editing chain definitions.
5. **Unified cost dashboard** — Aggregate `mcp_cost_metrics` + `mcp_audit_logs` into a single view.
6. **Parallel chain steps** — Detect independent steps and execute concurrently.

### Future (6+ Months)

7. **Event-driven chains** — Replace HTTP polling with Supabase Realtime pub/sub for step completion.
8. **MCP server registry** — Discover servers by capability, route to healthy instances.

---

## Quick Reference Tables

### All Servers at a Glance

| # | Server | Tier | Tools | Client | Scope | Status |
|---|--------|------|-------|--------|-------|--------|
| 1 | mcp-claude-server | 3 | 4 | mcpClient.ts | — | Production |
| 2 | mcp-postgres-server | 3 | 5 | mcpPostgresClient.ts | — | Production |
| 3 | mcp-edge-functions-server | 3 | 5 | mcpEdgeFunctionsClient.ts | — | Production |
| 4 | mcp-medical-codes-server | 1 | 10 | mcpMedicalCodesClient.ts | — | Production |
| 5 | mcp-fhir-server | 3 | 15 | mcpFHIRClient.ts | mcp:fhir | Production |
| 6 | mcp-hl7-x12-server | 2 | 10 | mcpHL7X12Client.ts | — | Production |
| 7 | mcp-clearinghouse-server | 2 | 10 | mcpClearinghouseClient.ts | — | Production |
| 8 | mcp-prior-auth-server | 3 | 12 | mcpPriorAuthClient.ts | mcp:prior_auth | Production |
| 9 | mcp-cms-coverage-server | 1 | 9 | mcpCMSCoverageClient.ts | — | Production |
| 10 | mcp-npi-registry-server | 1 | 9 | mcpNPIRegistryClient.ts | — | Production |
| 11 | mcp-pubmed-server | 1 | 7 | mcpPubMedClient.ts | — | Production |
| 12 | mcp-cultural-competency-server | 2 | 9 | **Missing** | — | Gap |
| 13 | mcp-medical-coding-server | 3 | 11 | mcpMedicalCodingClient.ts | — | Production |
| 14 | mcp-chain-orchestrator | 3 | 5 routes | chainOrchestrationService.ts | mcp:admin | Production |

### Rate Limits

| Server | Requests/min | Rationale |
|--------|-------------|-----------|
| claude | 15 | Expensive AI API calls |
| clearinghouse | 20 | External EDI API |
| fhir | 30 | Large bundle operations |
| medical_coding | 30 | AI + DB writes |
| chain_orchestrator | 30 | Multi-step pipelines |
| prior_auth | 40 | Admin workflow |
| hl7x12 | 40 | Message transformation |
| postgres | 60 | Trusted internal queries |
| pubmed | 60 | External research API |
| npi_registry | 100 | Fast external lookups |
| medical_codes | 100 | Fast code lookups |
| cms_coverage | 100 | Fast coverage lookups |

### Cross-Server Data Flows

| Flow | Servers Involved | Mechanism |
|------|-----------------|-----------|
| Claims Pipeline | Medical Codes → CMS Coverage → Prior Auth → HL7/X12 → Clearinghouse | Chain Orchestrator |
| Revenue Pipeline | Medical Coding (6 internal steps) | Chain Orchestrator |
| Provider Registration | NPI Registry → FHIR | Client-side mapper |
| AI Clinical Skills | Claude + Cultural Competency + FHIR | Edge function composition |
| Code Suggestion | Medical Codes + Claude | Internal to medical-codes-server |

---

## Verdict: Are They in Good Shape?

**Yes.** The MCP infrastructure is enterprise-grade for a platform at this stage. The key strengths:

- **Well-separated domains** — each server owns one concern, no god-servers
- **Consistent patterns** — same auth/rate-limit/validate/audit pipeline everywhere
- **Defense in depth** — 7 security layers, graceful degradation at every level
- **Healthcare-compliant** — HIPAA audit trails, advisory-only AI, approval gates
- **Extensible** — adding a new server follows a proven template, chain orchestrator can compose any combination

The drawbacks are real but minor — a missing browser client, unimplemented retry logic, and a placeholder clearinghouse step. None of these are architectural flaws; they're incomplete features that follow the established patterns when built.

The chain orchestrator is the architectural highlight — it solves cross-server communication cleanly without creating coupling between servers. Each server remains independent; the orchestrator handles sequencing, data mapping, and human-in-the-loop approval.
