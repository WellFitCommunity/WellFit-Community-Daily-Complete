-- Slow-query alert noise fix + cron history retention (2026-07-23).
--
-- Investigation findings (live-verified):
--   * Every query above Guardian's 1s threshold was run by the postgres role —
--     Supabase Studio schema introspection (~21s on this ~250-table schema) and
--     ad-hoc admin/diagnostic psql. The worst app-facing query is ~140ms.
--   * get_slow_queries (authored 20260610120000) reads CUMULATIVE
--     pg_stat_statements (last reset 2025-12-21) with no role filter, so stale
--     admin entries re-fired the slow_query alert every 5-minute cron tick
--     forever (occurrence_count reached 12,287).
--   * cron.job_run_details had 758,897 rows / 184 MB (pg_cron never cleans its
--     own history) and guardian_cron_log 70,381 rows / 20 MB — no purge existed.
--
-- (The related net._http_response bloat — 296 MB for ~100 live rows — is fixed
-- by a one-off VACUUM FULL outside this migration; VACUUM cannot run in a
-- transaction. pg_net TTL-expires its rows, so no recurring job is needed.)

-- 1. get_slow_queries: only consider app-facing roles. Superuser/maintenance
--    roles (Studio, ad-hoc admin psql, replication) are infrastructure, not the
--    application — their occasional heavy queries are not actionable alerts.
CREATE OR REPLACE FUNCTION public.get_slow_queries(threshold_ms integer DEFAULT 1000)
RETURNS TABLE(query_id text, duration_ms double precision)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT s.queryid::text AS query_id,
         s.mean_exec_time AS duration_ms
  FROM extensions.pg_stat_statements s
  JOIN pg_roles r ON r.oid = s.userid
  WHERE s.queryid IS NOT NULL
    AND s.mean_exec_time >= threshold_ms
    AND NOT r.rolsuper
    AND r.rolname NOT IN (
      'postgres', 'supabase_admin', 'supabase_auth_admin',
      'supabase_storage_admin', 'supabase_replication_admin',
      'dashboard_user', 'pgbouncer'
    )
  ORDER BY s.mean_exec_time DESC
  LIMIT 100;
$function$;

COMMENT ON FUNCTION public.get_slow_queries(integer) IS
  'Slow app-facing queries from pg_stat_statements (mean >= threshold_ms). Excludes superuser/maintenance roles (Studio, admin psql) so Guardian slow_query alerts reflect the application, not tooling. Stats are cumulative since the last pg_stat_statements reset.';

-- 2. Daily purge of cron execution history (pg_cron keeps job_run_details
--    forever; Guardian writes guardian_cron_log every 5 minutes forever).
CREATE OR REPLACE FUNCTION public.purge_cron_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM cron.job_run_details WHERE end_time < now() - interval '30 days';
  DELETE FROM public.guardian_cron_log WHERE executed_at < now() - interval '30 days';
END;
$$;

COMMENT ON FUNCTION public.purge_cron_history() IS
  '30-day retention for cron.job_run_details and guardian_cron_log. Scheduled daily as cron-history-purge. Before this existed, job_run_details had grown to 758k rows / 184 MB.';

-- Maintenance-only: not callable from the API roles.
REVOKE ALL ON FUNCTION public.purge_cron_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_cron_history() FROM anon, authenticated;

-- Schedule daily at 03:30 UTC (guardian-eyes-cleanup runs at 03:00).
-- cron.schedule upserts by jobname, so this migration is idempotent.
SELECT cron.schedule('cron-history-purge', '30 3 * * *', 'SELECT public.purge_cron_history();');

-- 3. Run the first purge now to clear the existing backlog.
SELECT public.purge_cron_history();
