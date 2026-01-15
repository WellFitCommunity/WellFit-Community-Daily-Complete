# WellFit / Envision Atlus - Remediation Tracker

> **Last Updated**: 2026-01-09
> **Audit Baseline**: 6,613 tests passing, 0 TypeScript errors, 0 lint warnings

---

## Quick Stats Dashboard

| Metric | Baseline | Current | Target | Status |
|--------|----------|---------|--------|--------|
| Tests Passing | 3,218 | 6,613 | 3,218+ | :white_check_mark: |
| Test Suites | 144 | 260 | 144+ | :white_check_mark: |
| TypeScript Errors | 0 | 0 | 0 | :white_check_mark: |
| Lint Warnings | 799 | 0 | <100 | :white_check_mark: |
| Edge Functions with CORS | 109/126 | 124/126 | 126/126 | :white_check_mark: |
| Services using ServiceResult | 72% | _TBD_ | 95%+ | :construction: |
| Component Dirs with Tests | 42% | _TBD_ | 80%+ | :construction: |
| Dashboard Consolidation (H3) | 55+ overlapping | 2 consolidated | Reduce 40% | :white_check_mark: |

---

## Critical Priority (Security/Compliance)

### C1: Add CORS to Missing Edge Functions
**Risk**: Breaks multi-tenant white-label deployments
**Effort**: ~2 hours

| Function | Status | Notes |
|----------|--------|-------|
| `emergency-alert-dispatch` | :white_check_mark: DONE | Fixed CORS + `any` types + error handling |
| `passkey-auth-start` | :white_check_mark: DONE | Replaced hardcoded CORS with shared module |
| `passkey-auth-finish` | :white_check_mark: DONE | Replaced hardcoded CORS with shared module |
| `passkey-register-start` | :white_check_mark: DONE | Replaced hardcoded CORS with shared module |
| `passkey-register-finish` | :white_check_mark: DONE | Replaced hardcoded CORS with shared module |
| `hash-pin` | :white_check_mark: DONE | Replaced hardcoded CORS with shared module |
| `admin_register` | :white_check_mark: DONE | Replaced hardcoded CORS with shared module |
| `send-checkin-reminders` | :white_check_mark: DONE | Added CORS + fixed catch types |
| `send-consecutive-missed-alerts` | :white_check_mark: DONE | Added CORS + fixed catch types |
| `send-stale-reminders` | :white_check_mark: DONE | Added CORS + replaced console.error with auditLogger |
| `save-fcm-token` | :white_check_mark: DONE | Added CORS + fixed catch types |
| `send-telehealth-appointment-notification` | :white_check_mark: DONE | Added CORS + replaced console.error with auditLogger |
| `notify-stale-checkins` | :white_check_mark: DONE | Added CORS + fixed catch types |
| `nightly-excel-backup` | :white_check_mark: DONE | Added CORS + fixed catch types |
| `update-profile-note` | :white_check_mark: DONE | Added CORS + error handling + auditLogger |
| `realtime_medical_transcription` | :yellow_circle: SKIP | WebSocket endpoint - requires different handling |
| `send-appointment-reminder` | :yellow_circle: OK | Already uses withCORS wrapper from auth.ts |

**Pattern to add:**
```typescript
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }
  const { headers: corsHeaders } = corsFromRequest(req);
  // ... function logic ...
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

---

### C2: Replace console.log with auditLogger
**Risk**: HIPAA audit trail violation
**Effort**: ~1 hour

| Function | Status | Issue |
|----------|--------|-------|
| `extract-patient-form` | :white_check_mark: DONE | Replaced with createLogger |
| `process-vital-image` | :white_check_mark: DONE | Replaced with createLogger |
| `process-medical-transcript` | :white_check_mark: DONE | Replaced with createLogger |
| `send_welcome_email` | :white_check_mark: DONE | Replaced with createLogger |
| `send-stale-reminders` | :white_check_mark: DONE | Fixed in CORS update |
| `log-ai-confidence-score` | :white_check_mark: DONE | Replaced with createLogger |
| `update-voice-profile` | :white_check_mark: DONE | Replaced with createLogger |
| `verify-admin-pin` | :yellow_circle: SKIP | Can't log audit failure to audit log (documented) |
| `test_users` | :yellow_circle: SKIP | Test helper function |
| `realtime_medical_transcription` | :yellow_circle: SKIP | WebSocket - requires different handling |

**Pattern to use:**
```typescript
import { auditLogger } from '../_shared/auditLogger.ts';

