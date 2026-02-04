-- =============================================================================
-- Migration: welfare_check_reports
-- Purpose: Create table for storing welfare check reports filed by officers
-- Phase 3 of The SHIELD Program (Senior & Health-Impaired Emergency Liaison Dispatch)
-- =============================================================================

-- Create the welfare check outcome enum with 7 values
CREATE TYPE welfare_check_outcome AS ENUM (
  'senior_ok',
  'senior_ok_needs_followup',
  'senior_not_home',
  'medical_emergency',
  'non_medical_emergency',
  'unable_to_contact',
  'refused_check'
);

-- Create the welfare_check_reports table
CREATE TABLE IF NOT EXISTS welfare_check_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES auth.users(id),
  officer_id UUID NOT NULL REFERENCES auth.users(id),
  officer_name TEXT NOT NULL,

  -- Check timing
  check_initiated_at TIMESTAMPTZ NOT NULL,
  check_completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Computed response time (stored for query performance)
  response_time_minutes NUMERIC GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (check_completed_at - check_initiated_at)) / 60.0
  ) STORED,

  -- Outcome
  outcome welfare_check_outcome NOT NULL,
  outcome_notes TEXT,

  -- Actions taken
  ems_called BOOLEAN NOT NULL DEFAULT FALSE,
  family_notified BOOLEAN NOT NULL DEFAULT FALSE,
  actions_taken TEXT[] DEFAULT '{}',

  -- Transport (for medical_emergency outcomes)
  transported_to TEXT,
  transport_reason TEXT,

  -- Follow-up
  followup_required BOOLEAN NOT NULL DEFAULT FALSE,
  followup_date DATE,
  followup_notes TEXT,

  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint to prevent duplicate reports
  CONSTRAINT uq_welfare_check_report UNIQUE (patient_id, officer_id, check_initiated_at)
);

-- Add table comment
COMMENT ON TABLE welfare_check_reports IS 'Welfare check reports filed by officers after completing senior welfare checks (SHIELD Program Phase 3)';
COMMENT ON COLUMN welfare_check_reports.response_time_minutes IS 'Auto-computed response time in minutes between initiation and completion';

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_welfare_check_reports_tenant
  ON welfare_check_reports(tenant_id);

CREATE INDEX idx_welfare_check_reports_patient
  ON welfare_check_reports(patient_id);

CREATE INDEX idx_welfare_check_reports_officer
  ON welfare_check_reports(officer_id);

CREATE INDEX idx_welfare_check_reports_initiated_at
  ON welfare_check_reports(check_initiated_at DESC);

CREATE INDEX idx_welfare_check_reports_outcome
  ON welfare_check_reports(outcome);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE welfare_check_reports ENABLE ROW LEVEL SECURITY;

-- Officers can read reports within their tenant
CREATE POLICY "welfare_check_reports_select_tenant"
  ON welfare_check_reports FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Officers can insert reports for their own tenant
CREATE POLICY "welfare_check_reports_insert_officer"
  ON welfare_check_reports FOR INSERT
  WITH CHECK (
    officer_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Officers can update only their own reports
CREATE POLICY "welfare_check_reports_update_own"
  ON welfare_check_reports FOR UPDATE
  USING (
    officer_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp (reuse existing function)
CREATE TRIGGER welfare_check_reports_updated_at
  BEFORE UPDATE ON welfare_check_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- AUDIT LOG
-- =============================================================================
COMMENT ON POLICY "welfare_check_reports_select_tenant" ON welfare_check_reports IS
  'HIPAA: Officers can read welfare check reports within their tenant for continuity of care';
COMMENT ON POLICY "welfare_check_reports_insert_officer" ON welfare_check_reports IS
  'HIPAA: Officers can file welfare check reports only for their own tenant and user ID';
COMMENT ON POLICY "welfare_check_reports_update_own" ON welfare_check_reports IS
  'HIPAA: Officers can update only their own welfare check reports';
