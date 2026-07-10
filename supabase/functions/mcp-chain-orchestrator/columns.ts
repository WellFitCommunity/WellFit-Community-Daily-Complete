// ============================================================
// MCP Chain Orchestrator — Explicit Column Selections
//
// §9 (supabase.md): no `select('*')`. These lists are the full,
// live-verified column set of each chain_* table (byte-identical to
// the prior `*` output) so tool responses are unchanged while every
// column is pinned against the real schema (Commandment #18).
// Verified against information_schema 2026-07-10.
// ============================================================

/** chain_runs — all live columns */
export const CHAIN_RUN_COLS =
  "id, chain_definition_id, chain_key, status, current_step_order, input_params, output, " +
  "started_by, tenant_id, error_message, error_step_key, started_at, completed_at, created_at, updated_at";

/** chain_step_results — all live columns */
export const CHAIN_STEP_RESULT_COLS =
  "id, chain_run_id, step_definition_id, step_order, step_key, mcp_server, tool_name, status, " +
  "input_args, output_data, error_message, execution_time_ms, approved_by, approved_at, " +
  "approval_notes, placeholder_message, started_at, completed_at, created_at, updated_at, retry_count";

/** chain_definitions — all live columns */
export const CHAIN_DEFINITION_COLS =
  "id, chain_key, display_name, description, version, is_active, created_at, updated_at";

/** chain_step_definitions — all live columns */
export const CHAIN_STEP_DEFINITION_COLS =
  "id, chain_definition_id, step_order, step_key, display_name, mcp_server, tool_name, " +
  "requires_approval, approval_role, is_conditional, condition_expression, is_placeholder, " +
  "placeholder_message, timeout_ms, max_retries, input_mapping, created_at";
