-- Fix risk_assessments PHI encryption + restore its decrypt view — CLINICAL (Atlus) key.
--
-- Context (verified live 2026-07-11 via MCP, CLAUDE.md #18):
--   risk_assessments is the CLINICAL readmittance / CHW risk assessment (System B),
--   NOT the WellFit community wellness assessment (that lives in check_ins/self_reports).
--   Its BEFORE INSERT/UPDATE trigger encrypt_risk_assessments_phi() called the
--   deliberately-dropped encrypt_phi_jsonb() -> every write failed 42883, so the table
--   was un-writable (0 rows live). Separately, risk_assessments_decrypted never existed
--   live, so the read path (get-risk-assessments edge fn) was dead too.
--
-- Key scope (Maria's call, 2026-07-11): CLINICAL -> Vault key `app_encryption_key`
--   (verified present in vault.secrets). encrypt_phi_text/decrypt_phi_text select it via
--   use_clinical_key => true. 0 rows exist, so there is NO previously-encrypted data to
--   migrate — this is the clean moment to set the correct key on both sides.
--
-- Approach = Review-doc Option A: use the surviving encrypt_phi_text for all three PHI
--   fields (arrays as their jsonb-text form); do NOT resurrect the dropped encrypt_phi_jsonb.
--   See docs/clinical/RISK_ASSESSMENTS_ENCRYPTION_REVIEW.md.

-- 1. Trigger function: clinical key, no dependency on the dropped encrypt_phi_jsonb.
CREATE OR REPLACE FUNCTION public.encrypt_risk_assessments_phi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assessment_notes IS NOT NULL THEN
    NEW.assessment_notes_encrypted := public.encrypt_phi_text(NEW.assessment_notes, true);
    NEW.assessment_notes := NULL;
  END IF;

  IF NEW.risk_factors IS NOT NULL THEN
    NEW.risk_factors_encrypted := public.encrypt_phi_text(to_jsonb(NEW.risk_factors)::text, true);
    NEW.risk_factors := NULL;
  END IF;

  IF NEW.recommended_actions IS NOT NULL THEN
    NEW.recommended_actions_encrypted := public.encrypt_phi_text(to_jsonb(NEW.recommended_actions)::text, true);
    NEW.recommended_actions := NULL;
  END IF;

  RETURN NEW;
END
$function$;

-- 2. Decrypt view (clinical key). security_invoker=on so the caller's RLS on
--    risk_assessments applies (tenant isolation / super_admin). text[] fields are
--    rebuilt from the decrypted jsonb-text so consumers see the original arrays.
CREATE OR REPLACE VIEW public.risk_assessments_decrypted
WITH (security_invoker = on) AS
SELECT
  id, patient_id, assessor_id, tenant_id,
  risk_level, priority,
  medical_risk_score, mobility_risk_score, cognitive_risk_score, social_risk_score, overall_score,
  public.decrypt_phi_text(assessment_notes_encrypted, true) AS assessment_notes,
  CASE
    WHEN risk_factors_encrypted IS NOT NULL
    THEN ARRAY(SELECT jsonb_array_elements_text(public.decrypt_phi_text(risk_factors_encrypted, true)::jsonb))
  END AS risk_factors,
  CASE
    WHEN recommended_actions_encrypted IS NOT NULL
    THEN ARRAY(SELECT jsonb_array_elements_text(public.decrypt_phi_text(recommended_actions_encrypted, true)::jsonb))
  END AS recommended_actions,
  next_assessment_due, review_frequency,
  walking_ability, stair_climbing, sitting_ability, standing_ability, toilet_transfer,
  bathing_ability, meal_preparation, medication_management, fall_risk_factors,
  created_at, updated_at, valid_until
FROM public.risk_assessments;

GRANT SELECT ON public.risk_assessments_decrypted TO authenticated;

COMMENT ON VIEW public.risk_assessments_decrypted IS
  'PHI-decrypted risk_assessments (CLINICAL Vault key, use_clinical_key=true). '
  'security_invoker=on: caller RLS on risk_assessments applies. Read-only.';
