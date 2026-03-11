// ============================================================
// MCP Chain Orchestrator — Retry Engine
//
// Retry logic for MCP server calls: exponential backoff with
// jitter, transient error detection, per-retry audit logging.
// Extracted from chainEngine.ts for the 600-line file limit.
// ============================================================

import { logMCPAudit } from "../_shared/mcpAudit.ts";
import type { EdgeFunctionLogger } from "../_shared/auditLogger.ts";
import type { ChainStepDefinition } from "./types.ts";
import { getServiceClient } from "./dbClient.ts";

/** Context for audit logging during retries */
export interface RetryAuditContext {
  chainRunId: string;
  chainKey: string;
  userId: string;
  tenantId: string;
}

/** Determine if an error is transient and worth retrying */
export function isRetryableError(errMsg: string): boolean {
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
export function getBackoffMs(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), 30000);
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

/**
 * Execute an MCP call with retry support.
 *
 * @param stepDef - Step definition with max_retries and timeout
 * @param resolvedArgs - Resolved tool arguments
 * @param auditCtx - Context for audit logging
 * @param logger - Edge function logger
 * @param callFn - The actual MCP server call function (injected for testability)
 */
export async function executeWithRetry(
  stepDef: ChainStepDefinition,
  resolvedArgs: Record<string, unknown>,
  auditCtx: RetryAuditContext,
  logger: EdgeFunctionLogger,
  callFn: (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs: number,
    chainRunId: string,
    log: EdgeFunctionLogger
  ) => Promise<Record<string, unknown>>
): Promise<{ output: Record<string, unknown>; totalMs: number; attempts: number }> {
  const sb = getServiceClient();
  const maxRetries = stepDef.max_retries || 0;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoffMs = getBackoffMs(attempt - 1);
      logger.info("CHAIN_STEP_RETRY", {
        chainRunId: auditCtx.chainRunId,
        stepKey: stepDef.step_key,
        attempt,
        maxRetries,
        backoffMs,
        lastError: lastError?.message,
      });

      // Log each retry attempt to mcp_audit_logs for auditability
      await logMCPAudit(sb, logger, {
        serverName: "mcp-chain-orchestrator",
        toolName: `chain:${auditCtx.chainKey}:${stepDef.step_key}:retry`,
        userId: auditCtx.userId,
        tenantId: auditCtx.tenantId,
        success: false,
        errorMessage: lastError?.message,
        metadata: {
          chainRunId: auditCtx.chainRunId,
          attempt,
          maxRetries,
          backoffMs,
          previousError: lastError?.message,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    const startTime = Date.now();
    try {
      const output = await callFn(
        stepDef.mcp_server,
        stepDef.tool_name,
        resolvedArgs,
        stepDef.timeout_ms,
        auditCtx.chainRunId,
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
