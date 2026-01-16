-- =====================================================
-- Prior Authorization System
-- CMS-0057-F Compliance (January 2027 Mandate)
-- =====================================================
-- This migration creates the database schema for:
-- - Prior authorization requests and tracking
-- - Decision history and appeals
-- - FHIR PriorAuthorizationRequest resource mapping
-- - Response time SLA tracking (72hr expedited, 7 day standard)
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- Prior authorization status workflow
CREATE TYPE prior_auth_status AS ENUM (
  'draft',
  'pending_submission',
  'submitted',
  'pending_review',
  'approved',
  'denied',
  'partial_approval',
  'pending_additional_info',
  'cancelled',
  'expired',
  'appealed'
);

-- Prior authorization urgency (CMS response time requirements)
CREATE TYPE prior_auth_urgency AS ENUM (
  'stat',       -- 4 hours (life-threatening)
  'urgent',     -- 72 hours (CMS mandate)
  'routine'     -- 7 calendar days (CMS mandate)
);

-- Decision types
CREATE TYPE prior_auth_decision_type AS ENUM (
  'approved',
  'denied',
  'partial_approval',
  'pended',
  'cancelled'
);

-- Appeal status
CREATE TYPE prior_auth_appeal_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'peer_to_peer_scheduled',
  'peer_to_peer_completed',
  'approved',
  'denied',
  'withdrawn'
);

-- =====================================================
-- MAIN TABLES
-- =====================================================

-- Prior Authorization Requests
CREATE TABLE IF NOT EXISTS prior_authorizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  patient_id UUID NOT NULL,
  encounter_id UUID,
  claim_id UUID,
  ordering_provider_npi VARCHAR(10),
  rendering_provider_npi VARCHAR(10),
  facility_npi VARCHAR(10),

  -- Payer information
  payer_id VARCHAR(50) NOT NULL,
  payer_name VARCHAR(255),
  member_id VARCHAR(50),
  group_number VARCHAR(50),

  -- Authorization details
  auth_number VARCHAR(100) UNIQUE,
  reference_number VARCHAR(100),
  trace_number VARCHAR(100),

  -- Service information
  service_type_code VARCHAR(10),
  service_type_description VARCHAR(255),
  service_codes TEXT[] NOT NULL DEFAULT '{}',
  diagnosis_codes TEXT[] NOT NULL DEFAULT '{}',

  -- Dates
  date_of_service DATE,
  service_start_date DATE,
  service_end_date DATE,
  submitted_at TIMESTAMPTZ,
  decision_due_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Status and urgency
  status prior_auth_status NOT NULL DEFAULT 'draft',
  urgency prior_auth_urgency NOT NULL DEFAULT 'routine',

  -- Clinical information
  clinical_notes TEXT,
  clinical_summary TEXT,
  documentation_submitted TEXT[] DEFAULT '{}',

  -- Quantity/Units
  requested_units INTEGER,
  approved_units INTEGER,
  unit_type VARCHAR(50),

  -- FHIR Resource mapping
  fhir_resource_id VARCHAR(100),
  fhir_resource_version INTEGER DEFAULT 1,

  -- CMS LCD/NCD references
  lcd_references TEXT[] DEFAULT '{}',
  ncd_references TEXT[] DEFAULT '{}',

  -- Response tracking (CMS-0057-F SLA)
  response_time_hours NUMERIC(10,2),
  sla_met BOOLEAN,

  -- Metadata
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL,

  -- Constraints
  CONSTRAINT valid_service_codes CHECK (array_length(service_codes, 1) > 0 OR status = 'draft'),
  CONSTRAINT valid_urgency_deadline CHECK (
    (urgency = 'stat' AND decision_due_at <= submitted_at + INTERVAL '4 hours') OR
    (urgency = 'urgent' AND decision_due_at <= submitted_at + INTERVAL '72 hours') OR
    (urgency = 'routine' AND decision_due_at <= submitted_at + INTERVAL '7 days') OR
    submitted_at IS NULL
  )
);

