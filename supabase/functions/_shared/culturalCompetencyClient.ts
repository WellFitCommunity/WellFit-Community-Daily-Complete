/**
 * Cultural Competency MCP Client — Shared Edge Function Utility
 *
 * Provides typed access to the Cultural Competency MCP server
 * from other AI edge functions. Uses MCP JSON-RPC 2.0 protocol.
 *
 * Usage:
 *   const context = await fetchCulturalContext("veterans", logger);
 *   if (context) {
 *     // Inject into AI prompt
 *     const section = formatCulturalContextForPrompt(context);
 *   }
 */

import { SUPABASE_URL, SB_SECRET_KEY } from "./env.ts";

// =====================================================
// Types (subset of MCP server responses)
// =====================================================

export interface CulturalContextResponse {
  status: string;
  population: string;
  displayName: string;
  caveat: string;
  communication: {
    languagePreferences: string[];
    formalityLevel: string;
    familyInvolvementNorm: string;
    keyPhrases: string[];
    avoidPhrases: string[];
    contextSpecificGuidance?: string | null;
  };
  clinicalConsiderations: Array<{
    condition: string;
    prevalence: string;
    screeningRecommendation: string;
    clinicalNote: string;
  }>;
  barriers: Array<{
    barrier: string;
    impact: string;
    mitigation: string;
  }>;
  trustFactors: Array<{
    factor: string;
    historicalContext: string;
    trustBuildingStrategy: string;
  }>;
  sdohCodes: Array<{
    code: string;
    description: string;
    applicability: string;
  }>;
  culturalRemedies: Array<{
    remedy: string;
    commonUse: string;
    potentialInteractions: string[];
    warningLevel: "info" | "caution" | "warning";
  }>;
}

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

// =====================================================
// MCP Client
// =====================================================

/**
 * Call the Cultural Competency MCP server via JSON-RPC 2.0.
 * Returns null on failure (non-blocking — cultural context is enrichment, not required).
 */
async function callCulturalMCP(
  toolName: string,
  args: Record<string, unknown>,
  logger: MCPLogger
): Promise<unknown | null> {
  if (!SUPABASE_URL || !SB_SECRET_KEY) {
    logger.error("Cultural competency client: missing SUPABASE_URL or SB_SECRET_KEY");
    return null;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/mcp-cultural-competency-server`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SB_SECRET_KEY}`,
          "apikey": SB_SECRET_KEY,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: { name: toolName, arguments: args },
          id: crypto.randomUUID(),
        }),
      }
    );

    if (!response.ok) {
      logger.error("Cultural competency MCP call failed", {
        status: response.status,
        tool: toolName,
      });
      return null;
    }

    const data = await response.json();
    const textContent = data?.result?.content?.[0]?.text;
    if (!textContent) {
      return null;
    }

    return JSON.parse(textContent);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Cultural competency MCP call error", {
      tool: toolName,
      error: error.message,
    });
    return null;
  }
}

/**
 * Fetch full cultural context for a population.
 * Returns null if population is unknown or server is unavailable.
 */
export async function fetchCulturalContext(
  population: string,
  logger: MCPLogger
): Promise<CulturalContextResponse | null> {
  const result = await callCulturalMCP(
    "get_cultural_context",
    { population },
    logger
  );

  if (!result || typeof result !== "object") return null;
  const typed = result as Record<string, unknown>;
  if (typed.error) return null;

  return result as CulturalContextResponse;
}

/**
 * Fetch communication guidance for a specific clinical context.
 */
export async function fetchCommunicationGuidance(
  population: string,
  context: string,
  logger: MCPLogger
): Promise<Record<string, unknown> | null> {
  const result = await callCulturalMCP(
    "get_communication_guidance",
    { population, context },
    logger
  );

  if (!result || typeof result !== "object") return null;
  const typed = result as Record<string, unknown>;
  if (typed.error) return null;

  return typed;
}

/**
 * Fetch cultural remedy/drug interaction data.
 */
export async function fetchDrugInteractionCultural(
  population: string,
  medications: string[],
  logger: MCPLogger
): Promise<Record<string, unknown> | null> {
  const result = await callCulturalMCP(
    "check_drug_interaction_cultural",
    { population, medications },
    logger
  );

  if (!result || typeof result !== "object") return null;
  const typed = result as Record<string, unknown>;
  if (typed.error) return null;

  return typed;
}

