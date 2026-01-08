# Test Coverage Inventory

> **Last Updated:** 2026-01-08
> **Total Tests:** 5,270 passing across 208 test files
> **Test Suites:** 208

---

## Executive Summary

| Metric | Total | With Tests | Coverage | Status |
|--------|-------|------------|----------|--------|
| Component Directories | 50 | 24 | **48%** | +11% from Jan 6 |
| Service Files | 119 | 38 | **32%** | 1,315 tests |
| Hook Files | 31 | 8 | **26%** | +7% from Jan 6 |
| Edge Functions | 123 | 11 | 9% | No change |

### Critical Services Status: ✅ ALL COVERED

All 12 critical services have comprehensive tests (verified Jan 8, 2026):
- billingService (62), billingDecisionTreeService (43)
- claudeService (41), claudeCareAssistant (35)
- auditLogger (49), soc2MonitoringService (57)
- loginSecurityService (25), passkeyService (52)
- consentManagementService (43), fhirSecurityService (75)
- patientService (56), guardianApprovalService (47)

### Progress This Session (Jan 8, 2026)

| Category | Tests Added | Files |
|----------|-------------|-------|
| alerts/ | 49 | 1 |
| discharge/ | 130 | 3 |
| soc/ | 138 | 4 |
| billing/ | +194 enhanced | 5 |
| **Total New** | **511+** | **13** |

---

## 1. Component Directories

### ✅ COMPLETE (100% Coverage)

| Directory | Components | Test Files | Tests | Status |
|-----------|------------|------------|-------|--------|
| auth/ | 4 | 4 | 78 | ✅ Complete |
| billing/ | 5 | 5 | 194 | ✅ Complete |
| ai-transparency/ | 5 | 5 | 80 | ✅ Complete |
| alerts/ | 1 | 1 | 49 | ✅ Complete |
| claude-care/ | 8 | 8 | 174 | ✅ Complete |
| discharge/ | 3 | 3 | 130 | ✅ Complete |
| security/ | 2 | 2 | 78 | ✅ Complete |
| soc/ | 4 | 4 | 138 | ✅ Complete |
| guardian/ | 2 | 2 | ~40 | ✅ Complete |
| vitals/ | 1 | 1 | ~15 | ✅ Complete |
| user/ | 1 | 1 | ~20 | ✅ Complete |
| migration/ | 3 | 2 | ~35 | ✅ Complete |
| chw/ | 7 | 4 | ~60 | ✅ Good |

### 🟡 PARTIAL COVERAGE (Needs Expansion)

