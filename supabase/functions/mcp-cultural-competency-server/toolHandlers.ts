// =====================================================
// MCP Cultural Competency Server — Tool Handlers
// Implements the 7 cultural context tools + routing
// =====================================================

import type {
  CommunicationContext,
  CulturalProfile,
  CulturalRemedy,
} from "./types.ts";
import { VALID_CONTEXTS } from "./types.ts";
import { getProfile, getAvailablePopulations } from "./profiles/index.ts";

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

export function createToolHandlers(logger: MCPLogger) {
  /**
   * Resolve population string to profile, returning error object if not found.
   */
  function resolveProfile(
    population: string
  ): CulturalProfile | { error: string; available: string[] } {
    const profile = getProfile(population);
    if (!profile) {
      return {
        error: `Unknown population: '${population}'`,
        available: getAvailablePopulations(),
      };
    }
    return profile;
  }

  // -----------------------------------------------
  // Tool 1: get_cultural_context — full profile
  // -----------------------------------------------
  async function getCulturalContext(params: { population: string }) {
    const result = resolveProfile(params.population);
    if ("error" in result) return result;

    logger.info("Cultural context retrieved", {
      tool: "get_cultural_context",
      population: result.populationKey,
    });

    return {
      status: "success",
      population: result.populationKey,
      displayName: result.displayName,
      description: result.description,
      caveat: result.caveat,
      communication: result.communication,
      clinicalConsiderations: result.clinicalConsiderations,
      barriers: result.barriers,
      culturalPractices: result.culturalPractices,
      trustFactors: result.trustFactors,
      supportSystems: result.supportSystems,
      sdohCodes: result.sdohCodes,
      culturalRemedies: result.culturalRemedies,
    };
  }

  // -----------------------------------------------
  // Tool 2: get_communication_guidance
  // -----------------------------------------------
  async function getCommunicationGuidance(params: {
    population: string;
    context?: string;
  }) {
    const result = resolveProfile(params.population);
    if ("error" in result) return result;

    const ctx = (params.context || "general") as CommunicationContext;
    if (!VALID_CONTEXTS.includes(ctx)) {
      return {
        error: `Invalid context: '${params.context}'`,
        valid: VALID_CONTEXTS,
      };
    }

    const comm = result.communication;
    const contextGuidance = comm.contextSpecific[ctx] || null;

    logger.info("Communication guidance retrieved", {
      tool: "get_communication_guidance",
      population: result.populationKey,
      context: ctx,
    });

    return {
      status: "success",
      population: result.populationKey,
      context: ctx,
      caveat: result.caveat,
      languagePreferences: comm.languagePreferences,
      formalityLevel: comm.formalityLevel,
      familyInvolvementNorm: comm.familyInvolvementNorm,
      keyPhrases: comm.keyPhrases,
      avoidPhrases: comm.avoidPhrases,
      contextSpecificGuidance: contextGuidance,
    };
  }

  // -----------------------------------------------
  // Tool 3: get_clinical_considerations
  // -----------------------------------------------
  async function getClinicalConsiderations(params: {
    population: string;
    conditions?: string[];
  }) {
    const result = resolveProfile(params.population);
    if ("error" in result) return result;

    let considerations = result.clinicalConsiderations;

    // Filter by conditions if provided
    if (params.conditions && params.conditions.length > 0) {
      const lowerConditions = params.conditions.map((c) => c.toLowerCase());
      considerations = considerations.filter((cc) =>
        lowerConditions.some(
          (lc) =>
            cc.condition.toLowerCase().includes(lc) ||
            cc.clinicalNote.toLowerCase().includes(lc)
        )
      );
    }

    logger.info("Clinical considerations retrieved", {
      tool: "get_clinical_considerations",
      population: result.populationKey,
      filterConditions: params.conditions?.length ?? 0,
      resultsReturned: considerations.length,
    });

    return {
      status: "success",
      population: result.populationKey,
      caveat: result.caveat,
      considerations,
      totalAvailable: result.clinicalConsiderations.length,
    };
  }

  // -----------------------------------------------
  // Tool 4: get_barriers_to_care
  // -----------------------------------------------
  async function getBarriersToCare(params: { population: string }) {
    const result = resolveProfile(params.population);
    if ("error" in result) return result;

    logger.info("Barriers to care retrieved", {
      tool: "get_barriers_to_care",
      population: result.populationKey,
    });

    return {
      status: "success",
      population: result.populationKey,
      caveat: result.caveat,
      barriers: result.barriers,
      supportSystems: result.supportSystems,
    };
  }

  // -----------------------------------------------
  // Tool 5: get_sdoh_codes
  // -----------------------------------------------
  async function getSDOHCodes(params: { population: string }) {
    const result = resolveProfile(params.population);
    if ("error" in result) return result;

    logger.info("SDOH codes retrieved", {
      tool: "get_sdoh_codes",
      population: result.populationKey,
      codesReturned: result.sdohCodes.length,
    });

    return {
      status: "success",
      population: result.populationKey,
      sdohCodes: result.sdohCodes,
    };
  }

  // -----------------------------------------------
  // Tool 6: check_drug_interaction_cultural
  // -----------------------------------------------
  async function checkDrugInteractionCultural(params: {
    population: string;
    medications?: string[];
  }) {
    const result = resolveProfile(params.population);
    if ("error" in result) return result;

    const remedies = result.culturalRemedies;
    let relevantRemedies: CulturalRemedy[] = remedies;

    // If specific medications provided, filter to remedies with potential interactions
    if (params.medications && params.medications.length > 0) {
      const lowerMeds = params.medications.map((m) => m.toLowerCase());
      relevantRemedies = remedies.filter((remedy) =>
        remedy.potentialInteractions.some((interaction) =>
          lowerMeds.some((med) => interaction.toLowerCase().includes(med))
        ) || remedy.warningLevel === "warning"
      );

      // If no specific matches, still return all remedies with a note
      if (relevantRemedies.length === 0) {
        relevantRemedies = remedies;
      }
    }

    logger.info("Drug interaction cultural check", {
      tool: "check_drug_interaction_cultural",
      population: result.populationKey,
      medicationsChecked: params.medications?.length ?? 0,
      remediesReturned: relevantRemedies.length,
    });

    return {
      status: "success",
      population: result.populationKey,
      caveat: result.caveat,
      note: "Always ask patients about traditional remedies, herbal teas, supplements, and cultural health practices. Patients may not volunteer this information unless asked directly.",
      culturalRemedies: relevantRemedies,
      culturalPractices: result.culturalPractices,
    };
  }

  // -----------------------------------------------
  // Tool 7: get_trust_building_guidance
  // -----------------------------------------------
  async function getTrustBuildingGuidance(params: { population: string }) {
    const result = resolveProfile(params.population);
    if ("error" in result) return result;

    logger.info("Trust building guidance retrieved", {
      tool: "get_trust_building_guidance",
      population: result.populationKey,
    });

    return {
      status: "success",
      population: result.populationKey,
      caveat: result.caveat,
      trustFactors: result.trustFactors,
      communicationGuidance: {
        keyPhrases: result.communication.keyPhrases,
        avoidPhrases: result.communication.avoidPhrases,
        familyInvolvementNorm: result.communication.familyInvolvementNorm,
      },
    };
  }

  // -----------------------------------------------
  // Dispatcher
  // -----------------------------------------------
  async function handleToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    switch (toolName) {
      case "get_cultural_context":
        return getCulturalContext(args as { population: string });
      case "get_communication_guidance":
        return getCommunicationGuidance(
          args as { population: string; context?: string }
        );
      case "get_clinical_considerations":
        return getClinicalConsiderations(
          args as { population: string; conditions?: string[] }
        );
      case "get_barriers_to_care":
        return getBarriersToCare(args as { population: string });
      case "get_sdoh_codes":
        return getSDOHCodes(args as { population: string });
      case "check_drug_interaction_cultural":
        return checkDrugInteractionCultural(
          args as { population: string; medications?: string[] }
        );
      case "get_trust_building_guidance":
        return getTrustBuildingGuidance(args as { population: string });
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  return { handleToolCall };
}
