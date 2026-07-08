# Tenant Isolation — Pool → Silo (per-client Supabase) — Tracker

> Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

**Created:** 2026-07-08
**Status:** PLANNING ONLY — do not build without Maria's go. Tier-3 (HIPAA-critical data isolation).
**Difficulty:** HIGH (~2 weeks / 4–5 sessions). **Recommended executor:** Opus 4.8, phased, Maria checkpoints each phase.

**Goal:** let each client have a physically separate backend — their credentials can't reach another client's data.

---

## Models (pick per client)
| Model | Isolation | Ops | Verdict |
|---|---|---|---|
| **Pool** (current: 1 project, `tenant_id`+RLS) | logical | lowest | keep as default |
| **Bridge** (schema-per-tenant) | stronger | high | skip — worst effort/benefit |
| **Silo** (1 Supabase project per client) | **physical** | highest | offer to enterprise/hospital clients who require it |

**Recommendation: HYBRID** — Pool default, Silo on demand. Do **T6 tenant-isolation tests first** (~10% effort) to protect the Pool now.

---

## Silo build — phases (each is a Maria checkpoint)

### Phase 0 — Prereqs / decisions (Maria)
- [ ] Which clients get Silo vs stay Pool (contractual/HIPAA driver).
- [ ] Expected client count (Silo suits a handful of enterprise; not hundreds of small tenants).
- [ ] Shared reference-data strategy: duplicate code sets (ICD/CPT/HCPCS) per project, or a shared "reference" project.
- [ ] Cost acceptance: ~$25/mo Pro floor × N projects + provisioning/ops.

### Phase 1 — Control plane / tenant registry
- [ ] A registry mapping `domain / tenant → { supabaseUrl, publishableKey, projectRef }`. Lives OUTSIDE the client DBs (a small shared "router" project or a signed config). Never store a project's own URL/key inside that same project (chicken-egg).
- [ ] Read at app startup by white-label domain.

### Phase 2 — Dynamic client init
- [ ] Replace the single hardcoded `VITE_SB_URL` / publishable key with a per-tenant resolver keyed on domain (via the registry).
- [ ] Every `createClient` / edge-function base URL flows from the resolver.
- [ ] Acceptance: a request on client A's domain can only ever target client A's project.

### Phase 3 — Provisioning automation (the big lift)
- [ ] Pipeline using the Supabase **Management API** to, per new client: create project → run ALL migrations → deploy ALL edge functions → set ALL secrets → seed reference data.
- [ ] Idempotent + resumable.
- [ ] Acceptance: "onboard a new client" = run one command → a fully-stood-up backend.

### Phase 4 — Migration & function fan-out
- [ ] CI/tooling to apply every future migration and function deploy to ALL client projects (not just one).
- [ ] A registry of active client projects it iterates.
- [ ] Acceptance: a single migration lands consistently across every client project; drift detection per project.

### Phase 5 — Auth & data model
- [ ] Auth is per-project (users of client A don't exist in client B) — confirm every auth flow works per-project.
- [ ] Decide whether `tenant_id` stays (belt-and-suspenders inside each silo) or is dropped (redundant when the whole project is one tenant).

---

## Parameters (fill in Phase 0)
- Silo clients: ______
- Pool clients: ______
- Reference-data model: ______
- Provisioning trigger (manual / self-serve): ______

## Executor note
Opus 4.8 can execute this, **phased with Maria checkpointing each phase** — do NOT run it as one autonomous build (HIPAA-critical tenant routing must be human-reviewed). Fable 5 only if handing a bulletproof spec for the provisioning subsystem specifically, still gating tenant-routing on review.

## Dependency
Do **T6 (tenant-isolation test suite)** from `external-audit-2026-07-tracker.md` first — it hardens the Pool model that most clients will stay on, and its cross-tenant negative tests become the acceptance harness for Silo too.
