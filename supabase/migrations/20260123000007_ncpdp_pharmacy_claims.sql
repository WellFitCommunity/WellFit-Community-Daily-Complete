-- NCPDP Pharmacy Claims System
-- Purpose: Support pharmacy claim submission using NCPDP D.0 standard
-- Integration: Connects to clearinghouse MCP for claim submission

-- ============================================================================
-- 1. PHARMACY PROVIDER CONNECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS pharmacy_provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,

  -- Pharmacy identification
  pharmacy_name TEXT NOT NULL,
  ncpdp_id TEXT NOT NULL, -- NCPDP Provider ID (7 digits)
  npi TEXT, -- NPI if available
  dea_number TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  fax TEXT,

  -- Network info
  pharmacy_type TEXT CHECK (pharmacy_type IN ('retail', 'mail_order', 'specialty', 'compounding', 'hospital')),
  chain_code TEXT, -- Parent chain identifier if applicable

  -- Connection settings
  connection_type TEXT NOT NULL DEFAULT 'clearinghouse' CHECK (
    connection_type IN ('clearinghouse', 'direct', 'surescripts', 'rxhub')
  ),
  clearinghouse_id TEXT, -- If using clearinghouse
  endpoint_url TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  verified_at TIMESTAMPTZ,
  last_transaction_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, ncpdp_id)
);

-- ============================================================================
-- 2. NCPDP CLAIMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ncpdp_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,

  -- Internal references
  claim_number TEXT NOT NULL UNIQUE,
  refill_request_id UUID REFERENCES refill_requests(id),
  prescription_id UUID,

  -- Patient info
  patient_id UUID NOT NULL,
  patient_first_name TEXT NOT NULL,
  patient_last_name TEXT NOT NULL,
  patient_dob DATE NOT NULL,
  patient_gender TEXT CHECK (patient_gender IN ('M', 'F', 'U')),
  patient_address TEXT,
  patient_city TEXT,
  patient_state TEXT,
  patient_zip TEXT,

  -- Cardholder info (if different from patient)
  cardholder_id TEXT,
  cardholder_first_name TEXT,
  cardholder_last_name TEXT,
  cardholder_relationship TEXT CHECK (cardholder_relationship IN ('self', 'spouse', 'child', 'other')),
  group_id TEXT,
  group_name TEXT,

  -- Prescriber info
  prescriber_id UUID,
  prescriber_npi TEXT NOT NULL,
  prescriber_dea TEXT,
  prescriber_name TEXT NOT NULL,
  prescriber_phone TEXT,

  -- Pharmacy info
  pharmacy_connection_id UUID REFERENCES pharmacy_provider_connections(id),
  service_provider_ncpdp TEXT NOT NULL,
  service_provider_npi TEXT,

  -- Medication info (NCPDP D.0 segments)
  ndc_code TEXT NOT NULL, -- 11-digit NDC
  drug_name TEXT NOT NULL,
  quantity_dispensed NUMERIC(10,3) NOT NULL,
  days_supply INTEGER NOT NULL,
  compound_code TEXT CHECK (compound_code IN ('0', '1', '2')), -- 0=Not compound, 1=Compound, 2=Not applicable
  daw_code TEXT CHECK (daw_code IN ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')), -- Dispense as Written

  -- Pricing (in cents to avoid float issues)
  ingredient_cost_submitted INTEGER, -- In cents
  dispensing_fee_submitted INTEGER,
  usual_and_customary_charge INTEGER,
  gross_amount_due INTEGER,
  patient_pay_amount INTEGER,
  basis_of_cost TEXT CHECK (basis_of_cost IN ('01', '02', '03', '04', '05', '06', '07', '08')),

  -- Dates
  date_written DATE,
  date_of_service DATE NOT NULL,
  fill_number INTEGER DEFAULT 0,
  refills_authorized INTEGER,

  -- Prior auth (if applicable)
  prior_auth_type TEXT,
  prior_auth_number TEXT,

  -- Claim status
  claim_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    claim_status IN ('pending', 'submitted', 'accepted', 'rejected', 'paid', 'reversed', 'duplicate')
  ),
  submission_clarification_code TEXT,

  -- Response fields
  response_status TEXT, -- A=Accepted, R=Rejected, P=Paid
  authorization_number TEXT,
  rejection_codes TEXT[], -- NCPDP rejection codes
  rejection_messages TEXT[],
  paid_amount INTEGER, -- In cents
  copay_amount INTEGER,
  plan_pay_amount INTEGER,
  other_payer_amount INTEGER,

  -- Transaction tracking
  transaction_id TEXT, -- BIN/PCN transaction reference
  transaction_code TEXT CHECK (transaction_code IN ('B1', 'B2', 'B3', 'E1', 'P1', 'P2', 'P3', 'P4')),
  -- B1=Billing, B2=Reversal, B3=Rebill, E1=Eligibility, P1-P4=PA types
  bin_number TEXT,
  processor_control_number TEXT,

  -- NCPDP D.0 specific
  ncpdp_version TEXT DEFAULT 'D.0',
  segment_data JSONB, -- Raw segment data for reference

  -- Clearinghouse tracking
  clearinghouse_claim_id TEXT,
  clearinghouse_batch_id TEXT,
  submitted_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

