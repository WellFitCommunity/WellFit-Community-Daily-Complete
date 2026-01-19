-- ============================================================================
-- Multi-Facility Capacity Management
-- ============================================================================
-- Purpose: Network-wide bed visibility and capacity coordination
-- Date: 2026-01-19
--
-- Features:
--   - Health system hierarchy
--   - Real-time capacity snapshots
--   - Capacity alerting
-- ============================================================================

-- ============================================================================
-- 1. Types
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'facility_type') THEN
    CREATE TYPE facility_type AS ENUM (
      'acute_care', 'critical_access', 'specialty', 'ltach',
      'rehab', 'psych', 'childrens'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capacity_alert_level') THEN
    CREATE TYPE capacity_alert_level AS ENUM (
      'normal', 'watch', 'warning', 'critical', 'divert'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trend_direction') THEN
    CREATE TYPE trend_direction AS ENUM ('up', 'down', 'stable');
  END IF;
END $$;

-- ============================================================================
-- 2. Health Systems Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS health_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  short_name text,
  region text,

  -- Contact
  contact_name text,
  contact_phone text,
  contact_email text,

  -- Capacity management
  central_transfer_number text,
  bed_control_email text,

  -- Network settings
  total_facilities integer NOT NULL DEFAULT 0,
  total_licensed_beds integer NOT NULL DEFAULT 0,
  enable_cross_facility_transfers boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_health_system_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_health_systems_tenant
  ON health_systems (tenant_id);

-- ============================================================================
-- 3. Health System Facilities Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS health_system_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  health_system_id uuid NOT NULL REFERENCES health_systems(id) ON DELETE CASCADE,

  -- Identification
  facility_code text NOT NULL,
  name text NOT NULL,
  short_name text,
  facility_type facility_type NOT NULL DEFAULT 'acute_care',

  -- Location
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),

  -- Contact
  main_phone text,
  bed_control_phone text,
  transfer_center_phone text,

  -- Capacity
  licensed_beds integer NOT NULL DEFAULT 0,
  staffed_beds integer NOT NULL DEFAULT 0,
  icu_beds integer NOT NULL DEFAULT 0,
  step_down_beds integer NOT NULL DEFAULT 0,
  telemetry_beds integer NOT NULL DEFAULT 0,
  med_surg_beds integer NOT NULL DEFAULT 0,

  -- Status
  is_active boolean NOT NULL DEFAULT true,
  is_accepting_transfers boolean NOT NULL DEFAULT true,
  divert_status boolean NOT NULL DEFAULT false,

  -- Services offered
  services_offered text[] DEFAULT '{}',
  specialties text[] DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_facility_code UNIQUE (health_system_id, facility_code)
);

CREATE INDEX IF NOT EXISTS idx_health_system_facilities_tenant
  ON health_system_facilities (tenant_id);

CREATE INDEX IF NOT EXISTS idx_health_system_facilities_system
  ON health_system_facilities (health_system_id);

CREATE INDEX IF NOT EXISTS idx_health_system_facilities_active
  ON health_system_facilities (tenant_id, is_active)
  WHERE is_active = true;

