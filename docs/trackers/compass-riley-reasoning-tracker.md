# Compass Riley — Clinical Reasoning Hardening Tracker

> **Purpose:** Elevate Compass Riley from an AI medical scribe into a clinically-grounded reasoning partner that physicians can trust during challenging cases, peer consultations, and complex documentation — with zero hallucination tolerance.

**Total Estimated Sessions:** 8–10
**Priority:** Patient Safety (anti-hallucination) first, then Physician Value (evidence engine)
**Started:** 2026-02-23

---

## Session Map

| Session | Focus | Status | Date |
|---------|-------|--------|------|
| 1 | Anti-Hallucination Grounding System | IN PROGRESS | 2026-02-23 |
| 2 | Progressive Clinical Reasoning Chain | Pending | — |
| 3 | Conversation Drift Protection | Pending | — |
| 4 | Evidence-Based Reasoning Engine — PubMed Integration | Pending | — |
| 5 | Evidence-Based Reasoning Engine — Guideline Matcher Integration | Pending | — |
| 6 | Evidence-Based Reasoning Engine — Treatment Pathway Integration | Pending | — |
| 7 | Physician Consultation Mode | Pending | — |
| 8 | Physician Consultation Mode — Differential & Peer Consult | Pending | — |
| 9 | Integration Testing & Prompt Tuning | Pending | — |
| 10 | Edge Case Hardening & Final Audit | Pending | — |

---

## Session 1: Anti-Hallucination Grounding System

**Goal:** Ensure every clinical assertion Riley produces is traceable to the transcript. Zero fabrication tolerance.

### Problem Statement

Riley's prompt system (`conversationalScribePrompts.ts`) has NO anti-hallucination instructions in the personalized prompt paths. The only guard is a single line in the fallback prompt: "Never make up clinical details not in the transcript." This is insufficient for clinical-grade documentation.

A physician dictates "patient reports occasional dizziness" and Riley could expand that into a full neurological ROS that was never conducted. In a clinical setting, fabricated documentation is a liability, a billing fraud vector, and a patient safety risk.

### Deliverables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1.1 | Add transcript grounding rules to `getConversationalPersonality()` | `conversationalScribePrompts.ts` | |
| 1.2 | Add grounding rules to `getRealtimeCodingPrompt()` (standard mode) | `conversationalScribePrompts.ts` | |
| 1.3 | Add grounding rules to `getFullRealtimeCodingPrompt()` (premium mode) | `conversationalScribePrompts.ts` | |
| 1.4 | Add grounding rules to `getDocumentationPrompt()` | `conversationalScribePrompts.ts` | |
| 1.5 | Add confidence calibration labels to SOAP output schema | `conversationalScribePrompts.ts` | |
| 1.6 | Update fallback prompt in `realtime_medical_transcription/index.ts` | `realtime_medical_transcription/index.ts` | |
| 1.7 | Add post-processing hallucination flag to response handling | `realtime_medical_transcription/index.ts` | |
| 1.8 | Tests for grounding rules in prompt output | New test file | |

### Anti-Hallucination Rules (to embed in all prompt paths)

```
ANTI-HALLUCINATION GROUNDING RULES — MANDATORY:

1. TRANSCRIPT IS TRUTH: Every clinical finding, symptom, vital sign, lab value,
   and physical exam element in the SOAP note MUST correspond to something
   explicitly stated in the transcript. If it was not said, it does not exist.

2. NEVER INFER CLINICAL DETAILS:
   - Do NOT add ROS elements that were not discussed
   - Do NOT add physical exam findings that were not described
   - Do NOT assume lab values, vital signs, or imaging results
   - Do NOT expand a brief mention into a detailed clinical narrative

3. CONFIDENCE LABELING: For each SOAP section, label assertions as:
   - [STATED] — Directly stated in transcript (quote the source)
   - [INFERRED] — Reasonable clinical inference (explain the inference)
   - [GAP] — Expected but not documented (flag for provider)

4. WHEN IN DOUBT, FLAG: If you cannot determine whether something was said,
   write: "[NOT DOCUMENTED — verify with provider]"

5. NEVER FABRICATE:
   - No invented medication doses
   - No assumed allergies
   - No fabricated vital signs
   - No made-up lab results
   - No fictional physical exam findings

6. BILLING CODE GROUNDING: Every suggested code must cite the specific
   transcript evidence that supports it. If evidence is insufficient,
   do not suggest the code — instead note what documentation would be needed.
```

