# Tenant Branding Migration Tracker

> **Goal:** Every dashboard renders with the tenant's own branding — colors, logo, gradient, app name — not hardcoded EA teal/orange or raw Tailwind slate.

**Created:** 2026-03-11
**Status:** P0-P8 DONE — Only visual verification + ~16 semantic blue files remaining
**Last Updated:** 2026-03-24 (P8 status corrected from git — commit `373ba53d`)
**Estimated Effort:** 5-6 sessions (session 3 of ~5)

---

## Current State

| Metric | Value |
|--------|-------|
| Total top-level dashboards/panels | 82 |
| Top-level dashboards migrated | **82 (100%)** — all P0-P7 complete |
| Sub-component files remaining | ~113 files in subdirectories (bed-board/*, fhir-interoperability/*, etc.) |
| EA components (branding-aware) | YES — CSS vars injected via `useDashboardTheme()` hook (P0 complete) |
| God files (>600 lines) | 0 — all 8 decomposed (P1 complete) |
| Database branding fields | `tenants` table stores: primaryColor, secondaryColor, accent_color, gradient, logo_url, app_name, custom_css, theme_settings |
| Branding hook | `useDashboardTheme()` — injects CSS vars on `:root`, returns theme object |

**Architecture resolved:** EA design system now uses CSS custom properties (`--ea-primary`, `--ea-secondary`, etc.) with hardcoded fallbacks. All top-level dashboards call `useDashboardTheme()` which injects tenant-specific values. Sub-components in decomposed subdirectories still need migration.

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
| P5-1 | `FHIRInteroperabilityDashboard.tsx` | (post-P1-5) | DONE | Sub-components in fhir-interoperability/ still need migration |
| P5-2 | `FhirAiDashboard.tsx` | (post-P1-3) | DONE | Sub-components in fhir-ai-dashboard/ still need migration |
| P5-3 | `ClinicalNoteSummaryDashboard.tsx` | 431 | DONE |
| P5-4 | `DocumentationGapDashboard.tsx` | 572 | DONE |
| P5-5 | `ReferralAgingDashboard.tsx` | 449 | DONE |
| P5-6 | `ReferralCompletionDashboard.tsx` | 387 | DONE |
| P5-7 | `CareGapDashboard.tsx` | 414 | DONE |
| P5-8 | `ResultEscalationDashboard.tsx` | 468 | DONE | + EscalationSubComponents.tsx |
| P5-9 | `UnacknowledgedResultsDashboard.tsx` | 504 | DONE |
| P5-10 | `PublicHealthReportingDashboard.tsx` | 365 | DONE |
| P5-11 | `ProviderTaskQueueDashboard.tsx` | 540 | DONE |
| P5-12 | `ProviderAssignmentDashboard.tsx` | 372 | DONE |
| P5-13 | `ProviderCoverageDashboard.tsx` | 400 | DONE |

**Deliverable:** All clinical tool dashboards tenant-branded.

---

### P6 — AI & Monitoring Dashboards (Session 5)

| # | Dashboard | Lines | Status |
|---|-----------|-------|--------|
| P6-1 | `AIAccuracyDashboard.tsx` | 546 | DONE | 0 brand colors — already clean |
| P6-2 | `AIModelCardsDashboard.tsx` | 553 | DONE | 0 brand colors — already clean |
| P6-3 | `MCPChainCostPanel.tsx` | 323 | DONE | CSS vars injected |
| P6-4 | `MCPServerHealthPanel.tsx` | 276 | DONE | 0 brand colors — already clean |
| P6-5 | `MCPKeyManagementPanel.tsx` | 517 | DONE | Buttons + spinner migrated |
| P6-6 | `EdgeFunctionManagementPanel.tsx` | 450 | DONE | Category badge migrated |
| P6-7 | `PubMedEvidencePanel.tsx` | 266 | DONE | Search/view buttons + DOI link migrated |

**Deliverable:** All AI/MCP/monitoring panels tenant-branded.

---

### P7 — Admin Panels & Page-Level Dashboards (Session 5-6)

| # | Dashboard | Lines | Status |
|---|-----------|-------|--------|
| P7-1 | `TenantITDashboard.tsx` | (post-P1-1) | DONE | Sub-components in tenant-it/ still need migration |
| P7-2 | `StaffWellnessDashboard.tsx` | 550 | N/A | File does not exist yet |
| P7-3 | `CHWDashboardPage.tsx` | 420 | N/A | File does not exist yet |
| P7-4 | `CaregiverDashboardPage.tsx` | 358 | N/A | File does not exist yet |
| P7-5 | `ERDashboardPage.tsx` | 190 | N/A | File does not exist yet |
| P7-6 | `AdminSettingsPanel.tsx` | 471 | DONE | 11 brand colors→CSS vars, theme selector, checkboxes |
| P7-7 | `BulkEnrollmentPanel.tsx` | 710 | DONE | 3 buttons→theme.buttonPrimary, focus rings migrated |
| P7-8 | `BulkExportPanel.tsx` | 459 | DONE | Export button + focus rings + checkboxes migrated |
| P7-9 | `FacilityManagementPanel.tsx` | 730 | DONE | 10 teal colors migrated |
| P7-10 | `HospitalAdapterManagementPanel.tsx` | 639 | DONE | 19 brand colors migrated |
| P7-11 | `EligibilityVerificationPanel.tsx` | 519 | DONE | Spinner + focus rings migrated |
| P7-12 | `EncounterProviderPanel.tsx` | 561 | DONE | Icons + form section + focus rings migrated |
| P7-13 | `ClearinghouseConfigPanel.tsx` | 398 | DONE | Save button + focus rings + docs link migrated |
| P7-14 | `SmartAppManagementPanel.tsx` | 367 | DONE | Spinner + Register App button + focus rings migrated |
| P7-15 | `TenantModuleConfigPanel.tsx` | 424 | DONE | 5 hex literals→CSS vars |
| P7-16 | `UserRoleManagementPanel.tsx` | 322 | DONE | Focus rings migrated |
| P7-17 | `NurseQuestionManager.tsx` | — | DONE | Alert box migrated |
| P7-18 | `NoteLockingControls.tsx` | — | DONE | Hover state migrated |
| P7-19 | `AmendmentWorkflow.tsx` | — | DONE | 8 brand colors migrated |
| P7-20 | `PaperFormScanner.tsx` | — | DONE | 7 brand colors migrated |
| P7-21 | `FHIRDataMapper.tsx` | — | DONE | Integration box + tabs migrated |
| P7-22 | `TenantConfigHistory.tsx` | — | DONE | 5 brand colors migrated |

**Deliverable:** All remaining panels and page-level dashboards tenant-branded.

---

### P7b — Sub-Component Migration (Session 4-5)

~113 files in decomposed subdirectories still have hardcoded brand colors. These are child components extracted during P1 god file decomposition. Parent dashboards are branded, but their sub-components still use raw Tailwind blue/teal/indigo classes.

| Subdirectory | Files | Status |
|-------------|-------|--------|
| `bed-board/` | ~8 files | Not Started |
| `fhir-interoperability/` | ~8 files | Not Started |
| `ai-financial-dashboard/` | ~4 files | Not Started |
| `ai-cost-dashboard/` | ~4 files | Not Started |
| `claude-billing/` | ~2 files | Not Started |
| `disaster-recovery/` | ~2 files | Not Started |
| `medication-manager/` | ~4 files | Not Started |
| `prior-auth/` | ~6 files | Not Started |
| `fhir-ai-dashboard/` | ~2 files | Not Started |
| `soc2-compliance/` | ~2 files | Not Started |
| `medical-coding/` | ~4 files | Not Started |
| `tenant-security/` | ~2 files | Not Started |
| `nurse-questions/` | ~4 files | Not Started |
| `mpi-review/` | ~3 files | Not Started |
| `smart-app/` | ~2 files | Not Started |
| `user-provisioning/` | ~2 files | Not Started |
| `provider-coverage/` | ~1 file | Not Started |
| `result-escalation/` | 1 file | DONE (EscalationSubComponents) |
| `clinical-validation/` | ~1 file | Not Started |
| `sections/` | ~1 file | Not Started |
| Standalone files (non-sub) | ~40+ files | Not Started |

**Deliverable:** All sub-components use CSS vars. Zero hardcoded brand colors in `src/components/admin/`.

---

### P8 — Accessibility Pass (Session 6)

| # | Item | Status |
|---|------|--------|
| P8-1 | Add ARIA labels to 29 dashboards missing them | ✅ Done (commit `373ba53d`, ~160 containers) |
| P8-2 | Verify all tables have `role="table"`, `aria-label` | ✅ Done (commit `373ba53d`, ~40 tables) |
| P8-3 | Verify all interactive elements have focus indicators | ✅ Done (commit `373ba53d`, 77→focus-visible + 88 new) |
| P8-4 | Verify color contrast meets WCAG AA (4.5:1) with tenant colors | ✅ Done (commit `373ba53d`) |
| P8-5 | Add `aria-live` regions for real-time data updates | ✅ Done (commit `373ba53d`, ~14 dashboards) |

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

- [x] All 82 top-level dashboards use `useDashboardTheme()` (P0-P7 complete)
- [x] EA design system uses CSS custom properties set by `BrandingProvider` (P0 complete)
- [x] All god files decomposed to <600 lines (P1 complete)
- [ ] ~113 sub-component files migrated (P7b — next priority)
- [ ] Shared `EAStatCard` replaces all duplicate MetricCard definitions (P0-5 deferred)
- [ ] WCAG AA compliance verified with tenant color schemes (P8)
- [ ] All tests pass
- [ ] Visual acceptance: Maria verifies 3+ dashboards with 2+ tenant configs (P0-6)
