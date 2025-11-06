-- ============================================================================
-- FIX DENIAL APPEAL VIEW - Correct Column References
-- ============================================================================
-- Fix: claims table doesn't have patient_id, need to join through encounters
-- ============================================================================

DROP VIEW IF EXISTS public.denials_pending_appeal;

CREATE OR REPLACE VIEW public.denials_pending_appeal AS
SELECT
  cd.id as denial_id,
  cd.claim_id,
  c.id as claim_internal_id,
  c.control_number as claim_number,
  c.total_charge,
  c.created_at as claim_created_at,
  cd.denial_code,
  cd.denial_reason,
  cd.denial_date,
  cd.appeal_status,
  cd.ai_confidence_score,
  cd.ai_success_probability,
  cd.ai_appeal_draft,
  cd.human_edited_appeal,
  cd.reviewed_by,
  cd.reviewed_at,
  cd.created_at,
  -- Count of previous appeals for this claim
  (
    SELECT COUNT(*)
    FROM claim_denials cd2
    WHERE cd2.claim_id = cd.claim_id
  ) as appeal_count
FROM public.claim_denials cd
JOIN public.claims c ON cd.claim_id = c.id
WHERE cd.appeal_status IN ('pending_review', 'draft_ready', 'human_review', 'ready_to_submit')
ORDER BY cd.denial_date DESC;

-- Grant SELECT to billing staff
GRANT SELECT ON public.denials_pending_appeal TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
