# TODO Tracker

**Generated:** 2025-12-27
**Total TODOs:** 24 (excluding test file references)
**Codebase Size:** ~424,500 LOC
**TODO Density:** 0.006% (very low)

---

## Priority 1: Integration Pending (8 items)

These require external service connections. Address when those services are configured.

| Status | File | Line | Description |
|--------|------|------|-------------|
| [ ] | `services/wearableService.ts` | 275 | Integrate with notification system |
| [ ] | `services/wearableService.ts` | 449 | Integrate with emergency notification system |
| [ ] | `services/lawEnforcementService.ts` | 226 | Send email reminder if email available |
| [ ] | `services/holisticRiskAssessment.ts` | 483 | Integrate with medication tracking when available |
| [ ] | `services/guardian-agent/GuardianAlertService.ts` | 240 | Integrate with actual email service |
| [ ] | `services/guardian-agent/AuditLogger.ts` | 300 | Send to actual telemetry endpoints |
| [ ] | `utils/performance.ts` | 119 | Send stats to external monitoring service (Datadog, New Relic) |
| [ ] | `utils/pagination.ts` | 357 | Replace with proper audit logger from auditLogger.ts |

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
| [ ] | `services/guardian-agent/ProposeWorkflow.ts` | 745 | Production TODO (review file for details) |
| [ ] | `services/guardian-agent/ExecutionSandbox.ts` | 524 | Production TODO (review file for details) |
| [ ] | `services/guardian-agent/ToolRegistry.ts` | 446 | Production TODO (review file for details) |
| [ ] | `services/guardian-agent/SchemaValidator.ts` | 437 | Production TODO (review file for details) |
| [ ] | `services/guardian-agent/TokenAuth.ts` | 455 | Production TODO (review file for details) |

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

- [ ] Priority 1: 0/8 complete
- [ ] Priority 2: 0/6 complete
- [ ] Priority 3: 0/5 complete
- [ ] Priority 4: 0/4 complete
- [ ] Priority 5: 0/1 complete

**Overall: 0/24 complete (0%)**

---

## Notes

- **Not blockers for demo/deployment** - System compiles, builds, and all tests pass
- **Integration items** depend on external service configuration (email, telemetry, monitoring)
- **Guardian Agent items** only matter when deploying that specific module to production
- Mark items with `[x]` when complete and update the progress section
