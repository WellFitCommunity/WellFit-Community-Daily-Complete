# MCP Server Compliance & Hardening Tracker

> **Created:** 2026-02-27
> **Updated:** 2026-02-27 (merged Claude + ChatGPT cross-audit findings)
> **Created By:** Claude Opus 4.6 (initial) + ChatGPT cross-audit (verification)
> **Purpose:** Track remediation of all findings from MCP server compliance review
> **Total Estimated Work:** ~40-48 hours (6-7 sessions)

---

## Summary

| Priority | Items | Status |
|----------|-------|--------|
| P0 Critical (Security) | 8 | **8/8 done** (P0-1 through P0-8) |
| P1 Hardening | 3 | **3/3 done** (P1-1, P1-2, P1-3) |
| P2 Moderate (Functional) | 7 | **4/7 done** (P2-1, P2-2, P2-3, P2-5) |
| P3 Low (Polish) | 5 | 0/5 done |
| **Total** | **23** | **15/23 done** |

### Cross-Audit Note

This tracker merges findings from two independent AI audits:
- **Claude Opus 4.6:** Compliance-level review (CLAUDE.md rules, HIPAA, god files, operational gaps)
- **ChatGPT (external):** Code-level security review (auth binding, tenant isolation, JWT handling, SECURITY DEFINER)

Items marked **(ChatGPT)** were identified by the cross-audit. Items marked **(Claude)** were original findings. Items marked **(Both)** were independently identified by both.

---

## P0: Critical (Security/Correctness) — Sessions 1-2

### P0-1: Per-Request Supabase Client Binding for User-Scoped Servers **(ChatGPT)**

**Status:** DONE (2026-02-27)
**Estimated:** ~4 hours
**Severity:** CRITICAL — multi-tenant data exposure

**Problem:** `mcp-postgres-server` (Tier 2, "user_scoped") creates the Supabase client ONCE at initialization using `SB_ANON_KEY` (`mcpServerBase.ts:95-96`). All subsequent tool calls use this shared client. The caller's JWT is never bound per-request.

Additionally, `execute_safe_query` is granted to `authenticated` and `service_role` (migration line 92-93), NOT to `anon`. This means either:
1. Queries fail silently (anon can't call authenticated-only RPC), OR
2. Supabase edge functions auto-elevate to service role context, bypassing RLS entirely

**Evidence:**
- `mcp-postgres-server/index.ts:32-41` — single client init
- `20251214000000_mcp_postgres_helper_functions.sql:92` — `GRANT EXECUTE ... TO authenticated`
- No per-request `Authorization` header binding anywhere in the handler

**Fix (non-negotiable):**
```typescript
// CURRENT (broken): shared client, anon context
const sb = initResult.supabase; // Created once at init

// FIXED: per-request client with caller's JWT
const userToken = req.headers.get('Authorization')?.replace('Bearer ', '');
const userClient = createClient(SUPABASE_URL, SB_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${userToken}` } },
  auth: { persistSession: false }
});
```

**Files:** `supabase/functions/mcp-postgres-server/index.ts`, `supabase/functions/mcp-medical-codes-server/index.ts`

---

### P0-2: Tenant ID Must Be Derived from Identity, Not Tool Args **(ChatGPT)**

**Status:** DONE (2026-02-27)
**Estimated:** ~3 hours
**Severity:** CRITICAL — tenant isolation bypass

**Problem:** `mcp-postgres-server/index.ts:489` accepts `tenant_id` from `toolArgs`:
```typescript
const { query_name, tenant_id, parameters: extraParams } = toolArgs;
```
And `userId` is also accepted from toolArgs for logging (`toolArgs.userId`, line 599).

The caller supplies which tenant they want to query. Even though whitelisted queries include `WHERE tenant_id = $1`, the caller controls `$1`. And `execute_safe_query` is `SECURITY DEFINER` — it runs with the function owner's privileges, not the caller's. **A caller can read any tenant's data by passing a different `tenant_id`.**

**Affected servers:**
- `mcp-postgres-server` — `tenant_id` from toolArgs
- `mcp-prior-auth-server` — `tenant_id` from toolArgs in create/decision/appeal
- `mcp-edge-functions-server` — `tenant_id` passed through to invoked functions

**Fix (non-negotiable):**
1. After authenticating the caller (P0-1), look up their `tenant_id` from the `profiles` table
2. Use that server-derived `tenant_id` for all queries — ignore any `tenant_id` in toolArgs
3. Log the caller-supplied vs server-derived tenant_id if they differ (security event)

```typescript
// Derive tenant from verified identity
const { data: profile } = await userClient
  .from('profiles')
  .select('tenant_id')
  .eq('user_id', caller.userId)
  .single();
