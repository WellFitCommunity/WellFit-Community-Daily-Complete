# Project State — Envision ATLUS I.H.I.S.

> **Read this file FIRST at the start of every session.**
> **Update this file LAST at the end of every session.**

**Last Updated:** 2026-04-21
**Last Session:** Patent-track IP + Guardian completion — MCP-10 (grouper SDK crash fix), Guardian Session 1 complete (GRD-1 through GRD-5), MCP-20 (mcp-patient-context-server built and shipped)
**Updated By:** Claude Opus 4.7 (1M context)
**Codebase Health:** 11,726 tests (583 suites), 0 lint warnings, 0 typecheck errors in changed files

---

## CURRENT PRIORITY — ONC 170.315 Certification Gap Closure (0/13)

**Tracker:** `docs/trackers/onc-certification-tracker.md`
**Status:** 0/13 items complete — tracker created, ready for autonomous execution
**Estimated total:** ~57 hours across 3-4 sessions
**ACB:** Drummond Group (Austin) recommended — $70-130K budget

### What's Already Certified-Ready (27+ criteria)
All (b)(1-2), (b)(6-7), (b)(10), (c)(1-3), (d)(1-5), (d)(9), (d)(12-13), (e)(1-3), (f)(1-2), (f)(4-5), (f)(7), (g)(4), (g)(6-10), SAFER (9/9), USCDI v3 (18/18), EPCS, (a)(4), (a)(6-8) — **no work needed, code complete.**

### Session Plan

| Session | Focus | Items | Hours | Status |
|---------|-------|-------|-------|--------|
| **1** | CPOE forms (meds, lab, imaging) + demographics (race/ethnicity) + implantable device list | ONC-1 through ONC-5 | ~32 | **NEXT** |
| **2** | CDS integration into CPOE + formulary activation + family health history + break-the-glass + data integrity | ONC-6 through ONC-10 | ~19 | PENDING |
| **3** | WCAG AA accessibility audit + Surescripts prep + ONC compliance matrix document | ONC-11 through ONC-13 | ~10 | PENDING |

### Tier 1 Blockers (Session 1)
- **ONC-1:** (a)(1) Medication order entry form — `MedicationRequestService` backend ready, UI needed
- **ONC-2:** (a)(2) Lab order entry form — new FHIR `ServiceRequest` service + UI
- **ONC-3:** (a)(3) Imaging order entry form — extends `ServiceRequest` for imaging category
- **ONC-4:** (a)(5) Race & ethnicity columns on `profiles` — migration + type update + form fields
- **ONC-5:** (a)(14) Implantable device list — FHIR `Device` + `DeviceUseStatement` + UI

### Tier 2 (Session 2)
- **ONC-6:** (a)(9) Wire CDS (guideline matcher + contraindication detector) into CPOE as blocking alerts
- **ONC-7:** (a)(10) Activate `formulary_cache` table in medication ordering workflow
- **ONC-8:** (a)(12) Structured family health history — FHIR `FamilyMemberHistory`
- **ONC-9:** (d)(6) Break-the-glass emergency access with time-limited override + supervisor notification
- **ONC-10:** (d)(7)/(d)(8) SHA-256 integrity hashes on exported records

### Tier 3 (Session 3)
- **ONC-11:** (g)(5) WCAG AA audit — Lighthouse/axe-core across all routes
- **ONC-12:** (b)(3) Surescripts enrollment — BLOCKED on external vendor (3-6 month timeline)
- **ONC-13:** Formal ONC compliance evidence matrix for Drummond Group

---

## NEW — PILOT DRIVEN — Nephrology Vertical + Acumen Epic Connect Integration (0/13)

**Tracker:** `docs/trackers/nephrology-module-tracker.md`
**Status:** 0/13 sessions — greenfield build, customer pilot identified
**Estimated total:** ~52-60 hours across 13 sessions
**Pilot driver:** Nephrology clinic on Acumen Epic Connect — established internal sponsor at the clinic
**Target timeline:** 6-8 weeks to first physician encounter scribed end-to-end (1 month possible if BAA + Fresenius FHIR provisioning move fast)

### Why This Matters
- First real customer pilot — beats horizontal "any specialty" pitch with concrete vertical + concrete clinic
- Acumen = Epic underneath → existing `EpicFHIRAdapter.ts` (645 lines), `fhirBulkExportService.ts` (466 lines), full SMART on FHIR auth flow are already built
- Cures Act + ONC Information Blocking Rule = clinic owns its data, no Fresenius approval needed beyond enabling FHIR client
- Nephrology data density (dialysis = ~150 visits/year/patient, dense labs, KDIGO guidelines) is where Compass Riley's longitudinal reasoning shines
- Strengthens Anthropic pitch: real pilot + real vertical = case study story

