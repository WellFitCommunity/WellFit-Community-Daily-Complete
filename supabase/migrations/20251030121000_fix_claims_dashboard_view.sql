-- ============================================================================
-- FIX CLAIMS DASHBOARD VIEW
-- ============================================================================
-- Purpose: Create proper claims review dashboard with correct column references
-- ============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.claims_review_dashboard CASCADE;
DROP VIEW IF EXISTS public.claims_pending_review CASCADE;

-- Create enhanced claims review dashboard
CREATE OR REPLACE VIEW public.claims_review_dashboard AS
SELECT
  c.id,
  c.encounter_id,
  c.total_charge,
  c.expected_reimbursement,
  c.review_status,
  c.ai_confidence_score,
  c.ai_flags,
  c.created_at,
  c.reviewed_at,
  c.review_notes,
  c.control_number AS claim_number,

  -- Get patient info through encounter
  e.patient_id,
  p.full_name AS patient_name,
  p.date_of_birth AS patient_dob,
  p.mrn AS patient_mrn,

  -- Provider info through encounter
  e.provider_id,
  prov.full_name AS provider_name,
  prov.npi AS provider_npi,

  -- Billing provider info
  bp.organization_name AS billing_provider_name,
  bp.npi AS billing_provider_npi,

  -- Encounter info
  e.encounter_type,
  e.chief_complaint,
  e.date_of_service AS service_date,

  -- Payer info
  pay.name AS payer_name,

  -- Scribe session info
  ss.clinical_time_minutes,
  ss.is_ccm_eligible,
  ss.medical_necessity_score,
  ss.suggested_em_level,
  ss.suggested_cpt_codes,
  ss.suggested_icd10_codes,

  -- Line items summary
  (
    SELECT jsonb_agg(jsonb_build_object(
      'cpt_code', cl.procedure_code,
      'description', cl.description,
      'units', cl.units,
      'charge', cl.charge_amount,
      'icd10_codes', cl.diagnosis_pointers
    ) ORDER BY cl.line_number)
    FROM public.claim_lines cl
    WHERE cl.claim_id = c.id
  ) AS line_items,

  -- Flag severity counts
  COALESCE((
    SELECT COUNT(*)::INT
    FROM jsonb_array_elements(c.ai_flags) flag
    WHERE (flag->>'severity')::TEXT IN ('high', 'critical')
  ), 0) AS critical_flag_count,

  COALESCE((
    SELECT COUNT(*)::INT
    FROM jsonb_array_elements(c.ai_flags) flag
    WHERE (flag->>'severity')::TEXT = 'medium'
  ), 0) AS medium_flag_count,

  -- Review urgency score (for sorting)
  CASE
    WHEN c.review_status = 'flagged' THEN 1
    WHEN c.ai_confidence_score < 0.7 THEN 2
    WHEN c.total_charge > 1000 THEN 3
    WHEN c.review_status = 'awaiting_hospital_submission' THEN 5
    ELSE 4
  END AS review_priority,

  -- Review status display
  CASE c.review_status
    WHEN 'pending_review' THEN 'Pending Review'
    WHEN 'flagged' THEN 'Flagged - Needs Attention'
    WHEN 'reviewed' THEN 'Reviewed'
    WHEN 'awaiting_hospital_submission' THEN 'Ready for Hospital Submission'
    WHEN 'rejected' THEN 'Rejected'
    WHEN 'submitted' THEN 'Submitted to Clearinghouse'
    WHEN 'accepted' THEN 'Accepted by Payer'
    WHEN 'denied' THEN 'Denied by Payer'
    WHEN 'paid' THEN 'Paid'
    ELSE c.review_status
  END AS review_status_display

FROM public.claims c
LEFT JOIN public.encounters e ON c.encounter_id = e.id
LEFT JOIN public.profiles p ON e.patient_id = p.id
LEFT JOIN public.profiles prov ON e.provider_id = prov.id
LEFT JOIN public.billing_providers bp ON c.billing_provider_id = bp.id
LEFT JOIN public.billing_payers pay ON c.payer_id = pay.id
LEFT JOIN public.scribe_sessions ss ON ss.encounter_id = e.id

WHERE c.review_status IN ('pending_review', 'flagged', 'awaiting_hospital_submission', 'reviewed')
ORDER BY
  review_priority,
  c.created_at DESC;

-- Grant permissions
GRANT SELECT ON public.claims_review_dashboard TO authenticated;
GRANT SELECT ON public.claims_review_dashboard TO anon;

-- Create function to get dashboard stats
CREATE OR REPLACE FUNCTION public.get_billing_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'pending_review', COUNT(*) FILTER (WHERE review_status = 'pending_review'),
    'flagged', COUNT(*) FILTER (WHERE review_status = 'flagged'),
    'awaiting_hospital', COUNT(*) FILTER (WHERE review_status = 'awaiting_hospital_submission'),
    'total_pending_value', COALESCE(SUM(total_charge) FILTER (WHERE review_status IN ('pending_review', 'flagged')), 0),
    'expected_revenue', COALESCE(SUM(expected_reimbursement) FILTER (WHERE review_status IN ('pending_review', 'flagged', 'awaiting_hospital_submission')), 0),
    'avg_confidence', AVG(ai_confidence_score) FILTER (WHERE ai_confidence_score IS NOT NULL),
    'high_value_claims', COUNT(*) FILTER (WHERE total_charge > 500),
    'ccm_eligible_claims', COUNT(*) FILTER (WHERE is_ccm_eligible = true)
  ) INTO v_stats
  FROM public.claims_review_dashboard;

  RETURN v_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_billing_dashboard_stats TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Fixed claims review dashboard view with proper column references
-- Added dashboard statistics function
-- ============================================================================