# Supabase Rules — Database, Edge Functions, Auth, RLS

This codebase runs on **PostgreSQL 17 via Supabase**. Every rule here exists because an AI coding assistant got it wrong at least once.

---

## 1. Migration Discipline — RUN WHAT YOU CREATE

**Creating a migration file is NOT the same as applying it.** The database does not have your new column/table/view until you push.

```bash
# After creating any migration file:
npx supabase db push

# Verify it succeeded (check for errors in output)
# Then test that the new schema works

# Login early - takes 30-60 seconds
npx supabase login

# Link to project (if not already linked)
npx supabase link --project-ref xkybsjnvuohpqpbkikyn
```

| Do This | Not This |
|---------|----------|
| Create migration, push, then write service code | Write service code assuming the column exists |
| Check `npx supabase db push` output for errors | Assume silence means success |
| Test the new schema with a query | Move on to the next task |

**Migration file naming:** `supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql`

**If you write service code that references a column/table that doesn't exist yet, the code compiles but fails at runtime.** The migration file is not proof — the push is.

---

## 2. Row Level Security (RLS) — EVERY TABLE, NO EXCEPTIONS

**Every new table MUST have RLS enabled and at least one policy.**

```sql
-- Step 1: ALWAYS enable RLS
ALTER TABLE public.my_new_table ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policies (at minimum, tenant isolation)
CREATE POLICY "Tenant isolation" ON public.my_new_table
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());
```

### RLS Policy Patterns (Use These)

| Pattern | When to Use | Example |
|---------|-------------|---------|
| **Tenant isolation** | Multi-tenant tables with `tenant_id` | `USING (tenant_id = get_current_tenant_id())` |
| **User ownership** | Personal data (check-ins, profiles) | `USING (user_id = auth.uid())` |
| **Role-based** | Admin/clinician-only tables | `USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))` |
| **Tenant + user** | User data within a tenant | `USING (tenant_id = get_current_tenant_id() AND user_id = auth.uid())` |
| **Tenant + role** | Admin data within a tenant | `USING (tenant_id = get_current_tenant_id() AND is_tenant_admin())` |

### RLS Rules

| Rule | Why |
|------|-----|
| Every new table gets `ENABLE ROW LEVEL SECURITY` | A table without RLS is open to all authenticated users |
| Use `get_current_tenant_id()` for tenant isolation | This is the canonical function — do not re-implement |
| Use `auth.uid()` for user-scoped data | Supabase provides this from the JWT |
| Separate SELECT/INSERT/UPDATE/DELETE policies when permissions differ | `FOR ALL` is a shortcut — use it only when all operations have the same rule |
| Test RLS by querying as an anon/authenticated user | Service role bypasses RLS — it cannot verify your policies |

### Common RLS Mistakes (AI Makes These)

| Mistake | Fix |
|---------|-----|
| Forgetting `ENABLE ROW LEVEL SECURITY` entirely | Add it immediately after `CREATE TABLE` |
| Writing `WITH CHECK` but no `USING` clause | `WITH CHECK` controls writes, `USING` controls reads — you need both |
| Using `FOR ALL` when INSERT needs different rules | Split into `FOR SELECT`, `FOR INSERT`, etc. |
| Not testing with a non-service-role client | Service role bypasses all RLS — your policy could be broken and you'd never know |
| Hardcoding tenant IDs in policies | Use `get_current_tenant_id()` which reads from the JWT |

---

## 3. Views — security_invoker = on

**Every new view MUST use `security_invoker = on`.** This ensures RLS on the underlying tables is enforced for the calling user, not the view creator.

```sql
-- CORRECT: RLS applies to the caller
CREATE OR REPLACE VIEW v_my_view
WITH (security_invoker = on) AS
SELECT id, name, tenant_id
FROM my_table;

-- WRONG: RLS applies to the view OWNER (usually postgres — bypasses everything)
CREATE OR REPLACE VIEW v_my_view AS
SELECT id, name, tenant_id
FROM my_table;
```

| Do This | Not This |
|---------|----------|
| `WITH (security_invoker = on)` on every view | Omitting security_invoker (defaults to DEFINER) |
| Comment explaining what RLS the view relies on | Bare view with no context |
| Grant SELECT to `authenticated` role explicitly | Assuming access works |

