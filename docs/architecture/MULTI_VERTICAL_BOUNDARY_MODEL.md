# Multi-Vertical Boundary Model

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**

> This document extends the [Governance Boundary Map](GOVERNANCE_BOUNDARY_MAP.md) to cover
> the full multi-vertical platform architecture, including clinical specialty modules
> and the Law Enforcement product line.

**Last Updated:** 2026-02-20
**Status:** Architectural specification — approved by Maria (AI System Director)

---

## Platform Overview

The platform is a **multi-product, multi-vertical, multi-tenant** system built on a single
Shared Spine. Products are hard-separated systems with distinct compliance domains.
Verticals are specialty modules within a product that share a common clinical foundation.

### Three Products (System-Level Boundaries — Hard Walls)

| System | Product | Target Users | Compliance Domain | License Digit |
|--------|---------|-------------|-------------------|---------------|
| **A** | WellFit | Seniors, caregivers, community orgs | HIPAA (limited PHI) | `9` |
| **B** | Envision Atlus | Clinicians, hospitals, practices | HIPAA (full PHI) | `8` |
| **C** | Justice & Public Safety | Law enforcement, corrections | CJIS + 42 CFR Part 2 | `7` |
| — | WellFit + Envision Atlus | Full clinical + community | HIPAA | `0` |

**System-level boundaries are hard walls:**
- Different tenants (never co-mingled under one `tenant_id`)
- Separate user accounts (no shared identity across systems)
- No cross-system writes
- Cross-system reads only through explicitly authorized paths
- Each system can deploy independently

### Clinical Specialty Modules (Within System B — Feature Flags)

| Module | Code | Status | Foundation Tables |
|--------|------|--------|-------------------|
| **General Practice** | `gp` | Active | encounters, clinical_notes, medications, lab_results, vitals |
| **Dental** | `dental` | Active | dental_assessments, dental_procedures, dental_tooth_chart, dental_imaging, +3 |
| **Labor & Delivery** | `ld` | Complete (8 sessions) | All L&D tables, partogram, newborn, postpartum, 11 AI integrations |
| **GYN** | `gyn` | Next (shares L&D infrastructure) | TBD — will extend L&D patient population |
| **Oncology** | `onc` | Foundation built | Oncology-specific tables, 11 sessions remaining |
| **Cardiology** | `cardio` | Foundation 60-65% | Cardiology-specific tables, 12-13 sessions remaining |

**Module-level boundaries are feature flags, not data walls:**
- Controlled by `tenant_module_config` per tenant
- A dental-only tenant never loads L&D routes or edge functions
- Within the same tenant, a patient CAN have encounters across specialties
- A cardiologist at a hospital CAN see their patient's oncology diagnosis
- UI routes, edge functions, and AI skills are gated by module enablement

---

## The Critical Distinction: Systems vs Modules

| Concern | System Boundary (A/B/C) | Module Boundary (within B) |
|---------|------------------------|---------------------------|
| Tenant isolation | **Separate tenant IDs** | Same tenant, different modules enabled |
| User accounts | **Separate accounts** | Same account, role determines access |
| Data walls | **Hard — no cross-system writes** | Soft — shared patient record across specialties |
| Compliance domain | **Different regimes** (HIPAA vs CJIS) | Same regime (HIPAA for all clinical) |
| Deployment | **Independent products** | Feature-flagged within one product |
| Cross-access reads | **Authorized paths only (views, FHIR)** | Direct reads within tenant (RLS-scoped) |
| Audit scope | **Domain-tagged, separate retention** | Standard clinical audit, shared retention |
| Route loading | **Separate app shells or route trees** | Conditional route registration |
| Enforcement mechanism | **RLS + tenant_id + domain column** | `tenant_module_config` + `useModuleAccess()` |

**Rule:** If two verticals have different compliance regimes, they are SYSTEMS (hard wall).
If they share the same compliance regime and patient population, they are MODULES (feature flags).

---

## System C — Justice & Public Safety

### C1. Tenant & Identity Isolation

