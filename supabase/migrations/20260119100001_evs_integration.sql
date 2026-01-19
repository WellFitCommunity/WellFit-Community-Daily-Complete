-- ============================================================================
-- EVS (Environmental Services) Integration
-- ============================================================================
-- Purpose: Housekeeping dispatch and turnaround tracking
-- Date: 2026-01-19
--
-- This migration creates tables for:
--   - evs_requests: Cleaning requests linked to beds
--   - evs_staff: Housekeeping personnel roster
--   - evs_turnaround_metrics: Aggregated performance metrics
--
-- Workflow:
--   Bed → 'dirty' → Auto-create evs_request (via trigger)
--   EVS claims → request.status = 'assigned'
--   EVS starts → request.status = 'in_progress'
--   EVS completes → Bed → 'available', record turnaround
-- ============================================================================

-- ============================================================================
-- 1. EVS Priority and Status Types
-- ============================================================================
DO $$
BEGIN
  -- EVS Priority
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evs_priority') THEN
    CREATE TYPE evs_priority AS ENUM ('routine', 'urgent', 'stat', 'isolation');
  END IF;

  -- EVS Request Status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evs_request_status') THEN
    CREATE TYPE evs_request_status AS ENUM (
      'pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'on_hold'
    );
  END IF;

  -- EVS Request Type
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evs_request_type') THEN
    CREATE TYPE evs_request_type AS ENUM (
      'discharge', 'terminal', 'stat', 'touch_up', 'spill', 'other'
    );
  END IF;

  -- EVS Staff Status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evs_staff_status') THEN
    CREATE TYPE evs_staff_status AS ENUM ('available', 'busy', 'on_break', 'off_duty');
  END IF;
END $$;

-- ============================================================================
-- 2. EVS Staff Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS evs_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  full_name text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  phone text,
  email text,
  status evs_staff_status NOT NULL DEFAULT 'off_duty',
  assigned_units uuid[] DEFAULT '{}',
  current_request_id uuid,
  shift_start timestamptz,
  shift_end timestamptz,
  break_start timestamptz,
  break_end timestamptz,
  requests_completed_today integer DEFAULT 0,
  avg_turnaround_minutes numeric(6, 2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, employee_id)
);

-- Index for staff lookup
CREATE INDEX IF NOT EXISTS idx_evs_staff_tenant_status
  ON evs_staff (tenant_id, status) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_evs_staff_user_id
  ON evs_staff (user_id) WHERE user_id IS NOT NULL;