**Why:** Without `security_invoker`, the view runs as the owner (postgres), which bypasses ALL RLS policies. This is the #1 security hole in Supabase views. We fixed 53 views in migration `20260208020000_security_advisor_errors.sql`.

---

## 4. Functions — SECURITY DEFINER vs INVOKER

```sql
-- SECURITY INVOKER (default, preferred): runs as the calling user
-- RLS applies normally. Use for most functions.
CREATE OR REPLACE FUNCTION my_function()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER  -- caller's permissions
AS $$ BEGIN ... END; $$;

-- SECURITY DEFINER: runs as the function owner (elevated privileges)
-- Bypasses RLS. Use ONLY when the function needs admin access.
CREATE OR REPLACE FUNCTION admin_only_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- owner's permissions (dangerous)
SET search_path = public  -- REQUIRED: prevent search_path injection
AS $$ BEGIN ... END; $$;
```

| Use INVOKER (default) | Use DEFINER (rare) |
|----------------------|-------------------|
| User-facing queries | System audit logging |
| Tenant-scoped operations | Cross-tenant aggregation |
| Anything where RLS should apply | Background jobs that need full access |

**SECURITY DEFINER requires `SET search_path = public`** to prevent search_path injection attacks. This is a Supabase security advisor requirement.

---

## 5. Schema Standards

### Table Creation Template

```sql
CREATE TABLE IF NOT EXISTS public.my_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  -- domain columns here
);

-- RLS (mandatory)
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.my_table
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- Indexes (add for frequently queried columns)
CREATE INDEX IF NOT EXISTS idx_my_table_tenant
  ON public.my_table(tenant_id);

-- Comment (required for clinical/billing tables)
COMMENT ON TABLE public.my_table IS 'Purpose of this table';
```

### Required Columns

| Column | Type | When Required |
|--------|------|---------------|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Every table |
| `tenant_id` | `UUID NOT NULL REFERENCES tenants(id)` | Every multi-tenant table |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Every table |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Every mutable table |
| `created_by` | `UUID REFERENCES auth.users(id)` | Tables where audit trail matters |

### Column Naming

| Convention | Example |
|-----------|---------|
| `snake_case` for all columns | `first_name`, `tenant_id`, `created_at` |
| `_id` suffix for foreign keys | `patient_id`, `tenant_id`, `provider_id` |
| `_at` suffix for timestamps | `created_at`, `updated_at`, `deleted_at` |
| `is_` prefix for booleans | `is_active`, `is_deleted`, `is_verified` |
| `_count` suffix for counters | `retry_count`, `login_count` |

### Identity Convention

| Context | Column Name | References |
|---------|------------|------------|
| Legacy tables | `user_id` | `auth.users(id)` |
| New clinical tables | `patient_id` | `auth.users(id)` |
| **New code standard** | **`patient_id`** | Both refer to the same `auth.users.id` |

Use `patient_id` in all new tables. The `patientContextService` abstracts the resolution between `user_id` and `patient_id`.

---

## 6. Edge Functions — Client Creation

**Use the shared client utilities. Do not create clients from scratch.**

```typescript
// PREFERRED: Use shared utilities from _shared/supabaseClient.ts
import { createAdminClient, createUserClient } from "../_shared/supabaseClient.ts";

// User-context (respects RLS) — for user-facing operations
const supabase = createUserClient(req.headers.get("Authorization"));

// Admin context (bypasses RLS) — for system operations only
const admin = createAdminClient();
```

```typescript
// ALSO ACCEPTABLE: Use shared env from _shared/env.ts
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);
```

| Do This | Not This |
|---------|----------|
| `import { createAdminClient } from "../_shared/supabaseClient.ts"` | `Deno.env.get("SUPABASE_URL")` scattered everywhere |
| `import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts"` | Inline `Deno.env.get()` with no fallback chain |
| `import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno"` | `import { createClient } from "jsr:@supabase/supabase-js@2"` (causes transitive npm:openai resolution failure) |
| User client for user-facing queries | Admin client for everything (bypasses RLS) |
| Admin client only for system/audit operations | Admin client for user data queries |

### Key Fallback Chain (from `_shared/env.ts`)