const tenantId = profile.tenant_id; // Server-derived, NOT from toolArgs
```

**Files:** `mcp-postgres-server/index.ts`, `mcp-prior-auth-server/index.ts`, `mcp-edge-functions-server/index.ts`

---

### P0-3: Fix base64url Decoding Bug in isAnonKey() **(ChatGPT)**

**Status:** DONE (2026-02-27)
**Estimated:** ~30 min
**Severity:** CRITICAL — auth bypass potential

**Problem:** `mcpAuthGate.ts:133`:
```typescript
const payload = JSON.parse(atob(parts[1]));
```

JWTs use **base64url** encoding (RFC 4648 §5), not standard base64. Differences:
- base64url uses `-` instead of `+`
- base64url uses `_` instead of `/`
- base64url omits padding `=`

`atob()` expects standard base64 and will throw on `-` or `_` characters. The `try/catch` returns `false` (line 135), meaning `isAnonKey()` reports "not anon" for any token it can't decode. **A legitimate anon key with base64url characters could bypass the anon rejection gate and reach the admin auth path.**

**Fix:**
```typescript
function base64urlDecode(str: string): string {
  // Replace base64url chars with standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  return atob(base64);
}

function isAnonKey(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(base64urlDecode(parts[1]));
    return payload.role === "anon";
  } catch {
    return false;
  }
}
```

**Files:** `supabase/functions/_shared/mcpAuthGate.ts`

---

### P0-4: execute_safe_query SECURITY DEFINER Without Tenant Enforcement **(ChatGPT)**

**Status:** DONE (2026-02-27)
**Estimated:** ~2 hours
**Severity:** CRITICAL — coupled with P0-2

**Problem:** `execute_safe_query` (migration line 19) is `SECURITY DEFINER`. It validates SQL patterns (no DROP/DELETE/etc.) but does NOT enforce tenant scoping. The `WHERE tenant_id = $1` in whitelisted queries is correct, but `$1` comes from the caller via toolArgs. The function itself has no concept of "who is calling" or "which tenant they belong to."

**Fix options (choose one):**
1. **Remove SECURITY DEFINER** — make it `SECURITY INVOKER` so it runs with the caller's RLS context (requires P0-1 per-request client binding first)
2. **Add tenant enforcement inside the function** — use `auth.uid()` to look up tenant and inject it, rejecting caller-supplied tenant_id
3. **Keep SECURITY DEFINER but add set_config** — `SET request.jwt.claims` so RLS can still evaluate

**Recommendation:** Option 1 (SECURITY INVOKER) is cleanest when combined with P0-1. The function becomes a safe SQL validator, and RLS handles tenant isolation naturally.

**Files:** `supabase/migrations/` (new migration to alter function), `mcp-postgres-server/index.ts`

---

### P0-5: God File Decomposition (6 servers exceed 600 lines) **(Claude)**

**Status:** DONE (2026-02-27)
**Estimated:** ~8 hours (1 session)

Decomposed all 6 servers using the proven barrel re-export pattern (factory function + extracted modules).

| Server | Before | After (index.ts) | Modules Extracted |
|--------|--------|-------------------|-------------------|
| `mcp-prior-auth-server` | 929 | 224 | types.ts, tools.ts, fhirConverter.ts, toolHandlers.ts |
| `mcp-npi-registry-server` | 863 | 155 | taxonomyCodes.ts, npiApi.ts, tools.ts, toolHandlers.ts |
| `mcp-cms-coverage-server` | 728 | 155 | coverageData.ts, tools.ts, toolHandlers.ts |
| `mcp-medical-codes-server` | 734 | 158 | types.ts, codeData.ts, tools.ts, toolHandlers.ts |
| `mcp-edge-functions-server` | 703 | 197 | functionWhitelist.ts, tools.ts, toolHandlers.ts |
| `mcp-postgres-server` | 690 | 183 | queryWhitelist.ts, tools.ts, toolHandlers.ts |

**Verification (passed):**
- All 6 index.ts files: 155–224 lines (well under 600)
- All extracted modules: under 425 lines each
- typecheck: 0 errors
- lint: 0 errors, 0 warnings
- tests: 10,304 passed, 0 failed

---

### P0-6: Replace `SELECT *` with Explicit Columns Across 3 MCP Servers **(Claude)**

**Status:** DONE (2026-02-27)
**Estimated:** ~2.5 hours

**Problem:** 17 `select('*')` instances across 3 MCP servers exposed unnecessary columns (including PHI like `clinical_notes`).

**Fix applied:**
- `mcp-prior-auth-server/toolHandlers.ts` — 4 queries: `handleGetPriorAuth`, `handleGetPatientPriorAuths` use `PRIOR_AUTH_COLUMNS` (excludes `clinical_notes`, `clinical_rationale`); `prior_auth_service_lines` and `prior_auth_decisions` use explicit columns
- `mcp-prior-auth-server/fhirConverter.ts` — 1 query: explicit columns (includes `clinical_notes` — authorized FHIR clinical data path for `supportingInfo`)
- `mcp-medical-codes-server/toolHandlers.ts` — 3 fallback queries on legacy tables (`cpt_codes`, `icd10_codes`, `hcpcs_codes`) → `select('code, description')`
- `mcp-fhir-server/toolHandlers.ts` — 7 queries: all use `getFHIRColumns(table)` from per-table column map
- `mcp-fhir-server/resourceQueries.ts` — 2 queries: bundle export + search use `getFHIRColumns(table)`
- `mcp-fhir-server/tools.ts` — Added `FHIR_SELECT_COLUMNS` map (18 FHIR tables → explicit columns) + `getFHIRColumns()` helper

**Files:** 6 files modified

---

### P0-7: Edge Functions MCP — Add Missing Rate Limiting **(Claude)**

**Status:** DONE (2026-02-27)
**Estimated:** ~20 min

**Problem:** `mcp-edge-functions-server` had auth gate but no rate limiter call. Config existed (`MCP_RATE_LIMITS.edgeFunctions`: 50 req/min) but was never checked.

**Fix:** Added rate limit imports + check after CORS/before JSON parse (same pattern as other servers).

**Files:** `supabase/functions/mcp-edge-functions-server/index.ts`

---

### P0-8: Medical Codes MCP — Add Auth Gate **(Both)**

**Status:** DONE (2026-02-27)
**Estimated:** ~45 min

**Problem:** Tier 2 server had per-request client binding (P0-1) and caller identity extraction (P0-2) but no auth verification. Any request with just an anon key could call tools.

**Fix:** Made `extractCallerIdentity` a hard gate before tool execution. Returns 401 if no valid JWT provided. Moved auth check before `handleToolCall`, returning `createUnauthorizedResponse` when `caller` is null.

**Files:** `supabase/functions/mcp-medical-codes-server/index.ts`

---

## P1: Hardening — Session 3

### P1-1: Replace auth.getUser() with Local JWKS Verification **(ChatGPT)**

**Status:** DONE (2026-02-27)
**Estimated:** ~3 hours

**Problem:** `mcpAuthGate.ts` called `adminClient.auth.getUser(token)` on every MCP tool call — 100-300ms network round-trip, availability dependency on Supabase Auth.

**Fix applied:**
1. Created `_shared/mcpJwksVerifier.ts` (82 lines) — module-level JWKS cache using `jose@v5.2.0`, `verifyJWTLocally()` function
2. Updated `mcpAuthGate.ts` `verifyAdminAccess()` — tries JWKS first, falls back to `auth.getUser()` on failure (graceful degradation)
3. Profile lookup for role/tenant remains unchanged (still needed for authorization)
4. Consolidated `createForbiddenResponse`/`createUnauthorizedResponse` into shared `createAuthErrorResponse` helper to keep file under 600 lines (591 lines final)
5. Removed unused `User` import from supabase-js

**Files:** `_shared/mcpJwksVerifier.ts` (NEW), `_shared/mcpAuthGate.ts`

---

### P1-2: Require Auth for tools/list on Admin-Tier Servers **(ChatGPT, upgraded from L-4)**

**Status:** DONE (2026-02-28)
**Estimated:** ~2 hours

**Problem:** `tools/list` returns full capability names (e.g., "prior_auth_submit", "execute_query") without authentication on admin-tier servers. This is capability disclosure to unauthenticated callers.

**Fix applied:** Added `extractCallerIdentity()` check before `tools/list` response on all 5 Tier 3 servers. Returns 401 `createUnauthorizedResponse` for unauthenticated callers. `initialize` remains public per MCP protocol. Tier 1 servers unaffected.

**Servers modified:** `mcp-fhir-server`, `mcp-hl7-x12-server`, `mcp-prior-auth-server`, `mcp-claude-server`, `mcp-edge-functions-server`

**Files:** Each Tier 3 server's `index.ts` tools/list handler

---

### P1-3: Rate Limit Identity Improvements **(ChatGPT)**

**Status:** DONE (2026-02-28)
**Estimated:** ~1 hour

**Problem:** Rate limiting currently uses IP address or token hash as identifier (`mcpRateLimiter.ts:172-193`). For MCP key calls, the key ID or tenant ID should drive rate limiting, not just IP. For user JWT calls, userId + tenantId should be the key.

**Fix applied:**
1. Added `getCallerRateLimitId(caller)` function and `RateLimitCallerIdentity` interface to `mcpRateLimiter.ts`
2. Returns `mcp_key:{keyId}` for MCP key auth, `user:{userId}:{tenantId}` for JWT auth
3. Added identity-based rate limit as SECOND check (after auth gate) in 3 servers that have existing rate limiting: `mcp-prior-auth-server`, `mcp-claude-server`, `mcp-edge-functions-server`
4. Early IP-based check retained for DoS protection on unauthenticated paths

**Files:** `supabase/functions/_shared/mcpRateLimiter.ts`, `mcp-prior-auth-server/index.ts`, `mcp-claude-server/index.ts`, `mcp-edge-functions-server/index.ts`

---

## P2: Moderate (Functional) — Sessions 4-5

### P2-1: Input Validation Framework for MCP Tool Arguments **(Claude + ChatGPT "tool contracts")**

**Status:** DONE (2026-02-28)
**Estimated:** ~4 hours

**Problem:** All 11 servers destructure tool arguments directly from JSON without length limits, format validation, array size limits, or type coercion checks.

**Fix applied:**
1. Created `_shared/mcpInputValidator.ts` (401 lines) — declarative validation framework with:
   - Individual validators: `isValidUUID`, `isValidNPI` (Luhn check with 80840 prefix), `isValidCPT`, `isValidHCPCS`, `isValidICD10`, `isValidMedicalCode`, `isValidDate`, `isValidStateCode`, `isValidZipCode`
   - Declarative `FieldSchema` union type (uuid, npi, date, state, zip, string, number, enum, array, medical_code, object, boolean)
   - Schema-driven `validateToolArgs()`, `validateForTool()` registry lookup, `validationErrorResponse()` JSON-RPC helper
2. Wired validation into 4 MCP servers with `VALIDATION: ToolSchemaRegistry` + `validateForTool()` call before tool dispatch:
   - `mcp-prior-auth-server` — 11 tools with full schemas (uuid, enum, npi, string, number, date, array)
   - `mcp-fhir-server` — 14 tools with full schemas (uuid, string, number, date, array, object)
   - `mcp-npi-registry-server` — 8 tools with full schemas (npi, string, state, zip, enum, number, array)
   - `mcp-medical-codes-server` — 9 tools with full schemas (string, enum, number, array)

**Files:** `_shared/mcpInputValidator.ts` (NEW), `mcp-prior-auth-server/index.ts`, `mcp-fhir-server/index.ts`, `mcp-npi-registry-server/index.ts`, `mcp-medical-codes-server/index.ts`

---

### P2-2: Add PubMed to .mcp.example.json **(Claude)**

**Status:** DONE (already present — PubMed was added to `.mcp.example.json` during MCP server build)
**Estimated:** ~10 min

**Files:** `.mcp.example.json`

---

### P2-3: Database Query Timeouts for Tier 3 Servers **(Claude)**

**Status:** DONE (2026-02-28 — implemented as `_shared/mcpQueryTimeout.ts` during P2-1 session)
**Estimated:** ~2 hours

**Fix applied:** Created `_shared/mcpQueryTimeout.ts` with `withTimeout()` Promise.race wrapper and `MCP_TIMEOUT_CONFIG` per-server configs (5s lookups, 15s queries, 30s bundles). Wired into all 3 database-heavy servers: `mcp-fhir-server` (14 queries), `mcp-prior-auth-server` (4 queries), `mcp-postgres-server` (3 queries).

**Files:** `_shared/mcpQueryTimeout.ts` (NEW), `mcp-fhir-server/toolHandlers.ts`, `mcp-fhir-server/resourceQueries.ts`, `mcp-prior-auth-server/toolHandlers.ts`, `mcp-postgres-server/toolHandlers.ts`

---

### P2-4: Unified MCP Audit Log Table **(Claude)**

**Status:** TODO
**Estimated:** ~2 hours

**Problem:** Inconsistent audit logging across servers (claude_usage_logs, mcp_query_logs, mcp_function_logs).

**Fix:** Create unified `mcp_audit_logs` table with common schema:
```sql
CREATE TABLE mcp_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  request_id TEXT NOT NULL,
  user_id TEXT,
  tenant_id TEXT,
  auth_method TEXT,
  execution_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Files:** New migration + shared `mcpAudit.ts` module + update all servers

