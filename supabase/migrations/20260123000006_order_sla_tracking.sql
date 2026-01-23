-- Order SLA Tracking System
-- Purpose: Add SLA tracking and breach detection for clinical orders
-- Compliance: Healthcare operational excellence, HIPAA § 164.308(a)(6)

-- ============================================================================
-- 1. CREATE ORDERS TABLES WITH SLA TRACKING (IF NOT EXISTS)
-- ============================================================================

-- Lab Orders Table
CREATE TABLE IF NOT EXISTS lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  patient_id UUID NOT NULL,

  -- Order identification
  internal_order_id TEXT NOT NULL,
  external_order_id TEXT,
  accession_number TEXT,

  -- Provider info
  ordering_provider_id UUID,
  ordering_provider_npi TEXT,

  -- Status
  order_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    order_status IN ('pending', 'submitted', 'received', 'in_progress', 'resulted', 'partial', 'cancelled', 'error')
  ),
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('stat', 'asap', 'routine', 'preop', 'callback')),

  -- Clinical
  diagnosis_codes TEXT[],
  clinical_notes TEXT,

  -- Timing
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  received_by_lab_at TIMESTAMPTZ,
  expected_results_at TIMESTAMPTZ,
  resulted_at TIMESTAMPTZ,

  -- SLA Tracking
  sla_target_minutes INTEGER,
  sla_breach_at TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT FALSE,
  sla_acknowledged_at TIMESTAMPTZ,
  sla_acknowledged_by UUID,

  -- Escalation
  escalation_level INTEGER DEFAULT 0,
  last_escalation_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Imaging Orders Table
CREATE TABLE IF NOT EXISTS imaging_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  patient_id UUID NOT NULL,

  -- Order identification
  internal_order_id TEXT NOT NULL,
  accession_number TEXT,

  -- Provider
  ordering_provider_id UUID,
  ordering_provider_npi TEXT,

  -- Details
  modality TEXT,
  procedure_code TEXT,
  procedure_name TEXT,
  body_part TEXT,
  laterality TEXT CHECK (laterality IN ('LEFT', 'RIGHT', 'BILATERAL', 'N/A')),
  reason_for_exam TEXT,
  diagnosis_codes TEXT[],

  -- Status
  order_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    order_status IN ('pending', 'scheduled', 'in_progress', 'completed', 'dictated', 'finalized', 'cancelled', 'no_show')
  ),
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('stat', 'urgent', 'routine', 'scheduled')),

  -- Timing
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  performed_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,

  -- SLA Tracking
  sla_target_minutes INTEGER,
  sla_breach_at TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT FALSE,
  sla_acknowledged_at TIMESTAMPTZ,
  sla_acknowledged_by UUID,

  -- Escalation
  escalation_level INTEGER DEFAULT 0,
  last_escalation_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refill Requests Table (if not exists)
CREATE TABLE IF NOT EXISTS refill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  patient_id UUID NOT NULL,

  -- Medication info
  medication_name TEXT NOT NULL,
  medication_ndc TEXT,
  quantity INTEGER,
  days_supply INTEGER,
  refills_remaining INTEGER,

  -- Provider
  prescriber_id UUID,
  prescriber_npi TEXT,

  -- Pharmacy
  pharmacy_name TEXT,
  pharmacy_ncpdp_id TEXT,

  -- Status
  request_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    request_status IN ('pending', 'approved', 'denied', 'sent_to_pharmacy', 'filled', 'cancelled')
  ),
  priority TEXT DEFAULT 'routine' CHECK (priority IN ('urgent', 'routine')),

  -- Timing
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  filled_at TIMESTAMPTZ,

  -- SLA Tracking
  sla_target_minutes INTEGER,
  sla_breach_at TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT FALSE,
  sla_acknowledged_at TIMESTAMPTZ,
  sla_acknowledged_by UUID,

  -- Escalation
  escalation_level INTEGER DEFAULT 0,
  last_escalation_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. SLA CONFIGURATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,

  -- Order type configuration
  order_type TEXT NOT NULL CHECK (order_type IN ('lab_order', 'imaging_order', 'refill_request')),
  priority TEXT NOT NULL CHECK (priority IN ('stat', 'asap', 'urgent', 'routine', 'scheduled', 'preop', 'callback')),

  -- SLA targets (in minutes)
  target_minutes INTEGER NOT NULL,
  warning_minutes INTEGER, -- Minutes before breach to warn

  -- Escalation config
  escalation_1_minutes INTEGER, -- Minutes after breach to escalate to level 1
  escalation_2_minutes INTEGER, -- Minutes after breach to escalate to level 2
  escalation_3_minutes INTEGER, -- Minutes after breach to escalate to level 3

  -- Notifications
  notify_on_breach BOOLEAN DEFAULT TRUE,
  notify_on_warning BOOLEAN DEFAULT TRUE,
  notification_channels TEXT[] DEFAULT ARRAY['in_app'],

  -- Recipients for escalation
  escalation_1_recipients UUID[],
  escalation_2_recipients UUID[],
  escalation_3_recipients UUID[],

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, order_type, priority)
);

