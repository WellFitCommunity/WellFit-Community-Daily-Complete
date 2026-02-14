# Clinical Safety & Revenue Build Tracker

> **Last Updated:** 2026-02-15
> **Owner:** Maria (AI System Director)
> **Reviewer:** Akima (CCO)

---

## How to Read This

| Symbol | Meaning |
|--------|---------|
| BUILT | Exists in codebase, functional |
| PARTIAL | Infrastructure exists, gaps remain |
| MISSING | Not built yet |

---

# Phase 1 — Clinical Safety

## 1. Core Visit Governance

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Visit state machine (12 states) | BUILT | `encounterStateMachine.ts`, DB migration with 22 valid transitions, immutability trigger on finalized encounters | — |
| Mandatory provider assignment | BUILT | `encounter_providers` table, `assign_encounter_provider()` RPC, validation gate blocks advancement without attending, `ProviderAssignmentDashboard.tsx` admin panel | — |
| Signature enforcement before billable | BUILT | `validate_encounter_notes_signed()` RPC, SHA-256 hash generation, `NoteLockingControls.tsx` | Signature verification UI (service exists, no button to use it) |
| Amendment tracking with audit | BUILT | `clinical_note_amendments` table, `clinical_field_provenance` table, `noteAmendmentService.ts`, `AmendmentWorkflow.tsx` | Amendment approval queue UI (approve/reject works in service, no dashboard) |
| Time-stamped attestation | BUILT | `signed_at`/`signed_by` auto-set on encounter signing, full audit trail in `encounter_status_history` | No provider-role-specific attestation (NP + supervising MD co-sign) |

**Verdict: 95% built.** Core governance is enforced at database level. Provider assignment dashboard complete. Remaining gap: NP + supervising MD co-sign attestation.

---

