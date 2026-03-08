-- =====================================================
-- Validation Hook Results — Aggregate Tracking
-- Purpose: Records every validation run across all AI edge
-- functions. Powers the admin dashboard: rejection rates,
-- top hallucinated codes, reference data coverage.
--
-- Companion to validation_feedback (learning loop).
-- This table stores the VALIDATOR'S decision.
-- validation_feedback stores the HUMAN'S review of that decision.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.validation_hook_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_function TEXT NOT NULL,
  patient_id UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id),
  codes_checked INTEGER NOT NULL DEFAULT 0,
  codes_validated INTEGER NOT NULL DEFAULT 0,
  codes_rejected INTEGER NOT NULL DEFAULT 0,
  codes_suppressed INTEGER NOT NULL DEFAULT 0,
  rejected_details JSONB DEFAULT '[]'::jsonb,
  validation_method TEXT NOT NULL DEFAULT 'local_cache',
  response_time_ms INTEGER NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE public.validation_hook_results ENABLE ROW LEVEL SECURITY;

-- Admins can read all results (for dashboard)
CREATE POLICY "validation_hook_results_admin_read" ON public.validation_hook_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Service role inserts (edge functions use service role client)
-- No INSERT policy needed — edge functions use service role which bypasses RLS

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_vhr_source_function ON public.validation_hook_results(source_function);
CREATE INDEX IF NOT EXISTS idx_vhr_created_at ON public.validation_hook_results(created_at);
CREATE INDEX IF NOT EXISTS idx_vhr_rejected ON public.validation_hook_results(codes_rejected) WHERE codes_rejected > 0;
CREATE INDEX IF NOT EXISTS idx_vhr_tenant ON public.validation_hook_results(tenant_id);

COMMENT ON TABLE public.validation_hook_results IS 'Aggregate validation results for every AI edge function run. Powers the clinical validation dashboard — rejection rates, hallucination trends, reference data coverage.';
