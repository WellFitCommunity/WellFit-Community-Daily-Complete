# Access Control Matrix

**Envision Virtual Edge Group LLC**
**Last Updated:** February 6, 2026
**HIPAA Reference:** 45 CFR 164.312(a)(1) - Access Control

---

## Overview

This document maps user roles to data access permissions across the WellFit Community and Envision Atlus platforms. Access control is enforced at three layers:

1. **Database (RLS)** - Row Level Security policies on all tables
2. **Edge Functions** - Role verification before data access
3. **Frontend** - UI elements hidden/shown based on role

**Principle: Deny by default.** If a role is not explicitly listed, access is denied.

---

## Role Definitions

### Administrative Roles

| Role | Code | Scope | Description |
|------|------|-------|-------------|
| `super_admin` | 1 | Platform-wide | Envision employees only. All tenant access. |
| `admin` | 2 | Tenant | Facility-level admin (clinical + business) |
| `it_admin` | 19 | Tenant | Technical operations only (NO clinical access) |
| `department_head` | 11 | Department | Executive leadership (CNO, CMO). Department-scoped. |

### Clinical Roles

| Role | Code | Scope | Description |
|------|------|-------|-------------|
| `physician` / `doctor` | 5 | Tenant | Attending physicians. Diagnosis, treatment, orders. |
| `nurse` | 3 | Tenant | RNs, LPNs. Patient care, medications, vitals. |
| `nurse_practitioner` | 8 | Tenant | Advanced practice (independent). |
| `physician_assistant` | 9 | Tenant | Advanced practice (collaborative). |
| `clinical_supervisor` | 10 | Tenant | Nurse managers. Nursing oversight. |
| `case_manager` | 14 | Tenant | Discharge planning, care transitions. |
| `social_worker` | 15 | Tenant | Mental health, community resources. |
| `pharmacist` | 23 | Tenant | Medication management, interactions. |
| `radiologist` | 24 | Tenant | Diagnostic imaging analysis. |
| `lab_tech` | 22 | Tenant | Lab sample processing, results entry. |
| `physical_therapist` | 12/20 | Tenant | Physical rehabilitation. |

### Community Roles

| Role | Code | Scope | Description |
|------|------|-------|-------------|
| `community_health_worker` / `chw` | 17/18 | Tenant | Field outreach, patient engagement. |
| `quality_manager` | 21 | Tenant | Compliance and quality monitoring. |
| `billing_specialist` | 25 | Tenant | Claims, billing, financial records. |
| `volunteer` | 6 | Tenant | Community volunteers. Limited access. |
| `staff` | 7 | Tenant | General non-clinical staff. |

### Patient Roles

| Role | Code | Scope | Description |
|------|------|-------|-------------|
| `patient` | 16 | Own data | Universal care recipient (all ages). |
| `senior` | 4 | Own data | Legacy patient role (deprecated; use `patient`). |
| `caregiver` | 13 | Proxy | Family caregiver. PIN-based access to one patient. |

---

## Access Matrix

**Legend:** R = Read, W = Write, D = Delete, -- = No Access

### Patient Clinical Data

| Data | super_admin | admin | physician/nurse | case_manager | chw | patient | caregiver |
|------|:-----------:|:-----:|:---------------:|:------------:|:---:|:-------:|:---------:|
| Patient demographics | R/W/D | R/W | R | R | R (limited) | R/W (own) | R (proxy) |
| Vitals / check-ins | R | R | R/W | R | R | R/W (own) | R (proxy) |
| Risk assessments | R | R | R/W | R | -- | R (own) | -- |
| Conditions (FHIR) | R | R | R/W | R | -- | R (own) | -- |
| Medications (FHIR) | R | R | R/W | R | -- | R (own) | -- |
| Lab results (FHIR) | R | R | R/W | R | -- | R (own) | -- |
| Care plans (FHIR) | R | R | R/W | R/W | -- | R (own) | -- |
| Dental assessments | R | R | R/W | R | -- | R (own) | -- |
| Immunizations (FHIR) | R | R | R/W | R | -- | R (own) | -- |
| SHIELD welfare checks | R | R | R/W | R | -- | -- | -- |

