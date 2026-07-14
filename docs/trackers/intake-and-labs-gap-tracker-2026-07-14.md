# Intake & Labs Gap Tracker — 2026-07-14

> **Scope:** Close the gaps between the platform's intake (registration/enrollment/onboarding) and laboratory-results workflows and what a professional healthcare intake + lab process requires. Written after a 2-agent code sweep + live-DB verification (every schema/row claim below was queried live via `pg_proc`/`information_schema`/row counts on 2026-07-14 — Commandment #18 satisfied at authoring time; re-verify before each session).
>
> **How to use:** Each item has severity, evidence (file:line + live-DB proof), an exact fix spec, and acceptance criteria. Sessions are ordered; P0s first. Items marked ⚑ MARIA or ⚑ AKIMA are blocked on a decision — everything else is executable by a fresh session without questions.

---

## Live-DB ground truth (2026-07-14) — the numbers behind every severity call

| Fact | Value |
|---|---|
| `profiles` total | 61 (1 test user) |
| …with emergency contact | **2** |
| …with caregiver contact info | **0** |
| …with any insurance data | **0** |
| …with allergies / medications / conditions text | **0 / 0 / 0** |
| …with advance directive | **0** |
| …demographics_complete / onboarded | **2 / 8** |
| …`hipaa_authorization_signed` | **0** |
| …`consent_for_treatment` = true | **61 (ALL — column DEFAULT true, never captured)** |
| `senior_demographics` / `senior_health` / `senior_sdoh` / `senior_emergency_contacts` rows | 4 / 1 / 4 / 1 |
| `privacy_consent` / `patient_consents` rows | 2 / 0 |
| `lab_results` rows | **0** (schema is a rich merged superset — see L-0) |
| `fhir_diagnostic_reports` / `lab_orders` / `result_acknowledgments` / `result_escalation_log` / `patient_lab_access_tokens` / `fhir_service_requests` rows | 0 / 0 / 0 / 0 / 0 / 0 |
| `fhir_observations` rows | 93 (all vital-signs from check-in triggers; zero laboratory) |
| `result_escalation_rules` rows | 7 (seeded: troponin/creatinine/K/glucose/Hgb/INR) |
| `hl7_message_queue` rows | 0 (and **no consumer exists**) |
| Live fns | `get_lab_trends` ✓, `get_patient_lab_results` ×2 (duplicate overloads), `generate_patient_lab_token` ✓, `update_patient_lab_token_access` ✓, `enroll_hospital_patient` ✓, `bulk_enroll_hospital_patients` ✓, `has_active_consent` ✓, `flag_critical_lab_results` ✓ |
| Missing objects | `create_fhir_patient_from_profile` fn, `emergency_alerts` table, `fhir_patients` table, `get_lab_reports` fn |
| Live triggers on `lab_results` | `trg_flag_critical_labs` (→ **inserts into missing `emergency_alerts`**), 2× updated_at |

---

# PART 1 — INTAKE

Flows mapped (evidence: agent sweep 2026-07-14):
1. Self-register: `src/pages/RegisterPage.tsx` → `supabase/functions/register` (`pending_registrations`) → `supabase/functions/sms-verify-code` (auth user + `profiles` upsert + welcome email + FHIR RPC + auto-signin).
2. Admin enroll: `src/pages/EnrollSeniorPage.tsx` (+ `BulkEnrollmentPanel.tsx`) → `supabase/functions/enrollClient` (`profiles` UPDATE, role hardcoded senior/4).
3. Hospital: `src/components/admin/HospitalPatientEnrollment.tsx` → RPCs `enroll_hospital_patient`/`bulk_enroll_hospital_patients` (no auth user; `hospital_patients` view has 21 rows).
4. Staff: `UserProvisioningPanel` → `admin_register`.
5. Post-login onboarding gate: `src/AuthGate.tsx` → `/demographics` (`useDemographicsForm.ts` → `profiles` + `seniorDataService.saveCompleteSeniorProfile` → `senior_demographics`/`senior_health`/`senior_sdoh`/`senior_emergency_contacts`) → `/consent-photo` → `/consent-privacy` (`privacy_consent`).

## I-1 (P0, compliance) — Consent integrity: fabricated treatment consent + missing NPP acknowledgment

**Professional standard:** HIPAA §164.520 requires a good-faith effort to obtain written acknowledgment of Notice of Privacy Practices receipt at first service. Treatment consent must be affirmatively captured, never defaulted.

