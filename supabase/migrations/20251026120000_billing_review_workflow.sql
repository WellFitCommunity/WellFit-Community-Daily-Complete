-- ============================================================================
-- BILLING REVIEW WORKFLOW - AI Automation + Human Approval
-- ============================================================================
-- Purpose: Add human review step before claim submission
-- Flow: AI generates → Billing staff reviews → Human approves → Auto-submit
-- Compliance: Prevents AI errors, maintains audit trail
-- ============================================================================

-- ============================================================================
-- SECTION 1: Add Review Status to Claims
-- ============================================================================

-- Add review workflow columns to claims table
DO $$
BEGIN
  -- Add review status (new workflow states)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'review_status'
  ) THEN
    ALTER TABLE public.claims
      ADD COLUMN review_status TEXT DEFAULT 'pending_review' CHECK (review_status IN (
        'pending_review',    -- AI generated, awaiting human review
        'flagged',           -- AI flagged for attention (low confidence, conflicts)
        'reviewed',          -- Human reviewed, ready to submit
        'rejected',          -- Human rejected (won't submit)
        'submitted',         -- Sent to clearinghouse
        'accepted',          -- Payer accepted
        'denied',            -- Payer denied
        'paid'               -- Payment received
      ));
  END IF;

  -- Track who reviewed and when
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE public.claims
      ADD COLUMN reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN reviewed_at TIMESTAMPTZ,
      ADD COLUMN review_notes TEXT;
  END IF;

  -- Track submission details
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'submitted_by'
  ) THEN
    ALTER TABLE public.claims
      ADD COLUMN submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN submitted_at TIMESTAMPTZ,
      ADD COLUMN clearinghouse_id TEXT,  -- External claim ID from clearinghouse
      ADD COLUMN clearinghouse_name TEXT; -- 'waystar', 'change_healthcare', etc.
  END IF;

  -- AI confidence and flags
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'ai_confidence_score'
  ) THEN
    ALTER TABLE public.claims
      ADD COLUMN ai_confidence_score NUMERIC(3,2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 1),
      ADD COLUMN ai_flags JSONB DEFAULT '[]',  -- Array of flag objects
      ADD COLUMN ai_suggestions JSONB DEFAULT '{}';  -- AI recommendations
  END IF;
END$$;

-- ============================================================================
-- SECTION 2: Track Claim Review History
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.claim_review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  reviewed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  reviewer_email TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'approved',           -- Billing staff approved for submission
    'rejected',           -- Billing staff rejected
    'edited_codes',       -- Changed CPT/ICD-10 codes
    'edited_units',       -- Changed units/quantities
    'edited_modifiers',   -- Changed modifiers
    'added_note',         -- Added review note
    'flagged',            -- Flagged for senior review
    'unflagged'           -- Removed flag
  )),
  changes JSONB,  -- What changed (old value → new value)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_review_history_claim_id
  ON public.claim_review_history(claim_id);
CREATE INDEX idx_claim_review_history_reviewed_by
  ON public.claim_review_history(reviewed_by);
CREATE INDEX idx_claim_review_history_created_at
  ON public.claim_review_history(created_at DESC);