-- ============================================================================
-- 3. EVS Requests Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS evs_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bed_id uuid NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES hospital_units(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  bed_label text NOT NULL,
  request_type evs_request_type NOT NULL DEFAULT 'discharge',
  priority evs_priority NOT NULL DEFAULT 'routine',
  status evs_request_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES evs_staff(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  estimated_duration_minutes integer,
  actual_duration_minutes integer,
  turnaround_minutes integer,
  isolation_type text,
  special_instructions text,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_reason text,
  patient_waiting boolean NOT NULL DEFAULT false,
  admission_scheduled_at timestamptz,
  adt_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for EVS request queries
CREATE INDEX IF NOT EXISTS idx_evs_requests_tenant_status
  ON evs_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_evs_requests_bed_status
  ON evs_requests (bed_id, status);

CREATE INDEX IF NOT EXISTS idx_evs_requests_unit_pending
  ON evs_requests (unit_id, status, priority)
  WHERE status IN ('pending', 'assigned');

CREATE INDEX IF NOT EXISTS idx_evs_requests_assigned_to
  ON evs_requests (assigned_to)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_evs_requests_requested_at
  ON evs_requests (tenant_id, requested_at DESC);

-- ============================================================================
-- 4. EVS Turnaround Metrics (Aggregated)
-- ============================================================================
CREATE TABLE IF NOT EXISTS evs_turnaround_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES hospital_units(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  request_type evs_request_type,
  requests_completed integer NOT NULL DEFAULT 0,
  avg_turnaround_minutes numeric(6, 2),
  median_turnaround_minutes numeric(6, 2),
  min_turnaround_minutes integer,
  max_turnaround_minutes integer,
  p90_turnaround_minutes numeric(6, 2),
  target_turnaround_minutes integer,
  met_target_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, unit_id, metric_date, request_type)
);

CREATE INDEX IF NOT EXISTS idx_evs_metrics_tenant_date
  ON evs_turnaround_metrics (tenant_id, metric_date DESC);

-- ============================================================================
-- 5. Function: Determine EVS Priority
-- ============================================================================
CREATE OR REPLACE FUNCTION determine_evs_priority(
  p_unit_type text,
  p_request_type evs_request_type,
  p_has_patient_waiting boolean,
  p_is_isolation boolean
)
RETURNS evs_priority
LANGUAGE plpgsql
AS $$
BEGIN
  -- Isolation always takes highest priority for infection control
  IF p_is_isolation THEN
    RETURN 'isolation';
  END IF;

  -- STAT requests are urgent by definition
  IF p_request_type = 'stat' THEN
    RETURN 'stat';
  END IF;

  -- If patient waiting, bump to urgent
  IF p_has_patient_waiting THEN
    RETURN 'urgent';
  END IF;

  -- Critical care units get higher priority
  IF p_unit_type IN ('icu', 'picu', 'nicu', 'or', 'pacu', 'ed', 'labor_delivery') THEN
    RETURN 'urgent';
  END IF;

  RETURN 'routine';
END;
$$;

-- ============================================================================
-- 6. Function: Create EVS Request from Bed Status Change
-- ============================================================================
CREATE OR REPLACE FUNCTION create_evs_request_from_bed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unit_record RECORD;
  v_priority evs_priority;
  v_request_type evs_request_type;
  v_is_isolation boolean;
BEGIN
  -- Only trigger when bed status changes TO 'dirty'
  IF NEW.status != 'dirty' THEN
    RETURN NEW;
  END IF;

  -- Skip if already dirty (no double-create)
  IF OLD IS NOT NULL AND OLD.status = 'dirty' THEN
    RETURN NEW;
  END IF;

  -- Get unit info
  SELECT id, unit_type, unit_name INTO v_unit_record
  FROM hospital_units
  WHERE id = NEW.unit_id AND tenant_id = NEW.tenant_id;

  IF v_unit_record IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this is an isolation room
  v_is_isolation := NEW.has_isolation_capability OR NEW.has_negative_pressure;

  -- Determine request type
  IF v_is_isolation THEN
    v_request_type := 'terminal';
  ELSE
    v_request_type := 'discharge';
  END IF;

  -- Determine priority
  v_priority := determine_evs_priority(
    v_unit_record.unit_type::text,
    v_request_type,
    false,  -- patient_waiting - unknown at this point
    v_is_isolation
  );

  -- Check if there's already a pending request for this bed
  IF EXISTS (
    SELECT 1 FROM evs_requests
    WHERE bed_id = NEW.id
      AND tenant_id = NEW.tenant_id
      AND status IN ('pending', 'assigned', 'in_progress')
  ) THEN
    RETURN NEW;
  END IF;

  -- Create the EVS request
  INSERT INTO evs_requests (
    tenant_id,
    bed_id,
    unit_id,
    room_number,
    bed_label,
    request_type,
    priority,
    status,
    requested_at,
    isolation_type,
    special_instructions
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    NEW.unit_id,
    NEW.room_number,
    NEW.bed_label,
    v_request_type,
    v_priority,
    'pending',
    now(),
    CASE WHEN v_is_isolation THEN 'Isolation precautions required' ELSE NULL END,
    NEW.status_notes
  );

  RETURN NEW;
END;
$$;

-- Create trigger on beds table
DROP TRIGGER IF EXISTS trg_create_evs_request_on_dirty ON beds;
CREATE TRIGGER trg_create_evs_request_on_dirty
  AFTER UPDATE OF status ON beds
  FOR EACH ROW
  WHEN (NEW.status = 'dirty')
  EXECUTE FUNCTION create_evs_request_from_bed();

-- ============================================================================
-- 7. Function: Complete EVS Request and Update Bed
-- ============================================================================
CREATE OR REPLACE FUNCTION complete_evs_request(
  p_request_id uuid,
  p_completed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_turnaround integer;
  v_actual_duration integer;
BEGIN
  -- Get the request
  SELECT * INTO v_request
  FROM evs_requests
  WHERE id = p_request_id
    AND status IN ('assigned', 'in_progress');

  IF v_request IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found or not in progress'
    );
  END IF;

  -- Calculate durations
  v_turnaround := EXTRACT(EPOCH FROM (now() - v_request.requested_at)) / 60;
  v_actual_duration := CASE
    WHEN v_request.started_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (now() - v_request.started_at)) / 60
    ELSE v_turnaround
  END;

  -- Update the request
  UPDATE evs_requests
  SET status = 'completed',
      completed_at = now(),
      completed_by = COALESCE(p_completed_by, v_request.assigned_to),
      turnaround_minutes = v_turnaround,
      actual_duration_minutes = v_actual_duration,
      updated_at = now()
  WHERE id = p_request_id;

  -- Update the bed status to 'available'
  UPDATE beds
  SET status = 'available',
      status_changed_at = now(),
      status_changed_by = COALESCE(p_completed_by, v_request.assigned_to)::text,
      status_notes = 'Cleaned by EVS'
  WHERE id = v_request.bed_id;

  -- Update EVS staff
  IF v_request.assigned_to IS NOT NULL THEN
    UPDATE evs_staff
    SET status = 'available',
        current_request_id = NULL,
        requests_completed_today = requests_completed_today + 1,
        updated_at = now()
    WHERE id = v_request.assigned_to;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'bed_id', v_request.bed_id,
    'turnaround_minutes', v_turnaround,
    'actual_duration_minutes', v_actual_duration
  );
