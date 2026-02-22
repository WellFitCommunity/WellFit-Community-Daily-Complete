/**
 * AI usage logging for discharge summary generation
 *
 * Logs estimated token usage and costs to the claude_usage_logs table
 * for billing and cost tracking purposes.
 *
 * @module ai-discharge-summary/usageLogging
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";

const SONNET_MODEL = "claude-sonnet-4-20250514";

/** Estimated token counts for discharge summary requests */
const ESTIMATED_INPUT_TOKENS = 3000;
const ESTIMATED_OUTPUT_TOKENS = 2500;

/** Cost per million tokens (Sonnet pricing) */
const INPUT_COST_PER_MILLION = 3;
const OUTPUT_COST_PER_MILLION = 15;

/**
 * Log AI usage metrics (tokens, cost, response time) to the database.
 *
 * Non-critical -- failures are logged as warnings but do not
 * propagate to the caller.
 */
export async function logUsage(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  tenantId: string | undefined,
  encounterId: string,
  responseTimeMs: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    const cost =
      (ESTIMATED_INPUT_TOKENS / 1_000_000) * INPUT_COST_PER_MILLION +
      (ESTIMATED_OUTPUT_TOKENS / 1_000_000) * OUTPUT_COST_PER_MILLION;

    await supabase.from("claude_usage_logs").insert({
      user_id: patientId,
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: "discharge_summary",
      input_tokens: ESTIMATED_INPUT_TOKENS,
      output_tokens: ESTIMATED_OUTPUT_TOKENS,
      cost: cost,
      response_time_ms: responseTimeMs,
      success: true,
      metadata: { encounter_id: encounterId },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to log usage", { error: error.message });
  }
}
