-- Migration: Provider Coverage / On-Call System (Phase 1 P8)
-- Purpose: Tables, views, and functions for provider absence coverage
-- routing, on-call rotation schedules, and automatic task rerouting.

-- ============================================================================
-- TABLE: provider_on_call_schedules
-- ============================================================================
-- On-call rotation schedules for providers by facility/unit/day/shift.
CREATE TABLE IF NOT EXISTS provider_on_call_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES hospital_units(id) ON DELETE SET NULL,
  schedule_date DATE NOT NULL,
  shift_start TIME NOT NULL DEFAULT '07:00',
  shift_end TIME NOT NULL DEFAULT '19:00',
  shift_type TEXT NOT NULL CHECK (shift_type IN ('day', 'night', 'swing', '24hr')),
  coverage_role TEXT NOT NULL CHECK (coverage_role IN ('primary', 'secondary', 'backup')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, schedule_date, shift_type, tenant_id)
);

-- ============================================================================
-- TABLE: provider_coverage_assignments
-- ============================================================================
-- Coverage routing when a provider is absent (vacation, PTO, sick, etc.)
CREATE TABLE IF NOT EXISTS provider_coverage_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  absent_provider_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  coverage_provider_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES hospital_units(id) ON DELETE SET NULL,
  effective_start TIMESTAMPTZ NOT NULL,
  effective_end TIMESTAMPTZ NOT NULL,
  coverage_reason TEXT NOT NULL CHECK (coverage_reason IN (
    'vacation', 'pto', 'sick', 'training', 'personal', 'on_call_swap', 'other'
  )),
  coverage_priority INTEGER NOT NULL DEFAULT 1 CHECK (coverage_priority BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  auto_route_tasks BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coverage_not_self CHECK (absent_provider_id != coverage_provider_id),
  CONSTRAINT effective_range_valid CHECK (effective_end > effective_start)
);

-- ============================================================================
-- TABLE: provider_coverage_audit
-- ============================================================================
-- Immutable audit trail for coverage actions.
CREATE TABLE IF NOT EXISTS provider_coverage_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coverage_assignment_id UUID REFERENCES provider_coverage_assignments(id) ON DELETE SET NULL,
  on_call_schedule_id UUID REFERENCES provider_on_call_schedules(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'activated', 'completed', 'cancelled', 'task_routed', 'task_declined'
  )),
  actor_id UUID REFERENCES auth.users(id),
  details JSONB DEFAULT '{}',
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_oncall_provider_date
  ON provider_on_call_schedules(provider_id, schedule_date);

CREATE INDEX IF NOT EXISTS idx_oncall_active
  ON provider_on_call_schedules(is_active, schedule_date)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_coverage_absent
  ON provider_coverage_assignments(absent_provider_id);

CREATE INDEX IF NOT EXISTS idx_coverage_dates
  ON provider_coverage_assignments(effective_start, effective_end);

CREATE INDEX IF NOT EXISTS idx_coverage_active
  ON provider_coverage_assignments(status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_coverage_audit_assignment
  ON provider_coverage_audit(coverage_assignment_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE provider_on_call_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_coverage_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_coverage_audit ENABLE ROW LEVEL SECURITY;

-- On-Call Schedules — admin/super_admin full CRUD
CREATE POLICY "Admins can manage on-call schedules"
  ON provider_on_call_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- On-Call Schedules — physician/nurse can SELECT
CREATE POLICY "Clinical staff can view on-call schedules"
  ON provider_on_call_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('physician', 'nurse')
    )
  );

-- Coverage Assignments — admin/super_admin full CRUD
CREATE POLICY "Admins can manage coverage assignments"
  ON provider_coverage_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Coverage Assignments — physician/nurse can SELECT
CREATE POLICY "Clinical staff can view coverage assignments"
  ON provider_coverage_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('physician', 'nurse')
    )
  );

-- Coverage Assignments — physician can INSERT (request coverage)
CREATE POLICY "Physicians can request coverage"
  ON provider_coverage_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'physician'
    )
  );

-- Coverage Audit — admin/super_admin full CRUD
CREATE POLICY "Admins can manage coverage audit"
  ON provider_coverage_audit FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Coverage Audit — physician/nurse can SELECT
CREATE POLICY "Clinical staff can view coverage audit"
  ON provider_coverage_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('physician', 'nurse')
    )
  );

-- ============================================================================
-- VIEW: v_provider_coverage_summary
-- ============================================================================
-- Enriched view of coverage assignments with provider names and computed status.
CREATE OR REPLACE VIEW v_provider_coverage_summary WITH (security_invoker = on) AS
SELECT
  ca.id,
  ca.absent_provider_id,
  ap.first_name AS absent_first_name,
  ap.last_name AS absent_last_name,
  ca.coverage_provider_id,
  cp.first_name AS coverage_first_name,
  cp.last_name AS coverage_last_name,
  ca.facility_id,
  ca.unit_id,
  ca.effective_start,
  ca.effective_end,
  ca.coverage_reason,
  ca.coverage_priority,
  ca.status,
  ca.auto_route_tasks,
  ca.notes,
  ca.tenant_id,
  ca.approved_by,
  ca.approved_at,
  ca.created_by,
  ca.created_at,
  ca.updated_at,
  CASE
    WHEN ca.status = 'cancelled' THEN 'cancelled'
    WHEN NOW() < ca.effective_start THEN 'upcoming'
    WHEN NOW() BETWEEN ca.effective_start AND ca.effective_end THEN 'active'
    ELSE 'completed'
  END AS computed_status
FROM provider_coverage_assignments ca
LEFT JOIN profiles ap ON ap.user_id = ca.absent_provider_id
LEFT JOIN profiles cp ON cp.user_id = ca.coverage_provider_id;

-- ============================================================================
-- FUNCTION: get_coverage_provider
-- ============================================================================
-- Returns the best coverage provider (ordered by priority) for a given
-- absent provider at a given point in time.
CREATE OR REPLACE FUNCTION get_coverage_provider(
  p_absent_provider_id UUID,
  p_at_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  coverage_provider_id UUID,
  coverage_priority INTEGER,
  coverage_reason TEXT,
  auto_route_tasks BOOLEAN,
  assignment_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.coverage_provider_id,
    ca.coverage_priority,
    ca.coverage_reason,
    ca.auto_route_tasks,
    ca.id AS assignment_id
  FROM provider_coverage_assignments ca
  WHERE ca.absent_provider_id = p_absent_provider_id
    AND ca.status = 'active'
    AND p_at_time BETWEEN ca.effective_start AND ca.effective_end
  ORDER BY ca.coverage_priority ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
