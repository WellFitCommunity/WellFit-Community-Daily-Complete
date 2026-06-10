-- Batch 15 (DB-reference drift triage) — author rpc::get_slow_queries (#22).
--
-- Bucket: B-author (never defined in any migration; 0 migdefs).
-- Caller: supabase/functions/guardian-agent/monitoring.ts:35
--   .rpc('get_slow_queries', { threshold_ms: 1000 })
--   consumes rows as SlowQueryRecord { query_id: string; duration_ms: number }
--   (guardian-agent/types.ts:47) for Check 4 "Slow Database Queries" (performance alert).
--
-- Substrate verified live 2026-06-10 (CLAUDE.md #18):
--   * extension pg_stat_statements INSTALLED, in schema `extensions`.
--   * columns present: queryid bigint, mean_exec_time double precision, query text, calls bigint.
--   * function get_slow_queries did NOT exist live (drift) → the Guardian Check 4 has been
--     silently no-op'ing (rpc error swallowed by Promise.all → slowQueries undefined → branch skipped).
--
-- Security:
--   * SECURITY DEFINER — pg_stat_statements requires elevated read (pg_read_all_stats).
--   * search_path pinned to public, extensions (Supabase advisor requirement for DEFINER).
--   * Returns ONLY queryid + mean execution time. The `query` TEXT (which can embed literals)
--     is NEVER returned → no PHI / no statement-body leakage (matches Guardian's "NO PHI" note).
--   * EXECUTE revoked from PUBLIC/anon; granted to authenticated + service_role (Guardian calls
--     with the service role).

CREATE OR REPLACE FUNCTION public.get_slow_queries(threshold_ms integer DEFAULT 1000)
RETURNS TABLE(query_id text, duration_ms double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT s.queryid::text AS query_id,
         s.mean_exec_time AS duration_ms
  FROM extensions.pg_stat_statements s
  WHERE s.queryid IS NOT NULL
    AND s.mean_exec_time >= threshold_ms
  ORDER BY s.mean_exec_time DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_slow_queries(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_slow_queries(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_slow_queries(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_slow_queries(integer) TO service_role;

COMMENT ON FUNCTION public.get_slow_queries(integer) IS
  'Returns {query_id, duration_ms} for statements whose mean execution time is >= threshold_ms, '
  'from pg_stat_statements (top 100 by mean time). Never returns query text (no PHI). '
  'Consumed by guardian-agent monitoring Check 4 (performance). Drift-triage Batch 15 (#22).';
