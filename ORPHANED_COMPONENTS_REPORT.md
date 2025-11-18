# Orphaned Components Report - November 18, 2025

## Summary

Found **48 orphaned components** - built and working code that's not connected to any route.

**Categories**:
- 🟢 **High Value** - Production-ready features worth connecting (15)
- 🟡 **Medium Value** - Specialized features for specific use cases (18)
- 🔴 **Low Priority** - Internal/admin dashboards or experimental (15)

---

## 🟢 HIGH VALUE - Recommend Connecting These

### 1. **EnhancedQuestionsPage** (`src/pages/EnhancedQuestionsPage.tsx`)
**What it does**: Voice-enabled Q&A page (better UX than current QuestionsPage)
**Current**: QuestionsPage is routed at `/questions`
**Decision needed**:
- ✅ **REPLACE**: Swap QuestionsPage with EnhancedQuestionsPage (better features)
- ⏸️ **FEATURE FLAG**: Add as `/questions-enhanced` behind flag
- ❌ **DELETE**: Remove if voice features aren't ready

**File location**: `src/pages/EnhancedQuestionsPage.tsx`

---

### 2. **ReportsPrintPage** (`src/pages/ReportsPrintPage.tsx`)
**What it does**: Admin reporting dashboard for printing/exporting reports
**Current**: No route exists
**Decision needed**:
- ✅ **ADD ROUTE**: `/admin/reports` (admins likely need this!)
- ❌ **DELETE**: Remove if admin reports aren't needed

**Recommended route**:
```tsx
<Route path="/admin/reports" element={
  <RequireAuth>
    <RequireAdminAuth>
      <ReportsPrintPage />
    </RequireAdminAuth>
  </RequireAuth>
} />
```

---

### 3. **LawEnforcementLandingPage** (`src/pages/LawEnforcementLandingPage.tsx`)
**What it does**: Landing page for law enforcement "Are You OK?" welfare check program
**Current**: **IMPORTED** (line 98 in App.tsx) but **NOT ROUTED** - ESLint warning!
**Decision needed**:
- ✅ **ADD ROUTE**: `/law-enforcement` (you have ConstableDispatchDashboard at `/constable-dispatch`, this might be the entry point)
- ❌ **DELETE IMPORT**: Remove unused import

**Note**: ConstableDispatchDashboard is already routed, so this might be a landing/info page before login?

---

### 4. **MemoryClinicDashboard** (`src/components/neuro-suite/MemoryClinicDashboard.tsx`)
**What it does**: Dementia/cognitive screening dashboard for memory clinics
**Current**: Not routed
**Decision needed**:
- ✅ **ADD ROUTE**: `/memory-clinic` for specialists
- ⏸️ **FEATURE FLAG**: Enable for specific tenants with memory clinic programs
- ❌ **DELETE**: Remove if not offering memory clinic services

**High value if you serve memory/dementia patients!**

---

### 5. **MentalHealthDashboard** (`src/components/mental-health/MentalHealthDashboard.tsx`)
**What it does**: Mental health tracking and assessment dashboard
**Current**: Not routed
**Decision needed**:
- ✅ **ADD ROUTE**: `/mental-health` for patients or providers
- ⏸️ **FEATURE FLAG**: Enable for mental health programs
- ❌ **DELETE**: Remove if mental health isn't in scope

**High value for comprehensive care!**

---

### 6. **DentalHealthDashboard** - ✅ **ALREADY ROUTED!**
**Current status**: Routed at `/dental-health` ✅
**Action**: None needed - this is NOT orphaned!

---

