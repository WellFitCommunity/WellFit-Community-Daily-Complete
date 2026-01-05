# Test Coverage Inventory

> **Generated:** 2026-01-05
> **Purpose:** Comprehensive list of all code requiring tests for systematic coverage improvement

---

## Executive Summary

| Metric | Count | With Tests | Coverage |
|--------|-------|------------|----------|
| Component Directories | 57 | 20 | 35% |
| Service Files | 118 | 21 | 17.8% |
| Hook Files | 32 | 6 | 18.8% |
| Edge Functions | 123 | 11 | 8.9% |

---

## 1. Component Directories

### HIGH PRIORITY (No Tests - Must Add)

| Directory | Components | Priority | Notes |
|-----------|------------|----------|-------|
| **auth/** | 4 | CRITICAL | Authentication flows |
| **billing/** | 5 | CRITICAL | Financial components |
| **ai-transparency/** | 5 | HIGH | AI compliance features |
| **alerts/** | 1 | HIGH | Alert system |
| **atlas/** | 6 | MEDIUM | Atlas features |
| **case-manager/** | 1 | MEDIUM | Case manager portal |
| **claude-care/** | 8 | HIGH | AI care assistant |
| **collaboration/** | 3 | LOW | Collaboration tools |
| **debug/** | 1 | LOW | Debug utilities |
| **dental/** | 1 | LOW | Dental features |
| **discharge/** | 3 | MEDIUM | Discharge planning |
| **ems/** | 5 | MEDIUM | EMS integration |
| **features/** | 3 | LOW | Feature management |
| **handoff/** | 7 | MEDIUM | Patient handoff |
| **layout/** | 6 | LOW | Layout components |
| **mental-health/** | 1 | MEDIUM | Mental health |
| **neuro/** | 3 | MEDIUM | Neurology features |
| **neuro-suite/** | 3 | MEDIUM | Neuro suite |
| **nurse/** | 6 | MEDIUM | Nurse portal |
| **nurseos/** | 7 | MEDIUM | Nurse OS |
| **physician/** | 7 | MEDIUM | Physician portal |
| **sdoh/** | 4 | MEDIUM | Social determinants |
| **search/** | 1 | LOW | Search |
| **security/** | 2 | HIGH | Security features |
| **shared/** | 3 | LOW | Shared utilities |
| **smart/** | 11 | HIGH | Smart scribe |
| **soc/** | 4 | HIGH | SOC2 compliance |
| **social-worker/** | 1 | LOW | Social worker portal |
| **specialist/** | 2 | LOW | Specialist portal |
| **system/** | 4 | LOW | System utilities |
| **telehealth/** | 4 | MEDIUM | Telehealth |
| **wearables/** | 1 | LOW | Wearables |

### NEEDS EXPANSION (Has Tests But Low Coverage)

| Directory | Components | Tests | Coverage | Notes |
|-----------|------------|-------|----------|-------|
| **admin/** | 61 | 6 | 9.8% | Admin dashboards |
| **ui/** | 17 | 5 | 29.4% | Design system |
| **envision-atlus/** | 19 | 3 | 15.8% | EA components |
| **dashboard/** | 12 | 2 | 16.7% | Dashboards |
| **patient/** | 19 | 1 | 5.3% | Patient features |
| **patient-avatar/** | 9 | 1 | 11.1% | Avatar system |
| **superAdmin/** | 16 | 2 | 12.5% | Super admin |
| **ai/** | 5 | 0 | 0% | Has __tests__ folder |
| **guardian/** | 2 | 0 | 0% | Has __tests__ folder |

### GOOD COVERAGE (Keep Maintaining)

| Directory | Components | Tests | Coverage |
|-----------|------------|-------|----------|
| chw/ | 7 | 4 | 57% |
| vitals/ | 1 | 1 | 100% |
| user/ | 1 | 1 | 100% |
| app/ | 2 | 2 | 100% |
| migration/ | 3 | 2 | 67% |

---

## 2. Services Without Tests (97 total)

### CRITICAL - Must Test This Week

| Service | Category | Risk |
|---------|----------|------|
| billingService.ts | Billing | Financial accuracy |
| billingDecisionTreeService.ts | Billing | Complex logic |
| claudeService.ts | AI | Core AI |
| claudeCareAssistant.ts | AI | Key feature |
| consentManagementService.ts | Legal | HIPAA |
| auditLogger.ts | Compliance | Audit trail |
| loginSecurityService.ts | Security | Auth security |
| passkeyService.ts | Security | Passkey auth |
| soc2MonitoringService.ts | Compliance | SOC2 |
| superAdminService.ts | Admin | Access control |
| tenantBrandingService.ts | Multi-tenant | Tenant isolation |
| tenantModuleService.ts | Multi-tenant | Feature gates |

### HIGH PRIORITY - This Month

| Service | Category |
|---------|----------|
| patientService.ts | Healthcare |
| patientAdmissionService.ts | Healthcare |
| dischargePlanningService.ts | Healthcare |
| fhirResourceService.ts | FHIR |
| fhirSecurityService.ts | FHIR |
| handoffService.ts | Operations |
| medicationReconciliationService.ts | Healthcare |
| readmissionRiskPredictionService.ts | AI/Analytics |
| guardianApprovalService.ts | Security |
| guardianAgentClient.ts | AI |

### MEDIUM PRIORITY

```
aiAdapterAssistant.ts, aiTransparencyService.ts, atlasRevenueService.ts,
bedManagementService.ts, behaviorTracking.ts, behavioralAnalyticsService.ts,
careCoordinationService.ts, ccmAutopilotService.ts, communicationSilenceWindowService.ts,
dashboardPersonalizationAI.ts, dentalHealthService.ts, dischargeToWellnessBridge.ts,
emailService.ts, employeeService.ts, emsIntegrationService.ts, emsNotificationService.ts,
encounterService.ts, engagementTracking.ts, enterpriseMigrationEngine.ts,
EnterpriseFileUploadService.ts, errorReporter.ts, facilityService.ts,
feeScheduleService.ts, fhirEncounterWrapper.ts, fhirInteroperabilityIntegrator.ts,
fhirQuestionnaireService.ts, fhirSyncIntegration.ts, handoffNotificationService.ts,
healthCheck.ts, healthcareIntegrationsService.ts, holisticRiskAssessment.ts,
hospitalTransferIntegrationService.ts, initializeWearables.ts, inputValidator.ts,
intelligentModelRouter.ts, jointCommissionFormService.ts, labResultVaultService.ts,
mealInteractionService.ts, medicationLabelReader.ts, medicationTrackingService.ts,
mentalHealthService.ts, neuroSuiteService.ts, notificationService.ts,
offlineAudioService.ts, patientAvatarService.ts, patientOutreachService.ts,
performanceMonitoring.ts, personalizedGreeting.ts, physicalTherapyService.ts,
pillIdentifierService.ts, pinHashingService.ts, postAcuteFacilityMatcher.ts,
postAcuteTransferService.ts, providerAffirmations.ts, psychMedClassifier.ts,
ptAssessmentService.ts, ptSessionService.ts, ptTreatmentPlanService.ts,
readmissionTrackingService.ts, resilienceHubService.ts, sdohBillingService.ts,
sdohIndicatorService.ts, sdohPassiveDetection.ts, securityAutomationService.ts,
seniorDataService.ts, shiftHandoffService.ts, smartSuggestionsService.ts,
smartscribe-avatar-integration.ts, soapNoteService.ts, socDashboardService.ts,
staffWellnessService.ts, tenantAssignmentService.ts, tenantDetection.ts,
timeClockService.ts, userBehaviorTracking.ts, voiceCommandService.ts,
voiceLearningService.ts, voiceSearchService.ts, wearableService.ts,
workflowPreferences.ts
```

---

## 3. Hooks Without Tests (26 total)

### CRITICAL

| Hook | Category | Risk |
|------|----------|------|
| useModuleAccess.ts | Auth | Feature gate failures |
| useBillingData.ts | Billing | Financial data |
| useIdleTimeout.ts | Security | Session security |
| useHcaptcha.ts | Security | Bot protection |
| useIsAdmin.ts | Auth | Permission checks |

### HIGH PRIORITY

| Hook | Category |
|------|----------|
| useTenantBranding.ts | Multi-tenant |
| useTenantModules.ts | Multi-tenant |
| usePresence.ts | Real-time |
| useRealtimeSubscription.ts | Real-time |
| useFhirData.ts | FHIR |
| useFHIRIntegration.ts | FHIR |
| useAuthorizationStatus.ts | Healthcare |

### MEDIUM PRIORITY

```
useBrowserHistoryProtection.ts, useClaudeRateLimit.ts, useCommunityMoments.ts,
useConnectionQuality.ts, useFormDraftRecovery.ts, useKeyboardNavigation.ts,
useMedicineCabinet.ts, usePassiveSDOHDetection.ts, useRealtimeCoding.ts,
useSOCNotifications.ts, useStorageQuota.ts, useTheme.ts, useVoiceSearch.ts,
useWearableData.ts, useWorkflowPreferences.ts
```

---

## 4. Edge Functions Without Tests (112 total)

### CRITICAL - Security & Auth (22 functions)

| Function | Category |
|----------|----------|
| admin_register | Auth |
| admin_set_pin | Security |
| admin_start_session | Auth |
| admin_end_session | Auth |
| admin-user-questions | Admin |
| envision-check-super-admin | Auth |
| envision-verify-pin | Security |
| guardian-agent | AI/Security |
| guardian-agent-api | API |
| guardian-pr-service | Automation |
| hash-pin | Security |
| login | Auth |
| login-security | Security |
| passkey-auth-finish | Auth |
| passkey-auth-start | Auth |
| passkey-register-finish | Auth |
| passkey-register-start | Auth |
| phi-encrypt | Security |
| request-pin-reset | Security |
| security-alert-processor | Security |
| setup-admin-credentials | Admin |
| smart-authorize | Auth |
| verify-admin-pin | Security |
| verify-hcaptcha | Security |
| verify-pin-reset | Security |

### HIGH PRIORITY - AI Functions (21 functions)

| Function | Type |
|----------|------|
| ai-appointment-prep-instructions | AI |
| ai-billing-suggester | AI/Billing |
| ai-care-escalation-scorer | AI |
| ai-care-plan-generator | AI |
| ai-clinical-guideline-matcher | AI |
| ai-contraindication-detector | AI |
| ai-discharge-summary | AI |
| ai-fall-risk-predictor | AI |
| ai-fhir-semantic-mapper | AI |
| ai-infection-risk-predictor | AI |
| ai-medication-adherence-predictor | AI |
| ai-medication-instructions | AI |
| ai-medication-reconciliation | AI |
| ai-missed-checkin-escalation | AI |
| ai-patient-qa-bot | AI |
| ai-progress-note-synthesizer | AI |
| ai-provider-assistant | AI |
| ai-readmission-predictor | AI |
| ai-referral-letter | AI |
| ai-schedule-optimizer | AI |
| ai-soap-note-generator | AI |
| ai-treatment-pathway | AI |

### HIGH PRIORITY - Clinical (10 functions)

| Function | Type |
|----------|------|
| ccda-export | Export |
| coding-suggest | Billing |
| create-checkin | Healthcare |
| extract-patient-form | Forms |
| fhir-r4 | FHIR |
| generate-837p | Billing |
| get-risk-assessments | Analytics |
| hl7-receive | Integration |
| pdf-health-summary | Export |
| sdoh-coding-suggest | Billing |

### MEDIUM PRIORITY - Remaining (59 functions)

```
bed-management, check-drug-interactions, claude-chat, claude-personalization,
cleanup-temp-images, create-patient-telehealth-token, create-telehealth-room,
daily-backup-verification, enrollClient, envision-login, envision-request-reset,
envision-totp-setup, envision-totp-use-backup, envision-totp-verify, export-status,
generate-api-key, get-personalized-greeting, log-ai-confidence-score,
mcp-claude-server, mcp-clearinghouse-server, mcp-edge-functions-server,
mcp-fhir-server, mcp-hl7-x12-server, mcp-medical-codes-server, mcp-postgres-server,
mobile-sync, nightly-excel-backup, notify-stale-checkins, process-medical-transcript,
process-vital-image, realtime_medical_transcription, register, save-fcm-token,
send-appointment-reminder, send-check-in-reminder-sms, send-checkin-reminders,
send-consecutive-missed-alerts, send-email, send-push-notification, send-sms,
send-stale-reminders, send_email, send_welcome_email, smart-token, system-status,
test-users, test_users, update-profile-note, update-voice-profile,
user-data-management, validate-api-key
```

---

## Weekly Action Plan

### Week 1: Foundation (Security & Auth)

**Day 1-2: Auth Services**
- [ ] authService.ts tests
- [ ] loginSecurityService.ts tests
- [ ] passkeyService.ts tests

**Day 3-4: Auth Components**
- [ ] auth/ directory (4 components)
- [ ] security/ directory (2 components)

**Day 5: Auth Edge Functions**
- [ ] login edge function
- [ ] passkey-auth-start/finish
- [ ] verify-admin-pin

### Week 2: Billing & Compliance

**Day 1-2: Billing Services**
- [ ] billingService.ts tests
- [ ] billingDecisionTreeService.ts tests

**Day 3-4: Billing Components**
- [ ] billing/ directory (5 components)
- [ ] ai-billing-suggester edge function

**Day 5: Compliance**
- [ ] auditLogger.ts tests
- [ ] soc2MonitoringService.ts tests
- [ ] consentManagementService.ts tests

### Week 3: Healthcare Core

**Day 1-2: Patient Services**
- [ ] patientService.ts
- [ ] patientAdmissionService.ts
- [ ] dischargePlanningService.ts

**Day 3-4: FHIR**
- [ ] fhirResourceService.ts
- [ ] fhirSecurityService.ts
- [ ] fhir-r4 edge function

**Day 5: Operations**
- [ ] handoffService.ts
- [ ] medicationReconciliationService.ts

### Week 4: AI & UI

**Day 1-2: AI Services**
- [ ] claudeService.ts
- [ ] claudeCareAssistant.ts
- [ ] guardian edge functions

**Day 3-4: UI Components**
- [ ] Complete ui/ directory tests
- [ ] envision-atlus/ components

**Day 5: Hooks**
- [ ] useModuleAccess.ts
- [ ] useBillingData.ts
- [ ] useIdleTimeout.ts

---

## Test File Locations

```
src/components/{dir}/__tests__/{Component}.test.tsx
src/services/__tests__/{service}.test.ts
src/hooks/__tests__/{hook}.test.ts
supabase/functions/{function}/__tests__/{function}.test.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific directory
npm test -- src/components/auth/__tests__/

# Run single file
npm test -- src/services/__tests__/billingService.test.ts

# Run with coverage
npm test -- --coverage
```

---

**Next Update:** After Week 1 completion