-- Prior Authorization Decisions
CREATE TABLE IF NOT EXISTS prior_auth_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prior_auth_id UUID NOT NULL REFERENCES prior_authorizations(id) ON DELETE CASCADE,

  -- Decision details
  decision_type prior_auth_decision_type NOT NULL,
  decision_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decision_reason TEXT,
  decision_code VARCHAR(50),

  -- Approval details
  auth_number VARCHAR(100),
  approved_units INTEGER,
  approved_start_date DATE,
  approved_end_date DATE,

  -- Denial details
  denial_reason_code VARCHAR(50),
  denial_reason_description TEXT,
  appeal_deadline DATE,

  -- Payer response
  response_payload JSONB,
  x12_278_response TEXT,

  -- Reviewer information
  reviewer_name VARCHAR(255),
  reviewer_npi VARCHAR(10),

  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL
);

-- Prior Authorization Appeals
CREATE TABLE IF NOT EXISTS prior_auth_appeals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prior_auth_id UUID NOT NULL REFERENCES prior_authorizations(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES prior_auth_decisions(id),

  -- Appeal details
  appeal_level INTEGER NOT NULL DEFAULT 1,
  status prior_auth_appeal_status NOT NULL DEFAULT 'draft',
  appeal_reason TEXT NOT NULL,
  appeal_type VARCHAR(50), -- 'reconsideration', 'peer_to_peer', 'external_review'

  -- Dates
  submitted_at TIMESTAMPTZ,
  deadline_at DATE,
  resolved_at TIMESTAMPTZ,

  -- Peer-to-peer details
  peer_to_peer_scheduled_at TIMESTAMPTZ,
  peer_to_peer_completed_at TIMESTAMPTZ,
  peer_to_peer_outcome TEXT,

  -- Supporting documentation
  additional_documentation TEXT[] DEFAULT '{}',
  clinical_rationale TEXT,

  -- Outcome
  outcome prior_auth_decision_type,
  outcome_notes TEXT,

  -- Metadata
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL
);

-- Prior Authorization Documents/Attachments
CREATE TABLE IF NOT EXISTS prior_auth_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prior_auth_id UUID NOT NULL REFERENCES prior_authorizations(id) ON DELETE CASCADE,

  -- Document details
  document_type VARCHAR(100) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_description TEXT,
  file_path VARCHAR(500),
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),

  -- Status
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_to_payer BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID,
  tenant_id UUID NOT NULL
);

-- Prior Authorization Status History (Audit Trail)
CREATE TABLE IF NOT EXISTS prior_auth_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prior_auth_id UUID NOT NULL REFERENCES prior_authorizations(id) ON DELETE CASCADE,

  -- Status change
  old_status prior_auth_status,
  new_status prior_auth_status NOT NULL,
  status_reason TEXT,

  -- Metadata
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL
);

-- Prior Authorization Service Codes (Line Items)
CREATE TABLE IF NOT EXISTS prior_auth_service_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prior_auth_id UUID NOT NULL REFERENCES prior_authorizations(id) ON DELETE CASCADE,

  -- Service details
  line_number INTEGER NOT NULL,
  cpt_code VARCHAR(10) NOT NULL,
  cpt_description VARCHAR(255),
  modifier_codes TEXT[] DEFAULT '{}',

  -- Diagnosis linkage
  diagnosis_pointers INTEGER[] DEFAULT '{1}',

  -- Quantity
  requested_units INTEGER NOT NULL DEFAULT 1,
  approved_units INTEGER,
  unit_type VARCHAR(50) DEFAULT 'UN',

  -- Dates
  service_date DATE,
  service_start_date DATE,
  service_end_date DATE,

  -- Status
  line_status VARCHAR(50) DEFAULT 'pending',
  denial_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL,

  -- Unique line per prior auth
  UNIQUE(prior_auth_id, line_number)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Prior Authorizations
