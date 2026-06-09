# System Analysis — Gap Closure (One Page)

**Date:** 2026-06-09
**Method:** Code-level read (not docs) across MCP servers, edge functions, encryption/RLS, frontend/services. Each gap cites file:line evidence and a verification status.
**Overall:** Top-few-percent vs. real production healthcare software. MCP layer is genuinely pitch-grade. Gaps below are finite and mostly "finish what's started," not architectural failures.

---

## P1 — Close before next pilot

### 1. PHI encryption Phase 2 is incomplete — app still reads PLAINTEXT columns
The encryption plumbing is real (AES-256 via pgcrypto, server-side keys, two-key WellFit/Atlus split), but the frontend never migrated to read the encrypted columns. Plaintext `dob`/`ein`/`tax_id` columns still exist and are read directly.
- Evidence: `src/components/admin/BillingProviderForm.tsx:55` (`.ein`), `src/components/admin/FacilityManagementPanel.tsx:174` (`.tax_id`), `src/components/admin/AdminProfileEditor.tsx:139` (`.dob`), `src/components/admin/UsersList.tsx:138` (`.dob`). Plaintext-kept note: `supabase/migrations/20260103000004_encrypt_critical_phi_fields.sql:388-404`.
- **Fix:** Switch readers to the decrypted-via-edge-function path; then drop plaintext columns (Tier-3 schema change — Maria sign-off). **Status: VERIFIED.**

### 2. Hardcoded fallback PHI key committed in git
`'PHI-ENCRYPT-2025-WELLFIT-SECURE-KEY-V1'` appears in the original encryption migration as a COALESCE last-resort.
- Evidence: `supabase/migrations/20251115180000_create_phi_encryption_functions.sql:32,76`; partial remediation `20251120000000_fix_hardcoded_phi_encryption_key.sql:54,112`.
- **Fix:** Confirm via live DB that no production row was encrypted under the fallback (i.e. the real `PHI_ENCRYPTION_KEY` Secret + Atlus Vault key are both set so priority-1/2 always win). If any data used the fallback, re-encrypt. **Status: VERIFIED in code; live key-presence check still needed.**

### 3. Tenant isolation inconsistent in some AI edge functions
`requirePatientAccess()` checks role, not that caller and patient share a tenant. Single-tenant: low risk. Multi-tenant: a clinician in Org A could request Org B's patient by ID.
- Evidence: `_shared/auth.ts:86-124` (role-only gate); callers `ai-medication-instructions`, `ai-contraindication-detector` have no tenant check.
- **Fix:** Add `requirePatientTenant(userId, patientId)` helper; call in all patient-data AI functions; codebase-wide grep sweep (Rule #1). **Status: VERIFIED.**

---

## P2 — Tighten soon

### 4. `audit_logs` allows anon INSERT with `WITH CHECK (true)`
Authenticated INSERT is correctly identity-enforced; anon path is permissive (intended for pre-auth events, but spoofable for those).
- Evidence: `supabase/migrations/_APPLIED_20260110120000_force_reset_audit_logs_rls.sql:73`; auth fix `20260327200000_fix_audit_log_rls_identity_enforcement.sql:36-42,76-83`.
- **Fix:** Scope anon INSERT to a fixed event-type allowlist, or route pre-auth logging through service role. **Status: VERIFIED, low risk (anon actor is NULL).**

### 5. Care-team membership not enforced
Any clinician role can read any patient (mitigated by role scoping + audit). Acceptable at low clinician count; tighten for scale.
- Evidence: `_shared/auth.ts:78-80` ("conservative by design" comment).
- **Fix (later):** `isOnCareTeam(userId, patientId)` after role check. **Status: VERIFIED, by-design.**

### 6. Verify no live view bypasses RLS
Hand-written decrypted views without `security_invoker` were found in `20251116000007_create_phi_decrypted_views.sql:13-23`, but reportedly in a skipped/non-prod migration.
- **Fix:** One live query — list views in prod missing `security_invoker`; confirm zero PHI views among them. **Status: REPORTED — needs a 1-query live check.**

---

## P3 — Tech debt (ongoing, not blocking)

- **ServiceResult adoption ~43%** (86/199 services). Pattern is solid; extend it for consistency. `src/services/_base/ServiceResult.ts`. VERIFIED.
- **154 files >600 lines** (god-file tracker already tracks this). Largest: `TemplateMaker.tsx` 1110, `immunizationRegistryService.ts` 997. VERIFIED.
- **Error leakage** — some functions return `debug:msg` / raw Twilio errors (`envision-login:480`). Return generic 500 in prod. VERIFIED.
- **Legacy `import React`** (~763 files) — cosmetic in React 19. VERIFIED.

---

## Genuine strengths (don't "fix" these)
- **0 `any` / 0 `as any` / 0 `console.log` in production** across 1,831 files — real, rare.
- **MCP servers:** three-tier auth wired to keys (RLS preserved on T2), SHA-256 key fingerprinting, triple-fallback audit, NPI Luhn validation, correct MCP protocol. Above typical production.
- **CORS:** 0 wildcards, centralized, dynamic origin validation.
- **Real AES-256 PHI encryption + ~95% RLS coverage** — most healthcare startups have neither.
