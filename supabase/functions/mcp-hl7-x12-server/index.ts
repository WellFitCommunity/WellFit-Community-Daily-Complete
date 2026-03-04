// =====================================================
// MCP HL7/X12 Transformer Server — Entry Point
// Purpose: Bidirectional HL7 v2.x, X12, and FHIR transformation
// Features: Message parsing, validation, conversion, generation
//
// TIER 3 (admin): Requires service role key for audit logging
// Auth: Supabase apikey + service role key + admin role verification
//
// This file is a thin router. All logic is in sibling modules.
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  handlePing,
  handleHealthCheck,
  checkBodySize,
  buildProvenance,
  MCP_BODY_LIMIT_LARGE,
  type MCPInitResult
} from "../_shared/mcpServerBase.ts";
import {
  verifyAdminAccess,
  getRequestId,
  createForbiddenResponse,
  createUnauthorizedResponse,
  CallerIdentity
} from "../_shared/mcpAuthGate.ts";
import { extractCallerIdentity } from "../_shared/mcpIdentity.ts";
import { checkMCPRateLimit, checkPersistentRateLimit, getRequestIdentifier, getCallerRateLimitId, createRateLimitResponse, MCP_RATE_LIMITS } from "../_shared/mcpRateLimiter.ts";

// Module imports
import type { ClaimData } from './types.ts';
import { TOOLS } from './tools.ts';
import { parseHL7Message } from './hl7Parser.ts';
import { hl7ToFHIR } from './hl7ToFhir.ts';
import { generateHL7Ack } from './hl7Ack.ts';
import { generate837P } from './x12Generator.ts';
import { validateX12 } from './x12Validator.ts';
import { parseX12 } from './x12Parser.ts';
import { x12ToFHIR } from './x12ToFhir.ts';
import { logTransformation } from './audit.ts';

// Server configuration
const SERVER_CONFIG = {
  name: "mcp-hl7-x12-server",
  version: "1.1.0",
  tier: "admin" as const
};

// Initialize with tiered approach - Tier 3 requires service role
const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger } = initResult;

// Tier 3 requires service role - fail fast if not available
if (!initResult.supabase) {
  throw new Error(`MCP HL7/X12 server requires service role key: ${initResult.error}`);
}

// Non-null after guard
const sb = initResult.supabase;

// =====================================================
// Tool Handler — dispatches to module functions
// =====================================================

async function handleToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  _caller: CallerIdentity
): Promise<unknown> {
  switch (toolName) {
    case "ping":
      return handlePing(SERVER_CONFIG, initResult);

    case "parse_hl7": {
      const parseResult = parseHL7Message(toolArgs.message as string);
      return {
        success: parseResult.success,
        messageType: parseResult.message?.messageType,
        messageControlId: parseResult.message?.messageControlId,
        version: parseResult.message?.version,
        sendingApplication: parseResult.message?.sendingApplication,
        sendingFacility: parseResult.message?.sendingFacility,
        segments: parseResult.message?.segments.map(s => ({
          name: s.name,
          fieldCount: s.fields.length
        })),
        errors: parseResult.errors,
        warnings: parseResult.warnings
      };
    }

    case "hl7_to_fhir": {
      const parseResult = parseHL7Message(toolArgs.message as string);
      if (!parseResult.success || !parseResult.message) {
        throw new Error(`Parse failed: ${parseResult.errors.join(', ')}`);
      }
      const conversion = hl7ToFHIR(parseResult.message);
      return {
        bundle: conversion.bundle,
        resourceCount: conversion.resourceCount,
        sourceMessageType: parseResult.message.messageType
      };
    }

    case "generate_hl7_ack": {
      const ack = generateHL7Ack(
        toolArgs.original_message as string,
        toolArgs.ack_code as string,
        toolArgs.error_message as string | undefined
      );
      return { ack_message: ack, ack_code: toolArgs.ack_code };
    }

    case "validate_hl7": {
      const parseResult = parseHL7Message(toolArgs.message as string);
      const messageType = toolArgs.message_type as string | undefined;
      const validationResult = {
        valid: parseResult.success && parseResult.errors.length === 0,
        messageType: parseResult.message?.messageType,
        expectedType: messageType,
        typeMatch: !messageType || parseResult.message?.messageType?.startsWith(messageType),
        segmentCount: parseResult.message?.segments.length || 0,
        errors: [...parseResult.errors],
        warnings: parseResult.warnings
      };
      if (messageType && !validationResult.typeMatch) {
        validationResult.errors.push(
          `Expected ${messageType}, got ${parseResult.message?.messageType}`
        );
        validationResult.valid = false;
      }
      return validationResult;
    }

    case "generate_837p": {
      const claimData = toolArgs.claim_data as Record<string, unknown> | undefined;
      const encounterId = toolArgs.encounter_id as string | undefined;

      if (claimData) {
        const controlNumbers = {
          isa: String(Date.now()).slice(-9).padStart(9, '0'),
          gs: String(Date.now()).slice(-9).padStart(9, '0'),
          st: String(Date.now()).slice(-4).padStart(4, '0')
        };
        // System boundary cast: MCP tool args arrive as untyped JSON
        const typedClaimData = claimData as unknown as ClaimData;
        const x12Content = generate837P(typedClaimData, controlNumbers);
        const validation = validateX12(x12Content);
        return {
          x12_content: x12Content,
          control_numbers: controlNumbers,
          segment_count: validation.segmentCount,
          validation
        };
      } else if (encounterId) {
        const { data: encounter, error: encError } = await sb
          .from('encounters')
          .select('id, patient_id')
          .eq('id', encounterId)
          .single();

        if (encError || !encounter) {
          throw new Error(`Encounter not found: ${encError?.message}`);
        }

        return {
          message: 'Encounter-based generation requires complete billing setup',
          encounter_id: encounterId,
          patient_id: encounter.patient_id,
          status: 'data_incomplete'
        };
      } else {
        throw new Error('Either encounter_id or claim_data required');
      }
    }

    case "validate_x12":
      return validateX12(toolArgs.x12_content as string);

    case "parse_x12":
      return parseX12(toolArgs.x12_content as string);

    case "x12_to_fhir": {
      const conversion = x12ToFHIR(toolArgs.x12_content as string);
      return { claim: conversion.claim, bundle: conversion.bundle };
    }

    case "get_message_types":
      return {
        hl7: {
          supported: ['ADT_A01', 'ADT_A02', 'ADT_A03', 'ADT_A04', 'ADT_A08', 'ORU_R01', 'ORM_O01'],
          versions: ['2.3', '2.3.1', '2.4', '2.5', '2.5.1', '2.6', '2.7', '2.8']
        },
        x12: {
          supported: ['837P'],
          versions: ['005010X222A1']
        },
        fhir: {
          supported: ['Patient', 'Encounter', 'Observation', 'Condition', 'AllergyIntolerance', 'Claim'],
          version: 'R4'
        }
      };

    default:
      throw new Error(`Tool ${toolName} not implemented`);
  }
}

