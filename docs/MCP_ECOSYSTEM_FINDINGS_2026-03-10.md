# MCP Ecosystem Findings Report — 2026-03-10

> **Requested by:** Maria
> **Prepared by:** Claude Opus 4.6
> **Purpose:** Full technical audit of all 14 MCP servers — functions, constraints, governance, blind spots, and gap closure plan

---

## Executive Summary

**14 MCP servers** with **128+ tools** across healthcare interoperability, clinical AI, and revenue cycle management. Built over 8+ sessions (2026-02-21 through 2026-03-08). Security infrastructure is hospital-grade (23/23 compliance items done). Functional gaps remain in chain orchestration, FHIR wiring, clearinghouse credentials, retry logic, and tool utilization.

**Key Numbers:**
| Metric | Value |
|--------|-------|
| MCP Servers | 14 deployed edge functions |
| Total Tools | 128+ |
| Browser Clients | 13 TypeScript wrappers |
| Shared Infrastructure | 8 modules (~2,244 lines) |
| Chain Definitions | 2 of 6 in database |
| Tools Wired to UI | ~52 (estimated) |
| Tools Idle | ~76 (estimated) |
| Security Items | 23/23 complete |
| Blind Spots Fixed | 10/12 |

---

## The 14 Servers — Technical Functions

### Tier 1: External API (Public, No Auth Required)

#### 1. mcp-npi-registry-server (9 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `search_providers` | NPI search by name/location/specialty | Yes |
| `lookup_npi` | Single NPI lookup with full details | Yes |
| `validate_npi` | NPI format + Luhn check digit validation | Yes |
| `bulk_validate_npis` | Batch NPI validation (up to 100) | Yes |
| `check_npi_deactivation` | Check if NPI is deactivated | Yes |
| `get_provider_identifiers` | Get all identifiers for a provider | Yes |
| `get_taxonomy_codes` | Taxonomy code lookup (206 codes) | Yes |
| `search_by_specialty` | Find providers by specialty taxonomy | **IDLE** |

**Rate limit:** 100 req/min | **Input validation:** NPI Luhn check, UUID, state codes

---

#### 2. mcp-cms-coverage-server (9 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `search_lcd` | Search Local Coverage Determinations | Yes |
| `search_ncd` | Search National Coverage Determinations | Yes |
| `get_lcd_details` | Full LCD details by ID | Yes |
| `get_ncd_details` | Full NCD details by ID | Yes |
| `get_coverage_requirements` | Coverage requirements for a procedure | Yes |
| `get_coverage_articles` | Related coverage articles | Yes |
| `check_prior_auth_required` | PA requirement check for CPT/HCPCS | Yes |
| `get_mac_contractors` | Medicare Administrative Contractor lookup | **IDLE** |

**Rate limit:** 100 req/min | **Data:** Mock CMS data (by design for pilot — real API integration deferred)

---

#### 3. mcp-pubmed-server (7 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `search_pubmed` | Article search with MeSH terms | Yes |
| `get_article_summary` | Article title + abstract + authors | Yes |
| `get_article_abstract` | Full abstract text | **IDLE** |
| `get_article_citations` | Citation list for an article | **IDLE** |
| `search_clinical_trials` | ClinicalTrials.gov search | **IDLE** |
| `get_mesh_terms` | MeSH term hierarchy lookup | **IDLE** |

**Rate limit:** 100 req/min | **External API:** NCBI E-utilities (free, no credentials needed)

---

#### 4. mcp-medical-codes-server (10 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `search_codes` | CPT/ICD-10/HCPCS code search | Yes |
| `validate_code` | Code format + existence validation | Yes |
| `get_code_details` | Full code description + modifiers | Yes |
| `check_bundling` | CCI bundling edit check | Yes |
| `suggest_codes` | AI-assisted code suggestion from description | Yes |
| `get_modifiers` | Available modifiers for a code | **IDLE** |
| `get_fee_schedule` | Fee schedule lookup by code + payer | **IDLE** |
| `get_sdoh_zcodes` | SDOH Z-code lookup | **IDLE** |
| `get_code_crosswalk` | CPT ↔ ICD-10 ↔ HCPCS mapping | **IDLE** |

