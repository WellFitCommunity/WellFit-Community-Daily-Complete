# Guardian Agent & Guardian Eyes — Gap Closure Tracker

> **Priority:** HIGH — System is 70% complete but critical orchestration gaps prevent it from functioning as designed
> **Created:** 2026-04-20
> **Current Status:** 0/9 items complete
> **Estimated total:** ~24 hours across 2 sessions
> **Honest Assessment:** The pieces are built but not connected. Detection works. Notification doesn't.

---

## Current State — What Works vs What Doesn't

### What WORKS

| Component | Status | Evidence |
|-----------|--------|----------|
| Monitoring (5-min cron) | Working | `guardian-automated-monitoring` cron calls `/guardian-agent` with `action: monitor` |
| Alert creation | Working | Detected issues create `security_alerts` records with tenant scoping |
| Direct email for critical/high alerts | Working | Guardian-agent calls `/send-email` for critical/high severity (if MailerSend configured) |
| Approval form UI | Working | `/guardian/approvals` route, ticket list, 3-checkbox approval with SOC2 compliance |
| RLS on all tables | Working | Tenant data cannot leak cross-tenant |
| Audit logging | Working | All actions logged to `audit_logs` |
| Database schema | Working | All tables exist, indexed, with proper constraints |
| Guardian Eyes recordings | Working | Snapshots stored in `guardian_eyes_recordings` with storage bucket |

### What DOES NOT WORK

| Component | Status | Root Cause |
|-----------|--------|------------|
| Multi-channel notifications (Slack/SMS/PagerDuty) | Broken | `security-alert-processor` cron job is **commented out** in migration |
| Ticket auto-creation | Broken | Nothing in codebase calls `guardianApprovalService.createTicket()` |
| Browser-side monitoring in dev/staging | Broken | `GuardianAgent.start()` gated behind `import.meta.env.MODE === 'production'` |
| Guardian Eyes → approval form link | Broken | Recordings exist but `GuardianApprovalForm.tsx` doesn't display them |
| Auto-fix PR generation | Dead code | `guardian-pr-service` (566 lines) exists but is never invoked |
| Multi-facility ED crowding config | Broken | `guardian_flow_config` table referenced but never created in migrations |
| Guardian Agent API scan action | Placeholder | Returns empty result instead of running actual security scan |

---

## Architecture (How It Should Work)

```
Guardian Agent (5-min cron)
    │
    ├─ Detects: failed logins, DB errors, PHI access patterns, slow queries
    │
    ├─ Creates security_alert in database
    │       │
    │       ├─ Critical/High → direct email via send-email ✅ WORKS
    │       │
    │       ├─ All severities → security-alert-processor sends Slack/SMS/PagerDuty
    │       │       ❌ BROKEN: cron never triggers processor
    │       │
    │       └─ Approval-required → createTicket() in guardian_review_tickets
    │               ❌ BROKEN: nothing calls createTicket()
    │
    ├─ Records snapshot in guardian_eyes_recordings ✅ WORKS
    │       │
    │       └─ Linked to approval form for context
    │               ❌ BROKEN: form doesn't display recording
    │
    └─ Guardian Agent (browser-side, parallel)
            │
            ├─ Monitors window.onerror, unhandledrejection
            ├─ Runs SecurityScanner, MonitoringSystem, HealingEngine
            │       ❌ BROKEN: only starts in production mode
            │
            └─ Auto-fix via PR → guardian-pr-service
                    ❌ DEAD CODE: never invoked
```

---

## Session Plan

| Session | Focus | Items | Hours | Status |
|---------|-------|-------|-------|--------|
| **1** | Critical fixes — cron job, ticket creation, browser start, notification flow | GRD-1 through GRD-5 | ~14 | PENDING |
| **2** | Integration — Eyes→approval, flow config, PR service decision, E2E test | GRD-6 through GRD-9 | ~10 | PENDING |

---

## Items

### GRD-1: Enable Security Alert Processor Cron (CRITICAL)

**Problem:** The `security-alert-processor` edge function is fully built (516 lines) with Slack, SMS, email, and PagerDuty notification channels. But the cron job that triggers it is **commented out** in migration `20251203000002`.

