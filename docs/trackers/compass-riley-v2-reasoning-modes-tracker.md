# Compass Riley V2 — Chain of Thought / Tree of Thought Reasoning Modes

> **Purpose:** Add proportional reasoning to Compass Riley — Chain of Thought (concise, linear) for clear-cut cases and Tree of Thought (branching differential) for ambiguous/high-stakes cases. The system reasons broadly but speaks narrowly. Tree runs silently; Chain is the voice. The user can always grab the wheel.

**Total Estimated Sessions:** 3
**Priority:** After MCP Server Compliance tracker completion
**Started:** 2026-03-01
**Design Origin:** Brainstorm session 2026-02-28 (Maria + Claude Opus 4.6 + ChatGPT design spec)

---

## Core Philosophy

> "The system may reason expansively, but it must respond proportionally."

- **Chain of Thought (CoT):** Linear reasoning. A -> B -> C -> Conclusion. For clear-cut presentations.
- **Tree of Thought (ToT):** Branching differential. Explore 2-4 paths, score, rule out, converge. For ambiguity/risk.
- **Default:** Chain is the voice. Tree is the brain. Tree runs silently unless escalation is warranted.
- **Override:** User can force Chain, force Tree, or leave on Auto. System always complies.
- **No hardcoded ratio.** The CoT/ToT split emerges from clinical signals, not a preset percentage. A rural clinic and an academic ED will naturally produce different ratios — the system adapts to where it lands.

---

## The Behavioral Contract

1. Default output is Chain (simple, direct, no extra chatter).
2. Tree runs silently as a background differential detector.
3. Escalate only when necessary (anomalies / ambiguity / high stakes / failed verification).
4. If it escalates, it says ONE short line to signal why — then proceeds.
5. Override is always honored (FORCE_CHAIN / FORCE_TREE / AUTO).
6. If user expects Chain but system sees risk, it flags it briefly, then either:
   - Continues in Chain if user forced it, or
   - Switches to Tree if in Auto.

---

## 3 Modes Exposed

| Mode | Behavior |
|------|----------|
| **AUTO** (default) | Chain output + silent Tree monitor |
| **FORCE_CHAIN** | Never branch. Still allowed to warn once. |
| **FORCE_TREE** | Always branch (capped), then converge. |

---

## Tree Trigger Logic

Tree engages when ANY of these trip. Confidence thresholds are adjusted by the tenant-level **Tree Sensitivity** setting (see below).

### 1. Anomaly / Conflict Triggers
- Contradictory inputs (symptom A reported + symptom A denied)
- Vitals don't match reported symptoms
- Medication conflicts with diagnosis
- Schema mismatch, unexpected nulls

### 2. Ambiguity Triggers
- Multiple plausible diagnoses
- Missing information that changes the assessment materially
- Symptoms span multiple clinical domains

### 3. High-Stakes Triggers
- Red flag symptoms (chest pain, sudden neuro changes, suicidal ideation)
- Pediatric weight-based dosing
- Medication reconciliation with 5+ active meds
- Post-surgical assessment

### 4. Low-Confidence Triggers
- Model confidence below threshold (adjusted by sensitivity — see below)
- Too many assumptions required
- Sparse transcript data

**If none trigger -> Chain.**

---

## Tree Sensitivity Knob (Tenant-Level)

The CoT/ToT ratio is NOT hardcoded. It emerges from clinical signals. But different deployment contexts have different baseline complexity — a rural clinic sees mostly straightforward presentations, an academic ED sees ambiguity on every patient. The sensitivity knob lets each tenant tune how eagerly Tree engages.

**Stored in:** `tenant_ai_skill_config` (key: `tree_sensitivity`)

| Sensitivity | CoT Threshold | Caution Band | Tree Fires When... | Best For |
|-------------|---------------|--------------|---------------------|----------|
| `conservative` | confidence >= 90 | 70-89 | Almost any uncertainty triggers branching | Academic medical centers, teaching hospitals, specialty clinics |
| `balanced` (default) | confidence >= 80 | 60-79 | Moderate uncertainty triggers branching | General hospitals, multi-specialty, post-acute |
| `aggressive` | confidence >= 65 | 50-64 | Only serious anomalies trigger branching | Rural primary care, urgent care, high-volume clinics |

### How Sensitivity Adjusts Behavior

| Output Zone | `conservative` | `balanced` | `aggressive` |
|-------------|----------------|------------|--------------|
| **Chain (concise)** | >= 90 | >= 80 | >= 65 |
| **Chain + Caution** | 70-89 | 60-79 | 50-64 |
| **Tree Escalation** | < 70 | < 60 | < 50 |

### Expected Natural Ratios (Not Enforced — Just Observed)

These are what the system is likely to produce given the clinical case mix at each site type. The system logs `reasoning_mode_used` per encounter so tenants can see their actual ratio over time.