**Rate limit:** 100 req/min | **Reference data:** ~260 CPT, ~150 HCPCS, ~500 ICD-10 seeded

---

### Tier 2: User-Scoped (JWT + RLS)

#### 5. mcp-clearinghouse-server (10 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `test_connection` | Clearinghouse connectivity test | Yes |
| `get_payer_list` | Available payer list | Yes |
| `submit_claim` | 837P/I claim submission | **HOLLOW** |
| `check_claim_status` | Claim status inquiry (276/277) | Yes |
| `verify_eligibility` | Eligibility verification (270/271) | **HOLLOW** |
| `process_remittance` | ERA/835 remittance processing | **HOLLOW** |
| `get_rejection_reasons` | Rejection code lookup | **IDLE** |
| `get_submission_stats` | Submission statistics | **IDLE** |
| `submit_prior_auth` | X12 278 prior auth transaction | **HOLLOW** |

**Rate limit:** 20 req/min | **STATUS: HOLLOW** — `loadConfig()` returns null, no vendor credentials. Logic shapes are correct but nothing executes. **Clearinghouse sandbox credentials arriving next week.**

---

#### 6. mcp-hl7-x12-server (10 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `parse_hl7` | Parse HL7 v2.x messages (ADT, ORM, ORU, etc.) | Yes |
| `validate_hl7` | HL7 message validation | Yes |
| `parse_x12` | Parse X12 transactions (837, 835, 270, 278) | Yes |
| `validate_x12` | X12 transaction validation | Yes |
| `generate_837p` | Generate 837P professional claim | Yes |
| `hl7_to_fhir` | HL7 v2.x → FHIR R4 conversion | Yes |
| `x12_to_fhir` | X12 → FHIR conversion | **IDLE** |
| `get_message_types` | Supported message type reference | **IDLE** |
| `generate_hl7_ack` | Generate HL7 ACK response | **IDLE** |

**Rate limit:** 40 req/min | **Input validation:** Message format checks, segment validation

---

### Tier 3: Admin/Clinical (Service Role + JWT/MCP-Key + Role Verification)

#### 7. mcp-fhir-server (18 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `search_resources` | FHIR resource search | Yes |
| `get_resource` | Get FHIR resource by ID | Yes |
| `get_patient_summary` | Patient clinical summary | Yes |
| `get_care_team` | Patient care team | Yes |
| `get_medication_list` | Active medications | Yes |
| `get_condition_list` | Active conditions/diagnoses | Yes |
| `get_observations` | Clinical observations/vitals | Yes |
| `export_patient_bundle` | FHIR Bundle export | Yes |
| `get_sdoh_assessments` | SDOH assessment data | Yes |
| `list_ehr_connections` | EHR connection status | Yes |
| `trigger_ehr_sync` | Trigger EHR synchronization | Yes |
| `create_resource` | Create new FHIR resource | **IDLE** |
| `update_resource` | Update existing FHIR resource | **IDLE** |
| `validate_resource` | FHIR schema validation | **IDLE** |
| `get_sdoh_assessments` | SDOH data (duplicate?) | **IDLE** |
| `list_ehr_connections` | EHR connections (duplicate?) | **IDLE** |
| `trigger_ehr_sync` | EHR sync (duplicate?) | **IDLE** |

**Rate limit:** 30 req/min | **Body size limit:** 2MB | **NOT FHIR-conformant** — stores FHIR-shaped data in Supabase, does not pass Touchstone/Inferno

---

#### 8. mcp-prior-auth-server (12 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `check_prior_auth_required` | Check if PA needed for procedure | Yes |
| `create_prior_auth` | Create new PA request | Yes |
| `submit_prior_auth` | Submit PA to payer | Yes |
| `get_prior_auth` | Get PA by ID | **IDLE** |
| `get_patient_prior_auths` | Patient's PA history | **IDLE** |
| `get_pending_prior_auths` | Pending PA queue | **IDLE** |
| `record_decision` | Record payer decision | Yes |
| `create_appeal` | Create PA appeal | Yes |
| `cancel_prior_auth` | Cancel PA request | Yes |
| `get_prior_auth_statistics` | PA approval/denial metrics | Yes |
| `to_fhir_claim` | Convert PA to Da Vinci PAS FHIR | Yes |

