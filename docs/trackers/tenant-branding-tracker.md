# Tenant Branding Migration Tracker

> **Goal:** Every dashboard renders with the tenant's own branding — colors, logo, gradient, app name — not hardcoded EA teal/orange or raw Tailwind slate.

**Created:** 2026-03-11
**Status:** P0 In Progress (P0-1 through P0-4 DONE)
**Estimated Effort:** 5-6 sessions

---

## Current State

| Metric | Value |
|--------|-------|
| Total dashboards/panels | 82 |
| Using `useBranding()` today | 6 (8%) |
| Hardcoded colors | 66 (80%) |
| EA components (hardcoded theme) | 24 use EA, but EA itself is NOT branding-aware |
| God files (>600 lines) | 8 dashboards need decomposition first |
| Database branding fields | `tenants` table already stores: primaryColor, secondaryColor, accent_color, gradient, logo_url, app_name, custom_css, theme_settings |
| Branding hook | `useBranding()` in `BrandingContext.tsx` — fully functional, just unused |

**Architecture gap:** The EA design system (`EAButton`, `EACard`, `EABadge`, etc.) uses hardcoded hex values (`#00857a`, `#FF6B35`, `bg-slate-800`). Even if a dashboard calls `useBranding()`, the EA components inside it ignore the branding. The theme layer must be injected into EA components via CSS custom properties.

---

## Priority Tiers

### P0 — Foundation: Theme Token System (Session 1)

Make the EA design system branding-aware so all downstream work inherits correctly.

| # | Item | Status | Detail |
|---|------|--------|--------|
| P0-1 | Create `useDashboardTheme()` hook | DONE | Reads `useBranding()` + returns computed Tailwind classes and CSS vars for dashboard use. Maps `branding.primaryColor` → `--ea-primary`, `branding.secondaryColor` → `--ea-secondary`, etc. |
| P0-2 | Inject CSS custom properties at `BrandingProvider` | DONE | Set `--ea-teal-500`, `--ea-accent-500`, etc. on `:root` from tenant branding. EA components already reference these vars — they just need to be dynamic instead of static. |
| P0-3 | Update `envision-atlus-theme.ts` to use CSS vars | DONE | Replace hardcoded hex (`#00857a`) with `var(--ea-primary, #00857a)` so EA components respect tenant branding with a safe fallback. |
| P0-4 | Update EA components to use CSS vars | DONE | `EAButton`, `EACard`, `EABadge`, `EAAlert`, `EAMetricCard` — replace inline `bg-[#00857a]` with `bg-[var(--ea-primary)]` or Tailwind arbitrary value syntax. |
| P0-5 | Shared `MetricCard` component | Not Started | Extract the 3+ duplicate `MetricCard` definitions (AICostDashboard, SOC2ComplianceDashboard, GuardianAgentDashboard) into `EAMetricCard` if not already there, or create `EAStatCard`. Must use CSS vars. |
| P0-6 | Verify with 2+ tenant configs | Not Started | Test that switching tenant branding (e.g., WF-0001 vs a test tenant with different colors) actually changes dashboard appearance. |

**Deliverable:** EA components render with tenant colors. Any dashboard using EA components automatically gets tenant branding.

---

### P1 — God File Decomposition (Session 1-2)

