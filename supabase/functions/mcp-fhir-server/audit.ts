// =====================================================
// MCP FHIR Server - Audit Logging
// Purpose: FHIR operation audit trail with fallback to claude_usage_logs
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EdgeFunctionLogger } from "../_shared/auditLogger.ts";
import type { FHIRAuditParams } from "./types.ts";

/**
 * Logs a FHIR operation to the mcp_fhir_logs table.
 * Falls back to claude_usage_logs if the primary table fails.
 *
 * @param sb - The Supabase client (service role)
 * @param logger - The edge function logger instance
 * @param params - Audit parameters for the FHIR operation
 */
export async function logFHIROperation(
  sb: SupabaseClient,
  logger: EdgeFunctionLogger,
  params: FHIRAuditParams
): Promise<void> {
  try {
    await sb.from("mcp_fhir_logs").insert({
      user_id: params.userId,
      tenant_id: params.tenantId,
      operation: params.operation,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      success: params.success,
      execution_time_ms: params.executionTimeMs,
      error_message: params.errorMessage,
      created_at: new Date().toISOString()
    });
  } catch (err: unknown) {
    // Fallback to claude_usage_logs
    try {
      await sb.from("claude_usage_logs").insert({
        user_id: params.userId,
        request_id: crypto.randomUUID(),
        request_type: `mcp_fhir_${params.operation}`,
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
