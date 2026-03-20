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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);
```

| Do This | Not This |
|---------|----------|
| `import { createAdminClient } from "../_shared/supabaseClient.ts"` | `Deno.env.get("SUPABASE_URL")` scattered everywhere |
| `import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts"` | Inline `Deno.env.get()` with no fallback chain |
| User client for user-facing queries | Admin client for everything (bypasses RLS) |
| Admin client only for system/audit operations | Admin client for user data queries |

### Key Fallback Chain (from `_shared/env.ts`)

```
Service role: SB_SERVICE_ROLE_KEY -> SUPABASE_SERVICE_ROLE_KEY -> SB_SECRET_KEY
Anon key:     SB_ANON_KEY -> SUPABASE_ANON_KEY -> SB_PUBLISHABLE_API_KEY
```

**JWT format keys are required for auth operations.** The new `sb_publishable_*` / `sb_secret_*` format is NOT fully supported by Supabase JS client yet.

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

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase JWT anon key (required for auth) |
| `VITE_HCAPTCHA_SITE_KEY` | hCaptcha site key for bot protection |
| `VITE_ANTHROPIC_API_KEY` | Claude AI API key |

---

## 14. Supabase Key Migration (December 2025)

**Database:** Fully migrated to **PostgreSQL 17** via Supabase.

**Key Naming Convention (Current):**

| Key Name | Format | Usage |
|----------|--------|-------|
| `SB_PUBLISHABLE_API_KEY` | `sb_publishable_*` | New publishable key format |
| `SB_SECRET_KEY` | `sb_secret_*` | New secret key format (server-side only) |
| `SB_SERVICE_ROLE_KEY` | JWT (`eyJhbGci...`) | Legacy service role key (Supabase default name) |
| `SB_ANON_KEY` | JWT (`eyJhbGci...`) | Legacy JWT anon key |
| `SUPABASE_ANON_KEY` | JWT (`eyJhbGci...`) | Legacy JWT anon key (alias) |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT | Legacy service role key (alias) |

**IMPORTANT - Key Format Compatibility:**
- **Client-side auth REQUIRES the JWT format** (`VITE_SUPABASE_ANON_KEY` or `SB_ANON_KEY`)
- The new `sb_publishable_*` format is NOT yet supported by Supabase JS client for authentication
- Edge Functions should prefer `SB_ANON_KEY` (JWT) for user token validation
- Service role operations use `SB_SECRET_KEY` (new format works)
- Legacy JWT keys remain functional until fully deprecated by Supabase

**Order of Preference in Edge Functions:**
```typescript
// For user-context operations:
getEnv("SB_ANON_KEY", "SUPABASE_ANON_KEY", "SB_PUBLISHABLE_API_KEY")

// For service role operations (MUST include SB_SERVICE_ROLE_KEY):
getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY")
```

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

## 16. Common Issues

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
