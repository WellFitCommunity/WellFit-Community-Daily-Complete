// =====================================================
// Audit Logging for HL7/X12 Transformations
// Purpose: Log all transformation operations for compliance
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EdgeFunctionLogger } from "../_shared/auditLogger.ts";

/** Parameters for logging a transformation operation */
export interface TransformationLogParams {
  userId?: string;
  operation: string;
  inputFormat: string;
  outputFormat: string;
  success: boolean;
  executionTimeMs: number;
  errorMessage?: string;
}

/**
 * Log a transformation operation to the audit trail.
 * Falls back to claude_usage_logs if mcp_transformation_logs is unavailable.
 */
export async function logTransformation(
  sb: SupabaseClient,
  logger: EdgeFunctionLogger,
  params: TransformationLogParams
): Promise<void> {
  try {
    await sb.from("mcp_transformation_logs").insert({
      user_id: params.userId,
      operation: params.operation,
      input_format: params.inputFormat,
      output_format: params.outputFormat,
      success: params.success,
      execution_time_ms: params.executionTimeMs,
      error_message: params.errorMessage,
      created_at: new Date().toISOString()
    });
  } catch (err: unknown) {
    try {
      await sb.from("claude_usage_logs").insert({
        user_id: params.userId,
        request_id: crypto.randomUUID(),
        request_type: `mcp_hl7x12_${params.operation}`,
        response_time_ms: params.executionTimeMs,
        success: params.success,
        error_message: params.errorMessage,
        created_at: new Date().toISOString()
      });
    } catch (innerErr: unknown) {
      logger.error("Audit log fallback failed", {
        originalError: err instanceof Error ? err.message : String(err),
        fallbackError: innerErr instanceof Error ? innerErr.message : String(innerErr)
      });
    }
  }
}
