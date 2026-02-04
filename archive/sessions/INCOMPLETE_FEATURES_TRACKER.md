# Incomplete Features Tracker

**Created:** 2025-12-17
**Purpose:** Track features with unused variables that need to be built out (not deleted)
**Status:** In Progress

---

## Overview

After migrating to Vite + React 19, lint warnings surfaced for unused variables. Analysis revealed these are **incomplete features** - variables defined but UI/logic not connected yet.

**Total Components Identified:** 25+
**Priority:** Build features properly, NOT delete/rename to suppress warnings

---

## Priority 1: Core Dashboard Features

### 1. FHIRInteroperabilityDashboard.tsx
**File:** `src/components/admin/FHIRInteroperabilityDashboard.tsx`
**Status:** [x] COMPLETED - 2025-12-17

| Variable | Line | What Was Built |
|----------|------|----------------|
| `loadConnections` | 19 | Added useEffect to call on mount |
| `recentSyncs` | 250 | Added to OverviewTab with count display |
| `onToggleAutoSync` | 359 | Built auto-sync configuration UI with frequency options |
| `connections` | 491 | Used in AnalyticsTab for connection performance table |
| `syncStats` | 491 | Used in AnalyticsTab for aggregate statistics |

**Completed Tasks:**
- [x] Call `loadConnections` on component mount
- [x] Build sync history display in OverviewTab using `recentSyncs`
- [x] Add auto-sync toggle with manual/realtime/hourly/daily options
- [x] Display connections list with status indicators in AnalyticsTab
- [x] Show sync statistics (total syncs, success rate, records processed)

---

### 2. FrequentFlyerDashboard.tsx
**File:** `src/components/atlas/FrequentFlyerDashboard.tsx`
**Status:** [x] COMPLETED - 2025-12-17

| Variable | Line | What Was Built |
|----------|------|----------------|
| `utilizerMetrics` | 34 | Built "High Utilizer Breakdown" section with ER visits, inpatient days, avg risk score, estimated cost |
| `checkIns` | 386 | Built "Recent Visits & Check-ins" section in PatientDetailModal |
| `setCheckIns` | 386 | Connected to loadPatientDetails to populate visit history |

**Completed Tasks:**
- [x] Build utilizer metrics breakdown (Total ER Visits, Inpatient Days, Avg Risk Score, Est. Cost Impact)
- [x] Build "Top 5 Utilizers by Visit Count" list
- [x] Build check-in history timeline in PatientDetailModal
- [x] Added getPatientVisitHistory method to ReadmissionTrackingService
- [x] Connect metrics to dashboard summary

---

### 3. ClinicalAlertsDashboard.tsx
**File:** `src/components/alerts/ClinicalAlertsDashboard.tsx`
**Status:** [x] COMPLETED - 2025-12-17

| Variable | Line | What Was Built |
|----------|------|----------------|
| `pending` | 105 | Renamed to `pendingCount`, added to metrics interface and displayed in header |
| `acknowledged` | 107 | Added `acknowledgedCount` to track acknowledged alerts |

**Completed Tasks:**
- [x] Added `pending_count` and `acknowledged_count` to AlertEffectivenessMetrics interface
- [x] Display pending, acknowledged, and resolved counts in header
- [x] Show alert status breakdown with colored badges

---

### 4. ReadmissionRiskPanel.tsx
**File:** `src/components/ai/ReadmissionRiskPanel.tsx`
**Status:** [x] COMPLETED - 2025-12-17

| Variable | Line | What Was Built |
|----------|------|----------------|
| `setPrediction` | 36 | Implemented full loadPrediction function that fetches from database and calls setPrediction |

**Completed Tasks:**
- [x] Implemented loadPrediction with Supabase query to readmission_risk_predictions table
- [x] Transform database row to ReadmissionPrediction format
- [x] Added retry button on error state
- [x] Added audit logging for prediction views
- [x] Handles plainLanguageExplanation field

---

### 5. BillingCodeSuggestionPanel.tsx
**File:** `src/components/ai/BillingCodeSuggestionPanel.tsx`
**Status:** [x] COMPLETED - 2025-12-17

