# Clinic-Ready Envision Atlus — Standalone Clinic Operations Program

**Created:** 2026-08-15 · **Status:** SCOPED, AWAITING MARIA'S VENDOR/BUDGET DECISIONS ON W1/W2/W4/W5
**Source:** Maria directive 2026-08-15: *"a full tracker … end to end addressing my blindspots and make my system not worried about epic but increases envision atlus."*
**Verification:** every code claim below was grep/file-verified against HEAD on 2026-08-15. DB claims marked (live) were verified in prior sessions and must be re-verified via Supabase MCP `execute_sql` before the session that touches them (Commandment #18).

---

## The positioning principle (read this before any session)

**This program is NOT "beat Epic." It is "make Atlus complete for Atlus's market."**

The Epic complaint Maria keeps hearing from clinics is: *Epic has everything, buries the clinic in what it doesn't need, and makes it slow to get out what it does need.* Atlus's answer is not to grow Epic's surface area — it is to be **complete for the workflows its buyers actually run** (care coordination, CCM/RPM, CHW, engagement, coding/claims prep) and **honest about the four external wires** every medical clinic depends on. Those four wires are the blind spots this tracker closes:

1. **Claims that actually reach a payer** (live clearinghouse)
2. **Prescriptions that actually reach a pharmacy** (eRx network)
3. **Lab orders/results that actually flow** (lab interface)
4. **The certification decision** (CEHRT: when it's required, when it isn't)

Everything else a clinic needs day-to-day already exists in this codebase (verified inventory below). Atlus can be sold **today** in "alongside-EHR" mode and becomes a **standalone clinic EMR** for its target segments as W1–W4 land. Two modes, one codebase:

| Mode | What it means | Ready when |
|---|---|---|
| **A — Alongside** | Atlus runs the coordination/engagement/CCM/RPM/CHW layer next to the clinic's existing EHR; FHIR/C-CDA is the bridge | **Now** (pending the pilot-readiness checklist in W6) |
| **B — Standalone** | Atlus IS the clinic's system of record: schedule → room → document → order → prescribe → bill | W1 + W2 + W3 + W4-external done; W5 decided |

---

## Who in the clinic Atlus is for (persona anchor — use this in every demo/pitch)

| Persona | What Atlus gives them | Where it lives |
|---|---|---|
| **RN care manager / coordinator** (the power user) | Care plans, CCM autopilot + time tracking, alerts, readmission risk, handoffs, escalations | `careCoordinationService`, `ccmAutopilotService`, care_team_* tables |
| **CHW** | Own lane + kiosk (shipped 2026-07-25), field visits, SDOH capture | CHW lane, `chw-kiosk` edge proxy |
| **Biller / coder** | Coding suggestions, DRG, prior auth chain, 837P prep, eligibility panel | `generate-837p`, `mcp-prior-auth-server`, `eligibilityVerificationService`, `EligibilityVerificationPanel` |
| **Front desk / MA** | Reminders, no-show detection, telehealth scheduling — *general in-clinic book is W3* | `appointmentReminderService`, `detect-no-shows`, `TelehealthScheduler` |
| **Clinician** | Chart navigator, AI SOAP notes, med safety, DoctorsView home-vitals | `PatientChartNavigator`, `ai-soap-note-generator`, `drugInteractionService` |
| **The patient/senior** | My Health Hub (Cures Act), check-ins, engagement, portal exports | `/my-health` routes, WellFit side |

Target segments (per existing GTM): **FQHCs, senior living, faith-based nonprofits, small specialty clinics** — NOT hospital rip-and-replace.

---

## Ground truth — what exists vs. what's missing (verified 2026-08-15)

### Already real (do not rebuild — demo these)

| Capability | Evidence |
|---|---|
| Encounters, clinical notes, amendments, note locking | `clinical_notes`, `AmendmentWorkflow.tsx`, `NoteLockingControls` |
| Meds, allergies, interactions, reconciliation | `drugInteractionService.ts`, `ai-medication-reconciliation` |
| CCM eligibility + time tracking + autopilot | `ccm_eligibility_assessments`, `ccm_time_tracking`, `ccmAutopilotService` |
| FHIR R4 + SMART on FHIR + C-CDA + bulk export | `fhir-r4`, `smart-*`, `ccda-export`, `enhanced-fhir-export` |
| Claims data model + 837P generation | `claims`/`claim_lines`/`remittances` tables, `supabase/functions/generate-837p` (536 lines) |
| Eligibility workflow (internal half) | `src/services/eligibilityVerificationService.ts` (366 lines, X12 270/271 shape, writes to `encounters`, used by `EligibilityVerificationPanel`) |
| EPCS internal lifecycle | `src/services/epcsService.ts` + `./epcs/*` (create → PDMP → 2FA sign → cancel, DEA audit trail) |
| PDMP query (honest fail-closed 501 until connected) | `pdmp-query` (gated S2 2026-08-15) |
| Telehealth scheduling + reminders + no-show detection | `telehealth_appointments`, `appointmentReminderService`, `detect-no-shows` |
| Quality measures (CQM capture/calculate/report, MIPS composite) | `qualityMeasures/`, `qrdaIIIExport.ts`, `ECQMDashboard.tsx` |
| Patient portal + records export (Cures Act) | My Health Hub, `HealthRecordsDownloadPage` |

### The four blind-spot gaps (the program)

| # | Gap | Verified state 2026-08-15 |
|---|---|---|
| W1 | **No live clearinghouse wire** | `mcp-clearinghouse-server/index.ts` is a T1 stub: `tier: 'external_api'`, apikey-only, **hardcoded `'tenant-id'` passed to every handler**, `ClearinghouseClient` has no live credentials; comment `// In production: await client.initialize(tenantId from JWT)`. Governance S9 already flags: *"Must be raised to T3 before any real EDI go-live."* 837P generation exists but output goes nowhere. |
| W2 | **No eRx transmission network** | `epcsService.ts` (94-line barrel + `./epcs/*`) has zero transmit/network/fetch references — prescriptions are created, signed, audited **internally** and never leave the system. No Surescripts/DoseSpot/NewCrop/DrFirst integration anywhere in src/, supabase/, docs/ (grep-verified). Routine (non-controlled) eRx has no pathway either. |
| W3 | **No general in-clinic scheduling** | The ONLY appointments table used is `telehealth_appointments` (`appointmentService.ts:203,266,480`). No in-person visit book, no provider/day/slot UI, no walk-in flow, no schedule→encounter linkage. Front desk cannot run a clinic day on this. |
| W4 | **No live lab interface** | Data layer is rich but empty and unwired — **defer to `intake-and-labs-gap-tracker-2026-07-14.md`** (L-series) for the internal repairs. This tracker adds ONLY the external wire: a live lab network connection (W4-external). (live, 2026-07-14: `lab_results` 0 rows, `hl7_message_queue` 0 rows and **no consumer**.) |
| W5 | **Certification decision unmade + stale tracker** | `onc-certification-tracker.md` (2026-03-28) is STALE: its "Certified-Ready" table still lists (f)(1)/(f)(2)/(f)(5)/(f)(7) as ready — corrected to GAP on 2026-07-25 (fabricated ACKs; backing tables missing live); its EPCS/(b)(3) row overstates (no transmission network, see W2). No decision exists on certify-vs-defer. |

### Meta blind spot (pattern, not a workstream)

Three separate docs (ONC tracker, ONC matrix pre-2026-07-25, FEATURE_LIST-era claims) have described **service-layer code as if it were a live external integration**. The pattern: *a service/table/generator exists → doc says READY → nobody asks "does it reach the outside world?"* Every workstream below therefore has an explicit **"external wire" acceptance criterion** — a live round-trip with the real third party (or its sandbox), not a unit test. This is `feedback_live_proof_over_mocks` applied to integrations.

---

## ⚑ MARIA DECISIONS REQUIRED (before the marked sessions — everything else is executable without questions)

| # | Decision | Recommendation (engineering view) | Blocks |
|---|---|---|---|
| D-1 | **Clearinghouse vendor** | A small-clinic-friendly clearinghouse with a real REST API and flat pricing (e.g. Claim.MD ~flat monthly; Availity Essentials has a free basic tier). Enterprise (Optum/Change) is wrong for target segments. Verify current pricing before signing — my figures are estimates. | W1-S2+ |
| D-2 | **eRx path: embed vs. certify** | **Embed a certified eRx module (DoseSpot-class, per-provider licensing)**. Direct Surescripts certification is a 12–18 month, audit-heavy program — wrong for now. Embedding gets routine eRx + EPCS on their certification. Budget is per-provider/year + integration fee. | W2-S1+ |
| D-3 | **Lab network: aggregator vs. direct** | Aggregator (Health Gorilla-class, one API → Quest/LabCorp/regional) over direct per-lab HL7 contracts. Direct = per-lab projects, months each. | W4-ext |
| D-4 | **CEHRT timing** | Defer full ONC certification until a paying pilot demands it, BUT note the honest constraint: **Medicare CCM billing expects core clinical data captured in 2015-Edition CEHRT** (⚑ AKIMA verify current CMS CCM tech requirement) — RPM (99453-99458) has **no** CEHRT requirement. So: lead standalone pilots with RPM + care coordination + engagement; CEHRT unlocks standalone CCM billing later. Refresh the stale ONC tracker either way (W5-S1 — no decision needed for that part). | W5-S2 |
| D-5 | **Priority vs. security remediation** | The external-audit remediation tracker (S4 next: A-3/A-4) currently holds next-session priority. Recommendation: **finish remediation S4–S5 first** (W1 will touch generate-837p, which is IN S4's scope — doing security + wire work on the same function in the wrong order = rework), then interleave this program. | Program start |

---

## Workstream W1 — Live Clearinghouse (eligibility → claims → ERA → status)

**Goal:** a real claim, for a real (test) patient, accepted by a real clearinghouse sandbox, with the 835 posted back to `remittances`. This is the single highest-leverage wire: it turns the entire existing billing suite (claims lifecycle tables, 837P generator, coding suggestions, fee schedules, denial tracking) from furniture into a product.

**Existing assets:** `supabase/functions/generate-837p/` (536 lines) · `mcp-clearinghouse-server/` (233-line router + handlers/client/types modules) · `eligibilityVerificationService.ts` → `EligibilityVerificationPanel` · tables `claims`, `claim_lines`, `claim_denials`, `claim_status_history`, `remittances`, `clearinghouse_config`, `clearinghouse_batches`, `clearinghouse_batch_items` (live-verify row 0 state before S2).

| Session | Work | Acceptance | Est. |
|---|---|---|---|
| **W1-S1** | **Raise mcp-clearinghouse-server T1→T3** per governance S9: `mcpAuthGate` (JWT + role + tenant), kill every hardcoded `'tenant-id'`, tenant from caller's profile, `verify_jwt` posture consistent with the S3 `publicHealthGate` pattern. No vendor needed — this is pure hardening and is also audit item C-adjacent. Sister-sweep other `'tenant-id'` literals. | deno check 0; negative proofs (401 anon, 403 wrong-role, 403 cross-tenant) live; governance-boundaries.md S9 row updated T1(stub)→T3 | 1 session |
| **W1-S2** ⚑D-1 | **Vendor onboarding + credentials**: enrollment, sandbox creds → Supabase secrets (`CLEARINGHOUSE_*`, never VITE_), implement `ClearinghouseClient.initialize()` against the real API (eligibility 270/271 first — it's synchronous and easiest to prove). | Live 271 response for a synthetic member rendered in `EligibilityVerificationPanel`; result persisted on `encounters`; audit logged | 1–2 sessions |
| **W1-S3** | **Claims submit + status**: wire `generate-837p` output → vendor claim submission (or vendor-native JSON claim API if cleaner than X12 — decide in-session, document); `check_claim_status` (276/277) real; `claim_status_history` written. | One synthetic-patient claim accepted by sandbox (vendor-assigned claim ID stored on `claims`); rejection path produces a `claim_denials` row | 1–2 sessions |
| **W1-S4** | **ERA/835 posting**: `process_remittance` parses real sandbox 835 → `remittances` + line-level posting against `claim_lines`; denial → `claim_denials`. | Sandbox 835 round-trip posted; amounts reconcile; biller can see it in the billing dashboard | 1 session |

**Non-goals:** payer-specific edits engine, secondary claims, paper CMS-1500 — post-pilot.

---

## Workstream W2 — E-Prescribing (routine + EPCS)

**Goal:** a prescription created in Atlus arrives at a pharmacy. Without this, "standalone clinic EMR" is not an honest sentence for any prescribing clinic.

**Existing assets:** `epcsService.ts` + `./epcs/*` (registration, 2FA signing, DEA audit — genuinely good internal spine) · `pdmp-query` (fail-closed) · medication tables + interaction checks. **Missing: 100% of the network layer, routine AND controlled.**

| Session | Work | Acceptance | Est. |
|---|---|---|---|
| **W2-S1** ⚑D-2 | **Vendor integration spec** (after Maria picks): map Atlus's prescription lifecycle onto the vendor's API/iframe model; decide UI embed points (chart navigator + med manager); pharmacy directory search; identity-proofing flow for prescribers (IDP is mandatory for EPCS). Write the session-ready sub-spec INTO this tracker. | Sub-spec airtight (a fresh session can execute W2-S2 with no questions) | 1 session |
| **W2-S2..S3** | Implement embed: provider onboarding UI, prescribe flow from med manager, status webhooks → `medications`/EPCS tables, audit logging. | Sandbox prescription (routine) reaches vendor's test pharmacy; EPCS test script passes with 2FA; `TransmissionStatus` reflects real network state | 2 sessions |
| **W2-S4** | Reconcile the internal EPCS spine with the vendor reality: either the vendor's EPCS supersedes `epcs/prescriptions.ts` signing (likely — document and keep our audit trail as the local record) or ours feeds theirs. **Repair, don't route around** — no parallel second prescription store. | One prescription model; ONC tracker (b)(3) row rewritten honestly | 1 session |

**Interim honesty rule:** until W2 ships, no demo/doc may say "e-prescribing" — say "prescription management with PDMP + interaction safety; transmission via [vendor] scheduled."

---

## Workstream W3 — In-Clinic Scheduling & Front-Desk Day

**Goal:** a front desk can run a full clinic day in Atlus: book, check in, room, hand to clinician, check out. Pure internal build — no vendor, no Maria decision except one schema call.

**Existing assets:** `telehealth_appointments` + `appointmentService.ts` + reminders + `detect-no-shows` + `ai-schedule-optimizer` + registration/intake flows (see intake tracker Part 1).

| Session | Work | Acceptance | Est. |
|---|---|---|---|
| **W3-S1** | **Schema + service**: generalize appointments. In-session decision with authority (Tier 3 — migration, so present to Maria at session start, not mid-stream): recommend NEW `appointments` table (visit_type in-person/telehealth/home, provider_id, location/room, slot start/end, status lifecycle incl. checked_in/roomed/completed/no_show) with `telehealth_appointments` either view-mapped or migrated onto it — **verify live state first** (§18) and check the dual-use `appointments` row in governance-boundaries.md before naming. RLS tenant+role, GRANT (§2a), indexes. Extend `appointmentService` (526 lines — watch the 600 cap, decompose). | Migration pushed + live-verified; service CRUD w/ tests; reminders + no-show detection read the generalized source | 1–2 sessions |
| **W3-S2** | **Front-desk book UI**: provider/day column view, slot create/move/cancel, walk-in add, patient search hook-in. EA design system, no emojis (System B), 44px targets. | Maria visual acceptance (#13) of a staged clinic day | 1–2 sessions |
| **W3-S3** | **Day flow linkage**: check-in → rooming status → one-click encounter creation prefilled (patient, provider, appointment) → checkout triggers `encounter_billing_suggestions`. | End-to-end staged day: book → arrive → room → note → checkout → billing suggestion row, live, audit-logged | 1 session |

---

## Workstream W4 — Labs (pointer + external wire only)

**Internal repairs (orders, results, critical-flag landmine, acknowledgments, portal release) are OWNED by `intake-and-labs-gap-tracker-2026-07-14.md` — execute them there, not here.** Duplicating them would fork the spec.

This tracker adds one item:

| Session | Work | Acceptance | Est. |
|---|---|---|---|
| **W4-ext** ⚑D-3 | Lab network connection via chosen aggregator: compendium sync, order transmit (from the intake tracker's `lab_orders`/`fhir_service_requests` layer), result ingestion → the existing `hl7-receive`/`lab_results` path (which the intake tracker will have repaired first — **dependency: intake tracker L-series before this**). | Sandbox order → result round-trip lands in `lab_results` and renders in the chart + patient portal | 2 sessions after L-series |

---

## Workstream W5 — ONC/CEHRT: refresh the tracker, make the decision

| Session | Work | Acceptance | Est. |
|---|---|---|---|
| **W5-S1** | **Refresh `onc-certification-tracker.md` against reality** (no decision needed): f-series rows READY→GAP per 2026-07-25 findings; (b)(3) EPCS row → "internal lifecycle only, network = W2"; re-verify each remaining "Certified-Ready" row with the same skepticism (the meta blind spot says: ask "does it reach the outside world?" for every (f)/(h) row); add the f-series data-layer rebuild dependency. | ONC tracker carries zero known-false READY rows; each row cites file evidence | 1 session |
| **W5-S2** ⚑D-4 | Record the certify-vs-defer decision + the segment consequences (CCM CEHRT expectation ⚑AKIMA-verify, RPM exempt) in the GTM playbook and this tracker. If GO: sequence Drummond prep from the refreshed tracker. | Decision documented; pitch materials consistent with it | 0.5 session |

---

## Workstream W6 — Positioning: sell Mode A now, honestly

**Goal:** Atlus stops being implicitly measured against Epic and gets its own definition. Doc/GTM work, low risk, can interleave anywhere.

| Session | Work | Acceptance | Est. |
|---|---|---|---|
| **W6-S1** | **Pilot-readiness checklist per segment** (FQHC / senior living / specialty clinic): for each, which mode (A/B), which workflows demoed, which gaps disclosed (W1–W4 status auto-summarized from this tracker), which personas trained. Update `docs/GO_TO_MARKET_PLAYBOOK.md` + `docs/FEATURE_LIST.md` — sweep both for any claim the meta-blind-spot pattern applies to (integration described as live that isn't). | A one-page "what Atlus does today / what's scheduled" sheet Maria can hand a clinic without any sentence she'd have to walk back | 1 session |
| **W6-S2** | **Mode-A bridge hardening**: verify the alongside-Epic story technically — SMART app launch against a public sandbox (e.g. SMART Health IT sandbox), C-CDA import path exercised, `fhir_connections` inbound sync demoed. This is the "we don't fight Epic, we ride alongside it" proof. | One live SMART launch + one inbound C-CDA rendered in Atlus, screenshots for the pitch deck | 1 session |

---

## Program sequencing (recommended — Maria may reorder)

```
Security remediation S4–S5 (existing tracker, keeps priority — D-5)
  └─ W1-S1 (clearinghouse T3 hardening — natural sibling of S4's generate-837p work)
       ├─ W6-S1 (positioning sheet — no dependencies, any gap week)
       ├─ W3-S1..S3 (scheduling — pure internal, no vendor wait)
       ├─ W1-S2..S4 (after D-1 vendor signed)
       ├─ W2-S1..S4 (after D-2 vendor signed)
       ├─ intake tracker L-series → W4-ext (after D-3)
       └─ W5-S1 (any time) → W5-S2 (after D-4)
```

**Total estimate:** ~14–18 sessions of build across W1–W4 + 3 doc/decision sessions (W5/W6), **excluding external lead times** (vendor contracts, clearinghouse enrollment, EPCS identity-proofing — start D-1/D-2/D-3 paperwork early; it runs in parallel with W3).

---

## Standing rules for every session in this program

1. **External wire = live proof.** No workstream item closes on mocks. Sandbox round-trip with the real third party, swept afterward (`feedback_live_proof_cleanup_downstream` — mind Guardian alerts).
2. **Commandment #18** before every migration: live-verify the tables this tracker names — several (`clearinghouse_config`, `remittances`) have never held a row and may have drifted.
3. **Honesty gates:** until a wire is live, UI must say so (the `pending_transport` / fail-closed-501 pattern from the f-series/pdmp repairs is the house style — copy it).
4. **Tier discipline:** W1-S1, W3-S1 migrations and any RLS/auth changes are Tier 3 — surface at session start.
5. **Update this tracker + PROJECT_STATE at session close**; mark rows DONE only per Commandment #21 (done means done).
