# Nurse Handoff & Documentation Build Tracker

> **Last Updated:** 2026-02-23
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

## Foundation — What Already Exists

### Patient Handoff System (Inter-Facility Transfers) — BUILT

| Layer | Status | What Exists |
|-------|--------|-------------|
| Components | BUILT | `src/components/handoff/` — LiteSenderPortal (195), LiteSenderFormSteps (751), LiteSenderConfirmation (63), ReceivingDashboard (650), AdminTransferLogs (846), MedicationReconciliationAlert (267), LabResultVault (233) |
| Services | BUILT | `handoffService.ts` (717) — CRUD, token-based access, file upload/download; `handoffNotificationService.ts` (337) — email/SMS |
| Types | BUILT | `src/types/handoff.ts` (406) — full TypeScript interfaces |
| Database | BUILT | `handoff_packets`, `handoff_attachments`, `handoff_logs`, `handoff_sections`, `handoff_notifications`, `handoff_notification_failures` |
| Security | BUILT | AES-256 encryption, 72hr token expiry, signed URLs (1hr), full RLS, HIPAA audit trail |
| Migrations | BUILT | `20251003190000_patient_handoff_system.sql` + 5 subsequent fixes |

### Shift Handoff Risk Synthesizer (AI) — BUILT

| Layer | Status | What Exists |
|-------|--------|-------------|
| Service | BUILT | `src/services/ai/handoffRiskSynthesizer.ts` (568) — Claude Haiku 4.5, structured output, cost tracking |
| Database | BUILT | `ai_shift_handoff_summaries`, `shift_handoff_events`, `shift_handoff_risk_scores`, `shift_handoff_overrides`, `shift_handoff_override_log` |
| Tests | BUILT | `src/services/ai/__tests__/handoffRiskSynthesizer.test.ts` |
| Avatar Integration | BUILT | `src/components/patient-avatar/utils/shiftHandoffSummary.ts` (293) — marker summaries for visual handoff |

### SmartScribe Nurse Documentation — BUILT

| Layer | Status | What Exists |
|-------|--------|-------------|
| Recording | BUILT | `RealTimeSmartScribe.tsx`, `useSmartScribe.ts`, `scribeRecordingService.ts` — WebSocket + Deepgram |
| Edge Functions | BUILT | `realtime_medical_transcription` (nurse mode validated), `process-medical-transcript` (grounded fallback) |
| Guardrails | BUILT | `NURSE_SCOPE_GUARD` — no billing, no MDM, no dosing; `CONDENSED_GROUNDING_RULES` on all paths |
| SOAP Notes | BUILT | `SOAPNote.tsx` — display/editing |
| Mode Switching | BUILT | `ScribeModeSwitcher.tsx` — smartscribe/compass-riley/consultation |
| Feedback | BUILT | `SessionFeedback.tsx` + `scribeFeedbackService.ts` |

---

# Feature 1 — Shift Handoff Dashboard

> **Problem:** AI-generated shift summaries exist in the database but nurses have no UI to view, manage, or act on them.

## Session 1: Core Dashboard — NOT STARTED

| Feature | Status | What Needs to Be Built |
|---------|--------|------------------------|
| Dashboard component | MISSING | `src/components/admin/ShiftHandoffDashboard.tsx` — list view of AI-generated handoff summaries for current shift |
| Unit filter | MISSING | Filter handoffs by hospital unit (ICU, Med-Surg, ED, etc.) |
| Patient cards | MISSING | Card per patient showing: critical alerts, vitals trends, active meds, pending tasks |
| Risk tier badges | MISSING | Visual severity (critical/high/medium/low) from `shift_handoff_risk_scores` |
| Handoff detail panel | MISSING | Expandable view: full AI summary, data sources, override option |
| Route wiring | MISSING | `/shift-handoff` route in App.tsx with lazy import |
| Tests | MISSING | Dashboard rendering, filter behavior, risk tier display, empty state |

**Data source:** `ai_shift_handoff_summaries` + `shift_handoff_risk_scores` + `shift_handoff_events`

## Session 2: Handoff Workflow — NOT STARTED

| Feature | Status | What Needs to Be Built |
|---------|--------|------------------------|
| Acknowledge handoff | MISSING | Nurse marks each patient as "reviewed" with timestamp |
| Override AI summary | MISSING | Edit/annotate AI-generated summary; logs to `shift_handoff_overrides` |
| Print/export view | MISSING | Print-friendly layout for paper backup |
| Real-time updates | MISSING | Supabase realtime subscription for new summaries during shift change |
| Shift selector | MISSING | Toggle between current/previous/upcoming shifts |
| Tests | MISSING | Acknowledge flow, override audit, print layout |