| Deployment Context | Expected CoT/ToT | Why |
|---|---|---|
| Rural primary care | ~85/15 | Mostly URI, HTN, diabetes refills |
| Urban ED | ~50/50 | High acuity, undifferentiated complaints |
| Academic medical center | ~40/60 | Complex multi-morbidity, rare presentations |
| Oncology/Cardiology specialty | ~30/70 | Almost everything is complex by definition |
| Post-acute/SNF | ~60/40 | Medication reconciliation, falls, delirium |
| Pediatrics | ~65/35 | Weight-based dosing, atypical presentations |

### Pitch-Ready Summary

> "Compass Riley auto-calibrates its reasoning depth to clinical complexity. In a rural clinic, it's fast and direct. In an academic ED, it branches differentials automatically. Same system, proportional intelligence."

---

## Tree Constraints (No Overthinking)

| Parameter | Limit |
|-----------|-------|
| Branches | 2-4 max |
| Depth | 2 max |
| Convergence | Mandatory — pick ONE and execute |
| If can't converge | Flag for provider review |

### Scoring Rubric (Fixed, Not Creative)
- Safety / correctness
- Clinical evidence strength
- Blast radius (what happens if wrong?)
- Reversibility (can we course-correct?)

---

## Reason Codes (Audit Trail)

| Code | Meaning | Example |
|------|---------|---------|
| `CONFLICTING_SIGNALS` | Contradictory clinical data | "Reports no pain" but HR elevated |
| `HIGH_BLAST_RADIUS` | Wrong answer has severe consequences | Medication dosing, allergy miss |
| `SECURITY_SENSITIVE` | PHI/auth/access control involved | N/A for clinical (maps to system use) |
| `AMBIGUOUS_REQUIREMENTS` | Multiple valid interpretations | Cough could be URI, GERD, or TB |
| `VERIFICATION_FAILED` | Prior assertion didn't hold | Lab results contradict initial assessment |
| `LOW_CONFIDENCE` | Model confidence below tenant threshold | Sparse transcript, unclear presentation |

---

## Output Examples

*Thresholds shown below use `balanced` sensitivity defaults. Actual thresholds vary by tenant setting.*

### Chain Output (Confidence >= CoT threshold)
> Assessment: Allergic rhinitis. Symptoms consistent with seasonal allergies — nasal congestion, sneezing, clear rhinorrhea, no fever. `[STATED]`

### Chain + Caution (Caution band)
> Assessment: Likely viral URI. Cough duration worth monitoring if no improvement in 7 days. `[STATED]` `[GAP: duration not specified — verify with patient]`

### Tree Escalation (Below caution band)
> "Signals conflict — ruling out alternatives before committing."
>
> Assessment: Persistent nonproductive cough with 8lb unintentional weight loss over 2 months. `[STATED]`
>
> Differential considered:
> - URI: Ruled out — no acute onset, no fever, no nasal symptoms `[INFERRED]`
> - GERD: Possible — recommend positional symptom assessment `[GAP]`
> - Pulmonary pathology: Cannot rule out given weight loss + duration — recommend chest imaging `[INFERRED — FLAGGED FOR PROVIDER REVIEW]`

### User Forces Chain But System Disagrees
> "I can do the direct path; note: weight loss + persistent cough warrants imaging."

---

## Session Map

| Session | Focus | Deliverables | Status |
|---------|-------|-------------|--------|
| 1 | Reasoning Engine Core | Mode Router, Tree Trigger Engine, Branch Evaluator, Override Gate, Minimal Explain Layer, Sensitivity Knob | DONE |
| 2 | Integration with Compass Riley | Wire into SOAP note generator, consultation mode, realtime transcription. Per-tenant sensitivity config. | DONE |
| 3 | Testing & Audit | Behavioral tests for all trigger types, output format verification, reason code audit logging, sensitivity boundary tests, edge cases | DONE |

---

## Session 1: Reasoning Engine Core (~6 hours)

**Goal:** Build the 6 core components that sit between "AI thought" and "AI spoke."

### Deliverables

