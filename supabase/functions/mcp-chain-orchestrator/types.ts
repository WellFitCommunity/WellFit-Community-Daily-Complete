// ============================================================
// MCP Chain Orchestrator — Shared Types
// ============================================================

/** Status values for a chain run (matches DB enum) */
export type ChainRunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

/** Status values for a chain step result (matches DB enum) */
export type ChainStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "timed_out"
  | "placeholder";

/** Chain definition row from chain_definitions table */
export interface ChainDefinition {
  id: string;
  chain_key: string;
  display_name: string;
  description: string | null;
  version: number;
  is_active: boolean;
}

/** Step definition row from chain_step_definitions table */
export interface ChainStepDefinition {
  id: string;
  chain_definition_id: string;
  step_order: number;
  step_key: string;
  display_name: string;
  mcp_server: string;
  tool_name: string;
  requires_approval: boolean;
  approval_role: string | null;
  is_conditional: boolean;
  condition_expression: string | null;
  is_placeholder: boolean;
  placeholder_message: string | null;
  timeout_ms: number;
  max_retries: number;
  input_mapping: Record<string, string>;
}

/** Chain run row from chain_runs table */
export interface ChainRun {
  id: string;
  chain_definition_id: string;
  chain_key: string;
  status: ChainRunStatus;
  current_step_order: number;
  input_params: Record<string, unknown>;
  output: Record<string, unknown> | null;
  started_by: string;
  tenant_id: string;
  error_message: string | null;
  error_step_key: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Step result row from chain_step_results table */
export interface ChainStepResult {
  id: string;
  chain_run_id: string;
  step_definition_id: string;
  step_order: number;
  step_key: string;
  mcp_server: string;
  tool_name: string;
  status: ChainStepStatus;
  input_args: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  execution_time_ms: number | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  placeholder_message: string | null;
}

/** Request body for starting a chain */
export interface StartChainRequest {
  chain_key: string;
  input_params: Record<string, unknown>;
}

/** Request body for approving/rejecting a step */
export interface ApproveStepRequest {
  chain_run_id: string;
  step_result_id: string;
  decision: "approved" | "rejected";
  notes?: string;
}

/** Request body for resume/cancel */
export interface ChainActionRequest {
  chain_run_id: string;
}
