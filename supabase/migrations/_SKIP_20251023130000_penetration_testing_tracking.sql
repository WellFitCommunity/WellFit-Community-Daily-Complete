-- Penetration Testing Tracking System
-- Tracks security testing results, vulnerabilities, and remediation

-- ============================================================================
-- 1. PENETRATION TEST EXECUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS penetration_test_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Test metadata
  test_name TEXT NOT NULL,
  test_type TEXT NOT NULL CHECK (test_type IN (
    'automated_daily',
    'automated_weekly',
    'manual_quarterly',
    'external_annual',
    'red_team'
  )),

  -- Scope
  test_scope JSONB NOT NULL DEFAULT '{}', -- {endpoints: [], components: [], depth: "full"}

  -- Execution details
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',
    'in_progress',
    'completed',
    'failed',
    'cancelled'
  )),

  -- Tools and methodology
  tools_used TEXT[],
  methodology TEXT, -- e.g., "OWASP Top 10", "PTES", "NIST SP 800-115"

  -- Results summary
  vulnerabilities_found INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  low_count INTEGER DEFAULT 0,
  info_count INTEGER DEFAULT 0,

  -- Risk scoring
  overall_risk_score NUMERIC(5,2), -- 0-100
  cvss_average NUMERIC(3,1), -- 0-10

  -- Compliance
  compliant BOOLEAN DEFAULT TRUE,
  compliance_notes TEXT,

  -- Documentation
  report_url TEXT,
  executive_summary TEXT,
  tester_name TEXT,
  tester_organization TEXT,

  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_pentest_executions_type ON penetration_test_executions(test_type);
CREATE INDEX idx_pentest_executions_status ON penetration_test_executions(status);
CREATE INDEX idx_pentest_executions_started ON penetration_test_executions(started_at DESC);

-- ============================================================================
-- 2. VULNERABILITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_execution_id UUID REFERENCES penetration_test_executions(id) ON DELETE CASCADE,

  -- Vulnerability identification
  vulnerability_id TEXT UNIQUE, -- e.g., "VULN-2025-001"
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Classification
  vulnerability_type TEXT NOT NULL CHECK (vulnerability_type IN (
    'sql_injection',
    'xss_stored',
    'xss_reflected',
    'csrf',
    'authentication_bypass',
    'authorization_bypass',
    'idor',
    'rce',
    'file_upload',
    'sensitive_data_exposure',
    'xxe',
    'ssrf',
    'deserialization',
    'component_vulnerability',
    'security_misconfiguration',
    'insufficient_logging',
    'business_logic_flaw',
    'other'
  )),

  -- Severity
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
  cvss_score NUMERIC(3,1), -- 0.0 - 10.0
  cvss_vector TEXT, -- e.g., "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H"

  -- Location
  affected_component TEXT, -- e.g., "/auth/login", "src/services/authService.ts:42"
  affected_url TEXT,
  affected_parameter TEXT,

  -- Technical details
  proof_of_concept TEXT,
  reproduction_steps TEXT,
  payload_used TEXT,

  -- Impact
  impact_description TEXT,
  phi_at_risk BOOLEAN DEFAULT FALSE,
  data_breach_potential BOOLEAN DEFAULT FALSE,

  -- OWASP categorization
  owasp_category TEXT, -- e.g., "A01:2021-Broken Access Control"
  cwe_id TEXT, -- e.g., "CWE-89"

  -- Remediation
  remediation_recommendation TEXT,
  remediation_priority TEXT CHECK (remediation_priority IN ('P0', 'P1', 'P2', 'P3')),
  remediation_effort TEXT CHECK (remediation_effort IN ('low', 'medium', 'high')),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',
    'in_progress',
    'resolved',
    'verified',
    'accepted_risk',
    'false_positive'
  )),

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  assigned_team TEXT, -- e.g., "Backend Team", "DevOps"

  -- Timeline
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  remediation_due_date TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES auth.users(id),

  -- Compliance impact
  hipaa_violation BOOLEAN DEFAULT FALSE,
  soc2_impact BOOLEAN DEFAULT FALSE,
  breach_notification_required BOOLEAN DEFAULT FALSE,

  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vulns_test_execution ON security_vulnerabilities(test_execution_id);
CREATE INDEX idx_vulns_severity ON security_vulnerabilities(severity, status);
CREATE INDEX idx_vulns_status ON security_vulnerabilities(status);
CREATE INDEX idx_vulns_assigned ON security_vulnerabilities(assigned_to);
CREATE INDEX idx_vulns_due_date ON security_vulnerabilities(remediation_due_date);