**New format keys are PRIMARY. Legacy JWT keys are FALLBACK ONLY.**

```
Publishable: SB_PUBLISHABLE_API_KEY -> SB_ANON_KEY -> SUPABASE_ANON_KEY
Secret:      SB_SECRET_KEY -> SB_SERVICE_ROLE_KEY -> SUPABASE_SERVICE_ROLE_KEY
```

**CRITICAL: These are DIFFERENT KEYS, not just different names.**
- `SB_PUBLISHABLE_API_KEY` (`sb_publishable_*` format) is a **different key** from `SUPABASE_ANON_KEY` (JWT `eyJhbGci...` format)
- `SB_SECRET_KEY` (`sb_secret_*` format) is a **different key** from `SUPABASE_SERVICE_ROLE_KEY` (JWT format)
- They have different formats, different privilege scopes, and different behavior
- Legacy JWT keys are deprecated by Supabase and losing privileges — do NOT treat them as interchangeable
- The fallback chain exists for resilience during migration, not because the keys are equivalent

### Edge Function Auth — MANDATORY (Adversarial Audit Rule)

**Every edge function MUST authenticate and authorize callers.** No exceptions. This rule exists because `send-sms` and `send-email` shipped with zero auth — any HTTP client could send messages to any recipient.

**Before declaring ANY edge function done, verify:**

| Check | Required? | How |
|-------|-----------|-----|
| JWT verification | YES — all functions | `supabase.auth.getUser(token)` |
| Role gating | YES — for functions that mutate or send | Check `user_roles` or `profiles.role_id` |
| Tenant isolation | YES — for multi-tenant data | Scope all queries to caller's `tenant_id` |
| Rate limiting | YES — for expensive operations (AI, messaging) | Import `_shared/rateLimiter.ts` |
| Input validation | YES — all functions | Zod schema or manual checks |

**Functions that send external messages (SMS, email, push) are HIGH RISK** and require admin/clinical role gating + recipient validation + rate limiting + audit logging.

**Querying `profiles` table:** The column is `user_id`, NOT `id`. This bug has been introduced and fixed multiple times. Always `.eq('user_id', userId)`.

**Invoking other functions:** Names use dashes, not underscores. Check `ls supabase/functions/` before writing `functions.invoke()`.

---

## 7. Edge Function CORS — Use the Shared Module

```typescript
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Your logic here...

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

| Do This | Not This |
|---------|----------|
| `corsFromRequest(req)` | Hardcoded `Access-Control-Allow-Origin: *` |
| `handleOptions(req)` for preflight | Manually building OPTIONS response |
| Add tenant domains to `ALLOWED_ORIGINS` env var | Wildcards or `WHITE_LABEL_MODE=true` |

**Why wildcards are forbidden:**
- Wildcards fail GitHub security scans
- Wildcards violate HIPAA § 164.312(e)(1) transmission security
- Wildcards enable clickjacking and data exfiltration attacks

**To add a new tenant domain:**
1. Add domain to `ALLOWED_ORIGINS` in Supabase secrets (comma-separated)
2. Redeploy edge functions: `npx supabase functions deploy --no-verify-jwt`

**DO NOT** enable `WHITE_LABEL_MODE` unless explicitly approved by Maria for dynamic tenant onboarding.

---

## 8. Auth Session Security — Server vs Client

| Method | Server-Safe? | Use Case |
|--------|-------------|----------|
| `supabase.auth.getSession()` | **NO** — can be spoofed | Client-side only (browser) |
| `supabase.auth.getClaims()` | **YES** — validates JWT | Edge functions, server-side |
| `supabase.auth.getUser()` | **YES** — calls Auth server | Edge functions when you need full profile |

**In edge functions:** Never trust client-provided session data. Use service role key to independently verify user data. Extract user from the JWT Authorization header.

---

## 9. Query Standards

### No SELECT *

```typescript
// BAD — fetches all columns, wastes bandwidth, may expose PHI
const { data } = await supabase.from("patients").select("*");