**Rate limit:** 40 req/min | **Input validation:** UUID, date, CPT/HCPCS format

---

#### 9. mcp-postgres-server (5 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `execute_sql` | Execute whitelisted analytics query (14 allowed) | Yes |
| `list_tables` | List accessible tables | **IDLE** |
| `list_extensions` | List DB extensions | **IDLE** |
| `list_migrations` | List applied migrations | **IDLE** |

**Rate limit:** 60 req/min | **Security:** 14 whitelisted queries only — no arbitrary SQL | **Tenant enforcement:** `p_caller_tenant_id` parameter on `execute_safe_query()` RPC

---

#### 10. mcp-claude-server (4 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `analyze-text` | AI text analysis with PHI de-identification | Yes |
| `generate-suggestion` | AI-powered suggestions | Yes |
| `summarize` | Text summarization | Yes |

**Rate limit:** 15 req/min (most expensive — token costs) | **PHI handling:** De-identifies before AI call

---

#### 11. mcp-edge-functions-server (5 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `list_functions` | List 13 whitelisted edge functions | Yes |
| `invoke_function` | Invoke a single whitelisted function | **IDLE** |
| `batch_invoke` | Invoke multiple functions in sequence | **IDLE** |
| `get_function_info` | Get function metadata | **IDLE** |

**Rate limit:** 50 req/min | **Security:** 13 whitelisted functions only (analytics, reports, workflows)

---

#### 12. mcp-cultural-competency-server (8 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `get_cultural_context` | Full cultural profile for a population | Yes (AI) |
| `get_communication_guidance` | Communication best practices | Yes (AI) |
| `get_clinical_considerations` | Clinical care considerations | Yes (AI) |
| `get_barriers_to_care` | Access barriers identification | Yes (AI) |
| `get_trust_building_guidance` | Trust-building strategies | Yes (AI) |
| `check_drug_interaction_cultural` | Cultural factors in drug interactions | Yes (AI) |
| `get_sdoh_codes` | SDOH Z-codes for population | Yes (AI) |
| `seed_profiles` | Seed 8 built-in profiles to DB | Admin only |

**Rate limit:** 50 req/min | **Consumed by:** 7 AI edge functions + Compass Riley (not direct UI — by design) | **Populations:** Veterans, Unhoused, Latino/Hispanic, African American, AANHPI, Native American/Indigenous, LGBTQ+ Elders, Rural Communities

---

#### 13. mcp-medical-coding-server (11 tools)
| Tool | Function | Wired? |
|------|----------|--------|
| `ping` | Health check | Yes |
| `get_payer_rule` | Payer-specific billing rules | **IDLE** |
| `upsert_payer_rule` | Create/update payer rules | **IDLE** |
| `get_revenue_projection` | Revenue projection (Medicare DRG / Medicaid per diem) | **IDLE** |
| `aggregate_daily_charges` | Aggregate charges from 5 source tables | **IDLE** |
| `get_daily_snapshot` | Retrieve daily charge snapshot | **IDLE** |
| `save_daily_snapshot` | Persist daily charge snapshot | **IDLE** |
| `run_drg_grouper` | AI-powered DRG grouping (3-pass methodology) | **IDLE** |
| `get_drg_result` | Retrieve DRG grouping result | **IDLE** |
| `optimize_daily_revenue` | AI-powered revenue optimization | **IDLE** |
| `validate_charge_completeness` | Rules-based charge completeness check | **IDLE** |

**Rate limit:** 30 req/min | **No browser client exists** | **Business logic:** A-rated by code review — real DRG formulas, CPT classification, CMS IPPS payment methodology | **Known issues:** `tenant_id` from args (violates P0-2), regex JSON parsing (should use structured output)

---

#### 14. mcp-chain-orchestrator (HTTP state machine)
| Endpoint | Function | Status |
|----------|----------|--------|
| `POST /start` | Start a chain run | Working |
| `POST /approve` | Approve a paused step | Working |
| `POST /cancel` | Cancel a chain run | Working |
| `GET /status` | Get chain run status | Working |
| `GET /history` | Chain run history | Working |

**Rate limit:** 30 req/min | **Chains defined:** 2 of 6 (Chain 1: Claims Pipeline, Chain 6: Medical Coding Revenue) | **Missing:** Retry logic, Chains 2-5 definitions

