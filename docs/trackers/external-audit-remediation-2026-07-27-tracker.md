# External Audit Remediation — Authorization Hardening Program

**Created:** 2026-07-27 · **Status:** VERIFIED, AWAITING MARIA'S GO
**Source:** ChatGPT external adversarial audit, delivered in 3 parts 2026-07-27
**Pinned commit audited:** `c059319ae68e44b5571b4671572b1fd47bbf4f62`
**Verification:** every finding below was live-verified by Claude against the actual code at HEAD, and against the live database via `psql "$SUPABASE_DB_URL"` where DB state was material. Verdicts are Claude's, not the auditor's.

---

## How to read this document

Each finding carries a **verdict**:

| Verdict | Meaning |
|---|---|
| **CONFIRMED** | Claude reproduced the defect in the actual code/DB. Fix required. |
| **CONFIRMED — WORSE** | Real, and the live evidence is more severe than the auditor claimed. |
| **CONFIRMED — KNOWN** | Real, and already documented in our own governance/trackers. No new information. |
| **REFUTED** | Claude checked and the described attack path does not connect. Do not re-litigate. |
| **PARTIAL** | The mechanism is real but the described consequence is not. |

**Nothing in this document has been fixed.** The working tree was clean at audit close.

---

## The two root causes (this is the whole audit in two sentences)

Every serious finding below is an instance of one of these. Fix the pattern, not just the instance.

**Root Cause 1 — Privileged code forgets who the caller is.**
The shape is: authenticate somebody → switch to service role → query or mutate by a *client-supplied* patient/resource/tenant ID → never re-check that this specific caller is authorized for that specific resource. Service role bypasses RLS, so RLS does not save you here.

**Root Cause 2 — `verify_jwt = false` means the function must authenticate itself, and some don't.**
Many functions legitimately disable the Supabase gateway JWT check because they serve cron secrets, MCP machine keys, integration credentials, or device tokens. That architecture is fine. But it moves 100% of the authentication burden into the function body — and several functions only check *"did you send a string that starts with `Bearer`?"*

**Live-verified:** all ten functions named in the P0 list below are `verify_jwt = false` in `supabase/config.toml`. The gateway enforces nothing for any of them.

---

## What was REFUTED — do not re-open

**The "anonymous → service credential → privileged Guardian action" chain does not connect.**

The auditor's #1 finding across two of the three parts. Claude verified the actual gate:

- `supabase/functions/guardian-agent/index.ts:46` — `isServerToServer = !req.headers.get('origin')`
- `:56-61` — if server-to-server, `isAuthorizedServerCaller(req)` is **required**
- `:168-178` — that function demands the real `CRON_SECRET` or `SB_SECRET_KEY`
- `:199-215` — browser callers (with Origin) always fall to `resolveTenantId`, which performs a genuine `supabase.auth.getUser(token)` and reads tenant from `profiles`

The orchestrator's substituted credential produces a **no-Origin** request, which lands in the server-to-server branch and must present a secret an anonymous caller does not have. A browser request never reaches that branch at all.

Both halves (P0-1 orchestrator substitution, P0-2 tenant precedence) remain real defects worth fixing on their own merits — see A-1 and A-2 below — but the chained breach is not real. **The audit's stated #1 priority is not the top risk.**

---

# PART A — P0 AUTHORIZATION DEFECTS

Ordered by real exposure, not by the auditor's numbering.

## A-0 — Bed-management RPCs: `EXECUTE` granted to `anon` · **✅ REMEDIATED 2026-08-15 (S1)**

> **S1 executed 2026-08-15, Maria approved.** Migration `20260815120000_a0_bed_rpc_lockdown.sql` pushed and live-verified.
>
> **Sibling sweep grew the surface from 3 to 15 functions.** A prosrc-level sweep (functions whose *source* references `beds`/`bed_assignments`/`ed_boarders`) found DEFINER siblings the name sweep missed — worst: `predict_unit_discharges` returned **patient names** for any unit UUID to `anon`, and `process_adt_bed_update` took both `p_tenant_id` AND `p_changed_by` from the caller.
>
> **What shipped:** (1) new fail-closed `assert_bed_management_caller(tenant)` — service_role/direct-DB callers pass (HL7 ingest unaffected; `bed-management` forwards the user JWT so it authorizes as the user); user callers need auth.uid() + tenant match (`get_current_tenant_id`) + a bed-management role (`current_user_has_any_role`, same store as RLS). (2) Assertion wired into all 9 DEFINER RPCs: assign_patient_to_bed, discharge_patient, update_bed_status, assign_bed_to_ed_boarder, place_ed_boarder, find_bed_by_location, get_ed_boarding_metrics, predict_unit_discharges, process_adt_bed_update (which also now overwrites `p_changed_by` with auth.uid() for user callers — stamp no longer spoofable). (3) Cross-tenant patient guard + tenant-scoped internal statements in assign/discharge. (4) `REVOKE EXECUTE FROM PUBLIC, anon` on all 13 client-callable bed/ED functions (incl. INVOKER helpers find_available_beds, generate_bed_forecast, get_ed_census, get_unit_census) + anon/authenticated revoked on the 3 trigger functions.
>
> **Acceptance evidence (all live, rolled back, zero residue incl. no downstream security_alerts):** `has_function_privilege('anon', …)` = false on all 13; 10-test DO-block proof: anon → `permission denied`; cross-tenant clinician assign → `BED_RPC_DENIED … tenant`, 0 rows created; same-tenant senior → `BED_RPC_DENIED … role`; same-tenant clinician assign→occupied / discharge→dirty / update_bed_status→cleaning all work; service_role context passes; cross-tenant metrics probe denied. Bed suites 25/25 green.
>
> **Flags left open (not blockers):** (a) `beds_staff_write` RLS names roles `care_manager`/`bed_control` that don't exist in `roles` (fail-closed, but the intended grant is dead — fix when roles are unified); (b) `bed-management` edge fn gates on the separate `profiles.role` TEXT column, not `profiles.role_id→roles` — a user with only the text role would now pass the edge gate but fail the DB gate (fail-closed; role-store unification is a later wave).

