-- =====================================================================
-- Add room_number Column to Profiles Table
-- =====================================================================

-- Add room_number column for facility-based patients
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS room_number TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_room_number
ON public.profiles(room_number)
WHERE room_number IS NOT NULL;

-- Update the shift handoff function to include room_number
DROP FUNCTION IF EXISTS public.get_current_shift_handoff(TEXT);

CREATE OR REPLACE FUNCTION public.get_current_shift_handoff(p_shift_type TEXT DEFAULT 'night')
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
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hrs.patient_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown Patient') AS patient_name,
    p.room_number,
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
  RAISE NOTICE '✅ Added room_number column to profiles table';
  RAISE NOTICE '   - room_number is TEXT (nullable)';
  RAISE NOTICE '   - Added index for performance';
  RAISE NOTICE '   - Updated get_current_shift_handoff to include room_number';
END $$;
