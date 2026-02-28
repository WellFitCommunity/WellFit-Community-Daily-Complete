// =====================================================
// MCP FHIR Server - Audit Logging
// Purpose: FHIR operation audit trail via unified mcp_audit_logs (P2-4)
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EdgeFunctionLogger } from "../_shared/auditLogger.ts";
import type { FHIRAuditParams } from "./types.ts";
import { logMCPAudit } from "../_shared/mcpAudit.ts";

/**
 * Logs a FHIR operation to the unified mcp_audit_logs table.
 * FHIR-specific fields are stored in the metadata JSONB column.
 */
export async function logFHIROperation(
  sb: SupabaseClient,
  logger: EdgeFunctionLogger,
  params: FHIRAuditParams
): Promise<void> {
  await logMCPAudit(sb, logger, {
    serverName: "mcp-fhir-server",
    toolName: params.operation,
    userId: params.userId,
    tenantId: params.tenantId,
    executionTimeMs: params.executionTimeMs,
    success: params.success,
    errorMessage: params.errorMessage,
    metadata: {
      resource_type: params.resourceType,
      resource_id: params.resourceId
    }
  });
}