### Original finding (for the record) · CONFIRMED — WORSE 🔴 was TOP RISK

The auditor wrote: *"I could not prove the live PostgreSQL EXECUTE grants through GitHub, so I am not claiming direct anonymous RPC exploitation."*

**Claude queried the live database. `anon` has `EXECUTE`.**

| Function | `prosecdef` | Caller check | `EXECUTE` grantees (live) |
|---|---|---|---|
| `assign_patient_to_bed(p_patient_id, p_bed_id, p_expected_los_days, p_adt_source, p_adt_event_id)` | `t` (DEFINER) | none | **anon**, authenticated, service_role, postgres |
| `discharge_patient(p_patient_id, p_disposition)` | `t` (DEFINER) | none | **anon**, authenticated, service_role, postgres |
| `update_bed_status(p_bed_id, p_new_status, p_reason)` | `t` (DEFINER) | none | **anon**, authenticated, service_role, postgres |

Live `prosrc` of `assign_patient_to_bed` derives tenant from the **supplied bed**:
```sql
SELECT tenant_id INTO v_tenant_id FROM public.beds WHERE id = p_bed_id;
```
and never compares `v_tenant_id` to the caller. `auth.uid()` appears only to *stamp* `assigned_by` / `status_changed_by` — it is never used to authorize. `discharge_patient` finds the active assignment by patient ID with no caller-tenant constraint. `update_bed_status` takes a bed ID and uses its tenant.

**Why this is #1:** it is the only finding in the entire audit reachable with **no credential at all**.

Definition source: `supabase/migrations/20251201100000_predictive_bed_management.sql:734+`

### Fix
1. `REVOKE EXECUTE ... FROM anon` on all three (and every sibling bed RPC — sweep first).
2. Inside each function: `IF auth.uid() IS NULL THEN RAISE EXCEPTION`; resolve caller tenant + role from `profiles`/`user_roles`; require `resource_tenant = caller_tenant`; fail closed on NULL tenant or missing profile.
3. Maintain tenant constraints on every internal `UPDATE`/`INSERT`/`SELECT`.

### Acceptance
- `has_function_privilege('anon', 'public.assign_patient_to_bed(uuid,uuid,integer,text,text)', 'EXECUTE')` returns **false** for all three.
- Live negative test as an authenticated Tenant A clinical user against a Tenant B bed UUID: **denied**, no assignment row, no bed status change, no existing assignment modified. Rolled back, zero residue.
- Live positive test: same-tenant assignment still works end-to-end (do not break the bed board).

### Notes
Tier-3 migration. Requires Maria's explicit go. Sweep all bed-management `SECURITY DEFINER` functions in the same pass, not just these three (CLAUDE.md codebase-wide-grep rule).

---

## A-1 — Functions with NO authentication at all · **✅ REMEDIATED 2026-08-15 (S2)**