**Defects (live-verified):**
- (a) `profiles.consent_for_treatment` has **column DEFAULT true** → all 61 profiles show treatment consent that no one ever gave. Same fabricated-value class as the 85% adherence metric (killed 2026-07-14 eighth session). `hipaa_authorization_signed` (DEFAULT false) is 0 everywhere — honest but never captured either.
- (b) `/notice-of-privacy-practices` (`src/routes/routeConfig.ts:100` → `src/pages/NoticeOfPrivacyPractices.tsx`) is a **dead route** — zero nav/Link references. No NPP-acknowledgment write exists anywhere.
- (c) `RegisterPage.tsx:424` terms/privacy checkbox is a client-side boolean gate only — **not persisted** to any consent record.

**Fix spec:**
1. Migration: `ALTER TABLE profiles ALTER COLUMN consent_for_treatment SET DEFAULT NULL;` + data correction `UPDATE profiles SET consent_for_treatment = NULL` (values were never captured — NULL = "not asked", the honest state). ⚑ MARIA sign-off (Tier 3: schema + data correction).
2. Add NPP step to onboarding: link `/notice-of-privacy-practices` from `/consent-privacy` flow (AuthGate sequence `src/AuthGate.tsx:182-191`), persist acknowledgment as `privacy_consent` row `consent_type='npp'` (follow `ConsentPrivacyPage.tsx:89` pattern — same table, same shape).
3. Persist the RegisterPage terms acknowledgment: carry a `terms_accepted_at` through `pending_registrations` → write `privacy_consent` row `consent_type='terms'` in `sms-verify-code` after profile upsert.
4. Treatment consent: WellFit community product may not need clinical treatment consent (it's a wellness app) — ⚑ AKIMA: decide whether treatment-consent capture belongs in WellFit onboarding, Atlus admission, or both. Do NOT re-add a default either way.

**Acceptance:** new registration produces `privacy_consent` rows for privacy + photo + npp + terms; `consent_for_treatment` is NULL until an explicit capture UI sets it; live query shows no DEFAULT-true; NPP page reachable from onboarding and footer.

## I-2 (P0, broken write) — Self-registration calls a nonexistent FHIR RPC

**Defect:** `sms-verify-code/index.ts:456` calls RPC `create_fhir_patient_from_profile` on every self-registration, fire-and-forget (`:461-473` warn + continue). Live `pg_proc`: **fn does not exist** — it was only ever defined in `_ARCHIVE_SKIPPED/_SKIP_20251029040000` (never applied) and defensively dropped by `20251209100000_fix_database_function_errors.sql:44`. The `fhir_patients` table it presumably targeted **also doesn't exist** (`fhir_patient_bundle` does). Every self-registered user since inception has silently skipped FHIR patient creation. Same dropped-RPC class as `log_handoff_override`.

**Fix spec:** Decide target then implement — ⚑ MARIA (product call, two options):
- (A) Build the RPC against the real FHIR store (whatever `create_resource`/mcp-fhir-server uses for Patient — verify live table before writing; `fhir_patients` does NOT exist, do not assume). SECURITY DEFINER + search_path, GRANT per §2a, then refresh `scripts/db-objects-snapshot.json` **in the same commit**.
- (B) Remove the dead call + comment; create FHIR Patient lazily at first clinical touch instead.

**Acceptance:** self-register round-trip produces either a FHIR Patient row (A) or no dangling RPC call (B); grep confirms no other caller of the dropped name (`grep -rn "create_fhir_patient_from_profile" src supabase/functions`).

## I-3 (P1, patient safety) — Allergies, medications, PCP: not captured anywhere

**Professional standard:** allergy list, current-medication list, and PCP identification are intake fundamentals — the platform's own drug-interaction subsystem (`check-drug-interactions`, `drug_interaction_cache`) has **zero allergy data to check against** (`allergy_intolerances` 0 rows, `fhir_allergies` 0 rows, `senior_health.allergies` never populated, `profiles.allergies` 0 non-null).

**Defects:**
- No intake form captures allergies at all (columns exist: `senior_health.allergies text[]` — `seniorDataService.ts:43,192`; not in the form mapper `:540-548`).
- Medications: demographics captures ONE free-text string wrapped into a 1-element array (`seniorDataService.ts:544`).
- PCP/referring provider: `senior_health.primary_care_physician`/`specialist_providers` columns exist, no form field.

**Fix spec:**
1. Add Allergies + Medications + PCP step to `src/pages/DemographicsPage/` (steps live in `DemographicsPage/steps/`; extend `useDemographicsForm.ts` formData + `seniorDataService.mapFormDataToSeniorProfile`).
2. Add the same three fields to `EnrollSeniorPage.tsx` (admin captures at enrollment — seniors rarely complete web onboarding: 2/61) and thread through `enrollClient/index.ts` profile update + a `senior_health` upsert.
3. Structured allergy target: write BOTH `senior_health.allergies` (display) and the canonical allergy table — ⚑ MARIA/AKIMA: pick `allergy_intolerances` vs `fhir_allergies` as canonical (both live, both empty; verify columns live before writing the mapper).
4. Senior-friendly UI per `.claude/rules/accessibility.md` (large touch targets, plain language, "None" quick-select).

**Acceptance:** live round-trip — enroll a synthetic senior with 2 allergies + 3 meds + a PCP → rows land in `senior_health` + canonical allergy table with tenant_id; drug-interaction check for that patient sees the allergy list; scoped tests assert the insert column set (the write-shape test class from `readmissionWriterShape.test.ts`).

## I-4 (P1) — Admin-enrollment parity + intake completion

**Defects:**
- `enrollClient` does NOT send a welcome email and does NOT attempt FHIR patient creation (self-register does both — `sms-verify-code:456,481`). Asymmetry: admin-enrolled seniors (the majority path) get less.
- Intake completion depends on the senior logging into the web app (AuthGate force-routes to `/demographics`) — live data says that mostly never happens (2/61 complete, 8/61 onboarded). Professional intake = the enroller completes it at enrollment time. The "Complete Demographics" button → `/admin-profile-editor` exists (`EnrollSeniorPage.tsx:207`) but is optional and skippable.
- Emergency contact: single name/phone pair on `profiles`; the proxy-aware multi-contact table `senior_emergency_contacts` (1 row total) is only reachable via the web demographics flow.

**Fix spec:**
1. `enrollClient`: after profile update, fire `send_welcome_email` (mirror `sms-verify-code:481` invocation; email optional — skip when phone-only) and the I-2 FHIR decision's path.
2. Make enrollment a 2-step wizard: EnrollSeniorPage step 2 = the demographics + I-3 safety fields + ≥1 emergency contact (writes `senior_emergency_contacts`, sets `demographics_complete=true`). Admin can "Save & finish later" (current behavior) but the default path completes intake.
3. Backfill decision ⚑ MARIA: for the ~24 existing real seniors, run an outreach/backfill campaign (staff completes `/admin-profile-editor` per senior) — tracker item, not code.

**Acceptance:** enrolling via admin produces: profile + senior_demographics + senior_health + ≥1 senior_emergency_contacts row + welcome email log + demographics_complete=true, live-verified on a synthetic senior; parity checklist self-register vs admin-enroll documented in `docs/product/REGISTRATION_FLOWS.md`.

## I-5 (P2, product) — Insurance/coverage capture

**Defect:** intake captures a single `insurance_type` select mapped to crude booleans (`senior_sdoh.has_medicare/has_medicaid/has_supplemental_insurance` — `seniorDataService.ts:562-564`). `profiles` has `primary_insurance`, `insurance_id`, `insurance_group_number`, `secondary_insurance`, `medicare_number`, `medicaid_number` — **all 0 populated**. The platform has a full claims subsystem (claims/fee_schedules/clearinghouse) with no coverage data entering at intake.

⚑ MARIA (product scope): WellFit community tier may only need the booleans; Atlus billing needs payer + member ID + eligibility. Decide which enrollment flow captures what before building. If billing capture is approved: add coverage step to `HospitalPatientEnrollment.tsx` + `EnrollSeniorPage.tsx` writing the existing `profiles` insurance columns (they exist live — verified), PHI-handling per §17 (member IDs are PHI; server-side only surfaces).

**Acceptance (if approved):** synthetic patient enrolled with Medicare number → columns populated, visible in billing context, masked in UI per PHI rules.

## I-6 (P2, clinical — ⚑ AKIMA) — Baseline assessments at intake

**Gap:** no intake captures baseline fall-risk, cognitive status, mood (PHQ-2), or baseline vitals. Columns exist and idle: `senior_health.fall_risk_level/fall_history/cognitive_status/adl_score/iadl_score`. Mental-health screening exists only post-discharge (`dischargeToWellnessBridge.ts:539`). For a senior-wellness product, an enrollment baseline is what makes later trend/risk math meaningful (readmission feature-extractor already reads `risk_assessments` ADL/cognitive data as input).

⚑ AKIMA: which instruments at intake (fall-risk screen? PHQ-2? cognitive?), administered by whom, and are they gating or optional. Mental-health items route through `.claude/rules/mental-health.md` (PHQ is behavioral-health data — sensitivity labeling + role gating apply). Build nothing before her spec.

## I-7 (P3, docs) — REGISTRATION_FLOWS.md drift

`docs/product/REGISTRATION_FLOWS.md` claims Flow-2 assigns "role_code 4 OR 19 (patient)" — **contradicted**: `enrollClient/index.ts:169,181` hardcodes role 4/senior; role 19 appears nowhere in enrollment code. Doc also omits the bulk path and test-patient branch. Update the doc (or implement role-19 if that was the intent — ⚑ MARIA one-line call).

## Intake orphans (dispositions needed, from island list — no new findings)
- `PatientAdmissionForm.tsx` (bed admission, orphan), `PaperFormUploader.tsx` (orphan; `PaperFormScanner` is the live sibling), `wellness_enrollments` writer `dischargeToWellnessBridge.enrollPatientInWellnessApp` (zero callers — the discharge→WellFit bridge never fires). Already on the island decision list (PROJECT_STATE 2026-07-14); I-4's wizard is the natural place to also mount wellness enrollment.

---

# PART 2 — LABS

**Headline:** the lab subsystem has rich, mostly-live scaffolding (schema superset, 7 seeded escalation rules, acknowledgment queue + dashboards, token vault) and **zero working ingestion** — 0 result rows anywhere, and the one live trigger would reject exactly the critical results that matter most.

## L-0 (P0, write-path landmine) — Critical-lab trigger inserts into a missing table

**Defect (live-verified via `pg_trigger` + `prosrc`):** `trg_flag_critical_labs` is attached to live `lab_results`; its function `flag_critical_lab_results()` does `INSERT INTO public.emergency_alerts (...)` when `NEW.abnormal_flag IN ('critical_low','critical_high')` — and **`emergency_alerts` does not exist**. Any insert of a critical lab result errors (undefined_table) and rolls back. Normal results insert fine; critical ones cannot be stored at all. This MUST be fixed before any ingestion work (L-1+).

**Fix spec:** replace the function body to write `care_team_alerts` (exists live; readmission pipeline already writes it — mirror that column set, live-verify columns first) OR create `emergency_alerts` — recommend **care_team_alerts** (one alert surface, already read by dashboards; `emergency_alerts` is referenced only by `AdminSettingsPanel`, `EnhancedFhirServiceClass`, `mobile-sync` — those callers need the same repoint-or-create decision ⚑ MARIA). Keep the trigger fail-safe: alert-insert failure must NOT roll back the lab insert (wrap in BEGIN/EXCEPTION, log). Migration + `db push` + live probe (rolled-back insert with `abnormal_flag='critical_high'` proving both the row lands AND the alert fires). Refresh db-objects snapshot in the same commit.

**Acceptance:** rolled-back live probe: critical lab insert succeeds + produces an alert row; non-critical insert unchanged; sister-grep `emergency_alerts` callers dispositioned.

## L-1 (P0) — No functional result-ingestion path exists

**Defects (each verified):**
- HL7: `hl7-receive/index.ts` parses MSH + handles ADT only; **ORU^R01 results are logged + queued (`hl7_message_queue`, priority 7) and never consumed** — no queue worker exists anywhere.
- PDF/AI: `labResultVaultService.ts:53` invokes edge fn **`parse-lab-pdf` which does not exist** in `supabase/functions/` → always falls to `fallbackRegexParsing` → returns `[]` (`:87-92`). The vault ingestion pipeline is dead.
- Vendor: `labIntegration.ts` writes orders only (`lab_orders` — 0 rows); `lab_provider_connections.auto_fetch_results` flag exists, **no fetcher**.
- Manual: **no UI anywhere lets a clinician enter a lab result** (CPOE `LabOrderForm` is order-entry → `fhir_service_requests`, 0 rows).

**Fix spec (minimum viable first):** build **manual result entry** — new admin section component (System B: EA components, no emoji) + service writing canonical rows: `lab_results` (live superset columns: patient_id, tenant_id, test_name, test_code(LOINC), value, value_numeric, unit, reference_range, abnormal_flag, collection_date, result_date, status) AND mirroring to `fhir_observations` (category `['laboratory']`) so patient-facing `/health-observations` shows it. Wire L-2's evaluation at save. Write-shape test pinning the insert column set. Live round-trip on synthetic patient.

**Acceptance:** clinician enters a potassium of 6.2 → `lab_results` row + laboratory `fhir_observations` row + escalation fires (L-2) + result visible in patient chart tab + `/health-observations`; all live-verified.

## L-2 (P1) — Critical-value pipeline: engine exists, nothing calls it

**Defect:** `resultEscalationService.evaluateResult` (`src/services/resultEscalationService.ts:172`) + 7 live seeded rules + `ResultEscalationDashboard` + `result_acknowledgments`/`v_unacknowledged_results` queue + `UnacknowledgedResultsDashboard` all exist — and `evaluateResult` has **zero production callers** (tests only). No result landing (there are none — L-1) would trigger escalation, and the acknowledgment queue only watches `fhir_diagnostic_reports` (0 rows).

**Fix spec:** single choke-point: every result writer (L-1 manual entry, later L-3 ORU, L-6 PDF) calls `evaluateResult` post-insert; escalations create `care_team_alerts` + land in the unacknowledged queue. Extend the queue view to cover laboratory `fhir_observations`/`lab_results` or (cleaner) have every ingestion path also create the `fhir_diagnostic_reports` row the queue already watches — decide in-session, document choice in the tracker.

**Acceptance:** critical result → `result_escalation_log` row + care-team alert + appears in UnacknowledgedResultsDashboard; acknowledgment writes `result_acknowledgments`; normal result does neither.

## L-3 (P1) — HL7 ORU parsing + queue consumer

**Fix spec:** extend `hl7-receive` (or a new cron-driven `hl7-queue-processor` — prefer cron worker so receive stays fast) to parse ORU^R01 OBR/OBX segments → L-1's canonical writer (lab_results + fhir_observations + evaluateResult). `mcp-hl7-x12` server already has `parse_hl7`/`hl7_to_fhir` tools — reuse its parsing logic rather than re-implementing. Auth: cron gate per `isAuthorizedCronCaller` pattern (vital-threshold-monitor, 2026-07-14). Mark queue rows processed/failed with retry count.

**Acceptance:** synthetic ORU^R01 posted to hl7-receive → queue row → worker run → lab rows + escalation; queue row marked processed; malformed message marked failed without poisoning the queue.

## L-4 (P1, Cures Act exposure) — Patient record export is a mock; C-CDA labs are broken

**Defects:**
- `HealthRecordsDownloadPage.tsx:82-111` — the patient "download my records" flow is a **stub**: `setTimeout(3000)` then downloads literal `mockContent` ("PDF content would be here"). This is the Cures Act patient-access surface. (Violates no-placeholder rule; predates current governance.)
- `ccda-export/queries.ts:84` filters `lab_results` by `.eq('patient_mrn', userId)` — comparing an **MRN text column against an auth UUID** → labs are effectively always absent from C-CDA; it also exports only vital-signs observations, never laboratory category, and never `fhir_diagnostic_reports`.

**Fix spec:** (a) wire HealthRecordsDownloadPage to the real exporters — `pdf-health-summary` edge fn (already reads all three lab stores) for PDF; `enhanced-fhir-export`/`ccda-export` for FHIR/C-CDA; delete the mock. (b) ccda-export: filter `lab_results` by `patient_id` (column exists live) and include laboratory-category `fhir_observations` + `fhir_diagnostic_reports`. PHI access logging on both (existing `usePhiAccessLogging` pattern).

**Acceptance:** patient with 1 lab (from L-1) downloads PDF + C-CDA containing that lab, live-verified; no mockContent string remains (`grep -rn "mockContent" src`).

## L-5 (P2, architecture decision — ⚑ MARIA) — Three-store fragmentation

Three disconnected lab models coexist: vault-flavored `lab_results` (MRN-keyed handoff/OCR uses), FHIR (`fhir_observations` + `fhir_diagnostic_reports` — charts, exports, ack queue), integration flavor (orders/vendor columns on the same `lab_results` table). Live table is the merged superset so there is ONE physical results table + two FHIR tables. **Recommended canon (decide before L-3 scales):** `lab_results` = ingestion/staging + operational metadata; `fhir_observations`(+`fhir_diagnostic_reports`) = clinical/patient-facing truth; every writer dual-writes via the L-1 canonical service; readers of patient data use FHIR only. Also resolve: duplicate `get_patient_lab_results` overloads (×2 live — drop one), `get_lab_reports` referenced-but-missing check, and the `20251003200000` migrate:down-after-COMMIT footgun file (annotate, never re-push).

## L-6 (P2) — Build `parse-lab-pdf` edge fn (or remove the pathway)

`labResultVaultService.parseLabPDF` is wired UI→service and dead at the edge. Build it: Claude vision/PDF extraction (model pinned, structured JSON schema output per Rule 16, registered in `ai_skills` with patient_description), rate-limited, admin/clinical role gate; returns candidate rows for human confirmation (never auto-commits — extraction confidence surfaced, matches `PaperFormScanner` pattern). Route through L-1 writer on confirm. If Maria prefers to defer OCR: remove the dead invoke + hide the upload UI (no silent stubs).

## L-7 (BLOCKED — ⚑ AKIMA, carried) — `/patient/labs/:token` QR access

Data layer live + hardened (`patient_lab_access_tokens`, `generate_patient_lab_token` 7d TTL admin-gated, `update_patient_lab_token_access`); route + UI intentionally not built pending Akima's approval of the URL-bearer-token-to-PHI pattern (restore migration `20260610130000` header). Do not build until she rules.

## L-8 (P3) — Hardening backlog (do after L-1..L-4)

- Trending: real charts (dataviz skill) on laboratory observations; today only text arrows (`LabResultVault.tsx:50-63`).
- LOINC/unit validation on the L-1 writer (reject unknown units; warn unmapped LOINC).
- Duplicate detection (same patient + test_code + collection_date + value).
- Results-release policy ⚑ AKIMA: everything patient-visible releases immediately today; decide if any category (e.g. pathology) warrants a clinician-review-first hold using a Cures-Act-compliant exception, and document the legal basis either way.

---

# Session plan (estimates per implementation-discipline.md)

| Session | Items | Est. | Blockers |
|---|---|---|---|
| S1 | L-0 + I-2 (both dropped-object repairs; smallest, highest leverage) | <4h | I-2 needs Maria's A/B call; L-0 needs emergency_alerts repoint-vs-create call |
| S2 | L-1 + L-2 (manual entry + escalation wiring = labs minimally ALIVE) | 4–16h (2 sessions) | none after S1 |
| S3 | I-1 + I-3 (consent integrity + safety-minimum intake fields) | 4–16h (2 sessions) | I-1a data correction sign-off; I-3 canonical allergy table call |
| S4 | I-4 (enrollment parity + wizard) | 4–16h | none |
| S5 | L-4 (real exports) + I-7 (doc fix) | <4h–8h | none |
| S6 | L-3 (ORU worker) | 4–16h | S2 done |
| S7+ | I-5, I-6, L-5, L-6, L-8 | per decision | Maria/Akima decisions above |

# Decision queue (everything blocked, one place)

| # | Decision | Owner | Blocks |
|---|---|---|---|
| D1 | I-2: build `create_fhir_patient_from_profile` (A) vs remove call (B) | Maria | S1 |
| D2 | L-0: repoint trigger to `care_team_alerts` vs create `emergency_alerts` (3 other callers reference it) | Maria | S1 |
| D3 | I-1a: null-out fabricated `consent_for_treatment` values | Maria | S3 |
| D4 | I-1d: where treatment-consent capture lives (WellFit vs Atlus vs both) | Akima | S3 |
| D5 | I-3: canonical allergy table (`allergy_intolerances` vs `fhir_allergies`) | Maria/Akima | S3 |
| D6 | I-4: backfill campaign for 24 existing seniors | Maria | ops, not code |
| D7 | I-5: insurance capture scope per product | Maria | S7+ |
| D8 | I-6: intake baseline instruments | Akima | S7+ |
| D9 | I-7: role-19 patient enrollment — doc fix or feature | Maria | S5 |
| D10 | L-5: canonical lab store architecture | Maria | before L-3 scales |
| D11 | L-7: patient lab QR token pattern | Akima | carried |
| D12 | L-8: results-release policy | Akima | S7+ |
