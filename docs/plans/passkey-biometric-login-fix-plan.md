# Passkey/Biometric Login Fix — Implementation Plan

## Overview

Fix 10 issues in the server-side passkey authentication system so that biometric login actually works end-to-end. Client-side code (`passkeyService.ts`, `PasskeySetup.tsx`, `LoginPage.tsx`) is solid — all work is in the 4 edge functions under `supabase/functions/passkey-*`.

## Time Estimate

~8-12 hours across 1-2 sessions.

---

## Issues (Prioritized)

### P0 — Broken (system literally cannot work)

| # | Issue | File | Impact |
|---|-------|------|--------|
| 1 | **`register-finish` does NOT verify attestation** — stores raw `attestationObject` as `public_key` instead of extracting the COSE public key via `verifyRegistrationResponse` | `passkey-register-finish/index.ts` | Registration stores garbage; auth-finish can't verify signatures |
| 2 | **Auth will always fail** — `auth-finish` feeds an attestation blob (stored as `public_key`) into `verifyAuthenticationResponse` where a COSE key is expected | `passkey-auth-finish/index.ts` | Login always fails with signature verification error |

### P1 — Wrong data (silent failures, compliance gaps)

| # | Issue | File | Impact |
|---|-------|------|--------|
| 3 | **`passkey_audit_log` column mismatch** — edge functions insert `operation` + `resource_type` but table has `action` column and no `resource_type` | `passkey-auth-finish/index.ts` lines 95-96, 280-281, 324-325 | Audit inserts silently fail; HIPAA audit trail broken for passkey-specific events |
| 4 | **`SELECT *` in 4 places** — violates codebase rule, wastes bandwidth, may expose future columns | `passkey-auth-finish/index.ts` lines 44, 87, 246; `passkey-register-finish/index.ts` line 57 | Compliance violation, potential PHI leak |
| 5 | **Session creation via magic link is fragile** — `generateLink({type:'magiclink'})` relies on undocumented `properties.access_token`; creates fake `@passkey.local` emails | `passkey-auth-finish/index.ts` lines 252-274 | May not return valid session tokens; pollutes user emails |

### P2 — Missing safety / quality

| # | Issue | File | Impact |
|---|-------|------|--------|
| 6 | **`cleanup_expired_passkey_challenges` missing `SET search_path = public`** — `SECURITY DEFINER` function without search_path is a Supabase security advisor error | `20251128200000_create_passkey_system.sql` | Search path injection vulnerability |
| 7 | **No `tenant_id` on `passkey_credentials`** — multi-tenant system but credentials aren't tenant-scoped | Migration | Cross-tenant credential visibility (mitigated by `user_id` RLS but violates tenant isolation pattern) |

### P3 — Missing tests

| # | Issue | File | Impact |
|---|-------|------|--------|
| 8 | **No tests for `passkey-register-start` or `passkey-register-finish`** | Missing entirely | Zero coverage on registration edge functions |
| 9 | **Edge function tests are Tier 5 fakes** — test local data structures, never call `serve()` | `passkey-auth-start/__tests__/`, `passkey-auth-finish/__tests__/` | Tests pass but verify nothing about actual behavior |
| 10 | **No `PasskeySetup` component test** | Missing | UI component with user interactions untested |

---

## Files to Create/Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `supabase/functions/passkey-register-finish/index.ts` | **Rewrite** | Add `verifyRegistrationResponse` from SimpleWebAuthn; extract COSE public key; store properly |
| `supabase/functions/passkey-auth-finish/index.ts` | **Modify** | Fix `SELECT *` → explicit columns; fix `passkey_audit_log` column names (`action` not `operation`, remove `resource_type`); review session creation |
| `supabase/functions/passkey-auth-start/index.ts` | **Modify** | Fix `passkey_audit_log` inserts if any; minor cleanup |
| `supabase/functions/passkey-register-start/index.ts` | **Modify** | Minor — use shared client pattern, add audit logging |
| `supabase/migrations/YYYYMMDDHHMMSS_fix_passkey_security_definer.sql` | **Create** | Add `SET search_path = public` to `cleanup_expired_passkey_challenges` |
| `supabase/functions/passkey-register-start/__tests__/index.test.ts` | **Create** | Behavioral tests for registration start |
| `supabase/functions/passkey-register-finish/__tests__/index.test.ts` | **Create** | Behavioral tests for registration finish |
| `supabase/functions/passkey-auth-start/__tests__/index.test.ts` | **Rewrite** | Replace Tier 5 fake tests with behavioral tests |
| `supabase/functions/passkey-auth-finish/__tests__/index.test.ts` | **Rewrite** | Replace Tier 5 fake tests with behavioral tests |
| `src/components/__tests__/PasskeySetup.test.tsx` | **Create** | Component tests for registration UI, device management |