> **S2 executed 2026-08-15.** No schema changes — edge-function bodies only, all reusing the existing `_shared/auth.ts` helpers (`requireUser` / `requireRole` / `requirePatientAccess`) + `_shared/rateLimiter.ts`. Deployed and live-verified.
>
> **What shipped:** (a) `process-medical-transcript` — verified clinical caller (SCRIBE role set) required BEFORE body parse and before anything reaches Anthropic; `requirePatientAccess` when a patientId is named; 30/hr rate limit; model pin moved to `SONNET_MODEL`. (b) `emergency-alert-dispatch` — auth BEFORE payload parse: service caller (Bearer==SB_SECRET_KEY or x-internal-secret) OR verified user; a user may only dispatch for THEMSELVES unless staff-role; response no longer returns patient name/raw recipient emails; payload no longer logged (PHI); deliberately NOT rate-limited (life-critical). (c) `pdmp-query` — verified prescriber-class caller + tenant resolved from the CALLER's profile (body tenantId honored only for super_admin) + `requirePatientAccess` before the cache path; 30/hr rate limit.
>
> **Live proof (synthetic user, fully cleaned up incl. auth user + rate-limit rows, 0 downstream alerts):** no-auth → 401 ×3; `Bearer garbage` → 401 ×3; valid JWT with NO clinical role → 403 (transcript); wrong body tenant → 403 (pdmp); physician JWT → pdmp honest 501 `PDMP_NOT_CONNECTED` with audit row; physician JWT → transcript 200 with real Anthropic round-trip; service-secret + non-emergency record → 200 skipped (nothing sent). deno check 0 errors ×5.
>
> **Defects surfaced by the positive proofs and fixed in the same pass (sister-swept):** (1) **`temperature` is deprecated for claude-sonnet-5 → Anthropic 400** — transcript and `sdoh-coding-suggest` had been failing on EVERY call since the July sonnet-5 migration; removed there and defensively stripped in `claude-chat` (no live caller sends it today); sdoh's 6 hardcoded `'claude-sonnet-5'` strings moved to `SONNET_MODEL`. (2) **`pdmp_queries` insert drift** — live table has no `response_code`/`is_test` columns, so the audit-trail insert failed on every call; realigned to the live shape (test-endpoint flag rides `request_payload`). (3) sdoh-coding-suggest's check-in mapping reads 5 SDOH fields that don't exist on `check_ins` (always undefined; a prior session said "tracked separately" but no tracker entry existed) — made explicitly undefined; **real repair = map from `sdoh_assessments`/real check-in signals, added to flags below.**

### Original finding (for the record) · CONFIRMED 🔴

All three are `verify_jwt = false`, so the gateway does not protect them either.

### A-1a · `process-medical-transcript` — sends PHI to Anthropic with no caller
`supabase/functions/process-medical-transcript/index.ts:54-68`
```ts
const authHeader = req.headers.get('authorization');
let userId = null;
if (authHeader) { ... }        // ← optional
```
`:102` — the else-branch comment is literally **"Default conversational prompt for unauthenticated users"**. The prompt built there embeds the raw `transcript` and `patientId` and is sent to Anthropic. No clinical role, no patient authorization, no PHI boundary.

### A-1b · `emergency-alert-dispatch` — no authentication whatsoever
`supabase/functions/emergency-alert-dispatch/index.ts:169+`. Handler goes `OPTIONS` check → method check → `await req.json()` → service-role work. There is no `getUser`, no bearer check, no cron secret. It then sends notifications, writes alerts, and returns patient name plus raw recipient email addresses.

### A-1c · `pdmp-query` — bearer-shape check gates controlled-substance history
`supabase/functions/pdmp-query/index.ts:57-63` checks only `authHeader?.startsWith('Bearer ')`. `:110-140` then returns **cached controlled-substance prescription history** (medication name, DEA schedule, prescriber NPI, MME) filtered by a body-supplied `tenantId` + `patientId`. The honest `501 PDMP_NOT_CONNECTED` at `:197-210` fires only *after* the cache path.

### Fix
Require a verified caller (`supabase.auth.getUser(token)`), a clinical role, and patient authorization before any privileged work. For `emergency-alert-dispatch`, this is an internal webhook — give it a signed/internal credential and verify it **before parsing the payload**, and strip patient name + raw recipient addresses from the response.

### Acceptance
- `Authorization: Bearer garbage` → **401** on each. Negative test required.
- No Authorization header → **401** on each.
- `process-medical-transcript`: no request reaches Anthropic without a verified clinical caller — prove by asserting the fetch is never issued.
- `pdmp-query`: cached path is unreachable without authorization.

---

## A-2 — `ecr-submit` bearer not verified + body-supplied tenant · **CONFIRMED** 🔴

`supabase/functions/ecr-submit/index.ts:53-59` — `startsWith('Bearer ')` only, any string passes. `:64` takes `tenantId` from the body. `:80-81` builds a **service-role** client. `:88-97` queries `electronic_case_reports` filtered by the client's own `tenant_id`.

**Group with the sibling submitters.** `immunization-registry-submit` and `syndromic-surveillance-submit` share the shape. One shared gate, not three separate repairs.

### Fix
One shared `requirePublicHealthIntegrationAccess()` boundary: verify JWT → resolve profile → derive tenant from profile → authorize public-health role → verify the requested case report belongs to that tenant → reject client tenant mismatch.

### Acceptance
- `Bearer garbage` → **401**.
- Tenant A valid JWT + Tenant B `caseReportId` → **403 or 404**, no status mutation, no `ecr_submissions` row.

