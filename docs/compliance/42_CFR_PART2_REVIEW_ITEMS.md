---
owner: Compliance
last_updated: 2026-06-07
review_status: needs-review
---

# 42 CFR Part 2 Sensitive-Data Subsystem — Compliance Decisions for Review

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**
> Proprietary and confidential.

**For:** Akima — Chief Compliance and Accountability Officer
**Date:** 2026-06-07
**Status:** Subsystem rebuilt and live, shipped with conservative fail-closed defaults. Four decisions below need your sign-off before this is wired into any clinical workflow.

---

## Background (one paragraph)

The 42 CFR Part 2 subsystem protects substance-use-disorder (SUD) and mental-health records — consent tracking, disclosure logging, and FHIR redaction. It had been silently non-functional since December 2025 (a migration deleted its own tables and functions in the same run). It has now been rebuilt correctly and proven to **fail closed** (deny access unless a valid patient authorization exists). It is currently **built but not connected** to any screen, so nothing is exposed today. Before it goes live, four policy choices are yours to confirm. For each, the safe default is already in place; the question is whether that default matches our compliance posture.

---

## Decision 1 — Should consent be purpose-specific?

**What it is.** When a clinician tries to view a patient's protected SUD/MH record, the system checks whether the patient signed an authorization covering that *category* (e.g., "substance use disorder"). It does **not** currently also check the *purpose* of the access (treatment vs. payment vs. care coordination).

**Current default.** A valid authorization for the category grants access regardless of stated purpose.

**The question.** Does 42 CFR Part 2 require us to verify the authorization covers the *specific purpose* of each access — or is category-level consent sufficient for our use cases?

- **If purpose-specific is required:** we tighten the check so an authorization for "coordination of care" does not also permit, say, a payment-related disclosure. (More restrictive — fewer accesses allowed.)
- **If category-level is sufficient:** leave as is.

---

## Decision 2 — Cross-organization visibility (tenant isolation)

**What it is.** The protected-data tables are scoped by the patient's care team and by an "administrator" role. They are **not** additionally scoped by organization (tenant).

**Current default.** A user on the patient's care team, or an administrator, can see the protected segments.

**The question.** Is our "administrator" role **organization-specific**, or is it a **platform-wide** super-administrator? If platform-wide, an administrator at one organization could in principle see protected SUD/MH segments belonging to a different organization's patients.

- **If we need per-organization isolation:** we add an explicit organization filter to these tables.
- **If the administrator role is already organization-scoped:** no change needed — please confirm.

---

## Decision 3 — Automatic flagging from diagnosis codes

**What it is.** The design includes an option to **automatically** classify a record as protected when a sensitive diagnosis code is entered (e.g., an opioid-use-disorder ICD-10 code auto-flags the record as SUD-protected). This automation is currently **turned off**, because the diagnosis table it would attach to does not yet carry the diagnosis-code and patient fields the automation needs.

**Current default.** Off. Records are protected only when a clinician marks them, or via the manual classification path.

**The question.** Do we want automatic flagging from diagnosis codes? If yes, it requires a small schema change to the diagnosis records first, and confirmation of the code ranges that should auto-trigger protection (the draft covers SUD F10–F19, mental health F20–F48, HIV/AIDS, and certain genetic codes).

---

## Decision 4 — Where this surfaces for clinicians (product, not compliance)

**What it is.** The subsystem is fully built but not yet shown on any screen. There is no clinician-facing workflow today to record an authorization, mark a record as protected, or log a disclosure.

**The question (for Maria/product, noted here for completeness).** Where should this appear — patient chart, a consent-management panel, the disclosure workflow? Until it is wired in, the protections exist in the database but are not exercised by real users.

---

## What is already guaranteed regardless of the above

These are in place now and do not depend on the decisions above:

- **Fail-closed:** no valid authorization → access denied. Verified live (expired, revoked, wrong-category, and no-authorization cases all correctly deny).
- **Disclosure log is tamper-resistant:** every disclosure record is stamped with the actual user who made it (cannot be forged), and the log is append-only (no edits or deletions).
- **No unauthenticated access:** the protected-data functions cannot be called by anonymous/unauthenticated callers.
- **No current exposure:** the subsystem is not connected to any screen, so no protected data is reachable until it is deliberately wired in (Decision 4).

---

*Technical detail and the migration history are in `docs/trackers/db-reference-drift-triage-tracker.md` (Batch 14) and migrations `20260607150000` / `20260607150001`.*
