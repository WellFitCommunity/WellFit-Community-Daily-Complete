/**
 * MCP Claude Server — Tool Definitions
 *
 * P0-1: JSON schemas for all tools (generic + triage).
 * Centralized tool registry with input schemas for MCP protocol.
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

/** MCP tool definition shape */
export interface MCPToolDef {
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

// ============================================================================
// Generic Tools (existing)
// ============================================================================

const GENERIC_TOOLS: Record<string, MCPToolDef> = {
  "ping": PING_TOOL as MCPToolDef,
  "analyze-text": {
    description: "Analyze text with Claude AI",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to analyze" },
        prompt: { type: "string", description: "Analysis instructions" },
        model: { type: "string", default: "claude-sonnet-4-5-20250929" },
      },
      required: ["text", "prompt"],
    },
  },
  "generate-suggestion": {
    description: "Generate AI suggestions",
    inputSchema: {
      type: "object",
      properties: {
        context: { type: "object", description: "Context data" },
        task: { type: "string", description: "Task description" },
        model: { type: "string", default: "claude-haiku-4-5-20251001" },
      },
      required: ["context", "task"],
    },
  },
  "summarize": {
    description: "Summarize content",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Content to summarize" },
        maxLength: { type: "number", default: 500 },
        model: { type: "string", default: "claude-haiku-4-5-20251001" },
      },
      required: ["content"],
    },
  },
};

// ============================================================================
// Triage Tools (P0-1: new Claude-in-Claude meta-reasoning tools)
// ============================================================================

