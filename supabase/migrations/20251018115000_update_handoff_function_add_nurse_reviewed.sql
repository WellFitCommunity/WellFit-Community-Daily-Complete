-- ============================================================================
-- Update get_current_shift_handoff to return nurse_reviewed field
-- ============================================================================
-- Purpose: Add nurse_reviewed to return value so UI can show which patients
--          still need review (critical for celebration trigger logic)
-- ============================================================================

BEGIN;

-- Drop and recreate the function with updated return type
DROP FUNCTION IF EXISTS public.get_current_shift_handoff(TEXT);

CREATE OR REPLACE FUNCTION public.get_current_shift_handoff(
  p_shift_type TEXT DEFAULT 'night'
)
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  room_number TEXT,
  final_risk_level TEXT,
  auto_risk_level TEXT,
  nurse_reviewed BOOLEAN,
  nurse_adjusted BOOLEAN,
  handoff_priority INTEGER,
  risk_factors TEXT[],
  clinical_snapshot JSONB,
  recent_events JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    hrs.patient_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown Patient') AS patient_name,
    p.room_number::TEXT,
    hrs.final_risk_level,
    hrs.auto_risk_level,
    hrs.nurse_reviewed, -- TRUE if nurse confirmed OR adjusted
    (hrs.nurse_risk_level IS NOT NULL) AS nurse_adjusted, -- TRUE only if nurse changed the score
    hrs.handoff_priority,
    hrs.risk_factors,
    hrs.clinical_snapshot,

    -- Get recent events for this patient (last 8 hours)
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'event_time', she.event_time,
          'event_type', she.event_type,
          'event_severity', she.event_severity,
          'event_description', she.event_description,
          'action_taken', she.action_taken
        ) ORDER BY she.event_time DESC
      )
      FROM public.shift_handoff_events she
      WHERE she.patient_id = hrs.patient_id
      AND she.event_time >= NOW() - INTERVAL '8 hours'
      LIMIT 10
    ) AS recent_events

  FROM public.shift_handoff_risk_scores hrs
  LEFT JOIN public.profiles p ON p.id = hrs.patient_id
  WHERE hrs.shift_date = CURRENT_DATE
  AND hrs.shift_type = p_shift_type
  ORDER BY
    CASE hrs.final_risk_level
      WHEN 'CRITICAL' THEN 1
      WHEN 'HIGH' THEN 2
      WHEN 'MEDIUM' THEN 3
      WHEN 'LOW' THEN 4
      ELSE 5
    END,
    hrs.handoff_priority NULLS LAST,
    hrs.auto_composite_score DESC;
END;
$$;

COMMENT ON FUNCTION public.get_current_shift_handoff IS 'Returns prioritized handoff list with nurse_reviewed flag for celebration trigger validation.';

COMMIT;
