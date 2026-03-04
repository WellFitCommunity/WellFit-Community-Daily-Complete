// =====================================================
// MCP FHIR Server - Entry Point (Thin Router)
// Purpose: Supabase serve() entry point with MCP protocol routing
// Features: Bundle export, resource CRUD, validation, EHR sync
//
// TIER 3 (admin): Requires service role key for FHIR operations
// Auth: Supabase apikey + service role key + clinical role verification
//
// Decomposed modules:
//   types.ts          - All interfaces and type definitions
//   tools.ts          - MCP tool definitions and FHIR table mappings
//   bundleBuilder.ts  - FHIR Bundle construction and Patient mapping
//   validation.ts     - FHIR resource validation rules
//   audit.ts          - FHIR operation audit logging
//   resourceQueries.ts - Patient bundle export and resource search
//   patientSummary.ts - CCD-style patient summary builder
//   toolHandlers.ts   - Tool handler dispatch and business logic
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  handleHealthCheck,
  checkBodySize,
  buildProvenance,
  MCP_BODY_LIMIT_LARGE,
  type MCPInitResult
} from "../_shared/mcpServerBase.ts";
import {
  verifyClinicalAccess,
  getRequestId,
  createForbiddenResponse,
  createUnauthorizedResponse,
  type CallerIdentity
} from "../_shared/mcpAuthGate.ts";
import { extractCallerIdentity } from "../_shared/mcpIdentity.ts";
import { checkMCPRateLimit, checkPersistentRateLimit, getRequestIdentifier, getCallerRateLimitId, createRateLimitResponse, MCP_RATE_LIMITS } from "../_shared/mcpRateLimiter.ts";
import { validateForTool, validationErrorResponse, type ToolSchemaRegistry } from "../_shared/mcpInputValidator.ts";

import { TOOLS } from "./tools.ts";
import { executeToolHandler } from "./toolHandlers.ts";

// P2-1: Input validation schemas for FHIR tools
const VALIDATION: ToolSchemaRegistry = {
  export_patient_bundle: {
    patient_id: { type: 'uuid', required: true },
    resources: { type: 'array', maxItems: 20, itemType: 'string' },
    start_date: { type: 'date' },
    end_date: { type: 'date' },
  },
  get_resource: {
    resource_type: { type: 'string', required: true, maxLength: 50 },
    resource_id: { type: 'uuid', required: true },
  },
  search_resources: {
    resource_type: { type: 'string', required: true, maxLength: 50 },
    patient_id: { type: 'uuid' },
    date_from: { type: 'date' },
    date_to: { type: 'date' },
    limit: { type: 'number', min: 1, max: 500, integer: true },
  },
  create_resource: {
    resource_type: { type: 'string', required: true, maxLength: 50 },
    data: { type: 'object', required: true, maxSize: 65536 },
    patient_id: { type: 'uuid' },
  },
  update_resource: {
    resource_type: { type: 'string', required: true, maxLength: 50 },
    resource_id: { type: 'uuid', required: true },
    data: { type: 'object', required: true, maxSize: 65536 },
  },
  validate_resource: {
    resource_type: { type: 'string', required: true, maxLength: 50 },
    data: { type: 'object', required: true, maxSize: 65536 },
  },
  get_patient_summary: {
    patient_id: { type: 'uuid', required: true },
    include_sections: { type: 'array', maxItems: 20, itemType: 'string' },
  },
  get_observations: {
    patient_id: { type: 'uuid', required: true },
    date_from: { type: 'date' },
    date_to: { type: 'date' },
    limit: { type: 'number', min: 1, max: 500, integer: true },
  },
  get_medication_list: {
    patient_id: { type: 'uuid', required: true },
  },
  get_condition_list: {
    patient_id: { type: 'uuid', required: true },
  },
  get_sdoh_assessments: {
    patient_id: { type: 'uuid', required: true },
  },
  get_care_team: {
    patient_id: { type: 'uuid', required: true },
  },
  list_ehr_connections: {
    tenant_id: { type: 'uuid' },
  },
  trigger_ehr_sync: {
    connection_id: { type: 'uuid', required: true },
    patient_id: { type: 'uuid' },
    resources: { type: 'array', maxItems: 20, itemType: 'string' },
  },
};

// =====================================================
// Server Initialization
// =====================================================