---

### P2-5: Update AI Architecture Doc **(Claude)**

**Status:** DONE (2026-02-28)
**Estimated:** ~30 min

**Fix applied:** Updated all references from "8 MCP servers" to "11 MCP servers (96 tools, 3 security tiers)". Added 3 missing servers (claude, prior-auth, pubmed) to the table. Added security tier column. Updated date from January to February 2026.

**Files:** `docs/architecture/AI_FIRST_ARCHITECTURE.md`

---

### P2-6: MCP Server Health Dashboard **(Claude)**

**Status:** TODO
**Estimated:** ~4 hours

**Fix:** Create `MCPServerHealthPanel` admin component aggregating all 11 `/health` endpoints.

**Files:** New component in `src/components/admin/`

---

### P2-7: Cross-Server Chain Implementation **(Claude)**

**Status:** TODO — Deferred (business prioritization required)
**Estimated:** ~46 hours (6-8 sessions)

| Chain | Servers | Est. Hours | Business Value |
|-------|---------|-----------|---------------|
| 1. Claims Pipeline | Medical Codes → CMS → Prior Auth → HL7 → Clearinghouse | 16 | HIGH |
| 2. Provider Onboarding | NPI → FHIR → Postgres | 4 | MEDIUM |
| 3. Clinical Decision Support | FHIR → PubMed → CMS → Claude | 8 | HIGH |
| 4. Encounter-to-Claim | FHIR → Medical Codes → CMS → HL7 → Clearinghouse | 16 | HIGH |
| 5. Prior Auth Workflow | CMS → Prior Auth → FHIR → Clearinghouse | 12 | HIGH |

