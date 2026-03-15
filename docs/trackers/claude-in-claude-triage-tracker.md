# Claude-in-Claude Triage Intelligence Tracker

> **Purpose:** Add a meta-reasoning layer where Claude reasons about outputs from the 26 existing AI skills — resolving conflicts, calibrating confidence, consolidating alerts, and synthesizing handoff narratives.

**Created:** 2026-03-15
**Owner:** Maria (approved direction), Claude implementing
**Estimated Total:** ~40-50 hours across 4-5 sessions

---

## Architecture Overview

```
26 AI Skills (existing)
       ↓ outputs
Meta-Triage Layer (NEW — Claude-in-Claude)
       ↓ reasoned decisions
Clinician Dashboard / Alert System / Handoff
```

**Pattern:** Extend `mcp-claude-server` with clinical-specific tools that consume outputs from existing AI skills and apply meta-reasoning. All tools use structured JSON output schemas. All decisions logged to `ai_transparency_log` for audit.

**Key Principle:** Not replacing existing skills — reasoning *about* their outputs when they conflict or need calibration.

---

## P0 — Foundation (Session 1)

Infrastructure that all triage tools depend on.

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P0-1 | Triage tool schema definitions | Define JSON schemas for all 4 new MCP tools (input/output types) | 2 | ✅ Done |
| P0-2 | Clinical grounding for MCP Claude server | Port `clinicalGroundingRules.ts` patterns into mcp-claude-server tool dispatch | 2 | ✅ Done |
| P0-3 | Structured output enforcement | Add `tool_choice` / response schema to mcp-claude-server tool handlers (currently free-text) | 2 | ✅ Done |
| P0-4 | Decision chain integration | Wire new tools into `recordDecisionLink()` from `_shared/decisionChain.ts` | 1 | ✅ Done |
| P0-5 | Triage confidence type definitions | TypeScript types for `TriageDecision`, `ConflictResolution`, `CalibratedScore`, `AlertConsolidation` | 1 | ✅ Done |

**Session 1 subtotal:** ~8 hours

---

## P1 — Meta-Triage Tool: Escalation Conflict Resolution (Session 1-2)

**The highest-value tool.** When multiple AI skills produce conflicting signals for the same patient (e.g., vitals say "worsening" but self-report says "feeling great"), Claude reasons about which data source to trust.

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P1-1 | `evaluate-escalation-conflict` tool | New MCP tool in mcp-claude-server: input = {currentDecision, signals[], patientContext}, output = {resolvedLevel, confidence, reasoning, trustWeights} | 4 | ✅ Done |
| P1-2 | Signal aggregation service | Client service that collects outputs from `ai-care-escalation-scorer`, `ai-readmission-predictor`, `ai-fall-risk-predictor`, `ai-missed-checkin-escalation` for a single patient | 3 | ✅ Done |
| P1-3 | Wire into care escalation flow | After `ai-care-escalation-scorer` returns, if conflicting signals detected → call meta-triage before routing alert | 2 | ✅ Done |
| P1-4 | Tests for conflict resolution | Behavioral tests: conflicting signals → correct resolution, same signals → passthrough, edge cases (all high, all low, mixed) | 3 | ✅ Done |

**Session 1-2 subtotal:** ~12 hours

---

## P2 — Alert Consolidation Tool (Session 2)

**Solves alert fatigue.** When 5+ AI skills fire for the same patient simultaneously, Claude consolidates into a single actionable summary with root cause analysis.

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P2-1 | `consolidate-alerts` tool | New MCP tool: input = {alerts[], patientContext}, output = {rootCauses[], actionableSummary, consolidatedSeverity, individualAlertDispositions[]} | 4 | ✅ Done |
| P2-2 | Alert batching service | Client service that batches alerts within a 60-second window before consolidation | 2 | ✅ Done |
| P2-3 | Clinician-facing consolidated view | UI component showing consolidated alert with expandable individual alerts | 3 | ✅ Done |
| P2-4 | Tests for consolidation | Behavioral tests: 5 related alerts → 1 summary, unrelated alerts → separate, empty/single → passthrough | 2 | ✅ Done |

**Session 2 subtotal:** ~11 hours

---

## P3 — Confidence Calibration Tool (Session 3)

**Recalibrates raw AI scores.** When `ai-readmission-predictor` says 92% risk but the cultural/SDOH factors weren't weighted well, Claude adjusts the score based on factor reliability for this specific patient population.

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P3-1 | `calibrate-confidence` tool | New MCP tool: input = {originalScore, factors[], patientDemographics, populationStats}, output = {calibratedScore, adjustmentReasoning, factorReliability[], recommendedAction} | 4 | ✅ Done |
| P3-2 | Population context fetcher | Service that pulls relevant population stats from `cultural_competency` data + tenant demographics for calibration context | 2 | ✅ Done |
| P3-3 | Wire into readmission predictor | After `ai-readmission-predictor` returns, call calibration before displaying risk score | 2 | ✅ Done |
| P3-4 | Wire into fall risk predictor | Same pattern for `ai-fall-risk-predictor` | 1 | ✅ Done |
| P3-5 | Tests for calibration | Behavioral tests: SDOH-heavy patient → adjusted score, well-represented population → minimal adjustment, missing data → wider confidence interval | 2 | ✅ Done |

