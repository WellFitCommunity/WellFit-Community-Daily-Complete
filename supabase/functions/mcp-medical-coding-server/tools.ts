// =====================================================
// MCP Medical Coding Server — Tool Definitions
// Chain 6: Medical Coding Processor
// 11 tools: payer rules, charge aggregation, DRG grouping,
//           revenue optimization, charge validation, projection
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

export const TOOLS = {
  // --- Session 1: Payer Rules Engine (6a) ---

  "get_payer_rules": {
    description: "Look up payer reimbursement rules by type, state, and fiscal year. Returns DRG base rates (Medicare), per diem tiers (Medicaid), or other rule types.",
    inputSchema: {
      type: "object",
      properties: {
        payer_type: {
          type: "string",
          enum: ["medicare", "medicaid", "commercial", "tricare", "workers_comp"],
          description: "Payer category"
        },
        state_code: { type: "string", description: "2-letter state code (required for Medicaid)" },
        fiscal_year: { type: "number", description: "Fiscal year (e.g., 2026)" },
        rule_type: {
          type: "string",
          enum: ["drg_based", "per_diem", "case_rate", "percent_of_charges", "fee_schedule"],
          description: "Reimbursement methodology filter"
        },
        acuity_tier: {
          type: "string",
          enum: ["icu", "step_down", "med_surg", "rehab", "psych", "snf", "ltac"],
          description: "Acuity tier filter (per diem rules)"
        },
        is_active: { type: "boolean", description: "Filter active rules only (default true)" }
      },
      required: ["payer_type", "fiscal_year"]
    }
  },

  "upsert_payer_rule": {
    description: "Create or update a payer reimbursement rule. Admin/billing access required.",
    inputSchema: {
      type: "object",
      properties: {
        payer_type: {
          type: "string",
          enum: ["medicare", "medicaid", "commercial", "tricare", "workers_comp"],
          description: "Payer category"
        },
        state_code: { type: "string", description: "2-letter state code (NULL for federal)" },
        fiscal_year: { type: "number", description: "Fiscal year" },
        rule_type: {
          type: "string",
          enum: ["drg_based", "per_diem", "case_rate", "percent_of_charges", "fee_schedule"],
          description: "Reimbursement methodology"
        },
        acuity_tier: { type: "string", description: "Acuity tier (for per diem rules)" },
        base_rate_amount: { type: "number", description: "DRG operating base rate" },
        capital_rate_amount: { type: "number", description: "DRG capital rate" },
        wage_index_factor: { type: "number", description: "Geographic wage index (default 1.0)" },
        per_diem_rate: { type: "number", description: "Per diem rate amount" },
        allowable_percentage: { type: "number", description: "Allowable percentage (e.g., 75.0)" },
        max_days: { type: "number", description: "Spell-of-illness day limit" },
        outlier_threshold: { type: "number", description: "High-cost outlier threshold" },
        carve_out_codes: {
          type: "array", items: { type: "string" },
          description: "Procedure codes billed separately from per diem"
        },
        rule_description: { type: "string", description: "Human-readable rule description" },
        source_reference: { type: "string", description: "Regulatory source reference" },
        effective_date: { type: "string", description: "Rule effective date (YYYY-MM-DD)" },
        expiration_date: { type: "string", description: "Rule expiration date (YYYY-MM-DD)" }
      },
      required: ["payer_type", "fiscal_year", "rule_type", "effective_date"]
    }
  },

  // --- Session 2: Charge Aggregation (6b) + DRG Grouper (6c) ---

  "aggregate_daily_charges": {
    description: "Aggregate all billable activity for a patient on a specific date from encounter data (labs, imaging, meds, procedures, E/M codes). Returns categorized charges.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        encounter_id: { type: "string", description: "Encounter UUID" },
        service_date: { type: "string", description: "Date of service (YYYY-MM-DD)" }
      },
      required: ["patient_id", "encounter_id", "service_date"]
    }
  },

  "get_daily_snapshot": {
    description: "Retrieve an existing daily charge snapshot for a patient encounter on a specific date.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: { type: "string", description: "Encounter UUID" },
        service_date: { type: "string", description: "Date of service (YYYY-MM-DD)" }
      },
      required: ["encounter_id"]
    }
  },

  "save_daily_snapshot": {
    description: "Persist a daily charge snapshot after aggregation or review.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: { type: "string", description: "Encounter UUID" },
        patient_id: { type: "string", description: "Patient UUID" },
        admit_date: { type: "string", description: "Admission date (YYYY-MM-DD)" },
        service_date: { type: "string", description: "Service date (YYYY-MM-DD)" },
        day_number: { type: "number", description: "Day of stay (1-based)" },
        charges: { type: "object", description: "Categorized charges object" },
        total_charge_amount: { type: "number", description: "Total charges for the day" },
        charge_count: { type: "number", description: "Number of charge line items" },
        status: {
          type: "string",
          enum: ["draft", "reviewed", "finalized", "billed"],
          description: "Snapshot status"
        }
      },
      required: ["encounter_id", "patient_id", "admit_date", "service_date", "day_number"]
    }
  },

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

  // --- Session 3: Revenue Optimization (6d) ---

  "optimize_daily_revenue": {
    description: "AI validates daily documentation vs acuity tier, identifies missing codes, suggests revenue opportunities. Advisory only — never auto-files. Compliance-safe.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: { type: "string", description: "Encounter UUID" },
        service_date: { type: "string", description: "Date to optimize (YYYY-MM-DD)" }
      },
      required: ["encounter_id", "service_date"]
    }
  },

  "validate_charge_completeness": {
    description: "Rule-based check for commonly missed charges by category (lab, imaging, pharmacy, nursing, procedures). Returns missing charge alerts.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: { type: "string", description: "Encounter UUID" },
        service_date: { type: "string", description: "Date to validate (YYYY-MM-DD)" }
      },
      required: ["encounter_id", "service_date"]
    }
  },

  "get_revenue_projection": {
    description: "Calculate expected reimbursement based on DRG weight × payer base rate × wage index adjustments. Returns operating + capital payment breakdown.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: { type: "string", description: "Encounter UUID (looks up DRG result)" },
        drg_code: { type: "string", description: "DRG code (alternative to encounter lookup)" },
        drg_weight: { type: "number", description: "DRG weight (required if drg_code provided without encounter)" },
        payer_type: {
          type: "string",
          enum: ["medicare", "medicaid", "commercial", "tricare", "workers_comp"],
          description: "Payer for rate lookup"
        },
        fiscal_year: { type: "number", description: "Fiscal year for rate lookup (default: current)" },
        state_code: { type: "string", description: "State code (for Medicaid)" },
        wage_index_override: { type: "number", description: "Override wage index (for what-if analysis)" }
      },
      required: ["payer_type"]
    }
  },

  "ping": PING_TOOL
};