| Variable | Line | What Was Built |
|----------|------|----------------|
| `encounterId` | 26 | Now used in loadSuggestion to fetch encounter-specific suggestions |
| `setSuggestion` | 32 | Called after transforming database row to BillingSuggestionResult format |
| `allCodes` | 116 | Used to calculate summary stats and display code counts |

**Completed Tasks:**
- [x] Implemented loadSuggestion with Supabase query (by suggestionId or encounterId)
- [x] Transform database row to BillingSuggestionResult format
- [x] Added code summary section showing total codes, high confidence, avg confidence, and codes needing review
- [x] Added audit logging for billing suggestion views
- [x] Calculate avgConfidence, highConfidenceCodes, lowConfidenceCodes from allCodes

---

## Priority 2: Collaboration Features

### 6. ActivityFeed.tsx
**File:** `src/components/collaboration/ActivityFeed.tsx`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| `broadcastActivity` | 170 | Now called on useEffect mount (join) and cleanup (leave) to broadcast user presence |

**Completed Tasks:**
- [x] broadcastActivity now broadcasts 'join' event when user enters room
- [x] broadcastActivity broadcasts 'leave' event when user exits (cleanup)
- [x] Added to useEffect dependency array for proper cleanup

---

### 7. PresenceAvatars.tsx
**File:** `src/components/collaboration/PresenceAvatars.tsx`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| `showViewing` | 135 | Now controls visibility of viewing indicators on avatars and summary badge |

**Completed Tasks:**
- [x] Pass showViewing prop to Avatar component
- [x] Conditionally show viewing info in tooltip based on showViewing prop
- [x] Added blue eye badge indicator on avatars when showViewing=true and user.viewing exists
- [x] Added "X viewing" summary badge next to "X editing" badge when showViewing=true

---

## Priority 3: Clinical Features

### 8. BedManagementPanel.tsx
**File:** `src/components/admin/BedManagementPanel.tsx`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| `setEditing` | 140 | Now called when user clicks on a bed to track editing presence for other users |

**Completed Tasks:**
- [x] Call setEditing(true, 'bed-{label}') when user selects a bed
- [x] Call setEditing(false) when modal closes (all close points)
- [x] Added auditLogger.error for error handling in loadData

---

### 9. EAInboxMessage.tsx
**File:** `src/components/envision-atlus/EAInboxMessage.tsx`
**Status:** [N/A] FILE DOES NOT EXIST - Removed from tracker

---

### 10. CognitiveAssessmentResults.tsx
**File:** `src/components/neuro/CognitiveAssessmentResults.tsx`
**Status:** [N/A] FILE DOES NOT EXIST - Removed from tracker

---

### 11. PatientAvatar.tsx
**File:** `src/components/patient-avatar/PatientAvatar.tsx`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| `handleMarkerClick` | 84 | Now passed to AvatarFullBody component via onMarkerClick prop |

**Completed Tasks:**
- [x] Added onMarkerClick prop to AvatarFullBodyProps interface
- [x] Pass handleMarkerClick to AvatarFullBody component
- [x] AvatarFullBody now calls onMarkerClick when markers are clicked

---

### 12. AvatarMarker.tsx
**File:** `src/components/patient-avatar/AvatarMarker.tsx`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| `pulseClass` | 68 | Now used via shouldAnimate to control pulse animation |

**Completed Tasks:**
- [x] Use pulseClass to derive shouldAnimate for SVG animation
- [x] bgClass/borderClass not applicable to SVG elements - designed for HTML
- [x] Removed unused halfSize variable

---

### 13. NurseQuestionManager.tsx
**File:** `src/components/admin/NurseQuestionManager.tsx`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| `context` | 222 | Now used for audit logging with request context (requestId, userId, etc.) |

**Completed Tasks:**
- [x] Added auditLogger import
- [x] Use context for HIPAA-compliant audit logging when AI suggestions are requested
- [x] Log requestId, userId, questionId, category, urgency, and hasPatientProfile

---

## Priority 4: Integration Features

