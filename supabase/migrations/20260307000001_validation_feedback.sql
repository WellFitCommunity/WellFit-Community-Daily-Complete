-- =====================================================
-- Validation Feedback Table — Learning Loop
-- Purpose: Records biller/coder decisions on flagged codes.
--   confirm_invalid = AI hallucinated, validator caught it
--   confirm_valid = validator false positive (reference data gap)
-- Feeds accuracy metrics: hallucination catch rate, false positive rate.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.validation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  code_system TEXT NOT NULL,
  source_function TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('confirm_invalid', 'confirm_valid')),
  reviewed_by UUID NOT NULL REFERENCES auth.users(id),
  reviewer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.validation_feedback ENABLE ROW LEVEL SECURITY;

-- Admins and clinical staff can read all feedback
CREATE POLICY "validation_feedback_read" ON public.validation_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'healthcare_provider', 'case_manager')
    )
  );

-- Authenticated users can insert feedback (billers, coders, providers)
CREATE POLICY "validation_feedback_insert" ON public.validation_feedback
  FOR INSERT WITH CHECK (reviewed_by = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_validation_feedback_code ON public.validation_feedback(code, code_system);
CREATE INDEX IF NOT EXISTS idx_validation_feedback_decision ON public.validation_feedback(decision);
CREATE INDEX IF NOT EXISTS idx_validation_feedback_source ON public.validation_feedback(source_function);
CREATE INDEX IF NOT EXISTS idx_validation_feedback_created ON public.validation_feedback(created_at);

COMMENT ON TABLE public.validation_feedback IS 'Learning loop: biller/coder feedback on AI code validation flags. confirm_invalid = true catch, confirm_valid = false positive.';
