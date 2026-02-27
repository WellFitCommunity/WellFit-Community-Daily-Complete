// =====================================================
// MCP Medical Codes Server — Tool Definitions
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

export const TOOLS: Record<string, { description: string; inputSchema: { type: string; properties: Record<string, unknown>; required: string[] } }> = {
  "ping": PING_TOOL,
  "search_cpt": {
    description: "Search CPT (Current Procedural Terminology) codes",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (description or code)" },
        category: { type: "string", description: "Category filter (e.g., 'Surgery', 'E/M')" },
        limit: { type: "number", description: "Max results (default 20)" }
      },
      required: ["query"]
    }
  },
  "search_icd10": {
    description: "Search ICD-10 diagnosis codes",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (description or code)" },
        chapter: { type: "string", description: "ICD-10 chapter filter" },
        limit: { type: "number", description: "Max results (default 20)" }
      },
      required: ["query"]
    }
  },
  "search_hcpcs": {
    description: "Search HCPCS (Healthcare Common Procedure Coding System) codes",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (description or code)" },
        level: { type: "string", description: "Level filter (I or II)" },
        limit: { type: "number", description: "Max results (default 20)" }
      },
      required: ["query"]
    }
  },
  "get_modifiers": {
    description: "Get applicable modifiers for a CPT/HCPCS code",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "CPT or HCPCS code" },
        code_type: { type: "string", enum: ["cpt", "hcpcs"], description: "Code type" }
      },
      required: ["code"]
    }
  },
  "validate_code_combination": {
    description: "Validate if CPT/ICD-10/modifier combination is valid",
    inputSchema: {
      type: "object",
      properties: {
        cpt_codes: { type: "array", items: { type: "string" }, description: "CPT codes" },
        icd10_codes: { type: "array", items: { type: "string" }, description: "ICD-10 codes" },
        modifiers: { type: "array", items: { type: "string" }, description: "Modifier codes" }
      },
      required: ["cpt_codes", "icd10_codes"]
    }
  },
  "check_bundling": {
    description: "Check for bundling/unbundling issues with CPT codes",
    inputSchema: {
      type: "object",
      properties: {
        cpt_codes: { type: "array", items: { type: "string" }, description: "List of CPT codes to check" }
      },
      required: ["cpt_codes"]
    }
  },
  "get_code_details": {
    description: "Get detailed information about a specific code",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "The code to look up" },
        code_type: { type: "string", enum: ["cpt", "icd10", "hcpcs"], description: "Type of code" }
      },
      required: ["code", "code_type"]
    }
  },
  "suggest_codes": {
    description: "Suggest codes based on clinical description",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Clinical description or scenario" },
        code_types: {
          type: "array",
          items: { type: "string", enum: ["cpt", "icd10", "hcpcs"] },
          description: "Types of codes to suggest"
        },
        limit: { type: "number", description: "Max suggestions per type (default 5)" }
      },
      required: ["description"]
    }
  },
  "get_sdoh_codes": {
    description: "Get ICD-10 Z-codes for Social Determinants of Health",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "SDOH category (housing, food, transportation, employment, education, social)",
          enum: ["housing", "food", "transportation", "employment", "education", "social", "all"]
        }
      },
      required: []
    }
  }
};