## Database Migrations Needed

- [ ] Migration: `fix_passkey_security_definer.sql` — `ALTER FUNCTION cleanup_expired_passkey_challenges() SET search_path = public;`
- [ ] Migration: `add_tenant_id_to_passkey_credentials.sql` — Add `tenant_id UUID NOT NULL REFERENCES tenants(id)` column, index on `tenant_id`, update RLS policies to include `tenant_id = get_current_tenant_id()`. Every multi-tenant table has this — passkeys are not an exception.

## Implementation Order

### Step 1: Fix `passkey-register-finish` (P0 — #1)
- Import `verifyRegistrationResponse` from SimpleWebAuthn (same Deno import pattern as auth-finish)
- Verify the attestation response server-side
- Extract and store the COSE public key (from `verification.registrationInfo.credentialPublicKey`)
- Store the actual credential ID from verification (not raw client data)
- Store initial counter from verification info
- This is the **root cause** of issue #2 as well — once register stores the right public key, auth-finish verification will work

### Step 2: Fix `passkey-auth-finish` (P1 — #3, #4)
- Replace all `select('*')` with explicit column lists
- Fix `passkey_audit_log` inserts: `operation` → `action`, remove `resource_type`
- Verify the `verifyAuthenticationResponse` call uses the correct credential format now that register-finish stores properly

### Step 3: Fix `passkey-auth-start` and `register-start` (P1 — #4)
- Replace any `select('*')` with explicit columns
- Fix any `passkey_audit_log` column name mismatches
- Add audit logging to register-start if missing

### Step 4: Security migration (P2 — #6)
- Create migration to fix `SET search_path = public` on the SECURITY DEFINER function

### Step 5: Review session creation (P1 — #5)
- Research whether `generateLink({type:'magiclink'})` is the right pattern
- Check if `supabase.auth.admin.createUser` or `supabase.auth.admin.updateUserById` with `signInWithPassword` is better
- The `@passkey.local` fallback email is concerning — investigate alternatives
- **Note:** Other edge functions (login, sms-verify-code) use the same pattern, so this may be the accepted Supabase approach. Verify before changing.

### Step 6: Rewrite edge function tests (P3 — #8, #9)
- Delete the Tier 5 fake tests
- Write behavioral tests that mock Supabase client and verify:
  - Correct HTTP method enforcement
  - Auth header validation
  - Challenge generation and storage
  - Attestation verification (register-finish)
  - Signature verification (auth-finish)
  - Audit log insertion with correct column names
  - Error handling paths

### Step 7: Add PasskeySetup component test (P3 — #10)
- Test: renders biometric setup when supported
- Test: shows unsupported message when WebAuthn not available
- Test: registers new passkey (calls registerPasskey)
- Test: lists existing credentials
- Test: deletes credential with confirmation
- Test: error handling for failed registration

## Test Plan

- [ ] `passkey-register-start`: challenge generation, auth validation, CORS, audit logging
- [ ] `passkey-register-finish`: attestation verification, credential storage, challenge validation, audit logging
- [ ] `passkey-auth-start`: challenge generation, credential lookup, CORS, audit logging
- [ ] `passkey-auth-finish`: signature verification, session creation, counter update, audit logging, error paths
- [ ] `PasskeySetup.tsx`: registration flow, device list, deletion, error states, unsupported browser

## Verification Checklist

- [ ] All files under 600 lines
- [ ] No `any` types — `unknown` + type guards
- [ ] No `console.log` — `auditLogger` only
- [ ] No `SELECT *` in edge functions
- [ ] `passkey_audit_log` inserts use `action` column (not `operation`)
- [ ] `verifyRegistrationResponse` called in register-finish
- [ ] COSE public key stored (not attestation object)
- [ ] `cleanup_expired_passkey_challenges` has `SET search_path = public`
- [ ] `bash scripts/typecheck-changed.sh` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Scope

- Files: 2 new, 8 modified (4 edge functions + 4 test files + 1 migration + 1 component test)
- Approximate lines: ~800 new/modified
- Complexity: **Medium-High** — WebAuthn cryptographic verification is the hard part; the rest is column fixes and test writing

## Decision Log

**Tenant isolation (#7):** Maria approved 2026-03-24 — add `tenant_id` to `passkey_credentials`. Every multi-tenant table has it. No exceptions, no skipping.
