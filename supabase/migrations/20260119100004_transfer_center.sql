-- ============================================================================
-- Transfer Center
-- ============================================================================
-- Purpose: Inter-facility transfer coordination
-- Date: 2026-01-19
--
-- Features:
--   - Transfer request workflow
--   - Facility capacity tracking
--   - Multi-facility visibility
-- ============================================================================

-- ============================================================================
-- 1. Transfer Center Types
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_request_status') THEN
    CREATE TYPE transfer_request_status AS ENUM (
      'pending', 'reviewing', 'approved', 'denied', 'scheduled',
      'in_transit', 'arrived', 'completed', 'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_urgency') THEN
    CREATE TYPE transfer_urgency AS ENUM (
      'routine', 'urgent', 'emergent', 'stat'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_type') THEN
    CREATE TYPE transfer_type AS ENUM (
      'step_up', 'step_down', 'lateral', 'specialty', 'repatriation'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transport_mode') THEN
    CREATE TYPE transport_mode AS ENUM (
      'ground_ambulance', 'air_ambulance', 'critical_care_transport',
      'wheelchair_van', 'private_vehicle', 'walk_in'
    );
  END IF;
END $$;

-- ============================================================================
-- 2. Transfer Requests Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_number text NOT NULL,

  -- Patient info (de-identified for transfer coordination)
  patient_id uuid NOT NULL,
  patient_mrn text,
  patient_age integer,
  patient_gender text,

  -- Sending facility
  sending_facility_id uuid NOT NULL,
  sending_facility_name text,
  sending_unit text,
  sending_contact_name text,
  sending_contact_phone text,

  -- Receiving facility
  receiving_facility_id uuid,
  receiving_facility_name text,
  receiving_unit text,
  receiving_contact_name text,
  receiving_contact_phone text,
  receiving_physician text,

  -- Transfer details
  transfer_type transfer_type NOT NULL,
  urgency transfer_urgency NOT NULL DEFAULT 'routine',
  status transfer_request_status NOT NULL DEFAULT 'pending',
  reason_for_transfer text NOT NULL,
  clinical_summary text,

  -- Medical requirements
  diagnosis_codes text[] DEFAULT '{}',
  primary_diagnosis text,
  required_service text,
  required_specialty text,
  acuity_level text NOT NULL DEFAULT 'MEDIUM' CHECK (acuity_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

  -- Special needs
  requires_icu boolean NOT NULL DEFAULT false,
  requires_isolation boolean NOT NULL DEFAULT false,
  requires_ventilator boolean NOT NULL DEFAULT false,
  requires_cardiac_monitoring boolean NOT NULL DEFAULT false,
  special_equipment text[] DEFAULT '{}',
  special_requirements text,

  -- Transport
  transport_mode transport_mode,
  transport_company text,
  transport_eta timestamptz,
  transport_notes text,

  -- Bed assignment
  assigned_bed_id uuid,
  assigned_bed_label text,

  -- Timeline
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  denied_at timestamptz,
  denial_reason text,
  scheduled_departure timestamptz,
  actual_departure timestamptz,
  actual_arrival timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,

  -- Metadata
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Unique request number per tenant
  CONSTRAINT uq_transfer_request_number UNIQUE (tenant_id, request_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transfer_requests_tenant_status
  ON transfer_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_urgency
  ON transfer_requests (tenant_id, urgency, status)
  WHERE status IN ('pending', 'reviewing', 'approved', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_transfer_requests_sending
  ON transfer_requests (sending_facility_id, status);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_receiving
  ON transfer_requests (receiving_facility_id, status)
  WHERE receiving_facility_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transfer_requests_patient
  ON transfer_requests (patient_id);

-- ============================================================================
-- 3. Facility Capacity Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS facility_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL,
  facility_name text NOT NULL,

  -- Census
  total_beds integer NOT NULL DEFAULT 0,
  occupied_beds integer NOT NULL DEFAULT 0,
  available_beds integer NOT NULL DEFAULT 0,
  reserved_beds integer NOT NULL DEFAULT 0,
  blocked_beds integer NOT NULL DEFAULT 0,

  -- Occupancy
  occupancy_percent numeric(5,2) NOT NULL DEFAULT 0,
  is_accepting_transfers boolean NOT NULL DEFAULT true,
  divert_status boolean NOT NULL DEFAULT false,

  -- By unit type
  icu_available integer NOT NULL DEFAULT 0,
  step_down_available integer NOT NULL DEFAULT 0,
  telemetry_available integer NOT NULL DEFAULT 0,
  med_surg_available integer NOT NULL DEFAULT 0,
  ed_available integer NOT NULL DEFAULT 0,

  -- Timestamps
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  next_discharge_expected timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Unique per facility per snapshot time (allow one per minute)
  CONSTRAINT uq_facility_capacity_snapshot UNIQUE (facility_id, snapshot_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_facility_capacity_tenant
  ON facility_capacity (tenant_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_facility_capacity_facility
  ON facility_capacity (facility_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_facility_capacity_accepting
  ON facility_capacity (tenant_id, is_accepting_transfers)
  WHERE is_accepting_transfers = true;

-- ============================================================================
-- 4. Function: Generate Request Number
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_transfer_request_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
  v_year text;
BEGIN
  v_year := to_char(now(), 'YYYY');

  SELECT COUNT(*) + 1 INTO v_count
  FROM transfer_requests
  WHERE tenant_id = p_tenant_id
    AND requested_at >= date_trunc('year', now());

  RETURN 'TR-' || v_year || '-' || lpad(v_count::text, 5, '0');
END;
$$;

-- ============================================================================
-- 5. Trigger: Auto-generate request number
-- ============================================================================
CREATE OR REPLACE FUNCTION set_transfer_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := generate_transfer_request_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_transfer_request_number ON transfer_requests;
CREATE TRIGGER trg_set_transfer_request_number
  BEFORE INSERT ON transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_transfer_request_number();

-- ============================================================================
-- 6. Function: Approve Transfer
-- ============================================================================
CREATE OR REPLACE FUNCTION approve_transfer_request(
  p_transfer_id uuid,
  p_receiving_unit text DEFAULT NULL,
  p_receiving_contact_name text DEFAULT NULL,
  p_receiving_contact_phone text DEFAULT NULL,
  p_receiving_physician text DEFAULT NULL,
  p_assigned_bed_id uuid DEFAULT NULL,
  p_assigned_bed_label text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer RECORD;
BEGIN
  -- Get transfer
  SELECT * INTO v_transfer
  FROM transfer_requests
  WHERE id = p_transfer_id
    AND status IN ('pending', 'reviewing');

  IF v_transfer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer not found or already processed');
  END IF;

  -- Update transfer
  UPDATE transfer_requests
  SET status = 'approved',
      receiving_unit = COALESCE(p_receiving_unit, receiving_unit),
      receiving_contact_name = COALESCE(p_receiving_contact_name, receiving_contact_name),
      receiving_contact_phone = COALESCE(p_receiving_contact_phone, receiving_contact_phone),
      receiving_physician = COALESCE(p_receiving_physician, receiving_physician),
      assigned_bed_id = COALESCE(p_assigned_bed_id, assigned_bed_id),
      assigned_bed_label = COALESCE(p_assigned_bed_label, assigned_bed_label),
      approved_at = now(),
      notes = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n', '') || p_notes ELSE notes END,
      updated_at = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', p_transfer_id,
    'status', 'approved'
  );
END;
$$;

-- ============================================================================
-- 7. Function: Deny Transfer
-- ============================================================================
CREATE OR REPLACE FUNCTION deny_transfer_request(
  p_transfer_id uuid,
  p_denial_reason text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer RECORD;
BEGIN
  -- Get transfer
  SELECT * INTO v_transfer
  FROM transfer_requests
  WHERE id = p_transfer_id
    AND status IN ('pending', 'reviewing');

  IF v_transfer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer not found or already processed');
  END IF;

  -- Update transfer
  UPDATE transfer_requests
  SET status = 'denied',
      denied_at = now(),
      denial_reason = p_denial_reason,
      notes = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n', '') || p_notes ELSE notes END,
      updated_at = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', p_transfer_id,
    'status', 'denied'
  );
END;
$$;

-- ============================================================================
-- 8. Function: Start Transfer (mark in transit)
-- ============================================================================
CREATE OR REPLACE FUNCTION start_transfer(
  p_transfer_id uuid,
  p_transport_mode transport_mode DEFAULT NULL,
  p_transport_company text DEFAULT NULL,
  p_transport_eta timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer RECORD;
BEGIN
  -- Get transfer
  SELECT * INTO v_transfer
  FROM transfer_requests
  WHERE id = p_transfer_id
    AND status IN ('approved', 'scheduled');

  IF v_transfer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer not found or not ready for transport');
  END IF;

  -- Update transfer
  UPDATE transfer_requests
  SET status = 'in_transit',
      transport_mode = COALESCE(p_transport_mode, transport_mode),
      transport_company = COALESCE(p_transport_company, transport_company),
      transport_eta = COALESCE(p_transport_eta, transport_eta),
      actual_departure = now(),
      updated_at = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', p_transfer_id,
    'status', 'in_transit',
    'departure_time', now()
  );
END;
$$;

-- ============================================================================
-- 9. Function: Complete Transfer
-- ============================================================================
CREATE OR REPLACE FUNCTION complete_transfer(p_transfer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer RECORD;
  v_transit_minutes integer;
BEGIN
  -- Get transfer
  SELECT * INTO v_transfer
  FROM transfer_requests
  WHERE id = p_transfer_id
    AND status IN ('in_transit', 'arrived');

  IF v_transfer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer not found or wrong status');
  END IF;

  -- Calculate transit time
  IF v_transfer.actual_departure IS NOT NULL THEN
    v_transit_minutes := EXTRACT(EPOCH FROM (now() - v_transfer.actual_departure)) / 60;
  END IF;

  -- Update transfer
  UPDATE transfer_requests
  SET status = 'completed',
      actual_arrival = CASE WHEN actual_arrival IS NULL THEN now() ELSE actual_arrival END,
      completed_at = now(),
      updated_at = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', p_transfer_id,
    'status', 'completed',
    'transit_minutes', COALESCE(v_transit_minutes, 0)
  );
END;
$$;

-- ============================================================================
-- 10. Function: Get Transfer Metrics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_transfer_metrics(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_pending integer;
  v_total_in_transit integer;
  v_total_completed_today integer;
  v_avg_approval_time numeric;
  v_avg_transfer_time numeric;
  v_by_urgency jsonb;
  v_by_type jsonb;
  v_denial_count integer;
  v_total_decided integer;
BEGIN
  -- Get counts
  SELECT COUNT(*) INTO v_total_pending
  FROM transfer_requests
  WHERE tenant_id = p_tenant_id
    AND status IN ('pending', 'reviewing');

  SELECT COUNT(*) INTO v_total_in_transit
  FROM transfer_requests
  WHERE tenant_id = p_tenant_id
    AND status = 'in_transit';

  SELECT COUNT(*) INTO v_total_completed_today
  FROM transfer_requests
  WHERE tenant_id = p_tenant_id
    AND status = 'completed'
    AND completed_at >= date_trunc('day', now());

  -- Average approval time (for approved transfers)
  SELECT AVG(EXTRACT(EPOCH FROM (approved_at - requested_at)) / 60)
  INTO v_avg_approval_time
  FROM transfer_requests
  WHERE tenant_id = p_tenant_id
    AND approved_at IS NOT NULL;

  -- Average transfer time (departure to arrival)
  SELECT AVG(EXTRACT(EPOCH FROM (actual_arrival - actual_departure)) / 60)
  INTO v_avg_transfer_time
  FROM transfer_requests
  WHERE tenant_id = p_tenant_id
    AND actual_departure IS NOT NULL
    AND actual_arrival IS NOT NULL;

  -- Pending by urgency
  SELECT jsonb_object_agg(urgency::text, cnt)
  INTO v_by_urgency
  FROM (
    SELECT urgency, COUNT(*) as cnt
    FROM transfer_requests
    WHERE tenant_id = p_tenant_id
      AND status IN ('pending', 'reviewing')
    GROUP BY urgency
  ) sub;

  -- Pending by type
  SELECT jsonb_object_agg(transfer_type::text, cnt)
  INTO v_by_type
  FROM (
    SELECT transfer_type, COUNT(*) as cnt
    FROM transfer_requests
    WHERE tenant_id = p_tenant_id
      AND status IN ('pending', 'reviewing')
    GROUP BY transfer_type
  ) sub;

  -- Denial rate
  SELECT COUNT(*) INTO v_denial_count
  FROM transfer_requests
  WHERE tenant_id = p_tenant_id
    AND status = 'denied'
    AND denied_at >= now() - interval '30 days';

  SELECT COUNT(*) INTO v_total_decided
  FROM transfer_requests
  WHERE tenant_id = p_tenant_id
    AND status IN ('approved', 'denied', 'completed', 'cancelled')
    AND updated_at >= now() - interval '30 days';

  RETURN jsonb_build_object(
    'total_pending', COALESCE(v_total_pending, 0),
    'total_in_transit', COALESCE(v_total_in_transit, 0),
    'total_completed_today', COALESCE(v_total_completed_today, 0),
    'avg_approval_time_minutes', COALESCE(v_avg_approval_time, 0),
    'avg_transfer_time_minutes', COALESCE(v_avg_transfer_time, 0),
    'pending_by_urgency', COALESCE(v_by_urgency, '{}'::jsonb),
    'pending_by_type', COALESCE(v_by_type, '{}'::jsonb),
    'denial_rate_percent', CASE WHEN v_total_decided > 0 THEN round((v_denial_count::numeric / v_total_decided) * 100, 1) ELSE 0 END
  );
END;
$$;

-- ============================================================================
-- 11. Row Level Security
-- ============================================================================
ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_requests_tenant_isolation" ON transfer_requests
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "transfer_requests_service_role" ON transfer_requests
  FOR ALL TO service_role USING (true);

CREATE POLICY "facility_capacity_tenant_isolation" ON facility_capacity
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "facility_capacity_service_role" ON facility_capacity
  FOR ALL TO service_role USING (true);

-- ============================================================================
-- 12. Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON transfer_requests TO authenticated;
GRANT SELECT, INSERT ON facility_capacity TO authenticated;
GRANT EXECUTE ON FUNCTION generate_transfer_request_number TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transfer_request TO authenticated;
GRANT EXECUTE ON FUNCTION deny_transfer_request TO authenticated;
GRANT EXECUTE ON FUNCTION start_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION complete_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION get_transfer_metrics TO authenticated;

-- ============================================================================
-- 13. Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Transfer Center Migration Complete';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Tables created: transfer_requests, facility_capacity';
  RAISE NOTICE 'Functions: approve_transfer_request, deny_transfer_request, start_transfer, complete_transfer';
  RAISE NOTICE 'Auto-generated request numbers: TR-YYYY-NNNNN';
  RAISE NOTICE 'RLS policies applied for tenant isolation';
  RAISE NOTICE '=================================================================';
END $$;
