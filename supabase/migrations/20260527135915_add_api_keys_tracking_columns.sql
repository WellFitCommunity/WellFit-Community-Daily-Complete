-- _APPLIED_20260527135915_add_api_keys_tracking_columns.sql
--
-- API-3b — Self-Audit Session 6 wave 2 (continued)
--
-- Applied to live DB via Supabase MCP `apply_migration` on 2026-05-27
-- (version 20260527135915 in supabase_migrations.schema_migrations).
-- The `_APPLIED_` prefix in the header documents that this was MCP-applied;
-- the version is already recorded remotely so `supabase db push` will skip it.
--
-- Adds tracking columns to public.api_keys (mcp_keys feature parity).
--
-- BEFORE: api_keys = {id, label, key_hash, created_by, created_at,
-- revoked_at, tenant_id}. No usage tracking (last_used_at, use_count),
-- no partner-identifiable prefix, no revoke-reason field. ApiKeyManager UI
-- hardcoded `usage_count: 0` and `last_used: null` because the columns
-- didn't exist.
--
-- AFTER: 4 new columns + index on last_used_at for stale-key queries.
-- Schema is now ready for the validate_api_key RPC (API-3d) which will
-- populate last_used_at + use_count on every successful validation, and
-- for the ApiKeyManager UI (API-3f) to read real values.
--
-- Verified live state pre-migration via Supabase MCP execute_sql:
--   - api_keys: 7 columns, 0 rows, none of these 4 columns existed
--   - mcp_keys (model being mirrored):
--       key_prefix         varchar NOT NULL (set at insert)
--       use_count          bigint  NOT NULL DEFAULT 0
--       last_used_at       timestamptz NULL
--       revocation_reason  text    NULL
--
-- Design notes:
--   - key_prefix here is nullable text (not NOT NULL varchar like mcp_keys)
--     because legacy key-creation flow does not yet emit a prefix.
--     API-3i (Session B) will start populating it; at that point a follow-up
--     migration can backfill + tighten to NOT NULL.
--   - use_count default 0 + NOT NULL: safe even on populated tables; table
--     is empty so this is strictly additive.
--   - Index on last_used_at DESC NULLS LAST supports "recently used" and
--     "stale / unused keys" queries from the ApiKeyManager UI.

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS last_used_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS use_count         BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS key_prefix        TEXT,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_api_keys_last_used_at
  ON public.api_keys (last_used_at DESC NULLS LAST);

COMMENT ON COLUMN public.api_keys.last_used_at      IS 'Set by validate_api_key RPC on each successful validation.';
COMMENT ON COLUMN public.api_keys.use_count         IS 'Monotonic counter incremented by validate_api_key on successful validation.';
COMMENT ON COLUMN public.api_keys.key_prefix        IS 'Partner-identifiable prefix (e.g. 8 chars). Populated by future generate-api-key RPC (API-3i); nullable until backfill complete.';
COMMENT ON COLUMN public.api_keys.revocation_reason IS 'Human-readable reason captured at revoke time (e.g. "rotation", "partner offboarded", "compromised").';
