/**
 * AI Usage Logging
 *
 * Logs Claude API usage to the claude_usage_logs table for
 * cost tracking and billing purposes.
 *
 * @module ai-clinical-guideline-matcher/usageLogging
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EdgeFunctionLogger } from "../_shared/auditLogger.ts";

/** Model identifier for cost calculation */
const SONNET_MODEL = "claude-sonnet-4-20250514";

/**
 * Logs estimated AI usage to the claude_usage_logs table.
 * Uses estimated token counts based on typical prompt/response sizes.
 * Failures are logged but do not propagate to the caller.
 */
export async function logUsage(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  tenantId: string | undefined,
  guidelinesMatched: number,
  responseTimeMs: number,
  logger: EdgeFunctionLogger
): Promise<void> {
  try {
    const estimatedInputTokens = 2000;
    const estimatedOutputTokens = 1500;
    const cost =
      (estimatedInputTokens / 1_000_000) * 3 +
      (estimatedOutputTokens / 1_000_000) * 15;

    await supabase.from("claude_usage_logs").insert({
      user_id: patientId,
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: "clinical_guideline_matcher",
      input_tokens: estimatedInputTokens,
      output_tokens: estimatedOutputTokens,
      cost: cost,
      response_time_ms: responseTimeMs,
      success: true,
      metadata: { guidelinesMatched },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to log usage", { error: error.message });
  }
}