-- ============================================================================
-- 4. Facility Capacity Snapshots Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS facility_capacity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES health_system_facilities(id) ON DELETE CASCADE,
  facility_name text NOT NULL,
  facility_code text NOT NULL,

  -- Current census
  total_beds integer NOT NULL DEFAULT 0,
  occupied_beds integer NOT NULL DEFAULT 0,
  available_beds integer NOT NULL DEFAULT 0,
  reserved_beds integer NOT NULL DEFAULT 0,
  blocked_beds integer NOT NULL DEFAULT 0,
  pending_discharge integer NOT NULL DEFAULT 0,
  pending_admission integer NOT NULL DEFAULT 0,

  -- Occupancy
  occupancy_percent numeric(5, 2) NOT NULL DEFAULT 0,
  alert_level capacity_alert_level NOT NULL DEFAULT 'normal',

  -- By unit type
  icu_occupied integer NOT NULL DEFAULT 0,
  icu_available integer NOT NULL DEFAULT 0,
  step_down_occupied integer NOT NULL DEFAULT 0,
  step_down_available integer NOT NULL DEFAULT 0,
  telemetry_occupied integer NOT NULL DEFAULT 0,
  telemetry_available integer NOT NULL DEFAULT 0,
  med_surg_occupied integer NOT NULL DEFAULT 0,
  med_surg_available integer NOT NULL DEFAULT 0,
  ed_census integer NOT NULL DEFAULT 0,
  ed_boarding integer NOT NULL DEFAULT 0,

  -- Trends
  trend_1h trend_direction NOT NULL DEFAULT 'stable',
  trend_4h trend_direction NOT NULL DEFAULT 'stable',
  trend_24h trend_direction NOT NULL DEFAULT 'stable',

  -- Predictions
  predicted_available_4h integer NOT NULL DEFAULT 0,
  predicted_available_8h integer NOT NULL DEFAULT 0,
  predicted_available_12h integer NOT NULL DEFAULT 0,
  predicted_available_24h integer NOT NULL DEFAULT 0,

  -- Status
  is_accepting_transfers boolean NOT NULL DEFAULT true,
  divert_status boolean NOT NULL DEFAULT false,
  divert_reason text,

  -- Timestamps
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  next_predicted_discharge timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facility_snapshots_tenant_time
  ON facility_capacity_snapshots (tenant_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_facility_snapshots_facility_time
  ON facility_capacity_snapshots (facility_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_facility_snapshots_alert
  ON facility_capacity_snapshots (tenant_id, alert_level, snapshot_at DESC)
  WHERE alert_level IN ('warning', 'critical', 'divert');

-- ============================================================================
-- 5. Capacity Alerts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS capacity_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES health_system_facilities(id) ON DELETE CASCADE,
  facility_name text NOT NULL,

  alert_level capacity_alert_level NOT NULL,
  previous_level capacity_alert_level,

  -- Details
  current_occupancy_percent numeric(5, 2) NOT NULL,
  threshold_crossed integer NOT NULL,
  message text NOT NULL,

  -- Status
  is_acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,

  -- Timestamps
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capacity_alerts_tenant_active
  ON capacity_alerts (tenant_id, triggered_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_capacity_alerts_facility
  ON capacity_alerts (facility_id, triggered_at DESC);

-- ============================================================================
-- 6. Function: Calculate Alert Level
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_capacity_alert_level(
  p_occupancy_percent numeric,
  p_on_divert boolean
)
RETURNS capacity_alert_level
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_on_divert THEN RETURN 'divert'; END IF;
  IF p_occupancy_percent >= 95 THEN RETURN 'divert'; END IF;
  IF p_occupancy_percent >= 90 THEN RETURN 'critical'; END IF;
  IF p_occupancy_percent >= 80 THEN RETURN 'warning'; END IF;
  IF p_occupancy_percent >= 70 THEN RETURN 'watch'; END IF;
  RETURN 'normal';
END;
$$;

-- ============================================================================
-- 7. Function: Record Capacity Snapshot
-- ============================================================================
CREATE OR REPLACE FUNCTION record_capacity_snapshot(
  p_facility_id uuid,
  p_total_beds integer,
  p_occupied_beds integer,
  p_available_beds integer,
  p_reserved_beds integer DEFAULT 0,
  p_blocked_beds integer DEFAULT 0,
  p_pending_discharge integer DEFAULT 0,
  p_pending_admission integer DEFAULT 0,
  p_icu_occupied integer DEFAULT 0,
  p_icu_available integer DEFAULT 0,
  p_step_down_occupied integer DEFAULT 0,
  p_step_down_available integer DEFAULT 0,
  p_telemetry_occupied integer DEFAULT 0,
  p_telemetry_available integer DEFAULT 0,
  p_med_surg_occupied integer DEFAULT 0,
  p_med_surg_available integer DEFAULT 0,
  p_ed_census integer DEFAULT 0,
  p_ed_boarding integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facility RECORD;
  v_occupancy numeric;
  v_alert_level capacity_alert_level;
  v_prev_snapshot RECORD;
  v_trend_1h trend_direction;
  v_snapshot_id uuid;
BEGIN
  -- Get facility
  SELECT * INTO v_facility
  FROM health_system_facilities
  WHERE id = p_facility_id;

  IF v_facility IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Facility not found');
  END IF;

  -- Calculate occupancy
  IF p_total_beds > 0 THEN
    v_occupancy := (p_occupied_beds::numeric / p_total_beds) * 100;
  ELSE
    v_occupancy := 0;
  END IF;

  -- Calculate alert level
  v_alert_level := calculate_capacity_alert_level(v_occupancy, v_facility.divert_status);

  -- Get previous snapshot for trend (1 hour ago)
  SELECT * INTO v_prev_snapshot
  FROM facility_capacity_snapshots
  WHERE facility_id = p_facility_id
    AND snapshot_at <= now() - interval '1 hour'
  ORDER BY snapshot_at DESC
  LIMIT 1;

  -- Calculate trend
  IF v_prev_snapshot IS NOT NULL THEN
    IF p_available_beds > v_prev_snapshot.available_beds THEN
      v_trend_1h := 'up';
    ELSIF p_available_beds < v_prev_snapshot.available_beds THEN
      v_trend_1h := 'down';
    ELSE
      v_trend_1h := 'stable';
    END IF;
  ELSE
    v_trend_1h := 'stable';
  END IF;

  -- Insert snapshot
  INSERT INTO facility_capacity_snapshots (
    tenant_id, facility_id, facility_name, facility_code,
    total_beds, occupied_beds, available_beds, reserved_beds, blocked_beds,
    pending_discharge, pending_admission, occupancy_percent, alert_level,
    icu_occupied, icu_available, step_down_occupied, step_down_available,
    telemetry_occupied, telemetry_available, med_surg_occupied, med_surg_available,
    ed_census, ed_boarding, trend_1h, trend_4h, trend_24h,
    is_accepting_transfers, divert_status
  ) VALUES (
    v_facility.tenant_id, p_facility_id, v_facility.name, v_facility.facility_code,
    p_total_beds, p_occupied_beds, p_available_beds, p_reserved_beds, p_blocked_beds,
    p_pending_discharge, p_pending_admission, v_occupancy, v_alert_level,
    p_icu_occupied, p_icu_available, p_step_down_occupied, p_step_down_available,
    p_telemetry_occupied, p_telemetry_available, p_med_surg_occupied, p_med_surg_available,
    p_ed_census, p_ed_boarding, v_trend_1h, 'stable', 'stable',
    v_facility.is_accepting_transfers, v_facility.divert_status
  )
  RETURNING id INTO v_snapshot_id;

  -- Create alert if level changed to warning or higher
  IF v_alert_level IN ('warning', 'critical', 'divert') THEN
    IF v_prev_snapshot IS NULL OR v_prev_snapshot.alert_level != v_alert_level THEN
      INSERT INTO capacity_alerts (
        tenant_id, facility_id, facility_name,
        alert_level, previous_level, current_occupancy_percent,
        threshold_crossed, message
      ) VALUES (
        v_facility.tenant_id, p_facility_id, v_facility.name,
        v_alert_level,
        CASE WHEN v_prev_snapshot IS NOT NULL THEN v_prev_snapshot.alert_level ELSE 'normal' END,
        v_occupancy,
        CASE v_alert_level
          WHEN 'warning' THEN 80
          WHEN 'critical' THEN 90
          WHEN 'divert' THEN 95
          ELSE 70
        END,
        v_facility.name || ' at ' || round(v_occupancy, 1) || '% occupancy'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'snapshot_id', v_snapshot_id,
    'facility_id', p_facility_id,
    'occupancy_percent', v_occupancy,
    'alert_level', v_alert_level::text,
    'trend', v_trend_1h::text
  );
END;
$$;

-- ============================================================================
-- 8. Function: Get Command Center Summary
-- ============================================================================
CREATE OR REPLACE FUNCTION get_command_center_summary(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_summary jsonb;
  v_facilities jsonb;
  v_total_beds integer;
  v_total_occupied integer;
  v_total_available integer;
  v_divert_count integer;
  v_critical_count integer;
  v_warning_count integer;
  v_ed_boarding integer;
BEGIN
  -- Get latest snapshot per facility
  WITH latest_snapshots AS (
    SELECT DISTINCT ON (facility_id) *
    FROM facility_capacity_snapshots
    WHERE tenant_id = p_tenant_id
    ORDER BY facility_id, snapshot_at DESC
  )
  SELECT
    COALESCE(SUM(total_beds), 0),
    COALESCE(SUM(occupied_beds), 0),
    COALESCE(SUM(available_beds), 0),
    COUNT(*) FILTER (WHERE alert_level = 'divert'),
    COUNT(*) FILTER (WHERE alert_level = 'critical'),
    COUNT(*) FILTER (WHERE alert_level = 'warning'),
    COALESCE(SUM(ed_boarding), 0)
  INTO v_total_beds, v_total_occupied, v_total_available,
       v_divert_count, v_critical_count, v_warning_count, v_ed_boarding
  FROM latest_snapshots;

  -- Get facility details
  SELECT jsonb_agg(to_jsonb(sub) ORDER BY sub.alert_level DESC, sub.occupancy_percent DESC)
  INTO v_facilities
  FROM (
    SELECT DISTINCT ON (facility_id)
      facility_id, facility_name, facility_code,
      total_beds, occupied_beds, available_beds,
      occupancy_percent, alert_level::text,
      icu_available, step_down_available, telemetry_available, med_surg_available,
      ed_census, ed_boarding, trend_1h::text,
      is_accepting_transfers, divert_status, snapshot_at
    FROM facility_capacity_snapshots
    WHERE tenant_id = p_tenant_id
    ORDER BY facility_id, snapshot_at DESC
  ) sub;

  RETURN jsonb_build_object(
    'total_facilities', COALESCE(jsonb_array_length(v_facilities), 0),
    'total_beds', COALESCE(v_total_beds, 0),
    'total_occupied', COALESCE(v_total_occupied, 0),
    'total_available', COALESCE(v_total_available, 0),
    'network_occupancy_percent', CASE WHEN v_total_beds > 0 THEN round((v_total_occupied::numeric / v_total_beds) * 100, 1) ELSE 0 END,
    'facilities_on_divert', COALESCE(v_divert_count, 0),
    'facilities_critical', COALESCE(v_critical_count, 0),
    'facilities_warning', COALESCE(v_warning_count, 0),
    'total_ed_boarding', COALESCE(v_ed_boarding, 0),
    'facilities', COALESCE(v_facilities, '[]'::jsonb),
    'as_of', now()
  );
END;
$$;

-- ============================================================================
-- 9. Function: Acknowledge Alert
-- ============================================================================
CREATE OR REPLACE FUNCTION acknowledge_capacity_alert(
  p_alert_id uuid,
  p_acknowledged_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE capacity_alerts
  SET is_acknowledged = true,
      acknowledged_by = p_acknowledged_by,
      acknowledged_at = now()
  WHERE id = p_alert_id
    AND is_acknowledged = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alert not found or already acknowledged');
  END IF;

  RETURN jsonb_build_object('success', true, 'alert_id', p_alert_id);
END;
$$;

-- ============================================================================
-- 10. Row Level Security
-- ============================================================================
ALTER TABLE health_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_system_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_capacity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_systems_tenant_isolation" ON health_systems
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "health_systems_service_role" ON health_systems
  FOR ALL TO service_role USING (true);

CREATE POLICY "health_system_facilities_tenant_isolation" ON health_system_facilities
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "health_system_facilities_service_role" ON health_system_facilities
  FOR ALL TO service_role USING (true);

CREATE POLICY "facility_capacity_snapshots_tenant_isolation" ON facility_capacity_snapshots
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "facility_capacity_snapshots_service_role" ON facility_capacity_snapshots
  FOR ALL TO service_role USING (true);

CREATE POLICY "capacity_alerts_tenant_isolation" ON capacity_alerts
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "capacity_alerts_service_role" ON capacity_alerts
  FOR ALL TO service_role USING (true);

-- ============================================================================
-- 11. Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON health_systems TO authenticated;
GRANT SELECT, INSERT, UPDATE ON health_system_facilities TO authenticated;
GRANT SELECT, INSERT ON facility_capacity_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON capacity_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_capacity_alert_level TO authenticated;
GRANT EXECUTE ON FUNCTION record_capacity_snapshot TO authenticated;
GRANT EXECUTE ON FUNCTION get_command_center_summary TO authenticated;
GRANT EXECUTE ON FUNCTION acknowledge_capacity_alert TO authenticated;

-- ============================================================================
-- 12. Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Multi-Facility Capacity Migration Complete';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Tables created: health_systems, health_system_facilities, facility_capacity_snapshots, capacity_alerts';
  RAISE NOTICE 'Functions: record_capacity_snapshot, get_command_center_summary, acknowledge_capacity_alert';
  RAISE NOTICE 'Alert thresholds: watch (70%%), warning (80%%), critical (90%%), divert (95%%)';
  RAISE NOTICE 'RLS policies applied for tenant isolation';
  RAISE NOTICE '=================================================================';
END $$;
