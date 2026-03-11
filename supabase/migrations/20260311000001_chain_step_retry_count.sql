-- ============================================================
-- Add retry_count column to chain_step_results
--
-- Tracks how many retry attempts a step took before completing
-- or failing. Provides visibility in the chain status API.
-- Previously retry count was only in mcp_audit_logs metadata.
-- ============================================================

ALTER TABLE public.chain_step_results
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.chain_step_results.retry_count
  IS 'Number of retry attempts before step completed/failed (0 = succeeded on first try)';
