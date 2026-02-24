# Envision Admin Panel Hardening Tracker

> **Last Updated:** 2026-02-24
> **Owner:** Maria (AI System Director)
> **Reviewer:** Akima (CCO)
> **Audit Date:** 2026-02-24

---

## How to Read This

| Symbol | Meaning |
|--------|---------|
| DONE | Complete, verified |
| IN PROGRESS | Currently being worked on |
| TODO | Not started |
| N/A | Not applicable or by design |

---

## Audit Summary

**70 registered admin sections, 40+ services, 104 top-level components**

| Area | Score | Finding |
|------|-------|---------|
| Dashboard Sections | 10/10 | 70/70 functional |
| Route Connectivity | 10/10 | AdminPanel correctly maps to IntelligentAdminPanel |
| Role Enforcement | 10/10 | Centralized, fail-safe, triple-layer |
| Service Layer | 10/10 | All database-backed, proper error handling |
| Database Wiring | 10/10 | All features use RLS |
| Edge Function Wiring | 10/10 | All edge functions properly connected |
| Envision Auth Flow | 10/10 | Complete 2FA flow |
| CRUD Operations | 9/10 | Minor gaps in read-only panels |
| Admin Separation | 9/10 | Needs RLS verification for tenant isolation |
| Test Coverage | 8/10 | **65/104 components tested (63%)** — +7 from Tier 2 Session 3 |

**Overall: 96/100 — functionally solid, test coverage at 63%**

---

# Tier 1 — Verification & Quick Fixes (~2 hours, 1 session)

## Item 1.1: Verify RLS Tenant Isolation on user_roles — DONE

| What | Detail |
|------|--------|
| Concern | Tenant admins may be able to see/modify roles in other tenants |
| Check | RLS policies verified: `user_roles` has `get_current_tenant_id()` scoping on SELECT, INSERT, UPDATE, DELETE |
| Result | No gap found — tenant isolation is properly enforced |

## Item 1.2: Fix SDOHCoderAssist Hardcoded Demo IDs — DONE

| What | Detail |
|------|--------|
| File | `src/components/admin/sections/SDOHCoderAssistWrapper.tsx` (new) |
| Problem | `encounterId="demo-encounter-id" patientId="demo-patient-id"` hardcoded |
| Fix | Created `SDOHCoderAssistWrapper` that reads from `PatientContext`, shows "Select a Patient" prompt when none selected |
| Commit | `31002ca9` |

## Item 1.3: Tenant Suspension — DONE (Session 5)

| What | Detail |
|------|--------|
| Login enforcement | Both `login` and `envision-login` edge functions check `tenant_system_status.is_suspended` |
| UI banner | `TenantSuspensionBanner` shows active/suspended state with reason, date, admin name |
| Tests | 6 behavioral tests (9,229 total) |

---

# Tier 2 — High-Priority Test Coverage (~24 hours, 4 sessions)

> Components that write to DB, handle clinical data, or manage compliance.
> These are the highest risk without tests.

## Session 1: Clinical & FHIR Components

| # | Component | Lines | Tests | Why High Priority | Status |
|---|-----------|-------|-------|-------------------|--------|
| 2.1 | FHIRInteroperabilityDashboard | ~400 | (covered by FhirAiDashboard) | Core interoperability feature | DONE |
| 2.2 | FHIRDataMapper | 535 | 12 tests | Data transformation critical path | DONE |
| 2.3 | FhirAiDashboard | 1039 | 13 tests | AI-powered FHIR analysis | DONE |
| 2.4 | RiskAssessmentManager | 415 | 19 tests | Clinical decision support | DONE |
| 2.5 | ClinicalNoteSummaryDashboard | 431 | 14 tests | Note aggregation | DONE |
| 2.6 | NoteLockingControls | 283 | 10 tests | 21 CFR Part 11 compliance | DONE |
| 2.7 | AmendmentWorkflow | 488 | 11 tests | HIPAA amendment tracking | DONE |

## Session 2: Billing & Revenue Components

