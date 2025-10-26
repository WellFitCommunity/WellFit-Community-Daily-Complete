-- ============================================================================
-- DENIAL APPEAL WORKFLOW - AI-Assisted + Human Oversight
-- ============================================================================
-- Purpose: When claims are denied, AI drafts appeal letter, human reviews/submits
-- Flow: Claim denied → AI analyzes → Draft appeal → Human reviews → Submit
-- Zero Tech Debt: Complete with all workflow states and audit trail
-- ============================================================================

-- Create denial appeals table
CREATE TABLE IF NOT EXISTS public.claim_denials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,

  -- Denial details
  denial_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  denial_code TEXT NOT NULL,  -- CARC code (Claim Adjustment Reason Code)
  denial_reason TEXT NOT NULL,
  remark_code TEXT,  -- RARC code (Remittance Advice Remark Code)
  payer_response JSONB,  -- Full 835 data

  -- Appeal workflow
  appeal_status TEXT DEFAULT 'pending_review' CHECK (appeal_status IN (
    'pending_review',    -- Denial detected, AI analyzing
    'draft_ready',       -- AI drafted appeal, awaiting human review
    'human_review',      -- Human is editing/reviewing
    'ready_to_submit',   -- Human approved, ready to submit
    'submitted',         -- Appeal submitted to payer
    'approved',          -- Payer approved appeal (claim paid)
    'denied',            -- Payer denied appeal (final)
    'withdrawn'          -- We withdrew the appeal
  )),

  -- AI-generated appeal
  ai_appeal_draft TEXT,
  ai_analysis JSONB,  -- Why denied, recommended strategy, supporting evidence
  ai_confidence_score NUMERIC(3,2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 1),
  ai_success_probability NUMERIC(3,2),  -- Estimated chance of winning appeal

  -- Human review
  human_edited_appeal TEXT,  -- Final appeal after human edits
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Submission
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  submission_method TEXT CHECK (submission_method IN ('mail', 'fax', 'portal', 'email')),
  tracking_number TEXT,

  -- Outcome
  outcome_date TIMESTAMPTZ,
  outcome_decision TEXT CHECK (outcome_decision IN ('approved', 'denied', 'partial_approval')),
  recovered_amount NUMERIC(12,2),
  outcome_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT appeal_requires_reviewer CHECK (
    appeal_status NOT IN ('ready_to_submit', 'submitted') OR reviewed_by IS NOT NULL
  ),
  CONSTRAINT submitted_requires_submitter CHECK (
    appeal_status != 'submitted' OR (submitted_by IS NOT NULL AND submitted_at IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_claim_denials_claim_id ON public.claim_denials(claim_id);
CREATE INDEX idx_claim_denials_appeal_status ON public.claim_denials(appeal_status);
CREATE INDEX idx_claim_denials_denial_date ON public.claim_denials(denial_date DESC);
CREATE INDEX idx_claim_denials_pending ON public.claim_denials(appeal_status)
  WHERE appeal_status IN ('pending_review', 'draft_ready', 'human_review');

-- RLS
ALTER TABLE public.claim_denials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claim_denials_select" ON public.claim_denials;
CREATE POLICY "claim_denials_select"
  ON public.claim_denials
  FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_billing_staff(auth.uid()));

DROP POLICY IF EXISTS "claim_denials_update" ON public.claim_denials;
CREATE POLICY "claim_denials_update"
  ON public.claim_denials
  FOR UPDATE
  USING (public.is_billing_staff(auth.uid()))
  WITH CHECK (public.is_billing_staff(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER trg_claim_denials_updated_at
  BEFORE UPDATE ON public.claim_denials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- DENIAL APPEAL HISTORY (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.denial_appeal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denial_id UUID NOT NULL REFERENCES public.claim_denials(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'ai_draft_generated',
    'human_review_started',
    'appeal_edited',
    'appeal_approved',
    'appeal_submitted',
    'outcome_received',
    'withdrawn'
  )),
  changes JSONB,  -- What changed
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_denial_appeal_history_denial_id ON public.denial_appeal_history(denial_id);
CREATE INDEX idx_denial_appeal_history_created_at ON public.denial_appeal_history(created_at DESC);

ALTER TABLE public.denial_appeal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "denial_appeal_history_select" ON public.denial_appeal_history;
CREATE POLICY "denial_appeal_history_select"
  ON public.denial_appeal_history
  FOR SELECT
  USING (public.is_billing_staff(auth.uid()));

-- ============================================================================
-- FUNCTIONS FOR DENIAL WORKFLOW
-- ============================================================================

-- Function: Create denial and trigger AI analysis
CREATE OR REPLACE FUNCTION public.create_denial_from_payer_response(
  p_claim_id UUID,
  p_denial_code TEXT,
  p_denial_reason TEXT,
  p_payer_response JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_denial_id UUID;
BEGIN
  -- Create denial record
  INSERT INTO public.claim_denials (
    claim_id,
    denial_code,
    denial_reason,
    payer_response,
    appeal_status
  ) VALUES (
    p_claim_id,
    p_denial_code,
    p_denial_reason,
    p_payer_response,
    'pending_review'
  )
  RETURNING id INTO v_denial_id;

  -- Update claim status
  UPDATE public.claims
  SET
    review_status = 'denied',
    denial_reason_codes = ARRAY[p_denial_code],
    updated_at = NOW()
  WHERE id = p_claim_id;

  -- Log action
  INSERT INTO public.denial_appeal_history (
    denial_id,
    action,
    notes
  ) VALUES (
    v_denial_id,
    'ai_draft_generated',
    'Denial detected from payer response'
  );

  -- NOTE: AI appeal draft generation happens in application layer (Claude API)
  -- Application will call generate_ai_appeal_draft() via service

  RETURN v_denial_id;
END;
$$;

-- Function: Approve appeal for submission
CREATE OR REPLACE FUNCTION public.approve_denial_appeal(
  p_denial_id UUID,
  p_reviewer_id UUID,
  p_final_appeal_text TEXT,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reviewer RECORD;
  v_denial RECORD;
BEGIN
  -- Get reviewer info
  SELECT id, full_name, email INTO v_reviewer
  FROM public.profiles
  WHERE id = p_reviewer_id;

  -- Get denial info
  SELECT * INTO v_denial
  FROM public.claim_denials
  WHERE id = p_denial_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Denial not found'
    );
  END IF;

  -- Update denial
  UPDATE public.claim_denials
  SET
    appeal_status = 'ready_to_submit',
    human_edited_appeal = p_final_appeal_text,
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW(),
    review_notes = p_review_notes
  WHERE id = p_denial_id;

  -- Log review
  INSERT INTO public.denial_appeal_history (
    denial_id,
    user_id,
    user_name,
    action,
    notes
  ) VALUES (
    p_denial_id,
    p_reviewer_id,
    v_reviewer.full_name,
    'appeal_approved',
    p_review_notes
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'denial_id', p_denial_id,
    'status', 'ready_to_submit'
  );
END;
$$;

-- Function: Submit appeal
CREATE OR REPLACE FUNCTION public.submit_denial_appeal(
  p_denial_id UUID,
  p_submitter_id UUID,
  p_submission_method TEXT DEFAULT 'portal',
  p_tracking_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submitter RECORD;
  v_denial RECORD;
BEGIN
  -- Get submitter info
  SELECT id, full_name INTO v_submitter
  FROM public.profiles
  WHERE id = p_submitter_id;

  -- Get denial
  SELECT * INTO v_denial
  FROM public.claim_denials
  WHERE id = p_denial_id;

  IF v_denial.appeal_status != 'ready_to_submit' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Appeal must be reviewed and approved before submission'
    );
  END IF;

  -- Update denial
  UPDATE public.claim_denials
  SET
    appeal_status = 'submitted',
    submitted_by = p_submitter_id,
    submitted_at = NOW(),
    submission_method = p_submission_method,
    tracking_number = p_tracking_number
  WHERE id = p_denial_id;

  -- Log submission
  INSERT INTO public.denial_appeal_history (
    denial_id,
    user_id,
    user_name,
    action,
    notes
  ) VALUES (
    p_denial_id,
    p_submitter_id,
    v_submitter.full_name,
    'appeal_submitted',
    'Submitted via ' || p_submission_method
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'denial_id', p_denial_id,
    'status', 'submitted',
    'tracking_number', p_tracking_number
  );
END;
$$;

-- Function: Record appeal outcome
CREATE OR REPLACE FUNCTION public.record_appeal_outcome(
  p_denial_id UUID,
  p_outcome_decision TEXT,
  p_recovered_amount NUMERIC DEFAULT 0,
  p_outcome_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.claim_denials
  SET
    appeal_status = CASE
      WHEN p_outcome_decision = 'approved' THEN 'approved'
      ELSE 'denied'
    END,
    outcome_date = NOW(),
    outcome_decision = p_outcome_decision,
    recovered_amount = p_recovered_amount,
    outcome_notes = p_outcome_notes
  WHERE id = p_denial_id;

  -- If approved, update original claim
  IF p_outcome_decision = 'approved' THEN
    UPDATE public.claims c
    SET
      review_status = 'paid',
      payment_amount = p_recovered_amount,
      payment_date = NOW()
    FROM public.claim_denials cd
    WHERE cd.id = p_denial_id AND c.id = cd.claim_id;
  END IF;

  -- Log outcome
  INSERT INTO public.denial_appeal_history (
    denial_id,
    action,
    notes
  ) VALUES (
    p_denial_id,
    'outcome_received',
    p_outcome_decision || ': ' || COALESCE(p_outcome_notes, '')
  );
END;
$$;

-- ============================================================================
-- APPEAL DASHBOARD VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.denials_pending_appeal AS
SELECT
  cd.id as denial_id,
  cd.claim_id,
  c.claim_number,
  c.patient_id,
  p.full_name as patient_name,
  prov.full_name as provider_name,
  c.service_date,
  c.total_charge,
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
  -- Count of previous appeals
  (
    SELECT COUNT(*)
    FROM claim_denials cd2
    WHERE cd2.claim_id = cd.claim_id
  ) as appeal_count
FROM public.claim_denials cd
JOIN public.claims c ON cd.claim_id = c.id
LEFT JOIN public.profiles p ON c.patient_id = p.id
LEFT JOIN public.profiles prov ON c.rendering_provider_id = prov.id
WHERE cd.appeal_status IN ('pending_review', 'draft_ready', 'human_review', 'ready_to_submit')
ORDER BY cd.denial_date DESC;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- ✓ Created claim_denials table with full workflow states
-- ✓ Created denial_appeal_history for audit trail
-- ✓ Added functions: create_denial, approve_appeal, submit_appeal, record_outcome
-- ✓ Created denials_pending_appeal view for dashboard
-- ✓ Proper constraints (appeal requires reviewer, submitted requires submitter)
-- ✓ RLS policies for billing staff only
--
-- Zero Tech Debt: ✅ Complete implementation
-- AI drafts appeals in application layer (Claude service)
-- Human reviews and approves before submission
-- ============================================================================
