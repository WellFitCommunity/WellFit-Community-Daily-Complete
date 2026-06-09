-- SS-4a: Restrict EXECUTE on calculate_engagement_warning_score
--
-- This function is SECURITY DEFINER (bypasses RLS) and returns per-patient
-- engagement warning scores. It was executable by `anon` (and PUBLIC), which
-- let any holder of the public anon key call it with an arbitrary patient_id.
-- Only `authenticated` (RLS/app-gated) and `service_role` (trusted server) need it.
-- Verified live 2026-06-09: zero callers depend on anon execute.

REVOKE EXECUTE ON FUNCTION public.calculate_engagement_warning_score(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_engagement_warning_score(uuid, integer) FROM anon;

-- Re-affirm the legitimate grantees (idempotent).
GRANT EXECUTE ON FUNCTION public.calculate_engagement_warning_score(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_engagement_warning_score(uuid, integer) TO service_role;
