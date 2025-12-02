# Envision Atlus Branding Migration Plan

## Overview

This plan migrates all clinical/admin components from legacy white/light theming to the **Envision Atlus Design System** - a clinical-grade dark theme optimized for healthcare professionals on long shifts.

### Key Principle: White-Label Architecture
- NO hardcoded brand names or colors
- Dynamic branding loaded from tenant configuration
- Envision Atlus is the DEFAULT clinical theme
- Tenants can customize colors via branding configuration

---

## Current State Assessment

### Components Already Using EA Design System (No Changes Needed)
| Component | Status |
|-----------|--------|
| PhysicalTherapyDashboard | EAPageLayout, EACard, EAButton, EAMetricCard |
| CareCoordinationDashboard | EAPageLayout, EACard, EAButton, EABadge |
| ReferralsDashboard | EAPageLayout, EACard, EAButton, EAMetricCard |
| QuestionnaireAnalyticsDashboard | EAPageLayout, EACard, EATabs |
| BedManagementPanel | EACard, EAButton, EAAlert |
| SystemAdminDashboard | EACard, EAButton, EAAlert |
| DentalHealthDashboard | EA components |
| TimeClockPage & widgets | EA components |

### Components Needing Migration (Ordered by Priority)

| Priority | Component | Current Issue |
|----------|-----------|---------------|
| **P1** | AdminHeader | Hardcoded `#006D75`, silver buttons, no EA components |
| **P1** | NeuroSuiteDashboard | `bg-white`, `text-gray-600`, light theme throughout |
| **P2** | SuperAdminDashboard | Light metrics boxes (`bg-white`, `bg-blue-50`) |
| **P2** | EnvisionLoginPage | Custom dark styling not aligned with EA palette |
| **P3** | StrokeAssessmentForm | White forms and light backgrounds |
| **P3** | TenantBrandingManager | Light theme UI |
| **P3** | ComplianceDashboard | Light theme cards |

---

## Implementation Plan

### Phase 1: AdminHeader (Critical - Used Everywhere)

**Current Problems:**
- Hardcoded teal `#006D75` (should be EA primary `#00857a`)
- Silver buttons `#C0C0C0` (not part of any design system)
- Title hardcoded as "Envision Atlus" (should be dynamic)
- `useBranding()` loaded but never used
- Dropdown has white/light theme

**Changes:**
1. Use EA gradient: `bg-gradient-to-r from-[#00857a] to-[#006d64]`
2. Replace silver buttons with `EAButton` component (ghost variant for nav)
3. Make title dynamic from branding context OR passed prop
4. Style dropdown with dark theme (slate-800 bg)
5. Use EA color variables throughout

**File:** `src/components/admin/AdminHeader.tsx`

---

### Phase 2: NeuroSuiteDashboard (High Impact Clinical Tool)

**Current Problems:**
- All cards use `bg-white` instead of `bg-slate-800`
- Text uses `text-gray-600` instead of `text-slate-300`
- Tables use light backgrounds
- Tabs have blue accent instead of EA teal
- Framework info cards use light gradients

**Changes:**
1. Wrap in `EAPageLayout` component
2. Replace metric cards with `EAMetricCard`
3. Replace generic cards with `EACard`, `EACardHeader`, `EACardContent`
4. Replace buttons with `EAButton`
5. Replace tabs with `EATabs`, `EATabsList`, `EATabsTrigger`, `EATabsContent`
6. Update all color classes to EA palette
7. Style tables with `envisionAtlusComponents.table` styles
8. Update ROBERT/FORBES framework cards to dark theme gradients

**File:** `src/components/neuro/NeuroSuiteDashboard.tsx`

---

### Phase 3: SuperAdminDashboard Metrics

**Current Problems:**
- Metric cards use light backgrounds (`bg-white`, `bg-blue-50`)
- Text uses light-mode colors

**Changes:**
1. Replace metric display with `EAMetricCard` components
2. Ensure container uses EA dark background
3. Update any remaining light-mode classes

**File:** `src/components/superAdmin/SuperAdminDashboard.tsx`

---

### Phase 4: EnvisionLoginPage

**Current Problems:**
- Uses custom slate/blue gradients not aligned with EA palette
- Buttons use `bg-blue-600` instead of EA teal
- Form inputs not using EA input styles

**Changes:**
1. Use `envisionAtlusLayout.page` for background
2. Use `EAButton` for submit
3. Apply `envisionAtlusComponents.input` styles to form fields
4. Use EA teal (`#00857a`) for accent elements
5. Maintain dark aesthetic but align colors

**File:** `src/pages/EnvisionLoginPage.tsx`

---

### Phase 5: Secondary Components

#### StrokeAssessmentForm
- Migrate to EA dark theme
- Use EACard for form sections
- Apply EA input styles
- Use EAButton for actions

#### TenantBrandingManager
- Migrate to dark theme
- Use EACard containers
- Apply EA input styles

#### ComplianceDashboard
- Replace light cards with EACard
- Update metrics to EAMetricCard
- Apply EA color palette

---

## Color Reference

### EA Primary Palette
```css
/* Use these colors - NOT hardcoded hex in JSX */
--ea-teal-500: #00857a   /* Primary */
--ea-teal-600: #006d64   /* Hover */
--ea-teal-700: #00554e   /* Active */
--ea-accent-500: #FF6B35 /* Accent/CTA */
--ea-slate-800: #1e293b  /* Card background */
--ea-slate-900: #0f172a  /* Page background */
```

### Semantic Colors (Medical Standard)
```css
Critical: #ef4444 (red)
High:     #f59e0b (amber)
Elevated: #eab308 (yellow)
Normal:   #22c55e (green)
Info:     #3b82f6 (blue)
```

---

## Testing Checklist

After each component migration:
- [ ] Verify dark theme renders correctly
- [ ] Check all text is readable (contrast)
- [ ] Verify buttons have proper hover states
- [ ] Test responsive layout
- [ ] Run `npm run typecheck`
- [ ] Run `npm run lint`
- [ ] Visual review in browser

---

## Files to Modify

| File | Action |
|------|--------|
| `src/components/admin/AdminHeader.tsx` | Major rewrite |
| `src/components/neuro/NeuroSuiteDashboard.tsx` | Major rewrite |
| `src/components/superAdmin/SuperAdminDashboard.tsx` | Moderate update |
| `src/pages/EnvisionLoginPage.tsx` | Moderate update |
| `src/components/neuro/StrokeAssessmentForm.tsx` | Moderate update |
| `src/components/admin/TenantBrandingManager.tsx` | Moderate update |
| `src/components/admin/ComplianceDashboard.tsx` | Moderate update |

---

## Success Criteria

1. All clinical dashboards use EA dark theme
2. No hardcoded brand names (dynamic from config)
3. All colors from EA palette (no random hex codes)
4. Consistent use of EA components (EACard, EAButton, etc.)
5. TypeScript compiles without errors
6. Lint passes without errors
7. Visual consistency across all admin/clinical views
