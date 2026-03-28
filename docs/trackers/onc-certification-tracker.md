# ONC 170.315 Certification Gap Tracker

> **Source:** Code audit against ONC certification criteria — 2026-03-28
> **Verified by:** Claude Opus 4.6 — all criteria checked against actual source code
> **Goal:** Close all gaps for ONC-ACB certification (Drummond Group recommended)
> **Estimated total:** ~57 hours across 3-4 sessions
> **ACB Reference:** `/archive/sessions/ONC_ACB_SELECTION.md`

---

## Status Legend

- **DONE** — Code complete, tested, verified
- **IN PROGRESS** — Work started
- **TODO** — Not yet started
- **BLOCKED** — External dependency

---

## Already Certified-Ready (27+ Criteria — No Work Needed)

These criteria are fully implemented and tested. Listed here for completeness and ACB preparation.

| Criterion | Description | Evidence |
|-----------|-------------|----------|
| (a)(4) | Drug-Drug, Drug-Allergy Interaction | `drugInteractionService.ts`, `AllergyIntoleranceService.ts`, `check-drug-interactions/` |
| (a)(6) | Problem List | `ConditionService.ts` — FHIR Condition with `problem-list-item` category |
| (a)(7) | Medication List | `medicationTrackingService.ts`, `MedicationRequestService.ts`, label scanner, adherence |
| (a)(8) | Medication Allergy List | `AllergyIntoleranceService.ts` — severity, criticality, verification status |
| (b)(1) | Transitions of Care (C-CDA) | `ccda-export/index.ts` — all 9 CCD sections |
| (b)(2) | Clinical Info Reconciliation | `ai-medication-reconciliation/index.ts` — AI-enhanced with deprescribing |
| (b)(6) | Data Export (Bulk FHIR) | `enhanced-fhir-export/`, `bulk-export/` — paginated, validated |
| (b)(7) | Data Segmentation | `sensitiveDataService.ts` — 42 CFR Part 2, consent management |
| (b)(10) | EHI Export | `DataManagementPanel.tsx`, My Health Hub — JSON/PDF/C-CDA |
| (c)(1) | CQM Capture | `qualityMeasures/calculation/` — 8 CMS measures, CQL engine |
| (c)(2) | CQM Calculate | `patientEvaluation.ts`, `batchCalculation.ts`, QRDA I export |
| (c)(3) | CQM Report | `qrdaIIIExport.ts`, `mipsCompositeService.ts`, `ECQMDashboard.tsx` |
| (d)(1) | Authentication | `envision-totp-*`, `passkey-*`, `sms-verify-code/` — MFA complete |
| (d)(2) | Auditable Events | `auditLogger.ts` — 8 event categories, immutable audit tables |
| (d)(3) | Audit Report | `AuditAnalyticsDashboard.tsx`, `SecurityComplianceDashboard.tsx` |
| (d)(4) | Amendments | `AmendmentWorkflow.tsx` — 4 types, approval chain, audit trail |
| (d)(5) | Automatic Access Time-out | `SessionTimeoutContext.ts` — auto-logout with warning |
| (d)(9) | Trusted Connection | HTTPS everywhere, TLS enforced by Supabase |
| (d)(12) | Encrypt Auth Credentials | bcrypt via Supabase Auth, `hash-pin/` edge function |
| (d)(13) | Multi-Factor Auth | `envision-totp-setup/verify/use-backup/` — TOTP complete |
| (e)(1) | View, Download, Transmit | Patient portal, multi-format export, My Health Hub |
| (e)(2) | Secure Messaging | `send-sms/`, `send-email/`, `send-push-notification/` — auth'd + rate-limited |
| (e)(3) | Patient Health Info Capture | `check-in/` system — daily patient-entered health data |
| (f)(1) | Immunization Registry | `immunization-registry-submit/` — HL7 VXU to TX ImmTrac2 |
| (f)(2) | Syndromic Surveillance | `syndromic-surveillance-submit/` — HL7 ADT to TX DSHS |
| (f)(4) | Antimicrobial Surveillance | `antimicrobialSurveillanceService.ts` — NHSN CDA docs |
| (f)(5) | Electronic Case Reporting | `ecr-submit/` — eICR via AIMS + direct state |
| (f)(7) | PDMP | `pdmp-query/` — TX AWARxE, risk flags, 24h cache |
| (g)(4) | Quality Management System | Risk models, clinical validation hooks, logging |
| (g)(6) | Safety-Enhanced Design | Confidence scoring, human review gates, clinical grounding |
| (g)(7) | App Access - Patient Selection | `fhir-r4/` — FHIR Patient search with scope validation |
| (g)(8) | App Access - Data Category | 12 FHIR R4 resource types supported |
| (g)(9) | App Access - All Data | `bulk-export/` — admin-only FHIR Bundle export |
| (g)(10) | Standardized API (FHIR + SMART) | Full SMART on FHIR OAuth2, FHIR R4 server |
| SAFER | SAFER Guides (9 of 9) | `saferGuidesService.ts` — 76 questions, attestation reports |
| USCDI | USCDI v3 (18/18 elements) | Migration `20260122150000_uscdi_v3_elements.sql` |
| EPCS | Electronic Prescribing (Controlled) | `epcsService.ts` — DEA-compliant, 2FA, schedule II-V |

