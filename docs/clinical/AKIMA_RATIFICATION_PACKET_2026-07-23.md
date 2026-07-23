# Clinical & Compliance Ratification Packet — for Akima

**Prepared:** 2026-07-23 · **From:** Maria (WellFit / Envision Atlus engineering)
**Purpose:** One consolidated packet of every open item awaiting your clinical/compliance sign-off. Each section gives plain-language context, what (if anything) is already applied in production, and the specific decisions you own. Nothing here requires you to read code — file references are included only for audit trail.

---

## 1. PHI Encryption — Risk Assessments & the Two-Key Architecture (§17)

**Context.** The platform runs two products with two separate PHI encryption keys: the WellFit Community key (Supabase Secrets, `PHI_ENCRYPTION_KEY`) and the Envision Atlus clinical key (Supabase Vault, `app_encryption_key`). A January 2026 database change silently broke five encryption call sites for about six months. Investigation confirmed **no plaintext PHI was ever stored** — everything failed closed.

**Already applied (Maria approved; your ratification requested):**

- The `risk_assessments` encryption trigger was repaired using the **clinical key** (`use_clinical_key = true`) and a matching decrypt view was created (migration `20260711190000`). The risk-assessment feature is writable again.
- Handoff packets and hospital-transfer decryption now explicitly use the **clinical key**, and the encrypt path is fail-closed (a failure can never silently store plaintext).
- New restricted database functions (`encrypt_phi_text_with_key` / `decrypt_phi_text_with_key`) restore the **WellFit Secrets-key** path for community-side encryption (CHW medication photos). They are callable only by the server role — a browser can never pass key material. Live round-trip, fail-closed behavior, and the privilege matrix were all proven.

**Decisions you own:**

- [ ] Ratify `risk_assessments` as **clinical-key** scope, and the repaired trigger + decrypt view.
- [ ] Ratify handoff packets / hospital transfers as **clinical-key** scope.
- [ ] Ratify the two-key restoration (option A: WellFit data under the WellFit key; independent rotation) and the server-role-only posture of the new functions.
- [ ] Decide whether FHIR patient bundles should decrypt and include risk factors, or leave that field empty (PHI-minimization). Currently the bundle leaves it empty.
- [ ] Awareness note: the WellFit-side configuration value (`app.settings.PHI_ENCRYPTION_KEY`) is unset in production, so certain legacy WellFit calls fall back to the Vault key. If that convergence is unacceptable, we will provision the value or move those callers to the new restricted functions.
- [ ] Awareness note (separate surface): the restored `phi_access_audit` compliance view surfaces patient name / actor email from audit metadata to admin users only, per the original design. Flagging for your §17 awareness.

*Full technical detail: `docs/clinical/RISK_ASSESSMENTS_ENCRYPTION_REVIEW.md`.*

---

## 2. AI Model Version Change — Clinical Fleet on Claude Sonnet 5 (Tier-3 Ratification)

**Context.** On 2026-07-12 all 28 clinical AI skills (SOAP notes, coding suggestions, discharge summaries, the Riley scribe, etc.) were migrated from `claude-sonnet-4-5-20250929` to `claude-sonnet-5`. The migration was deliberately **behavior-preserving**: Sonnet 5's new "extended thinking" mode was explicitly disabled everywhere so outputs match the prior model's configuration. The 24 Haiku-based skills were untouched.

**Decisions you own:**