### PRESERVE
These functions currently report `pending_transport` / `transmitted: false` because live AIMS/state transport is not wired. **That honesty was a deliberate fix (session fourteenth, commit `a1938e4c`). Do not let a rewrite reintroduce fabricated acceptances.**

---

## A-3 — Authenticated, then trusts client-supplied identifiers · **CONFIRMED** 🔴

All four verify a JWT correctly and then hand a client-supplied ID to a service-role query. This is Root Cause 1 in its purest form.

| Finding | File:line | What the client controls |
|---|---|---|
| `phi-encrypt` decrypt authz | `phi-encrypt/index.ts:237-245` | Unknown-tenant patients are **allowed through with a log line**. Acceptable for encrypt (synthetic handoff IDs), **not acceptable for decrypt**. Same-tenant is permitted without asking whether this person may access *this patient*. |
| `generate-837p` | `generate-837p/index.ts:394-402` | Verifies the user, then retrieves encounter/patient/provider/payer by supplied IDs under service role with no tenant/patient-access binding. An 837P contains substantial PHI. |
| `check-drug-interactions` | `check-drug-interactions/index.ts:78, 89-110` | Real `getUser()`, then `patient_id` from the body feeds service-role medication queries with no patient authorization. |
| `ai-provider-assistant` | `ai-provider-assistant/index.ts:489-500` | Authenticates via `requireUser` and rate-limits (both good), then accepts `providerId` **and** `providerContext.role` from the body and validates only that the role string is in an enum. A patient account can claim `"role": "physician"` and receive physician-tier behavior and context. |

### Fix
Actor identity = JWT subject, always. Role = database role. Tenant = database tenant. Patient = an authorized relationship, checked before the privileged retrieval. Where an on-behalf-of relationship is genuinely needed, validate it independently and record **both** `authenticated_actor_id` and `on_behalf_of_provider_id`.

For `phi-encrypt`: unknown patient context must **fail closed on decrypt**. Use the existing patient-access authority.

### Acceptance
- Authenticated user → another patient's decrypt → **403**.
- Patient account → physician-only assistant behavior → **403**.
- Tenant A user → Tenant B encounter 837P → **403/404**, zero PHI in response.

---

## A-4 — `hl7-receive` trusts `X-Tenant-Id` · **CONFIRMED** 🔴

`supabase/functions/hl7-receive/index.ts:10-12` documents the header contract; `:116-146` reads `X-Tenant-Id` and uses it as `resolvedTenantId` when no connection ID is supplied, then stores raw HL7 and triggers downstream workflows under service role.

### Fix
`integration credential → registered `hl7_connections` row → tenant`. Never `X-Tenant-Id → trust`. The connection-ID path already does the right lookup — make it the only path.

### Acceptance
Request with `X-Tenant-Id` and no valid registered connection credential → **401/403**, no `hl7_message_log` row.

---

## A-5 — MCP FHIR server: tenant never enforced · **CONFIRMED** 🔴

`mcp-fhir-server` is Tier 3 and initializes with the **service-role key** (`index.ts:126-130`), so RLS does not apply. It authenticates correctly via `verifyClinicalAccess` (`:205-223`) and passes `caller.tenantId` into the handlers (`:258-262`).

**The handlers use it only for audit logging.** `toolHandlers.ts:167`:
```ts
tenantId: ctx.caller.tenantId || (toolArgs.tenant_id as string | undefined),
```
- `handleGetResource` fetches by `resource_id` alone — no tenant predicate.
- `handleCreateResource` / `handleUpdateResource` write by supplied ID/data — no tenant predicate.
- `list_ehr_connections` (`:498-503`) filters by **`toolArgs.tenant_id`** — caller-supplied and optional. Omit it and the service-role query returns every tenant's connections.

### Fix
Every MCP FHIR tool: derive `caller.tenantId` → reject NULL tenant unless explicitly approved super-admin → reject client tenant override → include a tenant predicate in every query → verify the patient/resource belongs to the caller tenant before returning or mutating.

### Acceptance
Tenant A physician requests a Tenant B patient/resource UUID → **403/404**, zero Tenant B PHI returned, zero Tenant B state modified. **This test must execute the real handler.** Constructing mock objects does not satisfy it.

---

## A-6 — Agent orchestrator mints a service credential from absence · **CONFIRMED (PARTIAL consequence)** 🟠

`supabase/functions/agent-orchestrator/index.ts:296`:
```ts
const authHeader = req.headers.get('Authorization') || `Bearer ${SERVICE_KEY}`;
```

An unauthenticated request is upgraded to the platform service credential for downstream routing. **The Guardian chain this was said to enable is REFUTED** (see above) — but the pattern is indefensible on its own and other downstream targets must be swept.

### Fix
Distinguish authenticated user / authenticated MCP-service / authenticated internal-cron / health check. Missing auth → 401. Invalid → 401. Wrong role → 403. Never substitute `SB_SECRET_KEY` because Authorization is absent.

