# Product Separation — Admin Feature Classification (DRAFT for Maria's sign-off)

**Purpose:** Part 1 of the admin-separation work. The runtime gate (`useProductAccess()`
reading `tenants.licensed_products` — a `text[]` of `'wellfit'` / `'atlus'`) needs an
authoritative list of which admin surfaces are **Atlus-only**, **WellFit/Community-only**,
or **Shared**. This draft is derived from `.claude/rules/governance-boundaries.md`
(Systems A / B / Shared Spine) + the live route + section registry. **Confirm or adjust
the ⚑ rows, then I wire the gate.**

Legend: **Gate** = which license the tenant must hold to see it. `atlus` → hide from
WellFit-only tenants. `wellfit` → hide from Atlus-only tenants. `shared` → role-gated only,
no product gate.

## A. Atlus-only (gate on `'atlus'`) — clinical / enterprise
| Feature / surface | Where | Source |
|---|---|---|
| Bed management / command center | `/admin` bed board, BedManagementPanel | gov B1 |
| SMART-on-FHIR app mgmt, FHIR interop dashboards, EHR adapters | admin SMART/FHIR sections, HospitalAdapterManagementPanel | gov B1/S6 |
| Clinical dashboards (readmission, fall/infection risk, care coordination, handoff, discharge) | `clinical` category sections | gov B1/B3 |
| Billing / revenue / claims / clearinghouse / DRG / coding | `revenue` category, ClearinghouseConfigPanel, medical-coding | gov B1/S7 |
| Prior authorization | mcp-prior-auth surfaces | gov S9 |
| SOC2 / compliance / incident-response / disaster-recovery dashboards | `security` category (enterprise) | gov B1 |
| **API key generation (org keys)** + **MCP API key management** | ApiKeyManager, MCPKeyManagementPanel, `generate-api-key` | ⚑ **your instinct — confirm** |
| Guardian Agent auto-heal / review tickets | `/guardian/*`, super-admin | gov S8 |

## B. WellFit / Community-only (gate on `'wellfit'`)
| Feature / surface | Where | Source |
|---|---|---|
| Check-in configuration / nurse question mgmt | check-in admin, NurseQuestionManager | gov A1/A3 |
| Community moments moderation | community moderation | gov A1 |
| Engagement metrics / personalization | `/metrics`, PatientEngagementDashboard | gov A2 |
| RPM enrollment / wellness content (senior-facing programs) | RPM/BLE enrollment | gov A2 |
| My Health Hub (Cures Act patient records) | `/my-health` (patient-facing, not admin) | gov A5 |

## C. Shared (role-gated only, NO product gate — visible to both)
| Feature / surface | Where | Source |
|---|---|---|
| Identity / user / tenant management | user mgmt panels | gov S1/S2 |
| Roles & authorization | role admin | gov S3 |
| Audit logs / PHI access logs / disclosure accounting | `security` category (audit) | gov S4 |
| Tenant branding / settings / module config | branding, tenant settings | gov S2 |
| Patient context / demographics | patientContextService surfaces | gov S5 |
| AI cost / usage / model transparency dashboards | AI cost sections | gov S8 |

## ⚑ Decisions
1. **API-key generation policy — RESOLVED (super_admin / Envision operator only).** Maria
   clarified the parent-vs-client model (Envision = parent operator; API keys are a "parent
   specific," Layer 1). API keys are NOT a per-tenant/product feature — no client tenant admin
   mints them. **Done:** `generate-api-key` retightened from `['admin','super_admin']` + atlus-gate
   → `['super_admin']` only (the earlier atlus-license gate was the wrong axis), deployed. MCP keys
   already super_admin (route `RequireSuperAdmin` + `create_mcp_key` RPC + section-role enforcement).
2. **⚑ STILL OPEN — SOC2 / compliance operator-vs-tenant split.** Maria said the SOC2 dashboard is
   Envision-operator (Layer 1 → super_admin). But some compliance/audit surfaces may be a *tenant's
   own* view (their SOC2 posture), which is Layer 3. Need the split before gating the `security`
   category sections: which security/compliance dashboards are operator-only vs tenant-level?
3. **Enterprise-tier axis:** `tenants.license_tier` is `standard`/`enterprise` (separate from
   product). Do any features gate on `enterprise` *tier* in addition to the `atlus` *product*?
   (e.g. API keys = Atlus **and** enterprise-tier only?)

## Notes
- All current tenants are licensed `['wellfit','atlus']` (both), so this gate has **zero
  live impact today** — it activates the first WellFit-only or Atlus-only tenant.
- Enforcement will apply at three layers: route (`RouteRenderer`), section
  (`getSectionsByCategory`, now role-aware), and **server-side** (edge functions — the real
  boundary). Part 2 already added the `atlus` gate to `generate-api-key`.
