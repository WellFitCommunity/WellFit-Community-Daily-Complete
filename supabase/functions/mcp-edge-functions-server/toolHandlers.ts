// =====================================================
// MCP Edge Functions Server — Tool Handlers
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ALLOWED_FUNCTIONS, BLOCKED_FUNCTIONS } from "./functionWhitelist.ts";
import { handlePing } from "../_shared/mcpServerBase.ts";

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  debug(event: string, data?: Record<string, unknown>): void;
  security(event: string, data?: Record<string, unknown>): void;
}

// =====================================================
// Audit Logging
// =====================================================

async function logFunctionInvocation(
  sb: SupabaseClient,
  logger: MCPLogger,
  params: {
    userId?: string;
    tenantId?: string;
    functionName: string;
    success: boolean;
    executionTimeMs: number;
    errorMessage?: string;
    payloadSize?: number;
  }
) {
  try {
    await sb.from("mcp_function_logs").insert({
      user_id: params.userId,
      tenant_id: params.tenantId,
      function_name: params.functionName,
      success: params.success,
      execution_time_ms: params.executionTimeMs,
      error_message: params.errorMessage,
      payload_size: params.payloadSize,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    // Fallback to claude_usage_logs
    try {
      await sb.from("claude_usage_logs").insert({
        user_id: params.userId,
        request_id: crypto.randomUUID(),
        request_type: `mcp_edge_fn_${params.functionName}`,
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

// =====================================================
// Function Invocation
// =====================================================

async function invokeFunction(
  supabaseUrl: string,
  serviceKey: string,
  functionName: string,
  payload: Record<string, unknown>,
  authToken?: string,
  timeout = 30000
): Promise<{ success: boolean; data?: unknown; error?: string; executionTimeMs: number }> {
  const startTime = Date.now();

  try {
    if (BLOCKED_FUNCTIONS.has(functionName)) {
      throw new Error(`Function '${functionName}' is blocked for security reasons`);
    }

    const funcDef = ALLOWED_FUNCTIONS[functionName];
    if (!funcDef) {
      throw new Error(`Function '${functionName}' is not whitelisted`);
    }

    // Validate required parameters
    if (funcDef.parameters) {
      for (const [param, def] of Object.entries(funcDef.parameters)) {
        if (def.required && !(param in payload)) {
          throw new Error(`Missing required parameter: ${param}`);
        }
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (funcDef.requiresAuth && authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    } else if (funcDef.requiresAuth) {
      headers['Authorization'] = `Bearer ${serviceKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const executionTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Function returned ${response.status}: ${errorText}`,
        executionTimeMs
      };
    }

    const data = await response.json();
    return { success: true, data, executionTimeMs };

  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs
    };
  }
}

// =====================================================
// Tool Handler Factory
// =====================================================

export function createToolHandlers(
  sb: SupabaseClient,
  logger: MCPLogger,
  supabaseUrl: string,
  serviceKey: string
) {
  async function handleToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
    serverConfig: { name: string; version: string; tier: string },
    initResult: unknown,
    caller: { userId: string; role: string },
    resolvedTenant: string | undefined,
    authToken: string | undefined
  ): Promise<unknown> {

    switch (toolName) {
      case "ping": {
        return handlePing(
          serverConfig as { name: string; version: string; tier: "external_api" | "user_scoped" | "admin" },
          initResult as { supabase: SupabaseClient | null; logger: MCPLogger; canRateLimit: boolean }
        );
      }

      case "invoke_function": {
        const { function_name, timeout } = toolArgs;
        const payload = { ...(toolArgs.payload as Record<string, unknown> || {}) };
        if (resolvedTenant) {
          payload.tenant_id = resolvedTenant;
        }

        const invocationResult = await invokeFunction(
          supabaseUrl,
          serviceKey,
          function_name as string,
          payload,
          authToken,
          timeout as number | undefined
        );

        await logFunctionInvocation(sb, logger, {
          userId: caller.userId,
          tenantId: resolvedTenant,
          functionName: function_name as string,
          success: invocationResult.success,
          executionTimeMs: invocationResult.executionTimeMs,
          errorMessage: invocationResult.error,
          payloadSize: JSON.stringify(payload).length
        });

        return invocationResult;
      }

      case "list_functions": {
        const { category } = toolArgs;
        let functions = Object.values(ALLOWED_FUNCTIONS);

        if (category) {
          functions = functions.filter(f => f.category === category);
        }

        return { functions, total: functions.length };
      }

      case "get_function_info": {
        const { function_name } = toolArgs;
        const funcDef = ALLOWED_FUNCTIONS[function_name as string];
        if (!funcDef) {
          throw new Error(`Function '${function_name}' not found`);
        }
        return funcDef;
      }

      case "batch_invoke": {
        const { invocations, stop_on_error = true } = toolArgs;

        const results: Array<{
          function_name: string;
          success: boolean;
          data?: unknown;
          error?: string;
          executionTimeMs: number;
        }> = [];

        for (const invocation of invocations as Array<{ function_name: string; payload?: Record<string, unknown> }>) {
          const { function_name } = invocation;
          const batchPayload = { ...(invocation.payload || {}) };
          if (resolvedTenant) {
            batchPayload.tenant_id = resolvedTenant;
          }

          const invocationResult = await invokeFunction(
            supabaseUrl,
            serviceKey,
            function_name,
            batchPayload,
            authToken
          );

          results.push({ function_name, ...invocationResult });

          await logFunctionInvocation(sb, logger, {
            userId: caller.userId,
            tenantId: resolvedTenant,
            functionName: function_name,
            success: invocationResult.success,
            executionTimeMs: invocationResult.executionTimeMs,
            errorMessage: invocationResult.error,
            payloadSize: JSON.stringify(batchPayload).length
          });

          if (!invocationResult.success && stop_on_error) {
            break;
          }
        }

        return {
          results,
          completed: results.length,
          total: (invocations as unknown[]).length,
          allSucceeded: results.every(r => r.success)
        };
      }

      default:
        throw new Error(`Tool ${toolName} not implemented`);
    }
  }

  return { handleToolCall };
}