-- RLS for claim review history
ALTER TABLE public.claim_review_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claim_review_history_select" ON public.claim_review_history;
CREATE POLICY "claim_review_history_select"
  ON public.claim_review_history
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "claim_review_history_insert" ON public.claim_review_history;
CREATE POLICY "claim_review_history_insert"
  ON public.claim_review_history
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- SECTION 3: AI Flag Types (What Could Go Wrong)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.claim_flag_types (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  auto_reject BOOLEAN DEFAULT FALSE,  -- If true, claim can't be submitted without override
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert standard flag types
INSERT INTO public.claim_flag_types (code, name, description, severity, auto_reject) VALUES
  ('LOW_CONFIDENCE', 'Low AI Confidence', 'AI confidence score < 0.7 for code suggestions', 'medium', FALSE),
  ('MISSING_DIAGNOSIS', 'Missing Diagnosis Code', 'No ICD-10 code for billed CPT code', 'high', TRUE),
  ('MEDICAL_NECESSITY', 'Medical Necessity Question', 'Diagnosis may not support level of service', 'high', FALSE),
  ('DUPLICATE_SERVICE', 'Possible Duplicate Service', 'Similar service billed recently for same patient', 'medium', FALSE),
  ('BUNDLING_ISSUE', 'Bundling/Unbundling Issue', 'Codes may be bundled by payer (CCI edits)', 'high', FALSE),
  ('MODIFIER_MISSING', 'Missing Required Modifier', 'Service requires modifier (e.g., GT for telehealth)', 'medium', FALSE),
  ('UNITS_EXCEED_MAX', 'Units Exceed Maximum', 'Units exceed typical maximum for service', 'medium', FALSE),
  ('OUTLIER_CHARGE', 'Charge Amount Outlier', 'Charge amount significantly different from fee schedule', 'low', FALSE),
  ('UNLICENSED_PROVIDER', 'Provider Not Licensed', 'Rendering provider missing license or NPI', 'critical', TRUE),
  ('PATIENT_NOT_ELIGIBLE', 'Patient Eligibility Issue', 'Patient may not be eligible for service date', 'high', FALSE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SECTION 4: Billing Review Dashboard View
-- ============================================================================

CREATE OR REPLACE VIEW public.claims_pending_review AS
SELECT
  c.id,
  c.claim_number,
  c.patient_id,
  c.encounter_id,
  c.service_date,
  c.total_charge,
  c.review_status,
  c.ai_confidence_score,
  c.ai_flags,
  c.created_at,

  -- Patient info
  p.full_name AS patient_name,
  p.date_of_birth AS patient_dob,

  -- Provider info
  prov.full_name AS provider_name,

  -- Encounter info
  e.encounter_type,
  e.chief_complaint,

  -- Line items summary
  (
    SELECT json_agg(json_build_object(
      'cpt_code', cl.cpt_code,
      'description', cl.description,
      'units', cl.units,
      'charge', cl.charge_amount,
      'icd10_codes', cl.icd10_codes
    ))
    FROM claim_lines cl
    WHERE cl.claim_id = c.id
  ) AS line_items,

  -- Flag count
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(c.ai_flags) flag
    WHERE (flag->>'severity')::TEXT IN ('high', 'critical')
  ) AS critical_flag_count,

  -- Expected reimbursement
  c.expected_reimbursement

FROM public.claims c
LEFT JOIN public.profiles p ON c.patient_id = p.id
LEFT JOIN public.profiles prov ON c.rendering_provider_id = prov.id
LEFT JOIN public.encounters e ON c.encounter_id = e.id

WHERE c.review_status IN ('pending_review', 'flagged')
ORDER BY
  CASE WHEN c.review_status = 'flagged' THEN 0 ELSE 1 END,  -- Flagged first
  c.created_at DESC;

-- ============================================================================
-- SECTION 5: Functions for Billing Workflow
-- ============================================================================

-- Function: Flag a claim for review
CREATE OR REPLACE FUNCTION public.flag_claim_for_review(
  p_claim_id UUID,
  p_flag_code TEXT,
  p_flag_details JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_flag_type RECORD;
  v_existing_flags JSONB;
BEGIN
  -- Get flag type info
  SELECT * INTO v_flag_type
  FROM public.claim_flag_types
  WHERE code = p_flag_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid flag code: %', p_flag_code;
  END IF;

  -- Get existing flags
  SELECT COALESCE(ai_flags, '[]'::jsonb) INTO v_existing_flags
  FROM public.claims
  WHERE id = p_claim_id;

  -- Add new flag
  UPDATE public.claims
  SET
    ai_flags = v_existing_flags || jsonb_build_array(
      jsonb_build_object(
        'code', p_flag_code,
        'name', v_flag_type.name,
        'severity', v_flag_type.severity,
        'details', p_flag_details,
        'flagged_at', NOW()
      )
    ),
    review_status = CASE
      WHEN v_flag_type.severity IN ('high', 'critical') THEN 'flagged'
      ELSE review_status
    END
  WHERE id = p_claim_id;
END;
$$;

-- Function: Approve claim for submission
CREATE OR REPLACE FUNCTION public.approve_claim(
  p_claim_id UUID,
  p_reviewer_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim RECORD;
  v_reviewer RECORD;
  v_result JSONB;
BEGIN
  -- Get claim info
  SELECT * INTO v_claim
  FROM public.claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found: %', p_claim_id;
  END IF;

  -- Get reviewer info
  SELECT id, full_name, email INTO v_reviewer
  FROM public.profiles
  WHERE id = p_reviewer_id;

  -- Check for auto-reject flags
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_claim.ai_flags) flag
    JOIN claim_flag_types ft ON (flag->>'code')::TEXT = ft.code
    WHERE ft.auto_reject = TRUE
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Claim has critical flags that require resolution before approval'
    );
  END IF;

  -- Update claim status
  UPDATE public.claims
  SET
    review_status = 'reviewed',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW(),
    review_notes = p_review_notes
  WHERE id = p_claim_id;

  -- Log review action
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
    p_review_notes
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
    'claim_approved',
    'billing',
    'claim',
    p_claim_id,
    jsonb_build_object(
      'claim_number', v_claim.claim_number,
      'total_charge', v_claim.total_charge,
      'reviewer', v_reviewer.full_name
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'claim_id', p_claim_id,
    'claim_number', v_claim.claim_number,
    'status', 'reviewed'
  );
END;
$$;

-- Function: Reject claim
CREATE OR REPLACE FUNCTION public.reject_claim(
  p_claim_id UUID,
  p_reviewer_id UUID,
  p_rejection_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reviewer RECORD;
BEGIN
  -- Get reviewer info
  SELECT id, full_name, email INTO v_reviewer
  FROM public.profiles
  WHERE id = p_reviewer_id;

  -- Update claim
  UPDATE public.claims
  SET
    review_status = 'rejected',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW(),
    review_notes = p_rejection_reason
  WHERE id = p_claim_id;

  -- Log rejection
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
    'rejected',
    p_rejection_reason
  );
END;
$$;

-- Function: Submit approved claim to clearinghouse
CREATE OR REPLACE FUNCTION public.submit_claim_to_clearinghouse(
  p_claim_id UUID,
  p_submitter_id UUID,
  p_clearinghouse_name TEXT DEFAULT 'waystar'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim RECORD;
  v_result JSONB;
BEGIN
  -- Get claim
  SELECT * INTO v_claim
  FROM public.claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found: %', p_claim_id;
  END IF;

  -- Check claim is approved
  IF v_claim.review_status != 'reviewed' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Claim must be reviewed and approved before submission'
    );
  END IF;

  -- Update claim (actual clearinghouse API call would happen in application layer)
  UPDATE public.claims
  SET
    review_status = 'submitted',
    submitted_by = p_submitter_id,
    submitted_at = NOW(),
    clearinghouse_name = p_clearinghouse_name
  WHERE id = p_claim_id;

  -- Log submission
  INSERT INTO public.claim_review_history (
    claim_id,
    reviewed_by,
    action,
    notes
  ) VALUES (
    p_claim_id,
    p_submitter_id,
    'approved',
    'Submitted to ' || p_clearinghouse_name
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'claim_id', p_claim_id,
    'status', 'submitted',
    'clearinghouse', p_clearinghouse_name
  );
END;
$$;

-- ============================================================================
-- SECTION 6: Billing Staff Permissions
-- ============================================================================

-- Add billing_staff role check
CREATE OR REPLACE FUNCTION public.is_billing_staff(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id
      AND (
        role IN ('admin', 'super_admin', 'billing_specialist', 'billing_manager')
        OR role_code IN (1, 2)  -- Admin roles
      )
  );
END;
$$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- ✓ Added review workflow to claims (pending_review → reviewed → submitted)
-- ✓ Created claim_review_history table (audit trail)
-- ✓ Added AI confidence scores and flags
-- ✓ Created standard flag types (10 common issues)
-- ✓ Created billing review dashboard view
-- ✓ Added functions: approve_claim, reject_claim, submit_claim
-- ✓ Added billing_staff role check
--
-- Next Steps (Application Layer):
-- 1. Build billing review UI (React component)
-- 2. Integrate clearinghouse API (Waystar/Change Healthcare)
-- 3. Add real-time notifications for billing staff
-- ============================================================================