**Session 3 subtotal:** ~11 hours

---

## P4 — Handoff Narrative Synthesis Tool (Session 4)

**Shift handoff intelligence.** Claude synthesizes escalation history, active alerts, care plan changes, and pending actions into a "what matters most for the next shift" narrative.

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P4-1 | `synthesize-handoff-narrative` tool | New MCP tool: input = {escalationLog[], activeCareAlerts[], carePlanChanges[], pendingActions[]}, output = {narrative, criticalItems[], resolvedSinceLastShift[], watchItems[]} | 4 | ✅ Done |
| P4-2 | Shift context aggregator | Service that pulls relevant data for a unit/floor within a shift window (8/12 hours) | 2 | ✅ Done |
| P4-3 | Integration with handoff workflow | Wire into existing `handoff_packets` / `ai-shift-handoff-summaries` flow | 2 | ✅ Done |
| P4-4 | Tests for synthesis | Behavioral tests: busy shift → prioritized narrative, quiet shift → minimal output, cross-shift continuity preserved | 2 | ✅ Done |

**Session 4 subtotal:** ~10 hours

---

## P5 — Override Justification & Appeal (Session 4-5)

**Audit trail for clinical overrides.** When a clinician silences or overrides an AI escalation, Claude generates a structured justification — forces reasoning, creates documentation.

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P5-1 | Override justification prompt | When clinician clicks "override", Claude asks structured questions and generates rationale | 3 | ✅ Done |
| P5-2 | Appeal analysis tool | When escalation was `none` but clinician believes it should be higher — Claude reviews evidence and recommends | 2 | ✅ Done |
| P5-3 | Override audit table + migration | `ai_escalation_overrides` table: decision_id, original_level, override_level, justification, clinician_id, timestamp | 1 | ✅ Done |
| P5-4 | Override dashboard panel | Admin view of all overrides with pattern analysis (which AI skills get overridden most?) | 2 | ✅ Done |
| P5-5 | Tests for override flow | Behavioral tests: override with valid reason → accepted, override without reason → blocked, appeal with evidence → re-evaluated | 2 | ✅ Done |

**Session 4-5 subtotal:** ~10 hours

---

## Summary

| Priority | Focus | Items | Est. Hours | Status |
|----------|-------|-------|-----------|--------|
| P0 | Foundation (schemas, grounding, types) | 5 | 8 | **5/5 ✅** |
| P1 | Meta-Triage: Escalation Conflict Resolution | 4 | 12 | **4/4 ✅** |
| P2 | Alert Consolidation (alert fatigue fix) | 4 | 11 | **4/4 ✅** |
| P3 | Confidence Calibration | 5 | 11 | **5/5 ✅** |
| P4 | Handoff Narrative Synthesis | 4 | 10 | **4/4 ✅** |
| P5 | Override Justification & Appeal | 5 | 10 | **5/5 ✅** |
| **Total** | | **27** | **~62** | **27/27 ✅** |

**Estimated sessions:** 4-5 sessions (~12-15 hours each)

---

## Dependencies

| Dependency | Impact | Status |
|-----------|--------|--------|
| `mcp-claude-server` currently has 3 generic tools | P0 extends it with clinical tools | Available |
| `ai-care-escalation-scorer` is 777 lines (god file) | P1-3 needs to call it; may need decomposition first | Flagged in PROJECT_STATE |
| `_shared/decisionChain.ts` exists | P0-4 wires into it | Available |
| `clinicalGroundingRules.ts` exists | P0-2 ports patterns | Available |
| Cultural competency MCP server | P3-2 needs population context | Available |
| Handoff infrastructure (`handoff_packets`, etc.) | P4-3 integrates with it | Available |

---

## Design Constraints

1. **All new tools use structured JSON output** — no free-text parsing (CLAUDE.md rule)
2. **All decisions logged to `ai_transparency_log`** — HTI-2 readiness
3. **PHI de-identification before Claude sees data** — existing mcp-claude-server pattern
4. **Model pinned explicitly** — no `latest` (CLAUDE.md rule)
5. **Confidence scores include reliability metadata** — not just a number
6. **Override flow requires clinician identity** — JWT-verified, not client-provided
7. **Alert consolidation is additive** — original individual alerts preserved, consolidation is a layer on top