END;
$$;

-- ============================================================================
-- 8. Function: Assign EVS Request to Staff
-- ============================================================================
CREATE OR REPLACE FUNCTION assign_evs_request(
  p_request_id uuid,
  p_staff_id uuid,
  p_estimated_duration_minutes integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_staff RECORD;
BEGIN
  -- Get the request
  SELECT * INTO v_request
  FROM evs_requests
  WHERE id = p_request_id
    AND status = 'pending';

  IF v_request IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found or not pending'
    );
  END IF;

  -- Get the staff
  SELECT * INTO v_staff
  FROM evs_staff
  WHERE id = p_staff_id
    AND tenant_id = v_request.tenant_id
    AND is_active = true
    AND status = 'available';

  IF v_staff IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Staff not found or not available'
    );
  END IF;

  -- Update the request
  UPDATE evs_requests
  SET status = 'assigned',
      assigned_to = p_staff_id,
      assigned_at = now(),
      estimated_duration_minutes = p_estimated_duration_minutes,
      updated_at = now()
  WHERE id = p_request_id;

  -- Update the staff
  UPDATE evs_staff
  SET status = 'busy',
      current_request_id = p_request_id,
      updated_at = now()
  WHERE id = p_staff_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'staff_id', p_staff_id,
    'staff_name', v_staff.full_name
  );
END;
$$;

-- ============================================================================
-- 9. Function: Start EVS Request
-- ============================================================================
CREATE OR REPLACE FUNCTION start_evs_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get the request
  SELECT * INTO v_request
  FROM evs_requests
  WHERE id = p_request_id
    AND status = 'assigned';

  IF v_request IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found or not assigned'
    );
  END IF;

  -- Update to in_progress
  UPDATE evs_requests
  SET status = 'in_progress',
      started_at = now(),
      updated_at = now()
  WHERE id = p_request_id;

  -- Update bed to 'cleaning'
  UPDATE beds
  SET status = 'cleaning',
      status_changed_at = now(),
      status_notes = 'EVS cleaning in progress'
  WHERE id = v_request.bed_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'bed_id', v_request.bed_id
  );
END;
$$;

-- ============================================================================
-- 10. Row Level Security
-- ============================================================================

-- Enable RLS
ALTER TABLE evs_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE evs_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE evs_turnaround_metrics ENABLE ROW LEVEL SECURITY;

-- EVS Requests policies
CREATE POLICY "evs_requests_tenant_isolation" ON evs_requests
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "evs_requests_service_role" ON evs_requests
  FOR ALL TO service_role USING (true);

-- EVS Staff policies
CREATE POLICY "evs_staff_tenant_isolation" ON evs_staff
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "evs_staff_service_role" ON evs_staff
  FOR ALL TO service_role USING (true);

-- EVS Metrics policies
CREATE POLICY "evs_metrics_tenant_isolation" ON evs_turnaround_metrics
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "evs_metrics_service_role" ON evs_turnaround_metrics
  FOR ALL TO service_role USING (true);

-- ============================================================================
-- 11. Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON evs_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON evs_staff TO authenticated;
GRANT SELECT ON evs_turnaround_metrics TO authenticated;

GRANT EXECUTE ON FUNCTION determine_evs_priority TO authenticated;
GRANT EXECUTE ON FUNCTION complete_evs_request TO authenticated;
GRANT EXECUTE ON FUNCTION assign_evs_request TO authenticated;
GRANT EXECUTE ON FUNCTION start_evs_request TO authenticated;

-- ============================================================================
-- 12. Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'EVS Integration Migration Complete';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Tables created: evs_requests, evs_staff, evs_turnaround_metrics';
  RAISE NOTICE 'Trigger: Auto-create EVS request when bed status → dirty';
  RAISE NOTICE 'Functions: assign_evs_request, start_evs_request, complete_evs_request';
  RAISE NOTICE 'RLS policies applied for tenant isolation';
  RAISE NOTICE '=================================================================';
END $$;