-- ============================================================================
-- 3. REMEDIATION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS vulnerability_remediation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vulnerability_id UUID NOT NULL REFERENCES security_vulnerabilities(id) ON DELETE CASCADE,

  -- Action details
  action_type TEXT NOT NULL CHECK (action_type IN (
    'assigned',
    'status_changed',
    'commented',
    'code_fixed',
    'deployed',
    'verified',
    'reopened'
  )),

  -- Change tracking
  old_value TEXT,
  new_value TEXT,
  comment TEXT,

  -- Actor
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Evidence
  evidence_url TEXT, -- e.g., GitHub PR link
  verification_method TEXT
);

CREATE INDEX idx_remediation_log_vuln ON vulnerability_remediation_log(vulnerability_id);
CREATE INDEX idx_remediation_log_performed_at ON vulnerability_remediation_log(performed_at DESC);

-- ============================================================================
-- 4. FUNCTIONS
-- ============================================================================

-- Function to start a penetration test
CREATE OR REPLACE FUNCTION start_penetration_test(
  p_test_name TEXT,
  p_test_type TEXT,
  p_test_scope JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_test_id UUID;
BEGIN
  INSERT INTO penetration_test_executions (
    test_name,
    test_type,
    test_scope,
    status,
    started_at,
    created_by
  ) VALUES (
    p_test_name,
    p_test_type,
    p_test_scope,
    'in_progress',
    NOW(),
    auth.uid()
  )
  RETURNING id INTO v_test_id;

  -- Log security event
  INSERT INTO security_events (
    event_type,
    severity,
    description,
    metadata,
    actor_user_id
  ) VALUES (
    'pentest_started',
    'LOW',
    format('Penetration test started: %s', p_test_name),
    jsonb_build_object(
      'test_id', v_test_id,
      'test_type', p_test_type
    ),
    auth.uid()
  );

  RETURN v_test_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to report a vulnerability
CREATE OR REPLACE FUNCTION report_vulnerability(
  p_test_execution_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_severity TEXT,
  p_vulnerability_type TEXT,
  p_affected_component TEXT DEFAULT NULL,
  p_cvss_score NUMERIC DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_vuln_id UUID;
  v_vulnerability_id TEXT;
  v_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Generate vulnerability ID
  v_vulnerability_id := 'VULN-' || TO_CHAR(NOW(), 'YYYY-MM-DD') || '-' ||
                        LPAD(NEXTVAL('vulnerability_id_seq')::TEXT, 4, '0');

  -- Calculate remediation due date based on severity
  v_due_date := CASE p_severity
    WHEN 'CRITICAL' THEN NOW() + INTERVAL '1 day'
    WHEN 'HIGH' THEN NOW() + INTERVAL '7 days'
    WHEN 'MEDIUM' THEN NOW() + INTERVAL '30 days'
    WHEN 'LOW' THEN NOW() + INTERVAL '90 days'
    ELSE NOW() + INTERVAL '180 days'
  END;

  -- Insert vulnerability
  INSERT INTO security_vulnerabilities (
    test_execution_id,
    vulnerability_id,
    title,
    description,
    severity,
    vulnerability_type,
    affected_component,
    cvss_score,
    remediation_due_date,
    remediation_priority,
    status
  ) VALUES (
    p_test_execution_id,
    v_vulnerability_id,
    p_title,
    p_description,
    p_severity,
    p_vulnerability_type,
    p_affected_component,
    p_cvss_score,
    v_due_date,
    CASE p_severity
      WHEN 'CRITICAL' THEN 'P0'
      WHEN 'HIGH' THEN 'P1'
      WHEN 'MEDIUM' THEN 'P2'
      ELSE 'P3'
    END,
    'open'
  )
  RETURNING id INTO v_vuln_id;

  -- Update test execution counts
  UPDATE penetration_test_executions
  SET
    vulnerabilities_found = vulnerabilities_found + 1,
    critical_count = critical_count + CASE WHEN p_severity = 'CRITICAL' THEN 1 ELSE 0 END,
    high_count = high_count + CASE WHEN p_severity = 'HIGH' THEN 1 ELSE 0 END,
    medium_count = medium_count + CASE WHEN p_severity = 'MEDIUM' THEN 1 ELSE 0 END,
    low_count = low_count + CASE WHEN p_severity = 'LOW' THEN 1 ELSE 0 END,
    info_count = info_count + CASE WHEN p_severity = 'INFO' THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE id = p_test_execution_id;

  -- Log critical/high vulnerabilities immediately
  IF p_severity IN ('CRITICAL', 'HIGH') THEN
    INSERT INTO security_events (
      event_type,
      severity,
      description,
      metadata,
      actor_user_id,
      requires_investigation
    ) VALUES (
      'vulnerability_discovered',
      p_severity,
      format('%s vulnerability discovered: %s', p_severity, p_title),
      jsonb_build_object(
        'vulnerability_id', v_vulnerability_id,
        'test_execution_id', p_test_execution_id,
        'type', p_vulnerability_type,
        'component', p_affected_component
      ),
      auth.uid(),
      TRUE
    );
  END IF;

  RETURN v_vuln_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create sequence for vulnerability IDs
CREATE SEQUENCE IF NOT EXISTS vulnerability_id_seq START 1;

-- Function to get vulnerability summary
CREATE OR REPLACE FUNCTION get_vulnerability_summary()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_open_critical INTEGER;
  v_open_high INTEGER;
  v_overdue INTEGER;
  v_avg_remediation_time INTEGER;
BEGIN
  -- Count open vulnerabilities by severity
  SELECT
    COUNT(CASE WHEN severity = 'CRITICAL' AND status NOT IN ('resolved', 'verified', 'false_positive') THEN 1 END),
    COUNT(CASE WHEN severity = 'HIGH' AND status NOT IN ('resolved', 'verified', 'false_positive') THEN 1 END)
  INTO v_open_critical, v_open_high
  FROM security_vulnerabilities;

  -- Count overdue vulnerabilities
  SELECT COUNT(*)
  INTO v_overdue
  FROM security_vulnerabilities
  WHERE status NOT IN ('resolved', 'verified', 'false_positive')
    AND remediation_due_date < NOW();

  -- Calculate average remediation time
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - discovered_at)) / 86400))
  INTO v_avg_remediation_time
  FROM security_vulnerabilities
  WHERE resolved_at IS NOT NULL
    AND discovered_at > NOW() - INTERVAL '90 days';

  v_result := jsonb_build_object(
    'open_critical', v_open_critical,
    'open_high', v_open_high,
    'total_overdue', v_overdue,
    'avg_remediation_days', v_avg_remediation_time,
    'risk_level', CASE
      WHEN v_open_critical > 0 THEN 'CRITICAL'
      WHEN v_open_high > 5 THEN 'HIGH'
      WHEN v_overdue > 10 THEN 'MEDIUM'
      ELSE 'LOW'
    END
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW vulnerability_dashboard AS
SELECT
  v.vulnerability_id,
  v.title,
  v.severity,
  v.status,
  v.vulnerability_type,
  v.affected_component,
  v.assigned_to,
  v.remediation_due_date,
  CASE
    WHEN v.remediation_due_date < NOW() AND v.status NOT IN ('resolved', 'verified') THEN 'overdue'
    WHEN v.remediation_due_date < NOW() + INTERVAL '3 days' AND v.status NOT IN ('resolved', 'verified') THEN 'due_soon'
    ELSE 'on_track'
  END as timeline_status,
  EXTRACT(EPOCH FROM (NOW() - v.discovered_at)) / 86400 as days_open,
  t.test_name,
  t.test_type,
  t.started_at as test_date
FROM security_vulnerabilities v
LEFT JOIN penetration_test_executions t ON v.test_execution_id = t.id
WHERE v.status NOT IN ('false_positive')
ORDER BY
  CASE v.severity
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
    ELSE 5
  END,
  v.remediation_due_date;

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE penetration_test_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_vulnerabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerability_remediation_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all
CREATE POLICY "Admins can view all pentest executions"
  ON penetration_test_executions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage pentest executions"
  ON penetration_test_executions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can view all vulnerabilities"
  ON security_vulnerabilities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Assigned users can view their vulnerabilities"
  ON security_vulnerabilities FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage vulnerabilities"
  ON security_vulnerabilities FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can view remediation log"
  ON vulnerability_remediation_log FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Authenticated users can add remediation log"
  ON vulnerability_remediation_log FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

GRANT SELECT ON vulnerability_dashboard TO authenticated;

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================

COMMENT ON TABLE penetration_test_executions IS 'Tracks all penetration testing activities for HIPAA/SOC2 compliance';
COMMENT ON TABLE security_vulnerabilities IS 'Vulnerabilities discovered during penetration testing';
COMMENT ON TABLE vulnerability_remediation_log IS 'Audit trail of vulnerability remediation activities';
COMMENT ON FUNCTION start_penetration_test IS 'Starts a new penetration test execution';
COMMENT ON FUNCTION report_vulnerability IS 'Reports a newly discovered vulnerability';
COMMENT ON FUNCTION get_vulnerability_summary IS 'Returns high-level vulnerability metrics';
COMMENT ON VIEW vulnerability_dashboard IS 'Dashboard view of open vulnerabilities with prioritization';
