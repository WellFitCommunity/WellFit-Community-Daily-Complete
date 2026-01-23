-- X12 997 Functional Acknowledgments
-- Purpose: Store and track EDI functional acknowledgments from clearinghouses
-- Integration: Clearinghouse MCP server, billing workflows

-- ============================================================================
-- 1. FUNCTIONAL ACKNOWLEDGMENT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS x12_997_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),

  -- ISA envelope info
  interchange_control_number TEXT NOT NULL,
  interchange_date DATE,
  interchange_time TIME,
  sender_id TEXT,
  receiver_id TEXT,

  -- GS group info
  functional_group_id TEXT,
  group_control_number TEXT,
  application_sender_code TEXT,
  application_receiver_code TEXT,
  group_date DATE,

  -- Overall acknowledgment status
  acknowledgment_status TEXT NOT NULL CHECK (acknowledgment_status IN (
    'A',  -- Accepted
    'E',  -- Accepted with errors
    'R',  -- Rejected
    'P',  -- Partially accepted
    'M',  -- Rejected, message authentication failed
    'W',  -- Rejected, assurance failed
    'X'   -- Rejected, content decryption failed
  )),
  acknowledgment_status_description TEXT,

  -- Statistics
  total_transaction_sets_included INTEGER DEFAULT 0,
  transaction_sets_received INTEGER DEFAULT 0,
  transaction_sets_accepted INTEGER DEFAULT 0,
  transaction_sets_accepted_with_errors INTEGER DEFAULT 0,
  transaction_sets_rejected INTEGER DEFAULT 0,

  -- Original transaction reference
  original_transaction_type TEXT,  -- 837P, 837I, 270, 278, etc.
  original_control_number TEXT,
  original_submitted_at TIMESTAMPTZ,

  -- Claim/submission linking
  original_claim_ids TEXT[],  -- Array of claim IDs from original submission
  submission_batch_id UUID,   -- Reference to submission batch if applicable

  -- Raw X12 content
  raw_x12_content TEXT,

  -- Timing
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  acknowledged_by_user_id UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,

  -- Metadata
  clearinghouse_provider TEXT,  -- waystar, change_healthcare, availity
  source_filename TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. TRANSACTION SET ACKNOWLEDGMENTS (AK2/AK5 pairs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS x12_997_transaction_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acknowledgment_id UUID NOT NULL REFERENCES x12_997_acknowledgments(id) ON DELETE CASCADE,

  -- AK2 - Transaction Set Response Header
  transaction_set_identifier TEXT,  -- 837, 270, 278, etc.
  transaction_set_control_number TEXT,

  -- AK5 - Transaction Set Response Trailer
  acknowledgment_code TEXT NOT NULL CHECK (acknowledgment_code IN (
    'A',  -- Accepted
    'E',  -- Accepted with errors
    'M',  -- Rejected, message authentication failed
    'R',  -- Rejected
    'W',  -- Rejected, assurance failed
    'X'   -- Rejected, content decryption failed
  )),
  acknowledgment_code_description TEXT,

  -- Error codes (AK5 positions 2-6)
  syntax_error_code_1 TEXT,
  syntax_error_code_2 TEXT,
  syntax_error_code_3 TEXT,
  syntax_error_code_4 TEXT,
  syntax_error_code_5 TEXT,

  -- Linked claim (if we can match)
  linked_claim_id TEXT,
  linked_patient_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. SEGMENT-LEVEL ERRORS (AK3/AK4 pairs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS x12_997_segment_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_set_id UUID NOT NULL REFERENCES x12_997_transaction_sets(id) ON DELETE CASCADE,

  -- AK3 - Data Segment Note
  segment_id_code TEXT,           -- e.g., NM1, DMG, CLM
  segment_position INTEGER,       -- Position in transaction set
  loop_identifier_code TEXT,      -- Loop the segment is in
  segment_syntax_error_code TEXT, -- Error code for segment

  -- AK4 - Data Element Note (optional, for element-level errors)
  element_position INTEGER,
  component_data_element_position INTEGER,
  data_element_reference_number TEXT,
  element_syntax_error_code TEXT,
  copy_of_bad_data_element TEXT,

  -- Descriptions
  segment_error_description TEXT,
  element_error_description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. SYNTAX ERROR CODE REFERENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS x12_997_error_codes (
  code TEXT NOT NULL,
  error_type TEXT NOT NULL CHECK (error_type IN ('segment', 'element', 'transaction', 'group')),
  description TEXT NOT NULL,
  remediation TEXT,
  category TEXT,
  severity TEXT CHECK (severity IN ('warning', 'error', 'critical')),
  PRIMARY KEY (code, error_type)
);

-- Populate common error codes
INSERT INTO x12_997_error_codes (code, error_type, description, remediation, category, severity) VALUES
-- Segment-level errors (AK304)
('1', 'segment', 'Unrecognized segment ID', 'Remove invalid segment or correct segment ID', 'syntax', 'error'),
('2', 'segment', 'Unexpected segment', 'Check segment order per X12 implementation guide', 'syntax', 'error'),
('3', 'segment', 'Mandatory segment missing', 'Add required segment to transaction', 'missing', 'critical'),
('4', 'segment', 'Loop occurs over maximum times', 'Reduce loop repetitions or split transaction', 'syntax', 'error'),
('5', 'segment', 'Segment exceeds maximum use', 'Remove duplicate segment instances', 'syntax', 'error'),
('6', 'segment', 'Segment not in defined transaction set', 'Remove segment not allowed in this transaction type', 'syntax', 'error'),
('7', 'segment', 'Segment not in proper sequence', 'Reorder segments per implementation guide', 'syntax', 'error'),
('8', 'segment', 'Segment has data element errors', 'Review AK4 for specific element errors', 'data', 'error'),

-- Element-level errors (AK403)
('1', 'element', 'Mandatory data element missing', 'Provide required data element value', 'missing', 'critical'),
('2', 'element', 'Conditional required data element missing', 'Add data element required by condition', 'missing', 'error'),
('3', 'element', 'Too many data elements', 'Remove excess data elements', 'syntax', 'warning'),
('4', 'element', 'Data element too short', 'Ensure minimum length requirement met', 'format', 'error'),
('5', 'element', 'Data element too long', 'Truncate data element to maximum length', 'format', 'error'),
('6', 'element', 'Invalid character in data element', 'Remove special characters not allowed', 'format', 'error'),
('7', 'element', 'Invalid code value', 'Use valid code from X12 code list', 'code', 'error'),
('8', 'element', 'Invalid date', 'Correct date format (CCYYMMDD)', 'format', 'error'),
('9', 'element', 'Invalid time', 'Correct time format (HHMM or HHMMSS)', 'format', 'error'),
('10', 'element', 'Exclusion condition violated', 'Remove conflicting data elements', 'syntax', 'error'),
('12', 'element', 'Too many repetitions', 'Reduce repetitions to allowed maximum', 'syntax', 'warning'),
('13', 'element', 'Too many components', 'Reduce component count in composite element', 'syntax', 'warning'),

-- Transaction-level errors (AK502)
('1', 'transaction', 'Transaction set not supported', 'Use supported transaction set type', 'unsupported', 'critical'),
('2', 'transaction', 'Transaction set trailer missing', 'Add SE segment', 'missing', 'critical'),
('3', 'transaction', 'Transaction set control number mismatch', 'Ensure ST02 matches SE02', 'mismatch', 'error'),
('4', 'transaction', 'Number of included segments does not match actual count', 'Correct SE01 segment count', 'mismatch', 'error'),
('5', 'transaction', 'One or more segments in error', 'Review AK3/AK4 for segment errors', 'data', 'error'),
('6', 'transaction', 'Missing or invalid transaction set identifier', 'Correct ST01 value', 'missing', 'critical'),
('7', 'transaction', 'Missing or invalid transaction set control number', 'Provide valid ST02 value', 'missing', 'critical'),
('23', 'transaction', 'Transaction set control number not unique within group', 'Use unique control numbers', 'duplicate', 'error'),

-- Group-level errors (AK901)
('A', 'group', 'Accepted', 'No action required', 'success', 'warning'),
('E', 'group', 'Accepted, but errors were noted', 'Review and correct errors for future submissions', 'partial', 'warning'),
('M', 'group', 'Rejected, message authentication code failed', 'Verify security credentials', 'security', 'critical'),
('P', 'group', 'Partially accepted', 'Review rejected transactions and resubmit', 'partial', 'error'),
('R', 'group', 'Rejected', 'Review all errors and resubmit corrected transactions', 'rejected', 'critical'),
('W', 'group', 'Rejected, assurance failed', 'Verify security certificates', 'security', 'critical'),
('X', 'group', 'Rejected, content decryption failed', 'Check encryption configuration', 'security', 'critical')
ON CONFLICT (code, error_type) DO UPDATE SET
  description = EXCLUDED.description,
  remediation = EXCLUDED.remediation;

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_997_ack_tenant ON x12_997_acknowledgments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_997_ack_received ON x12_997_acknowledgments(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_997_ack_status ON x12_997_acknowledgments(acknowledgment_status);
CREATE INDEX IF NOT EXISTS idx_997_ack_original_control ON x12_997_acknowledgments(original_control_number);
CREATE INDEX IF NOT EXISTS idx_997_ack_interchange ON x12_997_acknowledgments(interchange_control_number);
CREATE INDEX IF NOT EXISTS idx_997_ts_ack_id ON x12_997_transaction_sets(acknowledgment_id);
CREATE INDEX IF NOT EXISTS idx_997_ts_claim ON x12_997_transaction_sets(linked_claim_id);
CREATE INDEX IF NOT EXISTS idx_997_seg_ts_id ON x12_997_segment_errors(transaction_set_id);

-- ============================================================================
-- 6. VIEWS
-- ============================================================================

-- Summary view of recent acknowledgments
CREATE OR REPLACE VIEW v_997_acknowledgment_summary AS
SELECT
  a.id,
  a.tenant_id,
  a.interchange_control_number,
  a.acknowledgment_status,
  a.acknowledgment_status_description,
  a.original_transaction_type,
  a.original_control_number,
  a.transaction_sets_received,
  a.transaction_sets_accepted,
  a.transaction_sets_rejected,
  a.received_at,
  a.processed_at,
  a.clearinghouse_provider,
  COUNT(ts.id) AS total_transaction_sets,
  COUNT(CASE WHEN ts.acknowledgment_code = 'R' THEN 1 END) AS rejected_count,
  COUNT(se.id) AS total_errors
FROM x12_997_acknowledgments a
LEFT JOIN x12_997_transaction_sets ts ON ts.acknowledgment_id = a.id
LEFT JOIN x12_997_segment_errors se ON se.transaction_set_id = ts.id
GROUP BY a.id;

-- Rejected transactions requiring attention
CREATE OR REPLACE VIEW v_997_rejected_transactions AS
SELECT
  a.id AS acknowledgment_id,
  a.tenant_id,
  a.original_transaction_type,
  a.original_control_number,
  a.received_at,
  ts.id AS transaction_set_id,
  ts.transaction_set_identifier,
  ts.transaction_set_control_number,
  ts.acknowledgment_code,
  ts.acknowledgment_code_description,
  ts.syntax_error_code_1,
  ts.linked_claim_id,
  ec.description AS error_description,
  ec.remediation
FROM x12_997_acknowledgments a
JOIN x12_997_transaction_sets ts ON ts.acknowledgment_id = a.id
LEFT JOIN x12_997_error_codes ec ON ec.code = ts.syntax_error_code_1
WHERE ts.acknowledgment_code IN ('R', 'M', 'W', 'X')
ORDER BY a.received_at DESC;

-- ============================================================================
-- 7. FUNCTIONS
-- ============================================================================

-- Store a parsed 997 acknowledgment
CREATE OR REPLACE FUNCTION store_997_acknowledgment(
  p_tenant_id UUID,
  p_interchange_control_number TEXT,
  p_group_control_number TEXT,
  p_acknowledgment_status TEXT,
  p_original_transaction_type TEXT,
  p_original_control_number TEXT,
  p_transaction_sets_received INTEGER,
  p_transaction_sets_accepted INTEGER,
  p_transaction_sets_rejected INTEGER,
  p_raw_x12_content TEXT,
  p_clearinghouse_provider TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_ack_id UUID;
  v_status_desc TEXT;
BEGIN
  -- Get status description
  SELECT description INTO v_status_desc
  FROM x12_997_error_codes
  WHERE code = p_acknowledgment_status AND error_type = 'group';

  INSERT INTO x12_997_acknowledgments (
    tenant_id,
    interchange_control_number,
    group_control_number,
    acknowledgment_status,
    acknowledgment_status_description,
    original_transaction_type,
    original_control_number,
    transaction_sets_received,
    transaction_sets_accepted,
    transaction_sets_rejected,
    transaction_sets_accepted_with_errors,
    raw_x12_content,
    clearinghouse_provider,
    processed_at
  ) VALUES (
    p_tenant_id,
    p_interchange_control_number,
    p_group_control_number,
    p_acknowledgment_status,
    COALESCE(v_status_desc, 'Unknown status'),
    p_original_transaction_type,
    p_original_control_number,
    p_transaction_sets_received,
    p_transaction_sets_accepted,
    p_transaction_sets_rejected,
    p_transaction_sets_received - p_transaction_sets_accepted - p_transaction_sets_rejected,
    p_raw_x12_content,
    p_clearinghouse_provider,
    NOW()
  )
  RETURNING id INTO v_ack_id;

  RETURN v_ack_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Store transaction set acknowledgment
CREATE OR REPLACE FUNCTION store_997_transaction_set(
  p_acknowledgment_id UUID,
  p_transaction_set_identifier TEXT,
  p_transaction_set_control_number TEXT,
  p_acknowledgment_code TEXT,
  p_syntax_error_code_1 TEXT DEFAULT NULL,
  p_syntax_error_code_2 TEXT DEFAULT NULL,
  p_syntax_error_code_3 TEXT DEFAULT NULL,
  p_linked_claim_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_ts_id UUID;
  v_code_desc TEXT;
BEGIN
  -- Get acknowledgment code description
  SELECT description INTO v_code_desc
  FROM x12_997_error_codes
  WHERE code = p_acknowledgment_code AND error_type = 'transaction';

  INSERT INTO x12_997_transaction_sets (
    acknowledgment_id,
    transaction_set_identifier,
    transaction_set_control_number,
    acknowledgment_code,
    acknowledgment_code_description,
    syntax_error_code_1,
    syntax_error_code_2,
    syntax_error_code_3,
    linked_claim_id
  ) VALUES (
    p_acknowledgment_id,
    p_transaction_set_identifier,
    p_transaction_set_control_number,
    p_acknowledgment_code,
    COALESCE(v_code_desc, 'Unknown acknowledgment code'),
    p_syntax_error_code_1,
    p_syntax_error_code_2,
    p_syntax_error_code_3,
    p_linked_claim_id
  )
  RETURNING id INTO v_ts_id;

  RETURN v_ts_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Store segment error
CREATE OR REPLACE FUNCTION store_997_segment_error(
  p_transaction_set_id UUID,
  p_segment_id_code TEXT,
  p_segment_position INTEGER,
  p_loop_identifier_code TEXT,
  p_segment_syntax_error_code TEXT,
  p_element_position INTEGER DEFAULT NULL,
  p_element_syntax_error_code TEXT DEFAULT NULL,
  p_copy_of_bad_data_element TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_error_id UUID;
  v_seg_desc TEXT;
  v_elem_desc TEXT;
BEGIN
  -- Get error descriptions
  SELECT description INTO v_seg_desc
  FROM x12_997_error_codes
  WHERE code = p_segment_syntax_error_code AND error_type = 'segment';

  IF p_element_syntax_error_code IS NOT NULL THEN
    SELECT description INTO v_elem_desc
    FROM x12_997_error_codes
    WHERE code = p_element_syntax_error_code AND error_type = 'element';
  END IF;

  INSERT INTO x12_997_segment_errors (
    transaction_set_id,
    segment_id_code,
    segment_position,
    loop_identifier_code,
    segment_syntax_error_code,
    element_position,
    element_syntax_error_code,
    copy_of_bad_data_element,
    segment_error_description,
    element_error_description
  ) VALUES (
    p_transaction_set_id,
    p_segment_id_code,
    p_segment_position,
    p_loop_identifier_code,
    p_segment_syntax_error_code,
    p_element_position,
    p_element_syntax_error_code,
    p_copy_of_bad_data_element,
    v_seg_desc,
    v_elem_desc
  )
  RETURNING id INTO v_error_id;

  RETURN v_error_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get 997 statistics for dashboard
CREATE OR REPLACE FUNCTION get_997_statistics(
  p_tenant_id UUID,
  p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_acknowledgments INTEGER,
  accepted INTEGER,
  accepted_with_errors INTEGER,
  rejected INTEGER,
  total_transaction_sets INTEGER,
  ts_accepted INTEGER,
  ts_rejected INTEGER,
  common_errors JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN acknowledgment_status = 'A' THEN 1 END) AS accepted,
      COUNT(CASE WHEN acknowledgment_status = 'E' THEN 1 END) AS accepted_errors,
      COUNT(CASE WHEN acknowledgment_status IN ('R', 'M', 'W', 'X') THEN 1 END) AS rejected,
      SUM(COALESCE(transaction_sets_received, 0)) AS total_ts,
      SUM(COALESCE(transaction_sets_accepted, 0)) AS ts_acc,
      SUM(COALESCE(transaction_sets_rejected, 0)) AS ts_rej
    FROM x12_997_acknowledgments
    WHERE tenant_id = p_tenant_id
      AND received_at >= p_date_from
      AND received_at <= p_date_to + INTERVAL '1 day'
  ),
  errors AS (
    SELECT jsonb_agg(jsonb_build_object(
      'code', code,
      'description', description,
      'count', cnt
    ) ORDER BY cnt DESC) AS common_errors
    FROM (
      SELECT
        se.segment_syntax_error_code AS code,
        ec.description,
        COUNT(*) AS cnt
      FROM x12_997_acknowledgments a
      JOIN x12_997_transaction_sets ts ON ts.acknowledgment_id = a.id
      JOIN x12_997_segment_errors se ON se.transaction_set_id = ts.id
      LEFT JOIN x12_997_error_codes ec ON ec.code = se.segment_syntax_error_code
      WHERE a.tenant_id = p_tenant_id
        AND a.received_at >= p_date_from
        AND a.received_at <= p_date_to + INTERVAL '1 day'
      GROUP BY se.segment_syntax_error_code, ec.description
      ORDER BY cnt DESC
      LIMIT 10
    ) e
  )
  SELECT
    stats.total::INTEGER,
    stats.accepted::INTEGER,
    stats.accepted_errors::INTEGER,
    stats.rejected::INTEGER,
    stats.total_ts::INTEGER,
    stats.ts_acc::INTEGER,
    stats.ts_rej::INTEGER,
    errors.common_errors
  FROM stats, errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Link 997 to original claims
CREATE OR REPLACE FUNCTION link_997_to_claims(
  p_acknowledgment_id UUID,
  p_claim_ids TEXT[]
)
RETURNS VOID AS $$
BEGIN
  UPDATE x12_997_acknowledgments
  SET original_claim_ids = p_claim_ids
  WHERE id = p_acknowledgment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE x12_997_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE x12_997_transaction_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE x12_997_segment_errors ENABLE ROW LEVEL SECURITY;

-- Acknowledgments
CREATE POLICY "Billing staff view acknowledgments"
  ON x12_997_acknowledgments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'billing_manager', 'billing_specialist')
    )
  );

CREATE POLICY "System insert acknowledgments"
  ON x12_997_acknowledgments FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Billing staff update acknowledgments"
  ON x12_997_acknowledgments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'billing_manager')
    )
  );