### Acceptance
POST with allowed Origin and **no** Authorization → **401**, no downstream invocation, no credential substitution. Sweep every function the orchestrator can route to and confirm none of them accept the substituted credential as authorization.

---

## A-7 — Guardian lets body-supplied tenant win · **CONFIRMED (PARTIAL consequence)** 🟠

`supabase/functions/guardian-agent/index.ts:69`:
```ts
const tenantId = data?.tenant_id || await resolveTenantId(supabase, req);
```

Precedence is backwards: the request body is consulted before verified-JWT tenant resolution. **This is not anonymous-reachable** (see REFUTED). The real exposure is a *legitimately authenticated* Tenant A user naming Tenant B.

### Fix
Browser path: tenant comes **only** from `resolveTenantId`; ignore/reject `data.tenant_id`. Server-to-server cron path keeps its existing secret mechanism and its all-tenant fan-out.

### Acceptance
Tenant A JWT + `body.tenant_id = Tenant B` → Tenant B is never used (executes against Tenant A or returns 403).

### PRESERVE
Guardian's human-approval boundary. Do not remove review tickets, proposal-only PRs, the max-open-PR cap, or the human-merge requirement. **Guardian proposes; Maria merges.** No `merge_pr` action exists in `guardian-pr-service` — keep it that way.

---

# PART B — BROKEN FEATURES (real bugs, not exploits)

## B-1 — SMART confidential clients cannot authenticate · **CONFIRMED**

`smart-register-app/index.ts:70-90` stores `sha512:<salt_hex>:<hash_hex>`.
`smart-token/index.ts:179` and `:332` compare `await sha256(client_secret)`.

Different algorithm, different format, no salt parsing. These values can never match. **Every confidential SMART app registered through this path is unable to obtain a token.**

### Fix
One shared hash/verify utility used by both functions. Token endpoint parses `sha512:<salt>:<hash>` and recomputes with the registration algorithm. Additionally: verify `request.client_id` matches the application bound to the authorization code / refresh token — do not validate a secret independently of the client record.

### Acceptance
Real end-to-end contract test: register confidential app → receive one-time secret → authorize → exchange code → validate secret → receive access token → use it against the FHIR API. **This flow test is what would have caught the mismatch; the existing test did not.**

---

## B-2 — Passkey auth returns a session with null tokens · **CONFIRMED**

`passkey-auth-finish/index.ts:254-276`. After WebAuthn verification succeeds, the code calls `supabase.auth.admin.generateLink({ type: 'magiclink' })` and reads `sessionData.properties?.access_token` / `refresh_token`. `generateLink` returns a link/token pair for email delivery — **not an established session**. Both values resolve to `null`, and the function returns a "successful" session containing nulls.

### PRESERVE
The WebAuthn implementation itself is genuinely good: one-time challenge, expiry, reuse prevention, credential lookup, signature verification, `requireUserVerification: true`, counter update, durable audit. **Do not touch any of that.** Only the session-creation step is wrong.

### Acceptance
Successful passkey auth yields a real `access_token` + `refresh_token`, and `getUser(access_token)` succeeds.

---

## B-3 — Security automation token revocation has never worked · **CONFIRMED**

`src/services/securityAutomationService.ts:543` — `await this.supabase.auth.admin.signOut(userId, 'global')`. The Admin `signOut` takes a **JWT**, not a user UUID. Any claim that sessions were revoked is unsupported.

### Acceptance
Behavioral test: revoke → the previously-valid access token no longer authenticates.

---

# PART C — HONESTY & ACCOUNTABILITY

Low risk, low effort, high credibility cost if a customer finds them first.

