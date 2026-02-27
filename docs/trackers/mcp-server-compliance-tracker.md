# MCP Server Compliance & Hardening Tracker

> **Created:** 2026-02-27
> **Created By:** Claude Opus 4.6
> **Purpose:** Track remediation of all findings from MCP server compliance review
> **Total Estimated Work:** ~32-40 hours (5-6 sessions)

---

## Summary

| Priority | Items | Status |
|----------|-------|--------|
| Critical (C) | 5 | 0/5 done |
| Moderate (M) | 7 | 0/7 done |
| Low (L) | 5 | 0/5 done |
| **Total** | **17** | **0/17 done** |

---

## Tier 1: Critical (Security/Compliance) — Sessions 1-2

### C-1: God File Decomposition (6 servers exceed 600 lines)

**Status:** TODO
**Estimated:** ~8 hours (1 session)

Decompose using the proven barrel re-export pattern (same as FHIR, HL7, Clearinghouse decompositions from 2026-02-22).

| Server | Current Lines | Target | Decomposition Plan |
|--------|--------------|--------|-------------------|
| `mcp-prior-auth-server/index.ts` | 913 | <400 index + modules | Extract: types.ts, toolHandlers.ts (create/submit/get/decision/appeal/cancel/fhir), audit.ts |
| `mcp-npi-registry-server/index.ts` | 863 | <400 index + modules | Extract: types.ts, npiApiClient.ts (fetch wrappers), toolHandlers.ts, responseMappers.ts |
| `mcp-cms-coverage-server/index.ts` | 728 | <350 index + modules | Extract: types.ts, cmsApiClient.ts, toolHandlers.ts, coverageChecks.ts |
| `mcp-medical-codes-server/index.ts` | 720 | <350 index + modules | Extract: types.ts, codeSearch.ts, validation.ts, toolHandlers.ts |
| `mcp-edge-functions-server/index.ts` | 683 | <350 index + modules | Extract: types.ts, functionInvoker.ts, toolHandlers.ts, audit.ts |
| `mcp-postgres-server/index.ts` | 664 | <300 index + modules | Extract: types.ts, whitelistedQueries.ts, toolHandlers.ts, audit.ts |

**Verification:**
```bash
wc -l supabase/functions/mcp-*/index.ts  # All must be <600
npm run typecheck
npm test
```

---

### C-2: Postgres MCP — Add Auth Gate for Tool Calls

**Status:** TODO
**Estimated:** ~2 hours

**Problem:** `mcp-postgres-server` is Tier 2 (user-scoped) but has NO authentication gate on `tools/call`. Any caller with the anon key can execute whitelisted queries by providing any `tenant_id`. RLS applies to the Supabase client (initialized with anon key), but the whitelisted queries use `execute_safe_query` RPC which may bypass RLS depending on function security definer settings.

**Fix:**
1. Add JWT validation for tool calls (extract Bearer token, verify with `supabase.auth.getUser()`)
2. Use the caller's authenticated `tenant_id` from their profile — do NOT accept `tenant_id` from the request body
3. Alternatively, promote to Tier 3 with `verifyClinicalAccess()` if analytics queries should be admin-only

**Files:** `supabase/functions/mcp-postgres-server/index.ts`

---

### C-3: Medical Codes MCP — Add Auth Gate for Tool Calls

**Status:** TODO
**Estimated:** ~1 hour

**Problem:** Same as C-2. Tier 2 server with no auth verification on tool calls. Medical code lookups are read-only reference data, but unauthed access is still a compliance concern.

**Fix:** Add auth verification (at minimum, verify the Bearer token is a valid authenticated user, not just the anon key).

**Files:** `supabase/functions/mcp-medical-codes-server/index.ts`

---

### C-4: Prior Auth — Replace `SELECT *` with Explicit Columns

**Status:** TODO
**Estimated:** ~1 hour

**Problem:** `mcp-prior-auth-server` uses `select('*')` in 3+ queries, returning all columns including potentially sensitive `clinical_notes`, `clinical_rationale`, and other PHI-adjacent data.

