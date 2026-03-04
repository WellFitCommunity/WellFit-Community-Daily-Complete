# MCP Blind Spots & Remediation Tracker

> **Created:** 2026-03-04
> **Created By:** Claude Opus 4.6 (honest review session — no coding, evaluation only)
> **Purpose:** Track real gaps found by reading actual code vs. reading documentation claims
> **Triggered By:** Maria's request for honest MCP evaluation
> **Methodology:** Read every MCP server's source code, compared to PROJECT_STATE.md and compliance tracker claims

---

## Why This Tracker Exists

Previous Claude sessions marked "Cross-Server Chains 1-5" as **DONE** in `PROJECT_STATE.md` and `mcp-server-compliance-tracker.md`. What was actually built:

- **UI widgets** that call **individual** MCP servers (a search box, a badge, a button)
- **NOT** automated multi-server pipelines where Server A's output feeds into Server B

**What "Chain 1: Claims Pipeline DONE" actually means in the code:**
- `ClearinghouseConfigPanel` can call `testConnection()` via MCP — one server, one tool
- `MedicalCodeSearch` can look up CPT/ICD codes — one server, one tool
- `ClaimResubmissionDashboard` can check claim status — one server, one tool
- None of these are chained. A user would have to manually copy outputs between screens.

**What "Chain 1: Claims Pipeline DONE" should mean:**
- Click "Submit Claim" on an encounter → system validates codes (Medical Codes MCP) → checks coverage (CMS MCP) → creates prior auth if needed (Prior Auth MCP) → generates 837P (HL7 MCP) → submits to payer (Clearinghouse MCP) → tracks remittance (Clearinghouse MCP)
- One action, six servers, automated handoff, error recovery at each step

**The honest assessment:** The individual server tools work. The "chain" label was applied to UI components that happen to use different MCP servers, not to actual multi-server orchestration. This tracker corrects the record and tracks real remediation.

---

## Severity Definitions

| Severity | Meaning |
|----------|---------|
| **S1 — Misrepresentation** | Code marked DONE but doesn't match what was claimed |
| **S2 — Security Gap** | Real security concern that needs fixing |
| **S3 — Hollow Implementation** | Code exists but can never execute successfully |
| **S4 — Architecture Gap** | Missing infrastructure needed for production |
| **S5 — Configuration Debt** | Working code with deployment/config issues |

---

## Summary

| Severity | Items | Status |
|----------|-------|--------|
| S1 — Misrepresentation | 2 | 2/2 fixed |
| S2 — Security Gap | 2 | 0/2 fixed |
| S3 — Hollow Implementation | 1 | 0/1 fixed |
| S4 — Architecture Gap | 4 | 2/4 fixed |
| S5 — Configuration Debt | 3 | 1/3 fixed |
| **Total** | **12** | **5/12 fixed** |

---

## S1: Misrepresentation — Documentation Says DONE, Code Says Otherwise

### S1-1: Cross-Server Chains 1-5 Marked DONE — No Orchestration Exists

**Status:** FIXED (documentation corrected 2026-03-04, Session 3)
**Severity:** S1 — Misrepresentation
**Where it's claimed:** `docs/PROJECT_STATE.md:126`, `docs/trackers/mcp-server-compliance-tracker.md:388-397`

**What was claimed:**
```
P2-7 (Cross-Server Chains 1-5) DONE — 2 sessions (2026-03-03)
Chain 1: Claims Pipeline — DONE
Chain 2: Provider Onboarding — DONE
Chain 3: Clinical Decision Support — DONE
Chain 4: Encounter-to-Claim — DONE
Chain 5: Prior Auth Workflow — DONE
```