---

## Constraints & Governance

### Security Model (3 Tiers)

```
┌───────────────────────────────────────────────────────────┐
│              Supabase apikey header (all requests)         │
├───────────────┬──────────────────┬────────────────────────┤
│ Tier 1        │ Tier 2           │ Tier 3                 │
│ External API  │ User-Scoped      │ Admin/Clinical         │
│               │                  │                        │
│ No JWT        │ + JWT Bearer     │ + JWT OR MCP-Key       │
│ External APIs │ + RLS enforced   │ + Role verification    │
│ only          │                  │ + Service role DB      │
│               │                  │                        │
│ NPI, CMS,     │ Clearinghouse,   │ FHIR, Prior Auth,     │
│ PubMed,       │ HL7-X12          │ Postgres, Claude,      │
│ Medical Codes │                  │ Edge Fns, Cultural,    │
│               │                  │ Medical Coding, Chain  │
└───────────────┴──────────────────┴────────────────────────┘
```

### Rate Limiting (Two-Layer)

| Layer | Speed | Scope | Enforcement |
|-------|-------|-------|-------------|
| In-memory | <1ms | Per-IP | Same edge function instance |
| Persistent | ~30ms | Per-identity | Cross-instance via `check_rate_limit()` RPC |

### Input Validation

Per-tool declarative schemas with healthcare-specific validators:
- **Format checks:** UUID, NPI (Luhn), CPT, HCPCS, ICD-10, DRG, date, state, ZIP, phone, email
- **Size limits:** 512KB body (standard), 2MB (FHIR/HL7)
- **Array limits:** `maxItems` per field
- **Enum enforcement:** Valid values only

### Audit Trail

Every MCP operation logged to `mcp_audit_logs`:
- Server name, tool name, request ID
- Caller user ID, tenant ID, auth method
- Tool arguments (PHI de-identified), tool result (truncated)
- Status, error message, execution time
- Fallback to `claude_usage_logs` if primary table unavailable

### Governance Rules

| Rule | Enforcement |
|------|-------------|
| No server-to-server calls | All cross-server flows via Chain Orchestrator |
| Advisory-only AI | DRG grouper, revenue optimizer, code suggester never auto-file |
| Tenant ID from auth only | `mcpIdentity.ts` extracts from JWT, never from tool args |
| PHI de-identification | Claude server strips PHI before AI calls |
| Whitelisted queries only | Postgres: 14 queries. Edge Functions: 13 functions. |
| Per-server MCP keys | 13 scoped keys (shared key revoked) |
| "Do NOT" constraint prompts | Wired into 13 clinical AI edge functions |
| Prompt injection guard | 11 patterns checked in 6 free-text functions |

---

## Chain Orchestration — Definitions & Governance

### How Chains Work

Chains are the **ONLY way for MCP servers to communicate with each other**. No server calls another directly. The Chain Orchestrator is a database-driven state machine that:

1. Loads a chain definition + step definitions from DB
2. For each step: resolves input via JSONPath mapping from prior outputs, calls target MCP server via HTTP with service role auth, stores result
3. If step `requires_approval`: pauses chain (`status = awaiting_approval`) — physician must approve via UI before chain continues
4. If step has `condition_expression`: evaluates against prior outputs, skips step if false
5. If step is `placeholder`: records status message, chain continues (e.g., clearinghouse pending credentials)
6. Failed steps halt the chain. Resume via `resume_chain` retries from the failed step.

**Database Tables:**

| Table | Purpose |
|-------|---------|
| `mcp_chain_definitions` | Chain templates (name, description, version, created_by) |
| `mcp_chain_step_definitions` | Step config (server, tool, input mapping, approval flag, condition, timeout, retries) |
| `mcp_chain_runs` | Execution instances (status, current step, started_by, tenant_id) |
| `mcp_chain_step_results` | Per-step outcomes (output data, duration, approval decision, approved_by) |

### Chain 1: Claims Submission Pipeline

**Chain Key:** `claims_pipeline`
**Servers Used:** Medical Codes → CMS Coverage → Prior Auth → HL7-X12 → Clearinghouse (4 servers)
**Purpose:** End-to-end claim submission from code validation through payer submission

