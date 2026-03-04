// =====================================================
// MCP Cultural Competency Server — Tool Definitions
// 8 tools for culturally-informed clinical context
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

const POPULATION_ENUM = [
  "veterans",
  "unhoused",
  "latino",
  "black_aa",
  "isolated_elderly",
  "indigenous",
  "immigrant_refugee",
  "lgbtq_elderly",
];

export const TOOLS = {
  "get_cultural_context": {
    description:
      "Get the full cultural profile for a population — communication style, clinical considerations, barriers, trust factors, support systems, and SDOH codes. Use this when an AI skill needs comprehensive cultural context for a patient encounter.",
    inputSchema: {
      type: "object",
      properties: {
        population: {
          type: "string",
          enum: POPULATION_ENUM,
          description: "Population key (e.g., 'veterans', 'latino', 'black_aa')",
        },
      },
      required: ["population"],
    },
  },

  "get_communication_guidance": {
    description:
      "Get communication style recommendations for a specific clinical context (medication counseling, diagnosis delivery, care plan discussion, or discharge). Returns language preferences, key phrases, and things to avoid.",
    inputSchema: {
      type: "object",
      properties: {
        population: {
          type: "string",
          enum: POPULATION_ENUM,
          description: "Population key",
        },
        context: {
          type: "string",
          enum: ["medication", "diagnosis", "care_plan", "discharge", "general"],
          description: "Clinical communication context",
        },
      },
      required: ["population"],
    },
  },

  "get_clinical_considerations": {
    description:
      "Get population-specific clinical risks, prevalence data, and screening recommendations. Optionally filter by specific conditions the patient has.",
    inputSchema: {
      type: "object",
      properties: {
        population: {
          type: "string",
          enum: POPULATION_ENUM,
          description: "Population key",
        },
        conditions: {
          type: "array",
          items: { type: "string" },
          description: "Optional: filter to considerations relevant to these conditions",
        },
      },
      required: ["population"],
    },
  },

  "get_barriers_to_care": {
    description:
      "Get access barriers and mitigation strategies for a population. Includes practical solutions for medication storage, transportation, insurance gaps, and competing priorities.",
    inputSchema: {
      type: "object",
      properties: {
        population: {
          type: "string",
          enum: POPULATION_ENUM,
          description: "Population key",
        },
      },
      required: ["population"],
    },
  },

  "get_sdoh_codes": {
    description:
      "Get ICD-10 Z-codes relevant to a population for SDOH documentation. Returns codes with descriptions and applicability notes.",
    inputSchema: {
      type: "object",
      properties: {
        population: {
          type: "string",
          enum: POPULATION_ENUM,
          description: "Population key",
        },
      },
      required: ["population"],
    },
  },

  "check_drug_interaction_cultural": {
    description:
      "Check if traditional/cultural remedies used by a population may interact with prescribed medications. Returns remedy details, potential interactions, and warning levels.",
    inputSchema: {
      type: "object",
      properties: {
        population: {
          type: "string",
          enum: POPULATION_ENUM,
          description: "Population key",
        },
        medications: {
          type: "array",
          items: { type: "string" },
          description: "List of prescribed medication names to check against cultural remedies",
        },
      },
      required: ["population"],
    },
  },

  "get_trust_building_guidance": {
    description:
      "Get historical context and trust-building strategies for a population. Includes specific historical events that affect medical trust and evidence-based approaches to building therapeutic alliance.",
    inputSchema: {
      type: "object",
      properties: {
        population: {
          type: "string",
          enum: POPULATION_ENUM,
          description: "Population key",
        },
      },
      required: ["population"],
    },
  },

  "seed_profiles": {
    description:
      "Admin tool: Push all 8 built-in cultural profiles to the database. This enables tenant customization and content updates without redeployment. Idempotent — safe to call multiple times (uses upsert).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  "ping": PING_TOOL,
};
