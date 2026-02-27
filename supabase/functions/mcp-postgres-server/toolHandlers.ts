// =====================================================
// MCP PostgreSQL Server — Tool Handlers
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WHITELISTED_QUERIES, SAFE_TABLES } from "./queryWhitelist.ts";
import { handlePing } from "../_shared/mcpServerBase.ts";

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  debug(event: string, data?: Record<string, unknown>): void;
}

// =====================================================
// Audit Logging
// =====================================================

async function logMCPRequest(
  sb: SupabaseClient,
  logger: MCPLogger,
  params: {
    userId?: string;
    tenantId?: string;
    tool: string;
    queryName?: string;
    rowsReturned: number;
    executionTimeMs: number;
    success: boolean;
    errorMessage?: string;
    requestId?: string;
  }
) {
  try {
    await sb.from("mcp_query_logs").insert({
      user_id: params.userId,
      tenant_id: params.tenantId,
      tool_name: params.tool,
      query_name: params.queryName,
      rows_returned: params.rowsReturned,
      execution_time_ms: params.executionTimeMs,
      success: params.success,
      error_message: params.errorMessage,
      request_id: params.requestId,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    // Fallback to claude_usage_logs if mcp_query_logs doesn't exist
    try {
      await sb.from("claude_usage_logs").insert({
        user_id: params.userId,
        request_id: params.requestId || crypto.randomUUID(),
        request_type: `mcp_postgres_${params.tool}`,
        response_time_ms: params.executionTimeMs,
        success: params.success,
        error_message: params.errorMessage,
        created_at: new Date().toISOString()
      });
    } catch (innerErr: unknown) {
      logger.error("Audit log fallback failed", {
        originalError: err instanceof Error ? err.message : String(err),
        fallbackError: innerErr instanceof Error ? innerErr.message : String(innerErr),
        requestId: params.requestId
      });
    }
  }
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

        const { data, error } = await sb.rpc('execute_safe_query', {
          query_text: queryDef.query,
          params: JSON.stringify([resolvedTenantId, ...(extraParams ? Object.values(extraParams as Record<string, unknown>) : [])]),
          p_caller_tenant_id: resolvedTenantId
        });

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

        const { data, error } = await userClient.rpc('get_table_columns', {
          p_table_name: table_name as string
        });

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

        const { count, error } = await query;

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

    // Audit log
    const startTime = Date.now();
    await logMCPRequest(sb, logger, {
      userId: caller?.userId,
      tenantId: resolvedTenantId,
      tool: toolName,
      queryName: toolArgs.query_name as string | undefined,
      rowsReturned,
      executionTimeMs: Date.now() - startTime,
      success: true,
      requestId
    });

    return { result, rowsReturned };
  }

  return { handleToolCall };
}