-- ============================================================================
-- 3. NCPDP CLAIM HISTORY (for reversals, rebills)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ncpdp_claim_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES ncpdp_claims(id) ON DELETE CASCADE,

  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN ('original', 'reversal', 'rebill', 'adjustment')
  ),
  transaction_code TEXT,
  transaction_id TEXT,

  -- Status at this point
  claim_status TEXT NOT NULL,
  response_status TEXT,

  -- Financial snapshot
  gross_amount_due INTEGER,
  paid_amount INTEGER,
  patient_pay_amount INTEGER,

  -- Response data
  rejection_codes TEXT[],
  rejection_messages TEXT[],

  -- Full response
  raw_response JSONB,

  -- Timing
  transaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_by UUID
);

-- ============================================================================
-- 4. FORMULARY CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS formulary_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PBM/Plan identification
  bin_number TEXT NOT NULL,
  processor_control_number TEXT,
  group_id TEXT,

  -- Drug info
  ndc_code TEXT NOT NULL,
  drug_name TEXT,

  -- Formulary status
  formulary_status TEXT CHECK (formulary_status IN ('covered', 'not_covered', 'prior_auth', 'step_therapy', 'quantity_limit')),
  tier INTEGER,
  copay_amount INTEGER, -- In cents
  coinsurance_percent NUMERIC(5,2),

  -- Restrictions
  requires_prior_auth BOOLEAN DEFAULT FALSE,
  requires_step_therapy BOOLEAN DEFAULT FALSE,
  quantity_limit INTEGER,
  quantity_limit_days INTEGER,
  age_restriction TEXT,
  gender_restriction TEXT,

  -- Alternatives
  preferred_alternatives TEXT[], -- NDCs of preferred alternatives

  -- Cache management
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  is_valid BOOLEAN DEFAULT TRUE,

  UNIQUE(bin_number, processor_control_number, group_id, ndc_code)
);

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ncpdp_claims_patient ON ncpdp_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_ncpdp_claims_status ON ncpdp_claims(claim_status);
CREATE INDEX IF NOT EXISTS idx_ncpdp_claims_date ON ncpdp_claims(date_of_service);
CREATE INDEX IF NOT EXISTS idx_ncpdp_claims_ndc ON ncpdp_claims(ndc_code);
CREATE INDEX IF NOT EXISTS idx_ncpdp_claims_pharmacy ON ncpdp_claims(service_provider_ncpdp);
CREATE INDEX IF NOT EXISTS idx_ncpdp_claims_pending ON ncpdp_claims(claim_status) WHERE claim_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ncpdp_claims_rejected ON ncpdp_claims(claim_status) WHERE claim_status = 'rejected';

CREATE INDEX IF NOT EXISTS idx_ncpdp_claim_history_claim ON ncpdp_claim_history(claim_id);
CREATE INDEX IF NOT EXISTS idx_formulary_cache_lookup ON formulary_cache(bin_number, ndc_code);
CREATE INDEX IF NOT EXISTS idx_formulary_cache_valid ON formulary_cache(is_valid) WHERE is_valid = TRUE;

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- Generate next claim number
CREATE OR REPLACE FUNCTION generate_ncpdp_claim_number()
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT := 'RX';
  v_date TEXT := TO_CHAR(NOW(), 'YYMMDD');
  v_seq INTEGER;
  v_claim_number TEXT;
BEGIN
  -- Get next sequence for today
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(claim_number FROM 9) AS INTEGER)
  ), 0) + 1
  INTO v_seq
  FROM ncpdp_claims
  WHERE claim_number LIKE v_prefix || v_date || '%';

  v_claim_number := v_prefix || v_date || LPAD(v_seq::TEXT, 5, '0');

  RETURN v_claim_number;
END;
$$ LANGUAGE plpgsql;

