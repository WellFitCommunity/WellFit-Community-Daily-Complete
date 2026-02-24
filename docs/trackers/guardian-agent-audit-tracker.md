# Guardian Agent & Guardian Eyes — Audit & Hardening Tracker

> **Owner:** Maria (AI System Director)
> **Created:** 2026-02-24
> **Estimated effort:** ~16 hours across 2-3 sessions

## Session 1 — Tenant Isolation (CRITICAL) ✅ COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Add `tenantId` to core types (`ErrorContext`, `AgentConfig`, `HealingResult`, `DetectedIssue`, `HealingAction`, `KnowledgeEntry`) | `[x]` | `types.ts` |
| 1.2 | Thread tenant_id through GuardianAgent singleton (`setTenantId()`, `getTenantId()`, propagation to brain + monitoring) | `[x]` | `GuardianAgent.ts` |
| 1.3 | Thread tenant_id through AgentBrain (analyze, knowledge base, rate limiter, alerts, approval) | `[x]` | `AgentBrain.ts` |
| 1.4 | Thread tenant_id through HealingEngine (`HealingResult.tenantId` from action) | `[x]` | `HealingEngine.ts` |
| 1.5 | Thread tenant_id through MonitoringSystem (all error contexts, anomaly contexts, config propagation) | `[x]` | `MonitoringSystem.ts` |
| 1.6 | Add tenant filtering to `guardian-agent` edge function (`resolveTenantId()` from JWT, tenant filter on all queries + inserts) | `[x]` | `supabase/functions/guardian-agent/index.ts` |
| 1.7 | Add tenant_id to GuardianAlertService (`guardian_alerts` insert, `security_notifications` insert, email scoping, `getPendingAlerts`, `acknowledgeAlert`, `resolveAlert`) | `[x]` | `GuardianAlertService.ts` |
| 1.8 | Add tenant_id to AISystemRecorder (`SessionRecording.tenant_id`, tenant-prefixed storage paths, `startRecording()` param) | `[x]` | `AISystemRecorder.ts` |
| 1.9 | SecurityScanner — no direct changes needed (tenant flows through ErrorContext from callers) | `[x]` | Tenant context reaches scanner via AgentBrain |
| 1.10 | Add per-tenant rate limiting in SafetyConstraints (`getKey()` with tenant prefix) | `[x]` | `SafetyConstraints.ts` |
| 1.11 | Fix VersionManifest hardcoded React 18.2.0 → React 19.0.0 | `[x]` | `SafetyConstraints.ts` (bonus — pulled from Session 3) |
| 1.12 | Fix test mock — add `updateConfig` to MockMonitoringSystem | `[x]` | `GuardianAgent.test.ts` |

**Verification:** ✅ typecheck: 0 errors | ✅ lint: 0 errors, 0 warnings | ✅ tests: 9,115 passed, 0 failed (470 suites)

## Session 2 — Intelligence & Persistence ✅ COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Implement `contextMatches()` properly in AgentBrain | `[x]` | Category-specific context matching (security=universal, API checks apiEndpoint, DB checks databaseQuery, auth checks auth paths, etc.) |
| 2.2 | Persist LearningSystem patterns to database (tenant-scoped) | `[x]` | New tables: `guardian_learning_patterns`, `guardian_strategy_success_rates` with upsert on `(tenant_id, pattern_key)` + debounced writes |
| 2.3 | Add tenant scoping to RealtimeSecurityMonitor subscriptions | `[x]` | `tenant_id=eq.{id}` filter on Realtime subscription + tenant filter on all queries |
| 2.4 | Add tenant scoping to guardianApprovalService queries | `[x]` | New migration adds `tenant_id` to `guardian_review_tickets`, updated RPC, tenant filter on all queries + subscription |
| 2.5 | Decompose `ProposeWorkflow.ts` (1,214 lines → under 600) | `[x]` | Split into `propose-workflow/` dir: types.ts (60), ProposeWorkflow.ts (412), GitHubIntegration.ts (461), index.ts (10) |

**Verification:** ✅ typecheck: 0 errors | ✅ lint: 0 errors, 0 warnings | ✅ tests: 9,114 passed, 1 failed (pre-existing GlucometerPage flaky test — unrelated)

## Session 3 — Healing Reality & Polish ✅ COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.0 | Fix pre-existing flaky GlucometerPage test | `[x]` | Button clicked during loading (disabled). Fixed: wait for 'Not Connected' before clicking |
| 3.1 | Implement real healing actions in HealingEngine.performAction() | `[x]` | New `RuntimeHealer.ts` (588 lines) — real token refresh, cache clearing, circuit breakers, security logging, retry with backoff, degraded mode, emergency shutdown, etc. |
| 3.2 | ~~Fix VersionManifest hardcoded React 18.2.0 → React 19~~ | `[x]` | Done in Session 1 |
| 3.3 | Add per-tenant GitHub repo config to PR service | `[x]` | `configureGitHubForTenant()` loads from `admin_settings` (guardian_github_token/owner/repo), per-tenant cache, auto-resolves on `submitProposal()` |
| 3.4 | Run full verification checkpoint | `[x]` | `npm run typecheck && npm run lint && npm test` |

**Verification:** ✅ typecheck: 0 errors | ✅ lint: 0 errors, 0 warnings | ✅ tests: 9,115 passed, 0 failed (470 suites) — flaky test fixed, +1 from Session 2

## Innovation Enhancements (Future — Post-Hardening)

