/**
 * Triage Tool Handlers — Claude-in-Claude Meta-Reasoning
 *
 * P0-3: Structured output enforcement (JSON schemas for all responses)
 * P0-4: Decision chain integration (every triage decision is auditable)
 *
 * Each handler:
 * 1. Validates input against the tool schema
 * 2. De-identifies data before sending to Claude
 * 3. Builds a grounded system prompt with triage-specific constraints
 * 4. Calls Claude with structured JSON output (tool_choice pattern)
 * 5. Records the decision in ai_decision_chain
 * 6. Returns typed, validated output
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0?target=deno";
import { recordDecisionLink } from "../_shared/decisionChain.ts";
import type { EdgeFunctionLogger } from "../_shared/auditLogger.ts";
import {
  buildEscalationConflictConstraints,
  buildAlertConsolidationConstraints,
  buildConfidenceCalibrationConstraints,
  buildHandoffNarrativeConstraints,
} from "./triageGrounding.ts";
import type {
  EscalationConflictInput,
  EscalationConflictOutput,
  AlertConsolidationInput,
  AlertConsolidationOutput,
  ConfidenceCalibrationInput,
  ConfidenceCalibrationOutput,
  HandoffNarrativeInput,
  HandoffNarrativeOutput,
} from "./types.ts";
import {
  ESCALATION_CONFLICT_TOOL,
  ALERT_CONSOLIDATION_TOOL,
  CONFIDENCE_CALIBRATION_TOOL,
  HANDOFF_NARRATIVE_TOOL,
} from "./triageTools.schemas.ts";

// Pinned model for all triage tools — Sonnet for accuracy-critical clinical reasoning
const TRIAGE_MODEL = "claude-sonnet-4-5-20250929";

/** Result from a triage tool handler */
export interface TriageToolResult {
  output: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// ============================================================================
// P1: evaluate-escalation-conflict
// ============================================================================

export async function handleEscalationConflict(
  anthropic: Anthropic,
  args: EscalationConflictInput,
  logger: EdgeFunctionLogger
): Promise<TriageToolResult> {
  const constraints = buildEscalationConflictConstraints();

  const systemPrompt = `You are a clinical meta-triage AI. Your role is to resolve conflicting escalation signals from multiple AI clinical skills for the same patient.

You receive signals from different AI skills (fall risk predictor, readmission predictor, care escalation scorer, etc.) that may disagree about a patient's escalation level. Your job is to reason about which signals to trust, assign trust weights, and produce a single resolved escalation decision.

${constraints}`;

  const userPrompt = `Resolve the following escalation conflict for patient ${args.patient_id}:

Current decision: ${args.current_decision}

Conflicting signals (${args.signals.length} total):
${JSON.stringify(args.signals, null, 2)}

${args.patient_demographics ? `Patient demographics (de-identified):
${JSON.stringify(args.patient_demographics, null, 2)}` : "No demographic context available."}`;

  const response = await anthropic.messages.create({
    model: TRIAGE_MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: userPrompt }],
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    // CR-2-SISTER-4: structured output via forced tool_use — replaces
    // free-text + ```json fence stripping in parseJsonResponse.
    tools: [ESCALATION_CONFLICT_TOOL],
    tool_choice: { type: "tool", name: "submit_escalation_resolution" },
  });

  const output = extractToolUseInput<EscalationConflictOutput>(
    response,
    "submit_escalation_resolution",
    logger,
    "evaluate-escalation-conflict",
  );

  // P0-4: Record decision chain link
  await recordDecisionLink({
    tenant_id: args.tenant_id,
    trigger_type: "ai_initiated",
    trigger_source: "mcp-claude-server/evaluate-escalation-conflict",
    context_snapshot: {
      patient_id: args.patient_id,
      signal_count: args.signals.length,
      skill_keys: args.signals.map((s) => s.skill_key),
      current_decision: args.current_decision,
    },
    model_id: TRIAGE_MODEL,
    skill_key: "meta_triage_escalation_conflict",
    decision_type: "escalation",
    decision_summary: `Resolved ${args.signals.length} conflicting signals: ${args.current_decision} → ${output.resolved_level} (confidence: ${output.confidence})`,
    confidence_score: output.confidence,
    authority_tier: 2,
    action_taken: output.conflict_detected
      ? `Conflict resolved: ${output.conflict_summary}`
      : "No conflict — signals aligned",
    outcome: output.requires_review ? "pending_review" : "success",
  });

  return {
    output,
    model: TRIAGE_MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ============================================================================
// P2: consolidate-alerts
// ============================================================================

export async function handleAlertConsolidation(
  anthropic: Anthropic,
  args: AlertConsolidationInput,
  logger: EdgeFunctionLogger
): Promise<TriageToolResult> {
  const constraints = buildAlertConsolidationConstraints();

  const systemPrompt = `You are a clinical alert consolidation AI. Your role is to take multiple simultaneous alerts for one patient and consolidate them into a single actionable summary with root cause analysis.

You reduce alert fatigue by identifying root causes shared across multiple alerts, while NEVER suppressing genuine clinical concerns. Original alerts are always preserved — your consolidation adds a reasoning layer on top.

${constraints}`;

  const userPrompt = `Consolidate the following ${args.alerts.length} alerts for patient ${args.patient_id} (collected within ${args.collection_window}):

${JSON.stringify(args.alerts, null, 2)}`;

  const response = await anthropic.messages.create({
    model: TRIAGE_MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: userPrompt }],
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    // CR-2-SISTER-4: structured output via forced tool_use.
    tools: [ALERT_CONSOLIDATION_TOOL],
    tool_choice: { type: "tool", name: "submit_alert_consolidation" },
  });

  const output = extractToolUseInput<AlertConsolidationOutput>(
    response,
    "submit_alert_consolidation",
    logger,
    "consolidate-alerts",
  );

  // P0-4: Record decision chain link
  await recordDecisionLink({
    tenant_id: args.tenant_id,
    trigger_type: "ai_initiated",
    trigger_source: "mcp-claude-server/consolidate-alerts",
    context_snapshot: {
      patient_id: args.patient_id,
      alert_count: args.alerts.length,
      alert_categories: [...new Set(args.alerts.map((a) => a.category))],
      collection_window: args.collection_window,
    },
    model_id: TRIAGE_MODEL,
    skill_key: "meta_triage_alert_consolidation",
    decision_type: "escalation",
    decision_summary: `Consolidated ${args.alerts.length} alerts → ${output.root_causes.length} root causes, severity: ${output.consolidated_severity}`,
    // G-4-style: avoid Math.min(...arr) — stack-overflow risk on large arrays.
    confidence_score: output.root_causes.length > 0
      ? output.root_causes.reduce(
          (acc, r) => Math.min(acc, r.confidence),
          Number.POSITIVE_INFINITY,
        )
      : undefined,
    authority_tier: 2,
    action_taken: output.actionable_summary,
    outcome: output.requires_review ? "pending_review" : "success",
  });

  return {
    output,
    model: TRIAGE_MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ============================================================================
// P3: calibrate-confidence
// ============================================================================

export async function handleConfidenceCalibration(
  anthropic: Anthropic,
  args: ConfidenceCalibrationInput,
  logger: EdgeFunctionLogger
): Promise<TriageToolResult> {
  const constraints = buildConfidenceCalibrationConstraints();

  const systemPrompt = `You are a clinical confidence calibration AI. Your role is to recalibrate risk scores from AI clinical skills by assessing factor reliability for this specific patient population.

When a readmission predictor says 92% risk but cultural/SDOH factors weren't properly weighted for this population, you adjust the score and explain why. You also identify what additional data would improve confidence.

${constraints}`;

  const userPrompt = `Calibrate the following risk score for patient ${args.patient_id}:

Original skill: ${args.skill_key}
Original score: ${args.original_score}/100
Original confidence: ${args.original_confidence}

Risk factors (${args.factors.length} total):
${JSON.stringify(args.factors, null, 2)}

${args.population_context ? `Population context:
${JSON.stringify(args.population_context, null, 2)}` : "No population context available — note this limitation in your calibration."}`;

  const response = await anthropic.messages.create({
    model: TRIAGE_MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: userPrompt }],
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    // CR-2-SISTER-4: structured output via forced tool_use.
    tools: [CONFIDENCE_CALIBRATION_TOOL],
    tool_choice: { type: "tool", name: "submit_confidence_calibration" },
  });

  const output = extractToolUseInput<ConfidenceCalibrationOutput>(
    response,
    "submit_confidence_calibration",
    logger,
    "calibrate-confidence",
  );

  // P0-4: Record decision chain link
  await recordDecisionLink({
    tenant_id: args.tenant_id,
    trigger_type: "ai_initiated",
    trigger_source: "mcp-claude-server/calibrate-confidence",
    context_snapshot: {
      patient_id: args.patient_id,
      skill_key: args.skill_key,
      original_score: args.original_score,
      original_confidence: args.original_confidence,
      factor_count: args.factors.length,
    },
    model_id: TRIAGE_MODEL,
    skill_key: "meta_triage_confidence_calibration",
    decision_type: "clinical",
    decision_summary: `Calibrated ${args.skill_key} score: ${args.original_score} → ${output.calibrated_score} (${output.adjustment_direction}, delta: ${output.score_delta})`,
    confidence_score: output.calibrated_confidence,
    authority_tier: 2,
    action_taken: output.recommended_action,
    outcome: output.needs_additional_data ? "pending_review" : "success",
  });

  return {
    output,
    model: TRIAGE_MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ============================================================================
// P4: synthesize-handoff-narrative
// ============================================================================

export async function handleHandoffNarrative(
  anthropic: Anthropic,
  args: HandoffNarrativeInput,
  logger: EdgeFunctionLogger
): Promise<TriageToolResult> {
  const constraints = buildHandoffNarrativeConstraints();

  const systemPrompt = `You are a clinical shift handoff synthesis AI. Your role is to synthesize escalation history, care plan changes, and pending actions from a shift into a prioritized "what matters most for the next shift" narrative.

You write for busy nurses and clinicians receiving handoff. Lead with critical items, then resolved items (good news), then watch items. Be concise, clinical, and actionable.

${constraints}`;

  const userPrompt = `Synthesize handoff narrative for unit ${args.unit_id}:

Shift: ${args.shift_start} to ${args.shift_end}
Patients on unit: ${args.patient_ids.length}

Escalation events (${args.escalation_events.length}):
${JSON.stringify(args.escalation_events, null, 2)}

Care plan changes (${args.care_plan_changes.length}):
${JSON.stringify(args.care_plan_changes, null, 2)}

Pending actions (${args.pending_actions.length}):
${JSON.stringify(args.pending_actions, null, 2)}`;

  const response = await anthropic.messages.create({
    model: TRIAGE_MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: userPrompt }],
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    // CR-2-SISTER-4: structured output via forced tool_use.
    tools: [HANDOFF_NARRATIVE_TOOL],
    tool_choice: { type: "tool", name: "submit_handoff_narrative" },
  });

  const output = extractToolUseInput<HandoffNarrativeOutput>(
    response,
    "submit_handoff_narrative",
    logger,
    "synthesize-handoff-narrative",
  );

  // P0-4: Record decision chain link
  await recordDecisionLink({
    tenant_id: args.tenant_id,
    trigger_type: "ai_initiated",
    trigger_source: "mcp-claude-server/synthesize-handoff-narrative",
    context_snapshot: {
      unit_id: args.unit_id,
      shift_start: args.shift_start,
      shift_end: args.shift_end,
      patient_count: args.patient_ids.length,
      escalation_event_count: args.escalation_events.length,
      care_plan_change_count: args.care_plan_changes.length,
      pending_action_count: args.pending_actions.length,
    },
    model_id: TRIAGE_MODEL,
    skill_key: "meta_triage_handoff_narrative",
    decision_type: "operational",
    decision_summary: `Shift handoff: ${output.critical_items.length} critical, ${output.resolved_since_last_shift.length} resolved, ${output.watch_items.length} watch. Unit: ${output.unit_status}`,
    confidence_score: undefined,
    authority_tier: 2,
    action_taken: `Generated handoff narrative (${output.unit_status} unit, ${output.incoming_complexity} complexity)`,
    outcome: "success",
  });

  return {
    output,
    model: TRIAGE_MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ============================================================================
// Tool-Use Block Extractor — CR-2-SISTER-4 Structured Output via tool_choice
// ============================================================================

/** Minimal shape of an Anthropic messages.create response we care about. */
interface AnthropicResponseLike {
  content: Array<
    | { type: "tool_use"; name?: string; input?: unknown }
    | { type: "text"; text: string }
    | { type: string }
  >;
}

/**
 * Extract the structured `input` object from the tool_use content block of an
 * Anthropic response. Replaces the previous text + ```json regex + JSON.parse
 * pipeline now that all four triage tools force a specific tool via
 * `tool_choice`. Throws on the (impossible-in-practice) case where Claude does
 * not return a matching tool_use block, so callers see a clear failure instead
 * of an `undefined`.
 */
function extractToolUseInput<T>(
  response: AnthropicResponseLike,
  expectedToolName: string,
  logger: EdgeFunctionLogger,
  toolLabel: string,
): T {
  const block = response.content.find(
    (b): b is { type: "tool_use"; name?: string; input?: unknown } =>
      b.type === "tool_use",
  );

  if (!block || block.input === undefined || block.input === null) {
    const blockTypes = response.content.map((b) => b.type);
    logger.error("Claude did not return tool_use block", {
      tool: toolLabel,
      expected: expectedToolName,
      blockTypes,
    });
    throw new Error(
      `Triage tool ${toolLabel} failed: expected tool_use block named ` +
        `"${expectedToolName}", got: ${blockTypes.join(",") || "(empty)"}`,
    );
  }

  if (block.name && block.name !== expectedToolName) {
    logger.error("Claude returned wrong tool", {
      tool: toolLabel,
      expected: expectedToolName,
      got: block.name,
    });
    throw new Error(
      `Triage tool ${toolLabel} failed: expected tool "${expectedToolName}", ` +
        `Claude used "${block.name}"`,
    );
  }

  return block.input as T;
}

// ============================================================================
// Dispatcher — routes tool name to handler
// ============================================================================

/** Dispatch a triage tool call to the appropriate handler */
export async function dispatchTriageTool(
  toolName: string,
  args: Record<string, unknown>,
  anthropic: Anthropic,
  logger: EdgeFunctionLogger
): Promise<TriageToolResult> {
  switch (toolName) {
    case "evaluate-escalation-conflict":
      return handleEscalationConflict(
        anthropic,
        args as unknown as EscalationConflictInput,
        logger
      );
    case "consolidate-alerts":
      return handleAlertConsolidation(
        anthropic,
        args as unknown as AlertConsolidationInput,
        logger
      );
    case "calibrate-confidence":
      return handleConfidenceCalibration(
        anthropic,
        args as unknown as ConfidenceCalibrationInput,
        logger
      );
    case "synthesize-handoff-narrative":
      return handleHandoffNarrative(
        anthropic,
        args as unknown as HandoffNarrativeInput,
        logger
      );
    default:
      throw new Error(`Unknown triage tool: ${toolName}`);
  }
}