---

## Session 1 — Tier 1 Blockers: CPOE + Demographics (~32 hours)

These are the items that BLOCK certification. Must be done first.

| # | Criterion | Gap | Files to Create/Modify | Est. Hours | Status |
|---|-----------|-----|------------------------|-----------|--------|
| ONC-1 | (a)(1) CPOE - Medications | Order entry UI missing. `MedicationRequestService` backend exists. | New: `src/components/admin/cpoe/MedicationOrderForm.tsx`, wire to `MedicationRequestService` | 8 | TODO |
| ONC-2 | (a)(2) CPOE - Laboratory | No lab order entry. Only result import exists. | New: `src/components/admin/cpoe/LabOrderForm.tsx`, new: `src/services/fhir/ServiceRequestService.ts` (FHIR ServiceRequest) | 8 | TODO |
| ONC-3 | (a)(3) CPOE - Diagnostic Imaging | No imaging order entry. Only result storage exists. | New: `src/components/admin/cpoe/ImagingOrderForm.tsx`, extend `ServiceRequestService.ts` for imaging | 8 | TODO |
| ONC-4 | (a)(5) Demographics — Race & Ethnicity | Missing `race` and `ethnicity` columns on `profiles`. All other demographics complete. | New migration: `supabase/migrations/YYYYMMDD_add_race_ethnicity_demographics.sql`, update `patientContext.ts`, update registration/profile forms | 2 | TODO |
| ONC-5 | (a)(14) Implantable Device List | Completely missing. Wearables ≠ implantable devices. | New migration: `_implantable_devices.sql`, new: `src/services/fhir/DeviceService.ts`, new: `src/components/admin/ImplantableDeviceList.tsx` | 6 | TODO |

**Session 1 subtotal:** ~32 hours

### Session 1 Notes

- **ONC-1/2/3 share a pattern:** All three CPOE forms should follow the same architecture — form component → FHIR service → edge function → audit log. Build ONC-1 first as the template, then ONC-2 and ONC-3 will be faster.
- **ONC-2/3 use FHIR ServiceRequest:** Lab and imaging orders are both `ServiceRequest` resources in FHIR R4. One service handles both with a `category` discriminator.
- **ONC-4 is quick:** Migration + type update + two form fields. Should take ~2 hours including tests.
- **ONC-5 uses FHIR Device:** Map to FHIR `Device` and `DeviceUseStatement` resources. UDI (Unique Device Identifier) parsing is required per ONC.

---

## Session 2 — Tier 2: CDS Integration + Missing Features (~19 hours)

| # | Criterion | Gap | Files to Create/Modify | Est. Hours | Status |
|---|-----------|-----|------------------------|-----------|--------|
| ONC-6 | (a)(9) CDS Integration | Guideline matcher + contraindication detector exist but aren't wired into CPOE order workflow as blocking alerts. | Modify CPOE forms from Session 1: add pre-submit CDS hooks calling `drugInteractionService`, `contraindicationDetectorService`, `ai-clinical-guideline-matcher` | 4 | TODO |
| ONC-7 | (a)(10) Drug Formulary | `formulary_cache` table exists but unused. No lookup during prescribing. | Activate formulary check in MedicationOrderForm, add non-formulary alert UI, populate test formulary data | 3 | TODO |
| ONC-8 | (a)(12) Family Health History | Only boolean flags in cardiology/neuro modules. No structured genealogical data. | New migration: `_family_health_history.sql`, new: `src/services/fhir/FamilyMemberHistoryService.ts`, new: `src/components/admin/FamilyHistoryPanel.tsx` | 6 | TODO |
| ONC-9 | (d)(6) Break-the-Glass Emergency Access | Emergency contacts exist. Formal time-limited override with supervisor notification + audit trail missing. | New: `src/services/emergencyAccessService.ts`, new: `src/components/admin/BreakTheGlassModal.tsx`, migration for `emergency_access_log` | 4 | TODO |
| ONC-10 | (d)(7)/(d)(8) Data Integrity Verification | Server-side PHI encryption exists. Missing: checksums on exported records, client device encryption policy enforcement. | Add SHA-256 hash to export metadata, add integrity verification on C-CDA/FHIR exports | 2 | TODO |

