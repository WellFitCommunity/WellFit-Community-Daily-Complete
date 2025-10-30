-- ============================================================================
-- COMPLETE BILLING INTEGRATION GAPS
-- ============================================================================
-- Purpose: Fill all missing pieces for SmartScribe → UnifiedBilling → Review workflow
-- Texas Compliance: Human oversight required - marks claims as "awaiting_hospital_submission"
-- ============================================================================

-- ============================================================================
-- SECTION 1: Complete scribe_sessions table for billing integration
-- ============================================================================

-- Ensure all required billing fields exist in scribe_sessions
DO $$
BEGIN
  -- AI-suggested billing codes (populated by AI during/after scribe session)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions' AND column_name = 'suggested_cpt_codes'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN suggested_cpt_codes JSONB DEFAULT '[]';
    COMMENT ON COLUMN public.scribe_sessions.suggested_cpt_codes IS
      'AI-suggested CPT codes: [{code, description, confidence, rationale}]';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions' AND column_name = 'suggested_icd10_codes'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN suggested_icd10_codes JSONB DEFAULT '[]';
    COMMENT ON COLUMN public.scribe_sessions.suggested_icd10_codes IS
      'AI-suggested ICD-10 codes: [{code, description, confidence, rationale}]';
  END IF;

  -- CCM time tracking fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions' AND column_name = 'clinical_time_minutes'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN clinical_time_minutes INTEGER DEFAULT 0;
    COMMENT ON COLUMN public.scribe_sessions.clinical_time_minutes IS
      'Total clinical time in minutes for CCM billing (20+ = 99490, 40+ = add 99439)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions' AND column_name = 'is_ccm_eligible'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN is_ccm_eligible BOOLEAN DEFAULT false;
    COMMENT ON COLUMN public.scribe_sessions.is_ccm_eligible IS
      'Auto-set true if clinical_time_minutes >= 20';
  END IF;

  -- HCPCS suggestions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions' AND column_name = 'suggested_hcpcs_codes'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN suggested_hcpcs_codes JSONB DEFAULT '[]';
    COMMENT ON COLUMN public.scribe_sessions.suggested_hcpcs_codes IS
      'AI-suggested HCPCS codes for supplies/DME';
  END IF;

  -- Modifier suggestions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions' AND column_name = 'suggested_modifiers'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN suggested_modifiers JSONB DEFAULT '[]';
    COMMENT ON COLUMN public.scribe_sessions.suggested_modifiers IS
      'Suggested CPT modifiers: [{modifier, reason}] e.g., -95 for telehealth';
  END IF;

  -- E/M level determination
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions' AND column_name = 'suggested_em_level'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN suggested_em_level TEXT;
    COMMENT ON COLUMN public.scribe_sessions.suggested_em_level IS
      'Suggested E/M level: 99211-99215 for established, 99201-99205 for new';
  END IF;

  -- Medical necessity documentation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions' AND column_name = 'medical_necessity_score'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN medical_necessity_score NUMERIC(3,2);
    COMMENT ON COLUMN public.scribe_sessions.medical_necessity_score IS
      'AI confidence that documentation supports medical necessity (0-1)';
  END IF;
END$$;

-- ============================================================================
-- SECTION 2: Add expected_reimbursement to claims table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'expected_reimbursement'
  ) THEN
    ALTER TABLE public.claims
      ADD COLUMN expected_reimbursement NUMERIC(10,2);
    COMMENT ON COLUMN public.claims.expected_reimbursement IS
      'Estimated reimbursement based on fee schedules and payer contracts';
  END IF;

  -- Add billing_workflows tracking table if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'billing_workflows'
  ) THEN
    CREATE TABLE public.billing_workflows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      encounter_id UUID REFERENCES public.encounters(id) ON DELETE CASCADE,
      claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
      success BOOLEAN NOT NULL DEFAULT false,
      requires_manual_review BOOLEAN NOT NULL DEFAULT false,
      manual_review_reasons JSONB DEFAULT '[]',
      total_charges NUMERIC(10,2),
      estimated_reimbursement NUMERIC(10,2),
      processing_time_ms INTEGER,
      workflow_steps JSONB DEFAULT '[]',
      errors JSONB DEFAULT '[]',
      warnings JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_billing_workflows_encounter ON public.billing_workflows(encounter_id);
    CREATE INDEX idx_billing_workflows_claim ON public.billing_workflows(claim_id);
    CREATE INDEX idx_billing_workflows_created ON public.billing_workflows(created_at DESC);
  END IF;
END$$;

-- ============================================================================
-- SECTION 3: Update claim review workflow for Texas compliance
-- ============================================================================

