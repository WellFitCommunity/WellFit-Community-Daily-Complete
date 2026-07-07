# Mental & Behavioral Health Rules — Where the Law Is STRICTER Than Regular Healthcare

> **Scope.** This governs every part of the suite that touches mental health, behavioral health, substance use disorder (SUD), suicide risk, psychotherapy, or any data derived from them — the `/mental-health` dashboard, the `mental_health_*` tables, the 42 CFR Part 2 subsystem, break-the-glass, screening instruments, and any AI skill that reads or reasons over behavioral-health data.
>
> **The one thing to remember:** *HIPAA is the floor, not the ceiling.* Behavioral health data is governed by a stack of laws that are **more restrictive** than the general HIPAA rules the rest of the codebase follows. A pattern that is correct and compliant for a blood-pressure reading can be a **federal violation** for a suicide-risk note or a SUD record. When behavioral-health data is in scope, the default answer to "can we show / share / release this?" is **no, until a specific rule says yes.**

---

## Why this file exists (the difference in one table)

| Dimension | Regular healthcare (rest of suite) | Mental / behavioral health (this file) |
|---|---|---|
| Governing law | HIPAA Privacy/Security Rule | HIPAA **+ 42 CFR Part 2** (SUD) **+ stricter state law** (e.g. Texas H&S §611) **+ psychotherapy-notes rule** |
| Default for internal access (TPO) | Broadly permitted for treatment, payment, operations | **NOT automatically permitted** for Part 2 SUD data — needs patient consent or a statutory exception |
| Patient right of access | Patient sees essentially everything | **Psychotherapy notes are excluded** from the right of access; adolescent records may be restricted |
| Re-disclosure by the recipient | Allowed within HIPAA | **Prohibited** — Part 2 data carries a re-disclosure ban that travels with the data |
| Information Blocking (Cures Act) | Must share unless an exception applies | Same rule, but the **Preventing-Harm** and **Privacy** exceptions apply far more often (suicide risk, adolescent confidentiality, psychotherapy notes) |
| Breaking confidentiality | Rare | **Sometimes mandatory** — duty to warn/protect (Tarasoff), mandatory-reporting, imminent-danger |
| Consequence of getting it wrong | HIPAA penalty | **Criminal penalty** possible under 42 CFR Part 2; state licensure exposure |

If you are about to write code that reads, joins, displays, exports, logs, or feeds-to-AI any behavioral-health field and you have not accounted for the right-hand column, **STOP AND ASK** (Akima owns the clinical/compliance sign-off).

---

## 1. 42 CFR Part 2 — SUD records are NOT ordinary PHI

Substance-use-disorder records created by a federally-assisted program are governed by **42 CFR Part 2**, which is **stricter than HIPAA**. This subsystem already exists in the codebase — **use it, do not bypass it, do not reinvent it.**

**Existing building blocks (verify live before extending):**
| Object | Where |
|---|---|
| Consent/authorization ledger (the gate) | `cfr42_authorization_log` table (LIVE) — the consent gate reads THIS, not `patient_consents` |
| Service layer | `src/services/sensitiveDataService.ts` |
| Migrations | `supabase/migrations/20260123000003_42_cfr_part2_consent.sql`, `20260607150000_rebuild_42_cfr_part2_subsystem.sql`, `20260607150001_lockdown_cfr42_function_execution.sql` |

**Rules:**
| Do | Don't |
|---|---|
| Gate every SUD-data read through the Part 2 consent check (fail-closed) | Treat SUD data as TPO-accessible like a lab value |
| Record the specific consent that authorized each disclosure | Assume one blanket consent covers all future disclosures |
| Attach the **re-disclosure prohibition notice** to any SUD data that leaves the system | Let a recipient re-share Part 2 data downstream |
| Segregate SUD data so it can be withheld without breaking the rest of the chart | Denormalize SUD flags into general tables where they leak into every query |

**The Part 2 subsystem is fail-closed by design — if the consent gate can't confirm authorization, access is DENIED, not defaulted-open.** Never "loosen it for now."

> ⚠️ Known open items (Akima compliance review — do not close without her): purpose-scoping of the authorization, `tenant_id` on the Part 2 tables, diagnosis-trigger wiring, and UI wiring. The subsystem is built but **islanded**. Treat it as not-yet-clinically-live until those clear.

