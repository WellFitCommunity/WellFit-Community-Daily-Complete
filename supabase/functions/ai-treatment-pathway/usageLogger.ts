/**
 * Claude usage/cost logging for the AI Treatment Pathway Recommender.
 *
 * @module ai-treatment-pathway/usageLogger
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { createLogger } from "../_shared/auditLogger.ts";
import { SONNET_MODEL } from "../_shared/models.ts";

export async function logUsage(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  tenantId: string | undefined,
  condition: string,
  responseTimeMs: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    const estimatedInputTokens = 2500;
    const estimatedOutputTokens = 2000;
    const cost = (estimatedInputTokens / 1_000_000) * 3 + (estimatedOutputTokens / 1_000_000) * 15;

    await supabase.from("claude_usage_logs").insert({
      user_id: patientId,
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: "treatment_pathway",
      input_tokens: estimatedInputTokens,
      output_tokens: estimatedOutputTokens,
      cost: cost,
      response_time_ms: responseTimeMs,
      success: true,
      metadata: { condition },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to log usage", { error: error.message });
  }
}
