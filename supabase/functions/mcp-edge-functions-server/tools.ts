// =====================================================
// MCP Edge Functions Server — Tool Definitions
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";
import { ALLOWED_FUNCTIONS } from "./functionWhitelist.ts";

export const TOOLS: Record<string, { description: string; inputSchema: { type: string; properties: Record<string, unknown>; required: string[] } }> = {
  "ping": PING_TOOL,
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
