-- ============================================================================
-- FIX CLAIMS DASHBOARD WITH CORRECT COLUMN NAMES
-- ============================================================================
-- Enterprise-grade view with proper column references
-- ============================================================================

-- Drop any existing views
DROP VIEW IF EXISTS public.claims_review_dashboard CASCADE;

-- Create the proper claims review dashboard
CREATE VIEW public.claims_review_dashboard AS
SELECT
  c.id AS claim_id,
  c.encounter_id,
  c.total_charge,
  c.expected_reimbursement,
  c.review_status,
  c.ai_confidence_score,
  c.ai_flags,
  c.ai_suggestions,
  c.created_at,
  c.reviewed_at,
  c.review_notes,
  c.control_number AS claim_number,
  c.status AS claim_status,

  -- Patient info through encounter
  e.patient_id,
  CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
  p.dob AS patient_dob,
  p.user_id AS patient_user_id,

  -- Provider info through encounter
  e.provider_id,
  CONCAT(prov.first_name, ' ', prov.last_name) AS provider_name,

  -- Billing provider info
  bp.organization_name AS billing_provider_name,
  bp.npi AS billing_provider_npi,

  -- Encounter info
  e.encounter_type,
  e.chief_complaint,
  e.date_of_service AS service_date,

  -- Payer info
  pay.name AS payer_name,
  pay.payer_id AS payer_identifier,

  -- Scribe session info
  ss.clinical_time_minutes,
  ss.is_ccm_eligible,
  ss.medical_necessity_score,
  ss.suggested_em_level,
  ss.suggested_cpt_codes,
  ss.suggested_icd10_codes,
  ss.suggested_hcpcs_codes,
  ss.suggested_modifiers,

  -- Line items summary
  (
    SELECT jsonb_agg(jsonb_build_object(
      'cpt_code', cl.procedure_code,
      'description', cl.description,
      'units', cl.units,
      'charge', cl.charge_amount,
      'diagnosis_codes', cl.diagnosis_pointers,
      'modifiers', cl.modifiers
    ) ORDER BY cl.line_number)
    FROM public.claim_lines cl
    WHERE cl.claim_id = c.id
  ) AS line_items,

  -- Count of line items
  (
    SELECT COUNT(*)::INT
    FROM public.claim_lines cl
    WHERE cl.claim_id = c.id
  ) AS line_item_count,

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

  COALESCE((
    SELECT COUNT(*)::INT
    FROM jsonb_array_elements(c.ai_flags) flag
    WHERE (flag->>'severity')::TEXT = 'low'
  ), 0) AS low_flag_count,

  -- Total flag count
  COALESCE(jsonb_array_length(c.ai_flags), 0) AS total_flag_count,

  -- Review urgency score (for sorting)
  CASE
    WHEN c.review_status = 'flagged' THEN 1
    WHEN c.ai_confidence_score < 0.7 THEN 2
    WHEN c.total_charge > 1000 THEN 3
    WHEN c.review_status = 'pending_review' THEN 4
    WHEN c.review_status = 'awaiting_hospital_submission' THEN 5
    WHEN c.review_status = 'reviewed' THEN 6
    ELSE 7
  END AS review_priority,

  -- Review status display
  CASE c.review_status
    WHEN 'pending_review' THEN 'Pending Review'
    WHEN 'flagged' THEN '⚠️ Flagged - Needs Attention'
    WHEN 'reviewed' THEN 'Reviewed - Ready'
    WHEN 'awaiting_hospital_submission' THEN '✅ Ready for Hospital Submission'
    WHEN 'rejected' THEN '❌ Rejected'
    WHEN 'submitted' THEN '📤 Submitted to Clearinghouse'
    WHEN 'accepted' THEN '✅ Accepted by Payer'
    WHEN 'denied' THEN '❌ Denied by Payer'
    WHEN 'paid' THEN '💰 Paid'
    ELSE COALESCE(c.review_status, 'Unknown')
  END AS review_status_display,

  -- Confidence level display
  CASE
    WHEN c.ai_confidence_score >= 0.9 THEN 'High'
    WHEN c.ai_confidence_score >= 0.7 THEN 'Medium'
    WHEN c.ai_confidence_score >= 0.5 THEN 'Low'
    ELSE 'Very Low'
  END AS confidence_level,

  -- Days since creation
  EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 86400 AS days_pending

FROM public.claims c
LEFT JOIN public.encounters e ON c.encounter_id = e.id
LEFT JOIN public.profiles p ON e.patient_id = p.user_id
LEFT JOIN public.profiles prov ON e.provider_id = prov.user_id
LEFT JOIN public.billing_providers bp ON c.billing_provider_id = bp.id
LEFT JOIN public.billing_payers pay ON c.payer_id = pay.id
LEFT JOIN public.scribe_sessions ss ON ss.encounter_id = e.id

