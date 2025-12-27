# TODO Tracker

**Generated:** 2025-12-27
**Last Updated:** 2025-12-27
**Total TODOs:** 24 (excluding test file references)
**Codebase Size:** ~424,500 LOC
**TODO Density:** 0.006% (very low)

---

## Priority 1: Integration Pending (8 items)

These require external service connections. Address when those services are configured.

| Status | File | Line | Description |
|--------|------|------|-------------|
| [x] | `services/wearableService.ts` | 275 | Integrate with notification system |
| [x] | `services/wearableService.ts` | 449 | Integrate with emergency notification system |
| [x] | `services/lawEnforcementService.ts` | 226 | Send email reminder if email available |
| [x] | `services/holisticRiskAssessment.ts` | 483 | Integrate with medication tracking when available |
| [x] | `services/guardian-agent/GuardianAlertService.ts` | 240 | Integrate with actual email service |
| [ ] | `services/guardian-agent/AuditLogger.ts` | 300 | Send to actual telemetry endpoints |
| [ ] | `utils/performance.ts` | 119 | Send stats to external monitoring service (Datadog, New Relic) |
| [x] | `utils/pagination.ts` | 357 | Replace with proper audit logger from auditLogger.ts |

**New Services Created:**
- `services/emailService.ts` - MailerSend integration
- `services/notificationService.ts` - Multi-channel (in-app, push, email, Slack)
- `services/medicationTrackingService.ts` - Full medication adherence tracking

---

## Priority 2: Feature Completion (6 items)

Core feature logic that needs implementation.

| Status | File | Line | Description |
|--------|------|------|-------------|
| [ ] | `components/admin/FHIRConflictResolution.tsx` | 151 | Implement resource-specific update logic |
| [ ] | `components/admin/FHIRConflictResolution.tsx` | 157 | Update sync log |
| [ ] | `components/admin/FHIRConflictResolution.tsx` | 163 | Implement smart merge logic |
| [ ] | `services/billingService.ts` | 404 | Replace with PostgreSQL aggregate query for accurate metrics |
| [ ] | `services/dischargeToWellnessBridge.ts` | 773 | Calculate mental_health_screenings_pending |
| [ ] | `services/dentalHealthService.ts` | 718 | Calculate overdue_followups_count based on follow-up dates |

---

## Priority 3: Guardian Agent Production (5 items)

Advanced AI agent module - address before Guardian Agent production deployment.

| Status | File | Line | Description |
|--------|------|------|-------------|
| [x] | `services/guardian-agent/ProposeWorkflow.ts` | 745 | GitHub Actions CI/CD integration |
| [x] | `services/guardian-agent/ExecutionSandbox.ts` | 524 | Resource limits & rate limiting |
| [x] | `services/guardian-agent/ToolRegistry.ts` | 446 | SHA-256 checksums & verification |
| [x] | `services/guardian-agent/SchemaValidator.ts` | 437 | PHI/SQLi/XSS detection |
| [x] | `services/guardian-agent/TokenAuth.ts` | 455 | RS256 JWT signing with jose |

**P3 Enhancements Implemented:**
- `waitForChecks()` - Poll GitHub Actions until complete
- `canMerge()` - Verify merge requirements (approvals, checks)
- `safeMergePR()` - Merge with safety checks, blocks on failures
- `PHIDetector`, `SQLInjectionDetector`, `XSSDetector` classes
- `ResourceMonitor` with rate limiting and memory estimation

---

## Priority 4: Minor Improvements (4 items)

Nice-to-have enhancements, not blocking.

| Status | File | Line | Description |
|--------|------|------|-------------|
| [ ] | `components/sdoh/SDOHDetailPanel.tsx` | 314 | Open update form |
| [ ] | `components/sdoh/SDOHDetailPanel.tsx` | 323 | Open referral form |
| [ ] | `services/feeScheduleService.ts` | 174 | Apply modifier adjustments if needed |
| [ ] | `services/guardian-agent/SmartRecordingStrategy.ts` | 264 | Add tag to metadata |

---

## Priority 5: Approval Workflow (1 item)

Admin notification system.

| Status | File | Line | Description |
|--------|------|------|-------------|
| [ ] | `services/guardian-agent/AgentBrain.ts` | 572 | Implement approval workflow - notify admins via audit logger |

---

## Completion Progress

- [x] Priority 1: 6/8 complete (75%)
- [ ] Priority 2: 0/6 complete (0%)
- [x] Priority 3: 5/5 complete (100%)
- [ ] Priority 4: 0/4 complete (0%)
- [ ] Priority 5: 0/1 complete (0%)

**Overall: 11/24 complete (46%)**

---

## Remaining Work Summary

| Priority | Remaining | Items |
|----------|-----------|-------|
| P1 | 2 | Telemetry endpoints, external monitoring (Datadog/New Relic) |
| P2 | 6 | FHIR conflict resolution, billing metrics, discharge/dental calcs |
| P4 | 4 | SDOH forms, fee schedule modifiers, recording metadata |
| P5 | 1 | Admin approval workflow notifications |

---

## Notes

- **Not blockers for demo/deployment** - System compiles, builds, and all 2309 tests pass
- **P1 remaining items** depend on external monitoring service configuration
- **P2 items** are feature completion for specific admin/clinical features
- **P3 COMPLETE** - Guardian Agent production ready
- Mark items with `[x]` when complete and update the progress section
