// =====================================================
// MCP PostgreSQL Server — Tool Definitions
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";
import { WHITELISTED_QUERIES } from "./queryWhitelist.ts";

export const TOOLS: Record<string, { description: string; inputSchema: { type: string; properties: Record<string, unknown>; required: string[] } }> = {
  "execute_query": {
    description: "Execute a pre-approved query against the database",
    inputSchema: {
      type: "object",
      properties: {
        query_name: {
          type: "string",
          description: "Name of the whitelisted query to execute",
          enum: Object.keys(WHITELISTED_QUERIES)
        },
        tenant_id: { type: "string", description: "Tenant ID (resolved from caller identity; optional override for backward compat)" },
        parameters: {
          type: "object",
          description: "Additional query parameters",
          additionalProperties: true
        }
      },
      required: ["query_name"]
    }
  },
  "list_queries": {
    description: "List all available pre-approved queries",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  "get_table_schema": {
    description: "Get schema information for a table",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to describe"
        }
      },
      required: ["table_name"]
    }
  },
  "get_row_count": {
    description: "Get row count for a table with optional tenant filter",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Table name" },
        tenant_id: { type: "string", description: "Optional tenant ID filter" }
      },
      required: ["table_name"]
    }
  },
  "ping": PING_TOOL
};
