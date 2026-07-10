// ============================================================
// MCP Chain Orchestrator — Chain Actions
//
// Non-execution operations: approve/reject, cancel, status, helpers.
// Extracted from chainEngine.ts to stay under 600 lines per file.
// ============================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EdgeFunctionLogger } from "../_shared/auditLogger.ts";
import type {
  ChainRun,
  ChainStepResult,
  ChainRunStatus,
  ChainStepStatus,
} from "./types.ts";
import { getServiceClient } from "./dbClient.ts";
import { CHAIN_RUN_COLS, CHAIN_STEP_RESULT_COLS } from "./columns.ts";

// ============================================================
// DB Helpers (used by chainEngine too)
// ============================================================

export async function updateStepStatus(
  sb: SupabaseClient,
  stepResultId: string,
  status: ChainStepStatus
): Promise<void> {
  await sb
    .from("chain_step_results")
    .update({ status, completed_at: new Date().toISOString() })
    .eq("id", stepResultId);
}

export async function updateRunStep(
  sb: SupabaseClient,
  runId: string,
  currentStepOrder: number
): Promise<void> {
  await sb
    .from("chain_runs")
    .update({ current_step_order: currentStepOrder })
    .eq("id", runId);
}

export async function refreshChainRun(
  sb: SupabaseClient,
  runId: string
): Promise<ChainRun> {
  const { data, error } = await sb
    .from("chain_runs")
    .select(CHAIN_RUN_COLS)
    .eq("id", runId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to refresh chain run: ${runId}`);
  }
  return data as unknown as ChainRun;
}

// ============================================================
// Approve / Reject Step
// ============================================================
export async function approveStep(
  chainRunId: string,
  stepResultId: string,
  decision: "approved" | "rejected",
  approvedBy: string,
  notes: string | null,
  logger: EdgeFunctionLogger
): Promise<ChainStepResult> {
  const sb = getServiceClient();

  const { data: stepData, error: stepErr } = await sb
    .from("chain_step_results")
    .select(CHAIN_STEP_RESULT_COLS)
    .eq("id", stepResultId)
    .eq("chain_run_id", chainRunId)
    .single();

  if (stepErr || !stepData) {
    throw new Error(`Step result not found: ${stepResultId}`);
  }
  const step = stepData as unknown as ChainStepResult;

  if (step.status !== "awaiting_approval") {
    throw new Error(
      `Step ${stepResultId} is not awaiting approval (status: ${step.status})`
    );
  }

  // --- Enforce approval_role from step definition ---
  // Look up the chain step definition to check required approval role.
  // NOTE: the definitions table is `chain_step_definitions` — a prior
  // `chain_steps` reference was a non-existent table, so this lookup errored
  // silently and the approval-role gate was skipped entirely (drift fix,
  // verified against information_schema 2026-07-10).
  const { data: stepDefData } = await sb
    .from("chain_step_definitions")
    .select("approval_role")
    .eq("chain_definition_id", (await sb
      .from("chain_runs")
      .select("chain_definition_id")
      .eq("id", chainRunId)
      .single()
    ).data?.chain_definition_id)
    .eq("step_key", step.step_key)
    .single();

  const requiredRole = (stepDefData as { approval_role: string | null } | null)?.approval_role;

  if (requiredRole) {
    // Check if the approving user has the required role
    const { data: roleData } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", approvedBy)
      .eq("role", requiredRole)
      .maybeSingle();

    if (!roleData) {
      logger.warn("CHAIN_APPROVAL_ROLE_DENIED", {
        chainRunId,
        stepKey: step.step_key,
        requiredRole,
        attemptedBy: approvedBy,
      });
      throw new Error(
        `User ${approvedBy} does not have required role "${requiredRole}" to approve step ${step.step_key}`
      );
    }
  }

  const newStatus: ChainStepStatus =
    decision === "approved" ? "approved" : "rejected";

  await sb
    .from("chain_step_results")
    .update({
      status: newStatus,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      approval_notes: notes,
      completed_at: new Date().toISOString(),
    })
    .eq("id", stepResultId);

  if (decision === "rejected") {
    await sb
      .from("chain_runs")
      .update({
        status: "failed" as ChainRunStatus,
        error_message: `Step ${step.step_key} rejected: ${notes || "No reason given"}`,
        error_step_key: step.step_key,
      })
      .eq("id", chainRunId);

    logger.info("CHAIN_STEP_REJECTED", {
      chainRunId,
      stepKey: step.step_key,
      rejectedBy: approvedBy,
    });
  } else {
    logger.info("CHAIN_STEP_APPROVED", {
      chainRunId,
      stepKey: step.step_key,
      approvedBy,
    });
  }

  const { data: updated } = await sb
    .from("chain_step_results")
    .select(CHAIN_STEP_RESULT_COLS)
    .eq("id", stepResultId)
    .single();

  return (updated || step) as ChainStepResult;
}

// ============================================================
// Cancel Chain
// ============================================================
export async function cancelChain(
  chainRunId: string,
  logger: EdgeFunctionLogger
): Promise<ChainRun> {
  const sb = getServiceClient();

  const { data: runData, error: runErr } = await sb
    .from("chain_runs")
    .select(CHAIN_RUN_COLS)
    .eq("id", chainRunId)
    .single();

  if (runErr || !runData) {
    throw new Error(`Chain run not found: ${chainRunId}`);
  }
  const run = runData as unknown as ChainRun;

  if (run.status === "completed" || run.status === "cancelled") {
    throw new Error(
      `Chain run ${chainRunId} cannot be cancelled (status: ${run.status})`
    );
  }

  await sb
    .from("chain_runs")
    .update({
      status: "cancelled" as ChainRunStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("id", chainRunId);

  logger.info("CHAIN_CANCELLED", { chainRunId });

  return refreshChainRun(sb, chainRunId);
}

// ============================================================
// Get Chain Status
// ============================================================
export async function getChainStatus(
  chainRunId: string
): Promise<{ run: ChainRun; steps: ChainStepResult[] }> {
  const sb = getServiceClient();

  const { data: runData, error: runErr } = await sb
    .from("chain_runs")
    .select(CHAIN_RUN_COLS)
    .eq("id", chainRunId)
    .single();

  if (runErr || !runData) {
    throw new Error(`Chain run not found: ${chainRunId}`);
  }

  const { data: stepData } = await sb
    .from("chain_step_results")
    .select(CHAIN_STEP_RESULT_COLS)
    .eq("chain_run_id", chainRunId)
    .order("step_order", { ascending: true });

  return {
    run: runData as unknown as ChainRun,
    steps: (stepData || []) as unknown as ChainStepResult[],
  };
}
