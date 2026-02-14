-- Superbill Provider Sign-Off Gate — Phase 2 P1 (Clinical Revenue Build Tracker)
-- Adds approval columns to claims table + enforcement trigger
-- Providers must approve superbills before submission to clearinghouse

BEGIN;

-- ============================================================================
-- ALTER CLAIMS TABLE: Add approval columns
-- ============================================================================

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'returned', 'not_required')),
  ADD COLUMN IF NOT EXISTS provider_approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS provider_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Pending approval queue
CREATE INDEX IF NOT EXISTS idx_claims_approval_status
  ON public.claims(approval_status)
  WHERE approval_status = 'pending';

-- Approver lookup
CREATE INDEX IF NOT EXISTS idx_claims_approved_by
  ON public.claims(provider_approved_by)
  WHERE provider_approved_by IS NOT NULL;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Atomic superbill approval
CREATE OR REPLACE FUNCTION public.approve_superbill(
  p_claim_id UUID,
  p_provider_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim RECORD;
BEGIN
  -- Lock the claim row
  SELECT id, status, approval_status
  INTO v_claim
  FROM public.claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found: %', p_claim_id;
  END IF;

  -- Must be in generated status (not yet submitted)
  IF v_claim.status NOT IN ('generated') THEN
    RAISE EXCEPTION 'Claim must be in generated status to approve. Current: %', v_claim.status;
  END IF;

  -- Must be pending approval
  IF v_claim.approval_status NOT IN ('pending', 'returned') THEN
    RAISE EXCEPTION 'Claim approval status must be pending or returned. Current: %', v_claim.approval_status;
  END IF;

  -- Apply approval
  UPDATE public.claims
  SET
    approval_status = 'approved',
    provider_approved_by = p_provider_id,
    provider_approved_at = NOW(),
    approval_notes = p_notes,
    updated_at = NOW()
  WHERE id = p_claim_id;

  RETURN jsonb_build_object(
    'claim_id', p_claim_id,
    'approved_by', p_provider_id,
    'approved_at', NOW()
  );
END;
$$;

-- Return superbill for revision
CREATE OR REPLACE FUNCTION public.reject_superbill(
  p_claim_id UUID,
  p_provider_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim RECORD;
BEGIN
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Rejection reason must be at least 10 characters';
  END IF;

  SELECT id, status, approval_status
  INTO v_claim
  FROM public.claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found: %', p_claim_id;
  END IF;

  IF v_claim.status NOT IN ('generated') THEN
    RAISE EXCEPTION 'Claim must be in generated status to return. Current: %', v_claim.status;
  END IF;

  -- Mark as returned
  UPDATE public.claims
  SET
    approval_status = 'returned',
    provider_approved_by = NULL,
    provider_approved_at = NULL,
    approval_notes = p_reason,
    updated_at = NOW()
  WHERE id = p_claim_id;

  RETURN jsonb_build_object(
    'claim_id', p_claim_id,
    'returned_by', p_provider_id,
    'reason', p_reason
  );
END;
$$;

-- ============================================================================
-- TRIGGER: Enforce superbill approval before submission (defense-in-depth)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_superbill_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only enforce when status changes TO 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status <> 'submitted') THEN
    -- Check approval_status
    IF NEW.approval_status <> 'approved' THEN
      RAISE EXCEPTION 'Cannot submit claim without provider approval. approval_status = %', NEW.approval_status;
    END IF;

    -- Check provider_approved_by is set
    IF NEW.provider_approved_by IS NULL THEN
      RAISE EXCEPTION 'Cannot submit claim: provider_approved_by is required';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_superbill_approval ON public.claims;
CREATE TRIGGER trg_enforce_superbill_approval
  BEFORE UPDATE ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_superbill_approval();

COMMIT;
