-- Belt-and-suspenders: capture the WITH CHECK fix on the fhir_goals / fhir_provenance
-- UPDATE policies as a first-class migration applied via `npx supabase db push`.
--
-- Why this exists: the WITH CHECK clause (required by the pre-commit RLS rule — the API-3a
-- lesson: a tenant UPDATE policy with USING but no WITH CHECK allows cross-tenant writes)
-- was first applied to LIVE via MCP execute_sql while reconciling 20260602210000. That was
-- an out-of-band DDL change that never went through db push. This migration re-asserts the
-- exact same policies through the proper workflow so the change is reproducible from the
-- migration history on every environment. Idempotent (DROP IF EXISTS + CREATE).

DROP POLICY IF EXISTS fhir_goals_update ON public.fhir_goals;
CREATE POLICY fhir_goals_update ON public.fhir_goals
  FOR UPDATE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin())
  WITH CHECK ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());

DROP POLICY IF EXISTS fhir_provenance_update ON public.fhir_provenance;
CREATE POLICY fhir_provenance_update ON public.fhir_provenance
  FOR UPDATE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin())
  WITH CHECK ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());