**Session 2 subtotal:** ~19 hours

### Session 2 Notes

- **ONC-6 depends on Session 1:** CDS integration hooks into the CPOE forms built in ONC-1/2/3. Must be done after.
- **ONC-8 uses FHIR FamilyMemberHistory:** Standard resource with relationship type, condition, deceased status, age at onset.
- **ONC-9 is a security feature:** Break-the-glass must log who accessed what, why, for how long, and notify the supervisor. Time-limited access expires automatically.

---

## Session 3 — Tier 3: Polish + External Dependencies (~6 hours + external)

| # | Criterion | Gap | Files to Create/Modify | Est. Hours | Status |
|---|-----------|-----|------------------------|-----------|--------|
| ONC-11 | (g)(5) WCAG AA Accessibility Audit | ESLint a11y plugin configured, components mostly accessible. Need formal audit + fixes. | Run Lighthouse/axe-core across all routes, fix findings, document compliance | 8 | TODO |
| ONC-12 | (b)(3) eRx Network Integration | EPCS + PDMP complete. Missing: Surescripts/NCPDP SCRIPT transmission to pharmacy networks. | External: Surescripts enrollment + integration. Cannot be built without vendor agreement. | BLOCKED | TODO |
| ONC-13 | ONC Compliance Matrix Document | No unified tracking document mapping all 170.315 criteria with evidence for ACB. | New: `docs/compliance/ONC_170.315_CERTIFICATION_MATRIX.md` — formal evidence matrix | 2 | TODO |

**Session 3 subtotal:** ~10 hours + Surescripts (external timeline)

### Session 3 Notes

- **ONC-11:** WCAG AA audit should run Lighthouse accessibility on all primary routes and fix critical/serious findings. Document in compliance matrix.
- **ONC-12 is BLOCKED on external vendor:** Surescripts enrollment takes 3-6 months. Can proceed with certification on other criteria while this is in progress. PDMP + EPCS satisfy (b)(3) partially.
- **ONC-13:** The compliance matrix is the document Drummond Group will review. Map every criterion → code location → test evidence → screenshot.

---

## Regression Checks (Run After Each Session)

```bash
# After Session 1 — verify CPOE + demographics
grep -r "ServiceRequest" src/services/fhir/ --include="*.ts" -l    # Should find ServiceRequestService.ts
grep -r "implantable_device" supabase/migrations/ --include="*.sql" -l  # Should find device migration
grep -r "race\|ethnicity" src/types/patientContext.ts                   # Should find new fields

# After Session 2 — verify CDS + family history
grep -r "FamilyMemberHistory" src/services/fhir/ --include="*.ts" -l  # Should find service
grep -r "break.the.glass\|emergency_access" src/services/ --include="*.ts" -l  # Should find service
grep -r "formulary" src/components/admin/cpoe/ --include="*.tsx" -l   # Should find check in order form

# After Session 3 — verify compliance doc
ls docs/compliance/ONC_170.315_CERTIFICATION_MATRIX.md  # Should exist
```

---

## Timeline

| Session | Focus | Items | Hours | Target |
|---------|-------|-------|-------|--------|
| **1** | CPOE forms + demographics + device list | ONC-1 through ONC-5 | ~32 | Next session |
| **2** | CDS integration + family history + break-glass + integrity | ONC-6 through ONC-10 | ~19 | Session after |
| **3** | WCAG audit + compliance matrix + Surescripts prep | ONC-11 through ONC-13 | ~10 | Following |
| **ACB** | Drummond Group gap assessment + testing | External | 8-12 weeks | After Session 3 |

**Total implementation:** ~57 hours (3-4 sessions)
**ACB testing:** 8-12 weeks after code complete
**Budget:** $70-130K for Drummond Group (per archived recommendation)