// =====================================================
// Prompt Formatting Helpers
// =====================================================

/**
 * Format cultural context as a prompt section for AI consumption.
 * Designed to be injected into any AI skill's prompt.
 */
export function formatCulturalContextForPrompt(
  ctx: CulturalContextResponse,
  clinicalContext?: "medication" | "diagnosis" | "care_plan" | "discharge"
): string {
  const lines: string[] = [];

  lines.push(`\nCULTURAL COMPETENCY CONTEXT (${ctx.displayName}):`);
  lines.push(`IMPORTANT CAVEAT: ${ctx.caveat}`);

  // Communication
  lines.push(`\nCommunication Style:`);
  lines.push(`- Formality: ${ctx.communication.formalityLevel}`);
  lines.push(`- Family involvement: ${ctx.communication.familyInvolvementNorm}`);
  if (ctx.communication.keyPhrases.length > 0) {
    lines.push(`- Recommended phrases: ${ctx.communication.keyPhrases.join("; ")}`);
  }
  if (ctx.communication.avoidPhrases.length > 0) {
    lines.push(`- AVOID these phrases: ${ctx.communication.avoidPhrases.join("; ")}`);
  }

  // Context-specific guidance
  if (clinicalContext && ctx.communication.contextSpecificGuidance) {
    lines.push(`- ${clinicalContext} guidance: ${ctx.communication.contextSpecificGuidance}`);
  }

  // Clinical considerations (top 3)
  if (ctx.clinicalConsiderations.length > 0) {
    lines.push(`\nPopulation-Specific Clinical Considerations:`);
    ctx.clinicalConsiderations.slice(0, 3).forEach((cc) => {
      lines.push(`- ${cc.condition}: ${cc.clinicalNote} (Screen: ${cc.screeningRecommendation})`);
    });
  }

  // Barriers
  if (ctx.barriers.length > 0) {
    lines.push(`\nBarriers to Care:`);
    ctx.barriers.slice(0, 3).forEach((b) => {
      lines.push(`- ${b.barrier}: ${b.mitigation}`);
    });
  }

  // Trust factors
  if (ctx.trustFactors.length > 0) {
    lines.push(`\nTrust Building:`);
    ctx.trustFactors.slice(0, 2).forEach((tf) => {
      lines.push(`- ${tf.factor}: ${tf.trustBuildingStrategy}`);
    });
  }

  // Cultural remedies (always include — drug interaction awareness)
  if (ctx.culturalRemedies.length > 0) {
    lines.push(`\nCultural Remedies to Ask About:`);
    ctx.culturalRemedies.forEach((r) => {
      const level = r.warningLevel === "warning" ? "⚠ WARNING" : r.warningLevel === "caution" ? "CAUTION" : "INFO";
      lines.push(`- ${r.remedy} [${level}]: ${r.commonUse}. Interactions: ${r.potentialInteractions.join("; ")}`);
    });
  }

  // SDOH codes
  if (ctx.sdohCodes.length > 0) {
    lines.push(`\nRelevant SDOH Z-Codes:`);
    ctx.sdohCodes.forEach((s) => {
      lines.push(`- ${s.code}: ${s.description}`);
    });
  }

  return lines.join("\n");
}

/**
 * Format a compact cultural summary for space-constrained prompts.
 */
export function formatCulturalContextCompact(
  ctx: CulturalContextResponse
): string {
  const lines: string[] = [];

  lines.push(`\nCULTURAL CONTEXT (${ctx.displayName}): ${ctx.caveat}`);
  lines.push(`Communication: ${ctx.communication.formalityLevel} formality. ${ctx.communication.familyInvolvementNorm}`);

  if (ctx.barriers.length > 0) {
    lines.push(`Key barriers: ${ctx.barriers.map((b) => b.barrier).join(", ")}`);
  }

  if (ctx.culturalRemedies.filter((r) => r.warningLevel === "warning").length > 0) {
    const warnings = ctx.culturalRemedies.filter((r) => r.warningLevel === "warning");
    lines.push(`Cultural remedy warnings: ${warnings.map((r) => `${r.remedy} (${r.potentialInteractions[0]})`).join("; ")}`);
  }

  return lines.join("\n");
}