WHERE c.review_status IN ('pending_review', 'flagged', 'awaiting_hospital_submission', 'reviewed')
   OR c.created_at > NOW() - INTERVAL '7 days'  -- Include recent claims
ORDER BY
  review_priority,
  c.created_at DESC;

-- Grant permissions
GRANT SELECT ON public.claims_review_dashboard TO authenticated;
GRANT SELECT ON public.claims_review_dashboard TO anon;

-- Create comprehensive billing stats function
CREATE OR REPLACE FUNCTION public.get_comprehensive_billing_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSONB;
BEGIN
  WITH claim_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE review_status = 'pending_review') AS pending_review,
      COUNT(*) FILTER (WHERE review_status = 'flagged') AS flagged,
      COUNT(*) FILTER (WHERE review_status = 'awaiting_hospital_submission') AS awaiting_hospital,
      COUNT(*) FILTER (WHERE review_status = 'reviewed') AS reviewed,
      COUNT(*) FILTER (WHERE review_status = 'submitted') AS submitted,
      COUNT(*) FILTER (WHERE review_status = 'denied') AS denied,
      COUNT(*) FILTER (WHERE review_status = 'paid') AS paid,

      -- Financial metrics
      COALESCE(SUM(total_charge) FILTER (WHERE review_status IN ('pending_review', 'flagged')), 0) AS total_pending_value,
      COALESCE(SUM(expected_reimbursement) FILTER (WHERE review_status IN ('pending_review', 'flagged', 'awaiting_hospital_submission')), 0) AS expected_revenue,
      COALESCE(SUM(total_charge) FILTER (WHERE review_status = 'paid'), 0) AS total_paid_value,

      -- Quality metrics
      AVG(ai_confidence_score) FILTER (WHERE ai_confidence_score IS NOT NULL) AS avg_confidence,
      COUNT(*) FILTER (WHERE total_charge > 500) AS high_value_claims,
      COUNT(*) FILTER (WHERE total_charge > 1000) AS very_high_value_claims,

      -- Time metrics
      AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 86400) FILTER (WHERE reviewed_at IS NOT NULL) AS avg_review_time_days,
      MAX(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) FILTER (WHERE review_status = 'pending_review') AS oldest_pending_days

    FROM public.claims
    WHERE created_at > NOW() - INTERVAL '30 days'
  ),
  ccm_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE is_ccm_eligible = true) AS ccm_eligible_sessions,
      SUM(clinical_time_minutes) AS total_clinical_minutes,
      AVG(clinical_time_minutes) AS avg_clinical_minutes
    FROM public.scribe_sessions
    WHERE created_at > NOW() - INTERVAL '30 days'
  ),
  flag_stats AS (
    SELECT
      COUNT(DISTINCT claim_id) AS claims_with_flags,
      COUNT(*) AS total_flags
    FROM public.claims c,
    LATERAL jsonb_array_elements(c.ai_flags) AS flag
    WHERE c.created_at > NOW() - INTERVAL '30 days'
  )
  SELECT jsonb_build_object(
    'claims', row_to_json(claim_stats),
    'ccm', row_to_json(ccm_stats),
    'flags', row_to_json(flag_stats),
    'timestamp', NOW(),
    'period', '30 days'
  ) INTO v_stats
  FROM claim_stats, ccm_stats, flag_stats;

  RETURN v_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_comprehensive_billing_stats TO authenticated;

-- Create function to get provider-specific stats
CREATE OR REPLACE FUNCTION public.get_provider_billing_stats(p_provider_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_claims', COUNT(*),
    'total_value', COALESCE(SUM(c.total_charge), 0),
    'expected_revenue', COALESCE(SUM(c.expected_reimbursement), 0),
    'avg_confidence', AVG(c.ai_confidence_score),
    'pending_review', COUNT(*) FILTER (WHERE c.review_status = 'pending_review'),
    'flagged', COUNT(*) FILTER (WHERE c.review_status = 'flagged'),
    'paid', COUNT(*) FILTER (WHERE c.review_status = 'paid'),
    'denied', COUNT(*) FILTER (WHERE c.review_status = 'denied'),
    'ccm_claims', COUNT(*) FILTER (WHERE ss.is_ccm_eligible = true),
    'avg_review_time_hours', AVG(EXTRACT(EPOCH FROM (c.reviewed_at - c.created_at)) / 3600) FILTER (WHERE c.reviewed_at IS NOT NULL)
  ) INTO v_stats
  FROM public.claims c
  LEFT JOIN public.encounters e ON c.encounter_id = e.id
  LEFT JOIN public.scribe_sessions ss ON ss.encounter_id = e.id
  WHERE e.provider_id = p_provider_id
    AND c.created_at > NOW() - INTERVAL '30 days';

  RETURN v_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_billing_stats TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- ✅ Enterprise-grade claims review dashboard with proper column references
-- ✅ Comprehensive billing statistics function
-- ✅ Provider-specific statistics function
-- ✅ All columns properly mapped to actual database structure
-- ============================================================================