// Instead of: console.log('Processing complete')
await auditLogger.info('PROCESS_COMPLETE', { functionName: 'extract-patient-form' });

// Instead of: console.error('Failed:', err)
await auditLogger.error('PROCESS_FAILED', err instanceof Error ? err : new Error(String(err)));
```

---

### C3: Fix Empty Catch Block in dischargePlanningService
**Risk**: Silent failures in discharge planning
**Effort**: 15 minutes

**Location**: `src/services/dischargePlanningService.ts`

| Item | Status | Notes |
|------|--------|-------|
| Line 51-53: Risk score calculation error | :white_check_mark: DONE | Added console.warn for fallback |
| Line 289-292: AI recommendations error | :white_check_mark: DONE | Added console.warn (non-critical) |
| Line 449-451: Follow-up alert creation error | :white_check_mark: DONE | Added console.warn (secondary) |

---

### C4: Update Deprecated CORS Pattern
**Risk**: Inconsistent CORS behavior
**Effort**: 30 minutes

| Function | Status | Current Pattern |
|----------|--------|-----------------|
| `login` | :white_check_mark: DONE | Uses `corsFromRequest(req)` |
| `verify-hcaptcha` | :white_check_mark: DONE | Uses `corsFromRequest(req)` |

**Pattern used:**
```typescript
import { corsFromRequest } from "../_shared/cors.ts";
const { headers, allowed } = corsFromRequest(req, { methods: [...], allowHeaders: [...] });
```

---

## High Priority (Quality/Maintainability)

### H1: Add Tests to Untested Component Directories
**Current**: 24/57 directories have tests (42%)
**Target**: 46/57 directories (80%)
**Effort**: ~1-2 days

| Directory | Components | Status | Priority |
|-----------|------------|--------|----------|
| `ui/` | 17 | :red_circle: TODO | HIGH - Design system |
| `ai/` | 5 | :red_circle: TODO | HIGH - AI features |
| `ai-transparency/` | 5 | :red_circle: TODO | HIGH - Compliance |
| `billing/` | 5 | :red_circle: TODO | HIGH - Revenue |
| `auth/` | 4 | :red_circle: TODO | HIGH - Security |
| `atlas/` | 6 | :red_circle: TODO | MEDIUM |
| `ems/` | 5 | :red_circle: TODO | MEDIUM |
| `discharge/` | 3 | :red_circle: TODO | MEDIUM |
| `handoff/` | 7 | :red_circle: TODO | MEDIUM |
| `nurse/` | 6 | :red_circle: TODO | MEDIUM |
| `nurseos/` | 7 | :red_circle: TODO | MEDIUM |
| `telehealth/` | 4 | :red_circle: TODO | MEDIUM |
| `smart/` | 11 | :red_circle: TODO | MEDIUM |
| `soc/` | 4 | :red_circle: TODO | MEDIUM |
| `sdoh/` | 4 | :red_circle: TODO | LOW |
| `layout/` | 6 | :red_circle: TODO | LOW |
| `collaboration/` | 3 | :red_circle: TODO | LOW |
| `system/` | 4 | :red_circle: TODO | LOW |
| `features/` | 3 | :red_circle: TODO | LOW |
| `security/` | 2 | :red_circle: TODO | LOW |
| `shared/` | 3 | :red_circle: TODO | LOW |
| `search/` | 1 | :red_circle: TODO | LOW |

---

### H2: Standardize Error Handling in Edge Functions
**Current**: ~95% use `catch (err: unknown)`
**Target**: 100%
**Effort**: ~3-4 hours

| Category | Count | Status |
|----------|-------|--------|
| Proper `catch (err: unknown)` | 110+ | :white_check_mark: |
| Fixed: `catch (err: any)` | 3 | :white_check_mark: DONE |
| Fixed: `catch (error)` in critical functions | 35+ | :white_check_mark: DONE |
| Remaining: MCP servers (7) | 7 | :yellow_circle: Low priority |
| Remaining: _shared modules (3) | 3 | :yellow_circle: Intentional |

**Functions fixed in this session:**
- weekly-inactivity-reminders (3 catch blocks)
- admin_register, register
- ai-billing-suggester, ai-readmission-predictor
- send-email, send-sms, send-push-notification, send-team-alert
- security-alert-processor (7), system-status (4), mobile-sync (4)
- notify-family-missed-check-in, get-personalized-greeting
- export-status, enhanced-fhir-export, bulk-export
- sms-verify-code, sms-send-code, claude-chat
- guardian-agent-api (4), guardian-pr-service (3)
- send-telehealth-appointment-notification (2)

---

### H3: Consolidate Dashboard Components
**Current**: 55+ dashboards with overlap
**Target**: Reduce by ~40%
**Effort**: ~1 day
**Status**: :white_check_mark: COMPLETED (2026-01-09)

#### AI/Cost Dashboards - CONSOLIDATED
**New**: `admin/AIFinancialDashboard.tsx` (3 tabs: Cost Management, MCP Savings, Revenue Impact)

| Original | Action | Status |
|----------|--------|--------|
| `admin/AIAccuracyDashboard.tsx` | KEEP (separate) | :white_check_mark: |
| `admin/AICostDashboard.tsx` | CONSOLIDATED → AIFinancialDashboard "Cost Management" tab | :white_check_mark: |
| `admin/MCPCostDashboard.tsx` | CONSOLIDATED → AIFinancialDashboard "MCP Savings" tab | :white_check_mark: |
| `ai/AIRevenueDashboard.tsx` | CONSOLIDATED → AIFinancialDashboard "Revenue Impact" tab | :white_check_mark: |
| `superAdmin/PlatformAICostDashboard.tsx` | KEEP (super admin view) | :white_check_mark: |

#### SOC2/Security Dashboards - CONSOLIDATED
**New**: `admin/SOC2ComplianceDashboard.tsx` (3 tabs: Audit & Compliance, Security Events, Incident Response)

| Original | Action | Status |
|----------|--------|--------|
| `admin/SOC2AuditDashboard.tsx` | CONSOLIDATED → SOC2ComplianceDashboard "Audit & Compliance" tab | :white_check_mark: |
| `admin/SOC2ExecutiveDashboard.tsx` | KEEP (executive summary) | :white_check_mark: |
| `admin/SOC2IncidentResponseDashboard.tsx` | CONSOLIDATED → SOC2ComplianceDashboard "Incident Response" tab | :white_check_mark: |
| `admin/SOC2SecurityDashboard.tsx` | CONSOLIDATED → SOC2ComplianceDashboard "Security Events" tab | :white_check_mark: |
| `admin/TenantSecurityDashboard.tsx` | KEEP (tenant-specific) | :white_check_mark: |
| `superAdmin/PlatformSOC2Dashboard.tsx` | KEEP (super admin) | :white_check_mark: |

**Routes Updated**:
- `lazyComponents.tsx`: Added AIFinancialDashboard, SOC2ComplianceDashboard
- `SystemAdministrationPage.tsx`: Security tab now uses SOC2ComplianceDashboard

**Original files preserved** for backwards compatibility; new consolidated dashboards are the recommended entry points.

---

### H4: Resolve UI Component Library Conflict
**Issue**: `ui/` primitives vs `envision-atlus/` design system
**Effort**: ~2-4 hours to document, longer to consolidate

| Action | Status |
|--------|--------|
| Document which is canonical (EA is newer) | :red_circle: TODO |
| Create migration guide from ui/ to EA | :red_circle: TODO |
| Deprecate ui/ components that have EA equivalents | :red_circle: TODO |

**Overlapping components:**
- `ui/card.tsx` vs `envision-atlus/EACard.tsx`
- `ui/alert.tsx` vs `envision-atlus/EAAlert.tsx`
- `ui/button.tsx` vs `envision-atlus/EAButton.tsx`
- `ui/badge.tsx` vs `envision-atlus/EABadge.tsx`

---

## Medium Priority (Technical Debt)

### M1: Migrate Remaining Services to ServiceResult Pattern
**Current**: 72% use ServiceResult
**Target**: 95%+
**Effort**: ~1 day

Services still using `throw` pattern:
- [ ] `billingService.ts`
- [ ] `notificationService.ts` (custom handling)
- [ ] `claudeService.ts` (ClaudeServiceError)
- [ ] `wearableService.ts` (WearableApiResponse)
- [ ] `neuroSuiteService.ts` (NeuroApiResponse)
- [ ] `consentManagementService.ts` (mixed)
- [ ] Various AI services

---

### M2: Eliminate `any` Types
**Current**: 799 lint warnings
**Target**: <100
**Effort**: ~2-3 days

**Priority files:**
| File | Issue | Status |
|------|-------|--------|
| `useFhirData.ts:622` | `updates: any` in mutation | :red_circle: TODO |
| `emergency-alert-dispatch` | `any` for Supabase client | :red_circle: TODO |
| `pagination.ts:196-197, 240-241` | `any` for query builders | :yellow_circle: Acceptable at boundary |

---

### M3: Consolidate Module Access Hooks
**Current**: 3 overlapping implementations
**Target**: 1 unified hook with variants
**Effort**: ~2-3 hours

| Current Hook | Purpose | Action |
|--------------|---------|--------|
| `useModuleAccess` | Checks entitlement + enabled | KEEP as primary |
| `useTenantModules` | Full config + check functions | MERGE |
| `useTenantModule` | Single module check | MERGE |

---

### M4: Merge Single-Component Directories
**Current**: 16 directories with only 1 component
**Target**: Consolidate into logical groups
**Effort**: ~2 hours

| Directory | Component | Suggested Target |
|-----------|-----------|------------------|
| `dental/` | 1 | `healthcare/` or `patient/` |
| `mental-health/` | 1 | `healthcare/` |
| `questionnaires/` | 1 | `patient/` |
| `referrals/` | 1 | `careCoordination/` |
| `search/` | 1 | `shared/` |
| `social-worker/` | 1 | `case-manager/` |
| `case-manager/` | 1 | Keep or merge with social-worker |
| `debug/` | 1 | `system/` |
| `wearables/` | 1 | `vitals/` |

---

### M5: Remove Duplicate Edge Functions
**Effort**: 30 minutes

| Duplicate | Keep | Remove | Status |
|-----------|------|--------|--------|
| `send-email` vs `send_email` | `send-email` | `send_email` | :red_circle: TODO |
| `test-users` vs `test_users` | `test-users` | `test_users` | :red_circle: TODO |

---

## Low Priority (Polish)

### L1: Complete OCR Integration
**Location**: `supabase/functions/process-vital-image/index.ts:265`
**Issue**: TODO comment for Tesseract.js integration
**Status**: :red_circle: TODO

---

### L2: Update CLAUDE.md Metrics
| Metric | In CLAUDE.md | Actual | Status |
|--------|--------------|--------|--------|
| Tests | 3,101 | 3,218 | :red_circle: Update |
| Test Suites | 138 | 144 | :red_circle: Update |
| Lint Warnings | 799 | _Verify_ | :yellow_circle: Verify |

---

### L3: Add CLAUDE.md Table of Contents
**Issue**: 882-line document with no navigation
**Status**: :red_circle: TODO

---

### L4: Remove DEBUG Flag
**Location**: `supabase/functions/coding-suggest/index.ts:18`
**Issue**: `const DEBUG = false;` - should be removed or env-controlled
**Status**: :red_circle: TODO

---

## Progress Log

| Date | Action | Result |
|------|--------|--------|
| 2025-01-05 | Initial audit completed | Baseline established |
| 2026-01-09 | H3: Dashboard Consolidation completed | Created AIFinancialDashboard and SOC2ComplianceDashboard with tabbed interfaces |
| 2026-01-09 | Updated routes (lazyComponents.tsx, SystemAdministrationPage.tsx) | New dashboards integrated |
| | | |

---

## Completion Criteria for Launch Readiness

### Must Have (Before Demo)
- [ ] All Critical (C1-C4) items resolved
- [ ] H1: At least `ui/`, `auth/`, `billing/` have tests
- [ ] H2: No `catch (err: any)` in edge functions
- [ ] Tests still passing (3,218+)
- [ ] TypeScript still compiling (0 errors)

### Should Have (Before Production)
- [ ] All High (H1-H4) items resolved
- [ ] M1: 90%+ services use ServiceResult
- [ ] M2: <200 lint warnings
- [ ] Edge function test coverage >50%

### Nice to Have (Post-Launch)
- [ ] All Medium (M1-M5) items resolved
- [ ] All Low (L1-L4) items resolved
- [ ] Lint warnings <100
- [ ] Component test coverage >80%

---

## Commands Reference

```bash
# Check current test count
npm test 2>&1 | grep -E "Tests|Suites"

# Check TypeScript errors
npm run typecheck

# Check lint warnings
npm run lint 2>&1 | grep -c "warning"

# Run specific test file
npm test -- src/components/ui/__tests__/

# Deploy edge function after fix
npx supabase functions deploy <function-name>
```

---

*This document is a living tracker. Update status emojis as work progresses.*

**Legend:**
- :white_check_mark: Complete
- :yellow_circle: In Progress / Needs Review
- :red_circle: TODO
- :construction: Ongoing