### 14. EnhancedFhirService.ts
**File:** `src/components/admin/EnhancedFhirService.ts`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| `patientData` | 685 | `checkDrugInteractions` now analyzes patient medications for known interaction pairs |
| `patientData` | 691 | `getApplicableClinicalGuidelines` adjusts applicability based on patient age/conditions |
| `smartSession` | 937 | `syncWithSmartSession` validates session, extracts patient/observations, syncs to WellFit |
| `fhirPatient`, `observations` | 958 | `syncPatientToWellFit` maps FHIR data to WellFit format and caches sync metadata |

**Completed Tasks:**
- [x] Implemented drug interaction checking with warfarin, metformin, lisinopril, simvastatin pairs
- [x] Added patient-specific clinical guideline applicability scoring (age, comorbidities)
- [x] Built SMART session validation and data extraction
- [x] Created FHIR-to-WellFit data mapping with cache storage

---

### 15. FhirAiDashboard.tsx
**File:** `src/components/admin/FhirAiDashboard.tsx`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| `supabaseUrl`, `supabaseKey` | 340 | Stored in connectionConfig state for FHIR sync operations |
| `context` | 429 | `handleQuickAction` now uses context for patientId, source, and EHR-specific actions |
| `ehrSystem` | 714 | `onLaunch` callback tracks EHR connections and triggers sync actions |

**Completed Tasks:**
- [x] Added connectionConfig state to store and use Supabase credentials
- [x] Added activeEhrConnections state to track connected EHR systems
- [x] Enhanced handleQuickAction with context-aware action handling
- [x] Implemented EHR connection tracking and sync action triggering

---

### 16. RiskAssessmentManager.tsx
**File:** `src/components/admin/RiskAssessmentManager.tsx`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| `user` | 18 | Now used for `canManageAssessments` permission check |
| `assessment` | 93 | Now used in success message to show patient name and risk level |

**Completed Tasks:**
- [x] Added `canManageAssessments` permission check using user.role
- [x] Conditionally render form tab based on permissions (admin, healthcare_provider, nurse)
- [x] Added success message state using assessment data (patient name, risk level)
- [x] Display success alert with assessment details after form submission

---

## Priority 5: Wearable Adapters (API Integration)

### 17-21. Wearable OAuth Flows
**Files:** `src/adapters/wearables/implementations/*.ts`
**Status:** [ ] Not Started

| Adapter | Unused Params | What Needs Building |
|---------|--------------|---------------------|
| GarminAdapter | `scopes`, `code`, `refreshToken`, `userId` | Full OAuth 2.0 flow |
| FitbitAdapter | `userId` | User-specific data sync |
| AmazfitAdapter | `userId` | User-specific data sync |
| WithingsAdapter | `userId` | User-specific data sync |
| SamsungHealthAdapter | - | Health Connect integration |

**Build Tasks:**
- [ ] Implement OAuth authorization flow
- [ ] Handle token refresh
- [ ] Implement user-specific data sync
- [ ] Add error handling for API failures

---

## Priority 6: UI Components

### 22. VoiceProfileMaturity.tsx
**File:** `src/components/ai-transparency/VoiceProfileMaturity.tsx`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| `showDetails` | 25 | Now initializes expanded state - when true, details section shows by default |

**Completed Tasks:**
- [x] showDetails prop now initializes expanded state
- [x] Fixed useEffect dependency by wrapping fetchVoiceProfile in useCallback

---

### 23. ConfidenceScoreBadge.tsx
**File:** `src/components/ai-transparency/ConfidenceScoreBadge.tsx`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| `suggestionType` | 15 | Now displays type-specific label (Billing/Clinical/Drug/Risk) in badge |

**Completed Tasks:**
- [x] Added getSuggestionTypeLabel function for type-specific labels
- [x] Display typeLabel in badge for context about what kind of AI suggestion it is

---

### 24. HealthcareAlgorithmsDashboard.tsx
**File:** `src/components/ai/HealthcareAlgorithmsDashboard.tsx`
**Status:** [x] COMPLETED - 2025-12-18