CREATE INDEX idx_prior_auth_patient ON prior_authorizations(patient_id);
CREATE INDEX idx_prior_auth_payer ON prior_authorizations(payer_id);
CREATE INDEX idx_prior_auth_status ON prior_authorizations(status);
CREATE INDEX idx_prior_auth_auth_number ON prior_authorizations(auth_number);
CREATE INDEX idx_prior_auth_tenant ON prior_authorizations(tenant_id);
CREATE INDEX idx_prior_auth_submitted ON prior_authorizations(submitted_at);
CREATE INDEX idx_prior_auth_decision_due ON prior_authorizations(decision_due_at) WHERE status IN ('submitted', 'pending_review');
CREATE INDEX idx_prior_auth_encounter ON prior_authorizations(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX idx_prior_auth_claim ON prior_authorizations(claim_id) WHERE claim_id IS NOT NULL;
CREATE INDEX idx_prior_auth_fhir ON prior_authorizations(fhir_resource_id) WHERE fhir_resource_id IS NOT NULL;

-- Decisions
CREATE INDEX idx_prior_auth_decisions_auth ON prior_auth_decisions(prior_auth_id);
CREATE INDEX idx_prior_auth_decisions_date ON prior_auth_decisions(decision_date);
CREATE INDEX idx_prior_auth_decisions_tenant ON prior_auth_decisions(tenant_id);

-- Appeals
CREATE INDEX idx_prior_auth_appeals_auth ON prior_auth_appeals(prior_auth_id);
CREATE INDEX idx_prior_auth_appeals_status ON prior_auth_appeals(status);
CREATE INDEX idx_prior_auth_appeals_tenant ON prior_auth_appeals(tenant_id);

-- Documents
CREATE INDEX idx_prior_auth_docs_auth ON prior_auth_documents(prior_auth_id);
CREATE INDEX idx_prior_auth_docs_tenant ON prior_auth_documents(tenant_id);

-- Status History
CREATE INDEX idx_prior_auth_history_auth ON prior_auth_status_history(prior_auth_id);
CREATE INDEX idx_prior_auth_history_tenant ON prior_auth_status_history(tenant_id);

-- Service Lines
CREATE INDEX idx_prior_auth_lines_auth ON prior_auth_service_lines(prior_auth_id);
CREATE INDEX idx_prior_auth_lines_cpt ON prior_auth_service_lines(cpt_code);
CREATE INDEX idx_prior_auth_lines_tenant ON prior_auth_service_lines(tenant_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE prior_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prior_auth_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prior_auth_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE prior_auth_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE prior_auth_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE prior_auth_service_lines ENABLE ROW LEVEL SECURITY;

-- Prior Authorizations policies
CREATE POLICY "prior_auth_tenant_isolation" ON prior_authorizations
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "prior_auth_service_role_bypass" ON prior_authorizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Decisions policies
CREATE POLICY "prior_auth_decisions_tenant_isolation" ON prior_auth_decisions
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "prior_auth_decisions_service_role_bypass" ON prior_auth_decisions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Appeals policies
CREATE POLICY "prior_auth_appeals_tenant_isolation" ON prior_auth_appeals
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "prior_auth_appeals_service_role_bypass" ON prior_auth_appeals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Documents policies
CREATE POLICY "prior_auth_docs_tenant_isolation" ON prior_auth_documents
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "prior_auth_docs_service_role_bypass" ON prior_auth_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Status History policies
CREATE POLICY "prior_auth_history_tenant_isolation" ON prior_auth_status_history
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "prior_auth_history_service_role_bypass" ON prior_auth_status_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Service Lines policies
CREATE POLICY "prior_auth_lines_tenant_isolation" ON prior_auth_service_lines
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "prior_auth_lines_service_role_bypass" ON prior_auth_service_lines
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_prior_auth_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prior_auth_updated_at
  BEFORE UPDATE ON prior_authorizations
  FOR EACH ROW EXECUTE FUNCTION update_prior_auth_timestamp();

CREATE TRIGGER prior_auth_appeals_updated_at
  BEFORE UPDATE ON prior_auth_appeals
  FOR EACH ROW EXECUTE FUNCTION update_prior_auth_timestamp();

CREATE TRIGGER prior_auth_lines_updated_at
  BEFORE UPDATE ON prior_auth_service_lines
  FOR EACH ROW EXECUTE FUNCTION update_prior_auth_timestamp();

-- Status change logging trigger
CREATE OR REPLACE FUNCTION log_prior_auth_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO prior_auth_status_history (
      prior_auth_id,
      old_status,
      new_status,
      changed_by,
      tenant_id
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.updated_by,
      NEW.tenant_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prior_auth_status_change_log
  AFTER UPDATE ON prior_authorizations
  FOR EACH ROW EXECUTE FUNCTION log_prior_auth_status_change();

-- Calculate decision deadline based on urgency
CREATE OR REPLACE FUNCTION set_prior_auth_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.submitted_at IS NOT NULL AND NEW.decision_due_at IS NULL THEN
    NEW.decision_due_at = CASE NEW.urgency
      WHEN 'stat' THEN NEW.submitted_at + INTERVAL '4 hours'
      WHEN 'urgent' THEN NEW.submitted_at + INTERVAL '72 hours'
      WHEN 'routine' THEN NEW.submitted_at + INTERVAL '7 days'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prior_auth_set_deadline
  BEFORE INSERT OR UPDATE ON prior_authorizations
  FOR EACH ROW EXECUTE FUNCTION set_prior_auth_deadline();

-- Calculate SLA compliance on decision
CREATE OR REPLACE FUNCTION calculate_prior_auth_sla()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.approved_at IS NOT NULL AND OLD.approved_at IS NULL THEN
    -- Calculate response time in hours
    NEW.response_time_hours = EXTRACT(EPOCH FROM (NEW.approved_at - NEW.submitted_at)) / 3600;

    -- Check if SLA was met based on urgency
    NEW.sla_met = CASE NEW.urgency
      WHEN 'stat' THEN NEW.response_time_hours <= 4
      WHEN 'urgent' THEN NEW.response_time_hours <= 72
      WHEN 'routine' THEN NEW.response_time_hours <= 168 -- 7 days
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prior_auth_calculate_sla
  BEFORE UPDATE ON prior_authorizations
  FOR EACH ROW EXECUTE FUNCTION calculate_prior_auth_sla();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Get pending prior auths approaching deadline
CREATE OR REPLACE FUNCTION get_prior_auth_approaching_deadline(
  p_tenant_id UUID,
  p_hours_threshold INTEGER DEFAULT 24
)
RETURNS TABLE (
  id UUID,
  auth_number VARCHAR,
  patient_id UUID,
  urgency prior_auth_urgency,
  submitted_at TIMESTAMPTZ,
  decision_due_at TIMESTAMPTZ,
  hours_remaining NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id,
    pa.auth_number,
    pa.patient_id,
    pa.urgency,
    pa.submitted_at,
    pa.decision_due_at,
    EXTRACT(EPOCH FROM (pa.decision_due_at - NOW())) / 3600 AS hours_remaining
  FROM prior_authorizations pa
  WHERE pa.tenant_id = p_tenant_id
    AND pa.status IN ('submitted', 'pending_review')
    AND pa.decision_due_at IS NOT NULL
    AND pa.decision_due_at <= NOW() + (p_hours_threshold || ' hours')::INTERVAL
  ORDER BY pa.decision_due_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get prior auth statistics for dashboard
CREATE OR REPLACE FUNCTION get_prior_auth_statistics(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_submitted BIGINT,
  total_approved BIGINT,
  total_denied BIGINT,
  total_pending BIGINT,
  approval_rate NUMERIC,
  avg_response_hours NUMERIC,
  sla_compliance_rate NUMERIC,
  by_urgency JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status != 'draft') AS submitted,
      COUNT(*) FILTER (WHERE status = 'approved') AS approved,
      COUNT(*) FILTER (WHERE status = 'denied') AS denied,
      COUNT(*) FILTER (WHERE status IN ('submitted', 'pending_review', 'pending_additional_info')) AS pending,
      AVG(response_time_hours) FILTER (WHERE response_time_hours IS NOT NULL) AS avg_response,
      COUNT(*) FILTER (WHERE sla_met = true) AS sla_met_count,
      COUNT(*) FILTER (WHERE sla_met IS NOT NULL) AS sla_total
    FROM prior_authorizations
    WHERE tenant_id = p_tenant_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date + INTERVAL '1 day'
  ),
  urgency_stats AS (
    SELECT jsonb_object_agg(
      urgency::TEXT,
      jsonb_build_object(
        'total', total,
        'approved', approved,
        'denied', denied
      )
    ) AS by_urgency
    FROM (
      SELECT
        urgency,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'denied') AS denied
      FROM prior_authorizations
      WHERE tenant_id = p_tenant_id
        AND created_at >= p_start_date
        AND created_at <= p_end_date + INTERVAL '1 day'
      GROUP BY urgency
    ) u
  )
  SELECT
    s.submitted,
    s.approved,
    s.denied,
    s.pending,
    CASE WHEN s.submitted > 0 THEN ROUND((s.approved::NUMERIC / s.submitted) * 100, 2) ELSE 0 END,
    ROUND(s.avg_response, 2),
    CASE WHEN s.sla_total > 0 THEN ROUND((s.sla_met_count::NUMERIC / s.sla_total) * 100, 2) ELSE 100 END,
    COALESCE(u.by_urgency, '{}'::JSONB)
  FROM stats s
  CROSS JOIN urgency_stats u;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if prior auth is required for a claim
CREATE OR REPLACE FUNCTION check_prior_auth_for_claim(
  p_tenant_id UUID,
  p_patient_id UUID,
  p_service_codes TEXT[],
  p_date_of_service DATE
)
RETURNS TABLE (
  requires_prior_auth BOOLEAN,
  existing_auth_id UUID,
  existing_auth_number VARCHAR,
  auth_status prior_auth_status,
  auth_expires_at TIMESTAMPTZ,
  missing_codes TEXT[]
) AS $$
DECLARE
  v_existing_auth RECORD;
  v_covered_codes TEXT[];
  v_missing_codes TEXT[];
BEGIN
  -- Find existing valid prior auth
  SELECT
    pa.id,
    pa.auth_number,
    pa.status,
    pa.expires_at,
    pa.service_codes
  INTO v_existing_auth
  FROM prior_authorizations pa
  WHERE pa.tenant_id = p_tenant_id
    AND pa.patient_id = p_patient_id
    AND pa.status = 'approved'
    AND (pa.expires_at IS NULL OR pa.expires_at > NOW())
    AND (pa.service_start_date IS NULL OR pa.service_start_date <= p_date_of_service)
    AND (pa.service_end_date IS NULL OR pa.service_end_date >= p_date_of_service)
    AND pa.service_codes && p_service_codes
  ORDER BY pa.created_at DESC
  LIMIT 1;

  IF v_existing_auth.id IS NOT NULL THEN
    -- Check which codes are covered
    v_covered_codes := v_existing_auth.service_codes & p_service_codes;
    v_missing_codes := p_service_codes - v_existing_auth.service_codes;

    RETURN QUERY SELECT
      array_length(v_missing_codes, 1) > 0,
      v_existing_auth.id,
      v_existing_auth.auth_number,
      v_existing_auth.status,
      v_existing_auth.expires_at,
      v_missing_codes;
  ELSE
    -- No existing auth found
    RETURN QUERY SELECT
      TRUE,
      NULL::UUID,
      NULL::VARCHAR,
      NULL::prior_auth_status,
      NULL::TIMESTAMPTZ,
      p_service_codes;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON prior_authorizations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON prior_auth_decisions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON prior_auth_appeals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON prior_auth_documents TO authenticated;
GRANT SELECT ON prior_auth_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON prior_auth_service_lines TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_prior_auth_approaching_deadline TO authenticated;
GRANT EXECUTE ON FUNCTION get_prior_auth_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION check_prior_auth_for_claim TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE prior_authorizations IS 'Prior authorization requests for CMS-0057-F compliance';
COMMENT ON TABLE prior_auth_decisions IS 'Payer decisions on prior authorization requests';
COMMENT ON TABLE prior_auth_appeals IS 'Appeals for denied prior authorizations';
COMMENT ON TABLE prior_auth_documents IS 'Supporting documentation for prior authorizations';
COMMENT ON TABLE prior_auth_status_history IS 'Audit trail of prior authorization status changes';
COMMENT ON TABLE prior_auth_service_lines IS 'Individual service line items within a prior authorization';

COMMENT ON COLUMN prior_authorizations.urgency IS 'CMS-0057-F response time requirements: stat=4hr, urgent=72hr, routine=7days';
COMMENT ON COLUMN prior_authorizations.sla_met IS 'Whether payer response met CMS-mandated SLA';
COMMENT ON COLUMN prior_authorizations.fhir_resource_id IS 'FHIR R4 PriorAuthorizationRequest resource ID';