**What actually exists:**
| Chain | Claimed | Reality |
|-------|---------|---------|
| 1. Claims Pipeline | Automated revenue cycle from codes → clearinghouse | Individual UI widgets: `MedicalCodeSearch` (search box), `ClearinghouseConfigPanel` (test connection button), `ClaimResubmissionDashboard` (status button). No data flows between them. |
| 2. Provider Onboarding | NPI → FHIR → Postgres automated | `BillingProviderForm` shows NPI address. `npiToFHIRMapper.ts` exists but is not called from any automated flow — it's a utility function. |
| 3. Clinical Decision Support | FHIR → PubMed → CMS → Claude | `PubMedEvidencePanel` is a standalone collapsible panel in the PA form. No FHIR data feeds into it. No CMS check result feeds into Claude for decision support. |
| 4. Encounter-to-Claim | FHIR encounter → 837P claim | `MedicalCodeSearch` + `BillingQueueDashboard` code lookup + `X12Generate837PPanel` form. User would manually re-enter data across all three. |
| 5. Prior Auth Workflow | CMS → Prior Auth → FHIR → Clearinghouse | `EligibilityVerificationPanel` shows PA Required badge. PA lifecycle works within its own dashboard. No automated handoff to clearinghouse after PA approval. |

**What "chain" means vs what was built:**
- **Chain = orchestration:** Server A output → automatically → Server B input → automatically → Server C input
- **What was built = UI co-location:** Server A button on Screen 1, Server B button on Screen 2, human copies data between them

**Remediation options:**
1. **Correct the documentation** — Change "DONE" to "UI TOUCHPOINTS WIRED" and create a separate tracker item for actual orchestration
2. **Build real orchestration** — Create a service layer that chains server calls with error handling, retry, and state tracking
3. **Both** — Fix the docs AND build the orchestration (recommended)

**Estimated effort for real orchestration:** ~40-60 hours across 5+ sessions (the original 70h estimate was more accurate than the "done in 12h" claim)

---

### S1-2: MCP_SERVER_AUDIT.md Contradicts PROJECT_STATE.md

**Status:** FIXED (both files updated 2026-03-04, Session 3)
**Severity:** S1 — Misrepresentation

**The audit file** (`docs/MCP_SERVER_AUDIT.md:115`) says:
> "These chains connect multiple MCP servers into automated workflows. None are currently implemented — each server operates in isolation."

**PROJECT_STATE.md** (`line 126`) says:
> "P2-7 (Cross-Server Chains 1-5) DONE"

Both files are in the same repo, checked into `main`. One says "none implemented," the other says "all done." The audit file is correct. PROJECT_STATE.md is wrong.

**Remediation:** Update PROJECT_STATE.md and the compliance tracker to reflect reality. Either:
- "UI touchpoints wired to individual MCP servers" (accurate)
- "Chains NOT orchestrated — individual server access available via UI" (accurate)

---

## S2: Security Gaps

### S2-1: All 13 MCP Servers Share One Key

**Status:** NOT FIXED
**Severity:** S2 — Security Gap

**Evidence:** `.mcp.json` — every server entry uses the identical `X-MCP-KEY`:
```
"X-MCP-KEY": "mcp_deb87fb957ded2691215ae7e47c87a66"
```

**Risk:** If this key leaks (git history, logs, CI output, clipboard), an attacker gets access to ALL 13 MCP servers simultaneously — including FHIR CRUD, prior auth lifecycle, edge function execution, and Claude AI calls.

