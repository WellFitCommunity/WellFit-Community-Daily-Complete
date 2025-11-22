# WellFit Codebase Optimization Tracker

**Started**: 2025-11-22
**Status**: In Progress
**Goal**: Improve performance, reduce bundle size, implement proper caching

---

## 🎯 Active Optimizations

### 1. ✅ Query Caching Implementation - React Query/TanStack Query
**Priority**: CRITICAL
**Status**: 🔄 In Progress
**Started**: 2025-11-22
**Estimated Effort**: 3-4 days
**Impact**: 60-70% reduction in API calls

#### Problem
- 488 Supabase queries with NO caching layer
- Same data fetched repeatedly (user profiles, patient lists, vitals, medications)
- No request deduplication or stale data management
- Example: CommunityMoments calls `getSignedUrlIfPossible()` for every image on every render

#### Solution
- Install and configure React Query (TanStack Query)
- Wrap all Supabase calls with React Query hooks
- Configure appropriate cache times (5-10 min for patient data)
- Create batch endpoints for related resources

#### Implementation Plan
- [x] Install @tanstack/react-query ✅ v5.x installed
- [x] Create QueryClient configuration in `/src/lib/queryClient.ts` ✅ Complete with cache presets
- [x] Wrap App with QueryClientProvider ✅ App.tsx wrapped
- [x] Add React Query DevTools for debugging ✅ DevTools added (dev only)
- [x] Convert billingService.ts to use React Query ✅ COMPLETE (2025-11-22)
- [ ] Convert fhirResourceService.ts to use React Query (NEXT)
- [ ] Convert wearableService.ts to use React Query
- [ ] Convert patientService.ts to use React Query
- [ ] Add caching to CommunityMoments image URLs
- [ ] Test and measure API call reduction

#### Files to Modify
- [x] `package.json` - Add @tanstack/react-query dependency ✅
- [x] `src/App.tsx` - Wrap with QueryClientProvider ✅
- [x] `src/lib/queryClient.ts` - NEW: Query configuration ✅
- [x] `src/hooks/useBillingData.ts` - NEW: Custom hook for billing queries ✅ (2025-11-22)
- [x] `src/components/admin/BillingDashboard.tsx` - Converted to use React Query ✅ (2025-11-22)
- [ ] `src/services/fhirResourceService.ts` - Convert to React Query hooks (NEXT)
- [ ] `src/services/wearableService.ts` - Convert to React Query hooks
- [ ] `src/services/patientService.ts` - Convert to React Query hooks
- [ ] `src/components/CommunityMoments.tsx` - Cache image URL fetches
- [ ] `src/hooks/usePatientData.ts` - NEW: Custom hook for patient queries
- [ ] `src/hooks/useFhirData.ts` - NEW: Custom hook for FHIR queries
- [ ] `src/hooks/useWearableData.ts` - NEW: Custom hook for wearable queries

#### Success Metrics
- [ ] Measure API call count BEFORE (baseline)
- [ ] Measure API call count AFTER implementation
- [ ] Target: 60-70% reduction in duplicate calls
- [ ] Lighthouse performance score improvement
- [ ] User-reported speed improvement

#### Notes
- React Query handles background refetching automatically
- Built-in loading/error states
- Automatic request deduplication (multiple components requesting same data)
- Stale-while-revalidate pattern out of the box

---

### 2. ✅ Code Splitting & Lazy Loading for Large Components
**Priority**: CRITICAL
**Status**: 🔄 In Progress
**Started**: 2025-11-22
**Estimated Effort**: 2-3 days
**Impact**: 20-30% smaller initial bundle

#### Problem
- `IntelligentAdminPanel.tsx` (916 lines) renders 40+ components immediately
- `AdminPanel.tsx` (1,008 lines) appears to duplicate IntelligentAdminPanel
- `RealTimeSmartScribe.tsx` (1,008 lines) loads all audio streaming logic upfront
- `LiteSenderPortal.tsx` (1,165 lines) single monolithic file
- `CommunityMoments.tsx` (923 lines) loads file upload, emoji picker, gallery immediately

#### Solution
- Implement React.lazy() for dashboard sections
- Add proper Suspense boundaries with loading states
- Split IntelligentAdminPanel into 8-10 lazy-loaded modules
- Remove duplicate AdminPanel OR consolidate with IntelligentAdminPanel
- Code-split SmartScribe audio processing from UI

#### Implementation Plan

##### Phase 1: IntelligentAdminPanel Code Splitting
- [ ] Analyze IntelligentAdminPanel structure (40+ sections)
- [ ] Create `/src/components/admin/sections/` directory
- [ ] Extract each dashboard section to separate file:
  - [ ] SystemMetricsSection.tsx
  - [ ] BillingDashboardSection.tsx
  - [ ] SmartScribeSection.tsx
  - [ ] RevenueDashboardSection.tsx
  - [ ] PatientEngagementSection.tsx
  - [ ] PerformanceMonitoringSection.tsx
  - [ ] TenantManagementSection.tsx
  - [ ] SecurityDashboardSection.tsx
