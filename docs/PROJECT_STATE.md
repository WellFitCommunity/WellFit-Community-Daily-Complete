# Project State — Envision ATLUS I.H.I.S.

> **Read this file FIRST at the start of every session.**
> **Update this file LAST at the end of every session.**

**Last Updated:** 2026-03-11 (P1 COMPLETE — chain infrastructure done)
**Last Session:** Completed all 3 P1 items: retry gaps (P1-1), chains 2-5 definitions (P1-2), end-to-end verification with 31 new integration tests (P1-3). P1 is fully done. Next: P2 (revenue tool wiring).
**Updated By:** Claude Opus 4.6
**Codebase Health:** 11,162 tests (554 suites), 0 lint warnings, 0 typecheck errors

---

## MCP Ecosystem Completion (2026-03-10) — NEXT PRIORITY

**Tracker:** `docs/trackers/mcp-completion-tracker.md`
**Findings Report:** `docs/MCP_ECOSYSTEM_FINDINGS_2026-03-10.md`

**What:** Close ALL remaining MCP gaps — wire ~76 idle tools, define chains 2-5, add retry logic, activate clearinghouse, build unified cost dashboard, fix medical coding security.

**Why:** 128+ tools built across 14 servers, but only ~52 are callable from UI. Hospital pilot needs full tool coverage — "if we don't wire them all, something will get missed."

| Priority | Items | Status | Focus |
|----------|-------|--------|-------|
| P0 Tonight | 1 | 0/1 | Adversarial testing (Maria + Akima + Claude) |
| P1 Chain Infrastructure | 3 | 0/3 | Retry logic, chains 2-5, end-to-end verification |
| P2 Revenue Tool Wiring | 3 | 0/3 | Medical coding client, clearinghouse activation |
| P3 Clinical Tool Wiring | 3 | 0/3 | FHIR CRUD, prior auth queue, edge fn tools |
| P4 Reference Tool Wiring | 4 | 0/4 | PubMed, medical codes, CMS, NPI, HL7 idle tools |
| P5 Observability | 2 | 0/2 | Unified cost dashboard, cultural competency client |
| P6 Security Polish | 2 | 0/2 | Medical coding tenant_id fix, structured AI output |
| **Total** | **18** | **0/18** | |

**Estimated remaining:** ~55-65 hours across 7 sessions + tonight's adversarial testing

**Clearinghouse dependency:** Sandbox credentials arriving week of 2026-03-16. P2-2 blocked until then.

---

## Clinical Validation Hooks (2026-03-06) — COMPLETE

**Tracker:** `docs/trackers/clinical-validation-hooks-tracker.md`
**Design Doc:** `docs/CLINICAL_VALIDATION_HOOKS_ARCHITECTURE.md`
**Supporting Doc:** `docs/AI_AGENT_QUALITY_VARIANCE.md`

**What:** Runtime validation hooks that catch AI-hallucinated clinical codes (ICD-10, CPT, DRG, Z-codes) before they reach human reviewers. Validates against live CMS/NLM government APIs (free). Covers the full FHIR interoperability pipeline.

**Why:** Defense in depth. Constraints (preventive) + hooks (detective) + audit (proof). Answers the #1 hospital objection: "How do you know the AI isn't making things up?"

**Maria's Requirements:**
- Both **PDF export** AND **admin dashboard** — Akima reviews without reading code
- PDF for offline analysis, dashboard for live monitoring

| Phase | Focus | Est. Hours | Status |
|-------|-------|-----------|--------|
| 1. Reference Data | NLM API + ICD-10 cache + MS-DRG table | 8 | ✅ 4/4 |
| 2. Validator Module | `clinicalOutputValidator.ts` shared module | 8 | ✅ 3/3 |
| 3. Wire Into AI Functions | 10 AI edge functions wired | 6 | ✅ 2/2 |
| 4. Results Table | `validation_feedback` pushed + audit integration | 2 | ✅ 2/2 |
| 5. Admin Dashboard | Summary cards + rejection log + reference data health | 12 | ✅ 3/3 |
| 6. PDF Export | Validation report + DRG table + infrastructure | 6 | ✅ 3/3 |
| 7. Clinical Content Export | Cultural competency PDF + content review panel | 4 | ✅ 2/2 |
| **Total** | | **~46** | **19/19 ✅** |

**Failure behavior:** Option C implemented — flag codes with `_validated: false` but return for coder review. Learning loop via `validation_feedback` table.

**Next:** Visual acceptance from Maria on the dashboard. Then move to MCP Production Readiness P3 (data gaps) or P1-6 (adversarial testing).

**Flagged for decomposition (pre-existing >600 lines):** `ai-treatment-pathway` (974), `ai-fall-risk-predictor` (757), `ai-care-escalation-scorer` (777).

**Absorbs:** MCP tracker P1-1 (DRG table) and P1-8 (post-output validation) — now part of this tracker.

---

## MCP Production Readiness (2026-03-06) — IN PROGRESS

**Tracker:** `docs/trackers/mcp-production-readiness-tracker.md`

**Context:** Deep audit found 26 issues across functional correctness, clinical accuracy, safety infrastructure, integration gaps, and data completeness. Builds on prior compliance (23/23 done) and blind spots (10/12 done) trackers.

| Priority | Items | Status | Focus |
|----------|-------|--------|-------|
| P0 Broken | 5 | 5/5 | ALL DONE |
| P1 Clinical Risk | 9 | 6/9 | FHIR refs, X12 validation, HL7 depth, AI constraints, prompt injection, CMS freshness — DONE. Remaining: P1-1 (DRG table, needs Akima), P1-6 (adversarial testing), P1-8 (NOW part of Validation Hooks priority above) |
| P2 Integration Gap | 4 | 4/4 | ALL DONE |
| P3 Data Gap | 4 | 0/4 | CMS coverage, medical codes, clearinghouse, taxonomy |
| P4 Polish | 4 | 0/4 | Auth tokens, FHIR search, conformance, clinical review |

**Estimated remaining:** ~55 hours across 5-7 sessions (reduced — P1-8 absorbed into Validation Hooks)

**Note:** P1-8 (post-output validation) has been expanded into the Clinical Validation Hooks architecture above. It is no longer a standalone tracker item — it's the foundation of the full validation system including dashboard + PDF export.

**Prior session completed (same day, earlier):**
- **P1-5 FIXED:** Wired `buildConstraintBlock()` into all 13 active AI edge functions
- **P1-7 FIXED:** Built `promptInjectionGuard.ts` — 11 patterns, wired into 6 free-text functions
- **P1-9 FIXED:** Built `referenceDataFreshness.ts` + `reference_data_versions` migration + health-monitor integration
- **P2-1 FIXED:** Fee schedule resolver for $0 CPT/HCPCS charges
- **P2-3 FIXED:** Structured AI output via `tool_choice` pattern (DRG grouper + revenue optimizer)
- **P2-4 FIXED:** Approval role enforcement in chain orchestrator

**Next MCP session priority:** P1-1 (DRG validation table — Akima review needed for which fiscal year and whether reference table is sufficient) or P3-2 (medical codes seeding — can proceed autonomously with NLM API integration).

---

## Compass Riley V2 — Reasoning Modes (2026-03-01) — COMPLETE

**Tracker:** `docs/trackers/compass-riley-v2-reasoning-modes-tracker.md`

| Session | Focus | Status |
|---------|-------|--------|
| 1 | Reasoning Engine Core (7 modules, 69 tests) | **DONE** |
| 2 | Integration (pipeline orchestrator, edge functions, UI, audit) | **DONE** |
| 3 | Testing & Audit (54 tests: triggers, output, override, sensitivity, edge cases, smoke) | **DONE** |

**Session 3 deliverables (all DONE):**
- `compassRileyReasoningV2.test.ts` (430 lines, 25 tests) — pipeline orchestrator, serialization, edge cases (zero diagnoses, null chief complaint, sparse transcript, contradictory data, extreme confidence, single diagnosis, all-ruled-out)
- `compassRileyReasoningV2Integration.test.ts` (546 lines, 29 tests) — output format verification (chain/caution/tree), override warning format, sensitivity boundary tests (all 3 levels at exact boundary values), reason code audit payload shape, integration smoke tests (6 clinical scenarios: rural HTN, academic ED, polypharmacy, user override flow, progressive encounter, pediatric dosing)

**New files:**
- `src/services/__tests__/compassRileyReasoningV2.test.ts`
- `src/services/__tests__/compassRileyReasoningV2Integration.test.ts`

**Total Compass Riley V2 test coverage:** 123 tests (69 Session 1 + 54 Session 3)

---

## Compass Riley — Ambient Learning & Physician Intuition Engine (2026-03-01) — COMPLETE

**Tracker:** `docs/trackers/compass-riley-ambient-learning-tracker.md`

