# Guardian ↔ Behavioral-Anomaly Integration Tracker

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**

**Created:** 2026-06-04 · **Owner:** Claude (autonomous, Maria-directed) · **Status:** IN PROGRESS

## Why this exists (the finding)

The behavioral-anomaly subsystem is **built but islanded** from Guardian. Maria's directive (2026-06-04): *"they need to be included [in Guardian Eyes]."* This tracker wires the anomaly subsystem into Guardian's field of view, piece by piece.

### Confirmed architecture (3 layers, all Guardian-family)

```
LAYER 1 — Detection      behavioralAnalyticsService (client) + dropped detect_* SQL
  → writes anomaly_detections   (impossible travel, peer deviation, PHI-access scoring)
LAYER 2 — Automation     securityAutomationService  (imports guardian-agent/SecurityAlertNotifier)
  → reads anomaly_detections, writes security_alerts, runs lockout/MFA/notify + escalations
LAYER 3 — Guardian       guardian-agent edge fn (cron/min) + Guardian Eyes (AISystemRecorder/rrweb) + AgentBrain
  → monitors security_alerts → notify / heal / tickets; Eyes records, Brain learns
```

**The gap:** nothing *runs* layers 1–2. `anomaly_detections` is EMPTY; `behavioralAnalyticsService` + `securityAutomationService` have ZERO importers. Guardian (layer 3) runs on cron but is blind to anomalies.

### Ground-truth facts (verified live 2026-06-04, project xkybsjnvuohpqpbkikyn)

- **`anomaly_detections` exists.** NOT NULL cols for INSERT: `user_id`(uuid), `aggregate_anomaly_score`(numeric), `anomaly_breakdown`(jsonb), `risk_level`(text), `event_timestamp`(tstz). Defaulted: `id`, `detected_at`=now(), `investigated`=false, `additional_context`='{}', `retention_expires_at`=now()+2yr. Nullable & useful: `event_type`(text), `tenant_id`(uuid), `resource_type`, `operation`, `ip_address`, `phi_access_log_id`, `audit_log_id`.
- **Column is `event_type`, NOT `anomaly_type`.** `get_uninvestigated_anomalies` (restored `20260604000007`) correctly uses `event_type`. ⚠️ `securityAutomationService.getMetricValue` filters `.eq('anomaly_type', …)` (lines ~362/371) — **latent bug** against a non-existent column (inert today; service is unwired). Fix in GA-5.
- **`get_uninvestigated_anomalies`** live (restored this session). Sibling RPCs `detect_impossible_travel`, `get_user_behavior_baseline`, `mark_anomaly_investigated` live. The dropped `detect_*` PHI/login/privilege functions are NOT referenced by any code (no baseline entry) — they were never rewired.
- **Guardian seam:** `guardian-agent/index.ts` → `runMonitoringChecks(supabase, tenantId)` (line 182) batch-queries `audit_logs`/`system_errors`/`phi_access_logs`/`get_slow_queries`, runs Checks 1–4, batch-inserts `security_alerts` (tenant-scoped, `status:'pending'`, NO PHI in metadata). Check 3 already flags bulk PHI access (`records_accessed > 50`).
- **Eyes↔alert correlation** already exists (`20260529160000_guardian_eyes_alert_correlation`, GRD-6): recordings link to alerts via `security_alert_id`.

## Build plan (piece by piece — commit each working slice)

| # | Item | Layer | Type | Status |
|---|------|-------|------|--------|
| **GA-1** | Guardian **reads** anomaly_detections → security_alerts (new Check 5 in `runMonitoringChecks`) | 2→3 | edge + deploy + live-prove | ✅ 2026-06-05 (live-proven) |
| **GA-2** | Guardian **persists** its server-side PHI-access detection into anomaly_detections (durable, investigable behavioral record from existing `phi_access_logs`) | 1 (server) | edge + deploy + live-prove | ✅ 2026-06-05 (live-proven) |
| **GA-3** | **End-to-end live proof**: synthetic bulk-PHI-access → GA-2 records anomaly → GA-1 raises alert → verify → cleanup | — | live SQL | ✅ 2026-06-05 |
| **GA-4** | **Admin visibility**: surface `get_uninvestigated_anomalies` in a Guardian panel (reachable from real UI) | 3 (UI) | component + route/nav + tests | ⬜ (VISUAL ACCEPTANCE PENDING Maria) |
| **GA-5** | *(future)* full real-time detection suite + fix securityAutomationService `anomaly_type`→`event_type` drift + schedule `checkAllThresholds`/`checkEscalations`; restore dropped detect_* (impossible-travel via `user_geolocation_history`, privilege-escalation, after-hours, failed-login-spike) | 1+2 | larger | ⬜ documented only |

