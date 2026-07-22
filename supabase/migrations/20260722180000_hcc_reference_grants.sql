-- GRANT SELECT on HCC reference tables (§2a — RLS ≠ GRANT)
--
-- Found 2026-07-22 in Maria's browser console: hccOpportunityService reads
-- icd10_hcc_mappings + hcc_hierarchies and got 403 "permission denied" —
-- both tables have RLS enabled WITH read policies already in place
-- (icd10_hcc_mappings_read / hcc_hierarchies_read) but authenticated was
-- never GRANTed table privilege. Classic missing-GRANT gate (supabase.md §2a).
-- Read-only reference data → SELECT only.
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

GRANT SELECT ON public.icd10_hcc_mappings TO authenticated;
GRANT SELECT ON public.hcc_hierarchies TO authenticated;