---

## Session 2: Progressive Clinical Reasoning Chain

**Goal:** Maintain a running clinical picture across the encounter instead of processing 15-second chunks independently.

### Deliverables

| # | Task | Status |
|---|------|--------|
| 2.1 | Design encounter state object (chief complaint, HPI elements, ROS systems, exam components, diagnoses, plan items) | |
| 2.2 | Add encounter state tracking to `realtime_medical_transcription/index.ts` | |
| 2.3 | Build differential diagnosis narrowing — accumulate evidence, update probabilities | |
| 2.4 | Add "clinical completeness" tracking — what's documented vs. what's expected for E/M level | |
| 2.5 | Prompt engineering — include prior encounter state in each 15-second analysis call | |
| 2.6 | Add MDM complexity tracking — data, risk, management elements scored per 2021 E/M guidelines | |
| 2.7 | Tests for progressive state accumulation | |

---

## Session 3: Conversation Drift Protection

**Goal:** Detect when Riley's suggestions diverge from the active clinical context and prevent off-topic reasoning.

### Deliverables

| # | Task | Status |
|---|------|--------|
| 3.1 | Topic classification — detect clinical domain (cardiac, neuro, GI, MSK, etc.) from transcript | |
| 3.2 | Drift detection — flag when suggestions don't match current topic | |
| 3.3 | Scope boundaries — Riley never reasons outside the encounter's established context | |
| 3.4 | Conversation thread tracking — know when chief complaint discussion ends and exam begins | |
| 3.5 | Patient-facing safety — if patient speaks directly to Riley, enforce `ai-patient-qa-bot` guardrails | |
| 3.6 | Tests for drift detection and topic tracking | |

---

## Sessions 4–6: Evidence-Based Reasoning Engine

**Goal:** Connect Riley to peer-reviewed evidence in real-time so physicians get literature-backed support when their knowledge base ends.

### Session 4: PubMed Integration

| # | Task | Status |
|---|------|--------|
| 4.1 | Add PubMed MCP client to Riley's edge function (server already wired — `mcp-pubmed-server`) | |
| 4.2 | Complexity detection — identify when a case warrants literature search | |
| 4.3 | Auto-query PubMed when unusual presentations, rare conditions, or drug interaction questions arise | |
| 4.4 | Physician-triggered search — "Riley, what does the literature say about..." | |
| 4.5 | Citation formatting — PMID, title, journal, year, DOI link per result | |
| 4.6 | Rate limiting and cost tracking for PubMed queries | |
| 4.7 | Tests for evidence retrieval and citation formatting | |

### Session 5: Clinical Guideline Matcher Integration

| # | Task | Status |
|---|------|--------|
| 5.1 | Connect Riley to `ai-clinical-guideline-matcher` during encounters | |
| 5.2 | Auto-match patient conditions to applicable guidelines (ADA, ACC/AHA, USPSTF, etc.) | |
| 5.3 | Guideline adherence alerts — flag when documentation deviates from guidelines | |
| 5.4 | Preventive care gap detection — proactive screening recommendations with guideline citation | |
| 5.5 | UI integration — show guideline references alongside billing suggestions | |
| 5.6 | Tests for guideline matching during encounters | |

### Session 6: Treatment Pathway Integration

| # | Task | Status |
|---|------|--------|
| 6.1 | Connect Riley to `ai-treatment-pathway` for evidence-based treatment recommendations | |
| 6.2 | Evidence level display (A/B/C/D/expert consensus) for each treatment suggestion | |
| 6.3 | Contraindication cross-check against patient's allergies and current medications | |
| 6.4 | SDOH-aware treatment recommendations (from patient context) | |
| 6.5 | Treatment step visualization — first-line through third-line options | |
| 6.6 | Tests for treatment pathway integration | |

---

## Sessions 7–8: Physician Consultation Mode

**Goal:** A second operating mode beyond scribe — Riley becomes a clinical reasoning partner for complex cases and peer consultations.

### Session 7: Core Consultation Framework