| # | Component | Lines | Tests | Why High Priority | Status |
|---|-----------|-------|-------|-------------------|--------|
| 2.8 | BillingDashboard | 318 | 26 tests | Revenue operations | DONE |
| 2.9 | StaffFinancialSavingsTracker | 601 | 22 tests | Financial reporting | DONE |
| 2.10 | PriorAuthDashboard | 592 | 26 tests | Payer authorization | DONE |
| 2.11 | ClearinghouseConfigPanel | 342 | 26 tests | EDI credential management | DONE |
| 2.12 | MCPCostDashboard | 306 | 18 tests | MCP API cost tracking | DONE |
| 2.13 | ClaudeBillingMonitoringDashboard | 667 | 17 tests | AI cost monitoring | DONE |

## Session 3: Compliance & Security Components

| # | Component | Lines | Tests | Why High Priority | Status |
|---|-----------|-------|-------|-------------------|--------|
| 2.14 | SOC2SecurityDashboard | 311 | 20 tests | SOC2 compliance | DONE |
| 2.15 | SOC2ComplianceDashboard | 1062 | 23 tests | SOC2 compliance | DONE |
| 2.16 | SOC2AuditDashboard | 482 | 24 tests | SOC2 audit trail | DONE |
| 2.17 | SOC2ExecutiveDashboard | 425 | 31 tests | Executive compliance view | DONE |
| 2.18 | SOC2IncidentResponseDashboard | 473 | 27 tests | Incident response | DONE |
| 2.19 | ComplianceDashboard | 423 | 23 tests | General compliance | DONE |
| 2.20 | TenantAuditLogs | 355 | 24 tests | Audit log viewer | DONE |

## Session 4: Admin Operations Components

| # | Component | Lines | Why High Priority | Status |
|---|-----------|-------|-------------------|--------|
| 2.21 | FacilityManagementPanel | ~350 | Facility CRUD | TODO |
| 2.22 | AdminSettingsPanel | 511 | User preferences (store-only fixed) | TODO |
| 2.23 | TenantModuleConfigPanel | 424 | Feature flags per tenant | TODO |
| 2.24 | TenantBrandingManager | ~350 | Branding customization | TODO |
| 2.25 | HospitalPatientEnrollment | ~300 | Patient onboarding | TODO |
| 2.26 | MPIReviewQueue | ~250 | Master Patient Index | TODO |
| 2.27 | PatientEngagementDashboard | ~350 | Community analytics | TODO |

---

# Tier 3 — Medium-Priority Test Coverage (~18 hours, 3 sessions)

> Read-only dashboards, monitoring, AI transparency, utility components.

## Session 5: AI & Monitoring

| # | Component | Why | Status |
|---|-----------|-----|--------|
| 3.1 | AIModelCardsDashboard | HTI-2 transparency | TODO |
| 3.2 | AIAccuracyDashboard | Model performance | TODO |
| 3.3 | AIFinancialDashboard | AI cost analytics | TODO |
| 3.4 | TenantAIUsageDashboard | Per-tenant AI usage | TODO |
| 3.5 | GuardianAgentDashboard | AI orchestration | TODO |
| 3.6 | PerformanceMonitoringDashboard | System monitoring | TODO |
| 3.7 | CacheMonitoringDashboard | Cache analytics | TODO |
| 3.8 | DisasterRecoveryDashboard | DR status | TODO |

## Session 6: Admin Utilities

| # | Component | Why | Status |
|---|-----------|-----|--------|
| 3.9 | ApiKeyManager | API key CRUD | TODO |
| 3.10 | TenantConfigHistory | Config audit trail | TODO |
| 3.11 | TenantComplianceReport | Report generation | TODO |
| 3.12 | IntelligentAdminPanel | Main orchestrator | TODO |
| 3.13 | AdminHeader | Navigation | TODO |
| 3.14 | PinnedDashboardsBar | Dashboard pinning | TODO |
| 3.15 | SLABreachAlerts | SLA monitoring | TODO |
| 3.16 | TimeClockAdmin | Staff time tracking | TODO |

## Session 7: Forms & Enrollment

