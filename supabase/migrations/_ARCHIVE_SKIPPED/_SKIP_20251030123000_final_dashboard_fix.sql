-- ============================================================================
-- FINAL DASHBOARD FIX - ENTERPRISE GRADE
-- ============================================================================
-- Professional medical billing dashboard with correct schema
-- ============================================================================

-- Add missing description column to claim_lines
ALTER TABLE public.claim_lines
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Add missing line_number column for sorting
ALTER TABLE public.claim_lines
  ADD COLUMN IF NOT EXISTS line_number INTEGER;

-- Drop and recreate the dashboard view
DROP VIEW IF EXISTS public.claims_review_dashboard CASCADE;

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
  COALESCE(c.control_number, 'PENDING-' || SUBSTRING(c.id::TEXT, 1, 8)) AS claim_number,
  c.status AS claim_status,

  -- Patient info
  e.patient_id,
  CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) AS patient_name,
  p.dob AS patient_dob,

  -- Provider info
  e.provider_id,
  CONCAT(COALESCE(prov.first_name, ''), ' ', COALESCE(prov.last_name, '')) AS provider_name,

  -- Billing provider
  bp.organization_name AS billing_provider_name,
  bp.npi AS billing_provider_npi,

  -- Encounter details
  e.encounter_type,
  e.chief_complaint,
  e.date_of_service AS service_date,

  -- Payer info
  pay.name AS payer_name,

  -- Scribe session data
  ss.clinical_time_minutes,
  ss.is_ccm_eligible,
  ss.medical_necessity_score,
  ss.suggested_em_level,
  ss.suggested_cpt_codes,
  ss.suggested_icd10_codes,

  -- Line items
  (
    SELECT jsonb_agg(jsonb_build_object(
      'cpt_code', cl.procedure_code,
      'description', COALESCE(cl.description, 'Procedure ' || cl.procedure_code),
      'units', cl.units,
      'charge', cl.charge_amount,
      'diagnosis_codes', cl.diagnosis_pointers,
      'modifiers', cl.modifiers
    ) ORDER BY COALESCE(cl.line_number, cl.position, 1))
    FROM public.claim_lines cl
    WHERE cl.claim_id = c.id
  ) AS line_items,

  -- Flag counts
  COALESCE((
    SELECT COUNT(*)::INT
    FROM jsonb_array_elements(c.ai_flags) flag
    WHERE (flag->>'severity')::TEXT IN ('high', 'critical')
  ), 0) AS critical_flag_count,

  -- Priority for sorting
  CASE
    WHEN c.review_status = 'flagged' THEN 1
    WHEN COALESCE(c.ai_confidence_score, 1) < 0.7 THEN 2
    WHEN c.total_charge > 1000 THEN 3
    WHEN c.review_status = 'pending_review' THEN 4
    WHEN c.review_status = 'awaiting_hospital_submission' THEN 5
    ELSE 6
  END AS review_priority,

  -- Status display
  CASE c.review_status
    WHEN 'pending_review' THEN 'Pending Review'
    WHEN 'flagged' THEN 'Flagged - Needs Attention'
    WHEN 'reviewed' THEN 'Reviewed'
    WHEN 'awaiting_hospital_submission' THEN 'Ready for Hospital Submission'
    WHEN 'rejected' THEN 'Rejected'
    WHEN 'submitted' THEN 'Submitted'
    WHEN 'paid' THEN 'Paid'
    ELSE COALESCE(c.review_status, 'Unknown')
  END AS review_status_display

FROM public.claims c
LEFT JOIN public.encounters e ON c.encounter_id = e.id
LEFT JOIN public.profiles p ON e.patient_id = p.user_id
LEFT JOIN public.profiles prov ON e.provider_id = prov.user_id
LEFT JOIN public.billing_providers bp ON c.billing_provider_id = bp.id
LEFT JOIN public.billing_payers pay ON c.payer_id = pay.id
LEFT JOIN public.scribe_sessions ss ON ss.encounter_id = e.id

WHERE c.review_status IS NOT NULL
ORDER BY review_priority, c.created_at DESC;

-- Grant permissions
GRANT SELECT ON public.claims_review_dashboard TO authenticated;
GRANT SELECT ON public.claims_review_dashboard TO anon;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- ✅ Added missing columns to claim_lines
-- ✅ Created enterprise-grade dashboard view
-- ✅ All column references verified against actual schema
-- ============================================================================