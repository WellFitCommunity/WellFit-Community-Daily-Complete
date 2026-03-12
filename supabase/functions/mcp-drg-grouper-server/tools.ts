// =====================================================
// MCP DRG Grouper Server — Tool Definitions
// Standalone Revenue Intelligence Engine
// 5 tools: group + get + reimbursement + validate + risk
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

export const TOOLS = {
  // --- Core DRG Grouping ---

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

  // --- Revenue Intelligence ---

  "estimate_reimbursement": {
    description: "Calculate expected reimbursement from DRG weight × payer base rate × wage index. Returns operating + capital payment breakdown. Supports Medicare DRG-based and Medicaid per diem models.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: { type: "string", description: "Encounter UUID (auto-looks up DRG result)" },
        drg_code: { type: "string", description: "DRG code (alternative to encounter lookup)" },
        drg_weight: { type: "number", description: "DRG weight (required if drg_code provided without encounter)" },
        payer_type: {
          type: "string",
          enum: ["medicare", "medicaid", "commercial", "tricare", "workers_comp"],
          description: "Payer for rate lookup"
        },
        fiscal_year: { type: "number", description: "Fiscal year for rate lookup (default: current)" },
        state_code: { type: "string", description: "State code (for Medicaid per diem)" },
        wage_index_override: { type: "number", description: "Override wage index (for what-if analysis)" }
      },
      required: ["payer_type"]
    }
  },

  "validate_coding": {
    description: "Rule-based check for commonly missed charges by category (lab, imaging, pharmacy, nursing, procedures). Returns missing charge alerts with estimated revenue impact. No AI — pure business rules.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: { type: "string", description: "Encounter UUID" },
        service_date: { type: "string", description: "Date to validate (YYYY-MM-DD)" }
      },
      required: ["encounter_id", "service_date"]
    }
  },

  "flag_revenue_risk": {
    description: "AI-powered revenue risk analysis. Reviews daily charges against clinical documentation. Identifies missing codes, upgrade opportunities, documentation gaps, and modifier suggestions. Advisory only — never auto-files.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: { type: "string", description: "Encounter UUID" },
        service_date: { type: "string", description: "Date to analyze (YYYY-MM-DD)" }
      },
      required: ["encounter_id", "service_date"]
    }
  },

  // --- Payer Reference ---

  "get_payer_rules": {
    description: "Look up payer reimbursement rules by type, state, and fiscal year. Returns DRG base rates (Medicare), per diem tiers (Medicaid), or other rule types. Read-only reference data.",
    inputSchema: {
      type: "object",
      properties: {
        payer_type: {
          type: "string",
          enum: ["medicare", "medicaid", "commercial", "tricare", "workers_comp"],
          description: "Payer category"
        },
        fiscal_year: { type: "number", description: "Fiscal year (e.g., 2026)" },
        state_code: { type: "string", description: "2-letter state code (required for Medicaid)" },
        rule_type: {
          type: "string",
          enum: ["drg_based", "per_diem", "case_rate", "percent_of_charges", "fee_schedule"],
          description: "Reimbursement methodology filter"
        },
        is_active: { type: "boolean", description: "Filter active rules only (default true)" }
      },
      required: ["payer_type", "fiscal_year"]
    }
  },

  "ping": PING_TOOL
};
