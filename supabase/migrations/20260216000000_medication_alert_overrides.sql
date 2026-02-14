-- Medication Alert Override Logging — Phase 1 P4 (Clinical Revenue Build Tracker)
-- Immutable audit table for provider overrides of medication safety alerts
-- INSERT-only (no DELETE), UPDATE restricted to manager review columns only
-- Pattern: result_acknowledgments (20260214100000) + handoff_emergency_bypass (20251018120000)

BEGIN;

-- ============================================================================
-- MEDICATION ALERT OVERRIDES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.medication_alert_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'contraindication', 'drug_interaction', 'allergy'
  )),
  alert_severity TEXT NOT NULL CHECK (alert_severity IN (
    'contraindicated', 'high', 'moderate', 'low'
  )),
  alert_description TEXT NOT NULL,
  alert_recommendations TEXT[] NOT NULL DEFAULT '{}',

  -- Optional FK to ai_contraindication_checks for traceability
  check_id UUID REFERENCES public.ai_contraindication_checks(id),

  -- Medication being overridden
  medication_name TEXT NOT NULL,
  medication_rxcui TEXT,

  -- Who overrode
  provider_id UUID NOT NULL REFERENCES auth.users(id),
  provider_signature TEXT NOT NULL,

  -- Patient affected
  patient_id UUID NOT NULL REFERENCES auth.users(id),

  -- Override justification
  override_reason TEXT NOT NULL CHECK (override_reason IN (
    'clinical_judgment',
    'patient_specific_exception',
    'documented_tolerance',
    'informed_consent',
    'palliative_care',
    'monitoring_plan',
    'other'
  )),
  override_explanation TEXT NOT NULL CHECK (char_length(override_explanation) >= 20),

  -- Manager review (UPDATE-only columns)
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_decision TEXT CHECK (review_decision IN ('acknowledged', 'flagged', 'resolved')),
  review_notes TEXT,

  -- Multi-tenancy
  tenant_id UUID,

  -- Immutable timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Provider override history
CREATE INDEX IF NOT EXISTS idx_med_override_provider_id
  ON public.medication_alert_overrides(provider_id);

-- Patient override history
CREATE INDEX IF NOT EXISTS idx_med_override_patient_id
  ON public.medication_alert_overrides(patient_id);

-- Weekly count query: provider overrides in last 7 days
CREATE INDEX IF NOT EXISTS idx_med_override_provider_created
  ON public.medication_alert_overrides(provider_id, created_at DESC);

-- Tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_med_override_tenant_id
  ON public.medication_alert_overrides(tenant_id)
  WHERE tenant_id IS NOT NULL;

-- Unreviewed overrides
CREATE INDEX IF NOT EXISTS idx_med_override_unreviewed
  ON public.medication_alert_overrides(created_at DESC)
  WHERE reviewed_by IS NULL;

-- Severity-based queries
CREATE INDEX IF NOT EXISTS idx_med_override_severity
  ON public.medication_alert_overrides(alert_severity, created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get provider override count in last 7 days
CREATE OR REPLACE FUNCTION public.get_provider_override_count_last_7_days(
  p_provider_id UUID
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.medication_alert_overrides
  WHERE provider_id = p_provider_id
    AND created_at >= NOW() - INTERVAL '7 days';
$$;

-- Get providers with 3+ overrides in 7 days (flagged for review)
CREATE OR REPLACE FUNCTION public.get_flagged_override_providers()
RETURNS TABLE (
  provider_id UUID,
  override_count INTEGER,
  latest_override TIMESTAMPTZ,
  severities TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    mo.provider_id,
    COUNT(*)::INTEGER AS override_count,
    MAX(mo.created_at) AS latest_override,
    ARRAY_AGG(DISTINCT mo.alert_severity) AS severities
  FROM public.medication_alert_overrides mo
  WHERE mo.created_at >= NOW() - INTERVAL '7 days'
  GROUP BY mo.provider_id
  HAVING COUNT(*) >= 3
  ORDER BY COUNT(*) DESC;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.medication_alert_overrides ENABLE ROW LEVEL SECURITY;

-- Providers can see their own overrides
DROP POLICY IF EXISTS "med_override_provider_select" ON public.medication_alert_overrides;
CREATE POLICY "med_override_provider_select"
  ON public.medication_alert_overrides FOR SELECT
  USING (provider_id = auth.uid());

-- Admins/managers can see all overrides
DROP POLICY IF EXISTS "med_override_admin_select" ON public.medication_alert_overrides;
CREATE POLICY "med_override_admin_select"
  ON public.medication_alert_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse_manager', 'physician')
    )
  );

-- Clinical staff can insert overrides
DROP POLICY IF EXISTS "med_override_staff_insert" ON public.medication_alert_overrides;
CREATE POLICY "med_override_staff_insert"
  ON public.medication_alert_overrides FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'physician', 'nurse', 'pharmacist', 'pa', 'np')
    )
  );

-- Only admins/managers can update (review columns only)
DROP POLICY IF EXISTS "med_override_admin_update" ON public.medication_alert_overrides;
CREATE POLICY "med_override_admin_update"
  ON public.medication_alert_overrides FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse_manager')
    )
  );

-- NO DELETE POLICY — immutable audit records

COMMIT;