-- Transaction sets
CREATE POLICY "Billing staff view transaction sets"
  ON x12_997_transaction_sets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'billing_manager', 'billing_specialist')
    )
  );

CREATE POLICY "System insert transaction sets"
  ON x12_997_transaction_sets FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- Segment errors
CREATE POLICY "Billing staff view segment errors"
  ON x12_997_segment_errors FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'billing_manager', 'billing_specialist')
    )
  );

CREATE POLICY "System insert segment errors"
  ON x12_997_segment_errors FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- Error codes reference (public read)
CREATE POLICY "Anyone can read error codes"
  ON x12_997_error_codes FOR SELECT TO authenticated
  USING (TRUE);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON v_997_acknowledgment_summary TO authenticated;
GRANT SELECT ON v_997_rejected_transactions TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE x12_997_acknowledgments IS 'X12 997 Functional Acknowledgments from clearinghouses';
COMMENT ON TABLE x12_997_transaction_sets IS 'Individual transaction set acknowledgments within a 997';
COMMENT ON TABLE x12_997_segment_errors IS 'Segment and element level errors reported in 997';
COMMENT ON TABLE x12_997_error_codes IS 'Reference table for X12 997 error codes';
COMMENT ON VIEW v_997_acknowledgment_summary IS 'Summary view of 997 acknowledgments with error counts';
COMMENT ON VIEW v_997_rejected_transactions IS 'Rejected transactions requiring attention';
COMMENT ON FUNCTION store_997_acknowledgment IS 'Store a parsed 997 acknowledgment';
COMMENT ON FUNCTION store_997_transaction_set IS 'Store a transaction set acknowledgment';
COMMENT ON FUNCTION store_997_segment_error IS 'Store a segment or element level error';
COMMENT ON FUNCTION get_997_statistics IS 'Get 997 statistics for dashboard';
