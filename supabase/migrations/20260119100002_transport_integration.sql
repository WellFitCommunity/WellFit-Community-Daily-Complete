-- ============================================================================
-- Transport Integration
-- ============================================================================
-- Purpose: Patient transport coordination with bed management
-- Date: 2026-01-19
--
-- This migration creates tables for:
--   - transport_requests: Patient transport requests
--   - transport_staff: Transport personnel roster
--
-- Integration with bed management:
--   - Transport complete → Origin bed = 'dirty', Destination bed = 'occupied'
--   - Real-time ETA tracking for bed availability forecasting
-- ============================================================================

-- ============================================================================
-- 1. Transport Types
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transport_priority') THEN
    CREATE TYPE transport_priority AS ENUM ('routine', 'urgent', 'stat', 'scheduled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transport_status') THEN
    CREATE TYPE transport_status AS ENUM (
      'requested', 'assigned', 'en_route', 'arrived',
      'in_transit', 'delivered', 'completed', 'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transport_type') THEN
    CREATE TYPE transport_type AS ENUM (
      'wheelchair', 'stretcher', 'bed', 'ambulatory',
      'bariatric', 'isolation', 'critical', 'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transport_reason') THEN
    CREATE TYPE transport_reason AS ENUM (
      'admission', 'discharge', 'transfer', 'procedure',
      'imaging', 'surgery', 'therapy', 'dialysis', 'test', 'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transport_staff_status') THEN
    CREATE TYPE transport_staff_status AS ENUM ('available', 'busy', 'on_break', 'off_duty');
  END IF;
END $$;

-- ============================================================================
-- 2. Transport Staff Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS transport_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  full_name text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  phone text,
  status transport_staff_status NOT NULL DEFAULT 'off_duty',
  current_request_id uuid,
  current_location text,
  assigned_units uuid[] DEFAULT '{}',
  certifications text[] DEFAULT '{}',
  shift_start timestamptz,
  shift_end timestamptz,
  transports_completed_today integer DEFAULT 0,
  avg_transport_minutes numeric(6, 2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_transport_staff_tenant_status
  ON transport_staff (tenant_id, status) WHERE is_active = true;

-- ============================================================================
-- 3. Transport Requests Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS transport_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid,
  patient_name text,
  patient_mrn text,

  -- Origin location
  origin_type text NOT NULL CHECK (origin_type IN ('bed', 'department', 'external')),
  origin_bed_id uuid REFERENCES beds(id) ON DELETE SET NULL,
  origin_unit_id uuid REFERENCES hospital_units(id) ON DELETE SET NULL,
  origin_department text,
  origin_location text NOT NULL,

  -- Destination location
  destination_type text NOT NULL CHECK (destination_type IN ('bed', 'department', 'external')),
  destination_bed_id uuid REFERENCES beds(id) ON DELETE SET NULL,
  destination_unit_id uuid REFERENCES hospital_units(id) ON DELETE SET NULL,
  destination_department text,
  destination_location text NOT NULL,

  -- Transport details
  transport_type transport_type NOT NULL DEFAULT 'wheelchair',
  transport_reason transport_reason NOT NULL DEFAULT 'other',
  priority transport_priority NOT NULL DEFAULT 'routine',
  status transport_status NOT NULL DEFAULT 'requested',

  -- Equipment requirements
  requires_oxygen boolean NOT NULL DEFAULT false,
  requires_iv boolean NOT NULL DEFAULT false,
  requires_monitor boolean NOT NULL DEFAULT false,
  requires_isolation boolean NOT NULL DEFAULT false,
  special_equipment text[] DEFAULT '{}',
  special_instructions text,

  -- Timing
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_time timestamptz,
  assigned_to uuid REFERENCES transport_staff(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  pickup_started_at timestamptz,
  pickup_arrived_at timestamptz,
  transit_started_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_reason text,

  -- Metrics
  wait_time_minutes integer,
  transit_time_minutes integer,
  total_time_minutes integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transport_requests_tenant_status
  ON transport_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_transport_requests_origin_bed
  ON transport_requests (origin_bed_id) WHERE origin_bed_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transport_requests_dest_bed
  ON transport_requests (destination_bed_id) WHERE destination_bed_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transport_requests_assigned
  ON transport_requests (assigned_to) WHERE status IN ('assigned', 'en_route', 'arrived', 'in_transit');

CREATE INDEX IF NOT EXISTS idx_transport_requests_priority
  ON transport_requests (tenant_id, priority, requested_at)
  WHERE status IN ('requested', 'assigned');

-- ============================================================================
-- 4. Function: Complete Transport and Update Beds
-- ============================================================================
CREATE OR REPLACE FUNCTION complete_transport_request(
  p_request_id uuid,
  p_completed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_wait_time integer;
  v_transit_time integer;
  v_total_time integer;
BEGIN
  -- Get the request
  SELECT * INTO v_request
  FROM transport_requests
  WHERE id = p_request_id
    AND status IN ('in_transit', 'delivered');

  IF v_request IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found or not in transit'
    );
  END IF;

  -- Calculate times
  v_wait_time := CASE
    WHEN v_request.pickup_started_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (v_request.pickup_started_at - v_request.requested_at)) / 60
    ELSE 0
  END;

  v_transit_time := CASE
    WHEN v_request.transit_started_at IS NOT NULL AND v_request.delivered_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (v_request.delivered_at - v_request.transit_started_at)) / 60
    ELSE 0
  END;

  v_total_time := EXTRACT(EPOCH FROM (now() - v_request.requested_at)) / 60;

  -- Update the request
  UPDATE transport_requests
  SET status = 'completed',
      completed_at = now(),
      wait_time_minutes = v_wait_time,
      transit_time_minutes = v_transit_time,
      total_time_minutes = v_total_time,
      updated_at = now()
  WHERE id = p_request_id;

  -- Update origin bed to dirty (if bed-to-bed transfer)
  IF v_request.origin_bed_id IS NOT NULL AND v_request.transport_reason = 'transfer' THEN
    UPDATE beds
    SET status = 'dirty',
        status_changed_at = now(),
        status_notes = 'Patient transferred out'
    WHERE id = v_request.origin_bed_id;
  END IF;

  -- Update destination bed to occupied (if destination is a bed)
  IF v_request.destination_bed_id IS NOT NULL THEN
    UPDATE beds
    SET status = 'occupied',
        status_changed_at = now(),
        status_notes = 'Patient arrived via transport'
    WHERE id = v_request.destination_bed_id
      AND status != 'occupied';
  END IF;

  -- Update transport staff
  IF v_request.assigned_to IS NOT NULL THEN
    UPDATE transport_staff
    SET status = 'available',
        current_request_id = NULL,
        current_location = v_request.destination_location,
        transports_completed_today = transports_completed_today + 1,
        updated_at = now()
    WHERE id = v_request.assigned_to;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'origin_bed_id', v_request.origin_bed_id,
    'destination_bed_id', v_request.destination_bed_id,
    'wait_time_minutes', v_wait_time,
    'transit_time_minutes', v_transit_time,
    'total_time_minutes', v_total_time
  );