| ID | Finding | Location | Verdict | Fix |
|---|---|---|---|---|
| C-1 | DR "restore test" restores nothing | `test_backup_restore()` live body; `supabase/migrations/20260123000004_*.sql`; `scripts/disaster-recovery/execute-weekly-drill.sh:157-186` | **CONFIRMED** | The function runs `PERFORM 1 FROM profiles LIMIT 1` (+ audit_logs, auth.users), then writes `restore_tested = TRUE` and `rto_met = (duration < 14400)`. The script times a **database read** and compares it to a 4-hour RTO. Split into `LIVE_DATABASE_INTEGRITY_CHECK` / `SIMULATED_DR_TEST` / `REAL_BACKUP_RESTORE_TEST`. **Until a real restore runs, no dashboard or evidence package may claim proven RTO/RPO.** |
| C-2 | AI billing suggester claims output it never produced | `ai-billing-suggester/index.ts:211, 229-230` | **CONFIRMED** | Builds `encounterContext`, never calls the model, returns `"Billing code suggestion generated"`. Change the string to the honest one. Auth/tenant work in this function is good — preserve it. |
| C-3 | Guardian containment language overstates enforcement | Guardian runtime | **CONFIRMED — KNOWN** | States named `blocked`/`circuit open`/`shutdown` that are telemetry only must be renamed `detected`/`signaled`/`containment_requested`, or wire real enforcement. |
| C-4 | PHI/PII in operational logs | `send-team-alert/index.ts:171, 182, 216`; `send-email/index.ts:192-196, 211-214` | **CONFIRMED** | Raw caregiver emails/phones and email subjects (which callers build from patient names) go to general logs. Log message ID, template ID, channel, **masked** destination, tenant, status, provider code. Nothing else. |
| C-5 | Clinical AI PHI audit is not durable | `_shared/auditLogger.ts:109-116`; `ai-soap-note-generator/index.ts:268` | **CONFIRMED** | `logger.phi()` is `console.log` only. No `phi_access_logs` row. Every PHI-bearing AI request needs a durable record: actor, patient, tenant, operation, timestamp, model, outcome — **metadata only, never clinical text**. |
| C-6 | Enrollment audit explicitly non-blocking | `enrollClient/index.ts:198-212` | **CONFIRMED** | Comment says *"Audit log (required for compliance)"* then *"NON-BLOCKING... audit can be added via background job later."* **No such background job exists.** Make it fail closed, mirroring `chwService.ts:154`. |
| C-7 | AI usage tenant/actor misattribution | `ai-treatment-pathway/index.ts:105, 201`; `ai-contraindication-detector/index.ts:98, 107, 166` | **CONFIRMED** | Both check patient access correctly, then write a **client-supplied** `tenantId` / `providerId` into usage & audit accounting. Use verified context. |
| C-8 | `coding-suggest` anonymous + unproven PHI scrubbing | `coding-suggest/index.ts:156-168, 265, 316` | **CONFIRMED** | Auth is optional; proceeds anonymously. Also records `phi_scrubbed: true` after regex de-identification of free-text clinical narrative — which cannot prove absence of names. Require auth + role + tenant + rate limit + body cap; and either build a validated de-identification boundary or govern it as a PHI-bearing vendor flow. |
| C-9 | Bootstrap endpoint still live | `setup-admin-credentials/index.ts:41` | **CONFIRMED** | Gated by a static `ADMIN_SETUP_SECRET`, therefore reusable forever. Undeploy it; if it must stay: internal-only auth, rate limit, one-time bootstrap state, rotate the secret, durable audit. |
| C-10 | Module-global per-request state | `user-data-management/index.ts:80-81` | **CONFIRMED** | `let currentTenantId` / `let currentCorsHeaders` at module scope. Unsafe under warm concurrent execution; can corrupt audit attribution. Move into request scope. |
| C-11 | Minimum-necessary: infrastructure without enforcement | `src/services/minimumNecessaryService.ts:154-164` | **CONFIRMED** | `filterFields()` / `filterRecordSet()` have **zero production callers** repo-wide. Missing policy returns **all fields** with a warning — fail-open. Flip the default to fail-closed and integrate at chosen surfaces. **Needs a scoping decision from Maria before work starts.** |
| C-12 | Super-admin guard trusts localStorage | `src/components/auth/RequireSuperAdmin.tsx:30-38, 87` | **CONFIRMED** | Presence of `envision_session` + `envision_user` → `setIsSuperAdmin(true)`, no validation. The test at `__tests__/RequireSuperAdmin.test.tsx:144` is titled *"should bypass Supabase check when Envision session exists"* — **the test enforces the defect.** Validate server-side via `envision-check-super-admin`; rewrite the test to assert validation. Backend RLS limits blast radius to route-shell access, not data. Tier-3 auth change. |
| C-13 | Router wrappers permanently broken | `src/routes/RouteRenderer.tsx:50, 303` | **CONFIRMED** | `useSupabaseClient()` returns `ctx.supabase` (`AuthContext.tsx:357-361`) — no `.user`, no `.profile`. `SpecialistDashboardWrapper` **always** renders "Invalid specialist configuration"; `ReceivingDashboardWrapper` **always** falls back to "Default Facility". **Not a Router v8 regression** — the `as unknown` casts show it was baked in when RouteRenderer was created. |
| C-14 | Production CSP allows `unsafe-inline` + `unsafe-eval` | `vercel.json:29` | **CONFIRMED — KNOWN** | Identify which deps require them (hCaptcha, Daily, Supabase), remove `unsafe-eval` if feasible, move toward nonce/hash. Do not break the three integrations. |
| C-15 | MCP patient-context uses the global anon client | `mcp-patient-context-server/index.ts:91-99` | **CONFIRMED** | Authenticates the caller, then runs every query through the init-time anon client instead of a caller-scoped one. `createPerRequestClient` already exists (`_shared/mcpServerBase.ts:357`) and is **already used by `mcp-medical-codes-server` and `mcp-postgres-server`**. Fails closed today (anon sees nothing), but breaks the intended identity architecture. Repair primitive proven in two siblings. |
| C-16 | Clearinghouse MCP is a stub | `client.ts:30-31`; `index.ts:73-92`; `handlers.ts:83, 118, 399, 406` | **CONFIRMED — KNOWN** | `loadConfig()` returns `null`; `'tenant-id'` hardcoded at 7 sites; random claim status; hardcoded 156 submissions / $245,000. **Already classified as STUB in `governance-boundaries.md` S9.** No code change needed — this is a **sales-scope** item: do not sell live clearinghouse connectivity. |
| C-17 | Pool tenant isolation incomplete | `docs/trackers/tenant-isolation-silo-tracker.md` | **CONFIRMED — KNOWN** | 505 tables carry `tenant_id`, all RLS-enabled; 11 flagged for role-based access without tenant restriction. Not a current fire (one populated tenant, admins are intentionally cross-tenant super-admins). Blocks broad multi-tenant Pool deployment. |

