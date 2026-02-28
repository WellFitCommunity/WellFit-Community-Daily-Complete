/**
 * Unified MCP Audit Logger (P2-4)
 *
 * Single audit logging module for all MCP servers, writing to `mcp_audit_logs`.
 * Falls back to `claude_usage_logs` if the unified table is unavailable.
 *
 * Usage:
 * ```typescript
 * import { logMCPAudit } from "../_shared/mcpAudit.ts";
 *
 * await logMCPAudit(sb, logger, {
 *   serverName: "mcp-fhir-server",
 *   toolName: "get_resource",
 *   requestId: "req-123",
 *   userId: caller.userId,
 *   tenantId: caller.tenantId,
 *   authMethod: "jwt",
 *   executionTimeMs: 45,
 *   success: true,
 *   metadata: { resource_type: "Patient", resource_id: "abc" }
 * });
 * ```
 *
 * @module mcpAudit
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Minimal logger interface matching all MCP server logger types */
interface MCPAuditLogger {
  error(event: string, data?: Record<string, unknown>): void;
}

/** Parameters for logging an MCP server operation */
export interface MCPAuditParams {
  serverName: string;
  toolName: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  authMethod?: string;
  executionTimeMs?: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs an MCP server operation to the unified `mcp_audit_logs` table.
 * Falls back to `claude_usage_logs` if the unified table is unavailable
 * (e.g., migration not yet applied).
 *
 * This function never throws — audit logging failures are swallowed
 * to prevent MCP tool calls from failing due to logging issues.
 */
export async function logMCPAudit(
  sb: SupabaseClient,
  logger: MCPAuditLogger,
  params: MCPAuditParams
): Promise<void> {
  const requestId = params.requestId || crypto.randomUUID();

  try {
    await sb.from("mcp_audit_logs").insert({
      server_name: params.serverName,
      tool_name: params.toolName,
      request_id: requestId,
      user_id: params.userId,
      tenant_id: params.tenantId,
      auth_method: params.authMethod,
      execution_time_ms: params.executionTimeMs,
      success: params.success,
      error_message: params.errorMessage,
      metadata: params.metadata || {},
      created_at: new Date().toISOString()
    });
  } catch (err: unknown) {
    // Fallback to claude_usage_logs (guaranteed to exist)
    try {
      await sb.from("claude_usage_logs").insert({
        user_id: params.userId,
        request_id: requestId,
        request_type: `${params.serverName}:${params.toolName}`,
        response_time_ms: params.executionTimeMs,
        success: params.success,
        error_message: params.errorMessage,
        created_at: new Date().toISOString()
      });
    } catch (innerErr: unknown) {
      logger.error("MCP_AUDIT_LOG_FAILED", {
        serverName: params.serverName,
        toolName: params.toolName,
        originalError: err instanceof Error ? err.message : String(err),
        fallbackError: innerErr instanceof Error ? innerErr.message : String(innerErr)
      });
    }
  }
}

/**
 * Creates a server-scoped audit function that pre-fills `serverName`.
 * Reduces boilerplate in each server's tool handlers.
 *
 * Usage:
 * ```typescript
 * const audit = createServerAudit(sb, logger, "mcp-fhir-server");
 * await audit({ toolName: "get_resource", success: true, executionTimeMs: 45 });
 * ```
 */
export function createServerAudit(
  sb: SupabaseClient,
  logger: MCPAuditLogger,
  serverName: string
) {
  return (params: Omit<MCPAuditParams, "serverName">) =>
    logMCPAudit(sb, logger, { ...params, serverName });
}
