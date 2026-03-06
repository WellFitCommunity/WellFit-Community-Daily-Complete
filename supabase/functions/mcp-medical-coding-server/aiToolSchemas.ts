// =====================================================
// MCP Medical Coding Server — AI Tool Schemas
// Structured output schemas for Claude tool_choice
// pattern. Guarantees JSON structure without regex parsing.
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

/**
 * Revenue Optimizer output schema — forces Claude to return
 * structured revenue optimization analysis via tool use.
 */
export const REVENUE_OPTIMIZATION_TOOL = {
  name: "submit_revenue_analysis",
  description: "Submit the structured revenue optimization result",
  input_schema: {
    type: "object" as const,
    required: [
      "documentation_assessment", "missing_codes", "upgrade_opportunities",
      "documentation_gaps", "modifier_suggestions", "summary",
      "total_potential_uplift", "confidence", "requires_clinical_review"
    ],
    properties: {
      documentation_assessment: {
        type: "object" as const,
        required: ["acuity_supported", "current_acuity", "documented_acuity", "gaps"],
        properties: {
          acuity_supported: { type: "boolean" as const },
          current_acuity: { type: "string" as const },
          documented_acuity: { type: "string" as const },
          gaps: { type: "array" as const, items: { type: "string" as const } }
        }
      },
      missing_codes: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["code", "code_system", "description", "rationale", "potential_impact", "confidence"],
          properties: {
            code: { type: "string" as const },
            code_system: { type: "string" as const },
            description: { type: "string" as const },
            rationale: { type: "string" as const },
            potential_impact: { type: "number" as const },
            confidence: { type: "number" as const }
          }
        }
      },
      upgrade_opportunities: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["current_code", "suggested_code", "description", "rationale", "weight_difference", "revenue_impact", "confidence"],
          properties: {
            current_code: { type: "string" as const },
            suggested_code: { type: "string" as const },
            description: { type: "string" as const },
            rationale: { type: "string" as const },
            weight_difference: { type: "number" as const },
            revenue_impact: { type: "number" as const },
            confidence: { type: "number" as const }
          }
        }
      },
      documentation_gaps: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["gap_type", "description", "impact", "suggested_action"],
          properties: {
            gap_type: { type: "string" as const },
            description: { type: "string" as const },
            impact: { type: "string" as const },
            suggested_action: { type: "string" as const }
          }
        }
      },
      modifier_suggestions: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["code", "suggested_modifier", "description", "rationale"],
          properties: {
            code: { type: "string" as const },
            suggested_modifier: { type: "string" as const },
            description: { type: "string" as const },
            rationale: { type: "string" as const }
          }
        }
      },
      summary: { type: "string" as const },
      total_potential_uplift: { type: "number" as const },
      confidence: { type: "number" as const },
      requires_clinical_review: { type: "boolean" as const }
    }
  }
};