- [ ] Wrap each section with React.lazy()
- [ ] Add Suspense boundaries with loading skeletons
- [ ] Test that sections load only when visible

##### Phase 2: Resolve AdminPanel Duplication
- [ ] Compare AdminPanel.tsx vs IntelligentAdminPanel.tsx functionality
- [ ] Document differences (if any)
- [ ] Decide: Keep IntelligentAdminPanel OR AdminPanel (not both)
- [ ] Create migration plan for components using deprecated panel
- [ ] Remove duplicate file
- [ ] Update imports across codebase

##### Phase 3: SmartScribe Component Split
- [ ] Split RealTimeSmartScribe.tsx into:
  - [ ] `SmartScribeUI.tsx` - React components only
  - [ ] `useSmartScribe.ts` - Business logic hook
  - [ ] `audioProcessor.ts` - Audio streaming worker/utility
- [ ] Lazy load audio processor only when recording starts
- [ ] Add Suspense for loading state

##### Phase 4: LiteSenderPortal Refactor
- [ ] Split LiteSenderPortal.tsx into logical modules:
  - [ ] `LiteSenderUI.tsx` - Main component
  - [ ] `useLiteSenderLogic.ts` - State and API logic
  - [ ] `LiteSenderForm.tsx` - Form components
  - [ ] `LiteSenderHistory.tsx` - History section
- [ ] Lazy load history section (likely not used immediately)

##### Phase 5: CommunityMoments Optimization
- [ ] Split CommunityMoments.tsx components:
  - [ ] Lazy load EmojiPicker (only when emoji button clicked)
  - [ ] Lazy load FileUploader (only when upload initiated)
  - [ ] Lazy load ImageGallery (if not visible on initial load)

#### Files to Modify
- [ ] `src/components/admin/IntelligentAdminPanel.tsx` - Refactor with lazy loading
- [ ] `src/components/admin/sections/` - NEW DIRECTORY: 8-10 section files
- [ ] `src/components/admin/AdminPanel.tsx` - REMOVE or consolidate
- [ ] `src/components/smart/RealTimeSmartScribe.tsx` - Split into 3 files
- [ ] `src/components/handoff/LiteSenderPortal.tsx` - Split into 4 files
- [ ] `src/components/CommunityMoments.tsx` - Add lazy loading for heavy features
- [ ] `src/App.tsx` - Verify Suspense boundaries configured

#### Success Metrics
- [ ] Measure bundle size BEFORE (from `npm run build`)
- [ ] Measure bundle size AFTER implementation
- [ ] Target: 20-30% reduction in initial bundle
- [ ] Measure Time-to-Interactive with Lighthouse
- [ ] Verify chunks load on-demand in Network tab

#### Notes
- Use React DevTools Profiler to verify components only mount when needed
- Add proper error boundaries around Suspense
- Consider prefetching for sections user is likely to visit

---

## 📋 Planned Optimizations (Not Started)

### 3. ⏳ React.memo Implementation
**Priority**: HIGH
**Status**: ⏳ Planned
**Effort**: 1 day
**Impact**: 40-60% fewer re-renders

**Files**: Top 20 largest components (>500 lines)
- `IntelligentAdminPanel.tsx`
- `PhysicianPanel.tsx` (902 lines)
- `CommunityMoments.tsx`
- `UsersList.tsx` (950 lines)
- Dashboard children components

---

### 4. ⏳ useMemo/useCallback Optimization
**Priority**: HIGH
**Status**: ⏳ Planned
**Effort**: 4 hours
**Impact**: Prevent array recreation on every render

**Target Files**:
- `IntelligentAdminPanel.tsx` - 9 array operations (line 488+)
- `KioskCheckIn.tsx` - Event handlers (line 83-93)

---

### 5. ⏳ Security Tests - Un-skip and Fix
**Priority**: CRITICAL
**Status**: ⏳ Planned
**Effort**: 1-2 days
**Impact**: HIPAA compliance verification

**Files**:
- `KioskCheckIn.security.test.tsx`
- `CHWVitalsCapture.test.tsx`
- `SDOHAssessment.test.tsx`
- `KioskCheckIn.test.tsx`

---

### 6. ⏳ Pagination Verification
**Priority**: HIGH
**Status**: ⏳ Planned
**Effort**: 4 hours
**Impact**: Prevent 10,000+ record loads

**Action**: Audit all services to ensure `/src/utils/pagination.ts` is used
- `billingService.ts`
- `wearableService.ts`
- `patientService.ts`
- `UsersList.tsx`

---