-- ============================================================================
-- 3. SLA BREACH LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_sla_breach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Order reference
  order_type TEXT NOT NULL,
  order_id UUID NOT NULL,
  patient_id UUID NOT NULL,

  -- Breach details
  sla_target_minutes INTEGER NOT NULL,
  actual_minutes INTEGER,
  breach_severity TEXT CHECK (breach_severity IN ('warning', 'breach', 'critical')),

  -- Timing
  order_created_at TIMESTAMPTZ NOT NULL,
  sla_breach_at TIMESTAMPTZ NOT NULL,
  breached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,

  -- Escalation tracking
  escalation_level INTEGER DEFAULT 0,
  escalation_history JSONB DEFAULT '[]',

  -- Notifications sent
  notifications_sent JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_breach ON lab_orders(sla_breached) WHERE sla_breached = TRUE;
CREATE INDEX IF NOT EXISTS idx_lab_orders_breach_at ON lab_orders(sla_breach_at) WHERE sla_breached = FALSE;

CREATE INDEX IF NOT EXISTS idx_imaging_orders_patient ON imaging_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_status ON imaging_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_breach ON imaging_orders(sla_breached) WHERE sla_breached = TRUE;
CREATE INDEX IF NOT EXISTS idx_imaging_orders_breach_at ON imaging_orders(sla_breach_at) WHERE sla_breached = FALSE;

CREATE INDEX IF NOT EXISTS idx_refill_requests_patient ON refill_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_refill_requests_status ON refill_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_refill_requests_breach ON refill_requests(sla_breached) WHERE sla_breached = TRUE;