### Critical Path (External Gates)
1. **BAA executed with clinic** — 1-3 weeks
2. **Fresenius enables Epic FHIR client** — 1-4 weeks (most likely bottleneck — clinic IT files ticket)
3. **OAuth credentials provisioned + first FHIR pull** — 1-2 weeks
4. **First physician encounter scribed + DocumentReference written back** — 1-2 weeks

### Build Sequence (Internal)
| Phase | Sessions | What |
|-------|----------|------|
| Phase 1: Data Entry Forms | 1-6 | CKD registry, HD treatment + adequacy, vascular access, anemia + CKD-MBD, PD + transplant, office dashboard |
| Phase 2: Edge Functions | 7-8 | Core CRUD + alert dispatch (10 alert types: hyperkalemia, AKI, access infection, missed treatment, under-dialysis, etc.) |
| Phase 3: AI Services | 9-10 | CKD progression predictor, AKI risk, dialysis adequacy advisor, ESA dosing optimizer, patient summary |
| Phase 4: Acumen Integration + Advanced | 11-13 | **Session 11 = pilot go-live gate** (bi-directional FHIR sync), KDIGO content for `guidelineReferenceEngine`, ESRD billing (CPT 90935-90999), transplant workflow |

### MVP for pilot demo
Phases 1-2 + Session 11 = 9 sessions. Vertical and Acumen integration progress in parallel; Session 11 sequenced ahead of AI Phase 3 because go-live depends on data flowing.

### Open Questions for Maria's Meeting Today (2026-04-27)
See tracker for the 6 questions to bring to the clinic stakeholder conversation.

---

## NEW — SOC 2 Readiness: Policy & Evidence Gap Closure (0/14)

**Tracker:** `docs/trackers/soc2-readiness-tracker.md`
**Status:** 0/14 items — 8 policy templates **drafted** (Phase 1) and ready for Maria + Akima review/signature; 6 evidence items pending (Phase 2/3)
**Estimated total:** ~32 hours across 3-4 sessions
**Note:** We are NOT declaring SOC 2 compliance. SOC 2 requires an independent AICPA-certified auditor. This tracker prepares us for that engagement.

**Technical alignment:** ~80% (code + controls strong). **Paper alignment:** ~20% (policies, vendor evidence, pen test). This tracker closes the paper gap.

**Phase 1 — Policies (drafted 2026-04-21):**
- 8 policies in `docs/compliance/soc2-policies/` (ISP-001, ACP-002, IRP-003, BCP-004, DCR-005, CMP-006, VRM-007, AUP-008)
- Each cross-references actual controls (CLAUDE.md, rules/, migrations, edge functions)
- Requires Maria + Akima signature before being official

**Phase 2 — Evidence (pending):**
- Vendor SOC 2 reports + BAAs/DPAs (Supabase, Anthropic, MailerSend, Twilio, Vercel)
- Security training records
- Quarterly access review (first entry)
- DR tabletop exercise (first run)

**Phase 3 — External validation (pending):**
- Third-party pen test ($8-15K, not internal adversarial audit)
- SOC 2 evidence matrix (AICPA TSP 100 criterion → live artifact crosswalk)

---

## URGENT — Guardian Agent Gap Closure (5/9)

**Tracker:** `docs/trackers/guardian-system-tracker.md`
**Status:** 5/9 items complete — Session 1 shipped 2026-04-21. Session 2 (GRD-6 through GRD-9) pending.
**Estimated total:** ~10 hours remaining (Session 2)
**Risk:** Was HIGH — security alerts now fire end-to-end via cron + multi-channel.

**Session 1 (DONE):**
- ✅ **GRD-1:** cron scheduled via migration 20260421120000 + auth bypass fix + PagerDuty→internal swap (commit 44ef6789)
- ✅ **GRD-2:** createTicket() wired in both guardian-agent autoHeal and AgentBrain.initiateHealing (commit ce654114)
- ✅ **GRD-3:** Browser Guardian starts in all non-test modes (commit ce654114)
- ✅ **GRD-4:** Guardian API scan returns real findings from 4 parallel queries (commit ce654114)
- ✅ **GRD-5:** End-to-end test with 4 cases including auth-bypass regression guard (commit aa3ff030)

