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
| P0 Critical (Security) | 8 | **4/8 done** (P0-1 through P0-4) |
| P1 Hardening | 3 | 0/3 done |
| P2 Moderate (Functional) | 7 | 0/7 done |
| P3 Low (Polish) | 5 | 0/5 done |
| **Total** | **23** | **4/23 done** |

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

**Status:** TODO
**Estimated:** ~8 hours (1 session)

Decompose using the proven barrel re-export pattern (same as FHIR, HL7, Clearinghouse decompositions).

| Server | Current Lines | Target | Decomposition Plan |
|--------|--------------|--------|-------------------|
| `mcp-prior-auth-server/index.ts` | 913 | <400 index + modules | Extract: types.ts, toolHandlers.ts, audit.ts |
| `mcp-npi-registry-server/index.ts` | 863 | <400 index + modules | Extract: types.ts, npiApiClient.ts, toolHandlers.ts, responseMappers.ts |
| `mcp-cms-coverage-server/index.ts` | 728 | <350 index + modules | Extract: types.ts, cmsApiClient.ts, toolHandlers.ts |
| `mcp-medical-codes-server/index.ts` | 720 | <350 index + modules | Extract: types.ts, codeSearch.ts, validation.ts, toolHandlers.ts |
| `mcp-edge-functions-server/index.ts` | 683 | <350 index + modules | Extract: types.ts, functionInvoker.ts, toolHandlers.ts, audit.ts |
| `mcp-postgres-server/index.ts` | 664 | <300 index + modules | Extract: types.ts, whitelistedQueries.ts, toolHandlers.ts, audit.ts |

**Verification:**
```bash
wc -l supabase/functions/mcp-*/index.ts  # All must be <600
npm run typecheck && npm test
```

---

### P0-6: Prior Auth — Replace `SELECT *` with Explicit Columns **(Claude)**

**Status:** TODO
**Estimated:** ~1 hour

**Problem:** `mcp-prior-auth-server` uses `select('*')` in 3+ queries, returning all columns including `clinical_notes`, `clinical_rationale`.

**Locations:**
- `handleGetPriorAuth()` — line ~365
- `handleGetPatientPriorAuths()` — line ~407-411
- `handleToFHIRClaim()` — line ~633
- Service line queries on `prior_auth_service_lines` and `prior_auth_decisions`

**Fix:** Replace with explicit column lists.

**Files:** `supabase/functions/mcp-prior-auth-server/index.ts`

---

### P0-7: Edge Functions MCP — Add Missing Rate Limiting **(Claude)**

**Status:** TODO
**Estimated:** ~30 min

**Problem:** `mcp-edge-functions-server` imports the rate limiter but NEVER calls it in the request handler. Only Tier 3 server without rate limiting.

**Fix:** Add `checkMCPRateLimit()` call before `tools/call` handling.

**Files:** `supabase/functions/mcp-edge-functions-server/index.ts`

---

### P0-8: Medical Codes MCP — Add Auth Gate **(Both)**

**Status:** TODO
**Estimated:** ~1 hour

**Problem:** Tier 2 server with no auth verification on tool calls. Same structural issue as P0-1/P0-2.

**Fix:** Add per-request client binding (P0-1 pattern) and auth verification.

**Files:** `supabase/functions/mcp-medical-codes-server/index.ts`

---

## P1: Hardening — Session 3

### P1-1: Replace auth.getUser() with Local JWKS Verification **(ChatGPT)**

**Status:** TODO
**Estimated:** ~4 hours

**Problem:** `mcpAuthGate.ts:402` calls `adminClient.auth.getUser(token)` on every MCP tool call. This is a network round-trip to the Supabase Auth server. Two network calls per request (auth.getUser + profiles lookup).

**Impact:**
- Latency: 100-300ms added per request
- Resilience: Auth server downtime = all MCP servers down
- Cost: Every MCP call hits the Auth server