CREATE INDEX IF NOT EXISTS idx_sla_breach_log_order ON order_sla_breach_log(order_type, order_id);
CREATE INDEX IF NOT EXISTS idx_sla_breach_log_unresolved ON order_sla_breach_log(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- Function to calculate and set SLA breach time when order is created
CREATE OR REPLACE FUNCTION set_order_sla_breach_time()
RETURNS TRIGGER AS $$
DECLARE
  v_target_minutes INTEGER;
  v_order_type TEXT;
  v_priority TEXT;
BEGIN
  -- Determine order type
  v_order_type := TG_TABLE_NAME;

  -- Get priority
  IF v_order_type = 'lab_orders' OR v_order_type = 'imaging_orders' THEN
    v_priority := NEW.priority;
  ELSIF v_order_type = 'refill_requests' THEN
    v_priority := NEW.priority;
  END IF;

  -- Look up SLA config
  SELECT target_minutes INTO v_target_minutes
  FROM order_sla_config
  WHERE order_type = v_order_type
    AND priority = v_priority
    AND is_active = TRUE
    AND (tenant_id IS NULL OR tenant_id = NEW.tenant_id)
  ORDER BY tenant_id NULLS LAST
  LIMIT 1;

  -- If no config found, use defaults
  IF v_target_minutes IS NULL THEN
    v_target_minutes := CASE
      WHEN v_priority = 'stat' THEN 60      -- 1 hour
      WHEN v_priority = 'asap' THEN 120     -- 2 hours
      WHEN v_priority = 'urgent' THEN 240   -- 4 hours
      ELSE 1440                              -- 24 hours (routine)
    END;
  END IF;

  -- Set SLA fields
  NEW.sla_target_minutes := v_target_minutes;
  NEW.sla_breach_at := NEW.created_at + (v_target_minutes || ' minutes')::INTERVAL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for SLA time calculation
DROP TRIGGER IF EXISTS trg_lab_orders_sla ON lab_orders;
CREATE TRIGGER trg_lab_orders_sla
  BEFORE INSERT ON lab_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_sla_breach_time();

DROP TRIGGER IF EXISTS trg_imaging_orders_sla ON imaging_orders;
CREATE TRIGGER trg_imaging_orders_sla
  BEFORE INSERT ON imaging_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_sla_breach_time();

DROP TRIGGER IF EXISTS trg_refill_requests_sla ON refill_requests;
CREATE TRIGGER trg_refill_requests_sla
  BEFORE INSERT ON refill_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_order_sla_breach_time();

-- Function to check for SLA breaches
CREATE OR REPLACE FUNCTION check_sla_breaches()
RETURNS JSONB AS $$
DECLARE
  v_breached_count INTEGER := 0;
  v_order RECORD;
  v_result JSONB;
BEGIN
  -- Check lab orders
  FOR v_order IN
    SELECT id, patient_id, sla_target_minutes, ordered_at, sla_breach_at
    FROM lab_orders
    WHERE sla_breached = FALSE
      AND sla_breach_at < NOW()
      AND order_status NOT IN ('resulted', 'cancelled')
  LOOP
    -- Mark as breached
    UPDATE lab_orders
    SET sla_breached = TRUE, updated_at = NOW()
    WHERE id = v_order.id;

    -- Log breach
    INSERT INTO order_sla_breach_log (
      order_type, order_id, patient_id, sla_target_minutes,
      order_created_at, sla_breach_at, breach_severity
    ) VALUES (
      'lab_order', v_order.id, v_order.patient_id, v_order.sla_target_minutes,
      v_order.ordered_at, v_order.sla_breach_at, 'breach'
    );

    v_breached_count := v_breached_count + 1;
  END LOOP;

  -- Check imaging orders
  FOR v_order IN
    SELECT id, patient_id, sla_target_minutes, ordered_at, sla_breach_at
    FROM imaging_orders
    WHERE sla_breached = FALSE
      AND sla_breach_at < NOW()
      AND order_status NOT IN ('finalized', 'cancelled', 'no_show')
  LOOP
    UPDATE imaging_orders
    SET sla_breached = TRUE, updated_at = NOW()
    WHERE id = v_order.id;

    INSERT INTO order_sla_breach_log (
      order_type, order_id, patient_id, sla_target_minutes,
      order_created_at, sla_breach_at, breach_severity
    ) VALUES (
      'imaging_order', v_order.id, v_order.patient_id, v_order.sla_target_minutes,
      v_order.ordered_at, v_order.sla_breach_at, 'breach'
    );

    v_breached_count := v_breached_count + 1;
  END LOOP;

  -- Check refill requests
  FOR v_order IN
    SELECT id, patient_id, sla_target_minutes, requested_at, sla_breach_at
    FROM refill_requests
    WHERE sla_breached = FALSE
      AND sla_breach_at < NOW()
      AND request_status NOT IN ('filled', 'cancelled', 'denied')
  LOOP
    UPDATE refill_requests
    SET sla_breached = TRUE, updated_at = NOW()
    WHERE id = v_order.id;

    INSERT INTO order_sla_breach_log (
      order_type, order_id, patient_id, sla_target_minutes,
      order_created_at, sla_breach_at, breach_severity
    ) VALUES (
      'refill_request', v_order.id, v_order.patient_id, v_order.sla_target_minutes,
      v_order.requested_at, v_order.sla_breach_at, 'breach'
    );

    v_breached_count := v_breached_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'checked_at', NOW(),
    'breaches_detected', v_breached_count,
    'message', format('SLA check complete. %s new breaches detected.', v_breached_count)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get SLA dashboard metrics
CREATE OR REPLACE FUNCTION get_sla_dashboard_metrics(
  p_tenant_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
  p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_lab_metrics JSONB;
  v_imaging_metrics JSONB;
  v_refill_metrics JSONB;
BEGIN
  -- Lab order metrics
  SELECT jsonb_build_object(
    'total_orders', COUNT(*),
    'completed_orders', COUNT(*) FILTER (WHERE order_status = 'resulted'),
    'breached_orders', COUNT(*) FILTER (WHERE sla_breached = TRUE),
    'active_breaches', COUNT(*) FILTER (WHERE sla_breached = TRUE AND order_status NOT IN ('resulted', 'cancelled')),
    'compliance_rate', ROUND(
      100.0 * COUNT(*) FILTER (WHERE order_status = 'resulted' AND sla_breached = FALSE) /
      NULLIF(COUNT(*) FILTER (WHERE order_status = 'resulted'), 0),
      2
    ),
    'avg_completion_minutes', ROUND(
      AVG(EXTRACT(EPOCH FROM (resulted_at - ordered_at)) / 60) FILTER (WHERE resulted_at IS NOT NULL),
      0
    )
  ) INTO v_lab_metrics
  FROM lab_orders
  WHERE ordered_at BETWEEN p_date_from AND p_date_to
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  -- Imaging order metrics
  SELECT jsonb_build_object(
    'total_orders', COUNT(*),
    'completed_orders', COUNT(*) FILTER (WHERE order_status = 'finalized'),
    'breached_orders', COUNT(*) FILTER (WHERE sla_breached = TRUE),
    'active_breaches', COUNT(*) FILTER (WHERE sla_breached = TRUE AND order_status NOT IN ('finalized', 'cancelled', 'no_show')),
    'compliance_rate', ROUND(
      100.0 * COUNT(*) FILTER (WHERE order_status = 'finalized' AND sla_breached = FALSE) /
      NULLIF(COUNT(*) FILTER (WHERE order_status = 'finalized'), 0),
      2
    ),
    'avg_completion_minutes', ROUND(
      AVG(EXTRACT(EPOCH FROM (finalized_at - ordered_at)) / 60) FILTER (WHERE finalized_at IS NOT NULL),
      0
    )
  ) INTO v_imaging_metrics
  FROM imaging_orders
  WHERE ordered_at BETWEEN p_date_from AND p_date_to
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  -- Refill request metrics
  SELECT jsonb_build_object(
    'total_requests', COUNT(*),
    'completed_requests', COUNT(*) FILTER (WHERE request_status = 'filled'),
    'breached_requests', COUNT(*) FILTER (WHERE sla_breached = TRUE),
    'active_breaches', COUNT(*) FILTER (WHERE sla_breached = TRUE AND request_status NOT IN ('filled', 'cancelled', 'denied')),
    'compliance_rate', ROUND(
      100.0 * COUNT(*) FILTER (WHERE request_status = 'filled' AND sla_breached = FALSE) /
      NULLIF(COUNT(*) FILTER (WHERE request_status = 'filled'), 0),
      2
    ),
    'avg_completion_minutes', ROUND(
      AVG(EXTRACT(EPOCH FROM (filled_at - requested_at)) / 60) FILTER (WHERE filled_at IS NOT NULL),
      0
    )
  ) INTO v_refill_metrics
  FROM refill_requests
  WHERE requested_at BETWEEN p_date_from AND p_date_to
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  -- Build result
  v_result := jsonb_build_object(
    'period', jsonb_build_object('from', p_date_from, 'to', p_date_to),
    'lab_orders', v_lab_metrics,
    'imaging_orders', v_imaging_metrics,
    'refill_requests', v_refill_metrics,
    'overall', jsonb_build_object(
      'total_active_breaches',
        COALESCE((v_lab_metrics->>'active_breaches')::INTEGER, 0) +
        COALESCE((v_imaging_metrics->>'active_breaches')::INTEGER, 0) +
        COALESCE((v_refill_metrics->>'active_breaches')::INTEGER, 0),
      'avg_compliance_rate', ROUND(
        (COALESCE((v_lab_metrics->>'compliance_rate')::NUMERIC, 0) +
         COALESCE((v_imaging_metrics->>'compliance_rate')::NUMERIC, 0) +
         COALESCE((v_refill_metrics->>'compliance_rate')::NUMERIC, 0)) / 3,
        2
      )
    )
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to acknowledge SLA breach
CREATE OR REPLACE FUNCTION acknowledge_sla_breach(
  p_order_type TEXT,
  p_order_id UUID,
  p_acknowledged_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Update the appropriate order table
  IF p_order_type = 'lab_order' THEN
    UPDATE lab_orders
    SET sla_acknowledged_at = NOW(),
        sla_acknowledged_by = p_acknowledged_by,
        updated_at = NOW()
    WHERE id = p_order_id;
  ELSIF p_order_type = 'imaging_order' THEN
    UPDATE imaging_orders
    SET sla_acknowledged_at = NOW(),
        sla_acknowledged_by = p_acknowledged_by,
        updated_at = NOW()
    WHERE id = p_order_id;
  ELSIF p_order_type = 'refill_request' THEN
    UPDATE refill_requests
    SET sla_acknowledged_at = NOW(),
        sla_acknowledged_by = p_acknowledged_by,
        updated_at = NOW()
    WHERE id = p_order_id;
  ELSE
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid order type');
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'order_type', p_order_type,
    'order_id', p_order_id,
    'acknowledged_at', NOW(),
    'acknowledged_by', p_acknowledged_by
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resolve SLA breach
CREATE OR REPLACE FUNCTION resolve_sla_breach(
  p_breach_id UUID,
  p_resolved_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  UPDATE order_sla_breach_log
  SET resolved_at = NOW(),
      resolved_by = p_resolved_by,
      resolution_notes = p_notes
  WHERE id = p_breach_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Breach not found');
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'breach_id', p_breach_id,
    'resolved_at', NOW(),
    'resolved_by', p_resolved_by
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE imaging_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE refill_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_sla_breach_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with proper roles to access orders
CREATE POLICY "Clinical staff can view orders"
  ON lab_orders FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Clinical staff can manage orders"
  ON lab_orders FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'provider', 'nurse', 'care_coordinator')
    )
  );

CREATE POLICY "Clinical staff can view imaging orders"
  ON imaging_orders FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Clinical staff can manage imaging orders"
  ON imaging_orders FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'provider', 'nurse', 'care_coordinator')
    )
  );

