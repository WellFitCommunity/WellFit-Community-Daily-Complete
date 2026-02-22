// =====================================================
// MCP Clearinghouse Server — Entry Point
// Purpose: Healthcare clearinghouse EDI operations
// Features: Claims (837P/837I), status (276/277), eligibility (270/271),
//           remittance (835), prior auth (278), connection testing
// Supports: Waystar, Change Healthcare, Availity
//
// TIER 1 (external_api): No Supabase required - external clearinghouse APIs
// Auth: Supabase apikey header only (for edge function access)
//
// This file is a thin router. All logic is in sibling modules.
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { checkMCPRateLimit, getRequestIdentifier, createRateLimitResponse, MCP_RATE_LIMITS } from '../_shared/mcpRateLimiter.ts';
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  handlePing,
  handleHealthCheck,
  type MCPInitResult
} from '../_shared/mcpServerBase.ts';
import { getRequestId } from '../_shared/mcpAuthGate.ts';

// Module imports
import type { ClaimSubmission, ClaimStatusRequest, EligibilityRequest, PriorAuthRequest } from './types.ts';
import { TOOLS } from './tools.ts';
import { ClearinghouseClient } from './client.ts';
import {
  handleSubmitClaim,
  handleCheckClaimStatus,
  handleVerifyEligibility,
  handleProcessRemittance,
  handleSubmitPriorAuth,
  handleTestConnection,
  handleGetPayerList,
  handleGetSubmissionStats,
  handleGetRejectionReasons
} from './handlers.ts';

// Server configuration
const SERVER_CONFIG = {
  name: 'mcp-clearinghouse-server',
  version: '1.1.0',
  tier: 'external_api' as const
};

// Initialize with tiered approach - Tier 1 doesn't require Supabase
const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger } = initResult;

// =====================================================
// Tool Dispatcher — routes tool calls to handler functions
// =====================================================

async function handleToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Initialize clearinghouse client
  const client = new ClearinghouseClient();
  // In production: await client.initialize(tenantId from JWT);

  switch (toolName) {
    case 'ping':
      return handlePing(SERVER_CONFIG, initResult) as Record<string, unknown>;
    case 'submit_claim':
      return handleSubmitClaim(client, toolArgs.claim as ClaimSubmission, 'tenant-id');
    case 'check_claim_status':
      return handleCheckClaimStatus(client, toolArgs.request as ClaimStatusRequest, 'tenant-id');
    case 'verify_eligibility':
      return handleVerifyEligibility(client, toolArgs.request as EligibilityRequest, 'tenant-id');
    case 'process_remittance':
      return handleProcessRemittance(toolArgs.x12_content as string, 'tenant-id');
    case 'submit_prior_auth':
      return handleSubmitPriorAuth(client, toolArgs.request as PriorAuthRequest, 'tenant-id');
    case 'test_connection':
      return handleTestConnection(client, 'tenant-id');
    case 'get_payer_list':
      return handleGetPayerList(
        toolArgs.search as string | undefined,
        toolArgs.state as string | undefined,
        toolArgs.type as string | undefined
      );
    case 'get_submission_stats':
      return handleGetSubmissionStats(
        'tenant-id',
        toolArgs.date_from as string | undefined,
        toolArgs.date_to as string | undefined,
        toolArgs.payer_id as string | undefined
      );
    case 'get_rejection_reasons':
      return handleGetRejectionReasons(
        toolArgs.rejection_code as string | undefined,
        toolArgs.category as string | undefined
      );
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// =====================================================
// Request Handler
// =====================================================

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  // Handle GET /health for infrastructure monitoring
  if (req.method === 'GET') {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  // Rate limiting - strict for expensive clearinghouse calls
  const identifier = getRequestIdentifier(req);
  const rateLimitResult = checkMCPRateLimit(identifier, MCP_RATE_LIMITS.clearinghouse);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.clearinghouse, corsHeaders);
  }

  try {
    // Tier 1 (external_api): No Bearer token required
    // Authentication is handled by Supabase apikey header at the edge function level
    // This server only calls external clearinghouse APIs, no internal data access

    const body = await req.json();
    const { method, params, id } = body;

    // MCP Protocol: Initialize handshake
    if (method === 'initialize') {
      return new Response(
        JSON.stringify(createInitializeResponse(SERVER_CONFIG, id)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MCP Protocol: List tools
    if (method === 'tools/list') {
      return new Response(
        JSON.stringify(createToolsListResponse(TOOLS, id)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MCP Protocol: Call tool
    if (method === 'tools/call') {
      const { name: toolName, arguments: toolArgs } = params;
      const startTime = Date.now();

      if (!TOOLS[toolName]) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32602, message: `Unknown tool: ${toolName}`, data: { requestId } },
          id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const result = await handleToolCall(toolName, toolArgs || {});

      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            metadata: {
              tool: toolName,
              executionTimeMs: Date.now() - startTime
            }
          },
          id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown MCP method
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32601, message: `Method not found: ${method}`, data: { requestId } },
        id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    logger.error('Clearinghouse MCP error', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      requestId
    });
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
          data: { requestId }
        },
        id: null
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