---

## P3: Low (Polish) — Session 6

### P3-1: Persistent Rate Limiting **(Claude + ChatGPT)**

**Status:** TODO
**Estimated:** ~2 hours

**Fix:** Redis or Supabase-backed rate limiter for cross-instance persistence.

---

### P3-2: MCP Key Rotation Automation **(Claude)**

**Status:** TODO
**Estimated:** ~2 hours

**Fix:** Admin UI for key management + expiry alerts.

---

### P3-3: Request Body Size Limits **(Claude)**

**Status:** TODO
**Estimated:** ~1 hour

**Fix:** Content-Length check, reject > 512KB for most servers.

---

### P3-4: Dynamic Pricing for Claude Cost Tracker **(Claude)**

**Status:** TODO
**Estimated:** ~1 hour

**Fix:** Move pricing to `_shared/models.ts` or database table.

---

### P3-5: Confidence + Provenance Metadata **(ChatGPT)**

**Status:** TODO
**Estimated:** ~2 hours

**Fix:** Extend MCP response metadata with:
- Data source provenance (DB vs external registry)
- Freshness timestamp
- Confidence score (if AI involved)
- Safety flags (if output touches clinical guidance)

**Files:** `_shared/mcpServerBase.ts` (extend metadata schema), each server's response builder