| # | Component | Why | Status |
|---|-----------|-----|--------|
| 3.17 | PatientEnrollmentForm | Patient forms | TODO |
| 3.18 | PaperFormScanner | OCR intake | TODO |
| 3.19 | PaperFormUploader | File upload | TODO |
| 3.20 | BulkEnrollmentPanel | Batch enrollment | TODO |
| 3.21 | BulkExportPanel | Data export | TODO |
| 3.22 | ExportCheckIns | Check-in export | TODO |
| 3.23 | RiskAssessmentForm | Risk entry | TODO |
| 3.24 | CareGapDashboard | Care gap analytics | TODO |
| 3.25 | PatientMergeWizard | MPI merge | TODO |

---

# Tier 4 — Nice-to-Haves (~8 hours, 1-2 sessions)

| # | Item | Type | Status |
|---|------|------|--------|
| 4.1 | Bulk CSV import for UserProvisioningPanel | Feature | TODO |
| 4.2 | Resend invitation flow for pending users | Feature | TODO |
| 4.3 | Super admin vs tenant admin role boundary documentation | Doc | TODO |
| 4.4 | FHIR Conflict Resolution tests (FHIRConflictResolution) | Test | TODO |
| 4.5 | HospitalAdapterManagementPanel tests | Test | TODO |
| 4.6 | ClinicalWorkflowWizard tests | Test | TODO |
| 4.7 | AdminWorkflowModeSwitcher tests | Test | TODO |
| 4.8 | Remaining utility component tests | Test | TODO |

---

## Session Log

### Session 5: Tier 1.3 + Tracker Creation — COMPLETE (2026-02-24)

| What | Result |
|------|--------|
| Tenant suspension enforcement | Login + envision-login edge functions check `tenant_system_status.is_suspended` |
| TenantSuspensionBanner | Active/suspended state display in TenantSecurityDashboard |
| Service method | `getTenantSuspensionStatus()` added to tenantSecurityService |
| Tests | 6 new behavioral tests (9,229 total, 475 suites) |
| Audit | Full 10-dimension evaluation of Envision Admin Panel |
| Tracker | Created this tracker with ~55 items across 4 tiers |

### Session 6: Tier 1 + Tier 2 Session 1 — COMPLETE (2026-02-24)

| What | Result |
|------|--------|
| Tier 1.1 RLS verification | Verified — tenant isolation properly enforced |
| Tier 1.2 SDOHCoderAssist fix | Created wrapper with PatientContext |
| Tier 2 Session 1 | 79 tests for 6 clinical/FHIR components |
| Tests | 9,308 total (481 suites) |

### Session 7: Tier 2 Session 2 — COMPLETE (2026-02-24)

| What | Result |
|------|--------|
| Tier 2 Session 2 | 135 tests for 6 billing/revenue components |
| Tests | 9,443 total (487 suites) |

### Session 8: Tier 2 Session 3 — COMPLETE (2026-02-24)

| What | Result |
|------|--------|
| Tier 2 Session 3 | 172 tests for 7 compliance/security components |
| Components | SOC2SecurityDashboard (20), SOC2ComplianceDashboard (23), SOC2AuditDashboard (24), SOC2ExecutiveDashboard (31), SOC2IncidentResponseDashboard (27), ComplianceDashboard (23), TenantAuditLogs (24) |
| Tests | 9,615 total (494 suites) |
| Coverage | 65/104 components (63%) |
| Note | SOC2ComplianceDashboard is 1,062 lines — flagged for future decomposition |

### Session 9: NOT STARTED

**Planned scope:** Tier 2 Session 4 (Admin Operations components 2.21-2.27)

---

## Estimates

| Tier | Sessions | Hours | Items |
|------|----------|-------|-------|
| Tier 1 (Fixes) | ~~0.5~~ | ~~2~~ | DONE |
| Tier 2 (High-Priority Tests) | ~~4~~ 3 done | ~~24~~ | 7 remaining (Session 4) |
| Tier 3 (Medium-Priority Tests) | 3 | ~18 | 25 components |
| Tier 4 (Nice-to-Haves) | 1-2 | ~8 | 8 items |
| **Total remaining** | **~5** | **~30** | **40 items** |