// GOOD — specify exactly what you need
const { data } = await supabase.from("patients").select("id, first_name, risk_level");
```

We fixed 270 files with `SELECT *` in commit `50c29cb5`. Do not re-introduce them.

### Pagination and Limits

```typescript
// Always limit results for list queries
const { data } = await supabase
  .from("patients")
  .select("id, first_name")
  .eq("tenant_id", tenantId)
  .order("created_at", { ascending: false })
  .limit(100);
```

### Error Handling

```typescript
const { data, error } = await supabase
  .from("table")
  .select("id, name")
  .eq("id", recordId)
  .single();

if (error) {
  return failure("DATABASE_ERROR", error.message, error);
}
// data is now safe to use
return success(data);
```

---

## 10. Deno Runtime Rules (Edge Functions Only)

Edge functions run in **Deno**, not Node.js. Different rules apply:

| Rule | Why |
|------|-----|
| Use explicit `.ts` extensions in imports | Deno requires them; Node/Vite strips them |
| Import from `https://esm.sh/` | Deno uses URL imports, not `node_modules` |
| No `process.env` | Use `Deno.env.get()` or shared `env.ts` |
| No `require()` | Deno uses ES modules only |
| `serve()` from `Deno.serve` or `https://deno.land/std/http/server.ts` | Edge function entry point |
| **Never use `jsr:@supabase/supabase-js@2`** | Causes transitive `npm:openai` resolution failure in `deno check` |
| **Never use `npm:` specifiers** (e.g., `npm:@anthropic-ai/sdk`) | Requires `node_modules` setup; use `https://esm.sh/` URL imports instead |
| **Never use `jsr:@supabase/functions-js/edge-runtime.d.ts`** | Same transitive dependency issue; not needed with `esm.sh` imports |
| Use `https://esm.sh/@supabase/supabase-js@2?target=deno` | Correct import for Supabase client in edge functions |
| Use `https://esm.sh/@anthropic-ai/sdk@VERSION?target=deno` | Correct import for Anthropic SDK in edge functions |

**Why `jsr:` and `npm:` are banned (April 2026):**

The `jsr:@supabase/functions-js` package declares `npm:openai@^4.52.5` as a transitive type dependency. When Deno tries to resolve this during `deno check`, it fails because there's no `node_modules` directory and no `nodeModulesDir` config. This caused 12 edge functions to fail type checking. The `npm:` specifier for Anthropic SDK has the same problem. The fix was a codebase-wide replacement of ALL `jsr:` and `npm:` imports with `esm.sh` URL imports (42 files).

**Import pattern (April 2026 standard):**
```typescript
// ✅ CORRECT — esm.sh with deno target
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0?target=deno";

// ❌ WRONG — jsr: pulls in npm:openai as transitive type dependency, breaks deno check
import { createClient } from "jsr:@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ❌ WRONG — npm: requires node_modules setup that edge functions don't have
import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";

// ❌ WRONG — npm:openai is NEVER directly imported, but jsr:@supabase/functions-js
// pulls it in as a transitive dependency. This is why jsr: imports are banned.
```

**If you see `Could not find a matching package for 'npm:openai'` in deno check output:**
The cause is a `jsr:@supabase/supabase-js` or `jsr:@supabase/functions-js` import somewhere.
Run: `grep -r "jsr:@supabase" supabase/functions/ --include="*.ts"` and replace with `esm.sh`.

---

## 11. Database Cleanup Policy — DO NOT DELETE

| Rule | Detail |
|------|--------|
| Tables that exist are FEATURES | Even if not currently referenced in code |
| Only delete obvious debug/backup tables | Tables starting with `_` prefix |
| NEVER delete without Maria's confirmation | Ask first, delete second |
| Dropping a column is permanent | There is no `git revert` for data loss |
| Views are coupling layers | Deleting a view may break cross-system reads |

---

## 12. Realtime Subscriptions

```typescript
// Subscribe to changes with tenant filtering
const channel = supabase
  .channel("my-channel")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "my_table",
      filter: `tenant_id=eq.${tenantId}`,
    },
    (payload) => handleChange(payload)
  )
  .subscribe();

// ALWAYS clean up on unmount
return () => {
  supabase.removeChannel(channel);
};
```

---

## 13. Environment Variables

### Frontend (Vite — browser-visible)