---

## Session Plan (Updated)

| Session | Items | Hours | Focus |
|---------|-------|-------|-------|
| **1** | P0-1, P0-2, P0-3, P0-4 | ~10 | **Auth binding, tenant isolation, JWT fix, SECURITY DEFINER** |
| **2** | P0-5 | ~8 | **God file decomposition (6 servers)** |
| **3** | P0-6, P0-7, P0-8, P1-1 | ~7 | **SELECT *, rate limiting, JWKS verification** |
| **4** | P1-2, P1-3, P2-1 | ~7 | **Tools auth, rate limit identity, input validation** |
| **5** | P2-2, P2-3, P2-4, P2-5, P2-6 | ~9 | **Config, timeouts, unified audit, docs, health dashboard** |
| **6** | P3-1 through P3-5 | ~8 | **Persistence, key rotation, body limits, pricing, provenance** |
| **7+** | P2-7 (chains) | ~46 | **Cross-server orchestration (business decision)** |

**Session 1 is the highest-priority session.** P0-1 through P0-4 are security fixes that close the multi-tenant data leak path.

---

## Verification After Each Session

```bash
npm run typecheck && npm run lint && npm test
wc -l supabase/functions/mcp-*/index.ts  # All <600
```

---

## Cross-Audit Scorecard

| Auditor | Unique Finds | Shared Finds | Missed by Other |
|---------|-------------|-------------|-----------------|
| **Claude** | 12 items (god files, SELECT *, rate limiting, docs, dashboard, chains, body limits, pricing) | 3 items (auth gate, tenant isolation, input validation) | 4 ChatGPT items (base64url, per-request binding, JWKS, SECURITY DEFINER) |
| **ChatGPT** | 4 items (base64url bug, per-request binding, JWKS, SECURITY DEFINER) | 3 items (auth gate, tenant isolation, tool contracts) | 12 Claude items (god files, SELECT *, rate limiting, etc.) |

**Conclusion:** Neither AI audit alone was sufficient. Cross-auditing caught critical security issues (ChatGPT) and comprehensive operational gaps (Claude) that the other missed. **Dual-AI auditing should be standard practice for security-critical infrastructure.**

---

*Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.*