- [ ] Ratify the model version change for clinical skills (governance Commandment #14: model changes are conscious migrations).
- [ ] Perform (or delegate) an **output-quality spot-check** on SOAP-note generation and coding suggestions before any pilot demo.
- [ ] Optional, gated on you: per-skill enablement of Sonnet 5's adaptive-thinking mode for SOAP notes (a potential quality upgrade; deliberately not enabled during the swap).

---

## 3. Transfer System — Two Ratifications (Applied 2026-07-22, Maria's Judgment Calls)

**Context.** The EMS-to-hospital and hospital-to-hospital transfer workflows were repaired end-to-end. Two decisions Maria made under professional-judgment delegation need your clinical/billing ratification.

**D2 — Billing codes on transfer encounters.** Automatic, unconditional charge generation (a G0390 trauma-activation code attached to every transfer) was **removed**. Transfers now produce **advisory billing suggestions** (`encounter_billing_suggestions`) that a human biller reviews before any claim. Ratify that transfers generate advisory suggestions only.

- [ ] Ratified / change

**D3 — Temporary patient records for unknown arrivals.** Incoming transfer patients who cannot be matched to an existing record (by MRN first) get a **temporary record** created server-side (clinical-role-gated), flagged for Master Patient Index reconciliation. Ratify the temp-record policy and the match-first ordering.

- [ ] Ratified / change

---

## 4. Mental & Behavioral Health Suite — Activation Sign-Off

**Context.** The mental-health module (10 live database tables, screening instruments, safety planning, dashboard) is built but deliberately **islanded** — feature flag off, no navigation link — pending your review. The governing rule file (`.claude/rules/mental-health.md`) encodes 42 CFR Part 2, psychotherapy-notes protections, break-the-glass, and suicide-safety obligations.

**The 8-item pre-activation checklist you own** (from the rule's pre-flight):

1. [ ] 42 CFR Part 2 routing: all SUD-data reads gated through the consent subsystem, fail-closed.
2. [ ] Psychotherapy-notes class: excluded from patient access/export/AI by default.
3. [ ] Patient/proxy surfaces: sensitivity + consent + minor-status checks.
4. [ ] Risk/safety: high-risk screens auto-escalate; 988/crisis resources always reachable.
5. [ ] Duty-to-warn / mandatory-reporting pathways: clinician-initiated, logged with legal basis.
6. [ ] Sensitivity labeling + tenant/role RLS; break-the-glass is the only bypass.
7. [ ] State-law overlays for the tenant's operating state.
8. [ ] Full audit coverage + real reachability (flag on + navigation link) before pilot.

**42 CFR Part 2 subsystem — 4 open items (yours; the subsystem is live but islanded):**

- [ ] Purpose-scoping of each authorization (what the consent covers).
- [ ] Tenant scoping on the Part 2 tables.
- [ ] Diagnosis-trigger wiring (what flags a record as Part 2).
- [ ] UI wiring (where consent capture/verification surfaces for staff).

---

## 5. Intake & Laboratory Workflows — New Decisions (Tracker Dated 2026-07-14)

**Context.** A full audit of patient intake and lab-results workflows found material gaps now being repaired. The engineering-only items are underway; these clinical decisions are yours.

**D4 — Treatment consent placement.** `consent_for_treatment` had a database default of "true" — every profile showed a treatment consent nobody captured. The default is being removed. Decide **where affirmative treatment-consent capture belongs**: WellFit onboarding (a wellness product may not need clinical treatment consent), Atlus admission, or both.

- [ ] WellFit onboarding / Atlus admission / Both / Neither (document rationale)

**D5 — Canonical allergy store.** Intake will begin capturing allergies (today the drug-interaction checker has zero allergy data to check). Engineering recommendation: `allergy_intolerances` as the canonical table (the FHIR-named alternative is a read-only view over it). Ratify.

- [ ] Ratified / change

**D8 — Baseline assessments at intake.** Which instruments should enrollment capture: fall-risk screen, PHQ-2, cognitive status, baseline vitals? Administered by whom, and gating or optional? (PHQ is behavioral-health data — Section 4's rules apply to it.)

- [ ] Specify instruments + administration + gating

**D13 — Geriatric protocol routing.** Intake is becoming patient-first (not senior-only). What sets the geriatric care protocol: an age threshold (e.g., 65+), enrollment context, or clinician selection?

- [ ] Specify the rule

**L-7 — Patient lab access by QR token.** The data layer for QR-code lab access (7-day expiring token, admin-gated issuance) is built and hardened; the patient-facing page is intentionally **not built** pending your approval of the URL-token-to-PHI pattern.

- [ ] Approve pattern / reject / modify (e.g., shorter TTL, PIN step)

**L-8 — Results-release policy.** Today every lab result would be patient-visible immediately upon entry. Decide whether any category (e.g., pathology, HIV, genetics) warrants a clinician-review-first hold, using a Cures-Act-compliant exception, and the legal basis to document either way.

- [ ] Immediate release for all / specify held categories + basis

---

## 6. Summary of What Is NOT Waiting on You

For clarity: the critical-lab alerting defect (critical results being rejected by the database) was an engineering repair and is **already fixed and live-proven** (2026-07-23). Lab result entry, escalation wiring, and patient record exports are in active engineering and do not need sign-off — except for the release-policy and QR-token items above.

---

*Prepared by the engineering session of 2026-07-23. Every "applied" claim above was live-verified against the production database at authoring time.*
