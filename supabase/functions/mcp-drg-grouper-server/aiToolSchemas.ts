// =====================================================
// MCP DRG Grouper Server — AI Tool Schemas
// Structured output schema for Claude tool_choice pattern.
// Guarantees JSON structure without regex parsing.
// =====================================================

/**
 * DRG Grouper output schema — forces Claude to return
 * structured 3-pass DRG analysis via tool use.
 */
export const DRG_ANALYSIS_TOOL = {
  name: "submit_drg_analysis",
  description: "Submit the structured DRG analysis result",
  input_schema: {
    type: "object" as const,
    required: [
      "principal_diagnosis", "secondary_diagnoses", "procedure_codes",
      "drg_assignment", "clinical_reasoning", "confidence",
      "requires_clinical_review", "review_reasons"
    ],
    properties: {
      principal_diagnosis: {
        type: "object" as const,
        required: ["code", "description", "rationale"],
        properties: {
          code: { type: "string" as const, description: "ICD-10-CM code" },
          description: { type: "string" as const },
          rationale: { type: "string" as const }
        }
      },
      secondary_diagnoses: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["code", "description", "is_cc", "is_mcc", "rationale"],
          properties: {
            code: { type: "string" as const },
            description: { type: "string" as const },
            is_cc: { type: "boolean" as const },
            is_mcc: { type: "boolean" as const },
            rationale: { type: "string" as const }
          }
        }
      },
      procedure_codes: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["code", "code_system", "description"],
          properties: {
            code: { type: "string" as const },
            code_system: { type: "string" as const },
            description: { type: "string" as const }
          }
        }
      },
      drg_assignment: {
        type: "object" as const,
        required: ["base_drg", "cc_drg", "mcc_drg", "optimal_drg"],
        properties: {
          base_drg: {
            type: "object" as const,
            required: ["code", "description", "weight", "mdc", "mdc_description"],
            properties: {
              code: { type: "string" as const },
              description: { type: "string" as const },
              weight: { type: "number" as const },
              mdc: { type: "string" as const },
              mdc_description: { type: "string" as const }
            }
          },
          cc_drg: {
            type: ["object", "null"] as unknown as "object",
            properties: {
              code: { type: "string" as const },
              description: { type: "string" as const },
              weight: { type: "number" as const }
            }
          },
          mcc_drg: {
            type: ["object", "null"] as unknown as "object",
            properties: {
              code: { type: "string" as const },
              description: { type: "string" as const },
              weight: { type: "number" as const }
            }
          },
          optimal_drg: {
            type: "object" as const,
            required: ["code", "description", "weight", "pass_used"],
            properties: {
              code: { type: "string" as const },
              description: { type: "string" as const },
              weight: { type: "number" as const },
              pass_used: { type: "string" as const }
            }
          }
        }
      },
      clinical_reasoning: { type: "string" as const },
      confidence: { type: "number" as const },
      requires_clinical_review: { type: "boolean" as const },
      review_reasons: { type: "array" as const, items: { type: "string" as const } }
    }
  }
};
