-- Security Advisor CRITICAL: public.code_cpt had RLS disabled (rls_disabled_in_public).
-- Sibling sweep: code_icd10, code_hcpcs, code_modifiers had the same gap (RLS off,
-- and additionally NO SELECT grant for anon/authenticated, which has been silently
-- breaking mcp-medical-codes-server — a Tier-2 server that queries all four tables
-- under the anon key and was designed for "anon key + RLS" that never landed DB-side).
--
-- These are public reference code sets (CPT/HCPCS/ICD-10/modifiers): no PHI, no
-- tenant data. Correct posture: RLS on, read-only always-true SELECT policy for the
-- API roles, SELECT-only grants. Writes remain service_role/migration-only.

ALTER TABLE public.code_cpt       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_icd10     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_hcpcs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_modifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reference read" ON public.code_cpt;
CREATE POLICY "Public reference read" ON public.code_cpt
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public reference read" ON public.code_icd10;
CREATE POLICY "Public reference read" ON public.code_icd10
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public reference read" ON public.code_hcpcs;
CREATE POLICY "Public reference read" ON public.code_hcpcs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public reference read" ON public.code_modifiers;
CREATE POLICY "Public reference read" ON public.code_modifiers
  FOR SELECT TO anon, authenticated USING (true);

-- RLS != GRANT (supabase.md §2a): the roles also need table privileges.
GRANT SELECT ON public.code_cpt       TO anon, authenticated;
GRANT SELECT ON public.code_icd10     TO anon, authenticated;
GRANT SELECT ON public.code_hcpcs     TO anon, authenticated;
GRANT SELECT ON public.code_modifiers TO anon, authenticated;

COMMENT ON POLICY "Public reference read" ON public.code_cpt IS
  'Reference code set - public read-only. Writes via service_role/migrations only.';