| # | Enhancement | Priority | Notes |
|---|------------|----------|-------|
| F.1 | Cross-tenant anonymized pattern sharing | Medium | "Tenant A's fix helps Tenant B" without leaking data |
| F.2 | Predictive healing (fix before error happens) | Medium | Based on learned patterns + time-of-day trends |
| F.3 | Recording-to-diagnosis pipeline | High | Guardian Eyes replay → AI root cause analysis |
| F.4 | Guardian confidence scoring | Medium | "How sure am I this fix is correct?" before auto-heal |

## Audit Summary

- **76 Guardian-related files** across edge functions, services, UI, migrations, docs
- **Critical finding:** Zero tenant isolation in core monitoring, healing, alerting, recordings
- **Infrastructure exists** (TokenAuth, PHIEncryption, AuditLogger have tenant fields) but core modules never consume it
- **Session 1 resolved:** All core Guardian modules now tenant-aware — monitoring, healing, alerting, recordings, rate limiting
- **Session 2 resolved:** Intelligence (contextMatches, learning persistence, tenant scoping), decomposed god file
- **Session 3 resolved:** Real healing actions (RuntimeHealer), per-tenant GitHub config, flaky test fixed
- **Innovation is strong** — detect → analyze → heal → learn → propose cycle is rare in healthcare IT
- **Audit COMPLETE** — all 3 sessions done. Guardian Agent is now production-hardened with tenant isolation, real healing, and persistent learning

## Files Modified in Session 1

| File | Changes |
|------|---------|
| `src/services/guardian-agent/types.ts` | Added `tenantId` to 6 interfaces |
| `src/services/guardian-agent/GuardianAgent.ts` | `setTenantId()`, `getTenantId()`, config propagation to monitoring |
| `src/services/guardian-agent/AgentBrain.ts` | Tenant-scoped issues, knowledge, rate limiting, alerts, approval |
| `src/services/guardian-agent/HealingEngine.ts` | Tenant-tagged `HealingResult` |
| `src/services/guardian-agent/MonitoringSystem.ts` | `updateConfig()`, tenant in all error contexts |
| `src/services/guardian-agent/GuardianAlertService.ts` | Tenant in inserts, queries, email scoping |
| `src/services/guardian-agent/AISystemRecorder.ts` | Tenant in `SessionRecording`, storage paths, `startRecording()` |
| `src/services/guardian-agent/SafetyConstraints.ts` | Per-tenant rate limiting, React 19 version fix |
| `supabase/functions/guardian-agent/index.ts` | `resolveTenantId()`, tenant filter on all queries/inserts |
| `src/services/guardian-agent/__tests__/GuardianAgent.test.ts` | Added `updateConfig` to mock |

## Files Modified in Session 2

| File | Changes |
|------|---------|
| `src/services/guardian-agent/AgentBrain.ts` | Real `contextMatches()` implementation, LearningSystem tenant propagation |
| `src/services/guardian-agent/LearningSystem.ts` | Complete rewrite — DB persistence via `guardian_learning_patterns`/`guardian_strategy_success_rates`, debounced writes, `setTenantId()` |
| `src/services/guardian-agent/RealtimeSecurityMonitor.ts` | Tenant-filtered Realtime subscription, tenant filter on all queries |
| `src/services/guardianApprovalService.ts` | Tenant filter on all queries, subscription, `setTenantId()` |
| `src/types/guardianApproval.ts` | Added `tenant_id` to `GuardianReviewTicket` |
| `src/services/__tests__/guardianApprovalService.test.ts` | Added `tenant_id` to mock ticket |
| `src/services/guardian-agent/ProposeWorkflow.ts` | Replaced 1,213-line god file with thin barrel re-export (24 lines) |
| `src/services/guardian-agent/propose-workflow/types.ts` | **NEW** — Extracted type definitions (60 lines) |
| `src/services/guardian-agent/propose-workflow/ProposeWorkflow.ts` | **NEW** — Core workflow class (412 lines) |
| `src/services/guardian-agent/propose-workflow/GitHubIntegration.ts` | **NEW** — GitHub API integration (461 lines) |
| `src/services/guardian-agent/propose-workflow/index.ts` | **NEW** — Barrel re-export (10 lines) |
| `supabase/migrations/20260224000001_guardian_learning_patterns.sql` | **NEW** — `guardian_learning_patterns` + `guardian_strategy_success_rates` tables with RLS |
| `supabase/migrations/20260224000002_guardian_review_tickets_tenant.sql` | **NEW** — Adds `tenant_id` to `guardian_review_tickets`, updates RLS + RPC |

## Files Modified in Session 3

| File | Changes |
|------|---------|
| `src/pages/devices/__tests__/GlucometerPage.test.tsx` | Fixed flaky test — wait for 'Not Connected' before clicking connect button |
| `src/services/guardian-agent/HealingEngine.ts` | Added `RuntimeHealer` import, delegated `performAction()` to it (removed stubs) |
| `src/services/guardian-agent/RuntimeHealer.ts` | **NEW** — Real runtime healing: retry with backoff, circuit breakers, cache fallback, token refresh, resource cleanup, security logging, degraded mode, emergency shutdown (588 lines) |
| `src/services/guardian-agent/propose-workflow/ProposeWorkflow.ts` | Added `setTenantId()`, `configureGitHubForTenant()` (reads admin_settings), auto-resolves on `submitProposal()` |
| `src/services/guardian-agent/propose-workflow/index.ts` | Added `GitHubTenantConfig` type export |
| `src/services/guardian-agent/ProposeWorkflow.ts` | Added `GitHubTenantConfig` re-export |
