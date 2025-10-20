-- =====================================================================
-- Create handoff_risk_snapshots View
-- =====================================================================

-- The get_current_shift_handoff function expects handoff_risk_snapshots
-- but the actual table is shift_handoff_risk_scores
-- Create a view to bridge the gap

CREATE OR REPLACE VIEW public.handoff_risk_snapshots AS
SELECT
  id,
  patient_id,
  shift_date,
  shift_type,
  auto_risk_level,
  nurse_reviewed,
  nurse_risk_level,
  final_risk_level,
  auto_composite_score AS handoff_priority,
  ARRAY[]::TEXT[] AS risk_factors, -- Placeholder, can be populated later
  '{}'::JSONB AS clinical_snapshot, -- Placeholder
  '{}'::JSONB AS recent_events, -- Placeholder
  TRUE AS is_active, -- All current shift scores are active
  scoring_time AS created_at,
  CASE WHEN nurse_risk_level IS NOT NULL THEN TRUE ELSE FALSE END AS nurse_adjusted
FROM public.shift_handoff_risk_scores
WHERE shift_date = CURRENT_DATE;

-- Grant select permission
GRANT SELECT ON public.handoff_risk_snapshots TO authenticated;

-- =====================================================================
-- Migration Complete
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Created handoff_risk_snapshots view';
  RAISE NOTICE '   - Maps to shift_handoff_risk_scores table';
  RAISE NOTICE '   - Filters to current date only';
  RAISE NOTICE '   - Compatible with get_current_shift_handoff function';
END $$;