- **Always a separate tenant** from any clinical or community tenant
- **Always separate user accounts** — no shared identity with clinical/community
- A county that operates both a clinic and a sheriff's department has TWO tenants:
  - `{COUNTY}-8001` (clinical) or `{COUNTY}-0001` (clinical + community)
  - `{COUNTY}-7001` (law enforcement)
- No single sign-on across systems — separate auth flows

### C2. Compliance Domain — CJIS + 42 CFR Part 2

| Requirement | CJIS Standard | Platform Implementation |
|-------------|--------------|------------------------|
| Background checks | All personnel with CJI access | Verified at tenant onboarding, tracked in `user_roles` |
| Multi-factor auth | **Required** (not optional) | Enforced at LE auth context level |
| Encryption at rest | AES 256 | Supabase default (transparent) |
| Encryption in transit | TLS 1.2+ | Enforced via HTTPS-only CORS |
| Audit retention | Minimum 1 year | Domain-specific retention policy |
| Session timeout | 30 minutes max inactivity | LE-specific `SessionTimeoutContext` config |
| Media protection | Encrypted removable media | Export controls on edge functions |

**42 CFR Part 2 (Substance Use Disorder):** If LE interacts with individuals who have
SUD treatment records, those records require ADDITIONAL consent protections beyond HIPAA.
This is a federal requirement that applies at the intersection of justice and healthcare.

### C3. Data Surface (LE-Owned)

LE tables follow the `le_` prefix convention for clarity. All are tenant-scoped with RLS.

| Category | Tables (Planned) |
|----------|-----------------|
| Booking & Intake | `le_bookings`, `le_intake_screenings`, `le_intake_health_flags` |
| Inmate/Detainee | `le_detainees`, `le_detainee_status_history`, `le_housing_assignments` |
| Case Management | `le_cases`, `le_case_notes`, `le_case_participants`, `le_case_evidence` |
| Court & Legal | `le_court_dates`, `le_warrants`, `le_bond_records` |
| Officer Management | `le_officers`, `le_officer_assignments`, `le_use_of_force_reports` |
| Dispatch | `le_incidents`, `le_dispatch_log`, `le_call_for_service` |
| Transport | `le_transport_orders`, `le_transport_log` |
| Compliance | `le_audit_logs`, `le_cjis_access_log`, `le_background_checks` |

### C4. LE Auth Context

| Context | Purpose |
|---------|---------|
| `LEAuthContext` | Law enforcement authentication (separate from `AuthContext` and `EnvisionAuthContext`) |

### C5. LE Roles

| Role | Scope | Access |
|------|-------|--------|
| `le_officer` | Patrol/field | Incidents, dispatch, basic case data |
| `le_detective` | Investigative | Full case management, evidence |
| `le_supervisor` | Command | All officer data, use-of-force review, reporting |
| `le_booking_clerk` | Intake | Booking, intake screening, housing |
| `le_admin` | System admin | LE tenant configuration, user management |
| `platform_super_admin` | Cross-system | Maria/Akima only — logged, justified |

### C6. Cross-System Access — LE ↔ Clinical

**There is ONE narrow, authorized cross-system path between LE and Clinical:**

**Intake health screening.** When an individual is booked into custody, their health
screening may need to reference existing clinical data (allergies, medications, conditions)
to prevent medical emergencies in custody.

| Direction | Pattern | Authorization |
|-----------|---------|---------------|
| LE → Clinical | Read **through a dedicated health-screening edge function** | Requires: (1) active booking for the individual, (2) `le_booking_clerk` or `le_supervisor` role, (3) audit logged with booking ID + purpose, (4) consent on file or emergency exception |
| Clinical → LE | **Never.** Clinicians do not access LE data. | N/A |
| LE → Community | **Never.** LE does not access wellness/engagement data. | N/A |
| Community → LE | **Never.** Community members do not access LE data. | N/A |

**This path is the ONLY authorized cross-system interaction involving LE.** It exists because
failing to identify a detainee's medical conditions (e.g., diabetes requiring insulin, seizure
disorders, severe allergies) creates immediate risk to life.

