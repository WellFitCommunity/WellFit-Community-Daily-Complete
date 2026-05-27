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
      // M-3: Triple-failure path. Both primary (mcp_audit_logs) and fallback
      // (claude_usage_logs) inserts failed. For HIPAA-critical PHI access
      // logging, we MUST NOT silently swallow this — escalate to:
      //   (1) the function log (preserved below, surfaces in Supabase logs)
      //   (2) security_alerts table (Guardian Agent picks this up and emails
      //       the SOC team — the canonical alerting backbone in this codebase)
      //   (3) best-effort write to /tmp/mcp_audit_critical.log (ephemeral in
      //       edge-fn worker, useful only for cold-start debugging)
      const originalError = err instanceof Error ? err.message : String(err);
      const fallbackError = innerErr instanceof Error ? innerErr.message : String(innerErr);

      logger.error("MCP_AUDIT_LOG_FAILED", {
        serverName: params.serverName,
        toolName: params.toolName,
        originalError,
        fallbackError
      });

      // Tier 3a — security_alerts (best-effort; if THIS fails too, the
      // logger.error above is our last line of defense).
      try {
        await sb.from("security_alerts").insert({
          alert_type: "audit_log_double_failure",
          severity: "critical",
          status: "open",
          title: `MCP audit double-failure: ${params.serverName}:${params.toolName}`,
          description:
            `Both mcp_audit_logs and claude_usage_logs inserts failed for an MCP tool call. ` +
            `HIPAA audit trail compromised for this call. Investigate immediately.`,
          affected_user_id: params.userId ?? null,
          affected_resource: `${params.serverName}:${params.toolName}`,
          detection_method: "mcp_audit_fallback_chain",
          metadata: {
            request_id: requestId,
            tenant_id: params.tenantId ?? null,
            success: params.success,
            audit_event_message: params.errorMessage ?? null,
            original_error: originalError,
            fallback_error: fallbackError,
            audit_metadata: params.metadata ?? {}
          },
          created_at: new Date().toISOString()
        });
      } catch (alertErr: unknown) {
        // Final sink: function log + ephemeral /tmp file. Both inserts and the
        // security_alerts insert failed — DB is likely unreachable. Surface
        // loud and move on.
        logger.error("MCP_AUDIT_ALERT_INSERT_FAILED", {
          serverName: params.serverName,
          toolName: params.toolName,
          alertError: alertErr instanceof Error ? alertErr.message : String(alertErr)
        });
      }

      // Tier 3b — ephemeral /tmp log (edge-fn worker scope). Survives only
      // until the worker is recycled. Useful when diagnosing a misconfigured
      // worker before logs land in Supabase. Best-effort; failure ignored.
      try {
        const line =
          JSON.stringify({
            ts: new Date().toISOString(),
            event: "MCP_AUDIT_DOUBLE_FAILURE",
            serverName: params.serverName,
            toolName: params.toolName,
            requestId,
            originalError,
            fallbackError
          }) + "\n";
        await Deno.writeTextFile("/tmp/mcp_audit_critical.log", line, { append: true });
      } catch (_fsErr: unknown) {
        // /tmp may not be writable in all runtimes — silent on this last tier.
      }
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
