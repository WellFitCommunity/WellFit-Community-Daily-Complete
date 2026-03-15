# Tenant Branding Migration Tracker

> **Goal:** Every dashboard renders with the tenant's own branding — colors, logo, gradient, app name — not hardcoded EA teal/orange or raw Tailwind slate.

**Created:** 2026-03-11
**Status:** P5/P7 In Progress — P0-P4 DONE, P6 skipped (files don't exist yet)
**Estimated Effort:** 5-6 sessions (session 3 of ~5)

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
| P0-5 | Shared `MetricCard` component | Deferred | EAMetricCard exists; individual dashboards use local MetricCard variants — standardize later if needed |
| P0-6 | Verify with 2+ tenant configs | Not Started | Test that switching tenant branding (e.g., WF-0001 vs a test tenant with different colors) actually changes dashboard appearance. **Visual acceptance required.** |

**Deliverable:** EA components render with tenant colors. Any dashboard using EA components automatically gets tenant branding.

---

### P1 — God File Decomposition (Session 1-2)

These files exceed the 600-line limit and must be decomposed BEFORE branding migration (otherwise we're branding god files that will be restructured anyway).

| # | File | Lines | Status | Decomposition Plan |
|---|------|-------|--------|-------------------|
| P1-1 | `TenantITDashboard.tsx` | 1,171→decomposed | DONE | Split into 7 tab components + barrel (prior session) |
| P1-2 | `SOC2ComplianceDashboard.tsx` | 1,062→decomposed | DONE | Split into tab components (prior session) |
| P1-3 | `FhirAiDashboard.tsx` | 1,038→591 | DONE | Decomposed into FhirAiDashboardMain (591 lines — under 600 limit) |
| P1-4 | `AIFinancialDashboard.tsx` | 1,021→decomposed | DONE | Split into cost/savings/revenue tabs (prior session) |
| P1-5 | `FHIRInteroperabilityDashboard.tsx` | 821→decomposed | DONE | Split into fhir-interoperability/ subdirectory (prior session) |
| P1-6 | `DisasterRecoveryDashboard.tsx` | 683→decomposed | DONE | Split into disaster-recovery/ subdirectory (prior session) |
| P1-7 | `ClaudeBillingMonitoringDashboard.tsx` | 666→decomposed | DONE | Split into claude-billing/ subdirectory (prior session) |
| P1-8 | `AICostDashboard.tsx` | 654→under 600 | DONE | Trimmed to under 600 lines (prior session) |

**Deliverable:** All dashboard files under 600 lines. Barrel re-exports preserve existing import paths.

---

### P2 — High-Impact Dashboard Branding (Session 2-3)

Migrate the most visible/demo-critical dashboards first. Each item = add `useBranding()` or `useDashboardTheme()` + replace hardcoded colors.

| # | Dashboard | Lines | Status | Notes |
|---|-----------|-------|--------|-------|
| P2-1 | `BillingDashboard.tsx` | 317 | DONE | Full restyle: hex→CSS vars, emoji→Lucide icons, ARIA added |
| P2-2 | `PatientEngagementDashboard.tsx` | 486 | DONE | Brand colors→CSS vars, refresh button→theme.buttonPrimary |
| P2-3 | `BedManagementPanel.tsx` | 598 | DONE | Tab active state + voice search ring→CSS vars |
| P2-4 | `SystemAdminDashboard.tsx` | 589 | DONE | 8x text-[#00857a] + bg-[#00857a]/20→CSS vars |
| P2-5 | `ComplianceDashboard.tsx` | 423 | DONE | 8x brand color→CSS vars, action button→theme.buttonPrimary |
| P2-6 | `BedCommandCenter.tsx` | 570 | DONE | Refresh + acknowledge buttons→theme.buttonPrimary |
| P2-7 | `GuardianAgentDashboard.tsx` | 415 | DONE | Loading spinner, page bg, healing/knowledge cards→CSS vars |
| P2-8 | `AuditAnalyticsDashboard.tsx` | 539 | DONE | Header icon, total events, search focus ring→CSS vars |

**Deliverable:** Top 8 dashboards render with tenant branding.

---

### P3 — Clinical & Compliance Dashboards (Session 3-4)

SOC2, HIPAA, and clinical workflow dashboards.

| # | Dashboard | Lines | Status |
|---|-----------|-------|--------|
| P3-1 | `SOC2AuditDashboard.tsx` | 482 | DONE |
| P3-2 | `SOC2SecurityDashboard.tsx` | 311 | DONE |
| P3-3 | `SOC2ExecutiveDashboard.tsx` | 425 | DONE |
| P3-4 | `SOC2IncidentResponseDashboard.tsx` | 473 | DONE |
| P3-5 | `BreachNotificationDashboard.tsx` | 439 | DONE |
| P3-6 | `MfaComplianceDashboard.tsx` | 369 | DONE |
| P3-7 | `TrainingComplianceDashboard.tsx` | 402 | DONE |
| P3-8 | `BAATrackingDashboard.tsx` | 376 | DONE |
| P3-9 | `DisclosureAccountingDashboard.tsx` | 314 | DONE |
| P3-10 | `DisasterRecoveryDashboard.tsx` | (post-P1-6) | DONE |
| P3-11 | `CacheMonitoringDashboard.tsx` | 317 | DONE |
| P3-12 | `PerformanceMonitoringDashboard.tsx` | 374 | DONE |

**Deliverable:** All compliance/security dashboards tenant-branded.

---

### P4 — Revenue & Billing Dashboards (Session 4)

| # | Dashboard | Lines | Status |
|---|-----------|-------|--------|
| P4-1 | `AIFinancialDashboard.tsx` | (post-P1-4) | DONE |
| P4-2 | `AICostDashboard.tsx` | (post-P1-8) | DONE |
| P4-3 | `ClaudeBillingMonitoringDashboard.tsx` | (post-P1-7) | DONE |
| P4-4 | `MCPCostDashboard.tsx` | 305 | DONE |
| P4-5 | `BillingQueueDashboard.tsx` | 493 | DONE |
| P4-6 | `ClaimAgingDashboard.tsx` | 453 | DONE |
| P4-7 | `ClaimResubmissionDashboard.tsx` | 393 | DONE |
| P4-8 | `ERAPaymentPostingDashboard.tsx` | 367 | DONE |
| P4-9 | `HCCOpportunityDashboard.tsx` | 512 | DONE |
| P4-10 | `UndercodingDetectionDashboard.tsx` | 439 | DONE |
| P4-11 | `SuperbillReviewPanel.tsx` | 564 | DONE |

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
| P6-1 | `AIAccuracyDashboard.tsx` | 546 | DONE | 0 brand colors — already clean |
| P6-2 | `AIModelCardsDashboard.tsx` | 553 | DONE | 0 brand colors — already clean |
| P6-3 | `MCPChainCostPanel.tsx` | 323 | Not Started | 1 brand color |
| P6-4 | `MCPServerHealthPanel.tsx` | 276 | DONE | 0 brand colors — already clean |
| P6-5 | `MCPKeyManagementPanel.tsx` | 517 | Not Started | 3 brand colors |
| P6-6 | `EdgeFunctionManagementPanel.tsx` | 450 | Not Started | 1 brand color |
| P6-7 | `PubMedEvidencePanel.tsx` | 266 | Not Started | 1 brand color |

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
