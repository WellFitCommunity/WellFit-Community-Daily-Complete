// =====================================================
// MCP Edge Functions Server
// Purpose: Orchestrate and monitor Supabase Edge Functions via MCP
// Features: Function discovery, invocation, status tracking, audit logging
// =====================================================

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("mcp-edge-functions-server");

// Environment
const SERVICE_KEY = SB_SECRET_KEY;
const ANON_KEY = SB_PUBLISHABLE_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase credentials");

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// =====================================================
// SECURITY: Function Whitelist
// Only allow specific, safe functions to be invoked
// =====================================================

interface FunctionDefinition {
  name: string;
  description: string;
  category: 'analytics' | 'reports' | 'workflow' | 'integration' | 'utility';
  requiresAuth: boolean;
  parameters?: Record<string, { type: string; description: string; required?: boolean }>;
  sideEffects: 'none' | 'read' | 'write';
}

const ALLOWED_FUNCTIONS: Record<string, FunctionDefinition> = {
  // Analytics functions (read-only)
  "get-welfare-priorities": {
    name: "get-welfare-priorities",
    description: "Get prioritized welfare check list based on weather and risk factors",
    category: "analytics",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      tenant_id: { type: "string", description: "Tenant ID", required: true },
      limit: { type: "number", description: "Max results" }
    }
  },
  "calculate-readmission-risk": {
    name: "calculate-readmission-risk",
    description: "Calculate readmission risk for a patient",
    category: "analytics",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      patient_id: { type: "string", description: "Patient ID", required: true }
    }
  },
  "sdoh-passive-detect": {
    name: "sdoh-passive-detect",
    description: "Run SDOH passive detection for a tenant",
    category: "analytics",
    requiresAuth: true,
    sideEffects: "write",
    parameters: {
      tenant_id: { type: "string", description: "Tenant ID", required: true }
    }
  },
  // Report generation functions
  "generate-engagement-report": {
    name: "generate-engagement-report",
    description: "Generate patient engagement report",
    category: "reports",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      patient_id: { type: "string", description: "Patient ID", required: true },
      start_date: { type: "string", description: "Report start date" },
      end_date: { type: "string", description: "Report end date" }
    }
  },
  "generate-quality-report": {
    name: "generate-quality-report",
    description: "Generate quality measures report",
    category: "reports",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      tenant_id: { type: "string", description: "Tenant ID", required: true },
      period: { type: "string", description: "Reporting period (quarter/year)" }
    }
  },
  // Integration functions
  "enhanced-fhir-export": {
    name: "enhanced-fhir-export",
    description: "Export patient data as FHIR bundle",
    category: "integration",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      patient_id: { type: "string", description: "Patient ID", required: true },
      resources: { type: "array", description: "FHIR resource types to include" }
    }
  },
  "hl7-receive": {
    name: "hl7-receive",
    description: "Process incoming HL7 message",
    category: "integration",
    requiresAuth: true,
    sideEffects: "write",
    parameters: {
      message: { type: "string", description: "HL7 message content", required: true },
      message_type: { type: "string", description: "HL7 message type (ADT, ORM, etc.)" }
    }
  },
  "generate-837p": {
    name: "generate-837p",
    description: "Generate 837P claim file",
    category: "integration",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      claim_id: { type: "string", description: "Claim ID", required: true }
    }
  },
  // Workflow functions
  "process-shift-handoff": {
    name: "process-shift-handoff",
    description: "Process shift handoff data",
    category: "workflow",
    requiresAuth: true,
    sideEffects: "write",
    parameters: {
      shift_id: { type: "string", description: "Shift ID", required: true },
      action: { type: "string", description: "Action (create/accept/complete)" }
    }
  },
  "create-care-alert": {
    name: "create-care-alert",
    description: "Create a care coordination alert",
    category: "workflow",
    requiresAuth: true,
    sideEffects: "write",
    parameters: {
      patient_id: { type: "string", description: "Patient ID", required: true },
      alert_type: { type: "string", description: "Alert type", required: true },
      message: { type: "string", description: "Alert message", required: true }
    }
  },
  // Utility functions
  "send-sms": {
    name: "send-sms",
    description: "Send SMS notification",
    category: "utility",
    requiresAuth: true,
    sideEffects: "write",
    parameters: {
      to: { type: "string", description: "Phone number", required: true },
      message: { type: "string", description: "SMS content", required: true },
      template: { type: "string", description: "Optional template name" }
    }
  },
  "hash-pin": {
    name: "hash-pin",
    description: "Hash a caregiver PIN",
    category: "utility",
    requiresAuth: false,
    sideEffects: "none",
    parameters: {
      pin: { type: "string", description: "4-digit PIN", required: true }
    }
  },
  "verify-pin": {
    name: "verify-pin",
    description: "Verify a caregiver PIN",
    category: "utility",
    requiresAuth: false,
    sideEffects: "read",
    parameters: {
      pin: { type: "string", description: "PIN to verify", required: true },
      hash: { type: "string", description: "Stored hash", required: true }
    }
  }
};

// Functions that should NEVER be invoked via MCP (security)
const BLOCKED_FUNCTIONS = new Set([
  'register', // User registration
  'enrollClient', // Client enrollment (creates users)
  'admin-create-user', // Admin user creation
  'delete-user', // User deletion
  'service-role-query', // Direct service role queries
]);

// =====================================================
// MCP Tools Definition
// =====================================================