**Impact:** Critical alerts sit in the `security_alerts` table forever. SOC team receives no multi-channel notifications. Only direct email from guardian-agent works (critical/high only).

**Fix:**
```sql
-- New migration: 20260420_enable_security_alert_processor_cron.sql
SELECT cron.schedule(
  'security-alert-processor',
  '*/1 * * * *',  -- every minute
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/security-alert-processor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Files:** New migration + verify `security-alert-processor` accepts Bearer token auth (already fixed in today's adversarial audit — cron secret validation added)

**Estimated:** ~2 hours (migration + deploy + verify)

---

### GRD-2: Wire Ticket Auto-Creation (CRITICAL)

**Problem:** `guardianApprovalService.createTicket()` exists (line 59), tests pass, but **nothing in the codebase calls it**. Guardian Agent detects issues but can't surface them to the human approval workflow.

**Fix:** Add integration hook in the Guardian Agent edge function's monitoring handler. When an alert is created that meets approval criteria (e.g., auto-heal proposed, Tier 3+ action detected), also create a review ticket.

**Implementation:**
```
1. In guardian-agent/index.ts, after inserting security_alert:
   - If alert.requires_approval === true:
   - Call guardian_review_tickets RPC to create ticket
   - Link ticket to alert via alert_id
2. In browser-side AgentBrain.ts, when healing is proposed:
   - Call guardianApprovalService.createTicket() with healing details
3. Add requires_approval field to security_alerts if not present
```

**Files to modify:**
- `supabase/functions/guardian-agent/index.ts` — add ticket creation after alert insert
- `src/services/guardian-agent/AgentBrain.ts` — add approval integration
- May need migration for `requires_approval` column

**Estimated:** ~4 hours

---

### GRD-3: Fix Browser-Side Guardian Start (HIGH)

**Problem:** `GuardianAgent.start()` is gated behind `import.meta.env.MODE === 'production'`. In development and staging, the browser-side monitoring (window.onerror, unhandledrejection, SecurityScanner) never starts.

**Fix:** Start in all environments, or at minimum start in both production and staging.

**Implementation:**
```typescript
// Before (broken):
if (import.meta.env.MODE === 'production') {
  const agent = GuardianAgent.getInstance();
  agent.start();
}

// After (fixed):
const agent = GuardianAgent.getInstance();
agent.start();
// OR: if (import.meta.env.MODE !== 'test') { ... }
```

**Files to modify:** `src/services/guardian-agent/GuardianAgent.ts`

**Estimated:** ~1 hour (change + verify dashboard shows live data)

---

### GRD-4: Fix Guardian Agent API Scan Action (HIGH)

**Problem:** The `guardian-agent-api` edge function claims to support `security_scan` action, but the handler returns a placeholder result instead of running actual scanning logic.

**Fix:** Either implement the scan by calling the guardian-agent monitoring checks, or remove the placeholder and document that scans are cron-only.

**Estimated:** ~3 hours

---

### GRD-5: End-to-End Notification Test (HIGH)

**Problem:** Even after GRD-1 is fixed, there's no verification that the full notification chain works: alert → processor → Slack/SMS/PagerDuty.

**Fix:** Create a test that:
1. Inserts a test alert into `security_alerts`
2. Triggers `security-alert-processor` manually
3. Verifies notification was attempted (check audit log)
4. Verifies alert status updated to `notified`

**Files:** New integration test or manual test script

**Estimated:** ~4 hours

---

### GRD-6: Wire Guardian Eyes Recordings to Approval Form (MEDIUM)

**Problem:** `guardian_eyes_recordings` stores snapshots. `security_alerts` has `session_recording_id` and `session_recording_url` columns. But `GuardianApprovalForm.tsx` doesn't fetch or display any recordings.

**Fix:** Add recording viewer section to the approval form.

**Implementation:**
```
1. In GuardianApprovalForm.tsx, fetch linked recording from guardian_eyes_recordings
2. Display recording metadata (timestamp, duration, events captured)
3. If video/screenshot available, show inline
4. Add "View Recording" expandable section before the approval checklist
```

**Estimated:** ~3 hours

---

### GRD-7: Create guardian_flow_config Migration (MEDIUM)

**Problem:** `guardianFlowEngine.ts` queries `guardian_flow_config` table (line 66) for per-facility ED crowding thresholds. The table was never created. Service falls back to DEFAULT_CONFIG.

**Fix:** Create the migration with the schema the service expects.

**Estimated:** ~2 hours (migration + seed default config per existing tenants)

---

### GRD-8: Guardian PR Service — Keep or Remove (MEDIUM)

**Problem:** `guardian-pr-service` (566 lines) is well-built GitHub integration code that creates/merges PRs. But nothing in the codebase invokes it. It's dead code.

**Decision needed from Maria:**
- **Option A:** Wire it into the approval workflow (when ticket approved, auto-create PR with fix). This completes the auto-healing vision. ~8 hours additional work.
- **Option B:** Remove it. Clean codebase, no dead code. 5 minutes.
- **Option C:** Keep as-is, document as "future feature." No code change.

**Estimated:** 0h (decision) or 8h (Option A)

---

### GRD-9: Full End-to-End Integration Test (LOW)

**Problem:** Individual components have tests, but no test verifies the complete flow: detect → alert → notify → ticket → approve → heal.

**Fix:** Create integration test that simulates the full lifecycle.

**Estimated:** ~4 hours

---

## Regression Check Commands

```bash
# Verify guardian functions have auth
grep -rn "Authorization\|getUser\|auth" supabase/functions/guardian-agent/index.ts supabase/functions/guardian-agent-api/index.ts supabase/functions/security-alert-processor/index.ts
# Should find JWT verification in each