### 7. ⏳ Backup File Cleanup
**Priority**: MEDIUM
**Status**: ⏳ Planned
**Effort**: 30 minutes
**Impact**: Clean source tree

**Files to DELETE**:
- `src/services/fhirResourceService.backup.ts` (3,498 lines)
- `src/services/fhirResourceService.backup2.ts` (1,711 lines)
- `src/api/medications.backup.ts`
- `src/components/admin/IntelligentAdminPanel.tsx.backup`
- `src/components/physician/PhysicianPanel.backup.tsx`

---

### 8. ⏳ Create PatientContext & BillingContext
**Priority**: MEDIUM
**Status**: ⏳ Planned
**Effort**: 1 day
**Impact**: Eliminate props drilling

**Files to CREATE**:
- `src/contexts/PatientContext.tsx`
- `src/contexts/BillingContext.tsx`

---

### 9. ⏳ Event Listener Debouncing
**Priority**: MEDIUM
**Status**: ⏳ Planned
**Effort**: 2 hours
**Impact**: 90% fewer event calls

**Files**:
- `src/components/chw/KioskCheckIn.tsx` - 4 event listeners
- `src/components/CommunityMoments.tsx` - Resize listener

---

### 10. ⏳ Bundle Size Analysis - Large Dependencies
**Priority**: LOW
**Status**: ⏳ Planned
**Effort**: 4 hours
**Impact**: 30-50KB savings

**Dependencies to Evaluate**:
- `framer-motion` (27KB) - Used for simple animations
- `emoji-picker-react` - Large library for emoji selection

---

## 📊 Performance Metrics Tracking

### Baseline Metrics (Pre-Optimization)
**Date**: 2025-11-22

| Metric | Value | Tool |
|--------|-------|------|
| Initial Bundle Size | TBD | `npm run build` |
| Total Bundle Size | TBD | `npm run build` |
| Lighthouse Performance | TBD | Chrome DevTools |
| Time to Interactive | TBD | Lighthouse |
| First Contentful Paint | TBD | Lighthouse |
| API Calls (Dashboard Load) | TBD | Supabase Dashboard |
| Component Re-renders | TBD | React DevTools Profiler |

### Target Metrics (Post-Optimization)

| Metric | Target | Status |
|--------|--------|--------|
| Initial Bundle Size | -20-30% | ⏳ |
| API Calls | -60-70% | ⏳ |
| Lighthouse Performance | >90 | ⏳ |
| Time to Interactive | <2s | ⏳ |
| Component Re-renders | -40-60% | ⏳ |

---

## 🔄 Implementation Log

### 2025-11-22 Morning
- ✅ Completed comprehensive codebase scan
- ✅ Identified 10 major optimization opportunities
- ✅ Created OPTIMIZATION_TRACKER.md
- 🔄 STARTED: Query Caching Implementation (React Query)
- 🔄 STARTED: Code Splitting & Lazy Loading

### 2025-11-22 Afternoon
- ✅ **Billing Service React Query Migration COMPLETE**
  - Created `src/hooks/useBillingData.ts` with 15+ query hooks and 10+ mutation hooks
  - Converted `BillingDashboard.tsx` from manual state management to React Query
  - Reduced code complexity: removed useEffect, useState, manual error handling
  - All queries now cached with appropriate TTLs (5min for frequent, 10min for stable, 1hr for static)
  - TypeScript type checking: ✅ PASS
  - ESLint: ✅ PASS
  - **Next**: Convert fhirResourceService.ts to React Query

### [Future Dates]
<!-- Add implementation progress here -->

---

## 📝 Notes & Decisions

### Architecture Decisions
- **React Query**: Chosen over SWR for better TypeScript support and devtools
- **Code Splitting**: Using React.lazy() over dynamic imports for better DX
- **Suspense Boundaries**: Adding at route level and heavy component level
- **Hook Pattern**: Creating service-specific custom hooks (useBillingData, useFhirData, etc.) as abstraction layer
  - Keeps components clean and declarative
  - Centralizes cache invalidation logic
  - Makes it easy to update caching strategy without touching components

### Risks & Mitigations
- **Risk**: React Query learning curve for team
  - **Mitigation**: Create custom hooks as abstraction layer
- **Risk**: Breaking changes during code splitting
  - **Mitigation**: Comprehensive testing after each phase
- **Risk**: Over-optimization causing code complexity
  - **Mitigation**: "Surgeon not butcher" principle - targeted fixes only

### Questions & Blockers
- [ ] Confirm AdminPanel vs IntelligentAdminPanel - which is canonical?
- [ ] Verify cache TTL preferences (5 min? 10 min? varies by data type?)
- [ ] Determine if any data should never be cached (real-time vitals?)

---

## ✅ Completed Optimizations
<!-- Move items here as they're completed -->

---

**Last Updated**: 2025-11-22
**Next Review**: After completing optimizations #1 and #2