### GA-1 spec — Guardian sees anomalies
Add **Check 5** to `runMonitoringChecks`, parallel-batched with the others:
- Read `anomaly_detections` for the tenant: `investigated=false`, `aggregate_anomaly_score >= 0.5`, `detected_at >= oneHourAgo` (mirror existing window). Select only non-PHI cols (`id, risk_level, event_type, aggregate_anomaly_score`).
- If any: push ONE alert — `severity` from max risk_level (critical/high→that, else medium), `category:'security'`, `title:'Behavioral Anomalies Detected'`, `message:'<n> uninvestigated behavioral anomalies in the last hour'`, `metadata:{ anomaly_count, max_score, risk_levels, event_types }` (**NO PHI** — counts/types/scores only, per the file's existing discipline).
- Acceptance: guardian scan with empty table → no alert, no error; with a synthetic anomaly → exactly one `security_alerts` row, tenant-scoped, no PHI.

### GA-2 spec — Guardian produces durable anomalies
When Check 3 (bulk PHI access) fires, ALSO INSERT one `anomaly_detections` row per offending user:
- `user_id`, `tenant_id`, `event_type:'phi_access'`, `event_timestamp:now`, `aggregate_anomaly_score` = scaled from records_accessed (e.g. `least(1.0, records_accessed/200.0)`), `risk_level` from score (≥0.75 critical / ≥0.5 high / else medium), `anomaly_breakdown:{ excessive_access_score: <score>, records_accessed: <n> }`, `phi_access_log_id` = the source log id. **NO patient identifiers** — only the accessing user_id + counts.
- Idempotency: skip if an uninvestigated `phi_access` anomaly already exists for that `phi_access_log_id` (avoid dupes each cron minute).
- Acceptance: synthetic phi_access_logs row (records_accessed>50) → one anomaly_detections row written by Guardian; re-run → no duplicate.

### GA-3 spec — e2e proof
Insert synthetic `phi_access_logs` (records_accessed=120, test tenant WF-0001, synthetic user) → invoke Guardian scan → assert one `anomaly_detections` row (GA-2) + one `security_alerts` row (GA-1) → delete synthetic rows. All via live SQL/curl; report row evidence.

## Progress log
- **2026-06-05 — GA-1 + GA-2 + GA-3 DONE, live-proven.** Wiring revealed FOUR pre-existing show-stoppers (all verified live, all fixed — none "deleted"):
  1. **`phi_access_logs.records_accessed` never existed** — Check 3 selected it (+ a phantom `accessed_at`), so the query errored and Check 3 had been **dead in production**. Restored the accountability metric via migration `20260605143400` (`records_accessed INTEGER NOT NULL DEFAULT 1`, CHECK ≥0); repointed Check 3's time filter to the real `timestamp` column. (Per Maria: keep the records_accessed accountability concept, add the column — don't switch to event-counting.)
  2. **`anomaly_detections` was un-insertable** — trigger `update_anomaly_retention()` set `NEW.retention_expires_at := NEW.created_at + 2yr`, but the column is `detected_at`. EVERY insert aborted (why the table was always empty). Fixed → `COALESCE(NEW.detected_at, now())` in migration `20260605143500`.
  3. **`create_alert_from_anomaly()` referenced `NEW.anomaly_type`/`risk_score`/`details`** (real cols `event_type`/`aggregate_anomaly_score`/`anomaly_breakdown`) → aborted every HIGH/CRITICAL anomaly insert. Fixed + now propagates `tenant_id` (same migration `20260605143500`).
  4. **Guardian's own alert INSERT had never persisted ANYTHING** — it spread `message` (no such column; it's `description`), omitted required `alert_type`, and used `status:'pending'` (CHECK allows only new/investigating/…). Mapped explicitly (description, status `new`, per-check `alert_type`), and now checks the insert error instead of swallowing it. Added the two missing enum values `database_error`/`slow_query` (migration `20260605143600`) so DB-error and slow-query alerts record their true type.
  - **Live e2e proof (tenant WF-0001):** synthetic `phi_access_logs` row (records_accessed=120) → invoke guardian `monitor` → Check 3 persisted `unusual_phi_access` alert (max_records_accessed=120) + GA-2 wrote one `anomaly_detections` row (HIGH, score 0.60, retention stamped) → DB trigger auto-created the per-anomaly alert (tenant-scoped) → second invoke: Check 5 (GA-1) persisted aggregate `anomalous_behavior` "Behavioral Anomalies Detected" alert (metadata = counts/scores/types, **no PHI**). Idempotency verified (1 anomaly across 3 invokes). Mutable test rows cleaned up; the synthetic `phi_access_logs` row could NOT be deleted (immutable HIPAA audit table — correct) but is labeled `session_id='GA3-LIVE-PROOF'` and self-expires from the 1-hour detection window.
  - Deployed guardian-agent. deno check clean, deno test 11 passed (36 steps), DB-reference + FHIR schema gates green.
  - **Decomposition (the additions pushed `index.ts` 577→701 > the 600 god-file limit):** split into focused modules `types.ts` / `monitoring.ts` (Checks 1-5 + GA-2) / `notifications.ts` / `recordings.ts` / `healing.ts`, with `index.ts` now the slim HTTP entry + action dispatch (120 lines; all modules <600, max 238). Also fixed two pre-existing `select('*')` (§9) the gate flagged in the touched file — `analyzeRecordings` → explicit guardian_eyes_recordings cols, `autoHeal` → explicit security_alerts cols — and dropped an unused `batchQueries` import. **NOTE:** `recordSnapshot`'s critical-event alert insert still has the same message/status:'pending'/missing-alert_type drift as bug #4 (it's the 'record' Guardian-Eyes path, not the monitoring path); needs an alert_type mapping decision — left for a follow-up, documented here, not silently fixed.
- **Findings handed off (NOT in scope here):** (a) guardian-agent cron invocations are failing **403 "Origin not allowed"** — the handler rejects no-/non-allowed-origin callers, so the per-minute cron never actually runs the checks (the only reason the synthetic row isn't spamming alerts). (b) Three `phi_access_logs` writers insert drifted columns (`chwService` → `access_timestamp`; telehealth fns → `access_type`/`resource`/`access_reason`) that don't exist live, so those audit inserts fail. Both are separate pre-existing bugs.

## Out of scope / handoff notes
- GA-5 (full real-time detection + layer-2 scheduling) is the larger follow-on; documented above, not built here.
- GA-4 UI needs Maria's visual acceptance before "done" (visual-acceptance rule).
