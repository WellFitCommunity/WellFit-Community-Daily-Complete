/**
 * AI Usage Logging for Care Plan Generator
 *
 * Logs estimated token usage and cost to claude_usage_logs
 * for billing and cost tracking purposes.
 *
 * @module ai-care-plan-generator/usageLogging
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";
import { SONNET_MODEL } from "../_shared/models.ts";

/**
 * Log AI usage for cost tracking.
 *
 * Records estimated input/output tokens and computed cost
 * to the claude_usage_logs table for billing analytics.
 */
export async function logUsage(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  tenantId: string | undefined,
  planType: string,
  responseTimeMs: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    const estimatedInputTokens = 2000;
    const estimatedOutputTokens = 2500;
    const cost =
      (estimatedInputTokens / 1_000_000) * 3 +
      (estimatedOutputTokens / 1_000_000) * 15;

    await supabase.from("claude_usage_logs").insert({
      user_id: patientId,
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: `care_plan_${planType}`,
      input_tokens: estimatedInputTokens,
      output_tokens: estimatedOutputTokens,
      cost: cost,
      response_time_ms: responseTimeMs,
      success: true,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to log usage", { error: error.message });
  }
}
