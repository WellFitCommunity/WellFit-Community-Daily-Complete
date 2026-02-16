-- Migration: Add resubmission tracking columns to claims
-- Purpose: Enable correction chains — corrected claims reference their parent,
--          resubmission_count tracks depth of correction chain.

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS parent_claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resubmission_count INTEGER NOT NULL DEFAULT 0 CHECK (resubmission_count >= 0);

CREATE INDEX IF NOT EXISTS idx_claims_parent_claim ON public.claims(parent_claim_id) WHERE parent_claim_id IS NOT NULL;
