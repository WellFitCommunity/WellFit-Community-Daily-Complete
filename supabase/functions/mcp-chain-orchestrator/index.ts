/**
 * MCP Chain Orchestrator — HTTP Handler
 *
 * Routes: start, resume, approve, cancel, status
 *
 * Auth: Requires clinical-level access (physician, nurse, admin, etc.)
 * via the shared mcpAuthGate. tenant_id derived from JWT (P0-2 compliant).
 *
 * Copyright (c) 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { verifyClinicalAccess } from "../_shared/mcpAuthGate.ts";
import {
  startChain,
  resumeChain,
  approveStep,
  cancelChain,
  getChainStatus,
} from "./chainEngine.ts";
import type {
  StartChainRequest,
  ApproveStepRequest,
  ChainActionRequest,
} from "./types.ts";

const logger = createLogger("mcp-chain-orchestrator");

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = crypto.randomUUID();

  try {
    // Auth gate — require clinical access
    const authResult = await verifyClinicalAccess(req, {
      serverName: "mcp-chain-orchestrator",
      logger,
      requiredScope: "mcp:admin",
    });

    if (!authResult.authorized || !authResult.caller) {
      return new Response(
        JSON.stringify({ error: authResult.error || "Unauthorized" }),
        { status: authResult.statusCode, headers: corsHeaders }
      );
    }

    const caller = authResult.caller;
    const userId = caller.userId;
    const tenantId = caller.tenantId;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "No tenant_id associated with caller" }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Parse request body
    const body: unknown = await req.json().catch(() => ({}));
    if (typeof body !== "object" || body === null) {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const payload = body as Record<string, unknown>;
    const action = (payload.action as string) || "";

    switch (action) {
      // ==========================================
      // START — Begin a new chain run
      // ==========================================
      case "start": {
        const params = payload as unknown as StartChainRequest;
        if (!params.chain_key) {
          return new Response(
            JSON.stringify({ error: "chain_key is required" }),
            { status: 400, headers: corsHeaders }
          );
        }

        const run = await startChain(
          params.chain_key,
          params.input_params || {},
          userId,
          tenantId,
          logger
        );

        return new Response(
          JSON.stringify({ run, request_id: requestId }),
          { status: 200, headers: corsHeaders }
        );
      }

      // ==========================================
      // RESUME — Continue a paused/failed chain
      // ==========================================
      case "resume": {
        const params = payload as unknown as ChainActionRequest;
        if (!params.chain_run_id) {
          return new Response(
            JSON.stringify({ error: "chain_run_id is required" }),
            { status: 400, headers: corsHeaders }
          );
        }

        const run = await resumeChain(params.chain_run_id, logger);
        return new Response(
          JSON.stringify({ run, request_id: requestId }),
          { status: 200, headers: corsHeaders }
        );
      }

      // ==========================================
      // APPROVE — Approve or reject a step gate
      // ==========================================
      case "approve": {
        const params = payload as unknown as ApproveStepRequest;
        if (!params.chain_run_id || !params.step_result_id || !params.decision) {
          return new Response(
            JSON.stringify({
              error: "chain_run_id, step_result_id, and decision are required",
            }),
            { status: 400, headers: corsHeaders }
          );
        }

        if (params.decision !== "approved" && params.decision !== "rejected") {
          return new Response(
            JSON.stringify({ error: "decision must be 'approved' or 'rejected'" }),
            { status: 400, headers: corsHeaders }
          );
        }

        const step = await approveStep(
          params.chain_run_id,
          params.step_result_id,
          params.decision,
          userId,
          params.notes || null,
          logger
        );

        return new Response(
          JSON.stringify({ step, request_id: requestId }),
          { status: 200, headers: corsHeaders }
        );
      }

      // ==========================================
      // CANCEL — Halt a running/paused chain
      // ==========================================
      case "cancel": {
        const params = payload as unknown as ChainActionRequest;
        if (!params.chain_run_id) {
          return new Response(
            JSON.stringify({ error: "chain_run_id is required" }),
            { status: 400, headers: corsHeaders }
          );
        }

        const run = await cancelChain(params.chain_run_id, logger);
        return new Response(
          JSON.stringify({ run, request_id: requestId }),
          { status: 200, headers: corsHeaders }
        );
      }

      // ==========================================
      // STATUS — Get chain run + step results
      // ==========================================
      case "status": {
        const params = payload as unknown as ChainActionRequest;
        if (!params.chain_run_id) {
          return new Response(
            JSON.stringify({ error: "chain_run_id is required" }),
            { status: 400, headers: corsHeaders }
          );
        }

        const result = await getChainStatus(params.chain_run_id);
        return new Response(
          JSON.stringify({ ...result, request_id: requestId }),
          { status: 200, headers: corsHeaders }
        );
      }

      default:
        return new Response(
          JSON.stringify({
            error: `Unknown action: ${action}. Valid actions: start, resume, approve, cancel, status`,
          }),
          { status: 400, headers: corsHeaders }
        );
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("CHAIN_ORCHESTRATOR_ERROR", {
      requestId,
      error: errMsg,
    });

    return new Response(
      JSON.stringify({ error: errMsg, request_id: requestId }),
      { status: 500, headers: corsHeaders }
    );
  }
});