**Fix:**
1. Fetch JWKS from `https://{project-id}.supabase.co/auth/v1/.well-known/jwks.json` (cache 10 min)
2. Verify JWT locally using `jose` library (asymmetric key verification)
3. Fall back to `auth.getUser()` only if JWKS verification fails
4. Keep profiles lookup for role/tenant resolution (still needed)

```typescript
import { jwtVerify, createRemoteJWKSet } from "https://deno.land/x/jose/index.ts";

const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

async function verifyJWTLocally(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${SUPABASE_URL}/auth/v1`
  });
  return payload; // Contains sub (user ID), role, exp
}
```

**Files:** `supabase/functions/_shared/mcpAuthGate.ts`

---

### P1-2: Require Auth for tools/list on Admin-Tier Servers **(ChatGPT, upgraded from L-4)**

**Status:** TODO
**Estimated:** ~2 hours

**Problem:** `tools/list` returns full capability names (e.g., "prior_auth_submit", "execute_query") without authentication on admin-tier servers. This is capability disclosure to unauthenticated callers.

**Fix:** On Tier 3 (admin) servers, either:
1. Require auth for `tools/list` (return 401 without valid credentials), OR
2. Return a redacted list (tool names only, no descriptions/schemas) without auth

Keep `initialize` public (per MCP protocol). Keep Tier 1 tools/list public (external API tools are not sensitive).

**Files:** Each Tier 3 server's `tools/list` handler

---

### P1-3: Rate Limit Identity Improvements **(ChatGPT)**

**Status:** TODO
**Estimated:** ~1 hour

**Problem:** Rate limiting currently uses IP address or token hash as identifier (`mcpRateLimiter.ts:172-193`). For MCP key calls, the key ID or tenant ID should drive rate limiting, not just IP. For user JWT calls, userId + tenantId should be the key.

**Fix:** After auth gate (which now provides `CallerIdentity`), use:
- MCP key calls: `mcp_key:{keyId}` as rate limit identifier
- User JWT calls: `user:{userId}:{tenantId}` as rate limit identifier
- Fallback to IP only for unauthenticated discovery methods

**Files:** `supabase/functions/_shared/mcpRateLimiter.ts`, each server's rate limit call

---

## P2: Moderate (Functional) — Sessions 4-5

### P2-1: Input Validation Framework for MCP Tool Arguments **(Claude + ChatGPT "tool contracts")**

**Status:** TODO
**Estimated:** ~4 hours

**Problem:** All 11 servers destructure tool arguments directly from JSON without length limits, format validation, array size limits, or type coercion checks.

**Fix:** Create shared `mcpInputValidator.ts` in `_shared/` with:
- `validateUUID(value)` — UUID format check
- `validateString(value, maxLength)` — length limit
- `validateArray(value, maxItems)` — array size limit
- `validateDate(value)` — ISO date format
- `validateNPI(value)` — 10-digit Luhn check
- `validateMedicalCode(value, codeSystem)` — CPT/ICD-10/HCPCS format

**ChatGPT "Tool Contracts" extension:** Per-tool metadata defining:
- Allowed data classes (PHI/no PHI)
- Max rows / max payload bytes
- Required roles and scopes
- Logging requirements (redactions)

**Files:** New `supabase/functions/_shared/mcpInputValidator.ts` + each server's handler

---

### P2-2: Add PubMed to .mcp.example.json **(Claude)**

**Status:** TODO
**Estimated:** ~10 min

**Files:** `.mcp.example.json`

---

### P2-3: Database Query Timeouts for Tier 3 Servers **(Claude)**

**Status:** TODO
**Estimated:** ~2 hours

**Fix:** Add `AbortController` timeout or `statement_timeout` to database-heavy operations.

**Files:** `mcp-fhir-server/toolHandlers.ts`, `mcp-prior-auth-server/index.ts`

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

**Status:** TODO
**Estimated:** ~30 min

**Problem:** `docs/architecture/AI_FIRST_ARCHITECTURE.md` says "8 specialized MCP servers" but there are 11.

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