| Variable | Purpose | Status |
|----------|---------|--------|
| `VITE_SB_URL` | Supabase project URL | **PRIMARY** |
| `VITE_SB_PUBLISHABLE_API_KEY` | Supabase publishable key (`sb_publishable_*` format) | **PRIMARY** |
| `VITE_SUPABASE_URL` | Supabase project URL | Legacy fallback |
| `VITE_SUPABASE_ANON_KEY` | Supabase JWT anon key (`eyJhbGci...` format) | Legacy fallback — DIFFERENT KEY |
| `VITE_HCAPTCHA_SITE_KEY` | hCaptcha site key for bot protection | Active |

### Edge Functions / Server-Side (NOT browser-visible)

| Variable | Purpose | Status |
|----------|---------|--------|
| `SB_URL` | Supabase project URL | **PRIMARY** |
| `SB_PUBLISHABLE_API_KEY` | Publishable key (`sb_publishable_*` format) | **PRIMARY** |
| `SB_SECRET_KEY` | Secret key (`sb_secret_*` format) | **PRIMARY** |
| `SUPABASE_URL` | Supabase project URL | Legacy fallback |
| `SUPABASE_ANON_KEY` | JWT anon key (`eyJhbGci...`) | Legacy fallback — DIFFERENT KEY |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT service role key | Legacy fallback — DIFFERENT KEY |
| `ANTHROPIC_API_KEY` | Claude AI API key (Supabase secrets only) | Active |

**Rule:** Always use `SB_*` names in new code. Never introduce `SUPABASE_*` names.

---

## 14. Supabase Key Migration (December 2025, updated April 2026)

**Database:** Fully migrated to **PostgreSQL 17** via Supabase.

### These Are DIFFERENT KEYS — Not Just Different Names

Supabase introduced a new key format in late 2025. The new keys are **completely different credentials** with different formats, different privilege scopes, and different behavior. They are NOT aliases for the same key.

| Key | Format | Type | Status |
|-----|--------|------|--------|
| `SB_PUBLISHABLE_API_KEY` | `sb_publishable_*` | New publishable key | **PRIMARY** |
| `SB_SECRET_KEY` | `sb_secret_*` | New secret key (server-side only) | **PRIMARY** |
| `SB_ANON_KEY` / `SUPABASE_ANON_KEY` | JWT (`eyJhbGci...`) | Legacy anon key | **DEPRECATED — fallback only** |
| `SB_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | JWT (`eyJhbGci...`) | Legacy service role key | **DEPRECATED — fallback only** |

**Why this matters:**
- Legacy JWT keys are being deprecated by Supabase and are losing privileges over time
- The new `sb_publishable_*` key is NOT equivalent to the JWT anon key — different scopes
- The new `sb_secret_*` key is NOT equivalent to the JWT service role key — different scopes
- Substituting one for the other WILL cause auth failures
- New code MUST use `SB_*` names, never `SUPABASE_*`

### Fallback Order (new keys FIRST, legacy as resilience only)

```typescript
// For user-context / publishable operations:
getEnv("SB_PUBLISHABLE_API_KEY", "SB_ANON_KEY", "SUPABASE_ANON_KEY")

// For service role / secret operations:
getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY")

// Frontend (Vite):
import.meta.env.VITE_SB_PUBLISHABLE_API_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

// URL:
import.meta.env.VITE_SB_URL || import.meta.env.VITE_SUPABASE_URL
```

### CI/CD and GitHub Secrets

When configuring secrets in GitHub, Vercel, or any deployment platform, use the new names:
- `SB_URL` (not `SUPABASE_URL`)
- `SB_PUBLISHABLE_API_KEY` (not `SUPABASE_ANON_KEY` — it's a different key)
- `SB_SECRET_KEY` (not `SUPABASE_SERVICE_ROLE_KEY` — it's a different key)

---

## 15. JWT Standards

### JWT Fundamentals (Supabase)

**Structure:** `<header>.<payload>.<signature>` (Base64-URL encoded JSON)

**Key Claims in Supabase JWTs:**
| Claim | Description |
|-------|-------------|
| `iss` | Issuer URL (e.g., `https://project_id.supabase.co/auth/v1`) |
| `exp` | Expiration timestamp (after which token is invalid) |
| `sub` | Subject - the unique user ID |
| `role` | Postgres role for RLS (`authenticated`, `anon`, etc.) |