| Session | Focus | Status |
|---------|-------|--------|
| 1 | Wire Disconnected Features (6 deliverables: voice profile update, accuracy tracking, correction reinforcement, stale decay, learning progress UI, milestone celebrations) | **DONE** |
| 2 | Clinical Style Profiler (SOAP note edit observation, style fingerprint, specialty-aware terminology) | **DONE** (code complete, migrations pushed, tests in Session 4) |
| 3 | Intuitive Adaptation Engine (auto-calibrating assistance, proactive corrections, adaptive SOAP generation) | **DONE** |
| 4 | Testing & Verification (learning lifecycle, maturity progression, style profiler, edge cases) | **DONE** |

**Session 1 deliverables (all DONE):**
- 1.1: `updateVoiceProfile()` called fire-and-forget at session end (maturity scoring via edge function)
- 1.2: `VoiceLearningService.updateAccuracy()` updates running average at session end
- 1.3: `reinforceCorrection()` called per applied correction during live transcription
- 1.4: `decayOldCorrections(60 days)` runs on session mount (idempotent, stale cleanup)
- 1.5: `VoiceLearningProgress` rendered in compact mode post-session
- 1.6: `EAAffirmationToast` milestone celebrations from edge function response (10/50/fully-adapted)
- 1.7: Smart section ordering — skipped (dashboard concern, not scribe pipeline)

**Files modified:** `useSmartScribe.ts` (585 lines), `audioProcessor.ts` (346), `scribeRecordingService.ts` (291), `RealTimeSmartScribe.tsx` (318), `aiTransparencyService.ts` — all under 600 lines.

**Commit:** `fc96a78e` — `feat(compass-riley): wire disconnected ambient learning features`

**Session 2 deliverables (all DONE):**
- 2.1: `soapNoteEditObserver.ts` (236 lines) — word-level diffing of SOAP note edits using `diffWords`
- 2.2: `physicianStyleProfiler.ts` (376 lines) — EMA-based style profiling, verbosity scoring, terminology overrides, specialty detection
- 2.3: `physician_style_profiles` table + `physician_note_*` columns on `scribe_sessions` — migrations pushed
- 2.4: Specialty-aware terminology in `voiceLearningService.ts:applyCorrections()` — `specialtyContext` parameter
- 2.5: `EditableSOAPNote.tsx` (314 lines) + `PhysicianStyleProfile.tsx` (225 lines) — editable SOAP + style transparency UI
- 2.6: `ai-soap-note-generator` decomposed into 5 focused modules (types, contextGatherer, promptBuilder, responseNormalizer, usageLogger)

**New files:** `soapNoteEditObserver.ts`, `physicianStyleProfiler.ts`, `EditableSOAPNote.tsx`, `PhysicianStyleProfile.tsx`, `ai-soap-note-generator/{types,contextGatherer,promptBuilder,responseNormalizer,usageLogger}.ts`
**Modified:** `useSmartScribe.ts`, `scribeRecordingService.ts`, `RealTimeSmartScribe.tsx`, `voiceLearningService.ts`, `ai-soap-note-generator/index.ts`
**Fixed:** `20260228000001_unified_mcp_audit_logs.sql` — `uuid = text` type mismatch in RLS policy

**Session 3 deliverables (all DONE):**
- 3.1: `computeAutoCalibration()` in `useScribePreferences.ts` — suggests assistance level change after 10+ sessions based on physician's verbosity pattern
- 3.2: `proactiveCorrectionDetector.ts` (97 lines) — factory-pattern per-session phrase tracker; surfaces terms appearing ≥3× without high-confidence correction
- 3.3: `useSessionPatternLearning.ts` (~90 lines) — queries last 20 scribe sessions to compute avg duration for adaptive cadence guidance
- 3.4: Dictation cadence awareness in `audioProcessor.ts` — per-chunk WPM + pause pattern ('fast'/'normal'/'deliberate') via `onCadenceUpdate` callback
- 3.5: Adaptive SOAP generation — `ai-soap-note-generator` fetches physician style profile from DB via JWT and injects verbosity/specialty/terminology into SOAP prompt
- Decomposed: `useScribeDemoMode.ts` extracted from `useSmartScribe.ts` (624→522 lines)
- Tests: `src/services/__tests__/ambientLearningSession3.test.ts` — 14 tests (computeAutoCalibration ×7, createProactiveCorrectionDetector ×7)

**New files (Session 3):** `proactiveCorrectionDetector.ts`, `useScribeDemoMode.ts`, `useSessionPatternLearning.ts`, `ambientLearningSession3.test.ts`
**Modified (Session 3):** `useScribePreferences.ts`, `audioProcessor.ts`, `scribeRecordingService.ts`, `useSmartScribe.ts`, `ai-soap-note-generator/{index,types,promptBuilder}.ts`

---

## Deep Congruency Audit (2026-02-21) — COMPLETE

**Full audit report:** [`docs/DEEP_CONGRUENCY_AUDIT_2026-02-21.md`](DEEP_CONGRUENCY_AUDIT_2026-02-21.md)

**Status: ALL FINDINGS REMEDIATED.** Original score 8.4/10. All 4 Critical, 9 Moderate, and 6 Low findings resolved across 4 remediation sessions + 1 patientContextService session.

**Remediation summary:**
- C-1: 8 throw→failure() conversions (DONE)
- C-2: 14 duplicate types consolidated (DONE)
- C-3: PinnedSectionsContext verified + defensive guard (DONE)
- C-4: 63+ `as Error` → `instanceof Error` narrowing (DONE)
- M-1/M-2: 14 god files decomposed (8 edge fn → 61 modules, 6 type files → 30 sub-files) (DONE)
- M-3: SELECT * — 270 files fixed (DONE, commit `50c29cb5`)
- M-4: Auto-generated database types + `npm run db:types` script (DONE)
- M-5/M-6: Edge function logging fixes (DONE)
- L-5: 919 catch blocks → explicit `catch (err: unknown)` (DONE, commit `0895fb94`)
- All remaining low-priority items (DONE)

---

## MCP Server Compliance & Hardening (2026-02-27) — COMPLETE

**Tracker:** `docs/trackers/mcp-server-compliance-tracker.md`
**Cross-audit:** Claude Opus 4.6 (compliance) + ChatGPT (code-level security)

| Priority | Items | Status |
|----------|-------|--------|
| P0 Critical (Security) | 8 | **8/8 done** (P0-1 through P0-8) |
| P1 Hardening | 3 | **3/3 done** (P1-1, P1-2, P1-3) |
| P2 Moderate (Functional) | 7 | **7/7 done** (P2-1 through P2-7; UI touchpoints wired 2026-03-03, chain orchestration engine built 2026-03-04) |
| P3 Low (Polish) | 5 | **5/5 done** (P3-1 through P3-5) |
| **Total** | **23** | **23/23 done** (Chain 6 Medical Coding Processor deferred — standalone project) |

**Session plan — ALL COMPLETE:**
- ~~Session 1: P0-1 through P0-4~~ — **DONE** (auth binding, tenant isolation, base64url fix, SECURITY DEFINER)
- ~~Session 2: P0-5~~ — **DONE** (6 MCP servers decomposed: 929→224 max, 28 files changed)
- ~~Session 3: P0-6/7/8 + P1-1~~ — **DONE** (SELECT *, rate limiting, auth gate, JWKS — 10 files changed)
- ~~Session 4: P1-2/3, P2-1~~ — **DONE** (tools auth, rate limit identity, input validation — 8 files changed, 1 new)
- ~~Session 5: P2-2 through P2-6~~ — **DONE** (config, timeouts, unified audit, health dashboard — 15 files changed)
- ~~Session 6: P3-1 through P3-5~~ — **DONE** (persistent rate limits, key management, body limits, pricing, provenance — 17 files changed)

**P2-7 (Cross-Server Chains) — 4 sessions across 2 days:**
- **UI Touchpoints (2026-03-03, 2 sessions):** Individual MCP server tools wired to admin UI components. Each component calls one server — not automated multi-server pipelines. See "MCP Server UI Touchpoints" section below.
- **Chain Orchestration Engine (2026-03-04, 2 sessions):** Database-driven state machine (5 tables), edge function orchestrator, browser service (7 methods), admin UI panel (7 components). Chains 1 + 6 defined in DB. End-to-end execution not yet tested.
- **Chain definitions 2-5:** Not yet created in DB (UI touchpoints exist but no orchestration definitions).
- **Chain 6 (Medical Coding Processor):** 11 MCP tools built (2026-03-03), chain definition seeded in DB (2026-03-04). No browser client yet.

---

## MCP Server Ecosystem Audit (2026-02-21)

**Full audit report:** [`docs/MCP_SERVER_AUDIT.md`](MCP_SERVER_AUDIT.md)

**Summary:** 13 MCP servers, ~100 total tools, 3 security tiers. All 13 LIVE after Tier 3 auth fix (VARCHAR/TEXT type mismatch in `validate_mcp_key`). 10 of 13 wired to UI. UI touchpoints for chains 1-5 wired (2026-03-03). Chain orchestration engine built (2026-03-04) with chains 1 + 6 defined in DB.