-- Create new pharmacy claim
CREATE OR REPLACE FUNCTION create_ncpdp_claim(
  p_patient_id UUID,
  p_prescriber_npi TEXT,
  p_ndc_code TEXT,
  p_quantity NUMERIC,
  p_days_supply INTEGER,
  p_pharmacy_ncpdp TEXT,
  p_date_of_service DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_claim_id UUID;
  v_claim_number TEXT;
  v_patient RECORD;
  v_result JSONB;
BEGIN
  -- Generate claim number
  v_claim_number := generate_ncpdp_claim_number();

  -- Get patient info
  SELECT first_name, last_name, date_of_birth
  INTO v_patient
  FROM profiles
  WHERE id = p_patient_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Patient not found');
  END IF;

  -- Create claim
  INSERT INTO ncpdp_claims (
    claim_number,
    patient_id,
    patient_first_name,
    patient_last_name,
    patient_dob,
    prescriber_npi,
    prescriber_name,
    service_provider_ncpdp,
    ndc_code,
    drug_name,
    quantity_dispensed,
    days_supply,
    date_of_service,
    claim_status,
    transaction_code
  ) VALUES (
    v_claim_number,
    p_patient_id,
    v_patient.first_name,
    v_patient.last_name,
    v_patient.date_of_birth,
    p_prescriber_npi,
    'Provider', -- Would be looked up in real implementation
    p_pharmacy_ncpdp,
    p_ndc_code,
    'Drug Name', -- Would be looked up from NDC database
    p_quantity,
    p_days_supply,
    p_date_of_service,
    'pending',
    'B1' -- Billing transaction
  )
  RETURNING id INTO v_claim_id;

  -- Log history
  INSERT INTO ncpdp_claim_history (
    claim_id,
    transaction_type,
    transaction_code,
    claim_status
  ) VALUES (
    v_claim_id,
    'original',
    'B1',
    'pending'
  );

  v_result := jsonb_build_object(
    'success', TRUE,
    'claim_id', v_claim_id,
    'claim_number', v_claim_number,
    'message', 'Claim created successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit claim to clearinghouse
CREATE OR REPLACE FUNCTION submit_ncpdp_claim(
  p_claim_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_claim RECORD;
  v_result JSONB;
BEGIN
  -- Get claim
  SELECT * INTO v_claim
  FROM ncpdp_claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Claim not found');
  END IF;

  IF v_claim.claim_status NOT IN ('pending', 'rejected') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Claim is not in submittable status');
  END IF;

  -- Update claim status
  UPDATE ncpdp_claims
  SET
    claim_status = 'submitted',
    submitted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_claim_id;

  -- Log history
  INSERT INTO ncpdp_claim_history (
    claim_id,
    transaction_type,
    transaction_code,
    claim_status
  ) VALUES (
    p_claim_id,
    CASE WHEN v_claim.claim_status = 'rejected' THEN 'rebill' ELSE 'original' END,
    CASE WHEN v_claim.claim_status = 'rejected' THEN 'B3' ELSE 'B1' END,
    'submitted'
  );

  -- Note: Actual submission would happen via MCP clearinghouse tool
  v_result := jsonb_build_object(
    'success', TRUE,
    'claim_id', p_claim_id,
    'claim_number', v_claim.claim_number,
    'status', 'submitted',
    'message', 'Claim submitted to clearinghouse'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process claim response from clearinghouse
CREATE OR REPLACE FUNCTION process_ncpdp_claim_response(
  p_claim_id UUID,
  p_response_status TEXT,
  p_authorization_number TEXT DEFAULT NULL,
  p_paid_amount INTEGER DEFAULT NULL,
  p_copay_amount INTEGER DEFAULT NULL,
  p_rejection_codes TEXT[] DEFAULT NULL,
  p_rejection_messages TEXT[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_new_status TEXT;
  v_result JSONB;
BEGIN
  -- Determine new status
  v_new_status := CASE p_response_status
    WHEN 'A' THEN 'accepted'
    WHEN 'P' THEN 'paid'
    WHEN 'R' THEN 'rejected'
    ELSE 'pending'
  END;

  -- Update claim
  UPDATE ncpdp_claims
  SET
    claim_status = v_new_status,
    response_status = p_response_status,
    authorization_number = p_authorization_number,
    paid_amount = p_paid_amount,
    copay_amount = p_copay_amount,
    rejection_codes = p_rejection_codes,
    rejection_messages = p_rejection_messages,
    response_received_at = NOW(),
    updated_at = NOW()
  WHERE id = p_claim_id;

  -- Log history
  INSERT INTO ncpdp_claim_history (
    claim_id,
    transaction_type,
    claim_status,
    response_status,
    paid_amount,
    patient_pay_amount,
    rejection_codes,
    rejection_messages
  ) VALUES (
    p_claim_id,
    'original',
    v_new_status,
    p_response_status,
    p_paid_amount,
    p_copay_amount,
    p_rejection_codes,
    p_rejection_messages
  );

  v_result := jsonb_build_object(
    'success', TRUE,
    'claim_id', p_claim_id,
    'status', v_new_status,
    'message', 'Claim response processed'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reverse a paid claim
CREATE OR REPLACE FUNCTION reverse_ncpdp_claim(
  p_claim_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_claim RECORD;
  v_result JSONB;
BEGIN
  -- Get claim
  SELECT * INTO v_claim
  FROM ncpdp_claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Claim not found');
  END IF;

  IF v_claim.claim_status NOT IN ('accepted', 'paid') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only accepted/paid claims can be reversed');
  END IF;

  -- Update claim
  UPDATE ncpdp_claims
  SET
    claim_status = 'reversed',
    transaction_code = 'B2',
    updated_at = NOW()
  WHERE id = p_claim_id;

  -- Log history
  INSERT INTO ncpdp_claim_history (
    claim_id,
    transaction_type,
    transaction_code,
    claim_status,
    raw_response
  ) VALUES (
    p_claim_id,
    'reversal',
    'B2',
    'reversed',
    jsonb_build_object('reason', p_reason)
  );

  v_result := jsonb_build_object(
    'success', TRUE,
    'claim_id', p_claim_id,
    'status', 'reversed',
    'message', 'Claim reversal initiated'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get claim metrics
CREATE OR REPLACE FUNCTION get_ncpdp_claim_metrics(
  p_tenant_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT CURRENT_DATE - 30,
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_date_from, 'to', p_date_to),
    'total_claims', COUNT(*),
    'pending_claims', COUNT(*) FILTER (WHERE claim_status = 'pending'),
    'submitted_claims', COUNT(*) FILTER (WHERE claim_status = 'submitted'),
    'accepted_claims', COUNT(*) FILTER (WHERE claim_status IN ('accepted', 'paid')),
    'rejected_claims', COUNT(*) FILTER (WHERE claim_status = 'rejected'),
    'reversed_claims', COUNT(*) FILTER (WHERE claim_status = 'reversed'),
    'acceptance_rate', ROUND(
      100.0 * COUNT(*) FILTER (WHERE claim_status IN ('accepted', 'paid')) /
      NULLIF(COUNT(*) FILTER (WHERE claim_status NOT IN ('pending', 'submitted')), 0),
      2
    ),
    'total_billed_cents', SUM(gross_amount_due) FILTER (WHERE claim_status IN ('accepted', 'paid')),
    'total_paid_cents', SUM(paid_amount) FILTER (WHERE claim_status = 'paid'),
    'total_copays_cents', SUM(copay_amount) FILTER (WHERE claim_status = 'paid'),
    'top_rejection_codes', (
      SELECT jsonb_agg(jsonb_build_object('code', code, 'count', cnt))
      FROM (
        SELECT UNNEST(rejection_codes) as code, COUNT(*) as cnt
        FROM ncpdp_claims
        WHERE date_of_service BETWEEN p_date_from AND p_date_to
          AND rejection_codes IS NOT NULL
          AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
        GROUP BY UNNEST(rejection_codes)
        ORDER BY cnt DESC
        LIMIT 5
      ) top_codes
    )
  )
  INTO v_result
  FROM ncpdp_claims
  WHERE date_of_service BETWEEN p_date_from AND p_date_to
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE pharmacy_provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncpdp_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncpdp_claim_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulary_cache ENABLE ROW LEVEL SECURITY;

-- Pharmacy connections
CREATE POLICY "Staff can view pharmacy connections"
  ON pharmacy_provider_connections FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admins can manage pharmacy connections"
  ON pharmacy_provider_connections FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Claims
CREATE POLICY "Clinical staff can view claims"
  ON ncpdp_claims FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Pharmacy staff can manage claims"
  ON ncpdp_claims FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'pharmacist', 'provider')
    )
  );

-- Claim history
CREATE POLICY "Staff can view claim history"
  ON ncpdp_claim_history FOR SELECT TO authenticated
  USING (TRUE);

-- Formulary cache
CREATE POLICY "Staff can view formulary"
  ON formulary_cache FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "System can manage formulary"
  ON formulary_cache FOR ALL TO authenticated
  USING (TRUE);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE pharmacy_provider_connections IS 'Pharmacy provider connections for NCPDP claim routing';
COMMENT ON TABLE ncpdp_claims IS 'NCPDP D.0 pharmacy claims for PBM billing';
COMMENT ON TABLE ncpdp_claim_history IS 'Audit trail of claim transactions';
COMMENT ON TABLE formulary_cache IS 'Cached formulary/coverage data from PBMs';
COMMENT ON FUNCTION create_ncpdp_claim IS 'Create a new pharmacy billing claim';
COMMENT ON FUNCTION submit_ncpdp_claim IS 'Submit claim to clearinghouse for processing';
COMMENT ON FUNCTION process_ncpdp_claim_response IS 'Process response from clearinghouse';
COMMENT ON FUNCTION reverse_ncpdp_claim IS 'Reverse a previously paid claim';
COMMENT ON FUNCTION get_ncpdp_claim_metrics IS 'Get pharmacy claim metrics for dashboard';
