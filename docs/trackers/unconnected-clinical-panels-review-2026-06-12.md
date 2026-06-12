# Unconnected Clinical Panels — Review & Approval

**Date:** 2026-06-12
**For:** Maria (product) + Akima (clinical / compliance) review
**Prepared by:** Claude (Opus 4.8)

---

## What this is

While connecting the admin dashboards, we found **7 features that were fully built but never wired into the app** — a real user has no way to reach them today. They are NOT broken; they were just never given a "home screen."

Unlike the admin dashboards (which we connected mechanically), these 7 are **clinical/workflow panels**. Each one needs to live *inside* a specific workflow and be handed the right context (which patient, which encounter, which discharge). Connecting them is a real feature decision — **where it goes, who can use it, and (for the clinical ones) whether the workflow is clinically correct** — not a copy-paste.

**This document describes each one in plain English so you two can decide what to approve.** Nothing below has been wired yet (except the one non-clinical item already done — see the end).

**How to use it:** for each panel, read *What it is* and *What we'd add*, then check the box in the **Decision** line (approve / change / hold). Anything marked 🩺 needs Akima's clinical sign-off; anything marked 🔒 has a privacy/compliance angle.

---

## Summary

| # | Panel | What it does (1 line) | Home it needs | Who decides |
|---|-------|----------------------|---------------|-------------|
| 1 | Family Emergency Info | Let caregivers view/update a senior's emergency info | Senior view page (after caregiver PIN login) | Maria + 🔒 Akima |
| 2 | Stroke Assessment (NIHSS) | ER stroke scoring tool + tPA timing | Neuro Suite hub (feature-flagged) | 🩺 Akima |
| 3 | Readmission Risk | AI 30-day readmission risk at discharge | Discharge planning workflow | 🩺 Akima |
| 4 | SDOH Passive Detection | Review social-needs signals found in patient messages | Patient chart | 🩺 + 🔒 Akima |
| 5 | Billing Code Suggestion | AI-suggested billing codes for an encounter | Encounter / billing review screen | Maria + 🩺 Akima |
| 6 | Coding Suggestion (Atlus) | Live coding + revenue opportunities alongside the AI scribe | Wherever SmartScribe runs | Maria + 🩺 Akima |
| 7 | Bed Status Quick Panel | One-tap bedside bed-status updates for nurses | Nurse / bed-board screen | Maria (low risk) |

---

## 1. Family Emergency Info Panel

**What it is.** A panel that lets a family member or caregiver **view and update the senior's emergency information** — emergency contacts, key medical info, and entry instructions used during welfare checks. (It wraps an existing emergency-info form.)

**What it does today.** Built and working, but not shown on any screen. It needs to be told which senior it's for (patient ID + name).

**Where it should live.** The **Senior View page** a caregiver lands on after entering the senior's phone + PIN. That page already shows the senior's name and a *read-only* "Emergency Contact" box (just a phone number, tap-to-call).

