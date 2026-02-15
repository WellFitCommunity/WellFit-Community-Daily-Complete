# Clinical Safety & Revenue Build Tracker

> **Last Updated:** 2026-02-16
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
| Abnormal result flagging | BUILT | `lab_results.abnormal` boolean, `has_critical_values`, critical thresholds in `labResultVaultService.ts` (creatinine >2.0, potassium 3.0-5.5, etc.) | — |
| Unacknowledged result aging dashboard | BUILT | `result_acknowledgments` table, `v_unacknowledged_results` view, `unacknowledgedResultsService.ts`, `UnacknowledgedResultsDashboard.tsx` in admin panel | — |
| Result escalation rules | BUILT | `result_escalation_rules` table (configurable per test/severity/specialty), `result_escalation_log` immutable audit, `resultEscalationService.ts` (587 lines) — auto-creates provider tasks via `providerTaskService`, severity→priority mapping (critical=stat, high=urgent), 7 seed rules (troponin, creatinine, potassium, glucose, hemoglobin, INR), `ResultEscalationDashboard.tsx` in admin panel, `v_active_escalation_rules` view | — |
| Order transmission status tracking | MISSING | `received_by_lab_at`, `resulted_at` fields exist | No external lab transmission tracking, no X12 997 acknowledgment handling |

**Verdict: 75% built.** Database tables, SLA service, unacknowledged results dashboard, and result escalation rules engine are solid. Missing: external lab integration. Healthcare integrations migration exists but is `_SKIP_` (not applied).

---

## 3. Provider Responsibility Routing

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Encounter-level ownership | BUILT | `encounter_providers` with roles (attending, supervising, referring, consulting), audit table | — |
| Inbox routing rules | BUILT | `provider_tasks` table, `v_provider_task_queue` view, `providerTaskService.ts`, `ProviderTaskQueueDashboard.tsx` in admin panel | — |
| Escalation config + manual escalation | BUILT | `provider_task_escalation_config` table (15 default SLA configs), `escalateTask()` service method, escalation_level tracking | Auto-escalation cron (timer-based auto-promote) |
| Coverage logic for absent provider | BUILT | `provider_on_call_schedules` table (rotation by provider/date/shift), `provider_coverage_assignments` table (coverage routing with priority chain), `provider_coverage_audit` immutable audit table, `get_coverage_provider()` RPC, `providerCoverageService.ts` (446 lines) — CRUD for schedules + assignments, coverage lookup, metrics, `ProviderCoverageDashboard.tsx` in admin panel, `v_provider_coverage_summary` view with computed status | — |

**Verdict: 85% built.** Provider assignment, task inbox routing, and coverage/on-call system are complete. SLA deadlines auto-calculated, manual escalation supported, coverage auto-routing built. Missing: auto-escalation cron.

---

## 4. Referral Closed-Loop Tracking

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Referral status states | BUILT | Community referrals (8 states), dental referrals (5 states), AI referral letters (4 states) | States exist but no unified referral lifecycle across systems |
| Aging queue | BUILT | `ReferralAgingDashboard.tsx` (449 lines) — color-coded aging buckets (0-3d green, 4-7d yellow, 8-14d orange, 14+d red), manual send, history modal, per-tenant config | — |
| Follow-up reminders | BUILT | `referralFollowUpService.ts` (301 lines), `send-referral-followup-reminders` edge function (445 lines) — graduated SMS/email/escalation at day 3/7/14 with cooldown, `referral_followup_config` + `referral_followup_log` tables | — |
| Closed-loop confirmation logging | PARTIAL | `referral_alerts.delivered_at`, `acknowledged_at`, `resolved_at` tracked | No specialist completion confirmation workflow, no "work completed" trigger |

**Verdict: 75% built.** Aging dashboard and automated follow-up reminders are production-ready. Remaining gap: specialist completion confirmation workflow.

---

## 5. Medication Safety

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Drug-drug interaction engine | BUILT | `drugInteractionService.ts` (397 lines), `check-drug-interactions` edge function (439 lines), RxNorm API, Claude Vision enhancement | — |
| Severity tiers | BUILT | 4 tiers: contraindicated, high, moderate, low. Color-coded in `MedicationManager.tsx` | — |
| Override logging with required reason | BUILT | `medication_alert_overrides` immutable audit table (7 reason codes), `medicationOverrideService.ts`, `MedicationAlertOverrideModal.tsx` with 20-char min explanation + provider signature, weekly count escalation (3+ triggers manager notification), manager review workflow | — |
| Alert suppression audit trail | BUILT | `medication_alert_overrides` tracks every override with reason code, explanation, provider signature, severity, check_id FK, `get_flagged_override_providers()` RPC | — |