**Session 2 (PENDING):**
- **GRD-6:** Wire Guardian Eyes recordings to approval form (~3h)
- **GRD-7:** Create guardian_flow_config migration (~2h)
- **GRD-8:** Decision on guardian-pr-service — keep/wire/remove (needs Maria's input)
- **GRD-9:** Full end-to-end integration test (~4h)

**What works now:** Cron fires every minute, email+SMS+Slack+internal all deliver, tickets auto-create for non-performance auto-heal proposals, browser Guardian runs in dev/staging/prod, scan returns real security findings.
**What still doesn't:** Eyes→approval link (GRD-6), multi-facility ED crowding config (GRD-7), PR service wiring (GRD-8 decision).

---

## BACKLOG — Patient Avatar Improvements (0/6)

**Tracker:** `docs/trackers/avatar-improvement-tracker.md`
**Status:** 0/6 items complete — system is production-ready (A- grade) with minor gaps
**Estimated total:** ~32 hours across 2 sessions

**Key items:**
- **AVT-1:** Clinical data sync — markers don't reflect FHIR conditions/allergies/meds (patient safety)
- **AVT-2:** Marker search/filter — 15+ markers becomes unusable
- **AVT-3:** Export to PDF for nursing handoff
- **AVT-4-6:** Bulk import, history timeline UI, 3D marker persistence

---

## SECONDARY PRIORITY — MCP Chain Completion: Final Gaps (2/9)

**Tracker:** `docs/trackers/mcp-chain-completion-tracker.md`
**Status:** 2/9 items complete — 15 of 16 MCP servers are real end-to-end. 63 of 73 prior tracker items done (86%).
**Estimated total:** ~34 hours buildable + ~8-12h blocked on vendor
**Prior work:** 6 trackers (compliance, infrastructure, production-readiness, blind-spots, completion, hardening) — 63 items already resolved

### What's Already Done
- ✅ 15/16 MCP servers are real end-to-end (DB queries, external APIs, real logic)
- ✅ Chain orchestrator built with DB state machine, approval gates, retry logic
- ✅ Chains 1-6 defined in database with 29 integration tests
- ✅ Per-request auth binding, input validation, audit logging on all servers
- ✅ 85 prompt injection tests + 64 clinical constraint tests passing
- ✅ mcp-server-compliance-tracker: 23/23 DONE
- ✅ mcp-infrastructure-repair-tracker: 26/26 DONE
- ✅ **MCP-1:** `claude-chat` hardened — input sanitization + safety prompt (commit 7d267332)
- ✅ **MCP-2:** `claude-personalization` hardened — injection guard + drift protection (commit 7d267332)
- ✅ OpenAI references removed — Claude-only fallback chain (commit 7f0f329d)

### Session Plan

| Session | Focus | Items | Hours | Status |
|---------|-------|-------|-------|--------|
| ~~**1**~~ | ~~Security hardening — claude-chat relay, claude-personalization injection guard~~ | ~~MCP-1, MCP-2~~ | ~~7~~ | **DONE** (commit 7d267332) |
| **1** | Live adversarial testing — 40 attack prompts against hardened functions | MCP-3 | ~8 | **NEXT** |
| **2** | Revenue — RPM billing, wearable vitals dashboard, home vitals → FHIR conversion | MCP-4 through MCP-6 | ~26 | PENDING |
| **—** | Clearinghouse activation (when vendor creds arrive) | MCP-7 | ~8-12 | BLOCKED |

### Remaining Items
- ~~**MCP-1:** `claude-chat` relay — DONE (commit 7d267332)~~
- ~~**MCP-2:** `claude-personalization` — DONE (commit 7d267332)~~
- **MCP-3:** Live adversarial testing — 40 attack prompts against hardened functions (8h) — **NEXT**
- **MCP-4:** RPM billing infrastructure — CPT 99453-99458 enrollment + time tracking (12h)
- **MCP-5:** Wearable vitals → clinician dashboard — trend charts + threshold alerts (8h)
- **MCP-6:** Home vitals → FHIR Observation conversion — LOINC mapping + provenance (6h)
- **MCP-7:** Clearinghouse external API — BLOCKED on Waystar/Change Healthcare creds (8-12h)
- **MCP-8:** Cultural competency clinical review — waiting on Akima (0h code)
- **MCP-9:** Tool utilization gap (76/140 unwired) — ACCEPTED, deferred by design

### Session 3 — MCP Architecture Hygiene (added 2026-04-21)
- ~~**MCP-10:** Grouper SDK crash fix backported to standalone server — DONE (commit bef7b264)~~
- **MCP-10b:** Extract shared DRG 3-pass logic into `_shared/drgThreePassLogic.ts` (~6h)
- **MCP-11:** POA indicators in DRG grouper (HAC compliance) (~8h)
- **MCP-12:** Authoritative CMS DRG weight lookup table (~6h)
- **MCP-13:** Grouper safety gates — encounter type + age/sex + discharge disposition (~4h)
- **MCP-14:** Clinician ID in cost log, not patient (PHI audit fix + codebase-wide sweep) (~3h)
- **MCP-15:** Grouper idempotency / result caching (~2h)
- **MCP-16:** Grouper 600-line decomposition (~1h — naturally resolved if MCP-10b done first)
- **MCP-17:** Resolve `check_prior_auth_required` namespace collision (~1h)
- **MCP-18:** Resolve `submit_prior_auth` namespace collision (~1h)
- **MCP-19:** Rename `mcp-claude-server` → `mcp-atlus-reasoning-server` (~2h)
- ~~**MCP-20:** Build `mcp-patient-context-server` — DONE (commit 724249d4)~~
- **MCP-21:** Resolve `medical-codes` vs `medical-coding` naming collision (~2h)

---

---

## Active Tracker Index

For full priority detail, open the tracker referenced in each "## CURRENT PRIORITY" block above. The table below is the canonical registry of all live trackers.

| Tracker | Path | Status |
|---------|------|--------|
| **Nurse Handoff & Documentation** | `docs/trackers/nurse-handoff-documentation-tracker.md` | **COMPLETE — Feature 1 (3 sessions) + Feature 2 (3 sessions) all done** |
| **Compass Riley Reasoning** | `docs/trackers/compass-riley-reasoning-tracker.md` | **COMPLETE — all 10 sessions done** |
| **Patient Context Adoption** | `docs/trackers/patient-context-adoption-tracker.md` | **COMPLETE — all 6 phases done across 3 sessions** |
| L&D Module | `docs/trackers/ld-module-tracker.md` | COMPLETE — all 8 sessions done |
| **Tenant Admin Panel** | `docs/trackers/tenant-admin-panel-tracker.md` | **Sessions 1-5 COMPLETE (Tenant Suspension done)** |
| **Admin Panel Hardening** | `docs/trackers/envision-admin-panel-hardening-tracker.md` | **Tier 1-3 Session 5 DONE — 870+ tests, Tier 3 Sessions 6-7 TODO** |
| **MCP Server Compliance** | `docs/trackers/mcp-server-compliance-tracker.md` | **COMPLETE — 23/23 done, 8 sessions** |
| **Compass Riley V2 Reasoning** | `docs/trackers/compass-riley-v2-reasoning-modes-tracker.md` | **COMPLETE — 3/3 sessions done, 123 tests** |
| **Cultural Competency MCP** | `docs/trackers/cultural-competency-mcp-tracker.md` | **COMPLETE — 3 sessions, 138 tests** |
| **MCP Blind Spots** | `docs/trackers/mcp-blind-spots-tracker.md` | **10/12 fixed — S3-1 (clearinghouse) + S4-4 (idle tools) remain** |
| **MCP Completion** | `docs/trackers/mcp-completion-tracker.md` | **0/18 — NEW: Full ecosystem wiring (chains, tools, cost, security)** |
| Oncology Module | `docs/trackers/oncology-module-tracker.md` | Foundation BUILT, Phase 1 next (11 sessions total) |
| Cardiology Module | `docs/trackers/cardiology-module-tracker.md` | Foundation BUILT, Phase 1 next (12-13 sessions total) |
| Clinical Revenue Build | `docs/CLINICAL_REVENUE_BUILD_TRACKER.md` | Phase 1: 88%, Phase 2: 89% |
| Test Coverage Scale | `docs/TEST_COVERAGE_SCALE_TRACKER.md` | Stale (Feb 4) — needs refresh |

---

## Codebase Health Snapshot

| Metric | Value | As Of |
|--------|-------|-------|
| Tests | 10,951 passed, 0 failed | 2026-03-04 |
| Test Suites | 541 | 2026-03-04 |
| Typecheck | 0 errors (8GB heap — fixed OOM) | 2026-03-04 |
| Lint | 0 errors, 0 warnings | 2026-03-04 |
| God files (>600 lines) | 1 flagged: SOC2ComplianceDashboard (1,062 lines) — MCP servers all under 600 | 2026-02-27 |
| AI Model Versions | Centralized — 0 hardcoded strings remaining | 2026-02-23 |
| Edge Functions Deployed | 137+ functions, all live (7 MCP servers redeployed 2026-03-04) | 2026-03-04 |
| MCP Server Compliance | 23/23 complete | 2026-03-01 |
| MCP Blind Spots | 10/12 fixed (see `mcp-blind-spots-tracker.md`) | 2026-03-04 |
| MCP Completion | 0/18 — NEW tracker for full ecosystem wiring | 2026-03-10 |
| MCP Key Security | Per-server key isolation — 13 scoped keys, shared key revoked | 2026-03-04 |
| Congruency Audit | COMPLETE — all findings remediated | 2026-02-22 |

---

## History Archive

Prior session logs, completed initiatives, and historical progress notes have been moved to:

**[`docs/PROJECT_STATE_HISTORY.md`](./PROJECT_STATE_HISTORY.md)**

That file holds the chronological record. This file (PROJECT_STATE.md) is the live priority surface — keep it under 300 lines and link historical entries out as they roll off.