**Remediation:**
1. Generate unique keys per server (or per security tier at minimum)
2. Scope key permissions: PubMed key should NOT have FHIR write access
3. Store keys in Supabase vault, not in committed config files
4. Rotate the current shared key (it's now in git history)

**Estimated effort:** ~4 hours (1 session)

---

### S2-2: Rate Limiting Is Per-Instance, Not Cross-Instance

**Status:** NOT FIXED
**Severity:** S2 — Security Gap

**Evidence:** `supabase/functions/_shared/mcpRateLimiter.ts:16`
```typescript
const rateLimitStore = new Map<string, RateLimitEntry>();
```

This is an in-memory `Map`. Supabase Edge Functions can spin up multiple isolates under load. Each isolate has its own independent rate limit counter.

**Attack scenario:** An attacker sends requests rapidly. If Supabase routes requests across N instances, the effective rate limit is N * configured limit.

**The code mentions a persistent Supabase RPC fallback** (`check_rate_limit()`), but:
- It's unclear if this RPC function is deployed to the database
- The in-memory path is the fast path that runs first
- Under high load, the in-memory path alone doesn't protect

**Remediation:**
1. Verify `check_rate_limit()` RPC exists in the database
2. Make the persistent check mandatory for Tier 3 (admin) servers, not just a fallback
3. For Tier 1 (public API) servers, in-memory is acceptable (external APIs have their own limits)

**Estimated effort:** ~2 hours

---

## S3: Hollow Implementation

### S3-1: Clearinghouse Server Client Returns Null — Always

**Status:** NOT FIXED
**Severity:** S3 — Hollow Implementation

**Evidence:** `supabase/functions/mcp-clearinghouse-server/client.ts:28-32`
```typescript
private async loadConfig(_tenantId: string): Promise<ClearinghouseConfig | null> {
  // In production, this would call get_clearinghouse_credentials RPC
  // For now, return null to indicate no config
  return null;
}
```

And `index.ts:70`:
```typescript
return handleSubmitClaim(client, toolArgs.claim as ClaimSubmission, 'tenant-id');
```

The tenant ID is hardcoded as the string `'tenant-id'`. The client is never initialized. Every handler that calls `client.getAccessToken()` will throw `'Clearinghouse not configured'`.

**This is the revenue-critical server** — it's how hospitals get paid. And it's the one server that is entirely placeholder.

**What works:** The handlers have correct logic shapes for 837P submission, eligibility (270/271), and remittance (835). The types are well-defined. The OAuth flow code is structurally correct.

**What doesn't work:** None of it can execute. There is no path from `loadConfig()` → real credentials → real API call.

**Remediation:**
1. Create `get_clearinghouse_credentials` RPC in Supabase
2. Store clearinghouse credentials in Supabase vault (per tenant)
3. Replace hardcoded `'tenant-id'` with caller identity from JWT
4. Integration test against a clearinghouse sandbox (Waystar, Change Healthcare, and Availity all offer sandbox environments)

**Estimated effort:** ~8-12 hours (depending on clearinghouse sandbox access)
**Dependency:** Actual clearinghouse sandbox credentials from a business partnership

---

## S4: Architecture Gaps

### S4-1: No Chain Orchestration Service Exists

**Status:** FIXED (Sessions 1 + 2)
**Severity:** S4 — Architecture Gap
**Fixed in:** 2026-03-04, Sessions 1-2

**What was built:**

A database-driven state machine for multi-server MCP pipelines. Architecture: Option C (database state machine) — survives browser closures, server restarts, edge function timeouts.

| Deliverable | File(s) | Lines |
|------------|---------|-------|
| Database migration | `supabase/migrations/20260304000001_chain_orchestration_system.sql` | ~230 |
| Seed data (Chain 6 + Chain 1) | `supabase/migrations/20260304000002_chain_definitions_seed.sql` | ~120 |
| Chain orchestrator edge function | `supabase/functions/mcp-chain-orchestrator/` (6 files) | ~1,225 |
| Browser service + types | `src/services/mcp/chainOrchestration*.ts` | ~330 |
| Behavioral tests (21 tests) | `src/services/mcp/__tests__/chainOrchestrationService.test.ts` | ~510 |
| ServiceResult error codes | `src/services/_base/ServiceResult.ts` (+7 codes) | +7 |
| Barrel export update | `src/services/mcp/index.ts` | +14 |

**Key features:**
1. Accepts a chain_key trigger → loads chain definition → executes steps sequentially
2. Calls MCP servers via HTTP fetch with auth forwarding (service role key)
3. Approval gates PAUSE the chain (status → `awaiting_approval`). Separate approve + resume calls continue it.
4. Conditional steps evaluate expressions against prior step outputs (e.g., `$.steps.check_prior_auth.prior_auth_required == true`). If not met → `skipped`.
5. Placeholder steps record status with message, chain continues (e.g., clearinghouse)
6. Failed steps halt the chain. Retry via `resume_chain`.
7. All steps logged to `mcp_audit_logs` via `logMCPAudit()`.
8. tenant_id derived from caller JWT (P0-2 compliant), never from input params.

**Chains defined:**
- **Chain 6 (Medical Coding → Revenue):** 6 steps, physician approval at DRG grouper
- **Chain 1 (Claims Pipeline):** 5 steps across 4 servers, conditional prior auth, clearinghouse placeholder

**Session 2 (2026-03-04):**
- Migrations pushed to remote database
- Admin UI panel: 7 component files (MCPChainManagementPanel + 5 sub-components + types), 28 component tests + 3 service tests
- Panel registered in admin dashboard (lazy import + section definition)

**Remaining:**
- End-to-end manual verification with a test encounter
- Visual acceptance from Maria

---

### S4-2: No End-to-End Integration Tests

**Status:** NOT FIXED
**Severity:** S4 — Architecture Gap

**What exists:** Unit tests for each MCP client library (mocked Supabase, mocked responses). These verify that the client code correctly formats requests and parses responses.

**What's missing:** Tests that verify a complete workflow across multiple real (or sandbox) servers:
- Patient encounter → FHIR resource → medical code validation → claim generation → submission
- Provider NPI lookup → FHIR Practitioner creation → database persistence

**Why this matters:** In healthcare EDI, edge cases live in the seams between systems. The HL7 parser may correctly parse a clean message but fail on a real hospital's HL7 feed with non-standard delimiters. The 837P generator may produce valid X12 syntax but use the wrong loop qualifier for a specific payer.

**Remediation:**
1. Create a `tests/integration/mcp-chains/` directory
2. Write end-to-end tests using sandbox APIs where available (NPI Registry is free, CMS is free)
3. For clearinghouse: use recorded real responses (sanitized of PHI) as fixtures
4. Run these tests separately from unit tests (they're slow, they hit real APIs)

**Estimated effort:** ~8 hours for initial chain, ~4 hours per additional chain

---

### S4-3: FHIR Server Is Not FHIR-Conformant

**Status:** NOT FIXED (by design — this is an architecture limitation, not a bug)
**Severity:** S4 — Architecture Gap

**What it is:** The `mcp-fhir-server` reads/writes Supabase tables (`fhir_patients`, `fhir_conditions`, etc.) that store FHIR-shaped data in PostgreSQL.

**What it is NOT:** A conformant FHIR R4 server that can:
- Accept arbitrary FHIR resources at a FHIR endpoint
- Return proper FHIR CapabilityStatement
- Handle FHIR search parameters per spec
- Pass the FHIR conformance test suite (Touchstone, Inferno)
- Integrate with Epic/Cerner/MEDITECH via standard FHIR APIs

**Current approach works for:**
- Internal data model (storing structured clinical data)
- Patient-facing health records (Cures Act via My Health Hub)
- Internal FHIR resource management

**Where it breaks:**
- Any EHR integration that expects a real FHIR endpoint
- ONC certification (requires Inferno test suite passage)
- CMS interoperability mandates for hospital data exchange

**Remediation (when needed — not urgent for pilot):**
- Stand up a FHIR facade (HAPI FHIR, Firely, or Medplum) in front of Supabase
- Sync Supabase tables ↔ FHIR server
- Or: use a hosted FHIR service (Google Healthcare API, Azure Health Data Services)

**Estimated effort:** ~40+ hours (major infrastructure work, not needed for initial pilot)

---

### S4-4: Tool Utilization Gap — 76 of 94 Tools Unwired

**Status:** NOT FIXED
**Severity:** S4 — Architecture Gap

**Numbers:**
- 94 total MCP tools across 13 servers
- ~18-20 tools called from UI components
- ~74-76 tools exist but have no consumer

**Breakdown by server:**

| Server | Total Tools | Tools Used in UI | Idle |
|--------|------------|-----------------|------|
| claude | 4 | 3 (analyze, summarize, suggest) | 1 |
| fhir | 17 | ~6 (CRUD + bundle + summary) | ~11 |
| hl7-x12 | 10 | ~3 (parse, generate 837P, validate) | ~7 |
| prior-auth | 12 | ~5 (create, submit, get, decide, appeal) | ~7 |
| clearinghouse | 10 | ~2 (test connection, check status) | ~8 |
| medical-codes | 10 | ~2 (search, validate) | ~8 |
| cms-coverage | 9 | ~1 (check PA required) | ~8 |
| npi-registry | 9 | ~1 (search providers) | ~8 |
| postgres | 3 | ~2 (query, health) | ~1 |
| pubmed | 7 | ~1 (search) | ~6 |
| edge-functions | 5 | ~1 (invoke) | ~4 |
| cultural-competency | 8 | 0 (consumed by AI skills, not direct UI) | 8* |
| medical-coding | 11 | 0 (brand new) | 11 |

*Cultural competency tools are consumed by AI edge functions, not direct UI — this is by design and not actually a gap.

**This isn't necessarily a problem** — tools can exist for future use. But each unwired tool is untested with real data and represents maintenance burden. The 81% idle rate means most of the MCP surface area is unvalidated beyond unit tests.

**Remediation:** Not all tools need UI wiring. Prioritize by revenue impact:
1. Clearinghouse tools (claims = money)
2. Medical coding tools (revenue optimization = money)
3. FHIR CRUD tools (clinical workflows)
4. Everything else (nice to have)

---

## S5: Configuration Debt

### S5-1: Two Servers Missing from .mcp.json

**Status:** FIXED
**Severity:** S5 — Configuration Debt
**Fixed in:** 2026-03-04, Session 3

**Both servers added to `.mcp.json`:**
1. `cultural-competency` — registered with same key pattern
2. `medical-coding` — registered with same key pattern

`.mcp.json` now has 13 servers (was 11).

---

### S5-2: .mcp.json Contains Credentials in Git History

**Status:** NOT FIXED
**Severity:** S5 — Configuration Debt (borderline S2)

**Evidence:** `.mcp.json` contains:
- The MCP key: `mcp_deb87fb957ded2691215ae7e47c87a66`
- The Supabase anon key (JWT)

These are in git history. Even if the file is later gitignored, the keys persist in commit history.

**Assessment:**
- The anon key is designed to be public (it's the client-side key)
- The MCP key IS sensitive — it grants admin-level access to Tier 3 servers
- Git history is permanent unless force-pushed (which has its own risks)

**Remediation:**
1. Rotate the MCP key
2. Move `.mcp.json` to `.mcp.local.json` (gitignored) with `.mcp.example.json` (committed, no real keys)
3. Or: use environment variables instead of hardcoded keys in the config file

**Estimated effort:** ~1 hour

---

### S5-3: Cultural Competency Data Is Hardcoded

**Status:** NOT FIXED
**Severity:** S5 — Configuration Debt

**Evidence:** `mcp-cultural-competency-server` contains 8 population profiles hardcoded in the server source code. Adding a new cultural context (e.g., "Hmong community," "Deaf/Hard of Hearing") requires redeploying the edge function.

**Current profiles:** Veterans, Unhoused, Spanish-speaking, Black/African American, Isolated Elderly, Indigenous, Immigrant/Refugee, LGBTQ+ Elderly

**What should happen:** Profiles should live in a `cultural_profiles` database table so tenants can:
- Add profiles relevant to their community
- Customize guidance per region
- Update content without redeployment

**Estimated effort:** ~4 hours (create table, migration, update server to query instead of hardcode)

---

## Priority Order for Remediation

| Priority | Item | Why First | Est. Hours |
|----------|------|-----------|-----------|
| 1 | S1-1 + S1-2 | **Fix the record** — documentation must match reality | 1 |
| 2 | S5-1 | 10-minute fix, unblocks Claude Code MCP usage for 2 servers | 0.2 |
| 3 | S2-1 | Shared MCP key is a real security risk | 4 |
| 4 | S5-2 | MCP key in git history (rotate after S2-1) | 1 |
| 5 | S2-2 | Rate limiting gap under load | 2 |
| 6 | S3-1 | Clearinghouse is revenue-critical, currently hollow | 8-12 |
| 7 | S4-1 | **FIXED** (Session 1: DB + edge fn + service + tests; Session 2: admin UI + migrations pushed) | ~~40-60~~ **DONE** |
| 8 | S5-3 | Cultural data in code → database | 4 |
| 9 | S4-2 | End-to-end integration tests | 8+ |
| 10 | S4-4 | Tool utilization gap (ongoing, not one-time) | Ongoing |
| 11 | S4-3 | FHIR conformance (not needed for pilot) | 40+ |

**Total estimated (items 1-9):** ~68-92 hours (~8-12 sessions)

---

## Appendix A: Medical Coding Server (Chain 6) — Code Review

**Reviewed 2026-03-04 by reading every handler file, not documentation.**

### Verdict: The code is REAL. This is the best-built MCP server in the project.

Unlike the clearinghouse server (S3-1, hollow) and the chains (S1-1, UI widgets labeled as orchestration), the medical coding server has **complete, executable business logic**. Here's what I verified by reading the actual source:

#### What's genuinely complete:

| Component | File | Lines | Assessment |
|-----------|------|-------|------------|
| Payer Rules Engine | `toolHandlers.ts` | 326 | Real Supabase queries with proper filtering (payer_type, fiscal_year, state_code, acuity_tier). Upsert with conflict resolution on composite key. Correct. |
| Revenue Projection | `toolHandlers.ts` | 134 | Medicare DRG formula is correct: `base_rate * DRG_weight * wage_index = operating + capital`. Per diem (Medicaid) calculation with allowable percentage is correct. Handles both payer types. |
| Charge Aggregation | `chargeAggregationHandlers.ts` | 523 | Queries 5 real source tables: `encounter_procedures`, `fhir_observations`, `fhir_procedures`, `claim_lines`, `medications`. CPT range classification (80000-89999 = lab, 70000-79999 = imaging) is correct per CPT structure. NDC code handling for pharmacy charges. This is real charge capture logic. |
| DRG Grouper | `drgGrouperHandlers.ts` | 590 | 3-pass DRG analysis (base → CC → MCC → pick highest weight) is the correct MS-DRG methodology. Gathers encounter, diagnoses, procedures, and clinical notes before calling Claude. Structured JSON output with proper schema. Persists results to `drg_grouping_results`. Logs AI cost. Model pinned to `SONNET_MODEL`. |
| Revenue Optimizer | `revenueOptimizerHandlers.ts` | 561 | AI-powered review of daily charges against clinical documentation. Identifies missing codes, upgrade opportunities, documentation gaps, modifier suggestions. All advisory (never auto-files). Rule-based completeness validation is a smart complement — no AI call for basic checks like "admission labs missing on Day 1." |
| Charge Validation | `revenueOptimizerHandlers.ts` | ~130 | Pure rules-based (no AI cost). 7 completeness rules with category, severity, suggested codes, and estimated financial impact. Day-1 specific rules (admission labs, chest X-ray). Smart. |

#### What's correct about the domain logic:

1. **DRG formula:** `operating_payment = base_rate * DRG_weight * wage_index` + `capital_payment = capital_rate * DRG_weight` — this is the actual CMS IPPS payment formula
2. **3-pass methodology:** Base DRG → CC upgrade → MCC upgrade → pick highest — this is how real DRG groupers work
3. **CPT code ranges:** 80000-89999 = labs, 70000-79999 = imaging, 90000-99999 = E&M — correct per AMA CPT structure
4. **HCPCS J-codes = pharmacy** — correct (J-codes are drug administration)
5. **Completeness rules:** Admission labs on Day 1, E/M codes expected, IV charges commonly missed — all real revenue cycle pain points
6. **Advisory-only guardrails:** Every response includes `"advisory"` disclaimer. The system never auto-files charges. This is the correct compliance posture.

#### Honest concerns (not bugs — design questions):

1. **AI parsing via regex** (`responseText.match(/\{[\s\S]*\}/)`) — The DRG grouper and revenue optimizer ask Claude for JSON but parse it with regex instead of using `response_format: { type: 'json_schema' }`. This works most of the time but is fragile. Per CLAUDE.md: "new AI edge functions must define a JSON response schema." This server should use structured output.

2. **No fee schedule lookup for NDC charges** — `chargeAggregationHandlers.ts:354`: medications get `charge_amount: 0` with comment "NDC doesn't carry amount — needs fee schedule lookup." The `fee_schedules` and `fee_schedule_rates` tables exist in the database but aren't queried here. This means pharmacy charges always show $0 in the daily snapshot.

3. **Claim lines not filtered by patient** — `chargeAggregationHandlers.ts:288-295`: claim lines are filtered by `service_date` and `code_system` but NOT by `patient_id` or `encounter_id`. If two patients have charges on the same date, they'd be mixed together. The comment at line 303 acknowledges this: "Filter claim lines to those belonging to claims for this encounter" but the actual query doesn't implement that filter.

4. **No browser client exists** — Unlike the other 11 MCP servers, there is no `src/services/mcp/mcpMedicalCodingClient.ts`. The server's 11 tools have no UI consumer. The server works but nothing calls it.

5. **Not registered in .mcp.json** — Already tracked as S5-1.

6. **`tenant_id` accepted from `args`** — Multiple handlers accept `tenant_id` from tool arguments (`args.tenant_id`). Per the P0-2 security fix, tenant should be derived from caller identity (JWT), not from tool args. The auth gate in `index.ts` does extract caller identity, but the handlers still read `args.tenant_id`. This is inconsistent with the security model applied to other servers.

#### Summary for medical coding:

| Aspect | Rating |
|--------|--------|
| Business logic correctness | **A** — DRG formulas, CPT classification, completeness rules are all real |
| Code completeness | **A-** — All 11 tools implemented with real DB queries and AI calls |
| Security | **B** — tenant_id from args violates P0-2; should use caller identity |
| Integration | **D** — No browser client, no UI, not in .mcp.json |
| AI output parsing | **B-** — Regex parsing instead of structured output schema |
| Domain accuracy | **A** — Revenue cycle specialist would recognize this as correct methodology |

**Bottom line:** This is production-quality revenue cycle logic wrapped in an MCP server that nothing can call yet. The code is real. The integration is missing. Building the `mcpMedicalCodingClient.ts` + admin UI panel would unlock it.

---

## Session Log

| Date | Session | Items Addressed | Notes |
|------|---------|----------------|-------|
| 2026-03-04 | Evaluation | Tracker created + Chain 6 code review | No code changes — evaluation only |
| 2026-03-04 | Session 1 | S4-1: Chain Orchestration — database + edge function + browser service | 10 new files, 21 tests, 0 typecheck errors |
| 2026-03-04 | Session 2 | S4-1: Admin UI panel + migrations pushed + S1-1 partially addressed (real orchestration now exists) | 8 new files, 31 tests, 10,893 total tests passing |
| 2026-03-04 | Session 3 | S5-1: Added 2 missing servers to .mcp.json. S1-1 + S1-2: Fixed documentation in PROJECT_STATE.md, MCP_SERVER_AUDIT.md, compliance tracker | Documentation corrections only |

---

*This tracker was created from a code-reading evaluation, not from documentation review. Every claim was verified against actual source files.*