**Verification Methods:**
1. **Supabase Auth JWTs**: Use `supabase.auth.getClaims()` or JWKS endpoint
2. **Legacy/Custom JWTs (HS256)**: Verify via Auth server: `GET /auth/v1/user`
3. **JWKS Endpoint**: `https://project-id.supabase.co/auth/v1/.well-known/jwks.json` (cached 10 min)

**Security Considerations:**
- Shared secrets (HS256) are **NOT recommended** for HIPAA/SOC2/PCI-DSS compliance
- Prefer asymmetric keys (RSA, EC) for production
- Wait **20+ minutes** after rotating signing keys (due to 10 min edge cache)
- Never implement JWT verification manually - use established libraries (`jose`, etc.)

**Client Library Usage (Custom JWTs):**
```typescript
// DON'T: Set custom Authorization headers
// DO: Use accessToken option
const supabase = createClient(url, key, {
  accessToken: async () => '<your JWT here>'
});
```

### JWT Signing Keys System

**Two Systems (Legacy vs New):**
| System | Type | Recommendation |
|--------|------|----------------|
| Legacy JWT Secret | Shared secret (HS256) | **NOT recommended** - hard to rotate, signs anon/service_role |
| Signing Keys | Asymmetric (ES256/RS256) | **Recommended** - zero-downtime rotation, HIPAA compliant |
| Signing Keys | Shared secret (HS256) | Available but not recommended |

**CRITICAL: `anon` and `service_role` ARE JWTs** signed by the legacy JWT secret. Revoking the legacy secret requires disabling these keys first.

**Algorithm Recommendations:**
| Algorithm | JWT `alg` | Notes |
|-----------|-----------|-------|
| NIST P-256 (EC) | ES256 | **Recommended** - fast, short signatures, good for cookies |
| RSA 2048 | RS256 | Widely supported but slower |
| Ed25519 | EdDSA | Coming soon |
| HMAC | HS256 | **Avoid** - compliance issues, can't revoke without downtime |

**Key Lifecycle:** `standby` → `in use` → `previously used` → `revoked` → `delete`

**Timing Constraints:**
- **5 minutes**: Wait between key state changes
- **10 min edge cache + 10 min client cache = 20 min total propagation**
- **Wait `access_token_expiry + 15 min`** before revoking old key (prevents user signouts)

**Key Rotation (Zero-Downtime):**
1. Create standby key (asymmetric preferred)
2. Wait for JWKS cache propagation (~20 min)
3. Rotate keys (Auth starts using new key)
4. Wait `access_token_expiry + 15 min`
5. Revoke old key

**Minting Custom JWTs:**
```bash
# Generate a signing key
supabase gen signing-key --algorithm ES256

# Generate a bearer token
supabase gen bearer-jwt --role authenticated --sub <user-uuid>
```

**Custom JWT Required Headers:**
```json
{ "alg": "ES256", "kid": "<key-id-from-import>", "typ": "JWT" }
```

**Custom JWT Required Claims:**
```json
{ "sub": "<user-uuid>", "role": "authenticated", "exp": <timestamp> }
```

**Security Notes:**
- Private keys **cannot be extracted** from Supabase (security feature)
- To use your own key: generate locally, import to Supabase
- Separate `apikey` header still required (publishable/secret) - JWT alone won't work

---

## 17. PHI Encryption Architecture — TWO KEYS, NEVER CONFLATE

**This codebase runs two products (WellFit + Envision Atlus) with SEPARATE PHI encryption keys from SEPARATE key stores.** Confusing the two breaks clinical data encryption and is a HIPAA exposure. This is the #1 footgun in the encryption layer.

### The two keys

| Product | Key store | Variable name | Format |
|---|---|---|---|
| **WellFit (community)** | Supabase **Secrets** | `PHI_ENCRYPTION_KEY` (read in edge fns via `Deno.env.get('PHI_ENCRYPTION_KEY')`; persists into Postgres setting `app.settings.PHI_ENCRYPTION_KEY` for SQL contexts) | Plain string |
| **Envision Atlus (clinical)** | Supabase **Vault** | `app.encryption_key` (read in SQL via `vault.decrypted_secrets`; persists into Postgres setting `app.phi_encryption_key` for SQL contexts) | Plain string |

