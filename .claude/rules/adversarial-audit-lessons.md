# Adversarial Audit Lessons — Rules That Survive Context Loss

These rules were created after an adversarial codebase audit (March 2026) exposed 20 findings, including critical security gaps. Every rule here exists because AI drift + context loss caused a real bug that survived to mainline.

---

## 1. Codebase-Wide Grep on Every Bug Fix — NO EXCEPTIONS

**When you fix a bug, grep the ENTIRE codebase for the same pattern.**

The `profiles.id` bug was fixed once in migration `20251003000003`. It came back in 3 more edge functions because nobody searched for sister occurrences. The `send_email` vs `send-email` naming mismatch exists in 3 functions — fixing one without grepping leaves two broken.

```bash
# AFTER fixing any bug, run a sweep:
# Example: fixed .eq('id', user_id) on profiles → search for ALL occurrences
grep -r "\.eq('id'" supabase/functions/ --include="*.ts"
grep -r '\.eq("id"' supabase/functions/ --include="*.ts"

# Example: fixed function name mismatch → search for ALL invocations
grep -r "invoke.*send_email" supabase/functions/ --include="*.ts"
grep -r "invoke.*send-email" supabase/functions/ --include="*.ts"
```

**Rule:** Every fix must include:
1. The specific fix
2. A codebase-wide grep for the same pattern
3. A report of how many sister occurrences were found and fixed

**If you skip the grep, the bug WILL come back in a different file.**

---

## 2. Every Edge Function Must Have Auth — NO EXCEPTIONS

**Before declaring an edge function "done," verify it has authentication and authorization.**

The `send-sms` and `send-email` functions shipped with zero auth — any HTTP client could send messages to any recipient. This is the single most dangerous pattern in the codebase.

### Edge Function Auth Checklist

Every edge function MUST have:

| Check | How | Why |
|-------|-----|-----|
| JWT verification | `const { user } = await supabase.auth.getUser(token)` | Confirms caller identity |
| Role gating | Check `profiles.role_id` or `user_roles` for allowed roles | Not every authenticated user should access every function |
| Tenant isolation | Scope all queries to caller's `tenant_id` | Prevent cross-tenant data access |
| Rate limiting | Import from `_shared/rateLimiter.ts` | Prevent abuse even by authorized users |
| Input validation | Zod schema or manual validation | Prevent injection and malformed requests |

### Auth Pattern Template

```typescript
import { createUserClient, createAdminClient } from "../_shared/supabaseClient.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const { headers: corsHeaders } = corsFromRequest(req);

  // 1. Require Bearer token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // 2. Verify user identity
  const token = authHeader.replace("Bearer ", "");
  const supabase = createUserClient(authHeader);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // 3. Check role (customize allowed roles per function)
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id, role_id")
    .eq("user_id", user.id)  // ← ALWAYS user_id, NEVER id
    .single();

  // 4. Tenant isolation — scope all downstream queries
  const tenantId = profile?.tenant_id;

  // 5. Your logic here...
});
```

### Functions That Send External Messages Are HIGH RISK