**Locations:**
- `handleGetPriorAuth()` — line ~365: `select('*')` on `prior_authorizations`
- `handleGetPatientPriorAuths()` — line ~407-411: `select('*')` on `prior_authorizations`
- `handleToFHIRClaim()` — line ~633: `select('*')` on `prior_authorizations`
- Service line queries — `select('*')` on `prior_auth_service_lines` and `prior_auth_decisions`

**Fix:** Replace with explicit column lists. Define interface for each query's expected return shape.

**Files:** `supabase/functions/mcp-prior-auth-server/index.ts` (or extracted `toolHandlers.ts` after C-1)

---

### C-5: Edge Functions MCP — Add Rate Limiting

**Status:** TODO
**Estimated:** ~30 min

**Problem:** `mcp-edge-functions-server` imports the rate limiter but never calls it in the request handler. This is the only Tier 3 server without rate limiting.

**Fix:** Add `checkMCPRateLimit()` call before `tools/call` handling (same pattern as Claude server, Prior Auth server).

**Files:** `supabase/functions/mcp-edge-functions-server/index.ts`

---

## Tier 2: Moderate (Functional) — Sessions 3-4

### M-1: Input Validation for MCP Tool Arguments

**Status:** TODO
**Estimated:** ~4 hours (1 session)

**Problem:** All 11 servers destructure tool arguments directly from JSON without:
- String length limits (could send 1MB strings)
- Format validation (UUIDs, dates, NPI format, code format)
- Array size limits (could send 10,000-element arrays)
- Type coercion checks (string where number expected)

**Fix:** Create shared `mcpInputValidator.ts` in `_shared/` with:
- `validateUUID(value)` — UUID format check
- `validateString(value, maxLength)` — length limit
- `validateArray(value, maxItems)` — array size limit
- `validateDate(value)` — ISO date format
- `validateNPI(value)` — 10-digit Luhn check
- `validateMedicalCode(value, codeSystem)` — CPT/ICD-10/HCPCS format

Apply to each server's tool handler entry point.

**Files:** New `supabase/functions/_shared/mcpInputValidator.ts` + each server's handler

---

### M-2: Add PubMed to .mcp.example.json

**Status:** TODO
**Estimated:** ~10 min

**Problem:** PubMed MCP server exists and is LIVE but missing from `.mcp.example.json`.

**Fix:** Add PubMed server entry to the example config.

**Files:** `.mcp.example.json`

---

### M-3: Database Query Timeouts for Tier 3 Servers

**Status:** TODO
**Estimated:** ~2 hours

**Problem:** FHIR and Prior Auth servers can run long database queries with no timeout. Supabase edge functions have a 60-second wall clock limit, but individual queries could block for the full duration.