**Additional medication infrastructure that exists:**
- Contraindication detector (Skill #25) — Claude Sonnet 4.5, checks disease-drug, allergy cross-reactivity, lab values, age, pregnancy
- Medication reconciliation (Skill #26) — duplicate detection, severity ratings, deprescribing analysis
- Medication tracking service (917 lines) — CRUD, reminders, dose tracking, adherence stats
- AI medication instructions — 6th-grade reading level, personalized
- Medication label reader — Claude Vision OCR

**Verdict: 95% built.** Core interaction engine, severity classification, and override/suppression audit trail are production-ready. 7 structured reason codes, immutable audit, escalation tracking, manager review workflow.

---

## 6. Clinical Audit UI

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Human-readable encounter audit view | BUILT | `EncounterAuditTimeline.tsx` (440 lines) — 5-source timeline merge (status changes, field edits, amendments, lock actions, audit logs), source/severity filters, expand/collapse details, CSV/JSON export. `encounterAuditService.ts` (383 lines) | — |
| Role-filtered logs | PARTIAL | Filter by category, severity, date, actor_user_id | No "filter by role" dropdown (nurse, provider, admin) |
| Tamper-evident tracking | BUILT | SHA-256 signature hashing, `clinical_field_provenance` table (field-level change tracking), `clinical_note_lock_audit` table, `verifySignature()` service | No visualization of field change history (timeline/diff view) |

**Additional audit infrastructure:**
- `auditLogger.ts` (298 lines) — 8 categories, HIPAA-compliant
- `phiAccessLogger.ts` (202 lines) — PHI type tracking, access methods, purpose
- `SOC2AuditDashboard.tsx` (481 lines) — compliance scoring, control status, PHI access trail with risk levels
- `soc2MonitoringService.ts` — security metrics, compliance status

**Verdict: 85% built.** Encounter-level audit timeline complete with 5-source merge. Remaining gap: role-based log filtering.

---

# Phase 2 — Revenue

## 7. Superbill Engine

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| CPT mapping | BUILT | `code_cpt` table, fee schedule lookup in `billingService.ts` | — |
| ICD-10 linking | BUILT | `code_icd10` table, `encounter_diagnoses` with sequence ordering | — |
| Modifier suggestions | BUILT | `code_modifiers` table, Modifier 25 logic in `billingOptimizationEngineService.ts` | — |
| E/M level suggestion (2021 rules) | BUILT | `emEvaluationNode.ts`, time-based + MDM-based coding, `CodingSuggestionPanel.tsx` | — |
| Provider confirmation required | BUILT | `SuperbillReviewPanel.tsx` (admin panel), `approve_superbill()`/`reject_superbill()` RPC, `trg_enforce_superbill_approval` trigger blocks submission without approval, `validateSuperbillApproved()` gate, electronic signature + certification checkbox | — |

**Verdict: 95% built.** Coding engine and provider sign-off gate are complete. Defense-in-depth: DB trigger + service gate + UI enforcement.

---

## 8. Eligibility Integration

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| 270/271 pre-check | BUILT | `mcp-clearinghouse-server` has `verify_eligibility` tool with full request/response types, `eligibilityVerificationService.ts` (360 lines) calls clearinghouse and stores results on encounter | — |
| Coverage status flag | BUILT | `coverage_status`, `coverage_verified_at`, `coverage_details` (JSONB) columns on `encounters` table (migration `20260217100000`), 5 statuses: unverified/active/inactive/expired/error | — |
| Copay estimate logic | BUILT | `CoverageDetails` interface includes copay, coinsurance_percent, deductible_remaining, out_of_pocket_remaining. Displayed in expandable `CoverageDetailsPanel` per encounter row | No automated cost-at-time-of-service calculation |
| Insurance verification indicator | BUILT | `EligibilityVerificationPanel.tsx` (404 lines) in admin panel — 4 stat cards, coverage status badges with icons, status/patient filters, one-click verify/re-verify, expandable coverage details | No verification expiry logic (auto re-check after N days) |

**Additional infrastructure built:**
- `BillingQueueDashboard.tsx` (351 lines) — encounter→superbill bridge with one-click superbill generation, 5 stat cards, status/patient filters
- `encounterBillingBridgeService.ts` (506 lines) — full encounter→superbill pipeline: billing queue retrieval, superbill draft generation from diagnoses+procedures, submit for review, link to claim
- `encounter_superbills` table (migration `20260217000000`) with FK to encounters + claims, status lifecycle (draft→pending_review→approved→claimed), immutability trigger on approved superbills
- `revenueSections.tsx` (189 lines) — revenue section definitions extracted from sectionDefinitions.tsx for 600-line compliance

**Verdict: 80% built.** Eligibility verification wired into encounter workflow with full UI. Billing queue bridge complete. Remaining: verification expiry auto-check, automated patient cost estimate at time of service.

---

## 9. Claim Pipeline

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| 837P generation | BUILT | `generate-837p` edge function (529 lines), full X12 EDI compliance | No 837I (institutional claims) |
| Claim status tracker | BUILT | `claims` + `claim_status_history` tables, `updateClaimStatus()` in `billingService.ts` | — |
| Rejection queue | BUILT | `claim_denials` table, `get_rejection_reasons()` with remediation guidance | No resubmission workflow (fix denied claim and resubmit) |
| ERA ingestion scaffold | BUILT | `remittances` table, `process_remittance()` parses 835 content, `eraPaymentPostingService.ts` (451 lines) — unposted remittance retrieval, ERA-to-claim matching, payment posting with status transition, reconciliation stats. `claim_payments` table (migration `20260217200000`) with match confidence, adjustment reason codes, check number, payer claim number | No automated matching algorithm (manual match only), no bulk posting |
| ERA payment posting UI | BUILT | `ERAPaymentPostingDashboard.tsx` (367 lines) in admin panel — 4 stat cards (total posted, paid amount, adjustments, patient responsibility), unposted remittance table, claim matching modal with Post button, posted-today summary, refresh | — |

**Verdict: 80% built.** Generation, tracking, ERA-to-claim matching, and payment posting all work. Remaining: automated matching algorithm, bulk posting, resubmission workflow.

---

## 10. Revenue Intelligence

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| Undercoding detection | BUILT | `undercodingDetectionService.ts` (456 lines) — compares `encounter_billing_suggestions.suggested_codes` vs `claim_lines.procedure_code`, classifies gaps (lower E/M level, missed charge, lower value code), revenue gap calculation, dismiss workflow. `UndercodingDetectionDashboard.tsx` (439 lines) in admin panel — 4 metric cards, confidence filters, gap type badges, dismiss modal | — |
| Documentation gap indicator | MISSING | — | No algorithm flagging missing elements for E/M level |
| HCC opportunity flag | MISSING | — | No HCC reference set, no risk adjustment detection |
| Claim aging dashboard | BUILT | `claimAgingService.ts` (275 lines) — queries `claims` LEFT JOIN `billing_payers`, aging buckets (0-30, 31-60, 61-90, 90+), status history. `ClaimAgingDashboard.tsx` (453 lines) in admin panel — 4 bucket metric cards, alert banner for 90+ days, status/payer filters, history modal | — |

**Verdict: 50% built.** Claim aging dashboard and undercoding detection are production-ready. Remaining: documentation gap indicator and HCC opportunity flags.

---

# Overall Summary

| Category | Built | Status |
|----------|-------|--------|
| 1. Core Visit Governance | 95% | DB-enforced, provider assignment dashboard complete, NP co-sign attestation remaining |
| 2. Order Lifecycle Control | 75% | Tables + SLA service + escalation rules engine done, needs external lab integration |
| 3. Provider Responsibility Routing | 85% | Assignment + task inbox + SLA config + coverage/on-call built, auto-escalation cron missing |
| 4. Referral Closed-Loop Tracking | 75% | Aging dashboard + automated follow-up reminders built, specialist confirmation remaining |
| 5. Medication Safety | 95% | Interaction engine + override audit trail + escalation tracking complete |
| 6. Clinical Audit UI | 85% | Encounter-level audit timeline complete, role-based filtering remaining |
| **Phase 1 Average** | **~86%** | |
| 7. Superbill Engine | 95% | Coding + provider sign-off gate + encounter→superbill bridge complete |
| 8. Eligibility Integration | 80% | X12 270/271 wired into encounter workflow, coverage details UI, billing queue bridge |
| 9. Claim Pipeline | 80% | Generation + tracking + ERA payment posting + claim matching complete |
| 10. Revenue Intelligence | 50% | Claim aging + undercoding detection built, documentation gap + HCC remaining |
| **Phase 2 Average** | **~76%** | |

---

# Build Priority (What to Build Next)

## Phase 1 — Highest Impact First

| Priority | Item | Why First | Estimated Effort |
|----------|------|-----------|-----------------|
| ~~P1~~ | ~~Provider assignment UI component~~ | **DONE** — `ProviderAssignmentDashboard.tsx` | ~~Small~~ |
| ~~P2~~ | ~~Unacknowledged results dashboard~~ | **DONE** — `UnacknowledgedResultsDashboard.tsx` | ~~Small~~ |
| ~~P3~~ | ~~Provider inbox / task routing~~ | **DONE** — `ProviderTaskQueueDashboard.tsx`, `providerTaskService.ts`, SLA config | ~~Large~~ |
| ~~P4~~ | ~~Override logging + reason codes for medication alerts~~ | **DONE** — `medication_alert_overrides` table, `medicationOverrideService.ts`, `MedicationAlertOverrideModal.tsx`, escalation tracking | ~~Medium~~ |
| ~~P5~~ | ~~Referral follow-up reminder scheduler~~ | **DONE** — `referralFollowUpService.ts`, `send-referral-followup-reminders` edge function, `ReferralAgingDashboard.tsx`, graduated day 3/7/14 reminders | ~~Medium~~ |
| ~~P6~~ | ~~Encounter-level audit view~~ | **DONE** — `EncounterAuditTimeline.tsx`, `encounterAuditService.ts`, 5-source timeline merge with filters + export | ~~Small~~ |
| ~~P7~~ | ~~Result escalation rules engine~~ | **DONE** — `result_escalation_rules` + `result_escalation_log` tables, `resultEscalationService.ts`, `ResultEscalationDashboard.tsx`, 7 seed rules, auto-creates provider tasks, severity→priority mapping | ~~Medium~~ |
| ~~P8~~ | ~~Provider coverage/on-call system~~ | **DONE** — `provider_on_call_schedules` + `provider_coverage_assignments` + `provider_coverage_audit` tables, `get_coverage_provider()` RPC, `providerCoverageService.ts`, `ProviderCoverageDashboard.tsx` | ~~Large~~ |

## Phase 2 — Highest Impact First

| Priority | Item | Why First | Estimated Effort |
|----------|------|-----------|-----------------|
| ~~P1~~ | ~~Superbill provider sign-off gate~~ | **DONE** — `SuperbillReviewPanel.tsx`, `approve_superbill()`/`reject_superbill()` RPC, DB trigger enforcement | ~~Small~~ |
| ~~P2~~ | ~~Eligibility verification in encounter workflow~~ | **DONE** — `eligibilityVerificationService.ts`, `EligibilityVerificationPanel.tsx`, `BillingQueueDashboard.tsx`, `encounterBillingBridgeService.ts`, `encounter_superbills` table, coverage fields on encounters, 3 DB migrations, 83 tests | ~~Medium~~ |
| ~~P3~~ | ~~Claim aging dashboard~~ | **DONE** — `claimAgingService.ts`, `ClaimAgingDashboard.tsx`, aging buckets 0-30/31-60/61-90/90+, status/payer filters, history modal | ~~Small~~ |
| ~~P4~~ | ~~Undercoding detection~~ | **DONE** — `undercodingDetectionService.ts`, `UndercodingDetectionDashboard.tsx`, AI-suggested vs billed code comparison, gap classification, revenue opportunity metrics, dismiss workflow | ~~Small~~ |
| ~~P5~~ | ~~ERA-to-claim matching + payment posting~~ | **DONE** — `eraPaymentPostingService.ts`, `ERAPaymentPostingDashboard.tsx`, `claim_payments` table, remittance-to-claim matching modal, payment posting with status transition, reconciliation stats | ~~Large~~ |
| P6 | Claim resubmission workflow | Fix and resubmit denials | Medium |
| P7 | Documentation gap indicator | Revenue optimization | Medium |
| P8 | HCC opportunity flags | Future — needs reference data | Large |