const TRIAGE_TOOLS: Record<string, MCPToolDef> = {
  "evaluate-escalation-conflict": {
    description:
      "Meta-triage: resolve conflicting escalation signals from multiple AI skills. " +
      "When vitals say 'worsening' but self-report says 'feeling great', this tool " +
      "reasons about which data source to trust and returns a resolved escalation level.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient identifier (ID only, never PHI)" },
        tenant_id: { type: "string", description: "Tenant ID for RLS scoping" },
        signals: {
          type: "array",
          description: "Array of conflicting signals from different AI skills",
          items: {
            type: "object",
            properties: {
              skill_key: { type: "string" },
              recommended_level: {
                type: "string",
                enum: ["none", "monitor", "notify", "escalate", "emergency"],
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              factors: { type: "array", items: { type: "string" } },
              data_source: { type: "string" },
              generated_at: { type: "string", format: "date-time" },
            },
            required: ["skill_key", "recommended_level", "confidence", "factors", "data_source", "generated_at"],
          },
        },
        current_decision: {
          type: "string",
          enum: ["none", "monitor", "notify", "escalate", "emergency"],
          description: "Current escalation decision before meta-triage",
        },
        patient_demographics: {
          type: "object",
          description: "De-identified demographics for population context (optional)",
          properties: {
            age_range: { type: "string" },
            risk_tier: { type: "string" },
            days_since_admission: { type: "number" },
            active_conditions_count: { type: "number" },
          },
        },
      },
      required: ["patient_id", "tenant_id", "signals", "current_decision"],
    },
  },

  "consolidate-alerts": {
    description:
      "Consolidate multiple simultaneous alerts for one patient into a single actionable " +
      "summary with root cause analysis. Reduces alert fatigue — 5 alerts become 1 summary.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient identifier (ID only)" },
        tenant_id: { type: "string", description: "Tenant ID for RLS scoping" },
        alerts: {
          type: "array",
          description: "Array of active alerts to consolidate",
          items: {
            type: "object",
            properties: {
              alert_id: { type: "string" },
              skill_key: { type: "string" },
              severity: {
                type: "string",
                enum: ["none", "monitor", "notify", "escalate", "emergency"],
              },
              summary: { type: "string" },
              details: { type: "object" },
              generated_at: { type: "string", format: "date-time" },
              category: { type: "string" },
            },
            required: ["alert_id", "skill_key", "severity", "summary", "generated_at", "category"],
          },
        },
        collection_window: {
          type: "string",
          description: "ISO 8601 duration for collection window (e.g., PT1H)",
        },
      },
      required: ["patient_id", "tenant_id", "alerts", "collection_window"],
    },
  },

  "calibrate-confidence": {
    description:
      "Recalibrate a risk score from an AI skill by assessing factor reliability " +
      "for this specific patient population. Adjusts scores when cultural/SDOH " +
      "factors weren't properly weighted.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient identifier (ID only)" },
        tenant_id: { type: "string", description: "Tenant ID for RLS scoping" },
        skill_key: { type: "string", description: "Which AI skill produced the original score" },
        original_score: { type: "number", minimum: 0, maximum: 100, description: "Original risk score" },
        original_confidence: { type: "number", minimum: 0, maximum: 1, description: "Original confidence" },
        factors: {
          type: "array",
          description: "Risk factors contributing to the score",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              original_weight: { type: "number", minimum: 0, maximum: 1 },
              category: { type: "string", enum: ["clinical", "sdoh", "behavioral", "demographic"] },
              data_source: { type: "string" },
              data_freshness: { type: "string" },
            },
            required: ["name", "original_weight", "category", "data_source", "data_freshness"],
          },
        },
        population_context: {
          type: "object",
          description: "Population context for calibration (optional)",
          properties: {
            primary_language: { type: "string" },
            community_group: { type: "string" },
            setting: { type: "string", enum: ["rural", "urban", "suburban"] },
            insurance_category: { type: "string" },
          },
        },
      },
      required: ["patient_id", "tenant_id", "skill_key", "original_score", "original_confidence", "factors"],
    },
  },

  "synthesize-handoff-narrative": {
    description:
      "Generate a 'what matters most for the next shift' narrative from escalation " +
      "history, care plan changes, and pending actions. Summarizes a full shift " +
      "into a prioritized handoff for the incoming team.",
    inputSchema: {
      type: "object",
      properties: {
        unit_id: { type: "string", description: "Unit/floor identifier" },
        tenant_id: { type: "string", description: "Tenant ID for RLS scoping" },
        shift_start: { type: "string", format: "date-time", description: "Shift start time" },
        shift_end: { type: "string", format: "date-time", description: "Shift end time" },
        patient_ids: {
          type: "array",
          items: { type: "string" },
          description: "Patient IDs on this unit (never names)",
        },
        escalation_events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "string" },
              event_type: { type: "string" },
              severity: { type: "string", enum: ["none", "monitor", "notify", "escalate", "emergency"] },
              description: { type: "string" },
              status: { type: "string", enum: ["active", "resolved", "monitoring"] },
              resolution: { type: "string" },
            },
            required: ["timestamp", "event_type", "severity", "description", "status"],
          },
        },
        care_plan_changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              change_description: { type: "string" },
              changed_by_role: { type: "string" },
              timestamp: { type: "string" },
              reason: { type: "string" },
            },
            required: ["change_description", "changed_by_role", "timestamp", "reason"],
          },
        },
        pending_actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string" },
              priority: { type: "string", enum: ["routine", "elevated", "urgent", "critical"] },
              due_by: { type: "string" },
              assigned_role: { type: "string" },
              context: { type: "string" },
            },
            required: ["action", "priority", "due_by", "assigned_role", "context"],
          },
        },
      },
      required: ["unit_id", "tenant_id", "shift_start", "shift_end", "patient_ids",
                  "escalation_events", "care_plan_changes", "pending_actions"],
    },
  },
};

// ============================================================================
// Combined Tool Registry
// ============================================================================

/** All MCP tools available in this server */
export const ALL_TOOLS: Record<string, MCPToolDef> = {
  ...GENERIC_TOOLS,
  ...TRIAGE_TOOLS,
};

/** Check if a tool is a triage tool (uses structured output + clinical grounding) */
export function isTriageTool(toolName: string): boolean {
  return toolName in TRIAGE_TOOLS;
}

/** List of triage tool names */
export const TRIAGE_TOOL_NAMES = Object.keys(TRIAGE_TOOLS);
