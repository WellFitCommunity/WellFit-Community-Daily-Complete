// =====================================================
// MCP CMS Coverage Server — Tool Definitions
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

export const TOOLS = {
  "search_lcd": {
    description: "Search Local Coverage Determinations (LCDs) by keyword, contractor, or HCPCS code",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (keyword or HCPCS code)" },
        state: { type: "string", description: "State abbreviation (e.g., 'TX', 'CA')" },
        contractor_number: { type: "string", description: "MAC contractor number" },
        status: {
          type: "string",
          enum: ["active", "future", "retired"],
          description: "LCD status filter (default: active)"
        },
        limit: { type: "number", description: "Max results (default 20)" }
      },
      required: ["query"]
    }
  },
  "search_ncd": {
    description: "Search National Coverage Determinations (NCDs) by keyword or procedure",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (keyword or procedure)" },
        benefit_category: { type: "string", description: "Medicare benefit category" },
        status: {
          type: "string",
          enum: ["active", "future", "retired"],
          description: "NCD status filter (default: active)"
        },
        limit: { type: "number", description: "Max results (default 20)" }
      },
      required: ["query"]
    }
  },
  "get_coverage_requirements": {
    description: "Get coverage requirements for a specific HCPCS/CPT code",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "HCPCS or CPT code" },
        state: { type: "string", description: "State abbreviation for local coverage" },
        payer_type: {
          type: "string",
          enum: ["medicare", "medicare_advantage", "medicaid"],
          description: "Payer type (default: medicare)"
        }
      },
      required: ["code"]
    }
  },
  "check_prior_auth_required": {
    description: "Check if prior authorization is required for a procedure",
    inputSchema: {
      type: "object",
      properties: {
        cpt_code: { type: "string", description: "CPT procedure code" },
        icd10_codes: {
          type: "array",
          items: { type: "string" },
          description: "ICD-10 diagnosis codes"
        },
        state: { type: "string", description: "State abbreviation" },
        place_of_service: { type: "string", description: "Place of service code" }
      },
      required: ["cpt_code"]
    }
  },
  "get_lcd_details": {
    description: "Get detailed information about a specific LCD",
    inputSchema: {
      type: "object",
      properties: {
        lcd_id: { type: "string", description: "LCD ID (e.g., 'L12345')" }
      },
      required: ["lcd_id"]
    }
  },
  "get_ncd_details": {
    description: "Get detailed information about a specific NCD",
    inputSchema: {
      type: "object",
      properties: {
        ncd_id: { type: "string", description: "NCD ID (e.g., '220.6.1')" }
      },
      required: ["ncd_id"]
    }
  },
  "get_coverage_articles": {
    description: "Get coverage articles and billing guidance for a code",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "HCPCS or CPT code" },
        article_type: {
          type: "string",
          enum: ["billing", "coding", "utilization", "all"],
          description: "Type of article (default: all)"
        }
      },
      required: ["code"]
    }
  },
  "get_mac_contractors": {
    description: "Get Medicare Administrative Contractor (MAC) information for a state",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "string", description: "State abbreviation" },
        jurisdiction: { type: "string", description: "Jurisdiction type (A/B, DME, HH+Hospice)" }
      },
      required: ["state"]
    }
  },
  "ping": PING_TOOL
};