const SERVER_CONFIG = {
  name: "mcp-fhir-server",
  version: "1.1.0",
  tier: "admin" as const
};

const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger } = initResult;

// Tier 3 requires service role - fail fast if not available
if (!initResult.supabase) {
  throw new Error(`MCP FHIR server requires service role key: ${initResult.error}`);
}

const sb = initResult.supabase;

// =====================================================
// Request Handler
// =====================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  // Health check endpoint (GET request)
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  // P3-3: Body size limit (2MB for FHIR bundles)
  const bodySizeResponse = checkBodySize(req, MCP_BODY_LIMIT_LARGE, corsHeaders);
  if (bodySizeResponse) return bodySizeResponse;

  // S2-2: In-memory rate limiting (DoS protection)
  const identifier = getRequestIdentifier(req);
  const rateLimitResult = checkMCPRateLimit(identifier, MCP_RATE_LIMITS.fhir);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.fhir, corsHeaders);
  }

  try {
    const body = await req.json();
    const { method, params, id } = body;

    // MCP Protocol: Initialize handshake (no auth required - discovery)
    if (method === "initialize") {
      return new Response(JSON.stringify(createInitializeResponse(SERVER_CONFIG, id)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: List tools (auth required on Tier 3 — P1-2)
    if (method === "tools/list") {
      const caller = await extractCallerIdentity(req, { serverName: SERVER_CONFIG.name, logger });
      if (!caller) {
        return createUnauthorizedResponse(
          "Authentication required for tool discovery on admin servers",
          requestId, corsHeaders
        );
      }
      return new Response(JSON.stringify(createToolsListResponse(TOOLS, id)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: Call tool
    if (method === "tools/call") {
      const { name: toolName, arguments: toolArgs } = params;

      if (!TOOLS[toolName as keyof typeof TOOLS]) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32602, message: `Unknown tool: ${toolName}`, data: { requestId } },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ============================================================
      // AUTH GATE: Verify caller has clinical access for FHIR operations
      // ============================================================
      const authResult = await verifyClinicalAccess(req, {
        serverName: SERVER_CONFIG.name,
        toolName,
        logger,
        requiredScope: "mcp:fhir"
      });

      if (!authResult.authorized) {
        logger.security("FHIR_ACCESS_DENIED", {
          requestId,
          tool: toolName,
          reason: authResult.error
        });

        if (authResult.statusCode === 401) {
          return createUnauthorizedResponse(authResult.error || "Unauthorized", requestId, corsHeaders);
        }
        return createForbiddenResponse(authResult.error || "Forbidden", requestId, corsHeaders);
      }

      const caller = authResult.caller as CallerIdentity;

      // S2-2: Persistent identity-based rate limiting (cross-instance)
      const identityRateResult = await checkPersistentRateLimit(
        sb, getCallerRateLimitId(caller), MCP_RATE_LIMITS.fhir
      );
      if (!identityRateResult.allowed) {
        return createRateLimitResponse(identityRateResult, MCP_RATE_LIMITS.fhir, corsHeaders);
      }

      logger.info("FHIR_TOOL_CALL", {
        requestId,
        tool: toolName,
        userId: caller.userId,
        role: caller.role,
        tenantId: caller.tenantId
      });

      // P2-1: Validate tool arguments before dispatch
      const validationErrors = validateForTool(toolName, toolArgs, VALIDATION);
      if (validationErrors && validationErrors.length > 0) {
        return validationErrorResponse(validationErrors, id, corsHeaders);
      }

      // Delegate to tool handler
      const { result, executionTimeMs } = await executeToolHandler(
        toolName,
        toolArgs,
        {
          sb,
          logger,
          serverConfig: SERVER_CONFIG,
          initResult,
          caller: {
            userId: caller.userId,
            role: caller.role,
            tenantId: caller.tenantId
          }
        }
      );

      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          metadata: {
            tool: toolName,
            executionTimeMs,
            requestId,
            caller: {
              userId: caller.userId,
              role: caller.role
            },
            provenance: buildProvenance('database', {
              dataFreshnessISO: new Date().toISOString()
            })
          }
        },
        id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32601, message: `Unknown MCP method: ${method}`, data: { requestId } },
      id: null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("FHIR_SERVER_ERROR", { requestId, errorMessage });

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: errorMessage,
        data: { requestId }
      },
      id: null
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