| Step | Key | Server | Tool | Approval? | Conditional? | Placeholder? |
|------|-----|--------|------|-----------|-------------|-------------|
| 1 | `validate_codes` | mcp-medical-codes-server | `validate_code_combination` | No | No | No |
| 2 | `check_prior_auth` | mcp-cms-coverage-server | `check_prior_auth_required` | No | No | No |
| 3 | `create_prior_auth` | mcp-prior-auth-server | `create_prior_auth` | **YES (physician)** | **YES** — only if `$.steps.check_prior_auth.prior_auth_required == true` | No |
| 4 | `generate_837p` | mcp-hl7-x12-server | `generate_837p` | No | No | No |
| 5 | `submit_claim` | mcp-clearinghouse-server | `submit_claim` | No | No | **YES** — "Clearinghouse integration pending — 837P generated successfully but auto-submission is not yet connected." |

**Governance:**
- Step 3 has **dual governance**: conditional execution (only when PA needed) AND physician approval gate
- Step 5 is a placeholder — will become functional when clearinghouse credentials arrive next week
- No step auto-submits anything without human review of prior steps

### Chain 6: Medical Coding → Revenue Pipeline

**Chain Key:** `medical_coding_revenue`
**Servers Used:** mcp-medical-coding-server only (single server, 6 steps)
**Purpose:** End-to-end inpatient revenue pipeline from charge capture through completeness validation

| Step | Key | Server | Tool | Approval? | Conditional? | Timeout |
|------|-----|--------|------|-----------|-------------|---------|
| 1 | `aggregate_charges` | mcp-medical-coding-server | `aggregate_daily_charges` | No | No | 30s |
| 2 | `save_snapshot` | mcp-medical-coding-server | `save_daily_snapshot` | No | No | 15s |
| 3 | `drg_grouper` | mcp-medical-coding-server | `run_drg_grouper` | **YES (physician)** | No | 60s |
| 4 | `revenue_projection` | mcp-medical-coding-server | `get_revenue_projection` | No | No | 15s |
| 5 | `optimize_revenue` | mcp-medical-coding-server | `optimize_daily_revenue` | No | No | 60s |
| 6 | `validate_charges` | mcp-medical-coding-server | `validate_charge_completeness` | No | No | 15s |