## MCP Server UI Touchpoints (2026-03-03)

> **Important:** These are UI touchpoints — individual MCP server tools wired to admin components. Each component calls ONE server. These are NOT automated multi-server pipelines. For actual orchestration, see the Chain Orchestration Engine below.

**Session 1 — commit `fa093112`** (10,474 tests passing, 0 lint warnings):

| Server | Component | What Was Added |
|--------|-----------|---------------|
| NPI Registry | `BillingProviderForm.tsx` | Address display in Registry Data card |
| Clearinghouse | `ClearinghouseConfigPanel.tsx` | `testConnection()` via MCP; Connected badge + payer list; "not configured" banner |
| Medical Codes | **NEW** `MedicalCodeSearch.tsx` (273 lines) | CPT/ICD-10/HCPCS search widget, debounce, bundling check |
| Medical Codes | `BillingQueueDashboard.tsx` | Collapsible Code Lookup panel with validation |
| CMS Coverage | `EligibilityVerificationPanel.tsx` | Inline PA Required / No PA Needed badge per row |
| Clearinghouse | `ClaimResubmissionDashboard.tsx` | Status button per claim + rejection guidance |

**Session 2 — commit `33471bc7`** (10,681 tests passing, 0 lint warnings):

| Server | Component | What Was Added |
|--------|-----------|---------------|
| PubMed | **NEW** `PubMedEvidencePanel.tsx` (266 lines) | Collapsible literature search in PA create form |
| Prior Auth | **NEW** `mcpPriorAuthClient.ts` (252 lines), `usePriorAuthMCP.ts` (187 lines) | 11 MCP tools, decision/appeal/FHIR modals, PA-required auto-check |
| NPI + FHIR | **NEW** `npiToFHIRMapper.ts` (240 lines) | NPI→FHIR Practitioner mapper + Create button |
| HL7-X12 | **NEW** `X12Generate837PPanel.tsx` (467 lines) | Full claim form + Generate 837P tab in HL7 Lab |
| FHIR | `fhir-interoperability/SyncTab.tsx` | EHR Sync Trigger — Sync All Active button |

God file decomposition (0 breaking changes):
- FHIRInteroperabilityDashboard: 821→8 files (`fhir-interoperability/`)
- PriorAuthDashboard: 592→10 files (`prior-auth/`)
- HL7MessageTestPanel: 549→7 files (`hl7-message-test/`)

## MCP Chain Orchestration Engine (2026-03-04)

> Database-driven state machine for multi-server MCP pipelines. This is the infrastructure that will eventually power automated chains.

**Session 1 — commit `891736b2`:**
- 5 database tables (`chain_definitions`, `chain_step_definitions`, `chain_runs`, `chain_step_results`, `mcp_audit_logs`)
- Edge function orchestrator (`mcp-chain-orchestrator/`, 6 files, ~1,225 lines)
- Browser service (`chainOrchestrationService.ts`) with 7 methods
- 21 behavioral tests
- Chains 1 (Claims Pipeline) + 6 (Medical Coding → Revenue) defined in DB

**Session 2 — commit pushed 2026-03-04:**
- Migrations pushed to remote database
- Admin UI panel (`mcp-chains/`, 7 components + types file)
- 28 component tests + 3 service tests
- Panel registered in admin dashboard (lazy import + section definition)

**Current state:**
- Orchestration engine is complete and tested (unit tests)
- Chains 1 + 6 have DB definitions with step-by-step orchestration
- Chains 2, 3, 4, 5 have UI touchpoints but NO DB chain definitions yet
- No chain has been executed end-to-end (needs manual verification with test encounter)

## Per-Server MCP Key Isolation (2026-03-04) — COMPLETE

> Commit `e050bc88` — fixes S2-1 from the MCP Blind Spots tracker.

Replaced the shared MCP key (`mcp_deb87fb957ded...`) with 13 scoped keys — one per server. If one key leaks, only that server is compromised.

| Deliverable | Details |
|------------|---------|
| Migration | `20260304000003_per_server_mcp_keys.sql` — creates 13 keys with server-specific scopes, revokes shared key |
| Edge functions updated | 7 servers updated with `requiredScope` parameter on auth checks |
| Admin panel | 3 new scopes added to MCPKeyManagementPanel (pubmed, cultural_competency, medical_coding) |
| Migration pushed | 2026-03-04 |
| Functions deployed | 7 MCP servers redeployed 2026-03-04 |

## Skills Overhaul — Partial (2026-03-03) — IN PROGRESS

> Commit `dd69bdf7` — 3 of 10 new skills built/rewritten.

| Skill | Status | Notes |
|-------|--------|-------|
| `/onboard-tenant` | **BUILT** (NEW) | 10-step tenant onboarding — CORS, DB, branding, modules, roles, AI config, RLS verification |
| `/demo-ready` | **REWRITTEN** | 12-check hospital pilot readiness (removed stale Methodist Dec 2025 references) |
| `/security-scan` | **REWRITTEN** | 11-check HIPAA scan (MCP server security, CORS wildcards, edge function auth, any regression) |
| `SKILLS_AND_COMMANDS.md` | **REWRITTEN** | Updated from Nov 2025 to current (8 skills, correct baselines) |

**White-Label Branding Fixes (same commit):**
- Added `websiteUrl`, `tagline`, `poweredBy` to BrandingConfig interface
- WelcomeHeader, Footer, GlobalHeader now use `useBranding()` context instead of hardcoded values
- AppHeader admin route exclusion: replaced stale 54-route hardcoded list with dynamic derivation from `routeConfig.ts`

**Remaining skills (7 of 10 not yet built):**
- `/pilot-prep`, `/session-start`, `/fhir-check`, `/clinical-validate`, `/deploy-edge`, `/god-check`, `/audit-check`
- Nice-to-have: `/ai-report`, `/health`

## Chain 6 Medical Coding Processor (2026-03-03) — COMPLETE

> Commit `5a50c529` — 11 MCP tools across 3 build sessions.

| Session | Tools Built |
|---------|------------|
| 1 | Payer rules engine: `get/upsert_payer_rule`, `get_revenue_projection`, `ping` |
| 2 | Charge aggregation: `aggregate_daily_charges`, `get/save_daily_snapshot` + DRG Grouper AI: `run_drg_grouper`, `get_drg_result` |
| 3 | Revenue optimizer AI: `optimize_daily_revenue` + Charge validation: `validate_charge_completeness` |

2 AI tools (Claude Sonnet), 9 database/rules tools. 3 tables + RLS + migration.

---

## Current Priority Summary

### COMPLETE

| Feature | Tracker | Sessions | Completed |
|---------|---------|----------|-----------|
| Compass Riley V2 — Reasoning Modes | `compass-riley-v2-reasoning-modes-tracker.md` | 3/3 | 2026-03-01 |
| Compass Riley — Ambient Learning | `compass-riley-ambient-learning-tracker.md` | 4/4 | 2026-03-01 |
| Patient Context Adoption | `patient-context-adoption-tracker.md` | 3/3 (6 phases) | 2026-02-23 |
| LD Module (Tier 1+2) | `ld-module-tracker.md` | 7/7 | 2026-02-18 |
| Oncology Foundation | `oncology-module-tracker.md` | done | 2026-02-17 |
| Cardiology Foundation | `cardiology-module-tracker.md` | done | 2026-02-17 |
| Guardian Agent Audit | `guardian-agent-audit-tracker.md` | 3/3 | 2026-02-27 |
| Nurse Handoff Documentation | `nurse-handoff-documentation-tracker.md` | done | — |
| Compass Riley Reasoning (v1) | `compass-riley-reasoning-tracker.md` | 10/10 | — |
| MCP Server UI Touchpoints | (PROJECT_STATE inline) | 2 sessions | 2026-03-03 |
| MCP Chain Orchestration Engine | (PROJECT_STATE inline) | 2 sessions | 2026-03-04 |
| Per-Server MCP Key Isolation | (PROJECT_STATE inline) | 1 session | 2026-03-04 |
| Chain 6 Medical Coding Processor | (PROJECT_STATE inline) | 3 sessions | 2026-03-03 |
| Cultural Competency MCP | `cultural-competency-mcp-tracker.md` | 3 sessions | 2026-03-03 |
| Compass Riley — Ambient Learning | `compass-riley-ambient-learning-tracker.md` | 4 sessions | 2026-03-01 |

### RECENTLY COMPLETED

| Feature | Tracker | Completed |
|---------|---------|-----------|
| Skills Overhaul (partial: 3/10) | (PROJECT_STATE inline) | 2026-03-03 — `/onboard-tenant` NEW, `/demo-ready` + `/security-scan` rewritten |

### DEFERRED POLISH (low priority, do when convenient)

| Feature | Tracker | What's Left |
|---------|---------|-------------|
| Tenant Admin Panel Phase 2 | `tenant-admin-panel-tracker.md` | Suspension UI (1 item) |
| Envision Admin Hardening | `envision-admin-panel-hardening-tracker.md` | 24 untested components |