END;
$$;

-- ============================================================================
-- 5. Function: Assign Transport Request
-- ============================================================================
CREATE OR REPLACE FUNCTION assign_transport_request(
  p_request_id uuid,
  p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_staff RECORD;
BEGIN
  SELECT * INTO v_request
  FROM transport_requests
  WHERE id = p_request_id
    AND status = 'requested';

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or not pending');
  END IF;

  SELECT * INTO v_staff
  FROM transport_staff
  WHERE id = p_staff_id
    AND tenant_id = v_request.tenant_id
    AND is_active = true
    AND status = 'available';

  IF v_staff IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Staff not found or not available');
  END IF;

  UPDATE transport_requests
  SET status = 'assigned',
      assigned_to = p_staff_id,
      assigned_at = now(),
      updated_at = now()
  WHERE id = p_request_id;

  UPDATE transport_staff
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
-- 6. Function: Update Transport Status
-- ============================================================================
CREATE OR REPLACE FUNCTION update_transport_status(
  p_request_id uuid,
  p_new_status transport_status,
  p_location text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
BEGIN
  SELECT * INTO v_request FROM transport_requests WHERE id = p_request_id;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  -- Update timestamps based on status
  UPDATE transport_requests
  SET status = p_new_status,
      pickup_started_at = CASE WHEN p_new_status = 'en_route' THEN COALESCE(pickup_started_at, now()) ELSE pickup_started_at END,
      pickup_arrived_at = CASE WHEN p_new_status = 'arrived' THEN COALESCE(pickup_arrived_at, now()) ELSE pickup_arrived_at END,
      transit_started_at = CASE WHEN p_new_status = 'in_transit' THEN COALESCE(transit_started_at, now()) ELSE transit_started_at END,
      delivered_at = CASE WHEN p_new_status = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
      updated_at = now()
  WHERE id = p_request_id;

  -- Update staff location if provided
  IF p_location IS NOT NULL AND v_request.assigned_to IS NOT NULL THEN
    UPDATE transport_staff
    SET current_location = p_location,
        updated_at = now()
    WHERE id = v_request.assigned_to;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'new_status', p_new_status
  );
END;
$$;

-- ============================================================================
-- 7. Row Level Security
-- ============================================================================
ALTER TABLE transport_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transport_requests_tenant_isolation" ON transport_requests
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "transport_requests_service_role" ON transport_requests
  FOR ALL TO service_role USING (true);

CREATE POLICY "transport_staff_tenant_isolation" ON transport_staff
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "transport_staff_service_role" ON transport_staff
  FOR ALL TO service_role USING (true);

-- ============================================================================
-- 8. Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON transport_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON transport_staff TO authenticated;

GRANT EXECUTE ON FUNCTION complete_transport_request TO authenticated;
GRANT EXECUTE ON FUNCTION assign_transport_request TO authenticated;
GRANT EXECUTE ON FUNCTION update_transport_status TO authenticated;

-- ============================================================================
-- 9. Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Transport Integration Migration Complete';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Tables created: transport_requests, transport_staff';
  RAISE NOTICE 'Functions: assign_transport_request, update_transport_status, complete_transport_request';
  RAISE NOTICE 'Bed integration: Origin → dirty, Destination → occupied on complete';
  RAISE NOTICE 'RLS policies applied for tenant isolation';
  RAISE NOTICE '=================================================================';
END $$;
