-- =====================================================================
-- Fix get_current_shift_handoff - Remove room_number column
-- =====================================================================

-- The profiles table doesn't have a room_number column
-- This function was referencing it, causing errors

-- Drop the existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_current_shift_handoff(TEXT);

CREATE OR REPLACE FUNCTION public.get_current_shift_handoff(p_shift_type TEXT DEFAULT 'night')
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  final_risk_level TEXT,
  auto_risk_level TEXT,
  nurse_reviewed BOOLEAN,
  nurse_adjusted BOOLEAN,
  handoff_priority INTEGER,
  risk_factors TEXT[],
  clinical_snapshot JSONB,
  recent_events JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hrs.patient_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown Patient') AS patient_name,
    hrs.final_risk_level,
    hrs.auto_risk_level,
    hrs.nurse_reviewed,
    hrs.nurse_adjusted,
    hrs.handoff_priority,
    hrs.risk_factors,
    hrs.clinical_snapshot,
    hrs.recent_events
  FROM handoff_risk_snapshots hrs
  LEFT JOIN profiles p ON p.user_id = hrs.patient_id
  WHERE hrs.shift_type = p_shift_type
    AND hrs.is_active = TRUE
  ORDER BY hrs.handoff_priority DESC, hrs.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_current_shift_handoff(TEXT) TO authenticated;

-- =====================================================================
-- Migration Complete
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fixed get_current_shift_handoff function';
  RAISE NOTICE '   - Removed room_number column reference';
  RAISE NOTICE '   - Function now returns data without room_number';
END $$;