// =====================================================
// Request Handler
// =====================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  // Health check endpoint (GET request)
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  // P3-3: Body size limit (2MB for HL7/X12 messages)
  const bodySizeResponse = checkBodySize(req, MCP_BODY_LIMIT_LARGE, corsHeaders);
  if (bodySizeResponse) return bodySizeResponse;

  // S2-2: In-memory rate limiting (DoS protection)
  const identifier = getRequestIdentifier(req);
  const rateLimitResult = checkMCPRateLimit(identifier, MCP_RATE_LIMITS.hl7x12);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.hl7x12, corsHeaders);
  }

  try {
    const body = await req.json();
    const { method, params, id } = body;

    // MCP Protocol: Initialize handshake
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
      const startTime = Date.now();

      if (!TOOLS[toolName as keyof typeof TOOLS]) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32602, message: `Unknown tool: ${toolName}`, data: { requestId } },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // AUTH GATE: Verify caller has admin access
      const authResult = await verifyAdminAccess(req, {
        serverName: SERVER_CONFIG.name,
        toolName,
        logger,
        requiredScope: "mcp:hl7_x12"
      });

      if (!authResult.authorized) {
        logger.security("HL7_X12_ACCESS_DENIED", {
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
        sb, getCallerRateLimitId(caller), MCP_RATE_LIMITS.hl7x12
      );
      if (!identityRateResult.allowed) {
        return createRateLimitResponse(identityRateResult, MCP_RATE_LIMITS.hl7x12, corsHeaders);
      }

      logger.info("HL7_X12_TOOL_CALL", {
        requestId,
        tool: toolName,
        userId: caller.userId,
        role: caller.role,
        tenantId: caller.tenantId
      });

      const result = await handleToolCall(toolName, toolArgs, caller);
      const executionTimeMs = Date.now() - startTime;

      // Audit log
      await logTransformation(sb, logger, {
        userId: caller.userId,
        operation: toolName,
        inputFormat: toolName.includes('hl7') ? 'HL7' : toolName.includes('x12') ? 'X12' : 'mixed',
        outputFormat: toolName.includes('fhir') ? 'FHIR' : toolName.includes('ack') ? 'HL7' : 'structured',
        success: true,
        executionTimeMs
      });

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
            provenance: buildProvenance('computed', {
              safetyFlags: ['reference_only']
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
      error: { code: -32601, message: `Method not found: ${method}`, data: { requestId } },
      id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("HL7_X12_API_ERROR", { requestId, errorMessage });

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
