// ============================================================
// MCP Chain Orchestrator — Chain Engine
//
// Core execution loop: loads chain definition → creates run →
// executes steps sequentially → handles approval gates,
// conditional skips, placeholder steps, and failures.
//
// Calls MCP servers via HTTP fetch (same pattern as agent-orchestrator).
// All state persisted to database (survives restarts).
// ============================================================

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { logMCPAudit } from "../_shared/mcpAudit.ts";
import type { EdgeFunctionLogger } from "../_shared/auditLogger.ts";
import type {
  ChainDefinition,
  ChainStepDefinition,
  ChainRun,
  ChainStepResult,
  ChainRunStatus,
  ChainStepStatus,
} from "./types.ts";
import {
  resolveInputMapping,
  evaluateCondition,
  buildResolveContext,
} from "./inputResolver.ts";
import { getServiceClient } from "./dbClient.ts";
import {
  updateStepStatus,
  updateRunStep,
  refreshChainRun,
} from "./chainActions.ts";

// Re-export actions so index.ts can import from one place
export { approveStep, cancelChain, getChainStatus } from "./chainActions.ts";

// ============================================================
// Start Chain
// ============================================================
export async function startChain(
  chainKey: string,
  inputParams: Record<string, unknown>,
  userId: string,
  tenantId: string,
  logger: EdgeFunctionLogger
): Promise<ChainRun> {
  const sb = getServiceClient();

  // Load chain definition
  const { data: chainDef, error: defErr } = await sb
    .from("chain_definitions")
    .select("*")
    .eq("chain_key", chainKey)
    .eq("is_active", true)
    .single();

  if (defErr || !chainDef) {
    throw new Error(`Chain not found or inactive: ${chainKey}`);
  }
  const definition = chainDef as ChainDefinition;

  // Load step definitions
  const { data: stepDefs, error: stepsErr } = await sb
    .from("chain_step_definitions")
    .select("*")
    .eq("chain_definition_id", definition.id)
    .order("step_order", { ascending: true });

  if (stepsErr || !stepDefs || stepDefs.length === 0) {
    throw new Error(`No steps defined for chain: ${chainKey}`);
  }
  const steps = stepDefs as ChainStepDefinition[];

  // Create chain run
  const { data: runData, error: runErr } = await sb
    .from("chain_runs")
    .insert({
      chain_definition_id: definition.id,
      chain_key: chainKey,
      status: "running" as ChainRunStatus,
      current_step_order: 1,
      input_params: inputParams,
      started_by: userId,
      tenant_id: tenantId,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (runErr || !runData) {
    throw new Error(`Failed to create chain run: ${runErr?.message ?? "unknown"}`);
  }
  const run = runData as ChainRun;

  // Create all step result rows (pending)
  const stepInserts = steps.map((step) => ({
    chain_run_id: run.id,
    step_definition_id: step.id,
    step_order: step.step_order,
    step_key: step.step_key,
    mcp_server: step.mcp_server,
    tool_name: step.tool_name,
    status: "pending" as ChainStepStatus,
  }));

  await sb.from("chain_step_results").insert(stepInserts);

  logger.info("CHAIN_STARTED", {
    chainRunId: run.id,
    chainKey,
    stepCount: steps.length,
  });

  // Execute steps (may pause at approval gate)
  return executeSteps(run, steps, logger);
}

// ============================================================
// Resume Chain (after approval or manual retry)
// ============================================================
export async function resumeChain(
  chainRunId: string,
  logger: EdgeFunctionLogger
): Promise<ChainRun> {
  const sb = getServiceClient();

  const { data: runData, error: runErr } = await sb
    .from("chain_runs")
    .select("*")
    .eq("id", chainRunId)
    .single();

  if (runErr || !runData) {
    throw new Error(`Chain run not found: ${chainRunId}`);
  }
  const run = runData as ChainRun;

  if (run.status !== "awaiting_approval" && run.status !== "failed") {
    throw new Error(
      `Chain run ${chainRunId} is not resumable (status: ${run.status})`
    );
  }

  // Load step definitions
  const { data: stepDefs } = await sb
    .from("chain_step_definitions")
    .select("*")
    .eq("chain_definition_id", run.chain_definition_id)
    .order("step_order", { ascending: true });

  const steps = (stepDefs || []) as ChainStepDefinition[];
  if (steps.length === 0) {
    throw new Error(`No steps found for chain definition`);
  }

  // Update run status back to running
  await sb
    .from("chain_runs")
    .update({ status: "running" as ChainRunStatus })
    .eq("id", run.id);

  run.status = "running";

  logger.info("CHAIN_RESUMED", {
    chainRunId: run.id,
    fromStep: run.current_step_order,
  });

  return executeSteps(run, steps, logger);
}

// ============================================================
// Core Execution Loop
// ============================================================
async function executeSteps(
  run: ChainRun,
  steps: ChainStepDefinition[],
  logger: EdgeFunctionLogger
): Promise<ChainRun> {
  const sb = getServiceClient();

  // Load all step results for context
  const { data: existingResults } = await sb
    .from("chain_step_results")
    .select("*")
    .eq("chain_run_id", run.id)
    .order("step_order", { ascending: true });

  const allResults = (existingResults || []) as ChainStepResult[];

  for (const stepDef of steps) {
    if (stepDef.step_order < run.current_step_order) continue;

    const stepResult = allResults.find(
      (r) => r.step_order === stepDef.step_order
    );
    if (!stepResult) continue;

    // Skip already completed/approved/skipped steps
    if (["completed", "approved", "skipped"].includes(stepResult.status)) {
      continue;
    }

    // Build resolve context from completed steps
    const ctx = buildResolveContext(run.input_params, allResults);

    // --- Conditional check ---
    if (stepDef.is_conditional && stepDef.condition_expression) {
      if (!evaluateCondition(stepDef.condition_expression, ctx)) {
        await updateStepStatus(sb, stepResult.id, "skipped");
        await updateRunStep(sb, run.id, stepDef.step_order);
        logger.info("CHAIN_STEP_SKIPPED", {
          chainRunId: run.id,
          stepKey: stepDef.step_key,
        });
        continue;
      }
    }

    // --- Placeholder step ---
    if (stepDef.is_placeholder) {
      await sb
        .from("chain_step_results")
        .update({
          status: "placeholder" as ChainStepStatus,
          placeholder_message: stepDef.placeholder_message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", stepResult.id);

      await updateRunStep(sb, run.id, stepDef.step_order);
      updateLocalResult(allResults, stepResult.id, "placeholder", {
        message: stepDef.placeholder_message,
      });

      logger.info("CHAIN_STEP_PLACEHOLDER", {
        chainRunId: run.id,
        stepKey: stepDef.step_key,
      });
      continue;
    }

    // --- Execute the MCP tool call ---
    const resolvedArgs = resolveInputMapping(stepDef.input_mapping, ctx);
    resolvedArgs.tenant_id = run.tenant_id; // P0-2: from JWT, never args

    await sb
      .from("chain_step_results")
      .update({
        status: "running" as ChainStepStatus,
        input_args: resolvedArgs,
        started_at: new Date().toISOString(),
      })
      .eq("id", stepResult.id);

    const startTime = Date.now();

    try {
      const { output: toolOutput, attempts } = await executeWithRetry(
        stepDef,
        resolvedArgs,
        run.id,
        logger
      );
      const execMs = Date.now() - startTime;
      const retryMetadata = attempts > 1 ? { retryAttempts: attempts - 1 } : undefined;

      // --- Approval gate ---
      if (stepDef.requires_approval) {
        await sb
          .from("chain_step_results")
          .update({
            status: "awaiting_approval" as ChainStepStatus,
            output_data: toolOutput,
            execution_time_ms: execMs,
          })
          .eq("id", stepResult.id);

        await sb
          .from("chain_runs")
          .update({
            status: "awaiting_approval" as ChainRunStatus,
            current_step_order: stepDef.step_order,
          })
          .eq("id", run.id);

        await auditStep(sb, logger, run, stepDef, execMs, true, {
          status: "awaiting_approval",
          approvalRole: stepDef.approval_role,
          ...retryMetadata,
        });

        logger.info("CHAIN_AWAITING_APPROVAL", {
          chainRunId: run.id,
          stepKey: stepDef.step_key,
          approvalRole: stepDef.approval_role,
        });

        return refreshChainRun(sb, run.id);
      }

      // Step completed
      await sb
        .from("chain_step_results")
        .update({
          status: "completed" as ChainStepStatus,
          output_data: toolOutput,
          execution_time_ms: execMs,
          completed_at: new Date().toISOString(),
        })
        .eq("id", stepResult.id);

      await updateRunStep(sb, run.id, stepDef.step_order);
      updateLocalResult(allResults, stepResult.id, "completed", toolOutput);
      await auditStep(sb, logger, run, stepDef, execMs, true, retryMetadata);

      logger.info("CHAIN_STEP_COMPLETED", {
        chainRunId: run.id,
        stepKey: stepDef.step_key,
        execMs,
      });
    } catch (err: unknown) {
      const execMs = Date.now() - startTime;
      const errMsg = err instanceof Error ? err.message : String(err);

      await sb
        .from("chain_step_results")
        .update({
          status: "failed" as ChainStepStatus,
          error_message: errMsg,
          execution_time_ms: execMs,
          completed_at: new Date().toISOString(),
        })
        .eq("id", stepResult.id);

      await sb
        .from("chain_runs")
        .update({
          status: "failed" as ChainRunStatus,
          current_step_order: stepDef.step_order,
          error_message: errMsg,
          error_step_key: stepDef.step_key,
        })
        .eq("id", run.id);

      await auditStep(sb, logger, run, stepDef, execMs, false, undefined, errMsg);

      logger.error("CHAIN_STEP_FAILED", {
        chainRunId: run.id,
        stepKey: stepDef.step_key,
        error: errMsg,
      });

      return refreshChainRun(sb, run.id);
    }
  }

  // All steps done
  const lastResult = allResults[allResults.length - 1];
  await sb
    .from("chain_runs")
    .update({
      status: "completed" as ChainRunStatus,
      output: lastResult?.output_data ?? {},
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  logger.info("CHAIN_COMPLETED", { chainRunId: run.id, chainKey: run.chain_key });
  return refreshChainRun(sb, run.id);
}

// ============================================================
// Retry Logic
// ============================================================

/** Determine if an error is transient and worth retrying */
function isRetryableError(errMsg: string): boolean {
  const retryablePatterns = [
    /timed out/i,
    /timeout/i,
    /returned 5\d{2}/,       // 5xx server errors
    /returned 429/,           // rate limited
    /network/i,
    /ECONNREFUSED/i,
    /ECONNRESET/i,
    /AbortError/i,
    /fetch failed/i,
  ];
  return retryablePatterns.some((p) => p.test(errMsg));
}

/** Calculate exponential backoff with jitter */
function getBackoffMs(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), 30000);
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

/** Execute an MCP call with retry support */
async function executeWithRetry(
  stepDef: ChainStepDefinition,
  resolvedArgs: Record<string, unknown>,
  chainRunId: string,
  logger: EdgeFunctionLogger
): Promise<{ output: Record<string, unknown>; totalMs: number; attempts: number }> {
  const maxRetries = stepDef.max_retries || 0;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoffMs = getBackoffMs(attempt - 1);
      logger.info("CHAIN_STEP_RETRY", {
        chainRunId,
        stepKey: stepDef.step_key,
        attempt,
        maxRetries,
        backoffMs,
        lastError: lastError?.message,
      });
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    const startTime = Date.now();
    try {
      const output = await callMCPServer(
        stepDef.mcp_server,
        stepDef.tool_name,
        resolvedArgs,
        stepDef.timeout_ms,
        chainRunId,
        logger
      );
      return { output, totalMs: Date.now() - startTime, attempts: attempt + 1 };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Non-retryable errors fail immediately
      if (!isRetryableError(lastError.message) || attempt >= maxRetries) {
        throw lastError;
      }
    }
  }

  // Should not reach here, but TypeScript needs it
  throw lastError ?? new Error("Retry loop exited unexpectedly");
}

// ============================================================
// MCP Server HTTP Call
// ============================================================
async function callMCPServer(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number,
  chainRunId: string,
  _logger: EdgeFunctionLogger
): Promise<Record<string, unknown>> {
  if (!SUPABASE_URL || !SB_SECRET_KEY) {
    throw new Error("Missing SUPABASE_URL or SB_SECRET_KEY");
  }

  const url = `${SUPABASE_URL}/functions/v1/${serverName}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SB_SECRET_KEY}`,
        apikey: SB_SECRET_KEY,
        "x-request-id": crypto.randomUUID(),
        "x-chain-run-id": chainRunId,
      },
      body: JSON.stringify({
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `MCP server ${serverName}/${toolName} returned ${response.status}: ${body}`
      );
    }

    const result: unknown = await response.json();
    return parseMCPResponse(result, serverName, toolName);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        `MCP server ${serverName}/${toolName} timed out after ${timeoutMs}ms`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Parse MCP protocol response into a plain object */
function parseMCPResponse(
  result: unknown,
  serverName: string,
  toolName: string
): Record<string, unknown> {
  if (typeof result !== "object" || result === null) {
    return { raw: result };
  }

  const typed = result as Record<string, unknown>;

  if (typed.error) {
    throw new Error(
      `MCP tool error (${serverName}/${toolName}): ${JSON.stringify(typed.error)}`
    );
  }

  // MCP response: { result: { content: [{ type: "text", text: "..." }] } }
  if (typed.result && typeof typed.result === "object") {
    const mcpResult = typed.result as Record<string, unknown>;
    if (Array.isArray(mcpResult.content) && mcpResult.content.length > 0) {
      const first = mcpResult.content[0] as Record<string, unknown>;
      if (first.type === "text" && typeof first.text === "string") {
        try {
          return JSON.parse(first.text) as Record<string, unknown>;
        } catch {
          return { text: first.text };
        }
      }
    }
    return mcpResult;
  }

  return typed;
}

// ============================================================
// Helpers
// ============================================================

/** Update a step result in the local array (for next step's context) */
function updateLocalResult(
  allResults: ChainStepResult[],
  stepResultId: string,
  status: ChainStepStatus,
  outputData: Record<string, unknown> | null
): void {
  const idx = allResults.findIndex((r) => r.id === stepResultId);
  if (idx >= 0) {
    allResults[idx] = { ...allResults[idx], status, output_data: outputData };
  }
}

/** Audit log helper for step execution */
async function auditStep(
  sb: import("https://esm.sh/@supabase/supabase-js@2").SupabaseClient,
  logger: EdgeFunctionLogger,
  run: ChainRun,
  stepDef: ChainStepDefinition,
  execMs: number,
  success: boolean,
  metadata?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  await logMCPAudit(sb, logger, {
    serverName: "mcp-chain-orchestrator",
    toolName: `chain:${run.chain_key}:${stepDef.step_key}`,
    userId: run.started_by,
    tenantId: run.tenant_id,
    executionTimeMs: execMs,
    success,
    errorMessage,
    metadata: { chainRunId: run.id, ...metadata },
  });
}
