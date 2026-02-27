// =====================================================
// MCP NPI Registry Server — Tool Definitions
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

export const TOOLS = {
  "validate_npi": {
    description: "Validate an NPI number and check if it is active",
    inputSchema: {
      type: "object",
      properties: {
        npi: { type: "string", description: "10-digit NPI number to validate" }
      },
      required: ["npi"]
    }
  },
  "lookup_npi": {
    description: "Get detailed provider information for an NPI number",
    inputSchema: {
      type: "object",
      properties: {
        npi: { type: "string", description: "10-digit NPI number" }
      },
      required: ["npi"]
    }
  },
  "search_providers": {
    description: "Search for healthcare providers by name, specialty, or location",
    inputSchema: {
      type: "object",
      properties: {
        first_name: { type: "string", description: "Provider first name (for individuals)" },
        last_name: { type: "string", description: "Provider last name (for individuals)" },
        organization_name: { type: "string", description: "Organization name (for organizations)" },
        taxonomy_description: { type: "string", description: "Provider specialty/taxonomy" },
        city: { type: "string", description: "City" },
        state: { type: "string", description: "State abbreviation (e.g., 'TX')" },
        postal_code: { type: "string", description: "ZIP code" },
        enumeration_type: {
          type: "string",
          enum: ["NPI-1", "NPI-2"],
          description: "NPI-1 for individuals, NPI-2 for organizations"
        },
        limit: { type: "number", description: "Max results (default 20, max 200)" }
      },
      required: []
    }
  },
  "search_by_specialty": {
    description: "Search providers by healthcare specialty taxonomy code",
    inputSchema: {
      type: "object",
      properties: {
        taxonomy_code: { type: "string", description: "Healthcare Provider Taxonomy Code" },
        state: { type: "string", description: "State abbreviation" },
        city: { type: "string", description: "City" },
        limit: { type: "number", description: "Max results (default 20)" }
      },
      required: ["taxonomy_code"]
    }
  },
  "get_taxonomy_codes": {
    description: "Get healthcare provider taxonomy codes for a specialty",
    inputSchema: {
      type: "object",
      properties: {
        specialty: { type: "string", description: "Specialty description to search" },
        category: {
          type: "string",
          enum: ["individual", "organization", "all"],
          description: "Provider category filter"
        }
      },
      required: ["specialty"]
    }
  },
  "bulk_validate_npis": {
    description: "Validate multiple NPI numbers in a single request",
    inputSchema: {
      type: "object",
      properties: {
        npis: {
          type: "array",
          items: { type: "string" },
          description: "Array of NPI numbers to validate (max 50)"
        }
      },
      required: ["npis"]
    }
  },
  "get_provider_identifiers": {
    description: "Get all identifier numbers for a provider (state licenses, DEA, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        npi: { type: "string", description: "10-digit NPI number" }
      },
      required: ["npi"]
    }
  },
  "check_npi_deactivation": {
    description: "Check if an NPI has been deactivated and get deactivation details",
    inputSchema: {
      type: "object",
      properties: {
        npi: { type: "string", description: "10-digit NPI number" }
      },
      required: ["npi"]
    }
  },
  "ping": PING_TOOL
};
