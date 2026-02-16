-- Migration: Referral Specialist Completion Workflow
-- Phase 1 Category 4: Closes the specialist confirmation gap
--
-- Adds: completion columns on patient_referrals, new follow_up_reason value,
--        3 RPC functions (record, query, stats)

-- =============================================================================
-- A. Add specialist completion columns to patient_referrals
-- =============================================================================

ALTER TABLE patient_referrals
  ADD COLUMN IF NOT EXISTS specialist_completion_status TEXT
    DEFAULT 'awaiting'
    CHECK (specialist_completion_status IN ('awaiting', 'confirmed', 'overdue')),
  ADD COLUMN IF NOT EXISTS specialist_name TEXT,
  ADD COLUMN IF NOT EXISTS specialist_completion_date DATE,
  ADD COLUMN IF NOT EXISTS specialist_report TEXT,
  ADD COLUMN IF NOT EXISTS specialist_recommendations TEXT,
  ADD COLUMN IF NOT EXISTS specialist_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS specialist_confirmed_by UUID REFERENCES auth.users(id);

-- Index for dashboard queries filtering by completion status
CREATE INDEX IF NOT EXISTS idx_patient_referrals_specialist_status
  ON patient_referrals(specialist_completion_status);

COMMENT ON COLUMN patient_referrals.specialist_completion_status IS 'Specialist confirmation state: awaiting (default), confirmed, or overdue (14+ days)';
COMMENT ON COLUMN patient_referrals.specialist_confirmed_by IS 'Staff member who recorded the specialist completion';


-- =============================================================================
-- B. Expand referral_follow_up_log CHECK to include specialist_completion_recorded
-- =============================================================================

-- Drop and recreate the CHECK constraint to add the new reason value
ALTER TABLE referral_follow_up_log
  DROP CONSTRAINT IF EXISTS referral_follow_up_log_follow_up_reason_check;

ALTER TABLE referral_follow_up_log
  ADD CONSTRAINT referral_follow_up_log_follow_up_reason_check
  CHECK (follow_up_reason IN (
    'pending_no_response',
    'enrolled_no_activity',
    'active_gone_dormant',
    'specialist_no_confirmation',
    'specialist_completion_recorded'
  ));


-- =============================================================================
-- C. record_specialist_completion — records specialist work completion
-- =============================================================================