## Session 3: Integration & Polish — NOT STARTED

| Feature | Status | What Needs to Be Built |
|---------|--------|------------------------|
| Admin section wiring | MISSING | Add to admin dashboard sections with module access check |
| Notification bridge | MISSING | Push notification when new shift summary is generated |
| Avatar integration UI | MISSING | Show patient avatar marker summary inline on handoff cards |
| Audit logging | MISSING | Log all handoff views and acknowledgments via `auditLogger` |
| Demo data | MISSING | Seed data for demo mode |
| Tests | MISSING | Integration tests, audit logging verification |

---

# Feature 2 — Nurse Question Manager Backend

> **Problem:** UI component exists (742 lines in `NurseQuestionManager.tsx`) but runs entirely on mock data. No database tables, no RPC functions, no real backend.

## Session 1: Database & API Foundation — NOT STARTED

| Feature | Status | What Needs to Be Built |
|---------|--------|------------------------|
| `nurse_questions` table | MISSING | Patient questions routed to nurses: question_text, patient_id, status (open/claimed/answered/escalated), priority, category, assigned_nurse_id, tenant_id |
| `nurse_question_answers` table | MISSING | Nurse responses with AI suggestion tracking (used_ai_suggestion boolean) |
| `nurse_question_notes` table | MISSING | Internal nurse notes on questions (not visible to patient) |
| RLS policies | MISSING | Tenant isolation, nurse can only see own unit's questions |
| RPC functions | MISSING | `nurse_open_queue()`, `nurse_claim_question()`, `nurse_my_questions()`, `nurse_submit_answer()`, `nurse_add_note()` |
| Migration file | MISSING | Single migration creating all tables, indexes, RLS, RPCs |
| Tests | MISSING | Service layer tests for queue operations |

## Session 2: Service Layer & UI Wiring — NOT STARTED

| Feature | Status | What Needs to Be Built |
|---------|--------|------------------------|
| `nurseQuestionService.ts` | MISSING | Service using ServiceResult pattern: fetch queue, claim, answer, escalate |
| Replace mock data | MISSING | Wire `NurseQuestionManager.tsx` to real service (remove hardcoded data) |
| `nurseApi.ts` completion | PARTIAL | Currently 50-line stub — needs real Supabase calls |
| AI suggestion integration | MISSING | Wire Claude for answer suggestions (register in `ai_skills`) |
| Queue assignment logic | MISSING | Auto-assign based on unit, specialty, or round-robin |
| Tests | MISSING | Service tests, UI integration tests |

## Session 3: Workflow & Notifications — NOT STARTED

| Feature | Status | What Needs to Be Built |
|---------|--------|------------------------|
| Escalation flow | MISSING | Question unanswered >2hrs auto-escalates to charge nurse |
| Patient notification | MISSING | Notify patient when question is answered (SMS/push) |
| Nurse notification | MISSING | Alert nurse when new question arrives in their queue |
| Analytics | MISSING | Response time metrics, volume by category, AI suggestion acceptance rate |
| Audit logging | MISSING | All question interactions logged via `auditLogger` |
| Tests | MISSING | Escalation timing, notification triggers, analytics queries |

---

## Estimated Effort

| Feature | Sessions | Hours |
|---------|----------|-------|
| Shift Handoff Dashboard (3 sessions) | 3 | ~12-16 |
| Nurse Question Manager Backend (3 sessions) | 3 | ~12-16 |
| **Total** | **6** | **~24-32** |

---

## Dependencies

| Dependency | Status | Impact |
|------------|--------|--------|
| `ai_shift_handoff_summaries` table | BUILT | Dashboard reads from this |
| `shift_handoff_risk_scores` table | BUILT | Risk tier badges |
| SmartScribe nurse guardrails | BUILT | Nurse mode grounding rules (commit `2f9c43b2`) |
| `handoffRiskSynthesizer.ts` | BUILT | Generates the summaries dashboard will display |
| `NurseQuestionManager.tsx` UI | BUILT (mock) | Needs backend wiring, not rewrite |
| Module access system | BUILT | `useModuleAccess('shift_handoff')` |

---

## Notes

- Shift Handoff Dashboard is higher priority — infrastructure already generates data, just needs a UI
- Nurse Question Manager needs full backend build (tables + RPCs + service) before UI can be wired
- Both features serve the nurse persona and reduce documentation burden — core value proposition
- All new code must follow CLAUDE.md rules: no `any`, `auditLogger` only, `unknown` error handling, 600-line max
