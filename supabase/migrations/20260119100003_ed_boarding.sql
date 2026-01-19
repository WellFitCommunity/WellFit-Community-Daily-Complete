-- ============================================================================
-- ED Boarding Management
-- ============================================================================
-- Purpose: Track ED patients waiting for inpatient beds
-- Date: 2026-01-19
--
-- Features:
--   - Real-time boarding time tracking
--   - Automatic escalation at 2hr, 4hr, 8hr, 12hr thresholds
--   - Integration with bed availability
-- ============================================================================

-- ============================================================================
-- 1. ED Boarding Types
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ed_boarder_status') THEN
    CREATE TYPE ed_boarder_status AS ENUM (
      'awaiting_bed', 'bed_assigned', 'in_transport', 'placed', 'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escalation_level') THEN
    CREATE TYPE escalation_level AS ENUM (
      'green', 'yellow', 'orange', 'red', 'critical'
    );
  END IF;
END $$;

-- ============================================================================
-- 2. ED Boarders Table
-- ============================================================================
-- Note: bed_id and unit_id columns are UUID references that will be linked
-- via application logic. FK constraints are not added here to allow independent
-- deployment before the bed management tables are created.
CREATE TABLE IF NOT EXISTS ed_boarders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  patient_name text,
  patient_mrn text,

  -- ED location (bed_id references beds table when available)
  ed_bed_id uuid,
  ed_bed_label text,
  ed_zone text,

  -- Admission details
  admit_decision_at timestamptz NOT NULL DEFAULT now(),
  admitting_physician text,
  admitting_service text,
  admission_diagnosis text,

  -- Bed requirements (unit_id references hospital_units table when available)
  target_unit_type text,
  target_unit_id uuid,
  required_bed_type text,
  requires_telemetry boolean NOT NULL DEFAULT false,
  requires_isolation boolean NOT NULL DEFAULT false,
  requires_negative_pressure boolean NOT NULL DEFAULT false,
  special_requirements text[] DEFAULT '{}',

  -- Patient acuity
  acuity_level text NOT NULL DEFAULT 'MEDIUM' CHECK (acuity_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  is_critical boolean NOT NULL DEFAULT false,

  -- Status tracking (bed_id references beds table when available)
  status ed_boarder_status NOT NULL DEFAULT 'awaiting_bed',
  assigned_bed_id uuid,
  assigned_bed_label text,
  assigned_at timestamptz,
  placed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,

  -- Boarding metrics
  boarding_start_at timestamptz NOT NULL DEFAULT now(),
  -- Note: boarding_minutes is calculated at query time via a view or application logic
  -- Cannot use GENERATED column with now() as it's not immutable
  escalation_level escalation_level NOT NULL DEFAULT 'green',
  last_escalation_at timestamptz,
  escalation_acknowledged boolean NOT NULL DEFAULT false,
  escalation_acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Notes
  notes text,
  barriers_to_placement text[] DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ed_boarders_tenant_status
  ON ed_boarders (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_ed_boarders_escalation
  ON ed_boarders (tenant_id, escalation_level, status)
  WHERE status = 'awaiting_bed';

CREATE INDEX IF NOT EXISTS idx_ed_boarders_boarding_time
  ON ed_boarders (tenant_id, boarding_start_at)
  WHERE status = 'awaiting_bed';

CREATE INDEX IF NOT EXISTS idx_ed_boarders_target_unit
  ON ed_boarders (target_unit_id, status)
  WHERE status = 'awaiting_bed';

-- ============================================================================
-- 3. Function: Calculate Escalation Level
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_escalation_level(p_boarding_minutes integer)
RETURNS escalation_level
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_boarding_minutes < 120 THEN RETURN 'green'; END IF;      -- <2 hours
  IF p_boarding_minutes < 240 THEN RETURN 'yellow'; END IF;     -- 2-4 hours
  IF p_boarding_minutes < 480 THEN RETURN 'orange'; END IF;     -- 4-8 hours
  IF p_boarding_minutes < 720 THEN RETURN 'red'; END IF;        -- 8-12 hours
  RETURN 'critical';                                             -- >12 hours
END;
$$;

-- ============================================================================
-- 4. Function: Update Escalation Level
-- ============================================================================
CREATE OR REPLACE FUNCTION update_ed_boarder_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_level escalation_level;
  v_current_minutes integer;
BEGIN
  -- Only update if awaiting_bed
  IF NEW.status != 'awaiting_bed' THEN
    RETURN NEW;
  END IF;

  -- Calculate current boarding minutes
  v_current_minutes := EXTRACT(EPOCH FROM (now() - NEW.boarding_start_at)) / 60;

  -- Calculate new escalation level
  v_new_level := calculate_escalation_level(v_current_minutes);

  -- Only update if level increased
  IF v_new_level != NEW.escalation_level THEN
    NEW.escalation_level := v_new_level;
    NEW.last_escalation_at := now();
    NEW.escalation_acknowledged := false;
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to update escalation on changes
DROP TRIGGER IF EXISTS trg_update_ed_escalation ON ed_boarders;
CREATE TRIGGER trg_update_ed_escalation
  BEFORE UPDATE ON ed_boarders
  FOR EACH ROW
  EXECUTE FUNCTION update_ed_boarder_escalation();

-- ============================================================================
-- 5. Function: Assign Bed to Boarder
-- ============================================================================
-- Note: This function will work with or without the beds table.
-- If beds table exists, it will validate and reserve the bed.
-- If beds table doesn't exist, it will just update the boarder record.
CREATE OR REPLACE FUNCTION assign_bed_to_ed_boarder(
  p_boarder_id uuid,
  p_bed_id uuid,
  p_bed_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_boarder RECORD;
  v_bed_label text;
  v_beds_exists boolean;
BEGIN
  -- Get boarder
  SELECT * INTO v_boarder
  FROM ed_boarders
  WHERE id = p_boarder_id
    AND status = 'awaiting_bed';

  IF v_boarder IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boarder not found or not awaiting bed');
  END IF;

  -- Check if beds table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'beds'
  ) INTO v_beds_exists;

  v_bed_label := p_bed_label;

  -- If beds table exists, validate and reserve the bed
  IF v_beds_exists THEN
    EXECUTE format('
      SELECT bed_label FROM beds
      WHERE id = $1 AND tenant_id = $2 AND status = %L
    ', 'available')
    INTO v_bed_label
    USING p_bed_id, v_boarder.tenant_id;

    IF v_bed_label IS NULL AND p_bed_label IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Bed not found or not available');
    END IF;

    v_bed_label := COALESCE(p_bed_label, v_bed_label);

    -- Reserve the bed
    EXECUTE format('
      UPDATE beds
      SET status = %L,
          reserved_for_patient_id = $1,
          status_changed_at = now(),
          status_notes = %L
      WHERE id = $2
    ', 'reserved', 'Reserved for ED boarder')
    USING v_boarder.patient_id, p_bed_id;
  END IF;

  -- Update boarder
  UPDATE ed_boarders
  SET status = 'bed_assigned',
      assigned_bed_id = p_bed_id,
      assigned_bed_label = COALESCE(v_bed_label, p_bed_label),
      assigned_at = now(),
      updated_at = now()
  WHERE id = p_boarder_id;

  RETURN jsonb_build_object(
    'success', true,
    'boarder_id', p_boarder_id,
    'bed_id', p_bed_id,
    'bed_label', COALESCE(v_bed_label, p_bed_label)
  );
END;
$$;

-- ============================================================================
-- 6. Function: Place ED Boarder (arrived at bed)
-- ============================================================================
-- Note: This function will work with or without the beds table.
CREATE OR REPLACE FUNCTION place_ed_boarder(
  p_boarder_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_boarder RECORD;
  v_boarding_minutes integer;
  v_beds_exists boolean;
BEGIN
  -- Get boarder
  SELECT * INTO v_boarder
  FROM ed_boarders
  WHERE id = p_boarder_id
    AND status IN ('bed_assigned', 'in_transport');

  IF v_boarder IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boarder not found or wrong status');
  END IF;

  v_boarding_minutes := EXTRACT(EPOCH FROM (now() - v_boarder.boarding_start_at)) / 60;

  -- Update boarder
  UPDATE ed_boarders
  SET status = 'placed',
      placed_at = now(),
      updated_at = now()
  WHERE id = p_boarder_id;

  -- Check if beds table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'beds'
  ) INTO v_beds_exists;

  IF v_beds_exists THEN
    -- Update bed to occupied
    IF v_boarder.assigned_bed_id IS NOT NULL THEN
      EXECUTE format('
        UPDATE beds
        SET status = %L,
            reserved_for_patient_id = NULL,
            status_changed_at = now(),
            status_notes = %L
        WHERE id = $1
      ', 'occupied', 'ED boarder placed')
      USING v_boarder.assigned_bed_id;
    END IF;

    -- Free up ED bed
    IF v_boarder.ed_bed_id IS NOT NULL THEN
      EXECUTE format('
        UPDATE beds
        SET status = %L,
            status_changed_at = now(),
            status_notes = %L
        WHERE id = $1
      ', 'dirty', 'ED patient transferred to inpatient')
      USING v_boarder.ed_bed_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'boarder_id', p_boarder_id,
    'boarding_minutes', v_boarding_minutes,
    'assigned_bed_id', v_boarder.assigned_bed_id,
    'ed_bed_id', v_boarder.ed_bed_id
  );
END;
$$;

-- ============================================================================
-- 7. Function: Get ED Boarding Metrics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_ed_boarding_metrics(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_metrics jsonb;
  v_total integer;
  v_avg_minutes numeric;
  v_max_minutes integer;
  v_pending_transport integer;
  v_by_escalation jsonb;
  v_by_acuity jsonb;
BEGIN
  -- Get total boarders awaiting with calculated boarding_minutes
  SELECT
    COUNT(*),
    AVG(EXTRACT(EPOCH FROM (COALESCE(placed_at, cancelled_at, now()) - boarding_start_at)) / 60),
    MAX(EXTRACT(EPOCH FROM (COALESCE(placed_at, cancelled_at, now()) - boarding_start_at)) / 60)
  INTO v_total, v_avg_minutes, v_max_minutes
  FROM ed_boarders
  WHERE tenant_id = p_tenant_id
    AND status = 'awaiting_bed';

  -- Get pending transport count
  SELECT COUNT(*) INTO v_pending_transport
  FROM ed_boarders
  WHERE tenant_id = p_tenant_id
    AND status = 'bed_assigned';

  -- Count by escalation level
  SELECT jsonb_object_agg(escalation_level::text, cnt)
  INTO v_by_escalation
  FROM (
    SELECT escalation_level, COUNT(*) as cnt
    FROM ed_boarders
    WHERE tenant_id = p_tenant_id
      AND status = 'awaiting_bed'
    GROUP BY escalation_level
  ) sub;

  -- Count by acuity
  SELECT jsonb_object_agg(acuity_level, cnt)
  INTO v_by_acuity
  FROM (
    SELECT acuity_level, COUNT(*) as cnt
    FROM ed_boarders
    WHERE tenant_id = p_tenant_id
      AND status = 'awaiting_bed'
    GROUP BY acuity_level
  ) sub;

  RETURN jsonb_build_object(
    'total_boarders', COALESCE(v_total, 0),
    'avg_boarding_minutes', COALESCE(v_avg_minutes, 0),
    'longest_boarding_minutes', COALESCE(v_max_minutes, 0),
    'beds_assigned_pending_transport', COALESCE(v_pending_transport, 0),
    'boarders_by_escalation', COALESCE(v_by_escalation, '{}'::jsonb),
    'boarders_by_acuity', COALESCE(v_by_acuity, '{}'::jsonb),
    'target_boarding_minutes', 240
  );
END;
$$;

-- ============================================================================
-- 7.5. View: ED Boarders with calculated boarding_minutes
-- ============================================================================
CREATE OR REPLACE VIEW ed_boarders_with_metrics AS
SELECT
  *,
  EXTRACT(EPOCH FROM (COALESCE(placed_at, cancelled_at, now()) - boarding_start_at)) / 60 AS boarding_minutes
FROM ed_boarders;

COMMENT ON VIEW ed_boarders_with_metrics IS 'ED boarders with calculated boarding_minutes';

-- ============================================================================
-- 8. Row Level Security
-- ============================================================================
ALTER TABLE ed_boarders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ed_boarders_tenant_isolation" ON ed_boarders
  FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY "ed_boarders_service_role" ON ed_boarders
  FOR ALL TO service_role USING (true);

-- ============================================================================
-- 9. Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON ed_boarders TO authenticated;
GRANT SELECT ON ed_boarders_with_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_escalation_level TO authenticated;
GRANT EXECUTE ON FUNCTION assign_bed_to_ed_boarder TO authenticated;
GRANT EXECUTE ON FUNCTION place_ed_boarder TO authenticated;
GRANT EXECUTE ON FUNCTION get_ed_boarding_metrics TO authenticated;

-- ============================================================================
-- 10. Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'ED Boarding Management Migration Complete';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Table created: ed_boarders';
  RAISE NOTICE 'Escalation levels: green (<2h), yellow (2-4h), orange (4-8h), red (8-12h), critical (>12h)';
  RAISE NOTICE 'Functions: assign_bed_to_ed_boarder, place_ed_boarder, get_ed_boarding_metrics';
  RAISE NOTICE 'RLS policies applied for tenant isolation';
  RAISE NOTICE '=================================================================';
END $$;