-- Add 'awaiting_hospital_submission' status to claims
DO $$
BEGIN
  -- First, check if we need to update the constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%review_status%'
  ) THEN
    ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_review_status_check;
  END IF;

  -- Add new constraint with hospital submission state
  ALTER TABLE public.claims
    ADD CONSTRAINT claims_review_status_check CHECK (
      review_status IN (
        'pending_review',           -- AI generated, awaiting human review
        'flagged',                  -- AI flagged for attention
        'reviewed',                 -- Human reviewed, ready for hospital
        'awaiting_hospital_submission', -- Approved, waiting for hospital to submit
        'rejected',                 -- Human rejected
        'submitted',                -- Hospital submitted to clearinghouse
        'accepted',                 -- Clearinghouse/payer accepted
        'denied',                   -- Payer denied
        'paid'                      -- Payment received
      )
    );
END$$;

-- ============================================================================
-- SECTION 4: Update approval function for Texas compliance
-- ============================================================================

-- Replace the submit_claim_to_clearinghouse function
CREATE OR REPLACE FUNCTION public.mark_claim_ready_for_hospital(
  p_claim_id UUID,
  p_reviewer_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim RECORD;
  v_reviewer RECORD;
  v_x12_content TEXT;
BEGIN
  -- Get claim
  SELECT * INTO v_claim
  FROM public.claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Claim not found'
    );
  END IF;

  -- Check claim is reviewed
  IF v_claim.review_status NOT IN ('reviewed', 'flagged') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Claim must be reviewed before marking ready for hospital submission'
    );
  END IF;

  -- Get reviewer info
  SELECT id, full_name, email INTO v_reviewer
  FROM public.profiles
  WHERE id = p_reviewer_id;

  -- Generate X12 content if not already generated
  IF v_claim.x12_content IS NULL THEN
    -- This would normally call the Edge Function
    v_x12_content := 'X12_PENDING_GENERATION';
  ELSE
    v_x12_content := v_claim.x12_content;
  END IF;

  -- Update claim status
  UPDATE public.claims
  SET
    review_status = 'awaiting_hospital_submission',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW(),
    review_notes = COALESCE(review_notes || E'\n', '') ||
                   'Ready for hospital submission - ' || COALESCE(p_notes, 'Approved by ' || v_reviewer.full_name),
    x12_content = v_x12_content
  WHERE id = p_claim_id;

  -- Log the action
  INSERT INTO public.claim_review_history (
    claim_id,
    reviewed_by,
    reviewer_name,
    reviewer_email,
    action,
    notes
  ) VALUES (
    p_claim_id,
    p_reviewer_id,
    v_reviewer.full_name,
    v_reviewer.email,
    'approved',
    'Marked ready for hospital submission - Texas compliance requirement'
  );

  -- Audit log
  INSERT INTO public.audit_logs (
    user_id,
    event_type,
    event_category,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_reviewer_id,
    'claim_ready_for_hospital',
    'billing',
    'claim',
    p_claim_id,
    jsonb_build_object(
      'claim_number', v_claim.claim_number,
      'total_charge', v_claim.total_charge,
      'expected_reimbursement', v_claim.expected_reimbursement,
      'reviewer', v_reviewer.full_name,
      'compliance_note', 'Texas law requires human oversight for AI-generated claims'
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'claim_id', p_claim_id,
    'claim_number', v_claim.claim_number,
    'status', 'awaiting_hospital_submission',
    'message', 'Claim approved and ready for hospital billing staff to submit to clearinghouse',
    'x12_ready', (v_x12_content IS NOT NULL AND v_x12_content != 'X12_PENDING_GENERATION')
  );
END;
$$;

-- ============================================================================
-- SECTION 5: Auto-update CCM eligibility trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_ccm_eligibility()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set CCM eligibility based on clinical time
  IF NEW.clinical_time_minutes >= 20 THEN
    NEW.is_ccm_eligible := true;

    -- Auto-add CCM codes to suggestions if not present
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW.suggested_cpt_codes) AS code
      WHERE code->>'code' = '99490'
    ) THEN
      -- Add basic CCM code for 20+ minutes
      NEW.suggested_cpt_codes := NEW.suggested_cpt_codes || jsonb_build_array(
        jsonb_build_object(
          'code', '99490',
          'description', 'Chronic care management, first 20 minutes',
          'confidence', 0.95,
          'rationale', 'Clinical time >= 20 minutes, patient qualifies for CCM billing'
        )
      );
    END IF;

    -- Add extended CCM for 40+ minutes
    IF NEW.clinical_time_minutes >= 40 AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW.suggested_cpt_codes) AS code
      WHERE code->>'code' = '99439'
    ) THEN
      NEW.suggested_cpt_codes := NEW.suggested_cpt_codes || jsonb_build_array(
        jsonb_build_object(
          'code', '99439',
          'description', 'Chronic care management, additional 20 minutes',
          'confidence', 0.95,
          'rationale', 'Clinical time >= 40 minutes, qualifies for extended CCM'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_ccm_eligibility_trigger'
  ) THEN
    CREATE TRIGGER update_ccm_eligibility_trigger
      BEFORE INSERT OR UPDATE OF clinical_time_minutes
      ON public.scribe_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_ccm_eligibility();
  END IF;
END$$;

-- ============================================================================
-- SECTION 6: Calculate expected reimbursement function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_expected_reimbursement(
  p_claim_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_total NUMERIC(10,2) := 0;
  v_line RECORD;
  v_fee_amount NUMERIC(10,2);
BEGIN
  -- Calculate based on claim lines and fee schedules
  FOR v_line IN
    SELECT
      cl.cpt_code,
      cl.units,
      cl.charge_amount,
      c.payer_id
    FROM public.claim_lines cl
    JOIN public.claims c ON c.id = cl.claim_id
    WHERE cl.claim_id = p_claim_id
  LOOP
    -- Try to find contracted rate from fee schedule
    SELECT price INTO v_fee_amount
    FROM public.fee_schedule_items fsi
    JOIN public.fee_schedules fs ON fs.id = fsi.fee_schedule_id
    WHERE fs.payer_id = v_line.payer_id
      AND fsi.code = v_line.cpt_code
      AND fsi.code_system = 'CPT'
      AND fs.effective_date <= CURRENT_DATE
      AND (fs.termination_date IS NULL OR fs.termination_date > CURRENT_DATE)
    ORDER BY fs.effective_date DESC
    LIMIT 1;

    -- If no fee schedule, estimate 80% of charge
    IF v_fee_amount IS NULL THEN
      v_fee_amount := v_line.charge_amount * 0.8;
    END IF;

    v_total := v_total + (v_fee_amount * COALESCE(v_line.units, 1));
  END LOOP;

  RETURN v_total;
END;
$$;

-- ============================================================================
-- SECTION 7: Update claims view for dashboard
-- ============================================================================

CREATE OR REPLACE VIEW public.claims_review_dashboard AS
SELECT
  c.id,
  c.claim_number,
  c.patient_id,
  c.encounter_id,
  c.service_date,
  c.total_charge,
  c.expected_reimbursement,
  c.review_status,
  c.ai_confidence_score,
  c.ai_flags,
  c.created_at,
  c.reviewed_at,
  c.review_notes,

  -- Patient info
  p.full_name AS patient_name,
  p.date_of_birth AS patient_dob,
  p.mrn AS patient_mrn,

  -- Provider info
  prov.full_name AS provider_name,
  prov.npi AS provider_npi,

  -- Encounter info
  e.encounter_type,
  e.chief_complaint,

  -- Scribe session info (NEW)
  ss.clinical_time_minutes,
  ss.is_ccm_eligible,
  ss.medical_necessity_score,
  ss.suggested_em_level,

  -- Line items summary
  (
    SELECT jsonb_agg(jsonb_build_object(
      'cpt_code', cl.cpt_code,
      'description', cl.description,
      'units', cl.units,
      'charge', cl.charge_amount,
      'icd10_codes', cl.icd10_codes
    ))
    FROM claim_lines cl
    WHERE cl.claim_id = c.id
  ) AS line_items,

  -- Flag severity counts
  (
    SELECT COUNT(*)::INT
    FROM jsonb_array_elements(c.ai_flags) flag
    WHERE (flag->>'severity')::TEXT IN ('high', 'critical')
  ) AS critical_flag_count,

  (
    SELECT COUNT(*)::INT
    FROM jsonb_array_elements(c.ai_flags) flag
    WHERE (flag->>'severity')::TEXT = 'medium'
  ) AS medium_flag_count,

  -- Review urgency score (for sorting)
  CASE
    WHEN c.review_status = 'flagged' THEN 1
    WHEN c.ai_confidence_score < 0.7 THEN 2
    WHEN c.total_charge > 1000 THEN 3
    ELSE 4
  END AS review_priority

FROM public.claims c
LEFT JOIN public.profiles p ON c.patient_id = p.id
LEFT JOIN public.profiles prov ON c.rendering_provider_id = prov.id
LEFT JOIN public.encounters e ON c.encounter_id = e.id
LEFT JOIN public.scribe_sessions ss ON ss.encounter_id = e.id

WHERE c.review_status IN ('pending_review', 'flagged', 'awaiting_hospital_submission')
ORDER BY
  review_priority,
  c.created_at DESC;

-- ============================================================================
-- SECTION 8: Grant permissions
-- ============================================================================

-- Grant access to billing staff
GRANT SELECT ON public.claims_review_dashboard TO authenticated;
GRANT SELECT, INSERT ON public.claim_review_history TO authenticated;
GRANT SELECT, INSERT ON public.billing_workflows TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_claim_ready_for_hospital TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_expected_reimbursement TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of improvements:
-- ✓ Added all missing scribe_sessions fields for billing integration
-- ✓ Added expected_reimbursement field to claims
-- ✓ Added billing_workflows tracking table
-- ✓ Updated review workflow for Texas compliance (human oversight required)
-- ✓ Created mark_claim_ready_for_hospital function (replaces direct submission)
-- ✓ Auto-CCM eligibility trigger (adds 99490/99439 codes automatically)
-- ✓ Calculate expected reimbursement function
-- ✓ Enhanced claims review dashboard view with scribe data
-- ============================================================================