**What we'd add / decide.**
- Replace the simple read-only emergency box with this fuller **view + edit** panel — or keep both? (Recommend: replace, so there's one source of truth.)
- 🔒 **Should caregivers be allowed to *edit* emergency info, or only view it?** This is a permissions/compliance call (it changes the senior's stored info, and entry instructions are shared with constables during welfare checks).

**Decision:** ☐ approve as-is ☐ view-only (no edit) ☐ change ☐ hold

---

## 2. Stroke Assessment (NIHSS)

**What it is.** A bedside/ER **NIH Stroke Scale tool** — score the 15 NIHSS items (total 0–42), track **tPA eligibility** (the <4.5-hour treatment window), door-to-needle timing, baseline-vs-discharge scores, and stroke-type classification. It saves each assessment.

**What it does today.** Built, but hidden behind the **Neuro Suite feature flag** and not opened from anywhere. It needs a patient (and optionally the encounter).

**Where it should live.** The **Neuro Suite hub** (already a real screen when the neuro flag is on) has a "Stroke" tab that lists active stroke patients. Clicking a patient *selects* them but doesn't open this scoring tool.

**What we'd add / decide.**
- Add a **"select stroke patient → open NIHSS assessment"** step in the Neuro Suite stroke tab.
- Confirm the **Neuro Suite feature flag should be ON** for the pilot.
- 🩺 **Akima: confirm the NIHSS items, scoring, and tPA-window logic are clinically correct** before it touches a real stroke workflow.

**Decision:** ☐ approve & turn on neuro flag ☐ approve but keep flag off for now ☐ change ☐ hold for clinical review

---

## 3. Readmission Risk Panel

**What it is.** Shown at discharge: the patient's **AI-predicted 30-day readmission risk**, the **risk factors** and **protective factors** found, **recommended interventions**, and the data it analyzed (prior readmissions, social needs, check-in patterns, medication adherence, care-plan adherence). It has buttons to **create a care plan** and **schedule a follow-up**.

**What it does today.** Built, not shown. It needs a *specific prediction record* to display (one row from the readmission-prediction table).

**Where it should live.** The **discharge planning** workflow.

**What we'd add / decide.**
- The discharge screen currently knows the patient and a rough risk *category*, but **not the specific prediction record** this panel needs. We'd add logic to find the patient's latest prediction (and decide whether to **generate one on the spot if none exists** — that has a small AI cost per run).
- 🩺 **Akima: confirm the risk factors / interventions shown are appropriate to surface to staff at discharge.**

**Decision:** ☐ approve (auto-generate if missing) ☐ approve (only show if a prediction already exists) ☐ change ☐ hold

---

## 4. SDOH Passive Detection Panel

**What it is.** Shows **social-determinants-of-health signals automatically detected from the patient's communications** (e.g., hints of food insecurity, housing trouble, transportation barriers) for a clinician to **review and validate**. Staff can scan recent communications, **accept** a signal into a structured SDOH record, or **dismiss** it with a note.

**What it does today.** Built, not shown. It needs a patient.

**Where it should live.** The **patient chart** (which already shows an SDOH status bar), as a "review detected social needs" section.

**What we'd add / decide.**
- Add it as an SDOH review section/tab on the patient chart.
- 🔒 **It scans patient communications** — confirm that's within consent/privacy policy and who is allowed to see/validate the signals.
- 🩺 **Akima: confirm the review-and-validate workflow** (accepting a signal creates a clinical SDOH record).

**Decision:** ☐ approve ☐ approve with role limits ☐ change ☐ hold for privacy review

---

## 5. Billing Code Suggestion Panel

**What it is.** For one encounter, shows **AI-suggested billing codes** — CPT, HCPCS, and ICD-10 diagnosis codes — each with a **confidence level**, plus summary counts (total codes, high-confidence, average confidence, how many need review). The provider can **accept, modify, or reject** each suggestion.

**What it does today.** Built, not shown. It needs an encounter.

**Where it should live.** An **encounter / billing / superbill review** screen (a screen where someone reviews charges for a visit).

**What we'd add / decide.**
- **Pick the host screen.** There's an "encounter provider" panel that has the right encounter context, but it's about *providers*, not billing — these codes likely belong on a **billing/charge-review** screen instead. Maria/Akima: which screen?
- Wire **accept / modify / reject** to actually save the decision.
- 🩺 **Compliance note:** suggesting codes must not encourage upcoding — Akima should confirm the review framing.

**Decision:** ☐ approve on billing-review screen ☐ approve on encounter screen ☐ change ☐ hold

---

## 6. Coding Suggestion Panel (Project Atlus)

**What it is.** A **live coding panel that wraps the AI scribe (SmartScribe)** and shows **revenue-optimization opportunities** and **projected revenue** from the suggested codes (it reads coding recommendations and the fee schedule).

**What it does today.** Built, not shown. It's a *wrapper* — it's designed to surround the scribe screen and add a revenue/coding sidebar.

**Where it should live.** Wherever **SmartScribe** runs (the documentation/scribe workflow).

**What we'd add / decide.**
- Decide whether to **wrap the existing SmartScribe screen** with this revenue/coding sidebar.
- 🩺 **Compliance note (same as #5):** showing "projected revenue" next to clinical coding needs Akima's eyes so it informs accurate coding rather than incentivizing upcoding.

**Decision:** ☐ approve ☐ approve without the revenue figure ☐ change ☐ hold

---

## 7. Bed Status Quick Panel

**What it is.** A **nurse bedside tool** for **one-tap bed-status changes** (Available, Dirty, Blocked, Cleaning), built for tablets with large touch targets, optional voice commands and swipe gestures, and friendly confirmation messages. It reads and updates the bed board.

**What it does today.** Built, not shown. It works with or without a specific unit filter.

**Where it should live.** The **nurse dashboard** or **bed-board / command-center** screen.

**What we'd add / decide.**
- Pick the nurse screen to embed it on; decide whether **voice and swipe** are on by default.
- Lowest risk of the seven — operational only, no patient health data beyond bed status.

**Decision:** ☐ approve ☐ change ☐ hold

---

## Already done (no approval needed)

- **Hospital Adapter Management Panel** — an admin tool for managing hospital EHR connections. It had no clinical content and an obvious home, so it's **already wired** into the Interoperability screen as a new "EHR Adapters" tab (committed `fbcc523f`).

---

## Approval checklist

- [ ] **Maria:** confirm each panel's home screen (rows 1, 5, 6, 7) and the Neuro Suite flag (row 2)
- [ ] **Akima:** clinical sign-off on rows 2, 3, 4, 5, 6 (🩺)
- [ ] **Akima/compliance:** privacy sign-off on rows 1, 4 (🔒) and the coding/revenue framing on 5, 6
- [ ] Once approved, each panel is wired in its own small change (with a screenshot for visual acceptance), one at a time

> Note on effort: rows 1, 2, 4 live in large existing screens (600+ lines) that we'd tidy as we add to them; row 3 needs a little extra logic to find the right prediction record. None are big builds — the gate is the **decisions above**, not the engineering.
