-- Lock down 42 CFR Part 2 SECURITY DEFINER function execution to authenticated only.
-- Tracker: docs/trackers/db-reference-drift-triage-tracker.md (#6 corrective action, follow-up)
--
-- Postgres grants EXECUTE to PUBLIC by default, so `anon` (unauthenticated) could call these
-- DEFINER functions — flagged by the security advisor (anon_security_definer_function_executable).
-- For a HIPAA 42 CFR Part 2 consent/redaction subsystem, unauthenticated execution must be denied.
-- REVOKE from PUBLIC + anon; keep the authenticated grant (the service + RLS policies call them as
-- authenticated). classify_sensitive_from_icd10 is a pure IMMUTABLE function (not DEFINER, no PHI),
-- left as-is.

REVOKE EXECUTE ON FUNCTION public.check_sensitive_consent(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_patient_sensitive_segments(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redact_sensitive_fhir_data(uuid, jsonb, text[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.check_sensitive_consent(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_sensitive_segments(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redact_sensitive_fhir_data(uuid, jsonb, text[]) TO authenticated;