These files exceed the 600-line limit and must be decomposed BEFORE branding migration (otherwise we're branding god files that will be restructured anyway).

| # | File | Lines | Status | Decomposition Plan |
|---|------|-------|--------|-------------------|
| P1-1 | `TenantITDashboard.tsx` | 1,171 | Not Started | Split into: `TenantITOverview`, `TenantITUsers`, `TenantITSessions`, `TenantITApiKeys`, `TenantITAudit`, `TenantITHealth`, `TenantITCompliance` (7 tab components + barrel) |
| P1-2 | `SOC2ComplianceDashboard.tsx` | 1,062 | Not Started | Already consolidates 3 dashboards — split tab content into: `SOC2AuditTab`, `SOC2SecurityTab`, `SOC2IncidentsTab` + shared `SOC2MetricCard` |
| P1-3 | `FhirAiDashboard.tsx` | 1,038 | Not Started | Split by tab/section into subdirectory |
| P1-4 | `AIFinancialDashboard.tsx` | 1,021 | Not Started | Split: `CostManagementTab`, `MCPSavingsTab`, `RevenueImpactTab` |
| P1-5 | `FHIRInteroperabilityDashboard.tsx` | 821 | Not Started | Split: `FHIROverview`, `FHIRConnections`, `FHIRSync`, `FHIRMappings`, `FHIRAnalytics` |
| P1-6 | `DisasterRecoveryDashboard.tsx` | 683 | Not Started | Split: `DRBackupStatus`, `DRDrillHistory`, `DRCompliance` |
| P1-7 | `ClaudeBillingMonitoringDashboard.tsx` | 666 | Not Started | Split: `BillingOverview`, `UsageBreakdown`, `AlertsConfig` |
| P1-8 | `AICostDashboard.tsx` | 654 | Not Started | Split: `CostMetrics`, `CostTrends`, `Recommendations` |

**Deliverable:** All dashboard files under 600 lines. Barrel re-exports preserve existing import paths.

---

### P2 — High-Impact Dashboard Branding (Session 2-3)

Migrate the most visible/demo-critical dashboards first. Each item = add `useBranding()` or `useDashboardTheme()` + replace hardcoded colors.

| # | Dashboard | Lines | Status | Notes |
|---|-----------|-------|--------|-------|
| P2-1 | `BillingDashboard.tsx` | 317 | Not Started | Uses raw Tailwind (`bg-white border border-black`, `bg-[#1BA39C]`) — full restyle needed |
| P2-2 | `PatientEngagementDashboard.tsx` | 486 | Not Started | Hardcoded engagement colors — map to semantic tokens |
| P2-3 | `BedManagementPanel.tsx` | 598 | Not Started | High-visibility clinical dashboard — uses `bg-slate-*` |
| P2-4 | `SystemAdminDashboard.tsx` | 589 | Not Started | Admin landing page — first thing admins see |
| P2-5 | `ComplianceDashboard.tsx` | 423 | Not Started | Compliance-facing — must look branded for auditors |
| P2-6 | `BedCommandCenter.tsx` | 570 | Not Started | Real-time operations — dark theme needs branding |
| P2-7 | `GuardianAgentDashboard.tsx` | 415 | Not Started | Uses emoji icons + gradient bg — needs EA + branding |
| P2-8 | `AuditAnalyticsDashboard.tsx` | 539 | Not Started | Audit-facing dashboard |

**Deliverable:** Top 8 dashboards render with tenant branding.

---

### P3 — Clinical & Compliance Dashboards (Session 3-4)

SOC2, HIPAA, and clinical workflow dashboards.

| # | Dashboard | Lines | Status |
|---|-----------|-------|--------|
| P3-1 | `SOC2AuditDashboard.tsx` | 482 | Not Started |
| P3-2 | `SOC2SecurityDashboard.tsx` | 311 | Not Started |
| P3-3 | `SOC2ExecutiveDashboard.tsx` | 425 | Not Started |
| P3-4 | `SOC2IncidentResponseDashboard.tsx` | 473 | Not Started |
| P3-5 | `BreachNotificationDashboard.tsx` | 439 | Not Started |
| P3-6 | `MfaComplianceDashboard.tsx` | 369 | Not Started |
| P3-7 | `TrainingComplianceDashboard.tsx` | 402 | Not Started |
| P3-8 | `BAATrackingDashboard.tsx` | 376 | Not Started |
| P3-9 | `DisclosureAccountingDashboard.tsx` | 314 | Not Started |
| P3-10 | `DisasterRecoveryDashboard.tsx` | (post-P1-6) | Not Started |
| P3-11 | `CacheMonitoringDashboard.tsx` | 317 | Not Started |
| P3-12 | `PerformanceMonitoringDashboard.tsx` | 374 | Not Started |

**Deliverable:** All compliance/security dashboards tenant-branded.

---

### P4 — Revenue & Billing Dashboards (Session 4)

| # | Dashboard | Lines | Status |
|---|-----------|-------|--------|
| P4-1 | `AIFinancialDashboard.tsx` | (post-P1-4) | Not Started |
| P4-2 | `AICostDashboard.tsx` | (post-P1-8) | Not Started |
| P4-3 | `ClaudeBillingMonitoringDashboard.tsx` | (post-P1-7) | Not Started |
| P4-4 | `MCPCostDashboard.tsx` | 305 | Not Started |
| P4-5 | `BillingQueueDashboard.tsx` | 493 | Not Started |
| P4-6 | `ClaimAgingDashboard.tsx` | 453 | Not Started |
| P4-7 | `ClaimResubmissionDashboard.tsx` | 393 | Not Started |
| P4-8 | `ERAPaymentPostingDashboard.tsx` | 367 | Not Started |
| P4-9 | `HCCOpportunityDashboard.tsx` | 512 | Not Started |
| P4-10 | `UndercodingDetectionDashboard.tsx` | 439 | Not Started |
| P4-11 | `SuperbillReviewPanel.tsx` | 564 | Not Started |

**Deliverable:** All billing/revenue dashboards tenant-branded.

---

### P5 — Clinical Tools & Referral Dashboards (Session 4-5)

| # | Dashboard | Lines | Status |
|---|-----------|-------|--------|
| P5-1 | `FHIRInteroperabilityDashboard.tsx` | (post-P1-5) | Not Started |
| P5-2 | `FhirAiDashboard.tsx` | (post-P1-3) | Not Started |
| P5-3 | `ClinicalNoteSummaryDashboard.tsx` | 431 | Not Started |
| P5-4 | `DocumentationGapDashboard.tsx` | 572 | Not Started |
| P5-5 | `ReferralAgingDashboard.tsx` | 449 | Not Started |
| P5-6 | `ReferralCompletionDashboard.tsx` | 387 | Not Started |
| P5-7 | `CareGapDashboard.tsx` | 414 | Not Started |
| P5-8 | `ResultEscalationDashboard.tsx` | 468 | Not Started |
| P5-9 | `UnacknowledgedResultsDashboard.tsx` | 504 | Not Started |
| P5-10 | `PublicHealthReportingDashboard.tsx` | 365 | Not Started |
| P5-11 | `ProviderTaskQueueDashboard.tsx` | 540 | Not Started |
| P5-12 | `ProviderAssignmentDashboard.tsx` | 372 | Not Started |
| P5-13 | `ProviderCoverageDashboard.tsx` | 400 | Not Started |

**Deliverable:** All clinical tool dashboards tenant-branded.

---

### P6 — AI & Monitoring Dashboards (Session 5)

| # | Dashboard | Lines | Status |
|---|-----------|-------|--------|
| P6-1 | `AIAccuracyDashboard.tsx` | 546 | Not Started |
| P6-2 | `AIModelCardsDashboard.tsx` | 553 | Not Started |
| P6-3 | `MCPChainCostPanel.tsx` | 323 | Not Started |
| P6-4 | `MCPServerHealthPanel.tsx` | 276 | Not Started |
| P6-5 | `MCPKeyManagementPanel.tsx` | 517 | Not Started |
| P6-6 | `EdgeFunctionManagementPanel.tsx` | 450 | Not Started |
| P6-7 | `PubMedEvidencePanel.tsx` | 266 | Not Started |

**Deliverable:** All AI/MCP/monitoring panels tenant-branded.

---

### P7 — Admin Panels & Page-Level Dashboards (Session 5-6)

| # | Dashboard | Lines | Status |
|---|-----------|-------|--------|
| P7-1 | `TenantITDashboard.tsx` | (post-P1-1) | Not Started |
| P7-2 | `StaffWellnessDashboard.tsx` | 550 | Not Started |
| P7-3 | `CHWDashboardPage.tsx` | 420 | Not Started |
| P7-4 | `CaregiverDashboardPage.tsx` | 358 | Not Started |
| P7-5 | `ERDashboardPage.tsx` | 190 | Not Started |
| P7-6 | `AdminSettingsPanel.tsx` | 471 | Not Started |
| P7-7 | `BulkEnrollmentPanel.tsx` | 710 | Not Started |
| P7-8 | `BulkExportPanel.tsx` | 459 | Not Started |
| P7-9 | `FacilityManagementPanel.tsx` | 730 | Not Started |
| P7-10 | `HospitalAdapterManagementPanel.tsx` | 639 | Not Started |
| P7-11 | `EligibilityVerificationPanel.tsx` | 519 | Not Started |
| P7-12 | `EncounterProviderPanel.tsx` | 561 | Not Started |
| P7-13 | `ClearinghouseConfigPanel.tsx` | 398 | Not Started |
| P7-14 | `SmartAppManagementPanel.tsx` | 367 | Not Started |
| P7-15 | `TenantModuleConfigPanel.tsx` | 424 | Not Started |
| P7-16 | `UserRoleManagementPanel.tsx` | 322 | Not Started |

**Deliverable:** All remaining panels and page-level dashboards tenant-branded.

---

### P8 — Accessibility Pass (Session 6)

| # | Item | Status |
|---|------|--------|
| P8-1 | Add ARIA labels to 29 dashboards missing them | Not Started |
| P8-2 | Verify all tables have `role="table"`, `aria-label` | Not Started |
| P8-3 | Verify all interactive elements have focus indicators | Not Started |
| P8-4 | Verify color contrast meets WCAG AA (4.5:1) with tenant colors | Not Started |
| P8-5 | Add `aria-live` regions for real-time data updates | Not Started |

**Deliverable:** All dashboards WCAG AA compliant with tenant branding.

---

## Migration Pattern (Per Dashboard)

```typescript
// BEFORE: Hardcoded
<div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
  <div className="text-sm text-slate-400">{label}</div>
  <div className="text-2xl font-bold text-white">{value}</div>
</div>

// AFTER: Tenant-branded via CSS vars (set by BrandingProvider)
<EACard>
  <EACardContent>
    <div className="text-sm text-[var(--ea-text-secondary)]">{label}</div>
    <div className="text-2xl font-bold text-[var(--ea-text-primary)]">{value}</div>
  </EACardContent>
</EACard>
```

**Per-dashboard checklist:**
1. [ ] Import `useBranding()` or confirm EA components handle it
2. [ ] Replace hardcoded hex/Tailwind colors with CSS var or EA component
3. [ ] Replace duplicate `MetricCard` with shared `EAMetricCard`/`EAStatCard`
4. [ ] Add ARIA labels to tables, buttons, filters
5. [ ] Verify visual rendering with 2+ tenant configs
6. [ ] Run `npm run typecheck && npm run lint && npm test`

---

## Definition of Done

- [ ] All 82 dashboards render with tenant branding (no hardcoded colors visible)
- [ ] EA design system uses CSS custom properties set by `BrandingProvider`
- [ ] All god files decomposed to <600 lines
- [ ] Shared `EAStatCard` replaces all duplicate MetricCard definitions
- [ ] WCAG AA compliance verified with tenant color schemes
- [ ] All tests pass (11,162+)
- [ ] Visual acceptance: Maria verifies 3+ dashboards with 2+ tenant configs