**Audit requirements for this path:**
- Every health screening lookup is logged with: `booking_id`, `detainee_id`, `requesting_officer_id`, `purpose`, `timestamp`, `data_accessed`
- Logs are retained for minimum 7 years (longer of CJIS and HIPAA requirements)
- Monthly audit review by compliance officer

---

## Module Boundary Enforcement (Within System B)

### How Specialty Modules Are Gated

```
tenant_module_config table:
┌─────────────┬──────────────┬─────────┐
│ tenant_id   │ module_key   │ enabled │
├─────────────┼──────────────┼─────────┤
│ CLINIC-8001 │ gp           │ true    │
│ CLINIC-8001 │ dental       │ true    │
│ CLINIC-8001 │ ld           │ false   │
│ CLINIC-8001 │ gyn          │ false   │
│ CLINIC-8001 │ onc          │ false   │
│ CLINIC-8001 │ cardio       │ false   │
│ HOSP-8002   │ gp           │ true    │
│ HOSP-8002   │ dental       │ true    │
│ HOSP-8002   │ ld           │ true    │
│ HOSP-8002   │ gyn          │ true    │
│ HOSP-8002   │ onc          │ true    │
│ HOSP-8002   │ cardio       │ true    │
└─────────────┴──────────────┴─────────┘
```

### Module Gating Layers

| Layer | Mechanism | What It Prevents |
|-------|-----------|-----------------|
| **UI Routes** | `useModuleAccess('dental')` → conditional route registration | Dental routes never load for a GP-only tenant |
| **Navigation** | Menu items gated by module access | No "L&D" sidebar item if L&D is disabled |
| **Edge Functions** | Module check at function entry | `ai-soap-note-generator` checks if the specialty context is enabled |
| **AI Skills** | `tenant_ai_skill_config` | Specialty-specific AI skills only active for enabled modules |
| **Data** | No RLS gating (shared patient record) | Intentional: within a tenant, clinical data flows across specialties |

### Why Data Is NOT Walled Between Specialties

Within a hospital tenant, a patient's record is unified:
- A cardiologist needs to know about a patient's oncology medications (drug interactions)
- An L&D nurse needs to see allergies documented by the GP
- A dentist needs to see anticoagulant medications before a procedure
- GYN needs L&D history for the same patient

**Walling data between specialties within the same tenant would be clinically dangerous.**

The module boundary is about **what workflows and UI are available to a tenant**, not about
hiding data between departments. This is fundamentally different from the system boundary
(where LE data MUST be walled from clinical data).

### Specialty-Specific Components

Each specialty module follows the established component pattern:

```
src/components/admin/{specialty}/
├── {Specialty}Dashboard.tsx       # Main dashboard
├── {Specialty}*.tsx               # Specialty components
├── __tests__/
│   └── {Specialty}*.test.tsx      # Tests (REQUIRED)
└── index.ts                       # Barrel export
```

| Specialty | Component Path | Edge Function Prefix |
|-----------|---------------|---------------------|
| General Practice | `src/components/admin/` (base) | `ai-*` (generic clinical) |
| Dental | `src/components/admin/dental/` | `dental-*` |
| L&D | `src/components/admin/labor-delivery/` | `ld-*` or existing clinical AI |
| GYN | `src/components/admin/gyn/` | `gyn-*` |
| Oncology | `src/components/admin/oncology/` | `onc-*` |
| Cardiology | `src/components/admin/cardiology/` | `cardio-*` |

---

## Tenant Configuration Examples

### Example 1: Small Dental Practice

```
Tenant: SMILE-8001
License: 8 (Envision Atlus only)
Modules: gp + dental
Users: 2 dentists, 3 hygienists, 1 front desk
```

- Sees: GP encounters, dental charts, dental imaging, medications, allergies, billing
- Does NOT see: L&D, GYN, Oncology, Cardiology routes/workflows
- Does NOT have: Community check-ins, wellness engagement, LE anything

### Example 2: OB/GYN Clinic

```
Tenant: WOMENS-8002
License: 8 (Envision Atlus only)
Modules: gp + ld + gyn
Users: 3 OB/GYNs, 5 nurses, 2 midwives, 1 admin
```