### Administrative Data

| Data | super_admin | admin | it_admin | dept_head | clinical staff | patient |
|------|:-----------:|:-----:|:--------:|:---------:|:--------------:|:-------:|
| User management | R/W/D | R/W | R/W | R (dept) | -- | -- |
| Audit logs | R | R | R | -- | -- | -- |
| System configuration | R/W | R/W | R/W | -- | -- | -- |
| AI usage logs | R | R | R | -- | -- | -- |
| Tenant settings | R/W | R/W | R/W | -- | -- | -- |

### Billing & Claims

| Data | super_admin | admin | billing_specialist | physician | nurse | patient |
|------|:-----------:|:-----:|:------------------:|:---------:|:-----:|:-------:|
| Claims (837P/837I) | R | R | R/W | R | -- | -- |
| Remittance (835) | R | R | R/W | -- | -- | -- |
| Prior authorizations | R | R | R/W | R/W | R | -- |
| CDT codes | R | R | R | R | R | -- |
| Financial savings | R | R | R/W | -- | -- | -- |

### FHIR Interoperability

| Data | super_admin | admin | physician | nurse | lab_tech | pharmacist | patient |
|------|:-----------:|:-----:|:---------:|:-----:|:--------:|:----------:|:-------:|
| FHIR connections | R/W | R/W | -- | -- | -- | -- | -- |
| Sync operations | R/W | R/W | R | R | -- | -- | -- |
| Diagnostic reports | R | R | R/W | R | R/W | R | R (own) |
| Observations | R | R | R/W | R/W | R/W | R | R (own) |
| Encounters | R | R | R/W | R/W | -- | -- | R (own) |
| Pharmacy claims | R | R | R | -- | -- | R/W | -- |

---

## Role Determination Priority

Access is determined using a **deny-by-default** approach with this priority order:

1. **`user_roles` table** (authoritative source of truth)
2. **`profiles.role_code`** (fallback for legacy compatibility)
3. **Auth metadata** (emergency fallback only)

If no role can be proven, access is denied.

---

## Special Access Patterns

### Caregiver Proxy Access
- PIN-based authentication (separate from main auth)
- 30-minute session timeout
- Read-only access to one designated patient
- All access logged to caregiver audit trail

### Department Scoping
- `department_head` can only access data within their assigned department
- `super_admin` bypasses department scoping
- Available departments: `nursing`, `medical`, `therapy`, `administration`

### Multi-Tenant Isolation
- All queries include `tenant_id` filtering via RLS
- Users cannot access data from other tenants
- `super_admin` can access all tenants (platform operations only)

---

## Authentication Requirements

| Role Category | Auth Method |
|---------------|-------------|
| Admin roles | Password + PIN (two-factor) |
| Clinical roles | Password (Supabase Auth) |
| Patient roles | Password or phone verification |
| Caregiver | PIN-based session (delegated by patient) |

---

## Enforcement Locations

| Layer | File(s) | What It Enforces |
|-------|---------|-----------------|
| Database RLS | `supabase/migrations/20251018130000_*.sql` | Row-level tenant isolation and role checks |
| Role authority (frontend) | `src/lib/roleAuthority.ts` | UI access decisions |
| Role authority (edge) | `supabase/functions/_shared/roleAuthority.ts` | API access decisions |
| Admin hook | `src/hooks/useIsAdmin.ts` | Admin panel visibility |
| MCP auth gate | `supabase/functions/_shared/mcpAuthGate.ts` | MCP server clinical access verification |

---

## Review Schedule

- **Quarterly**: Verify RLS policies match this matrix
- **On role addition**: Update this document before deploying new role
- **Annually**: Full access audit with compliance officer

---

*Document Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