---

## 2. HIPAA Psychotherapy Notes — a separate, protected class

Psychotherapy notes (the therapist's process notes, kept separate from the medical record) get **special protection above ordinary PHI**:

- **Excluded from the patient right of access** — they are NOT part of a records download/export.
- Require a **separate, specific authorization** to disclose — a general HIPAA authorization does **not** cover them.
- Must be **physically/logically separated** from the rest of the record.

**In code:** any field that is a psychotherapy process note must be tagged so it is **excluded by default** from: patient-facing views (`/my-health`, health-records download, FHIR/C-CDA export), general clinician queries, and any AI context assembly. Do not fold psychotherapy-note text into a `SELECT` that feeds a summary, a bundle, or an LLM prompt without an explicit authorization check.

---

## 3. Data Segmentation & Break-the-Glass — sensitivity is a first-class attribute

Behavioral-health data must be **labeled as sensitive** and access-controlled beyond normal RLS. Follow the DS4P (Data Segmentation for Privacy) principle: the sensitivity label travels with the data.

**Existing break-the-glass building blocks:**
| Object | Where |
|---|---|
| Emergency-access service | `src/services/emergencyAccessService.ts` |
| Constants | `src/constants/emergencyAccess.ts` |
| Notify edge function | `supabase/functions/notify-emergency-access/index.ts` |
| Log table | `emergency_access_log` |

**Rules:**
- Emergency ("break-the-glass") access to behavioral-health data must be **explicitly invoked, reason-captured, and logged** — never silent.
- Every break-the-glass event is **high-severity audit** and should notify. Reuse the existing service; don't hand-roll a bypass.
- RLS on `mental_health_*` tables must enforce **tenant isolation AND role gating** — behavioral-health data is not readable by every authenticated user in the tenant.

---

## 4. Suicide risk & safety — clinical-safety obligations, not just privacy

This is where the suite must **do more**, not just protect more. The `mental_health_*` system encodes evidence-based standards (Joint Commission NPSG on suicide risk, Stanley-Brown safety planning, Columbia/C-SSRS-style screening, PHQ-9/GAD-7). Types live in `src/types/mentalHealth/` (`baseTypes.ts`, `riskAndSafety.ts`); service in `src/services/mentalHealthService.ts`.

**Rules:**
| Requirement | Rule |
|---|---|
| Screening drives action | A high-risk screen must **auto-escalate** (STAT psych / 1:1 / discharge blocker) — a risk score that just sits in a table is a defect, not a feature |
| Fail toward safety | If risk data is missing, unreadable, or ambiguous, treat as **needs-review**, never "assume low risk" |
| Crisis resources are always reachable | Crisis contacts / **988 Suicide & Crisis Lifeline** must be present in any patient-facing behavioral-health surface — never behind a feature flag that can hide it |
| Discharge blockers are hard gates | A safety requirement that is unmet must **block** the workflow it guards; do not let it be "cleared for now" |
| Human-in-the-loop | AI may surface/suggest, but a licensed clinician owns every risk determination and every escalation decision (see `python.md` §10 / `ai-services.md`) |

---

## 5. Duty to Warn / Protect & Mandatory Reporting — confidentiality has limits

Unlike ordinary PHI, behavioral-health confidentiality **must sometimes be broken by law**:

- **Duty to warn/protect (Tarasoff line of cases):** an imminent, serious threat to an identifiable third party can create a mandatory disclosure duty. State-specific.
- **Mandatory reporting:** abuse/neglect of children, elders, or dependent adults; certain imminent-danger situations.
- **Involuntary hold / emergency detention:** governed by **state statute** (e.g., Texas Health & Safety Code §573 emergency detention). If the suite ever documents or supports a hold, it must follow the governing state law exactly.

**In code:** these are **exceptions that permit/require disclosure** — they are narrow, event-specific, must be **logged with the legal basis**, and are **clinician-initiated**. Never implement an automated disclosure of behavioral-health data as a "duty to warn" without Akima's clinical/legal sign-off. Never suppress a legally-required report to preserve confidentiality.

---

## 6. Cures Act / Information Blocking — the exceptions apply MORE here

The suite must share health data (anti-information-blocking), **but** behavioral health has heavier-used exceptions:

| Exception | Behavioral-health application |
|---|---|
| **Preventing Harm** | Withholding data whose release would endanger the patient or another person (active suicidality, adolescent safety) |
| **Privacy** | Psychotherapy notes; Part 2 SUD data without consent; state-law-restricted records |
| **Adolescent confidentiality** | A minor's confidential behavioral-health data may need to be withheld from a proxy/parent per state law |

**Rule:** Do **not** blanket-blast behavioral-health data into patient-facing exports, portals, or FHIR bulk endpoints the way general data flows. Each behavioral-health element crossing to a patient/proxy surface must pass a sensitivity + consent + minor-status check first. When in doubt, invoke the exception and **document why** — silent over-sharing of behavioral health is as much a violation as silent blocking of general records.

---

## 7. Minors & Adolescent Consent — the proxy is not automatically authorized

- In many states a minor may **consent to certain behavioral-health / SUD services on their own**, and the parent/guardian proxy does **not** get automatic access to those records.
- Caregiver/proxy access paths (PIN grants, caregiver portal) must **respect adolescent behavioral-health confidentiality** and cannot expose minor-consented behavioral-health data to a proxy by default.
- This is **state-specific** — do not hardcode a single national rule. Gate on tenant/state configuration and STOP AND ASK for the governing rule.

---

## 8. Audit, AI, and PHI-to-browser — the general rules, tightened

The whole-suite rules still apply, only **stricter** for behavioral health:

- **Audit everything.** Every read, disclosure, escalation, break-the-glass, and export of behavioral-health data is auditable via `auditLogger` / `phi_access_logs`. Behavioral-health access logging is not optional.
- **No behavioral-health PHI in the browser** beyond what the patient is entitled to see. Suicide-risk detail, SUD status, and psychotherapy notes are **especially** not to be shipped to client bundles or logs.
- **AI context assembly must filter sensitivity.** Before any behavioral-health data enters an LLM prompt, apply the Part 2 / psychotherapy / sensitivity checks. An AI skill that summarizes "the chart" must not silently ingest Part 2 or psychotherapy-note content. Structured output + model pinning + human-in-the-loop per `ai-services.md`.
- **Minimum necessary, harder.** Pull only the specific behavioral-health fields the task needs; never `SELECT *` across `mental_health_*`.

---

## 9. Pre-flight checklist — before ANY behavioral-health change

Before writing code that touches behavioral-health data, confirm:

1. [ ] Is any of this data **42 CFR Part 2 SUD data**? → route through `sensitiveDataService` + `cfr42_authorization_log`, fail-closed.
2. [ ] Are any **psychotherapy notes** in scope? → excluded from patient access/export/AI by default; separate authorization required.
3. [ ] Does the target surface reach a **patient/proxy** (portal, export, FHIR)? → sensitivity + consent + **minor-status** check first.
4. [ ] Is there a **risk/safety** dimension? → high risk auto-escalates; fail toward safety; 988/crisis resources reachable.
5. [ ] Could this trigger a **duty to warn / mandatory report / hold**? → clinician-initiated, logged with legal basis, Akima sign-off.
6. [ ] Is the data **labeled sensitive** with tenant + role RLS, and is break-the-glass the only bypass (logged, notified)?
7. [ ] Does the **state** the tenant operates in impose a stricter rule than HIPAA? → gate on config; STOP AND ASK if unknown.
8. [ ] Is every access **audited**, and is the feature actually **reachable** by a real user (flag on + nav link), or is it islanded?

**If you cannot check all eight, it is not done — and for anything in #1, #5, or #7, STOP AND ASK Akima before proceeding.**

---

## Current state of the `/mental-health` module (as of this file)

- **DB:** all 10 `mental_health_*` tables exist live in production.
- **Code:** types, service, and `MentalHealthDashboard` present.
- **Reachability:** route `/mental-health` is registered but gated by feature flag `mentalHealth` (`VITE_FEATURE_MENTAL_HEALTH`), which is **unset → defaults to `false`**, so the route is currently filtered out by `RouteRenderer`. There is **no clickable nav link** to it (only a voice-command phrase mapping + a breadcrumb label). **The module is islanded** — treat "wire it up" (flag + nav link + verify RLS/Part 2 integration) as required work before any pilot demo.
