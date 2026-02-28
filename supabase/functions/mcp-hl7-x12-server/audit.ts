// =====================================================
// Audit Logging for HL7/X12 Transformations
// Purpose: Log transformation operations via unified mcp_audit_logs (P2-4)
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EdgeFunctionLogger } from "../_shared/auditLogger.ts";
import { logMCPAudit } from "../_shared/mcpAudit.ts";

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
 * Log a transformation operation to the unified mcp_audit_logs table.
 * HL7/X12-specific fields are stored in the metadata JSONB column.
 */
export async function logTransformation(
  sb: SupabaseClient,
  logger: EdgeFunctionLogger,
  params: TransformationLogParams
): Promise<void> {
  await logMCPAudit(sb, logger, {
    serverName: "mcp-hl7-x12-server",
    toolName: params.operation,
    userId: params.userId,
    executionTimeMs: params.executionTimeMs,
    success: params.success,
    errorMessage: params.errorMessage,
    metadata: {
      input_format: params.inputFormat,
      output_format: params.outputFormat
    }
  });
}