| # | Task | File | Status |
|---|------|------|--------|
| 1.1 | Mode Router — determines AUTO/FORCE_CHAIN/FORCE_TREE from request metadata | `supabase/functions/_shared/compass-riley/modeRouter.ts` | DONE |
| 1.2 | Tree Trigger Engine — evaluates anomaly/ambiguity/stakes/confidence against sensitivity-adjusted thresholds, emits escalate + reason_code | `supabase/functions/_shared/compass-riley/treeTriggerEngine.ts` | DONE |
| 1.3 | Branch Evaluator — generates 2-4 branches, scores with fixed rubric, converges | `supabase/functions/_shared/compass-riley/branchEvaluator.ts` | DONE |
| 1.4 | Minimal Explain Layer — maps reason_code to one 12-word sentence | `supabase/functions/_shared/compass-riley/minimalExplainLayer.ts` | DONE |
| 1.5 | Override Gate — user mode wins, warn once max | `supabase/functions/_shared/compass-riley/overrideGate.ts` | DONE |
| 1.6 | Sensitivity Config — reads `tree_sensitivity` from `tenant_ai_skill_config`, returns confidence thresholds for CoT/Caution/ToT zones. Defaults to `balanced` if unset. | `supabase/functions/_shared/compass-riley/sensitivityConfig.ts` | DONE |
| 1.7 | Types — ReasoningMode, TriggerResult, BranchResult, ReasonCode, TreeSensitivity, ConfidenceThresholds + ReasoningEncounterInput, DiagnosisInput, MedicationInput | `supabase/functions/_shared/compass-riley/types.ts` | DONE |
| 1.8 | Unit tests — 69 tests across all 6 components + sensitivity boundary tests + full pipeline integration scenarios | `src/services/__tests__/compassRileyReasoning.test.ts` | DONE |

---

## Session 2: Integration with Compass Riley (~6 hours)

**Goal:** Wire reasoning engine into existing clinical AI edge functions.

### Deliverables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2.1 | Wire into SOAP note generation (standard mode) — pipeline orchestrator + client relay via `reasoning_result` WebSocket message | `reasoningPipeline.ts`, `reasoningIntegration.ts`, `realtime_medical_transcription/index.ts` | DONE |
| 2.2 | Wire into consultation mode (premium reasoning) — reasoning runs after consultation analysis | `realtime_medical_transcription/index.ts`, `reasoningIntegration.ts` | DONE |
| 2.3 | Wire into readmission predictor — synthetic ReasoningEncounterInput from patient data | `ai-readmission-predictor/index.ts` | DONE |
| 2.4 | Add mode selector to ScribeModeSwitcher UI — Auto/Chain/Tree radio group | `ScribeModeSwitcher.tsx`, `RealTimeSmartScribe.tsx` | DONE |
| 2.5 | Per-tenant sensitivity wiring — reads `tree_sensitivity` from `tenant_ai_skill_config` at session start, passes to pipeline | `reasoningIntegration.ts`, `ai-readmission-predictor/index.ts` | DONE |
| 2.6 | Audit logging — reason codes fire-and-forget to `ai_transparency_log` via `reasoningAuditLogger.ts` | `reasoningAuditLogger.ts`, `reasoningIntegration.ts` | DONE |

---

## Session 3: Testing & Audit (~6 hours)

**Goal:** Comprehensive behavioral tests, edge cases, and audit verification.

### Deliverables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3.1 | Trigger tests — each trigger type fires correctly | `compassRileyReasoningV2.test.ts` (edge cases section) | DONE |
| 3.2 | Output format tests — Chain concise, Tree structured, escalation one-liner | `compassRileyReasoningV2Integration.test.ts` (section 4) | DONE |
| 3.3 | Override tests — FORCE_CHAIN/FORCE_TREE honored, warn-once verified | `compassRileyReasoningV2.test.ts` (pipeline section) | DONE |
| 3.4 | Sensitivity threshold tests — boundary behavior at each sensitivity level (conservative: 69/70/89/90, balanced: 59/60/79/80, aggressive: 49/50/64/65) | `compassRileyReasoningV2Integration.test.ts` (section 5) | DONE |
| 3.5 | Reason code audit — all codes fire correctly, payload shape verified | `compassRileyReasoningV2Integration.test.ts` (section 6) | DONE |
| 3.6 | Edge cases — empty transcript, zero diagnoses, contradictory vitals, extreme confidence | `compassRileyReasoningV2.test.ts` (section 3) | DONE |
| 3.7 | Integration smoke — full encounter through CoT/ToT pipeline (6 scenarios) | `compassRileyReasoningV2Integration.test.ts` (section 7) | DONE |

---

## Dependencies

- Existing Compass Riley infrastructure (Sessions 1-10 COMPLETE)
- `_shared/clinicalGroundingRules.ts` — grounding tags
- `_shared/conversationDriftGuard.ts` — drift detection (feeds trigger engine)
- `_shared/evidenceRetrievalService.ts` — PubMed evidence
- `_shared/guidelineReferenceEngine.ts` — guideline matching
- `log-ai-confidence-score` — confidence scoring (feeds trigger engine)
- `ai_transparency_log` table — audit trail for reason codes
- `tenant_ai_skill_config` table — per-tenant `tree_sensitivity` setting (conservative/balanced/aggressive)

## Future: Cultural Competency Integration (Session 3+)

After the Cultural Competency MCP Server is built, Tree Trigger Engine will gain a cultural context input that adjusts confidence calculations based on patient population factors (veteran status, housing stability, language, cultural health practices). See `docs/trackers/cultural-competency-mcp-tracker.md`.