## 2. Order Lifecycle Control

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Order state machine | BUILT | `lab_orders` (8 states), `imaging_orders` (8 states), `refill_requests` (6 states) in DB | No edge functions to create/manage orders |
| SLA tracking | BUILT | `order_sla_config`, `order_sla_breach_log`, `orderSLAService.ts` (558 lines), default targets seeded | — |
| Abnormal result flagging | PARTIAL | `lab_results.abnormal` boolean, `has_critical_values`, critical thresholds in `labResultVaultService.ts` (creatinine >2.0, potassium 3.0-5.5, etc.) | No escalation rules engine (abnormal troponin doesn't auto-route to cardiology) |
| Unacknowledged result aging dashboard | BUILT | `result_acknowledgments` table, `v_unacknowledged_results` view, `unacknowledgedResultsService.ts`, `UnacknowledgedResultsDashboard.tsx` in admin panel | — |
| Result escalation rules | PARTIAL | SLA breach escalation (levels 0-3) exists for orders | No result-value-based escalation (abnormal lab -> specialist notification) |
| Order transmission status tracking | MISSING | `received_by_lab_at`, `resulted_at` fields exist | No external lab transmission tracking, no X12 997 acknowledgment handling |

**Verdict: 60% built.** Database tables, SLA service, and unacknowledged results dashboard are solid. Missing: escalation rules engine and external lab integration. Healthcare integrations migration exists but is `_SKIP_` (not applied).

---

## 3. Provider Responsibility Routing

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Encounter-level ownership | BUILT | `encounter_providers` with roles (attending, supervising, referring, consulting), audit table | — |
| Inbox routing rules | BUILT | `provider_tasks` table, `v_provider_task_queue` view, `providerTaskService.ts`, `ProviderTaskQueueDashboard.tsx` in admin panel | — |
| Escalation config + manual escalation | BUILT | `provider_task_escalation_config` table (15 default SLA configs), `escalateTask()` service method, escalation_level tracking | Auto-escalation cron (timer-based auto-promote) |
| Coverage logic for absent provider | MISSING | — | No `provider_schedules`, no `on_call_rotations`, no coverage auto-routing |

**Verdict: 60% built.** Provider assignment and task inbox routing are complete. SLA deadlines auto-calculated, manual escalation supported. Missing: auto-escalation cron and coverage/on-call system.

---

## 4. Referral Closed-Loop Tracking

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Referral status states | BUILT | Community referrals (8 states), dental referrals (5 states), AI referral letters (4 states) | States exist but no unified referral lifecycle across systems |
| Aging queue | PARTIAL | `check_referral_alerts()` DB function detects missed check-ins and mood decline | No "referrals pending >7 days" dashboard, no aging bucket UI |
| Follow-up reminders | MISSING | Alert generation exists | No automated reminder scheduler (CRON + SMS/email at N days post-referral) |
| Closed-loop confirmation logging | PARTIAL | `referral_alerts.delivered_at`, `acknowledged_at`, `resolved_at` tracked | No specialist completion confirmation workflow, no "work completed" trigger |

**Verdict: 40% built.** Referral tables and status tracking exist. Missing the closed-loop automation (reminders, specialist confirmation, aging dashboard).

---

## 5. Medication Safety

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Drug-drug interaction engine | BUILT | `drugInteractionService.ts` (397 lines), `check-drug-interactions` edge function (439 lines), RxNorm API, Claude Vision enhancement | — |
| Severity tiers | BUILT | 4 tiers: contraindicated, high, moderate, low. Color-coded in `MedicationManager.tsx` | — |
| Override logging with required reason | MISSING | `ai_contraindication_checks` has `review_notes` (free text) | No mandatory `override_reason_code`, no structured reason codes, no secondary verification |
| Alert suppression audit trail | MISSING | — | No `medication_alert_suppressions` table, no dismissal tracking, no "why was this alert ignored" audit |

**Additional medication infrastructure that exists:**
- Contraindication detector (Skill #25) — Claude Sonnet 4.5, checks disease-drug, allergy cross-reactivity, lab values, age, pregnancy
- Medication reconciliation (Skill #26) — duplicate detection, severity ratings, deprescribing analysis
- Medication tracking service (917 lines) — CRUD, reminders, dose tracking, adherence stats
- AI medication instructions — 6th-grade reading level, personalized
- Medication label reader — Claude Vision OCR

**Verdict: 70% built.** Core interaction engine and severity classification are production-ready. Missing override/suppression audit trail (compliance risk).

---

## 6. Clinical Audit UI

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Human-readable encounter audit view | PARTIAL | `TenantAuditLogs.tsx` (355 lines) — category/severity/date filtering, search, CSV export. `AuditAnalyticsDashboard.tsx` (539 lines) — stats cards, category breakdown, search | No encounter-specific audit view ("show all events for this encounter") |
| Role-filtered logs | PARTIAL | Filter by category, severity, date, actor_user_id | No "filter by role" dropdown (nurse, provider, admin) |
| Tamper-evident tracking | BUILT | SHA-256 signature hashing, `clinical_field_provenance` table (field-level change tracking), `clinical_note_lock_audit` table, `verifySignature()` service | No visualization of field change history (timeline/diff view) |

**Additional audit infrastructure:**
- `auditLogger.ts` (298 lines) — 8 categories, HIPAA-compliant
- `phiAccessLogger.ts` (202 lines) — PHI type tracking, access methods, purpose
- `SOC2AuditDashboard.tsx` (481 lines) — compliance scoring, control status, PHI access trail with risk levels
- `soc2MonitoringService.ts` — security metrics, compliance status

**Verdict: 75% built.** Strong audit infrastructure. Missing encounter-level audit views and role-based filtering.

---

# Phase 2 — Revenue

## 7. Superbill Engine

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| CPT mapping | BUILT | `code_cpt` table, fee schedule lookup in `billingService.ts` | — |
| ICD-10 linking | BUILT | `code_icd10` table, `encounter_diagnoses` with sequence ordering | — |
| Modifier suggestions | BUILT | `code_modifiers` table, Modifier 25 logic in `billingOptimizationEngineService.ts` | — |
| E/M level suggestion (2021 rules) | BUILT | `emEvaluationNode.ts`, time-based + MDM-based coding, `CodingSuggestionPanel.tsx` | — |
| Provider confirmation required | MISSING | `billingGateService.ts` enforces signed clinical notes | No superbill approval workflow, no `provider_approved_by` field on claims |

**Verdict: 80% built.** Coding engine is complete. Missing the provider sign-off gate on superbills.

---

## 8. Eligibility Integration

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| 270/271 pre-check | BUILT | `mcp-clearinghouse-server` has `verify_eligibility` tool with full request/response types | Never called in encounter workflow |
| Coverage status flag | MISSING | — | No `coverage_verified_at` field on encounters, no pre-visit check |
| Copay estimate logic | MISSING | Eligibility response includes copay data | No calculation or display of patient cost at time of service |
| Insurance verification indicator | MISSING | — | No UI indicator, no verification expiry logic |

**Verdict: 25% built.** The API interface exists but isn't wired into the workflow.

---

## 9. Claim Pipeline

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| 837P generation | BUILT | `generate-837p` edge function (529 lines), full X12 EDI compliance | No 837I (institutional claims) |
| Claim status tracker | BUILT | `claims` + `claim_status_history` tables, `updateClaimStatus()` in `billingService.ts` | — |
| Rejection queue | BUILT | `claim_denials` table, `get_rejection_reasons()` with remediation guidance | No resubmission workflow (fix denied claim and resubmit) |
| ERA ingestion scaffold | PARTIAL | `remittances` table, `process_remittance()` parses 835 content | No ERA-to-claim matching, no payment posting, no reconciliation |

**Verdict: 60% built.** Generation and tracking work. Missing payment posting and resubmission workflows.

---

## 10. Revenue Intelligence

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Undercoding detection | MISSING | `coding_recommendations` table stores AI suggestions | No comparison of suggested vs billed codes |
| Documentation gap indicator | MISSING | — | No algorithm flagging missing elements for E/M level |
| HCC opportunity flag | MISSING | — | No HCC reference set, no risk adjustment detection |
| Claim aging dashboard | MISSING | `claims` table has timestamps | No aging bucket visualization (0-30, 31-60, 61-90, 90+) |

**Verdict: 0% built.** Database foundation exists. No intelligence layer on top.

---

# Overall Summary

| Category | Built | Status |
|----------|-------|--------|
| 1. Core Visit Governance | 95% | DB-enforced, provider assignment dashboard complete, NP co-sign attestation remaining |
| 2. Order Lifecycle Control | 50% | Tables + SLA service done, needs UI + external integration |
| 3. Provider Responsibility Routing | 60% | Assignment + task inbox + SLA config built, auto-escalation cron + coverage missing |
| 4. Referral Closed-Loop Tracking | 40% | Status tracking exists, automation missing |
| 5. Medication Safety | 70% | Interaction engine production-ready, override audit missing |
| 6. Clinical Audit UI | 75% | Strong infrastructure, needs encounter-level views |
| **Phase 1 Average** | **~60%** | |
| 7. Superbill Engine | 80% | Coding complete, provider sign-off missing |
| 8. Eligibility Integration | 25% | API exists, not wired in |
| 9. Claim Pipeline | 60% | Generation works, payment posting missing |
| 10. Revenue Intelligence | 0% | Not started |
| **Phase 2 Average** | **~41%** | |

---

# Build Priority (What to Build Next)

## Phase 1 — Highest Impact First

| Priority | Item | Why First | Estimated Effort |
|----------|------|-----------|-----------------|
| ~~P1~~ | ~~Provider assignment UI component~~ | **DONE** — `ProviderAssignmentDashboard.tsx` | ~~Small~~ |
| ~~P2~~ | ~~Unacknowledged results dashboard~~ | **DONE** — `UnacknowledgedResultsDashboard.tsx` | ~~Small~~ |
| ~~P3~~ | ~~Provider inbox / task routing~~ | **DONE** — `ProviderTaskQueueDashboard.tsx`, `providerTaskService.ts`, SLA config | ~~Large~~ |
| P4 | Override logging + reason codes for medication alerts | Compliance gap | Medium |
| P5 | Referral follow-up reminder scheduler | Closes the referral loop | Medium |
| P6 | Encounter-level audit view | Clinical compliance | Small |
| P7 | Result escalation rules engine | Routes abnormal values to specialists | Medium |
| P8 | Provider coverage/on-call system | Enterprise readiness | Large |

## Phase 2 — Highest Impact First

| Priority | Item | Why First | Estimated Effort |
|----------|------|-----------|-----------------|
| P1 | Superbill provider sign-off gate | Compliance — can't bill unsigned superbills | Small |
| P2 | Eligibility verification in encounter workflow | Prevents denied claims | Medium |
| P3 | Claim aging dashboard | Quick win — data already exists | Small |
| P4 | Undercoding detection | Quick win — compare suggested vs billed | Small |
| P5 | ERA-to-claim matching + payment posting | Closes the revenue loop | Large |
| P6 | Claim resubmission workflow | Fix and resubmit denials | Medium |
| P7 | Documentation gap indicator | Revenue optimization | Medium |
| P8 | HCC opportunity flags | Future — needs reference data | Large |
