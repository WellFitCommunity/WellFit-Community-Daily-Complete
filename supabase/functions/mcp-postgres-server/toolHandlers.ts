// =====================================================
// MCP PostgreSQL Server — Tool Handlers
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WHITELISTED_QUERIES, SAFE_TABLES } from "./queryWhitelist.ts";
import { handlePing } from "../_shared/mcpServerBase.ts";
import { withTimeout, MCP_TIMEOUT_CONFIG } from "../_shared/mcpQueryTimeout.ts";
import { logMCPAudit } from "../_shared/mcpAudit.ts";

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  debug(event: string, data?: Record<string, unknown>): void;
}

// =====================================================
// Tool Handler Factory
// =====================================================

export function createToolHandlers(sb: SupabaseClient, logger: MCPLogger) {

  async function handleToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
    userClient: SupabaseClient,
    serverConfig: { name: string; version: string; tier: string },
    initResult: unknown,
    caller: { userId?: string } | null,
    resolvedTenantId: string | undefined,
    requestId: string
  ): Promise<{ result: unknown; rowsReturned: number }> {
    let result: unknown;
    let rowsReturned = 0;

    switch (toolName) {
      case "ping": {
        result = handlePing(
          serverConfig as { name: string; version: string; tier: "external_api" | "user_scoped" | "admin" },
          initResult as { supabase: SupabaseClient | null; logger: MCPLogger; canRateLimit: boolean }
        );
        break;
      }

      case "execute_query": {
        const { query_name, parameters: extraParams } = toolArgs;

        const queryDef = WHITELISTED_QUERIES[query_name as string];
        if (!queryDef) {
          throw new Error(`Query '${query_name}' is not whitelisted`);
        }

        if (!resolvedTenantId) {
          throw new Error("Tenant ID required: could not resolve from caller identity or arguments");
        }

        const { data, error } = await withTimeout(
          sb.rpc('execute_safe_query', {
            query_text: queryDef.query,
            params: JSON.stringify([resolvedTenantId, ...(extraParams ? Object.values(extraParams as Record<string, unknown>) : [])]),
            p_caller_tenant_id: resolvedTenantId
          }),
          MCP_TIMEOUT_CONFIG.postgres.query,
          `Postgres query: ${query_name}`
        );

        if (error) {
          logger.error("Query execution failed", {
            queryName: query_name as string,
            errorCode: error.code,
            errorMessage: error.message,
            hint: error.hint,
            requestId
          });
          throw new Error(`Query '${query_name}' failed: ${error.message}`);
        }

        result = data;

        if (Array.isArray(result) && queryDef.maxRows) {
          result = result.slice(0, queryDef.maxRows);
        }

        rowsReturned = Array.isArray(result) ? result.length : 1;
        break;
      }

      case "list_queries": {
        const queries = Object.entries(WHITELISTED_QUERIES).map(([name, def]) => ({
          name,
          description: def.description,
          parameters: def.parameters,
          maxRows: def.maxRows
        }));
        result = queries;
        rowsReturned = queries.length;
        break;
      }

      case "get_table_schema": {
        const { table_name } = toolArgs;

        if (!SAFE_TABLES.has(table_name as string)) {
          throw new Error(`Table '${table_name}' schema is not accessible`);
        }

        const { data, error } = await withTimeout(
          userClient.rpc('get_table_columns', {
            p_table_name: table_name as string
          }),
          MCP_TIMEOUT_CONFIG.postgres.schema,
          `Schema lookup: ${table_name}`
        );

        if (error) {
          const { data: schemaData, error: schemaError } = await userClient
            .from('information_schema.columns')
            .select('column_name, data_type, is_nullable, column_default')
            .eq('table_name', table_name as string)
            .limit(100);

          if (schemaError) {
            throw new Error(`Schema lookup failed: ${schemaError.message}`);
          }
          result = schemaData;
        } else {
          result = data;
        }

        rowsReturned = Array.isArray(result) ? result.length : 0;
        break;
      }

      case "get_row_count": {
        const { table_name } = toolArgs;

        if (!SAFE_TABLES.has(table_name as string)) {
          throw new Error(`Table '${table_name}' is not accessible`);
        }

        let query = userClient.from(table_name as string).select('*', { count: 'exact', head: true });

        if (resolvedTenantId) {
          query = query.eq('tenant_id', resolvedTenantId);
        }

        const { count, error } = await withTimeout(
          query,
          MCP_TIMEOUT_CONFIG.postgres.count,
          `Row count: ${table_name}`
        );

        if (error) {
          throw new Error(`Count failed: ${error.message}`);
        }

        result = { table: table_name, count: count || 0 };
        rowsReturned = 1;
        break;
      }

      default:
        throw new Error(`Tool ${toolName} not implemented`);
    }

    // Audit log via unified mcp_audit_logs (P2-4)
    await logMCPAudit(sb, logger, {
      serverName: "mcp-postgres-server",
      toolName,
      requestId,
      userId: caller?.userId,
      tenantId: resolvedTenantId,
      success: true,
      metadata: {
        query_name: toolArgs.query_name,
        rows_returned: rowsReturned
      }
    });

    return { result, rowsReturned };
  }

  return { handleToolCall };
}
