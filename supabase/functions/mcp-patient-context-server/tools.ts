// =====================================================
// MCP Patient Context Server — Tool Definitions
// Exposes patientContextService methods as MCP tools so
// any AI agent can fetch canonical patient data through
// a single authoritative path (ATLUS Unity + Accountability)
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

export const TOOLS = {
  // --- Canonical full context ---

  "get_patient_context": {
    description:
      "Canonical patient context aggregation. Returns demographics, contacts, " +
      "timeline, and risk summary in one call. Always use this instead of " +
      "querying patient tables directly — guarantees tenant isolation, audit " +
      "logging, and data freshness metadata (context_meta).",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        include_contacts: { type: "boolean", description: "Include contacts (default true)" },
        include_timeline: { type: "boolean", description: "Include timeline events (default true)" },
        include_risk: { type: "boolean", description: "Include risk summary (default true)" },
        timeline_days: { type: "number", description: "Timeline window in days (default 30)" },
        max_timeline_events: { type: "number", description: "Max timeline events (default 50)" },
      },
      required: ["patient_id"],
    },
  },

  // --- Fast demographics-only ---

  "get_minimal_context": {
    description:
      "Fast demographics-only fetch. Use when only basic patient identity " +
      "(name, DOB, MRN, tenant, language) is needed. Avoids the cost of the " +
      "contacts/timeline/risk joins.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
      },
      required: ["patient_id"],
    },
  },

  // --- Scoped sections (useful for focused AI reasoning) ---

  "get_patient_contacts": {
    description:
      "Retrieve patient's emergency contacts, caregivers, and care team members. " +
      "Use for escalation routing, caregiver notifications, and handoff context.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
      },
      required: ["patient_id"],
    },
  },

  "get_patient_timeline": {
    description:
      "Recent clinical and engagement timeline: check-ins, self-reports, " +
      "encounters, risk assessments. Time-windowed and bounded. Use for " +
      "trend detection, documentation review, and longitudinal AI reasoning.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        days: { type: "number", description: "Lookback window (default 30, max 365)" },
        max_events: { type: "number", description: "Maximum events (default 50, max 500)" },
      },
      required: ["patient_id"],
    },
  },

  "get_patient_risk_summary": {
    description:
      "Current risk assessments: readmission risk, fall risk, and overall " +
      "severity level. Use before triage decisions, escalation routing, and " +
      "care plan updates.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
      },
      required: ["patient_id"],
    },
  },

  "patient_exists": {
    description:
      "Fast boolean existence check. Returns { exists: true|false }. Use before " +
      "creating records that reference a patient_id, or to validate input IDs.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
      },
      required: ["patient_id"],
    },
  },

  "ping": PING_TOOL,
};
