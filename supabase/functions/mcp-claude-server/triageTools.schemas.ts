/**
 * Anthropic tool_choice schemas for the 4 triage tools.
 *
 * These replace the free-text `Respond with JSON matching this exact schema:`
 * blocks that lived in the user prompts. With `tool_choice: { type: "tool", name }`
 * Claude is forced to return its answer inside a `tool_use` content block with the
 * structured object in `.input` — no markdown stripping, no JSON.parse fallback.
 *
 * CR-2-SISTER-4: P0-3 was already aiming at structured output via the "this exact
 * schema" prompt convention, but parsing relied on stripping ```json fences. This
 * file makes the schema the contract enforced by the SDK.
 *
 * Schemas intentionally mirror the corresponding Output types in ./types.ts; any
 * shape drift between the two MUST be reconciled in both files (no silent skew).
 */

import type Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.1";
type Tool = Anthropic.Messages.Tool;

// ---------------------------------------------------------------------------
// P1: evaluate-escalation-conflict
// ---------------------------------------------------------------------------
export const ESCALATION_CONFLICT_TOOL: Tool = {
  name: "submit_escalation_resolution",
  description:
    "Return the resolved escalation decision for a patient when multiple AI clinical " +
    "skills disagree. All fields required.",
  input_schema: {
    type: "object",
    properties: {
      resolved_level: {
        type: "string",
        enum: ["none", "monitor", "notify", "escalate", "emergency"],
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      urgency: {
        type: "string",
        enum: ["routine", "elevated", "urgent", "critical"],
      },
      reasoning: { type: "string" },
      trust_weights: {
        type: "array",
        items: {
          type: "object",
          properties: {
            skill_key: { type: "string" },
            weight: { type: "number", minimum: 0, maximum: 1 },
            reasoning: { type: "string" },
            data_reliability: {
              type: "string",
              enum: ["high", "moderate", "low", "unknown"],
            },
          },
          required: ["skill_key", "weight", "reasoning", "data_reliability"],
        },
      },
      conflict_detected: { type: "boolean" },
      conflict_summary: { type: ["string", "null"] },
      recommended_actions: { type: "array", items: { type: "string" } },
      requires_review: { type: "boolean" },
    },
    required: [
      "resolved_level",
      "confidence",
      "urgency",
      "reasoning",
      "trust_weights",
      "conflict_detected",
      "conflict_summary",
      "recommended_actions",
      "requires_review",
    ],
  },
};

// ---------------------------------------------------------------------------
// P2: consolidate-alerts
// ---------------------------------------------------------------------------
export const ALERT_CONSOLIDATION_TOOL: Tool = {
  name: "submit_alert_consolidation",
  description:
    "Return the consolidated summary of multiple alerts on one patient. " +
    "Reduces alert fatigue while preserving every original alert via dispositions.",
  input_schema: {
    type: "object",
    properties: {
      consolidated_severity: {
        type: "string",
        enum: ["none", "monitor", "notify", "escalate", "emergency"],
      },
      actionable_summary: { type: "string" },
      root_causes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            related_alert_ids: { type: "array", items: { type: "string" } },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            recommended_intervention: { type: "string" },
          },
          required: ["description", "related_alert_ids", "confidence", "recommended_intervention"],
        },
      },
      alert_dispositions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            alert_id: { type: "string" },
            disposition: {
              type: "string",
              enum: ["consolidated", "standalone", "suppressed", "elevated"],
            },
            reasoning: { type: "string" },
            root_cause_index: { type: ["integer", "null"] },
          },
          required: ["alert_id", "disposition", "reasoning", "root_cause_index"],
        },
      },
      total_alerts: { type: "integer", minimum: 0 },
      consolidated_count: { type: "integer", minimum: 0 },
      requires_review: { type: "boolean" },
    },
    required: [
      "consolidated_severity",
      "actionable_summary",
      "root_causes",
      "alert_dispositions",
      "total_alerts",
      "consolidated_count",
      "requires_review",
    ],
  },
};

// ---------------------------------------------------------------------------
// P3: calibrate-confidence
// ---------------------------------------------------------------------------
export const CONFIDENCE_CALIBRATION_TOOL: Tool = {
  name: "submit_confidence_calibration",
  description:
    "Return a recalibrated risk score after assessing factor reliability for the " +
    "patient's population context. Adjust the score up, down, or leave unchanged.",
  input_schema: {
    type: "object",
    properties: {
      calibrated_score: { type: "number", minimum: 0, maximum: 100 },
      calibrated_confidence: { type: "number", minimum: 0, maximum: 1 },
      adjustment_direction: {
        type: "string",
        enum: ["increased", "decreased", "unchanged"],
      },
      score_delta: { type: "number" },
      adjustment_reasoning: { type: "string" },
      factor_reliability: {
        type: "array",
        items: {
          type: "object",
          properties: {
            factor_name: { type: "string" },
            reliability: {
              type: "string",
              enum: ["high", "moderate", "low", "unknown"],
            },
            adjusted_weight: { type: "number", minimum: 0, maximum: 1 },
            adjustment_reasoning: { type: "string" },
          },
          required: ["factor_name", "reliability", "adjusted_weight", "adjustment_reasoning"],
        },
      },
      recommended_action: { type: "string" },
      needs_additional_data: { type: "boolean" },
      additional_data_suggestions: { type: "array", items: { type: "string" } },
    },
    required: [
      "calibrated_score",
      "calibrated_confidence",
      "adjustment_direction",
      "score_delta",
      "adjustment_reasoning",
      "factor_reliability",
      "recommended_action",
      "needs_additional_data",
      "additional_data_suggestions",
    ],
  },
};

// ---------------------------------------------------------------------------
// P4: synthesize-handoff-narrative
// ---------------------------------------------------------------------------
export const HANDOFF_NARRATIVE_TOOL: Tool = {
  name: "submit_handoff_narrative",
  description:
    "Return the synthesized shift handoff narrative — critical items first, then " +
    "resolved items, then watch items. Concise, clinical, actionable.",
  input_schema: {
    type: "object",
    properties: {
      narrative: { type: "string" },
      critical_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            patient_id: { type: "string" },
            description: { type: "string" },
            reasoning: { type: "string" },
            urgency: {
              type: "string",
              enum: ["routine", "elevated", "urgent", "critical"],
            },
            recommended_action: { type: "string" },
          },
          required: ["patient_id", "description", "reasoning", "urgency", "recommended_action"],
        },
      },
      resolved_since_last_shift: { type: "array", items: { type: "string" } },
      watch_items: { type: "array", items: { type: "string" } },
      unit_status: {
        type: "string",
        enum: ["stable", "busy", "high_acuity", "critical"],
      },
      incoming_complexity: {
        type: "string",
        enum: ["light", "moderate", "heavy"],
      },
    },
    required: [
      "narrative",
      "critical_items",
      "resolved_since_last_shift",
      "watch_items",
      "unit_status",
      "incoming_complexity",
    ],
  },
};
