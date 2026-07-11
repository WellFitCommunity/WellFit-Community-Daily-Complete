-- Add functional-assessment columns to risk_assessments
--
-- Context: RiskAssessmentForm.tsx and the RiskAssessment type (src/types/riskAssessment.ts)
-- read and write nine functional-assessment fields that were never added to the live
-- risk_assessments table (schema drift — Rule #18). The form's insert() therefore fails
-- (400 Bad Request), and the manager's list SELECT of these columns also 400s.
--
-- Live table already has: RLS enabled, 4 policies, and GRANT to authenticated.
-- New columns are covered by the existing table-level GRANT, so no new GRANT is needed.
--
-- Eight single-value fields are stored as TEXT (they hold <select> option values).
-- fall_risk_factors holds a multi-select list, stored as TEXT[].

ALTER TABLE public.risk_assessments
  ADD COLUMN IF NOT EXISTS walking_ability        TEXT,
  ADD COLUMN IF NOT EXISTS stair_climbing         TEXT,
  ADD COLUMN IF NOT EXISTS sitting_ability        TEXT,
  ADD COLUMN IF NOT EXISTS standing_ability       TEXT,
  ADD COLUMN IF NOT EXISTS toilet_transfer        TEXT,
  ADD COLUMN IF NOT EXISTS bathing_ability        TEXT,
  ADD COLUMN IF NOT EXISTS meal_preparation       TEXT,
  ADD COLUMN IF NOT EXISTS medication_management  TEXT,
  ADD COLUMN IF NOT EXISTS fall_risk_factors      TEXT[];

COMMENT ON COLUMN public.risk_assessments.walking_ability       IS 'Functional assessment: independent walking ability (select value).';
COMMENT ON COLUMN public.risk_assessments.stair_climbing        IS 'Functional assessment: stair-climbing ability (select value).';
COMMENT ON COLUMN public.risk_assessments.sitting_ability       IS 'Functional assessment: safe sitting ability (select value).';
COMMENT ON COLUMN public.risk_assessments.standing_ability      IS 'Functional assessment: stand-from-chair ability (select value).';
COMMENT ON COLUMN public.risk_assessments.toilet_transfer       IS 'Functional assessment: toilet transfer safety (select value).';
COMMENT ON COLUMN public.risk_assessments.bathing_ability       IS 'Functional assessment: bathing independence (select value).';
COMMENT ON COLUMN public.risk_assessments.meal_preparation      IS 'Functional assessment: meal-preparation ability (select value).';
COMMENT ON COLUMN public.risk_assessments.medication_management IS 'Functional assessment: medication-management ability (select value).';
COMMENT ON COLUMN public.risk_assessments.fall_risk_factors     IS 'Functional assessment: selected fall-risk factors (multi-select list).';
