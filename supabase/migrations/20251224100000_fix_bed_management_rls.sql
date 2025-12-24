-- Migration: Fix bed management RLS policies AND the broken get_current_tenant_id function
-- Date: 2024-12-24
--
-- ROOT CAUSE: The get_current_tenant_id() function had a bug - it queried:
--   WHERE id = auth.uid()
-- But profiles table uses user_id, not id. So the fallback never worked.
--
-- FIX:
-- 1. Fix get_current_tenant_id() to use the correct column (user_id)
-- 2. Update bed management policies as a backup
--
-- This fix will repair ALL RLS policies across the system that rely on this function.

BEGIN;

-- ============================================================================
-- PART 0: FIX THE ROOT CAUSE - get_current_tenant_id() function
-- ============================================================================

-- Drop and recreate with the CORRECT column name (user_id, not id)
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    -- First try session variable (rarely set, but kept for compatibility)
    current_setting('app.current_tenant_id', true)::uuid,
    -- Fallback: get tenant_id from user's profile using CORRECT column
    (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_current_tenant_id() IS
'Returns the current tenant ID for RLS policies.
Fixed 2024-12-24: Changed profiles.id to profiles.user_id to match actual schema.';

-- ============================================================================
-- HOSPITAL_UNITS - Fix RLS
-- ============================================================================

DROP POLICY IF EXISTS "hospital_units_tenant_read" ON public.hospital_units;
DROP POLICY IF EXISTS "hospital_units_admin_write" ON public.hospital_units;

-- Allow authenticated users to read their tenant's hospital units
CREATE POLICY "hospital_units_tenant_read" ON public.hospital_units
  FOR SELECT USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );

-- Allow admins to manage their tenant's hospital units
CREATE POLICY "hospital_units_admin_write" ON public.hospital_units
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = hospital_units.tenant_id
        AND (p.role IN ('admin', 'super_admin') OR p.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = hospital_units.tenant_id
        AND (p.role IN ('admin', 'super_admin') OR p.is_admin = true)
    )
  );

-- ============================================================================
-- BEDS - Fix RLS
-- ============================================================================

DROP POLICY IF EXISTS "beds_tenant_read" ON public.beds;
DROP POLICY IF EXISTS "beds_staff_write" ON public.beds;

-- Allow authenticated users to read their tenant's beds
CREATE POLICY "beds_tenant_read" ON public.beds
  FOR SELECT USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );

-- Allow clinical staff to manage beds
CREATE POLICY "beds_staff_write" ON public.beds
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = beds.tenant_id
        AND p.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control', 'physician')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = beds.tenant_id
        AND p.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control', 'physician')
    )
  );

-- ============================================================================
-- BED_ASSIGNMENTS - Fix RLS
-- ============================================================================

DROP POLICY IF EXISTS "bed_assignments_tenant_read" ON public.bed_assignments;
DROP POLICY IF EXISTS "bed_assignments_staff_write" ON public.bed_assignments;

-- Allow authenticated users to read their tenant's bed assignments
CREATE POLICY "bed_assignments_tenant_read" ON public.bed_assignments
  FOR SELECT USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );

-- Allow clinical staff to manage bed assignments
CREATE POLICY "bed_assignments_staff_write" ON public.bed_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = bed_assignments.tenant_id
        AND p.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control', 'physician')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = bed_assignments.tenant_id
        AND p.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control', 'physician')
    )
  );

-- ============================================================================
-- BED_STATUS_HISTORY - Fix RLS
-- ============================================================================

DROP POLICY IF EXISTS "bed_status_history_tenant_read" ON public.bed_status_history;
DROP POLICY IF EXISTS "bed_status_history_system_insert" ON public.bed_status_history;

-- Allow authenticated users to read their tenant's bed status history
CREATE POLICY "bed_status_history_tenant_read" ON public.bed_status_history
  FOR SELECT USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );

-- Allow inserts for tenant's bed status history
CREATE POLICY "bed_status_history_insert" ON public.bed_status_history
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- DAILY_CENSUS_SNAPSHOTS - Fix RLS
-- ============================================================================

DROP POLICY IF EXISTS "daily_census_tenant_read" ON public.daily_census_snapshots;
DROP POLICY IF EXISTS "daily_census_system_write" ON public.daily_census_snapshots;

-- Allow authenticated users to read their tenant's census data
CREATE POLICY "daily_census_tenant_read" ON public.daily_census_snapshots
  FOR SELECT USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );

-- Allow staff to write census data
CREATE POLICY "daily_census_write" ON public.daily_census_snapshots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = daily_census_snapshots.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = daily_census_snapshots.tenant_id
    )
  );

-- ============================================================================
-- SCHEDULED_ARRIVALS - Fix RLS
-- ============================================================================

DROP POLICY IF EXISTS "scheduled_arrivals_tenant_read" ON public.scheduled_arrivals;
DROP POLICY IF EXISTS "scheduled_arrivals_staff_write" ON public.scheduled_arrivals;

-- Allow authenticated users to read their tenant's scheduled arrivals
CREATE POLICY "scheduled_arrivals_tenant_read" ON public.scheduled_arrivals
  FOR SELECT USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );

-- Allow clinical staff to manage scheduled arrivals
CREATE POLICY "scheduled_arrivals_staff_write" ON public.scheduled_arrivals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = scheduled_arrivals.tenant_id
        AND p.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control', 'physician')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = scheduled_arrivals.tenant_id
        AND p.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control', 'physician')
    )
  );

-- ============================================================================
-- BED_AVAILABILITY_FORECASTS - Fix RLS
-- ============================================================================

DROP POLICY IF EXISTS "forecasts_tenant_read" ON public.bed_availability_forecasts;
DROP POLICY IF EXISTS "forecasts_system_write" ON public.bed_availability_forecasts;

-- Allow authenticated users to read their tenant's forecasts
CREATE POLICY "forecasts_tenant_read" ON public.bed_availability_forecasts
  FOR SELECT USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );

-- Allow staff to write forecasts
CREATE POLICY "forecasts_write" ON public.bed_availability_forecasts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = bed_availability_forecasts.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = bed_availability_forecasts.tenant_id
    )
  );

-- ============================================================================
-- LOS_BENCHMARKS - Fix RLS (if exists and has issues)
-- ============================================================================

-- This table allows NULL tenant_id for global benchmarks, so policy is different
DROP POLICY IF EXISTS "los_benchmarks_read" ON public.los_benchmarks;

CREATE POLICY "los_benchmarks_read" ON public.los_benchmarks
  FOR SELECT USING (
    tenant_id IS NULL  -- Global benchmarks readable by all
    OR tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );

COMMIT;
