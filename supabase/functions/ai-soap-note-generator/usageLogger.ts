/**
 * AI SOAP Note Usage Logger
 *
 * Logs usage for cost tracking in claude_usage_logs table.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";
import { SONNET_MODEL } from "../_shared/models.ts";

/**
 * Log usage for cost tracking
 */
export async function logUsage(
  supabase: SupabaseClient,
  encounterId: string,
  tenantId: string | undefined,
  responseTimeMs: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    // Estimate tokens (Sonnet is more expensive)
    const estimatedInputTokens = 1500;
    const estimatedOutputTokens = 2000;

    // Sonnet pricing: $3/1M input, $15/1M output
    const cost =
      (estimatedInputTokens / 1_000_000) * 3 + (estimatedOutputTokens / 1_000_000) * 15;

    await supabase.from("claude_usage_logs").insert({
      user_id: encounterId, // Using encounterId as reference
      tenant_id: tenantId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: "soap_note_generation",
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