| # | Task | Status |
|---|------|--------|
| 7.1 | Add `consultation` mode to `ScribeMode` type (`'smartscribe' | 'compass-riley' | 'consultation'`) | |
| 7.2 | Consultation prompt system — clinical reasoning partner, not scribe | |
| 7.3 | Structured case presentation generator (one-liner, HPI, PMH, meds, allergies, exam, labs, assessment) | |
| 7.4 | "Help me think through this" mode — Socratic clinical reasoning | |
| 7.5 | All guardrails from Sessions 1–3 enforced in consultation mode | |
| 7.6 | Mode switcher UI update — three-way toggle | |
| 7.7 | Tests for consultation mode | |

### Session 8: Differential Diagnosis & Peer Consult Prep

| # | Task | Status |
|---|------|--------|
| 8.1 | Differential diagnosis generator — ranked by probability with evidence | |
| 8.2 | "What am I missing?" feature — systematic review of uncommon but dangerous diagnoses | |
| 8.3 | Peer consult prep — "Summarize this case for the cardiologist I'm calling" | |
| 8.4 | Specialist-aware framing — tailor summary to receiving specialty | |
| 8.5 | Literature backing for differentials — PubMed citations for each consideration | |
| 8.6 | Tests for differential generation and consult prep | |

---

## Session 9: Integration Testing & Prompt Tuning

| # | Task | Status |
|---|------|--------|
| 9.1 | End-to-end testing — scribe mode with grounding, reasoning chain, and evidence | |
| 9.2 | Consultation mode end-to-end testing | |
| 9.3 | Prompt tuning — review Claude outputs for hallucination, drift, and citation quality | |
| 9.4 | Performance testing — latency impact of PubMed/guideline queries during real-time transcription | |
| 9.5 | Cost analysis — token usage impact of grounding rules and evidence retrieval | |
| 9.6 | Update demo mode with new capabilities (DEMO_CODES, DEMO_SOAP, DEMO_MESSAGES) | |

---

## Session 10: Edge Case Hardening & Final Audit

| # | Task | Status |
|---|------|--------|
| 10.1 | Edge case: extremely brief encounters (<30 seconds) | |
| 10.2 | Edge case: multi-problem visits (5+ diagnoses) | |
| 10.3 | Edge case: pediatric encounters (age-appropriate reasoning) | |
| 10.4 | Edge case: psychiatric encounters (sensitive documentation) | |
| 10.5 | Edge case: language barriers / interpreter-mediated visits | |
| 10.6 | Security audit — ensure no PHI leaks through evidence queries | |
| 10.7 | HTI-2 transparency — update `ai_skills.patient_description` for enhanced capabilities | |
| 10.8 | Final verification checkpoint — all tests pass, all prompts audited | |

---

## Architecture Notes

### Existing Infrastructure Riley Can Leverage

| Component | Already Built | Riley Currently Uses |
|-----------|--------------|---------------------|
| PubMed MCP Server | Yes (11 tools, wired to DrugInteractionsTab) | **No** |
| Clinical Guideline Matcher | Yes (ai-clinical-guideline-matcher edge fn) | **No** |
| Treatment Pathway Engine | Yes (ai-treatment-pathway edge fn) | **No** |
| Provider Assistant Guardrails | Yes (ai-provider-assistant safety rules) | **No** |
| Patient Q&A Safety Rules | Yes (ai-patient-qa-bot guardrails) | **No** |
| PHI De-identification | Yes (strictDeidentify + validation) | **Yes** |
| Audit Logging | Yes (claude_api_audit table) | **Yes** |
| Provider Preferences | Yes (provider_scribe_preferences table) | **Yes** |
| Learning System | Yes (scribe_interaction_history + learn_from_interaction) | **Yes** |

### Key Principle

Riley already lives inside a platform with 28 AI edge functions, 11 MCP servers, and clinical decision support infrastructure. The biggest value add is **connecting Riley to what already exists** — not building new AI capabilities from scratch.

---

## Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Anti-hallucination instructions in prompts | 1 line (fallback only) | All 4 prompt paths + grounding rules |
| Confidence labeling in SOAP output | None | [STATED] / [INFERRED] / [GAP] on every assertion |
| Evidence citations per encounter | 0 | 1-5 per complex case (PubMed + guidelines) |
| Conversation drift detection | None | Topic tracking + drift alerts |
| Progressive reasoning | None (15s chunks independent) | Running clinical picture across encounter |
| Physician consultation mode | None | Full differential + peer consult prep |
| Hallucination rate (target) | Unknown | <1% of clinical assertions unfounded |