### How the encrypt_phi_text RPC selects which key

```sql
key_to_use := COALESCE(
  encryption_key,                              -- 1. caller-provided arg (WellFit edge fn passes this)
  current_setting('app.phi_encryption_key', true), -- 2. session-level setting (Envision Atlus Vault-derived)
  'PHI-ENCRYPT-2025-WELLFIT-SECURE-KEY-V1'     -- 3. WellFit community fallback (LAST resort)
);
```

The `use_clinical_key` parameter (where it exists in callers) controls which path: `true` lets the RPC fall through to priority 2 (Vault), `false` makes the caller pass the WellFit Secrets key as priority 1.

### Which path is which caller

| Caller | Uses which key? | How |
|---|---|---|
| `supabase/functions/phi-encrypt/index.ts` (edge fn) | **WellFit Secrets** | Reads `Deno.env.get('PHI_ENCRYPTION_KEY')` and passes it explicitly as the `encryption_key` arg → priority 1 in COALESCE |
| `src/services/handoffService.ts` `encryptPHI()` / `decryptPHI()` | **Envision Atlus Vault** | Calls the RPC with `encryption_key: null` → priority 1 misses, falls through to priority 2 (Vault-derived session setting) |
| `supabase/functions/get-risk-assessments/index.ts` | **WellFit Secrets** | Reads `Deno.env.get('PHI_ENCRYPTION_KEY')` directly |
| `src/services/chwService.ts` (via `phiEncryptionClient.ts`) | **WellFit Secrets** | Calls the phi-encrypt edge function |

### What NOT to do

| Don't | Do |
|---|---|
| Assume "the PHI key" is singular | Always ask "which product's PHI?" before touching encryption code |
| Move the Vault key into env vars or vice versa | The split is deliberate — different scopes, different rotation cadences, different threat models |
| Pass an explicit `encryption_key` arg from a clinical caller (Atlus) | Pass `encryption_key: null` so the RPC uses the Vault key via `current_setting` |
| Pass `encryption_key: null` from a community caller (WellFit) | Explicitly pass `Deno.env.get('PHI_ENCRYPTION_KEY')` |
| Forget to set the Vault secret on a new Atlus environment | Without it, the RPC falls through to priority 3 (WellFit fallback) — Atlus data encrypts with the WRONG key |

### Verification

To confirm both keys are configured in any environment:

1. **WellFit Secrets:** `supabase secrets list | grep PHI_ENCRYPTION_KEY` (CLI) OR Supabase Dashboard → Project Settings → Edge Functions → Secrets.
2. **Envision Atlus Vault:** `SELECT name FROM vault.secrets WHERE name = 'app.encryption_key';` via MCP `execute_sql`. (Vault contents are never readable; only the presence of the secret is.)

Tests documenting this architecture live in `src/services/__tests__/phiEncryption.test.ts` (Key Management describe block, lines ~260-279).

### Migration history

The current `encrypt_phi_text` function lives in migration `20251115180000_create_phi_encryption_functions.sql` and was later fixed for hardcoded-key fallback by `20251120000000_fix_hardcoded_phi_encryption_key.sql`. If the encrypt/decrypt behavior changes, those are the canonical files.

---

## 18. Common Issues

### Supabase Timing
**Wait at least 60 seconds** after deploying edge functions or running migrations before testing.

### Null-Safe Number Formatting
```typescript
// Safe - handles null values
{(metrics.total_saved ?? 0).toFixed(2)}

// Safe division - prevents divide by zero
{(((numerator ?? 0) / (denominator || 1)) * 100).toFixed(0)}%
```

---

## Quick Reference: Migration Checklist

Before considering a migration complete:

1. [ ] `ENABLE ROW LEVEL SECURITY` on every new table
2. [ ] At least one RLS policy per table (tenant isolation minimum)
3. [ ] `security_invoker = on` on every new view
4. [ ] `SET search_path = public` on every `SECURITY DEFINER` function
5. [ ] Indexes on `tenant_id` and frequently queried columns
6. [ ] `npx supabase db push` executed and verified
7. [ ] Service code written AFTER migration is pushed (not before)
