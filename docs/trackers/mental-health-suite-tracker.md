---
owner: Clinical
last_updated: 2026-07-07
review_status: needs-review
---

# Mental & Behavioral Health Suite — Tracker

**Created:** 2026-07-07
**Owner:** Maria (engineering) + Akima (clinical/compliance sign-off)
**Governance:** `.claude/rules/mental-health.md` (suite-wide behavioral-health rules)
**Akima review doc:** `docs/clinical/MENTAL_HEALTH_COMPLIANCE_REVIEW.md`

## Why this tracker exists

The mental-health intervention module (built 2026-10-22, commit `abfa9d9d`) has **live DB tables and working code but is islanded** — the `/mental-health` route is gated by a feature flag that is off, and there is **zero nav link** to it. Before it can be part of a pilot it must be (a) reachable, (b) verified against the stricter behavioral-health regulations that differ from ordinary HIPAA, and (c) signed off by Akima on the clinical/legal items. This tracker holds that work.

## Current state (verified 2026-07-07)

| Layer | State |
|---|---|
| DB | ✅ All 10 `mental_health_*` tables live in production |
| Types | ✅ `src/types/mentalHealth/` (baseTypes, riskAndSafety, serviceRequests, dashboardAndHelpers, index) |
| Service | ✅ `src/services/mentalHealthService.ts` |
| Dashboard | ✅ `src/components/mental-health/MentalHealthDashboard.tsx` |
| Route | ⚠️ `/mental-health` registered in `routeConfig.ts` but gated by flag `mentalHealth` |
| Feature flag | ❌ `VITE_FEATURE_MENTAL_HEALTH` unset → defaults `false` → `RouteRenderer` filters route out |
| Nav link | ❌ None. Only a voice phrase (`workflowPreferences.ts`) + breadcrumb label |
| 42 CFR Part 2 gate | ⚠️ Subsystem built (`cfr42_authorization_log`, `sensitiveDataService.ts`) but **islanded**, 4 open Akima items |
| Break-the-glass | ✅ Exists (`emergencyAccessService.ts`, `emergency_access_log`) — not yet wired to MH data |

## Blocked on Akima (clinical / legal — see review doc)

These are 🔒 sign-off items, NOT engineering tasks. Engineering will not close them without Akima's mark in `docs/clinical/MENTAL_HEALTH_COMPLIANCE_REVIEW.md`:

- [ ] **MH-A1** — 42 CFR Part 2 four open items (purpose-scoping, tenant_id, diagnosis-trigger, UI wiring)
- [ ] **MH-A2** — Duty to warn/protect: clinician-initiated only, never automated (confirm + governing state)
- [ ] **MH-A3** — Mandatory reporting / involuntary hold: in scope for pilot? if yes, Akima to specify per state statute
- [ ] **MH-A4** — Psychotherapy notes: captured in pilot? confirm separate-and-hidden-by-default handling
- [ ] **MH-A5** — Minors / adolescent consent in scope? governing state rule
- [ ] **MH-A6** — Approved screening instruments + auto-escalation thresholds (C-SSRS / PHQ-9 / GAD-7 / Stanley-Brown)
- [ ] **MH-A7** — Break-the-glass posture for MH data + notification recipients
- [ ] **MH-A8** — Pilot state jurisdiction (stricter-than-HIPAA state law, e.g. TX H&S §611)

## Engineering work (after / alongside Akima sign-off)

- [ ] **MH-E1** — Verify RLS on all 10 `mental_health_*` tables: tenant isolation **AND** role gating (behavioral-health data must not be readable by every authenticated user in the tenant). Live-verify via `information_schema` / policy query. **Tier 3 if any RLS change needed → Maria sign-off.**
- [ ] **MH-E2** — Wire the 42 CFR Part 2 consent gate into any `mental_health_*` read path that could contain SUD data (fail-closed via `sensitiveDataService`). Depends on MH-A1.
- [ ] **MH-E3** — Sensitivity labelling: ensure psychotherapy-note / SUD fields are excluded by default from `/my-health`, health-records export, FHIR/C-CDA export, and AI context assembly. Depends on MH-A4.
- [ ] **MH-E4** — Wire break-the-glass (`emergencyAccessService`) as the only bypass for MH data; every event logged + notified. Depends on MH-A7.
- [ ] **MH-E5** — Confirm crisis resources (988 Suicide & Crisis Lifeline) are present and always-reachable on any patient-facing MH surface (never behind the feature flag).
- [ ] **MH-E6** — Confirm high-risk screen auto-escalates (STAT psych / 1:1 / discharge blocker) and fails toward safety on missing/ambiguous data. Depends on MH-A6.
- [ ] **MH-E7** — **Reachability (do LAST, after sign-off):** set `VITE_FEATURE_MENTAL_HEALTH=true` for the pilot tenant + add a real nav link/button. **Tier 3 (route/env change) → Maria sign-off.** Then visual acceptance (Commandment #13).
- [ ] **MH-E8** — Audit: verify every MH read/disclosure/escalation/export/break-the-glass logs via `auditLogger` / `phi_access_logs`.

## Definition of done (Commandment #21)

Not "done" until: Akima has signed off every 🔒 item in scope; MH data is RLS+role-gated and Part 2-gated where applicable; the route is reachable from a real nav link with the flag on for the pilot tenant; crisis resources are visible; a high-risk screen demonstrably auto-escalates against the live system; and Maria has given visual acceptance.

## Estimate

~16–24 hours engineering across 2–3 sessions **once Akima sign-off unblocks it** — most of MH-E2/E3/E4/E6 depend on her decisions. Reachability (MH-E7) is the last step, not the first.
