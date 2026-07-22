-- GRANT SELECT on SOC2/compliance tables (§2a — RLS ≠ GRANT)
--
-- Found 2026-07-22 in Maria's browser walk of the SOC2/audit surfaces: three
-- more tables with RLS policies in place but no table privilege for
-- authenticated → 403 "permission denied" on every dashboard read.
--   ai_model_registry     (HTI-2 model transparency panel)
--   tenant_config_audit   (tenant config change history)
--   disclosure_accounting (HIPAA accounting-of-disclosures report)
-- All are read surfaces for clinical/admin users; writes stay service-side.
-- RLS policies (verified present) continue to gate rows.
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

GRANT SELECT ON public.ai_model_registry TO authenticated;
GRANT SELECT ON public.tenant_config_audit TO authenticated;
GRANT SELECT ON public.disclosure_accounting TO authenticated;