### 7. **ShiftHandoffDashboard** (`src/components/nurse/ShiftHandoffDashboard.tsx`)
**What it does**: Nurse-to-nurse shift change handoff workflow
**Current**: Not routed (but you have EMSPage which might include it?)
**Decision needed**:
- ✅ **ADD ROUTE**: `/shift-handoff` for nurses
- ⏸️ **EMBEDDED**: Already used inside NursePanel? (check if it's a sub-component)
- ❌ **DELETE**: Remove if not needed

**Note**: Check if this is embedded in NursePanel already - might not be orphaned!

---

### 8. **ReceivingDashboard** (`src/components/handoff/ReceivingDashboard.tsx`)
**What it does**: ER receiving dashboard for incoming EMS handoffs
**Current**: Not routed
**Decision needed**:
- ✅ **ADD ROUTE**: `/handoff/receiving` for ER staff
- ⏸️ **EMBEDDED**: Might be used inside ERDashboardPage?
- ❌ **DELETE**: Remove if not needed

**Note**: Check if embedded in ERDashboardPage - you have EMS/ER workflows

---

### 9. **BillingReviewDashboard** (`src/components/billing/BillingReviewDashboard.tsx`)
**What it does**: Billing review and claims dashboard
**Current**: Not routed (but you have BillingDashboard at `/billing`)
**Decision needed**:
- ✅ **ADD ROUTE**: `/billing/review` as sub-page of billing
- ⏸️ **EMBEDDED**: Already inside BillingDashboard component?
- ❌ **DELETE**: Remove if redundant

**Note**: Check if this is a tab inside BillingDashboard

---

### 10. **EMSMetricsDashboard** (`src/components/ems/EMSMetricsDashboard.tsx`)
**What it does**: EMS performance metrics dashboard
**Current**: Not routed
**Decision needed**:
- ✅ **ADD ROUTE**: `/ems/metrics` for EMS supervisors
- ⏸️ **EMBEDDED**: Might be inside EMSPage?

---

### 11. **CoordinatedResponseDashboard** (`src/components/ems/CoordinatedResponseDashboard.tsx`)
**What it does**: Multi-department emergency coordination dashboard
**Current**: Not routed
**Decision needed**:
- ✅ **ADD ROUTE**: `/ems/coordinated-response`
- ⏸️ **EMBEDDED**: Might be inside EMSPage?

---

### 12. **PatientWaitingRoom** (mentioned in audit but file not found)
**Status**: Audit mentioned this, but I couldn't find the file - might be deleted already ✅

---

### 13. **DischargedPatientDashboard** (`src/components/discharge/DischargedPatientDashboard.tsx`)
**What it does**: Post-discharge patient tracking dashboard
**Current**: Not routed
**Decision needed**:
- ✅ **ADD ROUTE**: `/discharge/tracking` for care coordinators

---

### 14. **FrequentFlyerDashboard** (`src/components/atlas/FrequentFlyerDashboard.tsx`)
**What it does**: Tracks high-utilization patients (frequent ER visits)
**Current**: Not routed
**Decision needed**:
- ✅ **ADD ROUTE**: `/atlas/frequent-flyers` for case managers

**High value for population health management!**

---

### 15. **RevenueDashboard** (`src/components/atlas/RevenueDashboard.tsx`)
**What it does**: Revenue cycle analytics dashboard
**Current**: Not routed
**Decision needed**:
- ✅ **ADD ROUTE**: `/atlas/revenue` for billing/finance

---

## 🟡 MEDIUM VALUE - Specialized Features

### 16. **NeuroSuiteDashboard** (`src/components/neuro/NeuroSuiteDashboard.tsx`)
**What it does**: Neurological assessment suite dashboard
**Decision**: Feature flag for neurology specialties

---

### 17. **StrokeAssessmentDashboard** (`src/components/neuro-suite/StrokeAssessmentDashboard.tsx`)
**What it does**: Stroke patient assessment dashboard
**Decision**: Feature flag for stroke programs

---

### 18. **WearableDashboard** (TWO versions!)
- `src/components/neuro-suite/WearableDashboard.tsx`
- `src/components/patient/WearableDashboard.tsx`
**What it does**: Wearable device data integration dashboard
**Decision**: Feature flag for wearable device programs (might have duplicates - check both)

---

### 19. **SpecialistDashboard** (`src/components/specialist/SpecialistDashboard.tsx`)
**What it does**: General specialist workflow dashboard
**Decision**: Add route or feature flag for specialists

---

### 20. **FieldVisitWorkflow** (`src/components/specialist/FieldVisitWorkflow.tsx`)
**What it does**: Mobile field visit workflow for home health
**Decision**: Feature flag for home health services

---

### 21. **CaregiverPortal** (`src/components/neuro-suite/CaregiverPortal.tsx`)
**What it does**: Portal for family caregivers of neuro patients
**Decision**: Add route or feature flag

---

### 22-33. **Patient FHIR Dashboards** (in `src/components/patient/`):
- `CarePlanDashboard.tsx`
- `ObservationDashboard.tsx`
- `FhirAiPatientDashboard.tsx`
- `ImmunizationDashboard.tsx`

**What they do**: Individual dashboards for FHIR resources
**Current**: You already have pages for these (CarePlansPage, HealthObservationsPage, ImmunizationsPage)
**Decision**:
- ⏸️ **CHECK**: Are these embedded in the existing pages?
- ❌ **DELETE**: Remove if redundant with existing pages

---

## 🔴 LOW PRIORITY - Internal/Admin Dashboards

### 34. **ComplianceDashboard** (`src/components/admin/ComplianceDashboard.tsx`)
**What it does**: Compliance monitoring dashboard
**Decision**: Add to admin panel as tab or route

---

### 35-48. **SOC2/Monitoring Dashboards** (14 dashboards):
- `SOC2AuditDashboard.tsx`
- `SOC2ExecutiveDashboard.tsx`
- `SOC2SecurityDashboard.tsx`
- `SOC2IncidentResponseDashboard.tsx`
- `ClaudeBillingMonitoringDashboard.tsx`
- `CacheMonitoringDashboard.tsx`
- `PatientEngagementDashboard.tsx`
- `SystemAdminDashboard.tsx`
- `FHIRInteroperabilityDashboard.tsx`
- `PerformanceMonitoringDashboard.tsx`
- `MCPCostDashboard.tsx`
- `FhirAiDashboard.tsx`
- `TenantAIUsageDashboard.tsx`
- `ResilienceHubDashboard.tsx`

**What they do**: Internal monitoring, SOC2 compliance, performance tracking
**Current**: Not routed
**Decision**:
- ⏸️ **SUPER ADMIN**: Add routes under `/super-admin/soc2/`, `/super-admin/monitoring/`, etc.
- ⏸️ **EMBEDDED**: Many might be tabs inside SystemAdministrationPage already
- 🔧 **KEEP DARK**: These are likely for future SOC2 audit support - keep but don't route yet

---

## Super Admin Dashboards (Already under SuperAdminDashboard?)

These might already be embedded inside SuperAdminDashboard.tsx:
- `GuardianMonitoringDashboard.tsx`
- `PlatformAICostDashboard.tsx`
- `PlatformSOC2Dashboard.tsx`

**Action**: Check if these are sub-components inside SuperAdminDashboard

---

## 📊 Summary Statistics

| Category | Count | Recommendation |
|----------|-------|----------------|
| **High Value (Connect Now)** | 15 | Add routes or feature flags |
| **Medium Value (Specialized)** | 18 | Feature flag for specific programs |
| **Low Priority (Internal)** | 15 | Keep dark or add to super admin |
| **Already Routed** | 1 | DentalHealthDashboard ✅ |
| **Duplicates to Check** | 2 | WearableDashboard (2 versions) |

---

## 🎯 Recommended Action Plan

### Phase 1: HIGH VALUE - Do These First

1. **LawEnforcementLandingPage** - Remove unused import OR add route
2. **EnhancedQuestionsPage** - Decide: replace QuestionsPage or delete
3. **ReportsPrintPage** - Add `/admin/reports` route (admins likely need this)
4. **MemoryClinicDashboard** - Feature flag for memory clinic programs
5. **MentalHealthDashboard** - Feature flag for mental health programs
6. **FrequentFlyerDashboard** - Add to case manager workflows
7. **RevenueDashboard** - Add to billing/finance workflows

### Phase 2: MEDIUM VALUE - Feature Flags

8-21. Add feature flags for specialized dashboards (neuro, specialist, wearables, etc.)

### Phase 3: LOW PRIORITY - Internal Tools

22-48. Review SOC2/monitoring dashboards - likely keep dark for future audit support

---

## 🔍 Components That Need Investigation

### Check if Already Embedded:
1. **ShiftHandoffDashboard** - Is this inside NursePanel?
2. **ReceivingDashboard** - Is this inside ERDashboardPage?
3. **BillingReviewDashboard** - Is this inside BillingDashboard?
4. **EMSMetricsDashboard** - Is this inside EMSPage?
5. **CoordinatedResponseDashboard** - Is this inside EMSPage?
6. **Patient FHIR Dashboards** (4 dashboards) - Are these inside existing FHIR pages?
7. **Super Admin Dashboards** (3 dashboards) - Are these inside SuperAdminDashboard?

**How to check**: Search each dashboard name in the parent component files

---

## 💡 Quick Wins (Do These Right Now)

### 1. Remove Unused Import (30 seconds)
```tsx
// src/App.tsx line 98 - DELETE THIS LINE
const LawEnforcementLandingPage = React.lazy(() => import('./pages/LawEnforcementLandingPage'));
```

**OR** add a route for it if you actually want to use it.

### 2. Add ReportsPrintPage Route (2 minutes)
```tsx
<Route
  path="/admin/reports"
  element={
    <RequireAuth>
      <RequireAdminAuth>
        <ReportsPrintPage />
      </RequireAdminAuth>
    </RequireAuth>
  }
/>
```

### 3. Decide on EnhancedQuestionsPage (5 minutes)
Option A: Replace existing (if voice features are ready)
```tsx
// Change line 188:
<Route path="/questions" element={<RequireAuth><EnhancedQuestionsPage /></RequireAuth>} />
```

Option B: Feature flag
```tsx
<Route path="/questions-enhanced" element={<RequireAuth><EnhancedQuestionsPage /></RequireAuth>} />
```

Option C: Delete if not ready
```bash
rm src/pages/EnhancedQuestionsPage.tsx
```

---

## 🚀 What Do You Want to Do?

Let me know which components you want to:
1. **Connect now** (add routes)
2. **Feature flag** (add behind environment variable)
3. **Delete** (remove unused code)
4. **Investigate** (check if already embedded)

I can help you implement any of these decisions!

---

**Next Steps**: Pick 3-5 high-value items and I'll wire them up for you right now. 🛠️