CREATE OR REPLACE FUNCTION record_specialist_completion(
  p_referral_id UUID,
  p_specialist_name TEXT,
  p_completion_date DATE,
  p_report TEXT DEFAULT NULL,
  p_recommendations TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
  v_referral RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Verify caller has appropriate role
  SELECT ur.role INTO v_caller_role
  FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin', 'nurse', 'case_manager')
  LIMIT 1;

  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: requires admin, nurse, or case_manager role'
    );
  END IF;

  -- 2. Validate referral exists and is in confirmable state
  SELECT id, status, specialist_completion_status, tenant_id
  INTO v_referral
  FROM patient_referrals
  WHERE id = p_referral_id;

  IF v_referral IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral not found');
  END IF;

  IF v_referral.status NOT IN ('active', 'enrolled') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Referral must be active or enrolled to record completion'
    );
  END IF;

  IF v_referral.specialist_completion_status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Specialist completion already recorded for this referral'
    );
  END IF;

  -- 3. Update patient_referrals with completion data
  UPDATE patient_referrals
  SET
    specialist_completion_status = 'confirmed',
    specialist_name = p_specialist_name,
    specialist_completion_date = p_completion_date,
    specialist_report = p_report,
    specialist_recommendations = p_recommendations,
    specialist_confirmed_at = v_now,
    specialist_confirmed_by = auth.uid(),
    updated_at = v_now
  WHERE id = p_referral_id;

  -- 4. Insert audit entry into referral_follow_up_log (SECURITY DEFINER bypasses service_role-only RLS)
  INSERT INTO referral_follow_up_log (
    referral_id,
    referral_source_id,
    follow_up_type,
    follow_up_reason,
    aging_days,
    delivery_status,
    tenant_id
  ) VALUES (
    p_referral_id,
    v_referral.referral_source_id,
    'provider_task',
    'specialist_completion_recorded',
    EXTRACT(DAY FROM v_now - (SELECT created_at FROM patient_referrals WHERE id = p_referral_id))::INTEGER,
    'delivered',
    v_referral.tenant_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'referral_id', p_referral_id,
    'confirmed_at', v_now,
    'confirmed_by', auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION record_specialist_completion IS 'Records specialist completion for a referral. Requires admin/nurse/case_manager role. Inserts audit trail.';


-- =============================================================================
-- D. get_referrals_awaiting_confirmation — dashboard query
-- =============================================================================

CREATE OR REPLACE FUNCTION get_referrals_awaiting_confirmation(
  p_tenant_id UUID DEFAULT NULL,
  p_overdue_threshold_days INTEGER DEFAULT 14
)
RETURNS TABLE (
  referral_id           UUID,
  referral_source_id    UUID,
  source_org_name       TEXT,
  patient_first_name    TEXT,
  patient_last_name     TEXT,
  referral_status       TEXT,
  referral_reason       TEXT,
  created_at            TIMESTAMPTZ,
  days_waiting          INTEGER,
  specialist_completion_status TEXT,
  specialist_name       TEXT,
  specialist_completion_date DATE,
  specialist_confirmed_at TIMESTAMPTZ,
  tenant_id             UUID
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    pr.id AS referral_id,
    pr.referral_source_id,
    ers.organization_name AS source_org_name,
    pr.patient_first_name,
    pr.patient_last_name,
    pr.status AS referral_status,
    pr.referral_reason,
    pr.created_at,
    EXTRACT(DAY FROM NOW() - pr.created_at)::INTEGER AS days_waiting,
    COALESCE(pr.specialist_completion_status, 'awaiting') AS specialist_completion_status,
    pr.specialist_name,
    pr.specialist_completion_date,
    pr.specialist_confirmed_at,
    pr.tenant_id
  FROM patient_referrals pr
  LEFT JOIN external_referral_sources ers ON ers.id = pr.referral_source_id
  WHERE pr.status IN ('active', 'enrolled')
    AND (p_tenant_id IS NULL OR pr.tenant_id = p_tenant_id)
  ORDER BY
    -- Overdue first, then awaiting by age, then confirmed
    CASE
      WHEN COALESCE(pr.specialist_completion_status, 'awaiting') = 'awaiting'
        AND EXTRACT(DAY FROM NOW() - pr.created_at) >= p_overdue_threshold_days
      THEN 0
      WHEN COALESCE(pr.specialist_completion_status, 'awaiting') = 'awaiting'
      THEN 1
      ELSE 2
    END,
    EXTRACT(DAY FROM NOW() - pr.created_at) DESC;
$$;

COMMENT ON FUNCTION get_referrals_awaiting_confirmation IS 'Returns referrals awaiting specialist confirmation, ordered by urgency (overdue first).';


-- =============================================================================
-- E. get_referral_completion_stats — dashboard KPI metrics
-- =============================================================================

CREATE OR REPLACE FUNCTION get_referral_completion_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_awaiting      BIGINT,
  total_overdue       BIGINT,
  confirmed_this_month BIGINT,
  avg_days_to_confirm NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE COALESCE(pr.specialist_completion_status, 'awaiting') = 'awaiting'
    ) AS total_awaiting,
    COUNT(*) FILTER (
      WHERE COALESCE(pr.specialist_completion_status, 'awaiting') = 'awaiting'
        AND EXTRACT(DAY FROM NOW() - pr.created_at) >= 14
    ) AS total_overdue,
    COUNT(*) FILTER (
      WHERE pr.specialist_completion_status = 'confirmed'
        AND pr.specialist_confirmed_at >= date_trunc('month', NOW())
    ) AS confirmed_this_month,
    ROUND(AVG(
      CASE WHEN pr.specialist_completion_status = 'confirmed'
        THEN EXTRACT(DAY FROM pr.specialist_confirmed_at - pr.created_at)
      END
    ), 1) AS avg_days_to_confirm
  FROM patient_referrals pr
  WHERE pr.status IN ('active', 'enrolled')
    AND (p_tenant_id IS NULL OR pr.tenant_id = p_tenant_id);
$$;

COMMENT ON FUNCTION get_referral_completion_stats IS 'Dashboard KPIs: awaiting count, overdue count, confirmed this month, avg days to confirm.';