---

# PART D — TEST INTEGRITY (largest single effort; NOT on the auditor's P0 list)

The auditor said test quality is "uneven." Claude quantified it, and it is worse than described.

### D-1 · 118 of 119 edge-function test files test nothing · **CONFIRMED — WORSE**

```
edge fn __tests__ dirs:                    116
total edge test files:                     119
test files importing ../index.ts:            1
```

The other 118 never import the handler they name. Representative examples:

```ts
// ai-contraindication-detector/__tests__/index.test.ts:433-435
const expectedStatus = hasError ? 500 : 200;
assertEquals(expectedStatus, 500);          // asserts a ternary works

// smart-token/__tests__/index.test.ts:134-139
const secretHash = "abc123hash";
const storedHash = "abc123hash";
assertEquals(secretHash === storedHash, true);   // "validates client_secret via SHA-256"
```

That second test is why B-1 shipped: it "covers" secret validation while the real registration path writes salted SHA-512.

**Worse: these files never execute anywhere.** Vitest covers `src/` only; CI runs exactly one Deno file. So they are not even false CI signal — they are 118 files of decoration that make coverage look real.

### D-2 · The one gating Deno suite passes on failure · **CONFIRMED**

`supabase/functions/__tests__/mcp-integration.test.ts:260-275` returns `true` — logging `[PASS]` — for HTTP **401, 403, 429, and any 500**:

```ts
if (msg.includes("HTTP 500")) {
  console.log(`  [PASS] ${serverName}/${toolName}: Server error (assumed data issue)`);
  return true;
}
```

A server that 500s on every call passes the gate. Two servers are already annotated in that file as 500-ing on initialize and are still printed as "verified" in the CI summary.

### D-3 · CI final gate omits governance and typecheck · **CONFIRMED**

`.github/workflows/ci-cd.yml:597-599`:
```bash
if [ "$TEST" != "success" ] || [ "$BUILD" != "success" ] || [ "$MCP" == "failure" ]; then
```
`GOVERNANCE` and `TYPECHECK` are computed and printed but excluded from the exit condition. Note also `MCP == "failure"` (not `!= "success"`), so a cancelled or skipped MCP job passes.

**Nuance:** an individual failing job still fails the workflow run. This matters only insofar as branch protection points at the **summary** check rather than the individual jobs — which is a live GitHub setting neither the auditor nor Claude can read from the repo. **Maria must verify branch protection directly.**

### Fix
1. Delete or rebuild the 118 dead files — do not leave them as decoration.
2. Remove the 401/403/429/500-as-pass logic from `mcp-integration.test.ts`.
3. Add `GOVERNANCE` and `TYPECHECK` to the CI exit condition; change `MCP == "failure"` to `MCP != "success"`.
4. Adopt the new standard: **test the forbidden action.**

### The security-contract tests this program must produce
Each of these must execute the **real handler**, not a constructed object:

```
Tenant A JWT  → Tenant B patient        → 403     (MCP FHIR, beds, eCR, 837P, exports, alerts)
patient JWT   → physician-only AI       → 403     (ai-provider-assistant)
"Bearer garbage" → eCR / PDMP / transcript → 401
no Authorization → orchestrator          → 401
authenticated → another patient's decrypt → 403   (phi-encrypt)
anon          → assign_patient_to_bed    → denied (A-0)
confidential SMART app → register → authorize → exchange → token → FHIR   (B-1)
passkey success → real access+refresh token → getUser() succeeds          (B-2)
```

---

# EXECUTION PLAN

Sized on the CLAUDE.md session scale. **No work starts without Maria's go; A-0, C-11 and C-12 are Tier-3 and need explicit approval.**