- Sees: GP encounters, L&D workflows (partogram, delivery, newborn, postpartum), GYN workflows
- Does NOT see: Dental, Oncology, Cardiology
- Shares L&D infrastructure for prenatal through postpartum continuity

### Example 3: Community Hospital (Full Integration)

```
Tenant: MERCY-0001
License: 0 (WellFit + Envision Atlus)
Modules: gp + dental + ld + gyn + onc + cardio
Users: 50+ providers, 200+ staff, 5000+ community members
```

- Full clinical suite: all specialties enabled
- WellFit community engagement for patient population
- Cross-system reads: doctors see check-in vitals, patients see their own records
- All AI skills active, all edge functions available

### Example 4: County with Clinic + Sheriff (Two Tenants)

```
Tenant 1: WAYNE-0001 (clinical + community)
License: 0
Modules: gp + dental

Tenant 2: WAYNE-7001 (law enforcement)
License: 7
Modules: LE-specific (booking, cases, dispatch)
```

- **Completely separate tenants, separate user accounts**
- The county nurse who works at the clinic AND does jail intake has TWO accounts
- Health screening at booking can pull clinical data via authorized edge function path
- No other cross-system access between WAYNE-0001 and WAYNE-7001

---

## Authorization Model — Domain-Scoped Roles

### Role Taxonomy

Roles are scoped by system and specialty:

```
{system}_{specialty}_{role}

Examples:
  clinical_gp_provider         → GP physician
  clinical_gp_staff            → GP front desk, MA
  clinical_dental_provider     → Dentist
  clinical_dental_hygienist    → Dental hygienist
  clinical_ld_provider         → OB physician, midwife
  clinical_ld_nurse            → L&D nurse
  clinical_onc_provider        → Oncologist
  clinical_cardio_provider     → Cardiologist
  community_member             → WellFit member (senior, caregiver)
  community_admin              → Community org admin
  le_officer                   → Law enforcement officer
  le_supervisor                → LE command
  le_booking_clerk             → Booking/intake
  tenant_admin                 → Tenant-level admin (any system)
  platform_super_admin         → Maria, Akima (cross-system, fully logged)
```

### Permission Check Flow

```
1. Authenticate (system-specific auth context)
2. Resolve tenant_id
3. Check system access (license digit → is this system enabled?)
4. Check module access (tenant_module_config → is this specialty enabled?)
5. Check role (user_roles → does this user have the required role?)
6. RLS enforces at database layer (tenant_id + role match)
```

---

## Audit Requirements by Domain

| Domain | Audit Standard | Retention | Tagged Fields |
|--------|---------------|-----------|---------------|
| Community (A) | HIPAA (limited) | 6 years | `tenant_id`, `user_id`, `action` |
| Clinical (B) | HIPAA (full) | 6 years | `tenant_id`, `user_id`, `patient_id`, `action`, `phi_accessed` |
| Law Enforcement (C) | CJIS | 7 years minimum | `tenant_id`, `officer_id`, `subject_id`, `action`, `purpose`, `booking_id` |
| Cross-system | Strictest of both | 7 years | All fields from both domains + `cross_system_justification` |

**Every audit entry MUST include a `domain` field:**

```typescript
type AuditDomain = 'community' | 'clinical' | 'law_enforcement' | 'platform';
```

---

## Data Flow Diagram — All Systems

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED SPINE (Platform)                   │
│  Identity │ Tenancy │ Audit │ FHIR │ Billing │ AI │ MCP    │
└──────┬──────────┬──────────────────────────┬────────────────┘
       │          │                          │
       ▼          ▼                          ▼
