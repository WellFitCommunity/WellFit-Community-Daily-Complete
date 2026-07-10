# Product Architecture — The 3 Entities

> **Canonical statement of what this platform *is* and how the pieces separate.**
> Read this before any work that touches product boundaries, admin access, licensing,
> or cross-system data flow. Detailed system-A/B/Shared ownership lives in
> `.claude/rules/governance-boundaries.md`; this file is the top-level map.

## History (why it's shaped this way)

1. **WellFit Community** started as the **non-profit's** original platform — community
   engagement only (daily check-ins, senior/caregiver wellness).
2. The **EMR** was then built **to connect to** that community platform (the clinical layer).
3. **Envision** is the commercialization: the whole thing was **white-labeled and made
   scalable** so it can be sold to clients. Envision is the **parent operator**.

Because the EMR was built *to connect to* Community — not as a walled-off product — the
**cross-system bridges are load-bearing and must never be severed** (see §4).

## The 3 entities

| # | Entity | What it is | License / gate |
|---|--------|-----------|----------------|
| 1 | **Envision (Atlus)** | The **parent / platform operator.** The full engine, run by the parent company. "**Parent specifics**" live here and are **stripped from every white-label**. | `super_admin` (the Envision operator) only |
| 2 | **WellFit EMR** | The clinical **EMR** product — `Envision Atlus white-labeled as "WellFit Community EMR", minus the parent specifics`. | `tenants.licensed_products` contains **`'atlus'`** |
| 3 | **WellFit Community Daily** | The **community engagement** product (the non-profit origin). A **separate system** that can be **joined onto an EMR client if they pay for the add-on**. | `tenants.licensed_products` contains **`'wellfit'`** |

**Purchasing:** entities 2 and 3 are **sold together or separately.** This is encoded in the
tenant license digit `{ORG}-{LICENSE}{SEQUENCE}` and in `tenants.licensed_products text[]`:

| License digit | `licensed_products` | Meaning |
|---|---|---|
| `9` | `['wellfit']` | WellFit Community Daily only |
| `8` | `['atlus']` | EMR only |
| `0` | `['wellfit','atlus']` | Both |

## The 3-layer access model (how separation is enforced)

| Layer | Scope | Gate | Examples |
|-------|-------|------|----------|
| **1. Envision operator (parent specifics)** | Parent company only; **stripped from white-labels** | **`super_admin`** | API-key generation, MCP m2m keys, SOC2 / security / compliance operator dashboards, tenant provisioning, Guardian |
| **2. Products (sellable modules)** | Per tenant, per purchase | **`useProductAccess()` → `tenants.licensed_products`** | `'atlus'` → EMR features (charts, encounters, bed board, billing, SMART/FHIR); `'wellfit'` → Community Daily (check-ins, moments, engagement, RPM) |
| **3. Shared (in-tenant)** | Within a tenant | **role** (`user_roles`) | Identity, users, tenant settings, branding, basic audit |

> **Status (2026-07-10):** Layer 3 (role) enforced. Layer 1: **API-key generation + MCP keys
> are super_admin-gated** — `generate-api-key` retightened to `['super_admin']` + deployed; MCP
> via `RequireSuperAdmin` route + `create_mcp_key` RPC + section-role enforcement. **SOC2 /
> compliance dashboards pending** the operator-vs-tenant split decision. Layer 2
> (`useProductAccess`) is **designed but not yet wired** — `licensed_products` exists in the DB
> but no route/guard/section reads it yet. Tracked in
> `docs/trackers/product-separation-feature-list-2026-07-10.md`.

## 4. Protected cross-system bridges — DO NOT SEVER

Separation gates **who can see/reach** a feature by license/role. It must **never cut the
data bridges** that let the EMR and Community work together — that integration is the value
proposition. The authorized bridges (all read-only, RLS-scoped):

| Bridge | Direction | Mechanism |
|--------|-----------|-----------|
| Readmission dashboards | Community → Clinical | views `v_readmission_dashboard_metrics` / `_high_risk_members` / `_active_alerts` (security_invoker) |
| My Health Hub (Cures Act) | Community → Clinical | FHIR service hooks (`useFhirData`) over the patient's own records |
| Doctors' view of home vitals | Clinical → Community | direct RLS-scoped reads of `check_ins` / `self_reports` |
| Canonical patient context | Both | `patientContextService` / `mcp-patient-context-server` |
| Caregiver contacts | Both | view `v_patient_caregiver_contacts` |
| FHIR resource embeds | Both | embed FKs `encounters_patient_id_profiles_fkey`, `community_moments_user_id_profiles_fkey`, etc. → `profiles(user_id)` |

**Verified intact 2026-07-10** after the schema-drift repair work: all coupling views present,
all profiles embed-FKs resolve. The drift fixes did **not** sever these — in several places
they **repaired** bridges that were silently broken (the patient-context spine was querying
dead columns and returning empty). Only `risk_assessments_decrypted` is absent, which is the
separate, pre-existing RiskAssessment/Akima-blocked item.

## Vocabulary note (the "WellFit" naming knot)

"WellFit" is the client-facing brand for **both** the EMR and the Community add-on, so be
precise in code/DB: the `licensed_products` value **`'atlus'` = the EMR**, **`'wellfit'` = the
Community Daily** add-on. "Envision Atlus" is the underlying engine; "WellFit Community EMR" is
its white-label; "WellFit Community Daily" is the separate community product.