const TOOLS = {
  "invoke_function": {
    description: "Invoke a whitelisted Supabase Edge Function",
    inputSchema: {
      type: "object",
      properties: {
        function_name: {
          type: "string",
          description: "Name of the function to invoke",
          enum: Object.keys(ALLOWED_FUNCTIONS)
        },
        payload: {
          type: "object",
          description: "Function payload/parameters",
          additionalProperties: true
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default 30000)"
        }
      },
      required: ["function_name"]
    }
  },
  "list_functions": {
    description: "List all available Edge Functions with their descriptions",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category",
          enum: ["analytics", "reports", "workflow", "integration", "utility"]
        }
      },
      required: []
    }
  },
  "get_function_info": {
    description: "Get detailed information about a specific function",
    inputSchema: {
      type: "object",
      properties: {
        function_name: {
          type: "string",
          description: "Function name"
        }
      },
      required: ["function_name"]
    }
  },
  "batch_invoke": {
    description: "Invoke multiple functions in sequence",
    inputSchema: {
      type: "object",
      properties: {
        invocations: {
          type: "array",
          description: "Array of function invocations",
          items: {
            type: "object",
            properties: {
              function_name: { type: "string" },
              payload: { type: "object" }
            }
          }
        },
        stop_on_error: {
          type: "boolean",
          description: "Stop batch on first error (default true)"
        }
      },
      required: ["invocations"]
    }
  }
};

// =====================================================
// Audit Logging
// =====================================================

async function logFunctionInvocation(params: {
  userId?: string;
  tenantId?: string;
  functionName: string;
  success: boolean;
  executionTimeMs: number;
  errorMessage?: string;
  payloadSize?: number;
}) {
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
  functionName: string,
  payload: Record<string, any>,
  authToken?: string,
  timeout = 30000
): Promise<{ success: boolean; data?: any; error?: string; executionTimeMs: number }> {
  const startTime = Date.now();

  try {
    // Security check
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

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (funcDef.requiresAuth && authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    } else if (funcDef.requiresAuth) {
      // Use service role for server-side invocation
      headers['Authorization'] = `Bearer ${SERVICE_KEY}`;
    }

    // Invoke the function
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
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

    return {
      success: true,
      data,
      executionTimeMs
    };

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
// Request Handler
// =====================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body = await req.json();
    const { method, params, id } = body;

    // Extract auth token from request
    const authHeader = req.headers.get('Authorization');
    const authToken = authHeader?.replace('Bearer ', '');

    // MCP Protocol: Initialize handshake
    if (method === "initialize") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "mcp-edge-functions-server",
            version: "1.0.0"
          },
          capabilities: {
            tools: {}
          }
        },
        id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: List tools
    if (method === "tools/list") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          tools: Object.entries(TOOLS).map(([name, def]) => ({ name, ...def }))
        },
        id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: Call tool
    if (method === "tools/call") {
      const { name: toolName, arguments: toolArgs } = params;

      if (!TOOLS[toolName as keyof typeof TOOLS]) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      let result: any;

      switch (toolName) {
        case "invoke_function": {
          const { function_name, payload = {}, timeout } = toolArgs;

          const invocationResult = await invokeFunction(
            function_name,
            payload,
            authToken,
            timeout
          );

          // Audit log
          await logFunctionInvocation({
            userId: toolArgs.userId,
            tenantId: payload.tenant_id,
            functionName: function_name,
            success: invocationResult.success,
            executionTimeMs: invocationResult.executionTimeMs,
            errorMessage: invocationResult.error,
            payloadSize: JSON.stringify(payload).length
          });

          result = invocationResult;
          break;
        }

        case "list_functions": {
          const { category } = toolArgs;

          let functions = Object.entries(ALLOWED_FUNCTIONS).map(([name, def]) => ({
            name,
            ...def
          }));

          if (category) {
            functions = functions.filter(f => f.category === category);
          }

          result = { functions, total: functions.length };
          break;
        }

        case "get_function_info": {
          const { function_name } = toolArgs;

          const funcDef = ALLOWED_FUNCTIONS[function_name];
          if (!funcDef) {
            throw new Error(`Function '${function_name}' not found`);
          }

          result = { name: function_name, ...funcDef };
          break;
        }

        case "batch_invoke": {
          const { invocations, stop_on_error = true } = toolArgs;

          const results: Array<{
            function_name: string;
            success: boolean;
            data?: any;
            error?: string;
            executionTimeMs: number;
          }> = [];

          for (const invocation of invocations) {
            const { function_name, payload = {} } = invocation;

            const invocationResult = await invokeFunction(
              function_name,
              payload,
              authToken
            );

            results.push({
              function_name,
              ...invocationResult
            });

            // Audit log each invocation
            await logFunctionInvocation({
              userId: toolArgs.userId,
              tenantId: payload.tenant_id,
              functionName: function_name,
              success: invocationResult.success,
              executionTimeMs: invocationResult.executionTimeMs,
              errorMessage: invocationResult.error,
              payloadSize: JSON.stringify(payload).length
            });

            if (!invocationResult.success && stop_on_error) {
              break;
            }
          }

          result = {
            results,
            completed: results.length,
            total: invocations.length,
            allSucceeded: results.every(r => r.success)
          };
          break;
        }

        default:
          throw new Error(`Tool ${toolName} not implemented`);
      }

      return new Response(JSON.stringify({
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        metadata: {
          tool: toolName
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error(`Unknown MCP method: ${method}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({
      error: {
        code: "internal_error",
        message: errorMessage
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