┌──────────┐ ┌─────────────────────────┐ ┌──────────────┐
│ System A │ │       System B          │ │   System C   │
│ WellFit  │ │    Envision Atlus       │ │  Justice &   │
│Community │ │                         │ │ Public Safety│
│          │ │ ┌────┐ ┌────┐ ┌──────┐ │ │              │
│ check-ins│ │ │ GP │ │Dntl│ │ L&D  │ │ │ booking      │
│ wellness │ │ ├────┤ ├────┤ ├──────┤ │ │ cases        │
│ engage-  │ │ │GYN │ │Onc │ │Cardio│ │ │ dispatch     │
│ ment     │ │ └────┘ └────┘ └──────┘ │ │ officers     │
│          │ │   (module-gated)        │ │              │
└────┬─────┘ └──────────┬──────────────┘ └──────┬───────┘
     │                  │                        │
     │    ┌─────────────┤                        │
     │    │ Authorized  │                        │
     │    │ read paths  │                        │
     │    │ (3 existing)│                        │
     │◄───┘             │                        │
     │                  │    ┌───────────────┐   │
     │                  │◄───┤ Health screen  ├───┘
     │                  │    │ (1 authorized  │
     │                  │    │  path only)    │
     │                  │    └───────────────┘
     │                  │
     └──────────────────┘
        NO direct paths
        between A and C