CREATE POLICY "Clinical staff can view refills"
  ON refill_requests FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Clinical staff can manage refills"
  ON refill_requests FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'provider', 'nurse', 'pharmacist')
    )
  );

CREATE POLICY "Admins can manage SLA config"
  ON order_sla_config FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Staff can view SLA breaches"
  ON order_sla_breach_log FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Staff can manage SLA breaches"
  ON order_sla_breach_log FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'provider', 'nurse', 'care_coordinator')
    )
  );

-- ============================================================================
-- 7. DEFAULT SLA CONFIGURATIONS
-- ============================================================================

INSERT INTO order_sla_config (order_type, priority, target_minutes, warning_minutes, escalation_1_minutes, escalation_2_minutes, escalation_3_minutes)
VALUES
  -- Lab orders
  ('lab_order', 'stat', 60, 45, 15, 30, 60),
  ('lab_order', 'asap', 120, 90, 30, 60, 120),
  ('lab_order', 'routine', 1440, 1200, 60, 180, 360),
  ('lab_order', 'preop', 480, 360, 60, 120, 240),
  ('lab_order', 'callback', 720, 540, 60, 180, 360),

  -- Imaging orders
  ('imaging_order', 'stat', 120, 90, 30, 60, 120),
  ('imaging_order', 'urgent', 240, 180, 60, 120, 240),
  ('imaging_order', 'routine', 4320, 3600, 120, 480, 1440),
  ('imaging_order', 'scheduled', 10080, 8640, 240, 1440, 4320),

  -- Refill requests
  ('refill_request', 'urgent', 240, 180, 30, 60, 120),
  ('refill_request', 'routine', 1440, 1200, 60, 240, 720)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE lab_orders IS 'Laboratory test orders with SLA tracking';
COMMENT ON TABLE imaging_orders IS 'Imaging/radiology orders with SLA tracking';
COMMENT ON TABLE refill_requests IS 'Medication refill requests with SLA tracking';
COMMENT ON TABLE order_sla_config IS 'SLA targets and escalation configuration by order type and priority';
COMMENT ON TABLE order_sla_breach_log IS 'Log of SLA breaches for compliance reporting';
COMMENT ON FUNCTION check_sla_breaches IS 'Checks for and logs new SLA breaches - run periodically via cron';
COMMENT ON FUNCTION get_sla_dashboard_metrics IS 'Returns SLA compliance metrics for dashboard display';
COMMENT ON FUNCTION acknowledge_sla_breach IS 'Acknowledge an SLA breach to stop escalations';
COMMENT ON FUNCTION resolve_sla_breach IS 'Mark an SLA breach as resolved with notes';
