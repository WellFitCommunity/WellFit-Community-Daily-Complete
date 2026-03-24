# Passkey/Biometric Login Fix — Tracker

> **Purpose:** Fix 10 issues in server-side passkey authentication so biometric login works end-to-end. Client-side code is solid — all work is in 4 edge functions + tests + 1 migration.

**Created:** 2026-03-24
**Owner:** Maria (approved direction), Claude implementing
**Plan:** `docs/plans/passkey-biometric-login-fix-plan.md`
**Estimated Total:** ~8-12 hours across 1-2 sessions
**Baseline:** 4 edge functions, 1 client service (good), 1 UI component (good), 2 fake test files, 2 missing test files, 1 missing component test

---

## Audit Summary (2026-03-24)

| Metric | Before | After |
|--------|--------|-------|
| Registration attestation verification | Not implemented | `verifyRegistrationResponse` from SimpleWebAuthn v10 |
| Public key stored correctly | Stores attestation blob | Stores COSE public key (base64url) |
| Auth signature verification | Always fails (wrong key format) | Works with correct COSE key |
| `passkey_audit_log` inserts | Wrong column names (silently fail) | Correct: `action` column, no `resource_type` |
| `SELECT *` in edge functions | 4 occurrences | 0 — explicit columns everywhere |
| SECURITY DEFINER search_path | Missing | Migration: `SET search_path = public` |
| `tenant_id` on `passkey_credentials` | Missing | Migration: added with RLS + index |
| Edge function tests | 2 fake (Tier 5), 2 missing | 4 behavioral test suites (59 tests) |
| PasskeySetup component test | Missing | 1 test suite (22 tests) |
| Session creation | Undocumented internal API | Documented as correct Admin API approach |
| HIPAA audit logging (registration) | Missing | Full audit trail on register-start and register-finish |

---

## P0 — Broken (system cannot work)

Registration stores wrong data → authentication always fails. These two must be fixed together.

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P0-1 | Fix `passkey-register-finish` attestation verification | Import `verifyRegistrationResponse` from SimpleWebAuthn. Verify attestation server-side. Extract and store COSE public key from `verification.registrationInfo.credentialPublicKey`. Store verified credential ID and initial counter. | 3 | ✅ Done |
| P0-2 | Verify `passkey-auth-finish` works with correct key | After P0-1, auth-finish's `verifyAuthenticationResponse` works because it now gets a real COSE public key. Credential format verified compatible. | 1 | ✅ Done |

**P0 subtotal:** ~4 hours → completed

---

## P1 — Wrong Data (silent failures, compliance gaps)

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P1-1 | Fix `passkey_audit_log` column names | In `passkey-auth-finish/index.ts`: changed `operation` → `action`, removed `resource_type` from all 3 `passkey_audit_log` inserts. | 0.5 | ✅ Done |
| P1-2 | Replace `SELECT *` with explicit columns | In `passkey-auth-finish/index.ts` (3 places: challenges, credentials, profiles) and `passkey-register-finish/index.ts` (1 place: challenges). | 0.5 | ✅ Done |
| P1-3 | Review session creation pattern | `generateLink({type:'magiclink'})` is the correct Admin API approach for passwordless session creation. Other login methods use `signInWithPassword` which isn't available for passkey auth. Documented in code. | 1 | ✅ Done |
| P1-4 | Add audit logging to `passkey-register-start` | Added HIPAA `audit_logs` entries for success and failure paths. Added client IP extraction. | 0.5 | ✅ Done |
| P1-5 | Add audit logging to `passkey-register-finish` | Added HIPAA `audit_logs` entries for: invalid challenge, attestation failure, unverified attestation, credential storage failure, and successful registration. | 0.5 | ✅ Done |

**P1 subtotal:** ~3 hours → completed

---

## P2 — Missing Safety

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P2-1 | Migration: fix SECURITY DEFINER search_path | Migration `20260324100000_fix_passkey_security_and_tenant_id.sql`: `ALTER FUNCTION cleanup_expired_passkey_challenges() SET search_path = public;` | 0.5 | ✅ Done (migration created, needs `db push`) |
| P2-2 | Add `tenant_id` to `passkey_credentials` | Same migration: adds `tenant_id UUID NOT NULL REFERENCES tenants(id)`, backfills from `profiles`, adds index, updates RLS policy to include `tenant_id = get_current_tenant_id()`. Register-finish updated to populate `tenant_id` from user's profile. | 1 | ✅ Done (migration created, needs `db push`) |

**P2 subtotal:** ~1.5 hours → completed

**NOTE:** Migration file created but NOT yet pushed to database. Run `npx supabase db push` before deploying edge functions.

---

## P3 — Tests

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P3-1 | Create `passkey-register-start` test suite | 12 behavioral tests: auth validation, challenge generation/storage, CORS, relying party ID extraction, audit logging, error paths. | 1 | ✅ Done |
| P3-2 | Create `passkey-register-finish` test suite | 13 behavioral tests: attestation verification, COSE key extraction, credential storage, challenge validation/marking used, tenant_id lookup, audit logging, error paths. | 1.5 | ✅ Done |
| P3-3 | Rewrite `passkey-auth-start` test suite | 18 behavioral tests (replaced Tier 5 fakes): challenge generation, credential lookup by user_id, discoverable credential flow, CORS, audit logging, IP extraction. | 1 | ✅ Done |
| P3-4 | Rewrite `passkey-auth-finish` test suite | 16 behavioral tests (replaced Tier 5 fakes): signature verification, session creation, counter update, audit logging with correct column names (`action` not `operation`), error paths. | 1.5 | ✅ Done |
| P3-5 | Create `PasskeySetup` component test | 22 tests: renders when supported, unsupported message, registration flow with arguments, device name passing, success/error messages, loading state, device list rendering with last_used/added dates, credential deletion with confirm/cancel, error handling. | 1.5 | ✅ Done |

**P3 subtotal:** ~6.5 hours → completed

---

## Completion Summary

| Priority | Items | Status | Focus |
|----------|-------|--------|-------|
| P0 Broken | 2 | **2/2 ✅** | Attestation verification + correct COSE key storage |
| P1 Wrong Data | 5 | **5/5 ✅** | Column names, SELECT *, audit logging, session review |
| P2 Safety | 2 | **2/2 ✅** | SECURITY DEFINER fix, tenant_id added |
| P3 Tests | 5 | **5/5 ✅** | 4 edge function suites (59 tests) + 1 component test (22 tests) |
| **Total** | **14** | **14/14 ✅** | |

**Verification:** 11,597 tests passed, 0 failed, 573 suites. 0 lint errors. 0 typecheck errors.

---

## Remaining Action Items (Not Code)

1. **Run `npx supabase db push`** to apply migration `20260324100000_fix_passkey_security_and_tenant_id.sql`
2. **Deploy edge functions** after migration: `npx supabase functions deploy passkey-register-start passkey-register-finish passkey-auth-start passkey-auth-finish --no-verify-jwt`
3. **End-to-end test** biometric login in browser after deploy
