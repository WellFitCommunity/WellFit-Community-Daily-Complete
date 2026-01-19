-- ============================================================================
-- Fix Bed Management Profile Joins
-- ============================================================================
-- Date: 2026-01-19
--
-- ROOT CAUSE: The predict_unit_discharges() function and v_bed_board view
-- join profiles using p.id = ba.patient_id, but:
--   - bed_assignments.patient_id REFERENCES auth.users(id)
--   - profiles.user_id links to auth.users(id), NOT profiles.id
--
-- This causes patient names to show as "Unknown" or NULL because the join
-- never matches.
--
-- FIX:
-- 1. predict_unit_discharges() - change p.id to p.user_id
-- 2. v_bed_board view - change p.id to p.user_id + make patient_name null-safe
--
-- Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Fix predict_unit_discharges() function
-- ============================================================================
-- BEFORE: JOIN public.profiles p ON p.id = ba.patient_id
-- AFTER:  JOIN public.profiles p ON p.user_id = ba.patient_id

CREATE OR REPLACE FUNCTION public.predict_unit_discharges(
  p_unit_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  bed_label TEXT,
  days_in_hospital INTEGER,
  expected_discharge_date DATE,
  discharge_likelihood TEXT,
  los_remaining_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ba.patient_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS patient_name,
    b.bed_label,
    (p_date - ba.assigned_at::DATE) AS days_in_hospital,
    ba.expected_discharge_date,
    CASE
      WHEN ba.expected_discharge_date <= p_date THEN 'High'
      WHEN ba.expected_discharge_date <= p_date + 1 THEN 'Medium'
      ELSE 'Low'
    END AS discharge_likelihood,
    GREATEST(0, ba.expected_discharge_date - p_date) AS los_remaining_days
  FROM public.bed_assignments ba
  JOIN public.beds b ON b.id = ba.bed_id
  JOIN public.profiles p ON p.user_id = ba.patient_id  -- FIXED: was p.id
  WHERE ba.is_active = true
    AND b.unit_id = p_unit_id
    AND ba.expected_discharge_date IS NOT NULL
  ORDER BY ba.expected_discharge_date ASC, days_in_hospital DESC;
END;
$$;

COMMENT ON FUNCTION public.predict_unit_discharges IS
'List patients with expected discharge dates for forecasting.
Fixed 2026-01-19: Changed profiles join from p.id to p.user_id to match schema.';

-- ============================================================================
-- PART 2: Fix v_bed_board view
-- ============================================================================
-- BEFORE: LEFT JOIN public.profiles p ON p.id = ba.patient_id
-- AFTER:  LEFT JOIN public.profiles p ON p.user_id = ba.patient_id
-- Also: Made patient_name null-safe with COALESCE

CREATE OR REPLACE VIEW public.v_bed_board AS
SELECT
  b.id AS bed_id,
  b.bed_label,
  b.room_number,
  b.bed_position,
  b.bed_type,
  b.status,
  b.status_changed_at,
  b.has_telemetry,
  b.has_isolation_capability,
  b.has_negative_pressure,
  u.id AS unit_id,
  u.unit_code,
  u.unit_name,
  u.unit_type,
  u.floor_number,
  f.id AS facility_id,
  f.name AS facility_name,
  ba.patient_id,
  COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS patient_name,  -- FIXED: null-safe
  p.mrn AS patient_mrn,
  ba.assigned_at,
  ba.expected_discharge_date,
  hrs.final_risk_level AS patient_acuity,
  b.tenant_id
FROM public.beds b
JOIN public.hospital_units u ON u.id = b.unit_id
LEFT JOIN public.facilities f ON f.id = u.facility_id
LEFT JOIN public.bed_assignments ba ON ba.bed_id = b.id AND ba.is_active = true
LEFT JOIN public.profiles p ON p.user_id = ba.patient_id  -- FIXED: was p.id
LEFT JOIN public.shift_handoff_risk_scores hrs ON hrs.patient_id = ba.patient_id
  AND hrs.shift_date = CURRENT_DATE
WHERE b.is_active = true;

COMMENT ON VIEW public.v_bed_board IS
'Real-time bed board with patient assignments and acuity.
Fixed 2026-01-19: Changed profiles join from p.id to p.user_id to match schema.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Bed Management Profile Joins Fixed';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed joins: profiles.id → profiles.user_id';
  RAISE NOTICE '';
  RAISE NOTICE '1. predict_unit_discharges() - patient names now resolve correctly';
  RAISE NOTICE '2. v_bed_board view - patient names now resolve correctly';
  RAISE NOTICE '';
  RAISE NOTICE 'Root cause: bed_assignments.patient_id references auth.users(id),';
  RAISE NOTICE '            but profiles links via user_id, not id column.';
  RAISE NOTICE '=================================================================';
END $$;

COMMIT;
