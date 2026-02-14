-- Result Acknowledgments — tracks clinician review of diagnostic reports
-- Supports the Unacknowledged Results Dashboard (P2 Clinical Safety)
-- Immutable audit records: no UPDATE or DELETE allowed

BEGIN;

-- ============================================================================
-- RESULT ACKNOWLEDGMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.result_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which report was acknowledged
  report_id UUID NOT NULL REFERENCES public.fhir_diagnostic_reports(id) ON DELETE CASCADE,

  -- Who acknowledged it
  acknowledged_by UUID NOT NULL REFERENCES auth.users(id),

  -- When
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- How it was acknowledged
  acknowledgment_type TEXT NOT NULL CHECK (acknowledgment_type IN (
    'read_only', 'reviewed', 'action_taken', 'escalated'
  )),

  -- Optional clinical notes
  notes TEXT,

  -- Multi-tenancy
  tenant_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookup: has this report been acknowledged?
CREATE UNIQUE INDEX IF NOT EXISTS idx_result_ack_report_id
  ON public.result_acknowledgments(report_id);

-- Who acknowledged what
CREATE INDEX IF NOT EXISTS idx_result_ack_acknowledged_by
  ON public.result_acknowledgments(acknowledged_by);

-- Tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_result_ack_tenant_id
  ON public.result_acknowledgments(tenant_id)
  WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.result_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Staff can view all acknowledgments
DROP POLICY IF EXISTS "result_ack_staff_select" ON public.result_acknowledgments;
CREATE POLICY "result_ack_staff_select"
  ON public.result_acknowledgments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'doctor', 'nurse', 'lab_tech')
    )
  );

-- Staff can insert acknowledgments (immutable — no UPDATE/DELETE)
DROP POLICY IF EXISTS "result_ack_staff_insert" ON public.result_acknowledgments;
CREATE POLICY "result_ack_staff_insert"
  ON public.result_acknowledgments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'doctor', 'nurse', 'lab_tech')
    )
  );

-- ============================================================================
-- VIEW: Unacknowledged Results with Aging Status
-- ============================================================================
CREATE OR REPLACE VIEW public.v_unacknowledged_results
WITH (security_invoker = on)
AS
SELECT
  dr.id,
  dr.patient_id,
  p.first_name,
  p.last_name,
  dr.code_display,
  dr.category,
  dr.status,
  dr.report_priority,
  dr.issued,
  dr.conclusion,
  p.tenant_id,
  EXTRACT(EPOCH FROM (NOW() - dr.issued)) / 3600 AS hours_since_issued,
  CASE
    WHEN dr.report_priority = 'stat'
      AND (NOW() - dr.issued) > INTERVAL '1 hour'
      THEN 'critical'
    WHEN dr.report_priority IN ('urgent', 'asap')
      AND (NOW() - dr.issued) > INTERVAL '4 hours'
      THEN 'critical'
    WHEN (NOW() - dr.issued) > INTERVAL '24 hours'
      THEN 'overdue'
    WHEN (NOW() - dr.issued) > INTERVAL '8 hours'
      THEN 'warning'
    ELSE 'normal'
  END AS aging_status
FROM public.fhir_diagnostic_reports dr
LEFT JOIN public.result_acknowledgments ra ON ra.report_id = dr.id
JOIN public.profiles p ON p.user_id = dr.patient_id
WHERE ra.id IS NULL
  AND dr.status IN ('final', 'amended', 'corrected', 'preliminary');

COMMIT;
