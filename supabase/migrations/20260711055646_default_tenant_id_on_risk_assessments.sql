-- Default tenant_id on risk_assessments so the RiskAssessmentForm insert satisfies RLS.
--
-- Context: the risk_assessments INSERT policy is
--   WITH CHECK (tenant_id = get_current_tenant_id())
-- but RiskAssessmentForm.tsx never sets tenant_id (it is not in the form's formData).
-- tenant_id was nullable with no default, so an authenticated insert landed NULL and
-- was rejected by the policy (the same tenant_id trap that blocked ONC-1/ONC-2).
--
-- Fix matches the established codebase convention (DEFAULT get_current_tenant_id() on
-- tenant_id columns): the JWT-derived tenant is filled automatically on insert, so the
-- policy check passes without any client change. Callers that pass tenant_id explicitly
-- (e.g. service-role/system inserts) are unaffected.

ALTER TABLE public.risk_assessments
  ALTER COLUMN tenant_id SET DEFAULT get_current_tenant_id();