Any function that sends SMS, email, push notifications, or calls external APIs (Twilio, MailerSend, FCM) MUST have:
- Admin or clinical role requirement (not just "authenticated")
- Recipient validation (recipient belongs to caller's tenant)
- Rate limiting (prevent spam even by authorized users)
- Audit logging (who sent what to whom)

---

## 3. No Secrets in VITE_ Environment Variables

**`VITE_` prefix = shipped to every browser.** Anything with `VITE_` is in the JS bundle, visible in DevTools, and extractable by anyone.

| Safe for VITE_ | NEVER VITE_ |
|----------------|-------------|
| Supabase URL | API keys (Anthropic, OpenAI, etc.) |
| Supabase anon key (designed to be public) | OAuth client secrets |
| hCaptcha site key (designed to be public) | Webhook URLs (Slack, Discord, etc.) |
| Firebase API key (designed to be public) | Service role keys |
| Feature flags | Encryption keys |

**If a service needs a secret API key, it MUST go through an edge function.** The edge function holds the secret server-side and the browser calls the edge function.

**Before creating any new `VITE_*` variable, ask:** "Would I be comfortable if every user could see this value?" If no, it needs a server-side proxy.

---

## 4. RLS Policies Must Enforce Identity — Never `WITH CHECK (true)` on Sensitive Tables

**`WITH CHECK (true)` on audit/security tables = no security.**

The audit_logs table had progressively weakened RLS across 3 migrations, ending with `WITH CHECK (true)` that allows any authenticated user to insert records with any `actor_user_id`. This makes the audit trail spoofable — fatal for HIPAA.

### Rules for Audit/Security Table RLS

| Table Pattern | INSERT Policy Must Include |
|---------------|---------------------------|
| `audit_logs` | `actor_user_id = auth.uid()` |
| `phi_access_logs` | `accessing_user_id = auth.uid()` |
| `admin_audit_log` | `admin_user_id = auth.uid()` |
| Any `*_log` or `*_audit` table | Identity column = `auth.uid()` |

**Exception:** Service role INSERT (for edge functions acting on behalf of system) may use `WITH CHECK (true)` because service role already bypasses RLS. But `authenticated` and `anon` roles MUST have identity enforcement.

**Anon should NEVER be able to insert into audit/security tables.**

---

## 5. Never Shadow Imported Variables — Rename or Use Directly

```typescript
// BAD — self-referential shadowing, confusing, error-prone
const SUPABASE_URL = SUPABASE_URL;

// GOOD — use the import directly
const url = SUPABASE_URL;

// BEST — just use SUPABASE_URL where you need it, no local variable
await fetch(`${SUPABASE_URL}/functions/v1/send-email`, { ... });
```

---

## 6. Verify JWT Signatures — Never Decode Without Verification

**`atob(token.split('.')[1])` is NOT authentication.** It reads the payload without checking if it was tampered with.

```typescript
// BAD — anyone can craft a fake JWT payload
const payload = JSON.parse(atob(token.split('.')[1]));
const userId = payload.sub; // attacker-controlled!

// GOOD — verify through Supabase auth
const { data: { user }, error } = await supabase.auth.getUser(token);
const userId = user?.id; // cryptographically verified
```

**Rule:** In edge functions, ALWAYS use `supabase.auth.getUser(token)` or `supabase.auth.getClaims()` to extract user identity. Never manually decode JWTs.

---

## 7. Function Invocation Names Must Match Directory Names

Supabase edge function names are their **directory names** (with dashes). When invoking one function from another:

```typescript
// The function lives at: supabase/functions/send-email/index.ts
// Therefore the invocation name is: "send-email" (with dash)

// BAD — will silently fail (function not found)
await supabase.functions.invoke('send_email', { body });

// GOOD — matches the directory name
await supabase.functions.invoke('send-email', { body });
```

**Before writing a `functions.invoke()` call:**
1. Check the actual directory name: `ls supabase/functions/ | grep <name>`
2. Use that exact name (dashes, not underscores)

---

## 8. profiles Table Uses user_id, Not id

The `profiles` table primary key is `user_id` (references `auth.users.id`). **It is NOT `id`.**

```typescript
// BAD — profiles has no "id" column as PK, this returns nothing
const { data } = await supabase.from('profiles').select('*').eq('id', userId);

// GOOD — correct column name
const { data } = await supabase.from('profiles').select('first_name, last_name, tenant_id').eq('user_id', userId);
```

This bug has been fixed and reintroduced multiple times. **If you are querying profiles, the column is `user_id`. Period.**

---

## 9. Cross-Session Regression Prevention

When a bug is fixed, create a **grep command** in the commit message or tracker that future sessions can re-run to verify it hasn't regressed:

```
Fix: profiles.user_id (A-9)
Regression check: grep -r "from.*profiles.*\.eq.*['\"]id['\"]" supabase/functions/ --include="*.ts"
Expected: 0 results
```

This allows any future session to run the check without remembering the history.

---

## 10. Adversarial Audit Cadence

**Before any major demo or pilot, run an adversarial audit using a different AI model.** The builder cannot objectively audit their own work — confirmation bias is real and documented in this codebase's history.

Audit checklist:
- [ ] Every edge function has auth (JWT + role + tenant)
- [ ] No `VITE_` secrets in frontend
- [ ] Audit log RLS enforces `auth.uid()`
- [ ] Function invocation names match directory names
- [ ] `profiles` queries use `user_id` not `id`
- [ ] CORS does not allow wildcard patterns
- [ ] No variable shadowing of imports
- [ ] JWTs are verified, not just decoded