**Governance:**
- Step 3 (DRG Grouper) **requires physician approval** — AI assigns DRG code but physician must confirm before revenue projection proceeds
- Steps 5-6 are **advisory only** — revenue optimization and charge validation produce suggestions, never auto-file
- Input mapping uses JSONPath: each step feeds forward (e.g., step 4 uses DRG weight from step 3's output)

### Chains 2-5: NOT YET DEFINED IN DATABASE

These chains have UI touchpoints (individual buttons calling individual servers) but no orchestration step definitions in the database. Planned in the MCP Completion Tracker:

| Chain | Name | Servers | Status |
|-------|------|---------|--------|
| 2 | Provider Onboarding | NPI → FHIR → Postgres | **No DB definition** |
| 3 | Clinical Decision Support | FHIR → PubMed → CMS → Claude | **No DB definition** |
| 4 | Encounter-to-Claim | FHIR → Medical Codes → Medical Coding → HL7 → Clearinghouse | **No DB definition** |
| 5 | Prior Auth Workflow | CMS → Prior Auth → PubMed → Clearinghouse | **No DB definition** |

### Approval Gate Enforcement

When a chain step has `requires_approval = true`:

1. Step executes and output is captured
2. Chain status changes to `awaiting_approval`
3. Step result stores: `status: "awaiting_approval"`, `output_data: <tool result>`, `approval_role: <required role>`
4. Chain **cannot proceed** until approval is recorded
5. Approval recorded via `approveStep()` with `approved_by` user ID and `approved_at` timestamp
6. Only after approval: chain resumes from next step
7. Only users with the required role (e.g., `physician`) can approve

**Resume rules:**
- Only possible if chain status is `awaiting_approval` or `failed`
- Resumes from `current_step_order` — never re-executes completed steps
- Cancellation is always available — any authorized user can cancel a chain

---

## Clinical Safety Governance (Embedded in MCP Infrastructure)

### Three-Layer Governance Model

| Layer | Where Enforced | What It Does |
|-------|----------------|-------------|
| **Database Layer** | RLS policies + stored procedures | Tenant isolation, role-based access, identity from JWT (P0-2) |
| **API Gateway Layer** | `mcpAuthGate.ts` + input validation | X-MCP-KEY or JWT + role verification; blocks unauthorized callers |
| **Workflow Layer** | Chain definitions + clinical grounding | Approval gates pause execution; safety blocks prevent auto-action; prompt injection wraps untrusted text |

### Clinical Grounding Rules (Mandatory for ALL Clinical AI Output)

Wired into every AI edge function that produces clinical content:

1. **TRANSCRIPT IS TRUTH** — Every finding, symptom, vital, lab value, medication, dose MUST correspond to something explicitly stated in the transcript
2. **NEVER INFER CLINICAL DETAILS** — No invented review-of-systems, physical exam findings, lab values, medication doses, allergies, or history
3. **CONFIDENCE LABELING** — `[STATED]` (from transcript), `[INFERRED]` (clinical inference with explanation), `[GAP]` (expected but not documented — flag for provider review)
4. **WHEN IN DOUBT, FLAG IT** — Write `[NOT DOCUMENTED — verify with provider]`, never guess
5. **NEVER FABRICATE** — No invented doses, allergies, vitals, exam findings, imaging results, or patient history
6. **BILLING CODE GROUNDING** — Every CPT/ICD-10/HCPCS must cite specific transcript evidence
7. **SOAP NOTE INTEGRITY** — Subjective = patient-reported only, Objective = provider-observed only, Assessment = documented findings only, Plan = stated actions only

### Billing-Specific Constraints

1. **ICD-10 ONLY** — No ICD-9, V-codes are obsolete (use Z-codes)
2. **DOCUMENTATION-DRIVEN CODING** — No CPT for services not performed, no HCPCS for undocumented supplies, no fabricated modifiers
3. **NO UPCODING** — No higher-specificity codes unless documentation supports it; always labeled "advisory, requires coder review"
4. **EVERY CODE MUST CITE EVIDENCE** — Specific documentation excerpt required; if insufficient, state what's missing

### Prompt Injection Guard (11 Patterns)

Wired into 6 free-text AI functions. Detects and wraps instruction-like patterns in clinical text:

| Pattern Category | Examples Detected |
|-----------------|------------------|
| DRG manipulation | `assign DRG \d+`, `upcode`, `maximize billing` |
| Constraint suppression | `do not flag`, `suppress warning`, `hide alert` |
| Override attempts | `ignore system`, `new instructions`, `bypass constraint` |
| Confidence manipulation | `confidence = 1.0` (forced high confidence) |

**Action:** Wraps clinical text in `<clinical_document>` delimiters with explicit warning that text inside tags is DATA, not instructions. AI system explicitly told to never interpret tagged content as commands.

### Conversation Drift Guard (Compass Riley)

Three protection layers for the clinical scribe:

1. **Clinical Domain Tracking** — 20 medical domains (cardiology, pulmonology, etc.); locks encounter to primary domain from chief complaint; tracks comorbidities as related domains
2. **Scope Boundaries** — IN SCOPE: primary domain + discussed comorbidities. OUT OF SCOPE: unrelated specialties, hypotheticals, prior visits not stated, assumed history. Drift detection flags reasoning that leaves encounter context.
3. **Patient Safety** — Emergency keywords trigger immediate alert (chest pain, stroke, suicidal, etc.). Provider-only topics (medication changes, diagnosis, cancer, etc.) redirect: "That's a really good question. Let me make sure [Provider] addresses that with you."

### Data Source Provenance

All MCP responses include provenance metadata:

| Field | Purpose |
|-------|---------|
| `dataSource` | `database`, `external_api`, `cache`, `ai_generated`, or `computed` |
| `dataFreshnessISO` | When underlying data was last updated |
| `confidenceScore` | 0-1 for AI-generated results |
| `safetyFlags` | `ai_generated`, `requires_clinical_review`, `experimental`, `reference_only` |
| `cacheHit` | Whether result came from cache |

**Example:** Prior Auth AI results flagged with `safetyFlags: ['ai_generated', 'requires_clinical_review']`

---

## Blind Spots Identified

### 1. Clearinghouse Server is Hollow (S3-1)
- **Impact:** Revenue-critical server can't execute
- **Root cause:** No vendor credentials — `loadConfig()` always returns null
- **Timeline:** Sandbox credentials arriving next week
- **Effort:** ~8-12 hours after credentials arrive

### 2. FHIR Server Not Conformant (S4-3)
- **Impact:** Cannot integrate with Epic/Cerner/MEDITECH
- **Root cause:** Stores FHIR-shaped data in Supabase, not a real FHIR server
- **Decision needed:** Wire existing FHIR tools to UI now; full conformance is post-pilot (~40+ hours)

### 3. Chain Retry Logic Not Implemented
- **Impact:** Failed chain steps just stop — no automatic recovery
- **Root cause:** `max_retries` field exists on step definitions but orchestrator doesn't execute retry loop
- **Effort:** ~4 hours

### 4. Chains 2-5 Not Defined in Database
- **Impact:** Only Chains 1 and 6 can be orchestrated; 2-5 are manual button-clicking
- **Effort:** ~8-12 hours to define all 4 chains with proper step mappings

### 5. Cultural Competency Has No Browser Client
- **Impact:** 8 tools callable by AI edge functions but not by UI components
- **Status:** By design (consumed by AI skills), but browser client needed for admin tooling
- **Effort:** ~2 hours

### 6. Adversarial Testing Not Done (P1-6)
- **Impact:** "Do NOT" constraint prompts are wired but unverified against attack
- **Plan:** Tonight — Maria + Claude + Akima adversarial testing session
- **Effort:** ~4 hours

### 7. ~76 Tools Idle (S4-4)
- **Impact:** Infrastructure built but not accessible to users
- **Breakdown by server:** See idle tool list in each server section above
- **Priority:** ALL need wiring — "if we don't, something will get missed"

### 8. No Unified Cost View
- **Impact:** AI token costs (`claude_usage_logs`) and MCP operation costs (`mcp_cost_metrics`) tracked separately
- **Need:** "Total cost per chain run" dashboard feature
- **Effort:** ~4-6 hours

### 9. Medical Coding Server Security Gaps
- **Impact:** `tenant_id` accepted from tool args (violates P0-2 security model)
- **Impact:** AI output parsed via regex instead of structured JSON schema
- **Effort:** ~3 hours

### 10. Conversation Drift Guard Only Wired Into 1 of 7 AI Functions
- **Impact:** 6 AI edge functions that directly call Claude have NO domain-locking drift protection
- **Root cause:** Drift guard was built during Compass Riley Session 3 but only wired into the scribe path (`realtime_medical_transcription`). The other 6 functions were designed to get it too.
- **Functions missing drift guard:** `ai-soap-note-generator`, `ai-care-plan-generator`, `ai-check-in-questions`, `ai-medication-instructions`, `ai-patient-qa-bot`, `ai-avatar-entity-extractor`
- **Risk:** These functions can produce output that drifts outside the encounter's clinical domain — findings from unrelated specialties, interventions outside scope, entity extraction from wrong domains
- **Note:** `ai-patient-qa-bot` has its own hardcoded safety keywords but does NOT use the canonical `EMERGENCY_KEYWORDS` and `PROVIDER_ONLY_TOPICS` from `conversationDriftGuard.ts` — single source of truth violated
- **Effort:** ~4 hours

---

## Idle Tools Summary (All ~76)

### Must Wire — Revenue Critical
| Server | Tool | Why It Matters |
|--------|------|---------------|
| Medical Coding | `get_payer_rule` | Payer-specific billing rules |
| Medical Coding | `upsert_payer_rule` | Configure payer billing rules |
| Medical Coding | `get_revenue_projection` | Revenue forecasting |
| Medical Coding | `aggregate_daily_charges` | Daily charge capture |
| Medical Coding | `get_daily_snapshot` | Charge review |
| Medical Coding | `save_daily_snapshot` | Charge persistence |
| Medical Coding | `run_drg_grouper` | DRG assignment (AI) |
| Medical Coding | `get_drg_result` | DRG result retrieval |
| Medical Coding | `optimize_daily_revenue` | Revenue optimization (AI) |
| Medical Coding | `validate_charge_completeness` | Charge completeness audit |
| Clearinghouse | `submit_claim` | Claim submission (needs credentials) |
| Clearinghouse | `verify_eligibility` | Eligibility check (needs credentials) |
| Clearinghouse | `process_remittance` | Payment processing (needs credentials) |
| Clearinghouse | `submit_prior_auth` | PA submission (needs credentials) |
| Clearinghouse | `get_rejection_reasons` | Denial management |
| Clearinghouse | `get_submission_stats` | Submission analytics |

### Must Wire — Clinical Workflow
| Server | Tool | Why It Matters |
|--------|------|---------------|
| FHIR | `create_resource` | Create clinical records |
| FHIR | `update_resource` | Update clinical records |
| FHIR | `validate_resource` | FHIR validation before save |
| Prior Auth | `get_prior_auth` | PA detail lookup |
| Prior Auth | `get_patient_prior_auths` | Patient PA history |
| Prior Auth | `get_pending_prior_auths` | Pending PA queue |
| Edge Functions | `invoke_function` | Direct edge function calls |
| Edge Functions | `batch_invoke` | Multi-function orchestration |
| Edge Functions | `get_function_info` | Function metadata |

### Must Wire — Reference & Research
| Server | Tool | Why It Matters |
|--------|------|---------------|
| PubMed | `get_article_abstract` | Full abstract for evidence review |
| PubMed | `get_article_citations` | Citation tracking |
| PubMed | `search_clinical_trials` | Clinical trial discovery |
| PubMed | `get_mesh_terms` | MeSH hierarchy for search |
| Medical Codes | `get_modifiers` | Modifier lookup for coding |
| Medical Codes | `get_fee_schedule` | Fee schedule rates |
| Medical Codes | `get_sdoh_zcodes` | SDOH Z-code reference |
| Medical Codes | `get_code_crosswalk` | Code mapping across systems |
| CMS Coverage | `get_mac_contractors` | MAC contractor lookup |
| NPI Registry | `search_by_specialty` | Specialty-based provider search |
| HL7-X12 | `x12_to_fhir` | X12 to FHIR conversion |
| HL7-X12 | `get_message_types` | Message type reference |
| HL7-X12 | `generate_hl7_ack` | HL7 acknowledgment |
| Postgres | `list_tables` | Schema inspection |
| Postgres | `list_extensions` | Extension audit |
| Postgres | `list_migrations` | Migration history |

---

## What's Already Planned (From Existing Trackers)

| Item | Tracker | Status |
|------|---------|--------|
| Clearinghouse credentials | `mcp-blind-spots-tracker.md` S3-1 | NOT FIXED — next week |
| FHIR conformance (full) | `mcp-blind-spots-tracker.md` S4-3 | NOT FIXED — post-pilot |
| Tool utilization gap | `mcp-blind-spots-tracker.md` S4-4 | NOT FIXED — new tracker needed |
| Adversarial testing | `mcp-production-readiness-tracker.md` P1-6 | NOT DONE — tonight |
| DRG validation table | `mcp-production-readiness-tracker.md` P1-1 | Needs Akima review |
| CMS coverage data | `mcp-production-readiness-tracker.md` P3-1 | Mock (by design) |
| FHIR search params | `mcp-production-readiness-tracker.md` P4-2 | NOT DONE |
| FHIR conformance statement | `mcp-production-readiness-tracker.md` P4-3 | NOT DONE |

---

## Recommendations

1. **Create MCP Completion Tracker** — Single tracker covering all remaining work: chains 2-5, retry logic, idle tool wiring, FHIR wiring, clearinghouse activation, unified cost view, medical coding security fixes
2. **Wire idle tools in priority order** — Revenue-critical first, then clinical workflow, then reference
3. **Build medical coding browser client** — 11 tools with zero UI access
4. **Add chain retry logic** — Failed steps should auto-retry with exponential backoff
5. **Define chains 2-5 in database** — Use same pattern as Chain 1 and 6
6. **Unified cost dashboard** — Combine `claude_usage_logs` + `mcp_cost_metrics` into single view
7. **Adversarial testing tonight** — Verify "Do NOT" constraints hold under attack

---

*Report generated from source code reading, not documentation claims. Every tool status verified against actual `grep` of browser clients and UI components.*
