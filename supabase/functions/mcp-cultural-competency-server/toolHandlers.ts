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
import { getProfile, getAvailablePopulations, getAllProfiles } from "./profiles/index.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

/** Row shape from cultural_profiles table */
interface CulturalProfileRow {
  population_key: string;
  display_name: string;
  description: string;
  caveat: string;
  profile_data: Record<string, unknown>;
  tenant_id: string | null;
}

/**
 * Convert a database row to a CulturalProfile.
 * profile_data JSONB contains the nested sections.
 */
function rowToProfile(row: CulturalProfileRow): CulturalProfile {
  const pd = row.profile_data;
  return {
    populationKey: row.population_key,
    displayName: row.display_name,
    description: row.description,
    caveat: row.caveat,
    communication: pd.communication,
    clinicalConsiderations: pd.clinicalConsiderations,
    barriers: pd.barriers,
    culturalPractices: pd.culturalPractices,
    trustFactors: pd.trustFactors,
    supportSystems: pd.supportSystems,
    sdohCodes: pd.sdohCodes,
    culturalRemedies: pd.culturalRemedies,
  } as CulturalProfile;
}

export function createToolHandlers(logger: MCPLogger, sb: SupabaseClient | null) {
  /**
   * Try database first, then fall back to hardcoded profile.
   * DB lookup: global profiles (tenant_id IS NULL) OR tenant-specific.
   */
  async function resolveProfile(
    population: string
  ): Promise<CulturalProfile | { error: string; available: string[] }> {
    const key = population.toLowerCase().replace(/[\s-]+/g, "_");

    // Try database first
    if (sb) {
      try {
        const { data, error } = await sb
          .from("cultural_profiles")
          .select("population_key, display_name, description, caveat, profile_data, tenant_id")
          .eq("population_key", key)
          .eq("is_active", true)
          .order("tenant_id", { ascending: true, nullsFirst: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          logger.info("Profile loaded from database", { population: key });
          return rowToProfile(data[0] as CulturalProfileRow);
        }
      } catch (err: unknown) {
        logger.error("DB profile lookup failed, falling back to hardcoded", {
          population: key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Fall back to hardcoded profiles
    const profile = getProfile(population);
    if (!profile) {
      // Also check DB for available populations
      const available = await getAvailablePopulationsWithDB();
      return {
        error: `Unknown population: '${population}'`,
        available,
      };
    }
    return profile;
  }

  /**
   * Get available populations from DB + hardcoded.
   */
  async function getAvailablePopulationsWithDB(): Promise<string[]> {
    const hardcoded = getAvailablePopulations() as string[];
    if (!sb) return hardcoded;

    try {
      const { data } = await sb
        .from("cultural_profiles")
        .select("population_key")
        .eq("is_active", true);
      if (data) {
        const dbKeys = data.map((r: { population_key: string }) => r.population_key);
        const merged = new Set([...hardcoded, ...dbKeys]);
        return Array.from(merged);
      }
    } catch {
      // Fall back to hardcoded
    }
    return hardcoded;
  }

  // -----------------------------------------------
  // Tool 1: get_cultural_context — full profile
  // -----------------------------------------------
  async function getCulturalContext(params: { population: string }) {
    const result = await resolveProfile(params.population);
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
    const result = await resolveProfile(params.population);
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
    const result = await resolveProfile(params.population);
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
    const result = await resolveProfile(params.population);
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
    const result = await resolveProfile(params.population);
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
    const result = await resolveProfile(params.population);
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
    const result = await resolveProfile(params.population);
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
  // Tool 8: seed_profiles — push hardcoded to DB
  // -----------------------------------------------
  async function seedProfiles() {
    if (!sb) {
      return {
        status: "error",
        error: "No database connection available. Cannot seed profiles.",
      };
    }

    const profiles = getAllProfiles();
    let seeded = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
      const { populationKey, displayName, description, caveat, ...rest } = profile;

      const { error } = await sb
        .from("cultural_profiles")
        .upsert(
          {
            population_key: populationKey,
            display_name: displayName,
            description,
            caveat,
            profile_data: rest,
            tenant_id: null, // Global profile
            is_active: true,
          },
          { onConflict: "population_key,tenant_id" }
        );

      if (error) {
        errors.push(`${populationKey}: ${error.message}`);
      } else {
        seeded++;
      }
    }

    logger.info("Cultural profiles seeded to database", {
      tool: "seed_profiles",
      seeded,
      skipped,
      errors: errors.length,
    });

    return {
      status: errors.length === 0 ? "success" : "partial",
      seeded,
      skipped,
      totalProfiles: profiles.length,
      errors: errors.length > 0 ? errors : undefined,
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
      case "seed_profiles":
        return seedProfiles();
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  return { handleToolCall };
}
