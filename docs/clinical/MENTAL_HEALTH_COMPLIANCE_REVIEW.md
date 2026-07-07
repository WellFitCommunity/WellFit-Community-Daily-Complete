# Mental & Behavioral Health — Compliance Review for Akima

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**
> Proprietary and confidential.

**For:** Akima (Chief Compliance & Accountability Officer — MDiv, BSN, RN, CCM)
**From:** Maria (AI System Director) via Claude Code
**Date created:** 2026-07-07
**Purpose:** Behavioral health is governed by laws **stricter than HIPAA**. Before the mental-health module goes into a pilot, several decisions are **yours (clinical + legal), not the engineer's**. This is a plain-English list so you can mark each one **approve / change / hold** without reading code.

**How to use this doc:** For each item below, check one box and add a note. Anything left `☐ HOLD` blocks that piece from going live. Engineering will not close a 🔒 item without your mark.

---

## Background in one paragraph

We built a mental-health intervention system (suicide-risk screening, safety planning, therapy-session tracking, discharge blockers) back in Oct 2025. The database tables are live; the code exists; but the screen is currently **turned off and has no menu link** — no real user can reach it yet. Before we turn it on for a pilot, the items below need your sign-off because they involve **breaking confidentiality, protecting minors, substance-use records, and psychotherapy notes** — all areas where the law is stricter and getting it wrong carries criminal/licensure exposure, not just a HIPAA fine. The full engineering rules are written in `.claude/rules/mental-health.md`; this doc is only the decisions that need a clinician/compliance officer.

---

## The decisions that need your sign-off

### 1. 🔒 42 CFR Part 2 subsystem — four open items
We already built a substance-use-disorder (SUD) confidentiality gate (fail-closed — denies access unless consent is proven). It is built but **not yet wired into any screen**. Four questions remain open from when it was built (2026-06-07):

- **Purpose-scoping** — should a consent authorize *any* disclosure, or only for a specific stated purpose (treatment vs. billing vs. research)?
- **Tenant isolation** — the Part 2 tables need the organization (tenant) stamped on each record so orgs can't see each other's SUD data. Confirm required.
- **Diagnosis auto-trigger** — should the system automatically flag a record as "Part 2 protected" when it sees a SUD diagnosis, or should that be a manual clinician action?
- **UI wiring** — where does the consent prompt appear in the clinician's workflow?

☐ APPROVE as described  ☐ CHANGE (note below)  ☐ HOLD
**Akima note:** _______________________________________________

---

### 2. 🔒 Duty to Warn / Protect (Tarasoff) — must this ever be automated?
When a patient poses an imminent, serious threat to an identifiable third person, the law can **require** us to break confidentiality and warn. Our position in the rules doc is: **this is always clinician-initiated, logged with the legal reason, never automatic.** Confirm that's correct for the pilot, and tell us which state's rule governs (it varies by state).

☐ APPROVE (clinician-initiated only, never automated)  ☐ CHANGE  ☐ HOLD
**Governing state for pilot:** __________  **Akima note:** _______________

---

### 3. 🔒 Mandatory reporting & involuntary hold
Behavioral health triggers duties that general care doesn't: abuse/neglect reporting, and emergency detention / involuntary hold (e.g., Texas Health & Safety Code §573). **Does the pilot need the software to document or support a hold at all?** If yes, it must follow that state's statute exactly and needs your specification. If no, we leave it out.

☐ NOT needed for pilot — leave out  ☐ Needed — Akima to specify  ☐ HOLD
**Akima note:** _______________________________________________

---

### 4. 🔒 Psychotherapy notes — confirm they stay separate & hidden
HIPAA gives the therapist's *process notes* extra protection: they are **excluded** from the patient's records download, and need a **separate** authorization to share. Our rule: psychotherapy-note fields are hidden by default from patient portal, exports, FHIR, and AI summaries. **Does the pilot even capture psychotherapy notes?** If yes, confirm the "separate and hidden by default" handling.

☐ Pilot captures them — handle as separate/hidden (approve)  ☐ Pilot does NOT capture them  ☐ HOLD
**Akima note:** _______________________________________________

---

### 5. 🔒 Minors / adolescent consent
In many states a minor can consent to certain behavioral-health/SUD services on their own, and the **parent/guardian does not automatically get access** to those records. Our caregiver/proxy PIN system must respect that. **For the pilot population — are minors in scope?** If yes, which state's adolescent-consent rule applies?

☐ No minors in pilot — not applicable  ☐ Minors in scope — apply state rule below  ☐ HOLD
**Governing state / rule:** __________  **Akima note:** _______________

---

### 6. 🔒 Approved screening instruments
The build references suicide/depression/anxiety screening (Columbia/C-SSRS-style, PHQ-9, GAD-7) and Stanley-Brown safety planning. **Confirm which instruments are clinically approved for the pilot**, and whether the auto-escalation thresholds (what score triggers STAT psych / 1:1 / discharge block) match your clinical judgment.

☐ APPROVE listed instruments + thresholds  ☐ CHANGE (specify)  ☐ HOLD
**Akima note:** _______________________________________________

---

### 7. 🔒 Break-the-glass for behavioral-health data
Behavioral-health records are extra-sensitive, so we gate them tighter than normal PHI and require an explicit "break-the-glass" (reason captured, logged, notified) for emergency access outside the normal care team. Confirm this is the right posture and who gets notified on each event.

☐ APPROVE  ☐ CHANGE  ☐ HOLD
**Notify on break-the-glass:** __________  **Akima note:** _______________

---

### 8. State jurisdiction & stricter-than-HIPAA law
Some states (e.g., Texas Health & Safety Code §611) impose mental-health confidentiality stricter than HIPAA. **Which state(s) will the pilot operate in?** We gate rules on this and need it confirmed before go-live.

☐ Pilot state(s): __________  ☐ HOLD until determined
**Akima note:** _______________________________________________

---

## Sign-off

By marking the boxes above, you are approving the clinical/compliance posture for the mental-health module. Anything left on HOLD stays out of the pilot until resolved.

**Akima signature / date:** _______________________________________________

**Related:** engineering rules `.claude/rules/mental-health.md` · tracker `docs/trackers/mental-health-suite-tracker.md`
