-- =====================================================================
-- FHIR AllergyIntolerance backing view
--
-- The MCP FHIR server maps AllergyIntolerance -> `fhir_allergies`, but that
-- table never existed live (aspirational mapping). The real allergy data lives
-- in the clinical `allergy_intolerances` table, which is keyed by `user_id`
-- (= auth.users.id = the FHIR patient_id) and uses non-FHIR column names.
--
-- This view is the coupling layer (governance supabase.md §3): it presents
-- allergy_intolerances with the FHIR-standard column names the generic FHIR
-- query path + FHIR_SELECT_COLUMNS['fhir_allergies'] expect, so AllergyIntolerance
-- export/search/get_resource/get_patient_summary work with no code change.
--
-- security_invoker = on: RLS of the calling role applies (the MCP server uses
-- the service role, which legitimately needs cross-patient clinical access).
-- Verified against live information_schema 2026-07-10.
-- =====================================================================

CREATE OR REPLACE VIEW public.fhir_allergies
WITH (security_invoker = on) AS
SELECT
  ai.id,
  ai.user_id                AS patient_id,
  ai.allergen_code          AS code,
  ai.allergen_name          AS code_display,
  ai.clinical_status,
  ai.verification_status,
  ai.allergen_type          AS category,
  ai.criticality,
  ai.type,
  ai.onset_date,
  ai.reaction_description,
  ai.created_at,
  ai.updated_at
FROM public.allergy_intolerances ai;

-- RLS does not grant privileges; grant explicit read to authenticated (supabase.md §2a).
GRANT SELECT ON public.fhir_allergies TO authenticated;

COMMENT ON VIEW public.fhir_allergies IS
  'FHIR AllergyIntolerance coupling view over allergy_intolerances (patient_id<-user_id). security_invoker.';
