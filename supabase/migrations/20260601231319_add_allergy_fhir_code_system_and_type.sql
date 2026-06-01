-- Add the two genuinely-missing FHIR R4 AllergyIntolerance fields to allergy_intolerances.
--
-- Context: docs/trackers/clinical-logic-adversarial-audit-2026-06-01.md (AV-1).
-- AllergyIntoleranceService referenced six columns the live table lacked. Four of those
-- (patient_id, reaction, onset_datetime, category) already exist under different names
-- (user_id, reaction_manifestation, onset_date, allergen_type) and are corrected IN CODE,
-- not here — adding duplicate columns would create real schema drift. Only these two are
-- genuinely absent and clinically meaningful for FHIR interop / external EHR exchange.
--
-- RLS is already enabled on this table; additive columns do not change any policy.

ALTER TABLE public.allergy_intolerances
  ADD COLUMN IF NOT EXISTS allergen_code_system text,
  ADD COLUMN IF NOT EXISTS type text;

-- FHIR AllergyIntolerance.type is constrained to allergy | intolerance (matches the
-- table's existing CHECK-constraint pattern on allergen_type/criticality/severity).
ALTER TABLE public.allergy_intolerances
  DROP CONSTRAINT IF EXISTS allergy_intolerances_type_check;
ALTER TABLE public.allergy_intolerances
  ADD CONSTRAINT allergy_intolerances_type_check
  CHECK (type IS NULL OR type IN ('allergy', 'intolerance'));

COMMENT ON COLUMN public.allergy_intolerances.allergen_code_system IS
  'FHIR AllergyIntolerance.code.coding.system (the code system for allergen_code: RxNorm, SNOMED CT, UNII, etc.)';
COMMENT ON COLUMN public.allergy_intolerances.type IS
  'FHIR AllergyIntolerance.type: allergy | intolerance';
