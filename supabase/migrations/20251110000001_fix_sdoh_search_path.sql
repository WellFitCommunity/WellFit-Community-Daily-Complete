-- ============================================================================
-- Fix SDOH Functions - Add search_path Parameter
-- Resolves: "search path parameter not set" warning in Supabase
-- ============================================================================

BEGIN;

-- Drop existing functions
DROP FUNCTION IF EXISTS calculate_sdoh_risk_score(UUID);
DROP FUNCTION IF EXISTS get_high_risk_sdoh_count(UUID);
DROP FUNCTION IF EXISTS update_sdoh_updated_at();

-- ============================================================================
-- Function to calculate SDOH risk score for a patient
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_sdoh_risk_score(p_patient_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_risk_score INTEGER;
BEGIN
  WITH risk_weights AS (
    SELECT
      CASE risk_level
        WHEN 'critical' THEN 100
        WHEN 'high' THEN 75
        WHEN 'moderate' THEN 50
        WHEN 'low' THEN 25
        WHEN 'none' THEN 0
        ELSE 0
      END AS weight,
      COALESCE(priority_level, 1) AS priority
    FROM public.sdoh_observations
    WHERE patient_id = p_patient_id
      AND status = 'final'
  )
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((SUM(weight * priority)::DECIMAL / SUM(priority * 100)) * 100)
    END::INTEGER
  INTO v_risk_score
  FROM risk_weights;

  RETURN COALESCE(v_risk_score, 0);
END;
$$;

-- ============================================================================
-- Function to get high-risk SDOH count
-- ============================================================================
CREATE OR REPLACE FUNCTION get_high_risk_sdoh_count(p_patient_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO v_count
  FROM public.sdoh_observations
  WHERE patient_id = p_patient_id
    AND risk_level IN ('high', 'critical')
    AND status = 'final';

  RETURN COALESCE(v_count, 0);
END;
$$;

-- ============================================================================
-- Function to update SDOH observation timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_sdoh_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Re-grant function execution permissions
GRANT EXECUTE ON FUNCTION calculate_sdoh_risk_score(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_high_risk_sdoh_count(UUID) TO authenticated;

-- Add comments
COMMENT ON FUNCTION calculate_sdoh_risk_score(UUID) IS 'Calculates weighted overall SDOH risk score (0-100) for a patient. Security: search_path set to prevent schema injection.';
COMMENT ON FUNCTION get_high_risk_sdoh_count(UUID) IS 'Returns count of high/critical SDOH factors for a patient. Security: search_path set to prevent schema injection.';
COMMENT ON FUNCTION update_sdoh_updated_at() IS 'Trigger function to auto-update updated_at timestamp. Security: search_path set to prevent schema injection.';

COMMIT;
