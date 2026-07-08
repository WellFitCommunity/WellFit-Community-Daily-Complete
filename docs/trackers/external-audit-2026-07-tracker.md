# External Audit (ChatGPT, 2026-07-08) — Tracker

> Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

**Source:** Cross-AI adversarial audit — ChatGPT, live GitHub connector, **static inspection only** (it explicitly could not run npm/tests/Deno/DB-drift). Repo `main`, commit `c8efc55…`.
**Complement:** Claude (Opus 4.8) **live-verified** each concrete ticket against the running system/DB — the behavior layer the static pass can't reach.

**Key framing:** the static audit found real *structural / claims / architecture* issues but **zero** of the runtime/behavior bugs fixed the same day (invalid model IDs, boot-500s, WS 502, GRANT gaps, phantom columns). That's the behavior-verification gap in one data point: static ≠ behavior.

---

## Ticket status

| # | Ticket | Severity (live-adjusted) | Status |
|---|---|---|---|
| **T1** | Harden MCP browser token flow (`localStorage` token scraping; `listTools()` unauth mismatch) | High (hardening) | ☐ OPEN — same BFF pattern as T2 |
| **T2** | Caregiver PHI routes | **Downgraded: NOT an exposure** (live-verified RLS blocks anon), but the **feature was broken** | ✅ **DONE** (`8259552b`) — server-side BFF `get-caregiver-senior-data`; both pages rewired; live-proven 400/401 |
| **T3** | Disable production source maps | Medium (info disclosure) | ✅ **DONE** — `vite.config.ts` sourcemap now `process.env.VITE_ENABLE_SOURCEMAP === 'true'` (default off) |
| **T4** | `npm install` → `npm ci` | Medium (reproducibility) | ✅ **DONE** — 5 CI jobs switched; `npm ci --dry-run` resolves clean against the lock |
| **T5** | Claim cleanup (compliance/cert wording) | Medium-high (legal/business) | ☐ OPEN — **Maria/Akima wording call.** Verified real overclaims below |
| **T6** | Tenant-isolation test suite | High (behavior gate) | ☐ OPEN — the flagship behavior gate |

---

## Live-verification results (what Claude confirmed/refined vs the static pass)

- **T2 — refuted the "HIGH PHI exposure" fear.** Tested the **public anon key** directly: `profiles` → 401, `medication_reminders` → 401, `check_ins`/`self_reports` → 200 but **0 rows** (RLS holds). Defense-in-depth worked. Real issue was a *broken* feature (anon-key fetch RLS-blocked) → fixed with the BFF. Bonus: `medication_reminders` is a phantom-column stub live (only `id,user_id,time_of_day`).
- **T3 — confirmed real.** `vite.config.ts` had hardcoded `sourcemap: true`; the CI `GENERATE_SOURCEMAP:false` is a **CRA var Vite ignores** (dead/misleading — candidate for removal).
- **T4 — confirmed real.** 5 CI jobs used `npm install`; lock is present and in sync.
- **T5 — confirmed real, and refined.** Genuine overclaims in user-facing code: `sectionDefinitions.tsx:147` "HIPAA compliant", `revenueSections.tsx:88` "CMS-0057-F compliant", `EpicFHIRAdapter.ts:100` `certifications:['Epic App Orchard']`. **But** most "certified" grep hits are *correct advisory disclaimers* ("must be reviewed by a certified coder") — do NOT touch those. Maria's chosen wording: **"HIPAA-aligned"** (not "compliant").

---

## Remaining work

### T1 — MCP browser token (High)
Files: `src/services/mcp/mcpHelpers.ts` (`getSupabaseAuthToken()` scrapes `localStorage`), `mcpClient.ts` (`listTools()` posts without Authorization → UI silently sees `[]`), `supabase/functions/mcp-claude-server/index.ts`.
Fix: route MCP calls through a session-validated Edge Function (same BFF pattern as T2); stop scraping tokens in the browser; fix `listTools()` auth.
Acceptance: no MCP code reads `localStorage.getItem('sb-…auth-token')`; tests cover unauth/non-admin/admin/super-admin.

### T5 — Claim cleanup (Maria/Akima wording call)
Replace ONLY the verified overclaims → "HIPAA-aligned technical foundation…", soften "CMS-0057-F compliant" and the Epic App Orchard certification claim until externally validated. Leave advisory-disclaimer language alone.
Acceptance: no unsupported compliance/certification claim in user-facing UI or sales docs.

### T6 — Tenant-isolation test suite (High — the flagship behavior gate)
Cross-tenant **negative** tests: tenant A cannot read/write tenant B via UI services, Edge Functions, MCP, RPCs, FHIR/SMART tokens, CHW records, audit logs, dashboards. This is "Layer 5 live round-trips" from the behavior-gap plan — the single highest long-term value.

---

## Deferred / not-a-bug (from the audit)
- **60-day "split into vertical modules"** — the app is a **governed modular monolith** (CI-enforced `community ⊥ admin` import boundaries; code-split into per-route lazy chunks so community users never download clinical JS — both verified). **Do NOT split it** — for a solo founder that adds ops burden for no benefit. See `docs/PROJECT_STATE.md` / governance-boundaries.md.
- The route-sprawl / maintenance-load concern is real but a roadmap item, governed by the boundary checks.

---

## Also note (Claude's addition, not in the static audit)
The audit's blind spot *is* the project's central risk: **behavior drift caught only when a user hits it.** T6 + the behavior gates (extend drift-gate to columns/embeds/GRANTs; model-ID allowlist; edge-function smoke probes; secret-contract check) are the durable fix. See the behavior-verification plan.