| Session | Scope | Gate |
|---|---|---|
| **S1 ✅ DONE 2026-08-15** | **A-0 bed RPCs.** Swept by name AND prosrc (3 → 15 fns); migration `20260815120000_a0_bed_rpc_lockdown.sql`: REVOKE anon + `assert_bed_management_caller` in all 9 DEFINER RPCs. Live 10-test proof rolled back, zero residue. | ✅ `has_function_privilege('anon',…)` false ×13; cross-tenant denied (assign + metrics); senior role denied; same-tenant assign/discharge/status all work; service_role passes |
| **S2 ✅ DONE 2026-08-15** | **A-1 the three no-auth functions.** All three gated via existing `_shared/auth.ts` helpers; no schema changes. Positive proofs surfaced + fixed 2 latent breakages (sonnet-5 `temperature` 400 in 3 fns; `pdmp_queries` insert drift). | ✅ no-auth/garbage → 401 ×6; role-less JWT → 403; wrong tenant → 403; physician e2e: pdmp honest 501 + transcript 200 through Anthropic; service path 200; synthetic artifacts fully swept |
| **S3** | **Wave 0 gates + A-2.** Build the missing shared gates (machine/integration identity; edge-usable patient access) alongside `requireUser` / `requirePatientAccess` / `mcpAuthGate`. Apply to the public-health trio. | Shared gate exists; eCR/immunization/syndromic all 401 on garbage, 403 cross-tenant; `pending_transport` honesty preserved |
| **S4** | **A-3 + A-4.** phi-encrypt decrypt, 837P, drug interactions, provider assistant, HL7. Adopt the S3 gates. | Cross-patient decrypt 403; patient→physician-role 403; X-Tenant-Id alone rejected |
| **S5** | **A-5 MCP FHIR tenant enforcement.** Every tool; force caller tenant on `list_ehr_connections`. | Real-handler cross-tenant test → 403/404, zero PHI |
| **S6** | **A-6 + A-7 + C-15.** Orchestrator credential substitution, Guardian tenant precedence, patient-context per-request client. Preserve Guardian's human-merge boundary. | No-auth orchestrator → 401; body tenant never wins; patient-context queries run as caller |
| **S7** | **B-1 + B-2 + B-3.** SMART shared hash utility + client binding; passkey session; signOut. | Full SMART flow contract test green; passkey yields real tokens |
| **S8** | **Part C honesty batch.** C-1 through C-10, C-13, C-14. Mostly relabels + small edits. | Each item's stated acceptance |
| **S9-S11** | **Part D test integrity.** Delete/rebuild 118 files; fix the 500-as-pass gate; fix CI exit condition; write the security-contract suite. | Contract tests green and **blocking**; no test passes on 500 |

**Estimated: 11 sessions.** C-11 (minimum-necessary integration) is deliberately **not** scheduled — it needs a scoping decision from Maria first and will get its own tracker.

**Sequencing note:** Wave 0 gates land in S3, not S1, because S1 and S2 don't need them. Do not block the highest-exposure fix on architecture.

---

# WHAT CANNOT BE PROVEN FROM CODE

These require live/operational evidence and belong in the vendor package, not this tracker:

1. GitHub branch protection / required-workflow settings (**Maria must check directly** — determines whether D-3 matters)
2. Supabase production Auth/security configuration
3. Vercel production configuration
4. Real backup restoration capability (C-1)
5. Vendor BAAs + retention settings — AI, telehealth, email
6. Runtime penetration / adversarial testing
7. Two-real-tenant isolation test
8. External FHIR/SMART conformance (ONC Inferno `(g)(10)` test kit)

---

# DO NOT WEAKEN THESE WHILE FIXING

Verified-good patterns. Use them as the reference implementations.

- **Check-in flow** — JWT → user → tenant derived from user → validated values → RLS insert. The reference.
- **Telehealth** (`create-patient-telehealth-token`) — authenticate → fetch session → verify patient owns it → privileged op → durable PHI audit.
- **AI readmission predictor** — JWT → rate limit → clinical role → tenant → patient-tenant verification → skill config → processing.
- **Patient FHIR R4 API** — SMART patient context → scope validation → patient-filtered queries. Materially better than the MCP FHIR path. Repair SMART tokens without disturbing this model.
- **MCP auth framework** (`_shared/mcpAuthGate.ts`, `mcpIdentity.ts`) — legitimate enterprise design. **Do not redesign. Make every MCP server use it properly.**
- **Mobile sync** — refuses to fake GPS/geofence persistence when the tables don't exist.
- **API key creation / FCM tokens** — identity from verified caller, not client-supplied.
- **Guardian human authority** — proposes, never merges. Maria merges.
- **Vital image OCR** — verify user → RLS-scoped job fetch → rate limit → privileged storage via authorized path → deterministic physiological validation.
- **PHI encryption v2** (`pgp_sym_encrypt`, fail-closed, §17 two-key split) — hardened session fourteenth. The **crypto** is fine; only the **authorization** around decrypt (A-3) is not.

---

## Change log

| Date | Event |
|---|---|
| 2026-07-27 | Audit received in 3 parts; all findings live-verified by Claude; tracker created. No code changed. Working tree clean. |