| Directory | Components | Test Files | Gap | Priority |
|-----------|------------|------------|-----|----------|
| **admin/** | 61 | 6 | 55 | HIGH |
| **patient/** | 19 | 5 | 14 | HIGH |
| **envision-atlus/** | 19 | 3 | 16 | HIGH |
| **superAdmin/** | 16 | 2 | 14 | MEDIUM |
| **dashboard/** | 12 | 2 | 10 | MEDIUM |
| **smart/** | 13 | 2 | 11 | MEDIUM |
| **ui/** | 17 | 8 | 9 | MEDIUM |
| **patient-avatar/** | 9 | 1 | 8 | LOW |
| **wellness/** | 9 | 1 | 8 | LOW |
| **time-clock/** | 5 | 1 | 4 | LOW |

### 🔴 NO TESTS (Must Add)

| Directory | Components | Priority | Effort Est. |
|-----------|------------|----------|-------------|
| **nurse/** | 6 | HIGH | 2-3 hours |
| **nurseos/** | 7 | HIGH | 2-3 hours |
| **physician/** | 7 | HIGH | 2-3 hours |
| **handoff/** | 7 | HIGH | 2-3 hours |
| **atlas/** | 6 | MEDIUM | 2 hours |
| **ems/** | 5 | MEDIUM | 2 hours |
| **layout/** | 6 | MEDIUM | 1-2 hours |
| **neuro/** | 3 | MEDIUM | 1 hour |
| **neuro-suite/** | 3 | MEDIUM | 1 hour |
| **sdoh/** | 4 | MEDIUM | 1.5 hours |
| **telehealth/** | 4 | MEDIUM | 1.5 hours |
| **system/** | 4 | LOW | 1 hour |
| **collaboration/** | 3 | LOW | 1 hour |
| **features/** | 3 | LOW | 1 hour |
| **shared/** | 3 | LOW | 1 hour |
| dental/, mental-health/, search/, specialist/, social-worker/, wearables/, case-manager/, debug/, questionnaires/, careCoordination/, referrals/ | 1-2 each | LOW | 30 min each |

**Total Untested Components:** ~83 across 26 directories
**Estimated Effort:** ~25-30 hours

---

## 2. Services

### Current Status ✅
- **Total Services:** 119 files
- **With Tests:** 38 files (32%)
- **Test Count:** 1,315 tests
- **Gap:** 81 services (mostly medium/low priority)

### ✅ CRITICAL - ALL COVERED

All critical services have comprehensive tests:

| Service | Tests | Status |
|---------|-------|--------|
| billingService.ts | 62 | ✅ |
| billingDecisionTreeService.ts | 43 | ✅ |
| claudeService.ts | 41 | ✅ |
| claudeCareAssistant.ts | 35 | ✅ |
| consentManagementService.ts | 43 | ✅ |
| auditLogger.ts | 49 | ✅ |
| loginSecurityService.ts | 25 | ✅ |
| passkeyService.ts | 52 | ✅ |
| soc2MonitoringService.ts | 57 | ✅ |
| superAdminService.ts | 18 | ✅ |
| fhirSecurityService.ts | 75 | ✅ |
| patientService.ts | 56 | ✅ |
| guardianApprovalService.ts | 47 | ✅ |
| guardianAgentClient.ts | 32 | ✅ |

### 🟡 MEDIUM PRIORITY (Not Yet Tested)

| Service | Category |
|---------|----------|
| tenantBrandingService.ts | Multi-tenant |
| tenantModuleService.ts | Multi-tenant |
| patientAdmissionService.ts | Healthcare |
| dischargePlanningService.ts | Healthcare |
| handoffService.ts | Operations |
| medicationReconciliationService.ts | Healthcare |
| readmissionRiskPredictionService.ts | AI |

### Remaining Services (~60)
**Estimated Effort:** ~45-60 hours (averaging 45-60 min each)

---

## 3. Hooks

### Current Status
- **Total Hooks:** 31 files
- **With Tests:** 8 files (26%)
- **Gap:** 23 hooks

### 🔴 CRITICAL

| Hook | Category | Est. Time |
|------|----------|-----------|
| useModuleAccess.ts | Auth | 1 hour |
| useBillingData.ts | Billing | 1 hour |
| useIdleTimeout.ts | Security | 45 min |
| useHcaptcha.ts | Security | 45 min |
| useIsAdmin.ts | Auth | 30 min |

### 🟡 HIGH PRIORITY

| Hook | Category | Est. Time |
|------|----------|-----------|
| useTenantBranding.ts | Multi-tenant | 45 min |
| useTenantModules.ts | Multi-tenant | 45 min |
| usePresence.ts | Real-time | 1 hour |
| useRealtimeSubscription.ts | Real-time | 1 hour |
| useFhirData.ts | FHIR | 1 hour |
| useFHIRIntegration.ts | FHIR | 1 hour |

**Hooks Total Effort:** ~12-15 hours

---

## 4. Edge Functions

### Current Status
- **Total Functions:** 123
- **With Tests:** 11 (9%)
- **Gap:** 112 functions

> **Note:** Edge functions require Deno testing setup. Consider deferring until component/service coverage is better.

**Estimated Effort:** ~80-100 hours

---

## Total Effort Estimate

| Category | Items | Hours |
|----------|-------|-------|
| Components (partial) | ~50 | 15-20 |
| Components (none) | ~83 | 25-30 |
| Services (critical) | 12 | 18 |
| Services (high) | 10 | 16 |
| Services (remaining) | ~60 | 45-60 |
| Hooks | 23 | 12-15 |
| Edge Functions | 112 | 80-100 |
| **TOTAL** | | **211-259 hours** |

---

## Realistic Action Plan

### Phase 1: Critical Path (Week 1-2) - 40 hours

**Goal:** Cover all CRITICAL services and remaining HIGH priority components

| Day | Focus | Items | Hours |
|-----|-------|-------|-------|
| 1 | Services | billingService, billingDecisionTree | 4 |
| 2 | Services | claudeService, claudeCareAssistant | 3.5 |
| 3 | Services | auditLogger, loginSecurity, passkey | 4 |
| 4 | Services | consent, soc2, superAdmin, tenant* | 5 |
| 5 | Components | nurse/ (6), nurseos/ (7) | 5 |
| 6 | Components | physician/ (7), handoff/ (7) | 5 |
| 7 | Components | admin/ (first 20) | 5 |
| 8 | Components | admin/ (next 20) | 5 |
| 9 | Components | admin/ (remaining 15) | 4 |

### Phase 2: High Priority (Week 3-4) - 35 hours

| Focus | Items | Hours |
|-------|-------|-------|
| Services | patient*, fhir*, handoff, medication | 10 |
| Hooks | Critical + High priority | 8 |
| Components | patient/, envision-atlus/, superAdmin/ | 12 |
| Components | smart/, dashboard/ | 5 |

### Phase 3: Medium Priority (Week 5-6) - 30 hours

| Focus | Items | Hours |
|-------|-------|-------|
| Components | atlas, ems, neuro*, sdoh, telehealth | 10 |
| Components | layout, system, ui expansion | 8 |
| Services | Medium priority batch 1 | 12 |

### Phase 4: Completion (Week 7-8) - 30 hours

| Focus | Items | Hours |
|-------|-------|-------|
| Services | Medium priority batch 2 | 15 |
| Components | Low priority directories | 10 |
| Hooks | Remaining hooks | 5 |

### Phase 5: Edge Functions (Future)

- Defer until component/service coverage is solid
- Consider testing critical auth/security functions first
- ~80-100 hours total

---

## Quick Wins (Can Do Today)

These directories have 1-3 components and can be done in < 30 minutes each:

1. `dental/` - 1 component
2. `mental-health/` - 1 component
3. `search/` - 1 component
4. `wearables/` - 1 component
5. `social-worker/` - 1 component
6. `case-manager/` - 1 component
7. `specialist/` - 2 components
8. `referrals/` - 1 component
9. `questionnaires/` - 1 component
10. `careCoordination/` - 1 component

**Quick Wins Effort:** ~4-5 hours for 10 directories

---

## Commands Reference

```bash
# Run all tests
npm test

# Run specific directory
npm test -- --run src/components/admin/__tests__/

# Run single file
npm test -- --run src/services/__tests__/billingService.test.ts

# Check test count
npm test -- --run 2>&1 | grep -E "Test Files|Tests"
```

---

## Progress Tracking

### Completed ✅
- [x] auth/ (4/4)
- [x] billing/ (5/5)
- [x] ai-transparency/ (5/5)
- [x] alerts/ (1/1)
- [x] claude-care/ (8/8)
- [x] discharge/ (3/3)
- [x] security/ (2/2)
- [x] soc/ (4/4)
- [x] guardian/ (2/2)

### In Progress 🟡
- [ ] admin/ (6/61) - HIGH PRIORITY
- [ ] patient/ (5/19)
- [ ] envision-atlus/ (3/19)

### Not Started 🔴
- [ ] nurse/ (0/6)
- [ ] nurseos/ (0/7)
- [ ] physician/ (0/7)
- [ ] handoff/ (0/7)
- [ ] + 22 more directories

---

**Next Session:** Focus on CRITICAL services (billing, claude, audit) OR admin/ component expansion
