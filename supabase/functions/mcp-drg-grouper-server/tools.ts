// =====================================================
// MCP DRG Grouper Server — Tool Definitions
// Standalone: 2 tools (run + get) + ping
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

export const TOOLS = {
  "run_drg_grouper": {
    description: "AI-powered MS-DRG assignment. Extracts ICD-10 codes from clinical documentation, runs 3-pass analysis (base, +CC, +MCC), selects highest valid DRG. Advisory only.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: { type: "string", description: "Encounter UUID" },
        patient_id: { type: "string", description: "Patient UUID" },
        principal_diagnosis: { type: "string", description: "Principal ICD-10 diagnosis code (if known)" },
        additional_diagnoses: {
          type: "array", items: { type: "string" },
          description: "Additional ICD-10 diagnosis codes (if known)"
        },
        procedure_codes: {
          type: "array", items: { type: "string" },
          description: "ICD-10-PCS procedure codes (if known)"
        }
      },
      required: ["encounter_id", "patient_id"]
    }
  },

  "get_drg_result": {
    description: "Retrieve DRG grouping result for an encounter.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: { type: "string", description: "Encounter UUID" },
        grouper_version: { type: "string", description: "Grouper version filter (e.g., 'MS-DRG v43')" }
      },
      required: ["encounter_id"]
    }
  },

  "ping": PING_TOOL
};