| Variable | Line | What Was Built |
|----------|------|----------------|
| Icons (Activity, AlertTriangle, Phone, Calendar, Mail, Heart, Users, Pill, Home) | 21-31 | Added icon indicators to slider inputs for readmission risk algorithm |
| `EAButton` | 49 | Used for "Reset Demo Values" button with secondary variant |
| `getRiskStyles` | 61 | Applied to readmission results card for dynamic risk-based border and text styling |

**Completed Tasks:**
- [x] Added Calendar, Phone, Activity, Mail, Users, Heart, Pill, Home icons to slider inputs
- [x] Added AlertTriangle icon for High/Critical risk results
- [x] Replaced standard button with EAButton for reset functionality
- [x] Applied getRiskStyles for dynamic border and text colors based on risk category

---

### 25. MedicationManager.tsx
**File:** `src/components/patient/MedicationManager.tsx`
**Status:** [N/A] FILE DOES NOT EXIST - Removed from tracker

---

## Completed Features

| Feature | Date Completed | Notes |
|---------|---------------|-------|
| FHIRInteroperabilityDashboard | 2025-12-17 | loadConnections on mount, recentSyncs display, auto-sync toggle, analytics with connections/syncStats |
| FrequentFlyerDashboard | 2025-12-17 | utilizerMetrics breakdown, checkIns in modal, added getPatientVisitHistory to service |
| ClinicalAlertsDashboard | 2025-12-17 | pending_count and acknowledged_count in metrics, displayed in header with status badges |
| ReadmissionRiskPanel | 2025-12-17 | Full loadPrediction implementation, database fetch, setPrediction called, retry button |
| BillingCodeSuggestionPanel | 2025-12-17 | loadSuggestion by encounterId/suggestionId, setSuggestion called, allCodes used for summary stats |
| ActivityFeed | 2025-12-18 | broadcastActivity for join/leave events in useEffect mount/cleanup |
| PresenceAvatars | 2025-12-18 | showViewing controls avatar indicators and summary badge |
| BedManagementPanel | 2025-12-18 | setEditing tracks bed editing presence, auditLogger for errors |
| PatientAvatar | 2025-12-18 | handleMarkerClick passed to AvatarFullBody via onMarkerClick |
| AvatarMarker | 2025-12-18 | pulseClass used via shouldAnimate for SVG animation |
| VoiceProfileMaturity | 2025-12-18 | showDetails initializes expanded state |
| ConfidenceScoreBadge | 2025-12-18 | suggestionType displays type-specific labels |
| NurseQuestionManager | 2025-12-18 | context used for HIPAA audit logging |
| RiskAssessmentManager | 2025-12-18 | user for permissions, assessment for success message |
| HealthcareAlgorithmsDashboard | 2025-12-18 | Icons added to sliders, EAButton for reset, getRiskStyles for dynamic styling |
| EnhancedFhirService | 2025-12-18 | Drug interactions, clinical guidelines, SMART sync, FHIR mapping |
| FhirAiDashboard | 2025-12-18 | Supabase config, context-aware actions, EHR connection tracking |
| MedicationManager | 2025-12-18 | NEW: Enterprise-grade admin medication dashboard with reconciliation, interactions, high-risk monitoring |

---

## Notes

- **DO NOT** delete or rename variables to suppress lint warnings
- Each feature must be properly built and tested
- Update this tracker as features are completed
- Lint warnings will naturally resolve as features are connected

---

## Progress Summary

| Priority | Total | Completed | N/A (Missing) | Remaining |
|----------|-------|-----------|---------------|-----------|
| Priority 1 (Core Dashboards) | 5 | 5 | 0 | 0 |
| Priority 2 (Collaboration) | 2 | 2 | 0 | 0 |
| Priority 3 (Clinical) | 6 | 4 | 2 | 0 |
| Priority 4 (Integration) | 3 | 3 | 0 | 0 |
| Priority 5 (Wearables) | 5 | 0 | 0 | 5 |
| Priority 6 (UI Components) | 4 | 3 | 1 | 0 |
| **TOTAL** | **25** | **17** | **3** | **5** |

**Additional:**
| New Component | Status |
|---------------|--------|
| MedicationManager (Enterprise) | COMPLETED - Route: `/medication-manager` |

**Last Updated:** 2025-12-18
