-- Batch 16 follow-up — revoke residual PUBLIC EXECUTE on get_patient_engagement_metrics.
--
-- 20260610120001 revoked EXECUTE from `anon` but not `PUBLIC`; the default PUBLIC grant
-- survived, and anon inherits EXECUTE via PUBLIC. Functionally safe (the fn is SECURITY
-- INVOKER and the base-table RLS returns zero rows for a null auth.uid()), but inconsistent
-- with get_slow_queries (Batch 15) and this codebase's anon/PUBLIC-revoke standard for RPCs.
-- Applied as a forward migration (not by editing the already-applied 120001) to avoid
-- content-vs-version drift.

REVOKE ALL ON FUNCTION public.get_patient_engagement_metrics(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_engagement_metrics(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_engagement_metrics(uuid, uuid) TO service_role;