# Verify no guardian tables missing RLS
grep -rn "ENABLE ROW LEVEL SECURITY" supabase/migrations/ | grep -i guardian
# Should find RLS for all guardian tables

# Standard verification
bash scripts/typecheck-changed.sh && npm run lint && npm test
```

---

## Notification Channel Strategy (Confirmed 2026-04-20)

Maria confirmed the notification infrastructure status and strategy:

### Channel Status

| Channel | Provider | Status | Purpose |
|---------|----------|--------|---------|
| **Email** | MailerSend | Configured | Critical/high alerts, formal audit trail |
| **SMS** | Twilio | Configured | Urgent — system down, data breach |
| **Slack** | Slack Webhooks | Not yet connected (Maria can connect) | Team awareness, non-urgent alerts, discussion |
| **Internal (in-app)** | `security_notifications` table | Working | Real-time for clinicians already on dashboard |
| **PagerDuty (external)** | ~~events.pagerduty.com~~ | **DISABLE** | Was never external PagerDuty SaaS — was internal UI-only system |

### Strategy

1. **Enable the cron (GRD-1):** MailerSend + Twilio start working immediately
2. **Add Slack:** When Maria provides webhook URL — one Supabase secret to set (`SLACK_SECURITY_WEBHOOK_URL`)
3. **Keep internal notifications:** `security_notifications` table powers in-app alerts on dashboard — already functional
4. **Disable external PagerDuty API call:** Graceful no-op in `security-alert-processor` — the code calls `events.pagerduty.com` but Maria's PagerDuty was purely an in-app UI system, not the SaaS product. Replace with internal notification insert.

### Why Four Channels

| Scenario | Who Needs to Know | Channel |
|----------|-------------------|---------|
| Maria is at church, critical alert fires | Maria + Akima | SMS (Twilio) + Email (MailerSend) |
| Clinician is on monitoring dashboard | Clinician | Internal (in-app popup) |
| Team needs awareness of non-urgent issue | Everyone | Slack channel |
| Audit trail / compliance record | Auditors | Email (permanent record) |

### Implementation Notes for GRD-1

When enabling the security-alert-processor cron:
- MailerSend: use existing `MAILERSEND_API_KEY` secret — already configured
- Twilio: use existing `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` — already configured
- Slack: skip until `SLACK_SECURITY_WEBHOOK_URL` is set (code should gracefully skip if env var missing)
- PagerDuty: replace external API call with `security_notifications` table insert (internal delivery)

---

## Questions for Maria Before Starting

1. **GRD-3:** Should browser-side Guardian run in development mode, or only staging + production?
2. **GRD-8:** What's your vision for the PR service? Auto-fix via GitHub PR, or remove dead code?
3. **General:** Who is the SOC team? Is it Maria + Akima, or is there a dedicated security contact?