### NOT STARTED (future work)

| # | Feature | Estimate | Notes |
|---|---------|----------|-------|
| 1 | Skills Overhaul — 10 new + 5 updates | 2-3 sessions | `/onboard-tenant` is highest value |
| 2 | LD Module Tier 3 Moonshots | 4-5 sessions | Birth plan AI, PPD warning, contraindication, patient education |
| 3 | Oncology Production Build | ~11 sessions | Foundation done, needs full production features |
| 4 | Cardiology Production Build | ~12-13 sessions | Foundation done, needs full production features |

---

## Compass Riley V2 + Cultural Competency — Design Decisions (Reference)

**Designed:** 2026-02-28 brainstorm session (Maria + Claude Opus 4.6 + ChatGPT + Perplexity)

- **Compass Riley V2:** COMPLETE. "Reason broadly, speak narrowly" — Tree of Thought internal, Chain of Thought output. 3 modes: AUTO, FORCE_CHAIN, FORCE_TREE. Proportional response by confidence score.
- **Cultural Competency:** COMPLETE (Sessions 1-3). 8 population profiles, MCP server with 8 tools, wired into 7 AI skills + Compass Riley tree trigger. 138 tests (82 behavioral + 35 integration + 21 audit). Session 4 (DB-backed profiles) deferred.

---

## Upcoming: Skills Overhaul — 10 New Skills + 5 Updates

**Assessment:** `docs/SKILLS_ASSESSMENT_2026-02-28.md`
**System Readiness:** `docs/SYSTEM_READINESS_ASSESSMENT_2026-02-28.md`

**5 existing skills need updating** (outdated test counts, stale references, `/demo-ready` still says Methodist Dec 2025):
- `/security-scan`, `/demo-ready`, `/cost-check`, `/test-runner`, `/pre-commit`
- `SKILLS_AND_COMMANDS.md` needs full rewrite (last updated Nov 2025)

**10 new skills to build** (all approved by Maria 2026-02-28):

| # | Skill | Command | Priority | Value |
|---|-------|---------|----------|-------|
| 1 | **Tenant Onboard** | `/onboard-tenant` | **HIGHEST** | Repeatable process when an org signs up — CORS, branding, modules, roles, admin account, domain, edge redeploy, AI config, RLS verification |
| 2 | Pilot Prep | `/pilot-prep` | High | Hospital pilot readiness — replaces stale `/demo-ready` |
| 3 | Session Start | `/session-start` | High | Automates session start protocol (read PROJECT_STATE, report status) |
| 4 | FHIR Check | `/fhir-check` | High | FHIR R4 compliance, interop endpoints, SMART on FHIR validation |
| 5 | Clinical Validation | `/clinical-validate` | High | SOAP note accuracy, readmission predictions, grounding rules |
| 6 | Deploy Edge | `/deploy-edge` | Medium | Edge function deployment with pre/post verification |
| 7 | God File Check | `/god-check` | Medium | Scan for >600 line violations |
| 8 | Audit Trail | `/audit-check` | Medium | Verify audit logging coverage for SOC2 |
| 9 | AI Transparency Report | `/ai-report` | Nice-to-have | Generate HTI-2 transparency report for all AI skills |
| 10 | Codebase Health | `/health` | Nice-to-have | Quick snapshot: tests, lint, typecheck, god files, bundle size |

**Maria's note:** `/onboard-tenant` is the largest value-add. "Valuable on a great level."

**Status:** 3/10 DONE (commit `dd69bdf7` 2026-03-03). `/onboard-tenant` built, `/demo-ready` + `/security-scan` rewritten. 7 remaining.

---

## Secondary Priority: Admin Panel Hardening — Tier 3 Session 6

**Tracker:** `docs/trackers/envision-admin-panel-hardening-tracker.md`

| Tier | Status | What Was Done |
|------|--------|---------------|
| Tier 1 (1.1-1.3) | DONE | RLS verification, SDOHCoderAssist wrapper, Tenant Suspension |
| Tier 2 Session 1 (2.1-2.7) | DONE | 79 behavioral tests for 6 clinical/FHIR components |
| Tier 2 Session 2 (2.8-2.13) | DONE | 135 behavioral tests for 6 billing/revenue components |
| Tier 2 Session 3 (2.14-2.20) | DONE | 172 behavioral tests for 7 compliance/security components |
| Tier 2 Session 4 (2.21-2.27) | DONE | 264 behavioral tests for 7 admin operations components |
| Tier 3 Session 5 (3.1-3.8) | DONE | 220 behavioral tests for 8 AI & monitoring components |
| Tier 3 Sessions 6-7 | TODO | Medium-priority test coverage (17 components) |
| Tier 4 | TODO | Nice-to-haves (8 items) |

**Next:** Tier 3 Session 6 — Admin Utilities tests (~6 hours, 1 session)

---

## Previous Priority: L&D Module COMPLETE

All 8 L&D sessions finished. Full data entry, monitoring, billing, FHIR, alerts, and 11 AI integrations across 3 tiers.

**Tracker:** `docs/trackers/ld-module-tracker.md`

---

## Active Trackers (Fixed Paths)

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

## MCP Server Wiring Progress

| # | Server | Wired? | Target UI | Session |
|---|--------|--------|-----------|---------|
| 1 | NPI Registry | DONE | BillingProviderForm (provider onboarding) | 2026-02-21 |
| 2 | CMS Coverage | DONE | SuperbillReviewPanel + EligibilityVerificationPanel | 2026-02-21 |
| 3 | PubMed | DONE | DrugInteractionsTab (evidence citations) | 2026-02-21 |
| 4 | Clearinghouse | BLOCKED | Needs vendor credentials (Waystar/Change/Availity) | — |
| 5 | Postgres Analytics | DONE | SystemAdminDashboard (PlatformKPIPanel) + 14 query hooks | 2026-02-21 |
| 6 | Medical Codes | DONE | BillingQueueDashboard (CPT/ICD validation) | 2026-02-21 |
| 7 | Claude AI | DONE | Already wired (claudeService) | Pre-audit |
| 8 | FHIR | DONE | Already wired (FHIRInteroperabilityDashboard) | Pre-audit |
| 9 | HL7-X12 | DONE | HL7MessageTestPanel (parse/validate/convert) | 2026-02-21 |
| 10 | Prior Auth | DONE | Already wired (PriorAuthorizationManager) | Pre-audit |
| 11 | Edge Functions | DONE | Already wired (mcpEdgeFunctionsClient) | Pre-audit |
| 12 | Cultural Competency | DONE | 8 tools consumed by AI edge functions (by design, not direct UI) | 2026-03-03 |
| 13 | Medical Coding | DONE | 11 tools, no browser client yet (chain 6 orchestration defined) | 2026-03-03 |