**Fix:** Add `AbortController` timeout pattern (similar to Edge Functions server's fetch timeout) to database-heavy operations. Consider adding `statement_timeout` to critical queries.

**Files:** `mcp-fhir-server/toolHandlers.ts`, `mcp-prior-auth-server/index.ts`

---

### M-4: Unified MCP Audit Log Table

**Status:** TODO
**Estimated:** ~2 hours

**Problem:** Inconsistent audit logging across servers:
- Claude → `claude_usage_logs`
- Postgres → `mcp_query_logs` (fallback: `claude_usage_logs`)
- Edge Functions → `mcp_function_logs` (fallback: `claude_usage_logs`)
- FHIR → custom audit via `audit.ts`
- Others → mixed

**Fix:** Create unified `mcp_audit_logs` table with common schema:
```sql
CREATE TABLE mcp_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  request_id TEXT NOT NULL,
  user_id TEXT,
  tenant_id TEXT,
  auth_method TEXT, -- 'user_jwt' | 'mcp_key'
  execution_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Files:** New migration + shared `mcpAudit.ts` module + update all servers

---

### M-5: Update AI Architecture Doc

**Status:** TODO
**Estimated:** ~30 min

**Problem:** `docs/architecture/AI_FIRST_ARCHITECTURE.md` says "8 specialized MCP servers" but there are 11.

**Fix:** Update the server count, table, and descriptions. Add PubMed, Prior Auth, Claude entries.

**Files:** `docs/architecture/AI_FIRST_ARCHITECTURE.md`

---

### M-6: MCP Server Health Dashboard

**Status:** TODO
**Estimated:** ~4 hours (1 session)

**Problem:** All 11 servers have GET `/health` endpoints but no admin UI aggregates them. Operators have no single pane of glass for MCP server status.

**Fix:** Create `MCPServerHealthPanel` component for admin dashboard:
- Fetches health from all 11 endpoints
- Shows status, version, tier, dependencies
- Color-coded status indicators
- Auto-refresh every 30 seconds

**Files:** New component in `src/components/admin/`, wire to admin section definitions

---

### M-7: Cross-Server Chain Implementation (Future)

**Status:** TODO — Deferred (business prioritization required)
**Estimated:** ~46 hours (6-8 sessions) for all 5 chains

| Chain | Servers | Est. Hours | Business Value |
|-------|---------|-----------|---------------|
| 1. Claims Pipeline | Medical Codes → CMS → Prior Auth → HL7 → Clearinghouse | 16 | HIGH (revenue) |
| 2. Provider Onboarding | NPI → FHIR → Postgres | 4 | MEDIUM |
| 3. Clinical Decision Support | FHIR → PubMed → CMS → Claude | 8 | HIGH (differentiator) |
| 4. Encounter-to-Claim | FHIR → Medical Codes → CMS → HL7 → Clearinghouse | 16 | HIGH |
| 5. Prior Auth Workflow | CMS → Prior Auth → FHIR → Clearinghouse | 12 | HIGH |

**Decision needed:** Which chain to build first (recommend Chain 1 — revenue cycle)

---

## Tier 3: Low (Hardening) — Session 5

### L-1: Persistent Rate Limiting

**Status:** TODO
**Estimated:** ~2 hours

**Problem:** In-memory rate limiter resets on cold start and is per-instance. Under horizontal scaling, limits are not shared.

**Fix:** Add optional Redis or Supabase-backed rate limiter for production. Keep in-memory as fast path with DB fallback for persistence.

---

### L-2: MCP Key Rotation Automation

**Status:** TODO
**Estimated:** ~2 hours

**Problem:** MCP key lifecycle (create → rotate → revoke) is manual.

**Fix:** Add admin UI for key management + scheduled check for expiring keys.

---

### L-3: Request Body Size Limits

**Status:** TODO
**Estimated:** ~1 hour

**Problem:** No payload size validation. Supabase edge functions have 2MB limit, but large valid payloads could cause performance issues.

**Fix:** Add `Content-Length` check at the top of each server handler. Reject requests > 512KB for most servers, > 2MB for HL7/FHIR.

---

### L-4: Tools Discovery Auth (Informational)

**Status:** ACCEPTED RISK

`initialize` and `tools/list` MCP methods return server capabilities without authentication. This is per MCP protocol specification and is needed for client discovery. The tools list reveals capability names but not data. Accepted as protocol-compliant behavior.

---

### L-5: Dynamic Pricing for Claude Cost Tracker

**Status:** TODO
**Estimated:** ~1 hour

**Problem:** Claude model pricing is hardcoded in `mcp-claude-server/index.ts`.

**Fix:** Move pricing to `_shared/models.ts` or a database table that can be updated without redeployment.

---

## Session Plan

| Session | Items | Estimated Hours | Focus |
|---------|-------|----------------|-------|
| **1** | C-1 (god files) | ~8 hours | Decompose 6 servers using barrel pattern |
| **2** | C-2, C-3, C-4, C-5, M-2 | ~5 hours | Auth gates, SELECT *, rate limiting, config |
| **3** | M-1, M-3 | ~6 hours | Input validation framework, query timeouts |
| **4** | M-4, M-5, M-6 | ~7 hours | Unified audit, docs update, health dashboard |
| **5** | L-1, L-2, L-3, L-5 | ~6 hours | Rate limiting persistence, key rotation, body limits |
| **6+** | M-7 (chains) | ~46 hours | Cross-server orchestration (business decision) |

---

## Verification After Each Session

```bash
npm run typecheck && npm run lint && npm test
wc -l supabase/functions/mcp-*/index.ts  # All <600
```

---

*Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.*