```

---

## Migration Path from Current State

### What Already Exists (No Changes Needed)

| Component | Status |
|-----------|--------|
| System A / B boundary | Fully governed (governance-boundaries.md) |
| 3 authorized cross-system read paths | Documented and enforced |
| `tenant_module_config` table | Exists, supports module gating |
| `useModuleAccess()` hook | Exists, used for feature flags |
| `user_roles` table | Exists, authoritative role source |
| Audit logging infrastructure | Exists (audit_logs, phi_access_logs, admin_audit_log) |
| RLS enforcement | Exists on all tables |

### What Needs to Be Built

| Priority | Work Item | Effort |
|----------|-----------|--------|
| 1 | Add `domain` column to `audit_logs` table | Migration (1 session) |
| 2 | Register specialty module keys in `tenant_module_config` (`gp`, `dental`, `ld`, `gyn`, `onc`, `cardio`) | Migration + seed data (1 session) |
| 3 | Gate specialty routes with `useModuleAccess()` | UI work per specialty (ongoing) |
| 4 | Create `LEAuthContext` for System C | New auth context (1 session) |
| 5 | Create LE database schema (`le_*` tables) | Migration (2-3 sessions) |
| 6 | Create LE edge functions | Per-feature (ongoing) |
| 7 | Health screening cross-system edge function | 1 session (high sensitivity) |
| 8 | CJIS-specific audit retention policies | Migration + config (1 session) |
| 9 | Role taxonomy migration (domain-scoped roles) | Migration + RLS updates (2-3 sessions) |

**Total estimated effort for System C foundation:** 8-10 sessions
**Module gating for existing specialties:** 1-2 sessions (mostly route guards)

---

## System C — Full LE Vertical Roadmap (Future)

> **Status:** Vision document. Not scheduled for implementation.
> **Priority:** After Envision Atlus hospital pilot is live and generating data.
> **Prerequisite:** SHIELD Program (welfare checks) is already built and operational.

### What Already Exists (SHIELD Program)

| Component | Status | Purpose |
|-----------|--------|---------|
| `law_enforcement_response_info` table | Migrated | Senior emergency response profiles (mobility, equipment, access, priority) |
| `welfare_check_reports` table | Migrated | Officer welfare check outcome reporting |
| `get_welfare_check_info()` function | Migrated | Dispatch data aggregation (demographics + LE + last check-in) |
| `get_missed_check_in_alerts()` function | Migrated | Urgency-scored missed check-in roster |
| `lawEnforcementService.ts` | Built | LE service layer |
| `welfareCheckDispatcher.ts` | Built | AI welfare check dispatch |
| `LawEnforcementLandingPage.tsx` | Built | LE portal entry point |
| `welfare_check_outcome` enum | Migrated | 7-value outcome classification |

SHIELD is the **bridge feature** — it connects WellFit missed check-ins to LE welfare
response. It works today and proves the cross-system integration pattern.

### Beyond SHIELD — Full LE Vertical Phases

#### Phase 0: SHIELD (DONE)

Senior welfare checks. Already built. This is the foot in the door with rural
sheriff's departments — "your officers already respond to wellness checks, now
they have the information they need before they arrive."

#### Phase 1: Jail Management (First Build Priority)

Rural jails are underserved by technology. A 10-50 bed county jail is too small for
the big vendors (Tyler Technologies, Spillman) but still needs the basics.

| Module | Tables | What It Does |
|--------|--------|-------------|
| **Booking & Intake** | `le_bookings`, `le_intake_screenings`, `le_intake_health_flags`, `le_property_inventory` | Arrest processing, health screening (cross-system clinical read), property cataloging |
| **Housing Management** | `le_housing_units`, `le_housing_assignments`, `le_housing_history` | Cell/pod assignment, classification, separation requirements |
| **Daily Operations** | `le_head_counts`, `le_meal_tracking`, `le_sick_calls`, `le_visitation_schedule` | Head count verification, meal service, medical request queue, visitor management |
| **Release Processing** | `le_releases`, `le_release_conditions` | Bond/bail, time served, court-ordered release, property return |

**Why this comes first:** Jail management has natural overlap with clinical:
- Health screening at intake (the authorized cross-system path)
- Medication administration in custody (ties to medication management)
- Mental health screening (ties to behavioral health)
- Chronic condition management for inmates (diabetes, seizures, HIV)

**Rural jail reality:** The same county nurse who works at the GP clinic may also
do sick call at the jail. Separate accounts, but the clinical knowledge transfers.

#### Phase 2: Records Management System (RMS)

Incident and report writing — the core paperwork of law enforcement.

| Module | Tables | What It Does |
|--------|--------|-------------|
| **Incident Reports** | `le_incidents`, `le_incident_narratives`, `le_incident_persons`, `le_incident_vehicles`, `le_incident_property` | Crime/event documentation with involved parties |
| **Arrest Reports** | `le_arrests`, `le_arrest_charges` | Arrest documentation, charge capture |
| **Field Reports** | `le_field_interviews`, `le_traffic_citations`, `le_accident_reports` | Patrol-generated documentation |
| **Evidence** | `le_evidence_items`, `le_evidence_chain_of_custody`, `le_evidence_storage_locations` | Chain of custody, storage, disposition |

**AI opportunity:** Narrative generation from structured data (same pattern as
clinical SOAP notes — officer inputs facts, AI drafts the report narrative).

#### Phase 3: Case Management

Investigation tracking from assignment to disposition.

| Module | Tables | What It Does |
|--------|--------|-------------|
| **Cases** | `le_cases`, `le_case_assignments`, `le_case_status_history` | Case creation, detective assignment, status tracking |
| **Case Work** | `le_case_notes`, `le_case_leads`, `le_case_participants`, `le_case_evidence_links` | Investigation activity, lead tracking, witness/victim/suspect management |
| **Court Coordination** | `le_court_dates`, `le_warrants`, `le_subpoenas`, `le_bond_records` | Court scheduling, warrant tracking, legal document management |

#### Phase 4: Dispatch / CAD

Computer-Aided Dispatch — the most complex and real-time module.

| Module | Tables | What It Does |
|--------|--------|-------------|
| **Call Intake** | `le_calls_for_service`, `le_call_notes`, `le_call_priorities` | 911 and non-emergency call processing |
| **Unit Management** | `le_units`, `le_unit_status`, `le_unit_locations` | Officer/vehicle status, GPS tracking, availability |
| **Dispatch** | `le_dispatches`, `le_dispatch_history` | Call assignment, backup requests, status updates |

**Rural note:** Many rural counties share dispatch with fire/EMS — support multi-agency routing.

**Deferred complexity:** Real-time CAD is significant (WebSockets, GPS, MDTs). Last phase for a reason.

#### Phase 5: Officer Management & Compliance

Personnel, training, and CJIS compliance tracking.

| Module | Tables | What It Does |
|--------|--------|-------------|
| **Personnel** | `le_officers`, `le_duty_roster`, `le_training_records`, `le_certifications` | Scheduling, qualification tracking |
| **Use of Force** | `le_use_of_force_reports`, `le_uof_review_board` | Incident reporting, review process |
| **Equipment** | `le_equipment_assignments`, `le_vehicle_fleet`, `le_body_cameras` | Asset tracking, maintenance schedules |
| **CJIS Compliance** | `le_cjis_training_log`, `le_cjis_access_audit`, `le_background_checks` | Training compliance, access auditing |

### AI Opportunities in LE (Mapped to Clinical Parallels)

| LE AI Skill | Clinical Parallel | Pattern Reuse |
|-------------|-------------------|---------------|
| Report narrative generation | SOAP note generator | Structured input → AI narrative |
| Booking risk assessment (suicide, violence) | Fall risk predictor | Multi-factor risk scoring |
| Warrant/court date alerts | Appointment reminders | Time-based notification |
| Case lead prioritization | Patient priority boards | AI-scored priority ranking |
| Shift briefing generation | Shift handoff summary | Outgoing → incoming context transfer |
| Use of force pattern analysis | Readmission prediction | Historical pattern detection |
| Dispatch priority scoring | Care escalation scorer | Multi-factor urgency calculation |
| Evidence chain validation | Medication reconciliation | Sequential integrity verification |

Every one of these reuses an existing AI pattern. The Shared Spine AI platform
(skill registry, model routing, cost tracking, transparency logging) serves all of them.

### Revenue Model — LE

| Tier | What's Included | Target Customer |
|------|----------------|----------------|
| **SHIELD Only** | Welfare checks, missed check-in alerts | Any PD/SO partnering with WellFit community |
| **Jail Management** | SHIELD + booking, housing, daily ops, release | County jails (10-100 beds) |
| **Full RMS** | Jail + incidents, arrests, field reports, evidence, cases | Small-medium PD/SO (5-50 sworn) |
| **Full Suite** | RMS + dispatch/CAD + officer management | Departments wanting one platform |

### The Rural County Play (All Three Products)

```
┌─────────────────────────────────────────────────┐
│              WAYNE COUNTY, RURAL USA             │
│                                                  │
│  WAYNE-9001 (WellFit)          License: 9       │
│  ├── 2,000 seniors enrolled                     │
│  ├── Daily check-ins, wellness, engagement      │
│  └── Missed check-in → triggers SHIELD          │
│                                                  │
│  WAYNE-0001 (Atlus + WellFit)  License: 0       │
│  ├── County clinic (GP + Dental)                │
│  ├── Same seniors as patients                   │
│  ├── Doctors see check-in vitals                │
│  └── Health screening data for jail intake       │
│                                                  │
│  WAYNE-7001 (Justice)          License: 7       │
│  ├── Sheriff's department (12 deputies)         │
│  ├── County jail (25 beds)                      │
│  ├── SHIELD welfare checks ← check-in data     │
│  └── Booking health screen → clinical read      │
│                                                  │
│  THREE tenants. ONE platform. ONE county budget. │
└─────────────────────────────────────────────────┘
```

This is the pitch no other vendor can make: community engagement, clinical care,
and public safety on one governed platform, for the counties the big vendors ignore.

---

## Rules Summary

1. **Systems are hard walls.** Different compliance domains = different tenants, different accounts, no cross-writes.

2. **Modules are feature flags.** Same compliance domain = same tenant, gated by `tenant_module_config`, shared patient record.

3. **LE is always System C.** Never a module within System B. CJIS is not HIPAA.

4. **One narrow LE ↔ Clinical path.** Health screening at booking only. Fully audited, consent-gated, purpose-tagged.

5. **No LE ↔ Community path.** Ever. No scenario justifies law enforcement accessing wellness engagement data.

6. **Clinical specialties share patient data within a tenant.** Walling specialties would be clinically dangerous.

7. **General Practice is the base module.** All clinical tenants have GP enabled. Specialty modules extend GP, never replace it.

8. **Audit entries are domain-tagged.** Every log includes `domain: 'community' | 'clinical' | 'law_enforcement' | 'platform'`.

9. **The Shared Spine meets the strictest standard.** If CJIS requires something HIPAA doesn't, the Spine implements it for everyone.

10. **Platform super admins (Maria, Akima) are the only cross-system role.** Every cross-system action is logged with justification.