**Progress: 12 of 13 wired. Only Clearinghouse (#4) remains — blocked on vendor credentials. Medical Coding (#13) has server tools but no browser client.**

---

## What Was Completed Recently (2026-03-03 through 2026-03-04)

### 2026-03-04: Per-Server MCP Key Isolation (commit `e050bc88`)
- Replaced shared MCP key with 13 scoped keys (1 per server)
- Migration `20260304000003_per_server_mcp_keys.sql` pushed to remote
- 7 MCP edge functions redeployed with `requiredScope` auth
- Fixes S2-1 from MCP Blind Spots tracker

### 2026-03-04: MCP Chain Orchestration Session 2 (commit `e142a5c9`)
- Admin UI panel: 7 components (`mcp-chains/`) + types file
- 28 component tests + 3 service tests
- Panel registered in admin dashboard (lazy import + section definition)
- Migrations pushed to remote

### 2026-03-04: MCP Chain Orchestration Session 1 (commit `891736b2`)
- Database-driven state machine: 5 tables, edge function orchestrator, browser service
- 21 behavioral tests
- Chains 1 (Claims Pipeline) + 6 (Medical Coding → Revenue) defined in DB

### 2026-03-03: `/onboard-tenant` Skill + Branding Fixes (commit `dd69bdf7`)
- NEW `/onboard-tenant` skill — 10-step tenant onboarding
- Rewrote `/demo-ready` (12 checks) and `/security-scan` (11 checks)
- White-label branding: WelcomeHeader, Footer, GlobalHeader use `useBranding()` context
- AppHeader: replaced 54-route hardcoded exclusion list with dynamic derivation

### 2026-03-03: Chain 6 Medical Coding Processor (commit `5a50c529`)
- 11 MCP tools across 3 build sessions (2 AI + 9 database/rules)
- 3 tables + RLS + migration
- Revenue cycle logic: DRG grouper, charge aggregation, revenue optimization

---

### Previous: Compass Riley V2 Session 1 — Reasoning Engine Core (2026-03-01)

Built 7 core modules + barrel export in `supabase/functions/_shared/compass-riley/` for Chain of Thought / Tree of Thought proportional reasoning. 69 tests.

**Tests: 10,396 passed, 0 failed (520 suites)**

---

### Previous: MCP Server Compliance Session 6 — P3-1 through P3-5 (ALL P3 COMPLETE)

Completed all 5 P3 (Low/Polish) items. MCP Server Compliance tracker is now 23/23 complete.

| Item | Fix | Files Changed |
|------|-----|---------------|
| **P3-1: Persistent rate limiting** | `mcp_rate_limit_entries` table + `check_rate_limit()` RPC (atomic increment-and-check). Hybrid approach: in-memory for IP-based DoS, Supabase RPC for identity-based cross-instance persistence. Graceful fallback if RPC fails. Wired into Prior Auth, Edge Functions, Claude servers. | 4 files (1 migration) |
| **P3-2: Key rotation admin UI** | `MCPKeyManagementPanel` component + `mcpKeyManagementService.ts` service. Create, rotate (new key + revoke old), revoke with confirmation. Expiry alert banner warns 14 days before expiration. Super_admin only (RLS). 13 behavioral tests. Wired into admin panel sections. | 6 files (3 new) |
| **P3-3: Request body size limits** | `checkBodySize()` in `mcpServerBase.ts` — Content-Length header check (zero overhead). 512KB for standard servers, 2MB for FHIR/HL7 (large payloads). Returns 413 Payload Too Large. Wired into 7 servers. | 8 files |
| **P3-4: Dynamic pricing** | Centralized `MODEL_PRICING` record + `calculateModelCost()` in `_shared/models.ts`. Replaced hardcoded `calculateCost` in Claude server. Added Opus pricing (was missing). | 2 files |
| **P3-5: Confidence + provenance** | `MCPProvenance` interface + `buildProvenance()` helper. Applied server-appropriate values: Claude=`ai_generated` + clinical review flags, FHIR/Postgres=`database` + freshness, HL7/X12=`computed`, Medical Codes=`reference_only`. | 8 files |

**Files changed: 17 (13 modified, 4 new)**
**Tests: 10,327 passed, 0 failed (519 suites)**
**Lint: 0 errors, 0 warnings**
**Typecheck: 0 errors**

---

### MCP Server Compliance Session 5 (2026-02-28) — P2-2 through P2-6

Completed 5 of the 7 P2 items (P2-7 deferred).

| Item | Fix |
|------|-----|
| **P2-2: Server config** | Centralized `SERVER_CONFIG` objects with name, version, tier across all servers |
| **P2-3: Timeout/retry** | Edge function timeout configuration for external API calls |
| **P2-4: Unified audit** | Unified `auditMCPToolCall()` logging across 5 MCP servers |
| **P2-5: Docs** | Updated feature list and user manual with MCP server documentation |
| **P2-6: Health dashboard** | `MCPServerHealthPanel` admin component + `mcpHealthService.ts` for real-time health monitoring of all 11 servers |

---

### MCP Server Compliance Session 4 (2026-02-28) — P1-2, P1-3, P2-1

Completed all 3 Session 4 items: tools/list auth gating on admin servers, identity-based rate limiting, and input validation framework.

| Item | Fix | Files Changed |
|------|-----|---------------|
| **P1-2: tools/list auth** | Added `extractCallerIdentity()` check before `tools/list` on all 5 Tier 3 servers. Returns 401 for unauthenticated callers. `initialize` stays public per MCP protocol. | 5 files |
| **P1-3: Rate limit identity** | Added `getCallerRateLimitId(caller)` to `mcpRateLimiter.ts` — returns `mcp_key:{keyId}` or `user:{userId}:{tenantId}`. Added identity-based rate limit as second check (after auth gate) in 3 servers. | 4 files |
| **P2-1: Input validation** | Created `mcpInputValidator.ts` (401 lines) — declarative validation framework with healthcare-specific validators (UUID, NPI with Luhn, CPT, HCPCS, ICD-10, dates, state codes, ZIP codes). Wired `VALIDATION: ToolSchemaRegistry` + `validateForTool()` call into 4 servers: prior-auth (11 tools), FHIR (14 tools), NPI registry (8 tools), medical codes (9 tools). | 5 files (1 new) |

**Files changed: 9 (8 modified, 1 new)**
**Tests: 10,304 passed, 0 failed (517 suites)**
**Lint: 0 errors, 0 warnings**

---

### MCP Server Compliance Session 3 (2026-02-27) — P0-6, P0-7, P0-8, P1-1

Eliminated all remaining P0 security items and completed the first P1 hardening item. All 8 P0 critical security items are now resolved.

| Item | Fix | Files Changed |
|------|-----|---------------|
| **P0-6: SELECT * elimination** | Replaced 17 `select('*')` instances across 3 servers with explicit column lists. Created `FHIR_SELECT_COLUMNS` map (18 tables) + `getFHIRColumns()` helper. PHI fields (`clinical_notes`, `clinical_rationale`) excluded from default prior auth queries (included only in FHIR Claim converter where clinically authorized). | 6 files |
| **P0-7: Rate limiting** | Added `checkMCPRateLimit()` to `mcp-edge-functions-server` (was the only Tier 3 server without it). Uses `MCP_RATE_LIMITS.edgeFunctions` (50 req/min). | 1 file |
| **P0-8: Auth gate** | Made `extractCallerIdentity` a hard gate in `mcp-medical-codes-server`. Returns 401 if no valid JWT. Previously allowed unauthenticated tool calls. | 1 file |
| **P1-1: JWKS verification** | Created `mcpJwksVerifier.ts` (82 lines) with local JWT verification via `jose@v5.2.0`. `verifyAdminAccess()` now tries JWKS first (saves 100-300ms), falls back to `auth.getUser()`. Consolidated auth response helpers to keep `mcpAuthGate.ts` at 591 lines. | 2 files (1 new) |

**Files changed: 10 (9 modified, 1 new)**
**Tests: 10,304 passed, 0 failed (517 suites)**

---

### MCP Server Compliance Session 2 — P0-5 God File Decomposition

Decomposed all 6 MCP servers exceeding the 600-line limit into modular architecture (factory function + barrel re-export pattern). Each `index.ts` is now a thin MCP JSON-RPC protocol shell (155–224 lines).

| Server | Before → After | Extracted Modules |
|--------|---------------|-------------------|
| mcp-prior-auth-server | 929→224 | types, tools, fhirConverter, toolHandlers |
| mcp-npi-registry-server | 863→155 | taxonomyCodes, npiApi, tools, toolHandlers |
| mcp-cms-coverage-server | 728→155 | coverageData, tools, toolHandlers |
| mcp-medical-codes-server | 734→158 | types, codeData, tools, toolHandlers |
| mcp-edge-functions-server | 703→197 | functionWhitelist, tools, toolHandlers |
| mcp-postgres-server | 690→183 | queryWhitelist, tools, toolHandlers |

**Files changed: 28 (22 new modules, 6 index.ts files trimmed)**
**Tests: 10,304 passed, 0 failed (517 suites)**

---

### MCP Server Compliance Session 1 — P0-1 through P0-4 Security Fixes

4 critical security vulnerabilities fixed across 11 MCP servers:

| Item | Fix | Files |
|------|-----|-------|
| **P0-3: base64url decoding** | `isAnonKey()` now uses base64url-safe decoder (handles `-`/`_` chars and padding) | `_shared/mcpAuthGate.ts` |
| **P0-1: Per-request Supabase client** | `createPerRequestClient(req)` factory forwards caller's JWT for RLS enforcement; `mcp-postgres-server` and `mcp-medical-codes-server` use it for data queries | `_shared/mcpServerBase.ts`, 2 servers |
| **P0-2: Tenant from identity** | New `_shared/mcpIdentity.ts` extracts `tenant_id` from caller JWT/MCP key instead of trusting tool args; `resolveTenantId()` logs `TENANT_MISMATCH_REJECTED` on mismatch | `_shared/mcpIdentity.ts` (NEW), 4 servers |
| **P0-4: execute_safe_query enforcement** | New `p_caller_tenant_id` param on `execute_safe_query()` SQL function verifies query tenant matches caller tenant | Migration `20260227000001`, `mcp-postgres-server` |

**Files modified (7):** `_shared/mcpAuthGate.ts`, `_shared/mcpServerBase.ts`, `mcp-postgres-server/index.ts`, `mcp-prior-auth-server/index.ts`, `mcp-edge-functions-server/index.ts`, `mcp-medical-codes-server/index.ts`
**Files created (2):** `_shared/mcpIdentity.ts`, migration `20260227000001_secure_execute_safe_query.sql`
**Tests: 10,304 passed, 0 failed (517 suites)**

**Migration NOT yet pushed** — run `npx supabase db push` to deploy.

---

### Previous Session (same day): Test File Review & Fix — 205 tests for 8 admin components

Reviewed 8 uncommitted test files from previous session. Found and fixed 3 bugs, 4 type errors, 8 lint warnings. All 205 tests passing.

| Component | Tests | Key Coverage |
|-----------|-------|-------------|
| AdminHeader | 24 | Title/branding, nav, role visibility, settings dropdown, dark mode |
| ApiKeyManager | 36 | CRUD, validation, generation, search/filter, clipboard copy |
| IntelligentAdminPanel | 27 | Mission Control orchestrator, quick actions, categories |
| PinnedDashboardsBar | 20 | Pin/unpin, expand/collapse, filtering, empty states |
| SLABreachAlerts | 32 | Summary cards, breach list, acknowledge, filters |
| TenantComplianceReport | 21 | HIPAA metrics, compliance score, download report |
| TenantConfigHistory | 24 | Audit trail, stats, detail modal, export CSV/JSON |
| TimeClockAdmin | 21 | Module access gating, entries table, date filters, export |

**Bugs fixed:** PinnedDashboardsBar inverted assertion, ApiKeyManager clipboard/submit timing with fake timers, SLABreachAlerts god file (632→566 lines), 4 type errors, 8 lint warnings.

### MCP Server Compliance Tracker Merged (PR #91)

Cross-audit findings from Claude + ChatGPT merged. 23 items identified across 11 MCP servers. See tracker section above.

---

### Previous Session (2026-02-25): Admin Panel Hardening — Tier 2 Session 4 (COMPLETE)

**264 behavioral tests across 7 admin operations components.** Tier 2 is now fully complete.

| Component | Tests | Key Coverage |
|-----------|-------|-------------|
| FacilityManagementPanel | 37 | CRUD, search, inactive toggle, modals, validation |
| AdminSettingsPanel | 41 | Preferences, dropdowns, apply/reset, loading states |
| TenantModuleConfigPanel | 37 | Module grouping, entitlement model, save/cancel |
| TenantBrandingManager | 30 | Color validation, logo upload, tenant switching |
| HospitalPatientEnrollment | 30 | Form validation, patient search, enrollment flow |
| MPIReviewQueue | 36 | Duplicate review, expand/collapse, defer/reject/merge, lazy-load address |
| PatientEngagementDashboard | 53 | Engagement scores, risk levels, mood indicators, pagination, filtering |

**New files (2):** `MPIReviewQueue.test.tsx`, `PatientEngagementDashboard.test.tsx`
**Tests: 9,879 passed, 0 failed (501 suites)**

---

### Test & Build Repair (same session)

**Problem:** Previous session (Tier 2 Session 3) was interrupted mid-work, leaving 5 uncommitted test files with 15 failures and a typecheck OOM crash.

**Fixes applied:**

1. **TenantBrandingManager.test.tsx (8 failures → 0):**
   - Root cause: `vi.clearAllMocks()` does NOT reset `mockImplementation` — color validation tests (19-21) poisoned `mockIsValidHexColor` for all subsequent save tests
   - Fix: Reset mock implementations explicitly in `setupHappyPath()`
   - Also fixed `getByDisplayValue('tenant-001')` timing issue in tenant switching test

2. **HospitalPatientEnrollment.test.tsx (6 failures → 0):**
   - Root cause: `getByLabelText(/First Name/)` failed — labels not associated with inputs (no `htmlFor`/`id`)
   - Fix: Added `htmlFor`/`id` pairs to component form labels (a11y/WCAG improvement)
   - Also fixed N/A cell duplicate match in patient table test

3. **TenantModuleConfigPanel.test.tsx (1 failure → 0):**
   - Root cause: `getByText('1/1 in plan')` matched 2 elements (Core + Communication categories)
   - Fix: Changed to `getAllByText` with count assertion

4. **Typecheck OOM crash:**
   - Root cause: Default Node heap (~4GB) insufficient for 500+ service codebase
   - Fix: Added `NODE_OPTIONS='--max-old-space-size=8192'` to `typecheck` script in `package.json`

5. **Type errors in test mocks (4 errors → 0):**
   - Fixed mock function type signatures to accept correct parameter types

6. **Lint warnings (19 → 0):**
   - Removed unused `within` import from TenantModuleConfigPanel.test.tsx
   - Removed unused `fireEvent` import from FacilityManagementPanel.test.tsx
   - Replaced 14 non-null assertions (`!`) with `as HTMLElement` casts in TenantModuleConfigPanel.test.tsx
   - Replaced 3 non-null assertions in AdminSettingsPanel.test.tsx (2 `within()` calls + 1 `resolveUpsert`)

**Files modified (3):** `package.json`, `HospitalPatientEnrollment.tsx`, 3 test files
**Files added (5):** `AdminSettingsPanel.test.tsx`, `FacilityManagementPanel.test.tsx`, `HospitalPatientEnrollment.test.tsx`, `TenantBrandingManager.test.tsx`, `TenantModuleConfigPanel.test.tsx`

**Tests: 9,790 passed, 0 failed (499 suites)**

---

### Previous Session (2026-02-24): Admin Panel Hardening — Tier 1 + Tier 2 Sessions 1-3

**Tracker:** `docs/trackers/envision-admin-panel-hardening-tracker.md`

**Tier 1 (Items 1.1-1.3):**
- 1.1: RLS tenant isolation on `user_roles` verified — `get_current_tenant_id()` scoping confirmed
- 1.2: SDOHCoderAssist hardcoded demo IDs → `SDOHCoderAssistWrapper` reading from PatientContext
- 1.3: Tenant Suspension — already done in previous session

**Tier 2 Session 1 (Items 2.1-2.7) — 79 new behavioral tests:**
- `FhirAiDashboard.test.tsx` — 13 tests: tabs, population metrics, risk matrix, loading/error states
- `FHIRDataMapper.test.tsx` — 12 tests: source selection, mapping rules, FHIR preview, deploy options
- `ClinicalNoteSummaryDashboard.test.tsx` — 14 tests: metric cards, note list, detail panel, tabs
- `NoteLockingControls.test.tsx` — 10 tests: lock/unlock flow, confirmation, signature display
- `AmendmentWorkflow.test.tsx` — 11 tests: create form, approve/reject, type selector, expand/collapse
- `RiskAssessmentManager.test.tsx` — 19 tests: role access, assessment list, filtering, patient selector

**Tests: 9,308 passed (481 suites) — up from 9,229**

---

### Earlier: Tenant Admin Panel Sessions 1-5 — COMPLETE

**Tracker:** `docs/trackers/tenant-admin-panel-tracker.md`

- Session 1: Wire session timeout + PIN requirement, remove audit/backup toggles, route orphans
- Session 2: User Role Management UI with hierarchy enforcement (12 tests)
- Session 3: User Invite/Provisioning with invite form + pending management (13 tests)
- Session 4: TenantSecurityDashboard decomposition + alert management, sessions, rules (12 tests)
- Session 5: Tenant Suspension — login enforcement, UI banner (6 tests)

---

### Earlier: Nurse Question Manager (3 sessions) — COMPLETE

**What was done:**
- Session 1: Discovery, migration, service layer, API wrapper, 17 tests
- Session 2: Decomposition (742→129 lines), service wiring, mock data removal, AI model fix, escalation UI, 27 tests
- Session 3: Auto-escalation edge function, patient SMS notification, realtime subscriptions, analytics view + RPC + panel, 38 tests
- Tests: 9,148 → 9,175 → 9,186 across 3 sessions

**The entire Nurse Handoff & Documentation tracker is COMPLETE (6 sessions total).**

---

### Earlier: Shift Handoff Dashboard Session 3: Integration & Polish — COMPLETE

**Tracker:** `docs/trackers/nurse-handoff-documentation-tracker.md`

**What was done:**
- **Admin section wiring** — `lazyImports.tsx` + `sectionDefinitions.tsx` — ShiftHandoffDashboard registered in `patient-care` category, visible to nurse/charge_nurse/admin roles
- **Audit logging** — `SHIFT_HANDOFF_DASHBOARD_VIEW` on mount, `SHIFT_HANDOFF_ACCEPTED` on accept, `SHIFT_HANDOFF_BYPASS_USED` (warn level) on bypass, `HANDOFF_PRINT_REQUESTED` on print
- **Notification bridge** — Realtime INSERT handler shows `EAAffirmationToast` ("New AI shift summary available") when new AI summary arrives
- **Demo mode data** — `shift-handoff/demoData.ts` with 4 demo patients, metrics, AI summary; `useDemoMode()` skips DB calls when active
- **Tests** — 18 → 21 tests: audit logging on mount, print audit verification, admin section wiring

**New file (1):**
- `src/components/nurse/shift-handoff/demoData.ts` (135 lines)

**Feature 1 (Shift Handoff Dashboard) is now COMPLETE across all 3 sessions.**

**Tests: 9,131 passed, 0 failed (470 suites) — up from 9,128**

### Previous: Session 2 — Handoff Workflow (same day)
- Acknowledge AI summary, nurse notes editor, print/export, realtime updates
- Service decomposition: `shiftHandoffService.ts` 717→457 lines
- New files: `shiftHandoffScoring.ts` (231), `shiftHandoffTimeTracking.ts` (112)

---

### Shift Handoff Dashboard Session 1: Decomposition, Unit Filter & AI Summary Panel — COMPLETE

**What was done:**
- Decomposed ShiftHandoffDashboard.tsx god file: 916 → 400 lines (56% reduction), 4 submodules extracted to `shift-handoff/`
- Added unit filter, AI summary panel, expanded tests 5 → 12
- Committed guardian agent work from previous session (26 files)

**New files (7):** types.ts, HandoffHeader.tsx, HighAcuitySection.tsx, StandardAcuitySection.tsx, AISummaryPanel.tsx, index.ts

---

### Previous: Compass Riley Session 10: Edge Case Hardening & Final Audit — COMPLETE (FINAL SESSION)

**Tracker:** `docs/trackers/compass-riley-reasoning-tracker.md`

Final session of the 10-session Compass Riley Clinical Reasoning Hardening track. Edge case tests for 5 clinical scenarios, PHI security audit, HTI-2 transparency update, and edge function parse fix.

**What was built:**
- **edgeCaseHardening.test.ts** (37 tests) — Brief encounters: empty state, minimal completeness, serialization. Multi-problem: 7+ dx accumulation, case-insensitive merge, ruled-out filtering. Pediatric: vital ranges, well-child visits, immunizations, weight-based dosing. Psychiatric: domain tracking, suicidal ideation, screening tools. Interpreter: detection, multi-turn HPI, language coverage, family member flagging, bilingual encounters.
- **phiSecurityAudit.test.ts** (27 tests) — PHI pattern detection (SSN/phone/DOB/MRN/email/UUID), query builder zero-PHI verification, physician trigger extraction safety, citation formatting audit, end-to-end encounter simulation with PHI-contaminated evidence, rate limiting as exposure surface reduction.
- **HTI-2 transparency migration** — `20260223000002_compass_riley_hti2_enhanced_descriptions.sql` updating `patient_description` for Riley, guideline matcher, treatment pathway, SOAP generator.
- **Edge function parse fix** — Fixed missing closing brace in `realtime_medical_transcription/index.ts` (pre-existing from Session 8 WebSocket nesting). Deployed successfully.

**New files (3):**
- `src/components/smart/__tests__/edgeCaseHardening.test.ts`
- `src/components/smart/__tests__/phiSecurityAudit.test.ts`
- `supabase/migrations/20260223000002_compass_riley_hti2_enhanced_descriptions.sql`

**Tests: 9,085 passed, 0 failed (469 suites) — up from 9,021**

---

### Compass Riley — FULL TRACK COMPLETE (Sessions 1-10)

**10 sessions, 348 tests across 10 test files, 16 edge function modules, 12 client-side files.**

All success criteria achieved:
- Anti-hallucination grounding in all prompt paths
- Progressive clinical reasoning across encounters
- Conversation drift protection (21 domains)
- PubMed evidence retrieval with zero PHI
- Clinical guideline matching (12 conditions)
- Treatment pathway references (12 conditions)
- Physician consultation mode with differentials
- Peer consult prep (SBAR, 12 specialties)
- Edge case coverage (brief/multi-problem/pediatric/psychiatric/interpreter)
- PHI security audit (27 tests, zero leaks)

---

### Previous: Compass Riley Session 9: Integration Testing, Prompt Tuning & Hook Decomposition — COMPLETE

**Tracker:** `docs/trackers/compass-riley-reasoning-tracker.md`

Comprehensive testing, prompt quality auditing, cost analysis, demo mode update for all Sessions 1-8, and decomposition of the 1520-line useSmartScribe.ts god file.

**What was built:**
- **scribeIntegration.test.ts** (80 tests) — Full scribe pipeline: progressive encounter state across 3 chunks, set-once fields, drift domain tracking, emergency flags, diagnosis merging, ROS deduplication, full 3-chunk diabetes encounter simulation
- **consultationIntegration.test.ts** (57 tests) — Consultation pipeline: case presentation structure, enhanced differentials with red flags/key test, structured cannot-miss with type guard, SBAR consult prep, specialty framing, consultation→consult prep pipeline coherence
- **promptQualityAudit.test.ts** (23 tests) — Anti-hallucination audit: grounding rules in all prompt paths (standard/premium/consultation), hallucination vector detection (forbidden fabrication phrases), emergency keyword coverage (cardiac/neuro/mental health), provider-only topic coverage, clinical domain coverage (20+ domains), consult specialty coverage
- **performanceCost.test.ts** (28 tests) — Rate limiting verification (PubMed: 10/encounter, 30s interval; Guidelines: 5/encounter, 60s interval), token budget analysis (standard <1000, premium <3000, consultation <4000), cost estimation (standard <$0.15, premium <$0.30), audit log structure verification
- **Demo mode updated** — All Sessions 1-8 data: grounding flags, encounter state, evidence citations, guideline references, treatment pathways, consultation response, consult prep (consultation mode only)
- **useSmartScribe.ts decomposed** — 1520 → 534 lines (65% reduction), 5 focused modules, zero-breaking-change barrel re-exports

**New files (8):**
- `src/components/smart/__tests__/scribeIntegration.test.ts`
- `src/components/smart/__tests__/consultationIntegration.test.ts`
- `src/components/smart/__tests__/promptQualityAudit.test.ts`
- `src/components/smart/__tests__/performanceCost.test.ts`
- `src/components/smart/hooks/useSmartScribe.types.ts` (271 lines)
- `src/components/smart/hooks/scribeDemoData.ts` (356 lines)
- `src/components/smart/hooks/useScribePreferences.ts` (235 lines)
- `src/components/smart/hooks/scribeRecordingService.ts` (277 lines)

**Tests: 9,021 passed, 0 failed (467 suites) — up from 8,941**

---

### Previous: Compass Riley Session 8: Differential Diagnosis & Peer Consult Prep — COMPLETE

**Tracker:** `docs/trackers/compass-riley-reasoning-tracker.md`

Enhanced consultation mode with structured differentials, cannot-miss diagnosis system, and peer consult prep via WebSocket command channel.

**What was built:**
- **Enhanced differentials** — each differential now includes `redFlags`, `keyTest`, `literatureNote` (prompt-driven)
- **Structured cannot-miss** — `CannotMissDiagnosis` interface with severity (life-threatening/emergent/urgent), distinguishing features, rule-out test, timeframe. Backwards-compatible with Session 7 `string[]` via runtime type guard
- **Peer consult prep** — WebSocket command channel (`prepare_consult`) repurposed from dropped string messages. SBAR-formatted summaries tailored to 12 specialties with urgency badges (stat/urgent/routine)
- **ConsultPrepPanel.tsx** (190 lines, NEW) — specialty selector, SBAR display, urgency badges, loading/disabled states
- **peerConsultAnalyzer.ts** (166 lines, NEW) — edge function module for Claude-powered consult prep analysis

**Files modified (7):**
- `consultationPromptGenerators.ts` — enhanced types, schemas, consult prep prompt
- `realtime_medical_transcription/index.ts` — command channel, consult response tracking (591 lines)
- `scribeHelpers.ts` — extracted `TranscriptionAnalysis` for 600-line compliance
- `audioProcessor.ts` — consult prep WebSocket message handlers
- `useSmartScribe.ts` — consult prep state, request function, WebSocket callbacks
- `ConsultationPanel.tsx` — enhanced differential cards, structured cannot-miss cards
- `RealTimeSmartScribe.tsx` — wired ConsultPrepPanel

**Tests: 29 new tests (12 ConsultationPanel Session 8 + 17 ConsultPrepPanel)**
**Codebase: 8,912 → 8,941 tests (+29), 462 → 463 suites (+1)**

---

### Previous: Compass Riley Session 7: Physician Consultation Mode — COMPLETE

**Tracker:** `docs/trackers/compass-riley-reasoning-tracker.md`

Built consultation mode — Riley's third operating mode where it becomes a clinical reasoning partner (not a scribe). Physicians dictate a case and get structured case presentation, Socratic reasoning steps, differential diagnosis, cannot-miss warnings, and confidence calibration.

**Files created (4 new):**
- `supabase/functions/_shared/consultationPromptGenerators.ts` (332 lines) — prompt system with condensed + premium modes
- `supabase/functions/_shared/consultationAnalyzer.ts` (181 lines) — Claude API call, parsing, audit logging
- `supabase/functions/_shared/scribeHelpers.ts` (90 lines) — shared logClaudeAudit + encounter state serializer
- `src/components/smart/ConsultationPanel.tsx` (458 lines) — 5-tab UI (Case, Reasoning, Safety, Workup, Confidence)

**Files modified (6):**
- `src/components/smart/RealTimeSmartScribe.tsx` — added consultation mode routing
- `src/components/smart/ScribeModeSwitcher.tsx` — rewritten for 3-way radio toggle (SmartScribe/Compass Riley/Consultation)
- `src/components/smart/hooks/useSmartScribe.ts` — consultation state, WebSocket handler, mode param
- `src/components/smart/utils/audioProcessor.ts` — consultation WebSocket message type
- `src/services/scribeFeedbackService.ts` — added consultation to ScribeMode type
- `supabase/functions/realtime_medical_transcription/index.ts` — consultation mode routing + 600-line compliance (669→569)

**Tests: 53 new tests (37 ConsultationPanel + 16 ScribeModeSwitcher)**
**Codebase: 8,706 → 8,912 tests (+206), 452 → 462 suites (+10)**

---

### Previous: AI Model Version Standardization — COMPLETE

**Problem:** 350+ hardcoded model strings across 100+ files, 9 different versions, format inconsistencies, and legacy references.

**What was done:**
- Created centralized model constants: `src/constants/aiModels.ts` (service layer) + `supabase/functions/_shared/models.ts` (edge functions)
- Fixed 6 service files with malformed model IDs (dots vs dashes, missing dates, legacy versions)
- Standardized 32 edge function source files to import from `_shared/models.ts`
- Updated 8 MCP service files to import from `src/constants/aiModels.ts`
- Updated `ClaudeModel` enum to current model IDs
- Updated `environment.ts` default from `20250919` → `20250929`
- Canonical versions: Haiku `claude-haiku-4-5-20250929`, Sonnet `claude-sonnet-4-5-20250929`, Opus `claude-opus-4-5-20251101`

### CLAUDE.md Governance Updates

- Added Rule 14: Pin AI model versions (explicit model ID in `ai_skills.model`, never `latest`)
- Added Rule 15: Synthetic test data only (obviously fake names/DOBs in test fixtures)
- Added Rule 16: Structured AI output (new AI edge functions must define JSON response schema)
- Added sections: AI Model Version Pinning, Structured AI Output, AI Transparency (HTI-2), Synthetic Test Data

### HTI-2 Algorithm Transparency Migration

- Created `20260223000001_ai_skills_patient_description.sql`
- Added `patient_description` TEXT column to `ai_skills` table
- Populated plain-language descriptions for all 60 AI skills
- Migration pushed to remote database

### Edge Function Redeployment — COMPLETE

- All 137 edge functions redeployed with standardized model imports
- Commit `1baf0998` pushed, then full deploy via `npx supabase functions deploy --no-verify-jwt`
- All functions live on project `xkybsjnvuohpqpbkikyn`

---

## What Was Completed Previously (2026-02-22/23)

### patientContextService Adoption — COMPLETE (3 sessions)

**Tracker:** `docs/trackers/patient-context-adoption-tracker.md`

| Session | Date | Phases | Tests |
|---------|------|--------|-------|
| 1 | 2026-02-22 | 0 + 1 + 2 | 8,415 → 8,665 |
| 2 | 2026-02-22 | 3 + 4 | 8,665 → 8,706 |
| 3 | 2026-02-23 | 5 + 6 | 8,706 → 8,706 |

**What was migrated:**
- Phase 0: Fixed `daily_check_ins` → `check_ins` table/column bug (5 fixes)
- Phase 1: Added `self_reports` section to patientContextService (8 tasks, 13 new tests)
- Phase 2: Added `getBatchDemographics()` method (6 new tests)
- Phase 3: Migrated `data-fetching.ts` — adapter pattern preserves API shape (18 new tests)
- Phase 4: Decomposed 800-line `DoctorsViewPage.tsx` into 8 modules, migrated `self_reports` query (23 new tests)
- Phase 5: Migrated `MPIReviewQueue` — N+1 queries → single batch fetch, lazy-load address on expand, decomposed into 4 modules
- Phase 6: Final verification — 93 patient-context tests pass, full suite green

**Next action:** Move to next priority per Maria's direction.

---

## What Was Completed Previously (2026-02-21)

### Session 2 — MCP UI Wiring (4 servers)
1. Wired NPI Registry → BillingProviderForm (provider onboarding with registry lookup)
2. Wired Medical Codes → BillingQueueDashboard (auto-validate CPT/ICD-10 on superbill gen)
3. Wired CMS Coverage → SuperbillReviewPanel + EligibilityVerificationPanel (prior auth checks)
4. Wired PubMed → DrugInteractionsTab (evidence citations with DOI links per interaction)
5. New files: 4 hooks, 1 MCP client, 1 component, 5 test files (34 new tests)
6. Tests: 8,562 → 8,596 (est.), Suites: 440 → 445 (est.)

### Session 1 — Audits + Tier 3 Fix
1. Deep Congruency Audit — Full codebase audit across 7 dimensions:
   - Service layer: 500+ services mapped, dependency graph traced
   - Routing: 151 routes verified connected and lazy-loaded
   - Contexts: 12 React contexts mapped, mounting hierarchy verified
   - Edge functions: 137 functions audited for CORS, auth, error handling
   - Types: 72 type files audited, duplicate definitions identified
   - Database: 445 migrations reviewed, query patterns audited
   - Error handling: 1,300+ catch blocks analyzed
2. Tests: 8,531 → 8,562 (+31), Suites: 437 → 440 (+3)
3. Audit report delivered: `docs/DEEP_CONGRUENCY_AUDIT_2026-02-21.md`
4. No code was modified — audit only per Maria's instruction
5. MCP Server Ecosystem Audit:
   - Inventoried all 11 MCP servers (96 total tools across 3 security tiers)
   - Health-checked each server: 4 LIVE, 5 DOWN (Tier 3 — missing secrets), 2 untested
   - Identified 8 servers with client code built but NOT wired to UI
   - Mapped 5 cross-server chains (Claims Pipeline, Provider Onboarding, Clinical Decision Support, Encounter-to-Claim, Prior Auth Workflow) — 0 of 5 currently implemented
   - Gap analysis: biggest opportunity is Claims Submission Pipeline (Chain 1) — automated revenue cycle
   - Full results added to PROJECT_STATE.md as working knowledge
6. Fixed Tier 3 MCP server auth failure:
   - Root cause: `validate_mcp_key` SQL function VARCHAR(255)/TEXT type mismatch
   - Secondary fix: `_shared/env.ts` key fallback order (JWT format first)
   - Applied migration `20260221000001_fix_validate_mcp_key_type_mismatch.sql`
   - Redeployed all 11 MCP servers
   - All 11 servers now responding (9 ping OK + Prior Auth authenticated)

### Previous Session (2026-02-18)

1. L&D Session 8 — Tier 3 AI moonshot features:
   - AI Birth Plan Generator (8-section grid, prints, ai-patient-education edge function)
   - PPD Early Warning System (composite scoring: EPDS 40%, mental health 25%, social isolation 20%, engagement 15%)
   - Contraindication Checker for obstetric medications (ai-contraindication-detector)
   - Patient Education Generator (4 preset L&D topics, reusable component)
2. Bug fix: PPD alert type corrected from `maternal_fever` to `ppd_positive_screen`
3. Type extraction: alert types moved to `laborDeliveryAI.ts` for 600-line compliance (602→573)
4. Wired panels into PrenatalTab, PostpartumTab, MedicationAdminForm
5. Tests: 8,441 → 8,531 (+90), Suites: 431 → 437 (+6)

### Previous Session (2026-02-17) (archived)

1. Built AI Patient Priority Boards (physician + nurse scoring, click-to-chart)
2. Built Physician Office Dashboard (`/physician-office`) — 6 tabs, 14 composed admin sections
3. Built Nurse Office Dashboard (`/nurse-office`) — 6 tabs, nurse-specific workflow
4. Audited Oncology module — foundation 100% built, 11 sessions remaining for full production
5. Created Oncology Module Tracker (`docs/trackers/oncology-module-tracker.md`)
6. Audited Cardiology module — foundation 60-65% built, 12-13 sessions remaining
7. Created Cardiology Module Tracker (`docs/trackers/cardiology-module-tracker.md`)

---

## Action Items

- [ ] **Run headless scripts to generate feature list + user manual** (from 2026-02-16, still pending)
  - `bash scripts/headless/generate-feature-list.sh > docs/FEATURE_LIST.md`
  - `bash scripts/headless/generate-manual.sh > docs/USER_MANUAL.md`
- [ ] **Fix Codespace GH_TOKEN** — set to placeholder `your classic PAT`, overrides valid GITHUB_TOKEN. Update or delete in GitHub Settings > Codespaces > Secrets.

## Blocked Items

None currently blocked.

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-16 | All skills use SKILL.md (uppercase) | Consistency across 7 skills |
| 2026-02-16 | PROJECT_STATE.md at docs/ root | Fixed path so Claude never hunts for it |
| 2026-02-16 | Test coverage tracker needs refresh | Baseline was 7,109 tests on Feb 4; now 8,415 |

---

## Session Start Protocol

At the start of every session, Claude MUST:

1. Read `docs/PROJECT_STATE.md` (this file)
2. Read `CLAUDE.md` (governance rules)
3. Report a 5-line status summary:
   - Last session date and what was completed
   - Current tracker and next priority item
   - Codebase health (tests/lint/typecheck from last known)
   - Any blocked items
   - Estimated sessions remaining for current priority
4. Confirm with Maria before starting work
