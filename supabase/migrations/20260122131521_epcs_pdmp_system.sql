-- =====================================================
-- EPCS (Electronic Prescribing of Controlled Substances) & PDMP System
-- ONC Criteria: 170.315(b)(3) - Electronic Prescribing
-- DEA Regulation: 21 CFR Part 1311
-- =====================================================

-- =====================================================
-- DEA PROVIDER REGISTRATION
-- Tracks prescribers authorized for controlled substances
-- =====================================================

CREATE TABLE IF NOT EXISTS epcs_provider_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL,

  -- DEA Information
  dea_number VARCHAR(9) NOT NULL,
  dea_suffix CHAR(1), -- For institutional DEAs
  dea_expiration_date DATE NOT NULL,
  dea_schedules INTEGER[] NOT NULL DEFAULT ARRAY[2,3,4,5], -- Authorized schedules

  -- State License
  state_license_number VARCHAR(50) NOT NULL,
  state_license_state CHAR(2) NOT NULL,
  state_license_expiration DATE NOT NULL,

  -- Identity Proofing (NIST IAL2 required by DEA)
  identity_proofing_method VARCHAR(50) NOT NULL, -- 'in_person', 'remote_video', 'knowledge_based'
  identity_proofed_date TIMESTAMPTZ NOT NULL,
  identity_proofing_vendor VARCHAR(100),

  -- Two-Factor Authentication
  tfa_method VARCHAR(50) NOT NULL, -- 'hard_token', 'soft_token', 'biometric'
  tfa_device_serial VARCHAR(100),
  tfa_enrollment_date TIMESTAMPTZ NOT NULL,
  tfa_last_verified TIMESTAMPTZ,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending_verification',
  -- 'pending_verification', 'active', 'suspended', 'revoked', 'expired'
  status_reason TEXT,
  status_updated_at TIMESTAMPTZ,
  status_updated_by UUID,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,

  CONSTRAINT valid_dea_number CHECK (dea_number ~ '^[A-Z]{2}[0-9]{7}$'),
  CONSTRAINT valid_tfa_method CHECK (tfa_method IN ('hard_token', 'soft_token', 'biometric')),
  CONSTRAINT valid_status CHECK (status IN ('pending_verification', 'active', 'suspended', 'revoked', 'expired'))
);

-- Unique DEA per tenant
CREATE UNIQUE INDEX idx_epcs_provider_dea_unique
ON epcs_provider_registrations(tenant_id, dea_number);

CREATE INDEX idx_epcs_provider_registrations_tenant
ON epcs_provider_registrations(tenant_id);

CREATE INDEX idx_epcs_provider_registrations_status
ON epcs_provider_registrations(status);

-- =====================================================
-- EPCS PRESCRIPTIONS
-- Controlled substance prescriptions with DEA compliance
-- =====================================================

CREATE TABLE IF NOT EXISTS epcs_prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Prescription Identifiers
  prescription_number VARCHAR(50) NOT NULL,
  dea_unique_id VARCHAR(100) NOT NULL, -- DEA-required unique ID

  -- Parties
  patient_id UUID NOT NULL,
  prescriber_id UUID NOT NULL,
  prescriber_registration_id UUID NOT NULL REFERENCES epcs_provider_registrations(id),

  -- Medication Details
  medication_name TEXT NOT NULL,
  medication_ndc VARCHAR(11), -- National Drug Code
  medication_rxnorm VARCHAR(20),
  dea_schedule INTEGER NOT NULL, -- 2, 3, 4, or 5

  -- Dosing
  quantity DECIMAL(10,2) NOT NULL,
  quantity_unit VARCHAR(20) NOT NULL, -- 'tablets', 'capsules', 'ml', etc.
  days_supply INTEGER NOT NULL,
  refills_authorized INTEGER NOT NULL DEFAULT 0,
  refills_remaining INTEGER NOT NULL DEFAULT 0,

  -- Directions
  sig TEXT NOT NULL, -- Prescription instructions
  route VARCHAR(50), -- 'oral', 'topical', 'injection', etc.
  frequency VARCHAR(50), -- 'once daily', 'twice daily', 'as needed'

  -- Diagnosis (DEA requires for Schedule II)
  diagnosis_code VARCHAR(20),
  diagnosis_description TEXT,

  -- Pharmacy
  pharmacy_ncpdp_id VARCHAR(10),
  pharmacy_npi VARCHAR(10),
  pharmacy_name TEXT,
  pharmacy_address TEXT,

  -- Digital Signature (21 CFR 1311.120)
  digital_signature_timestamp TIMESTAMPTZ,
  digital_signature_method VARCHAR(50), -- 'hard_token', 'soft_token', 'biometric'
  digital_signature_verified BOOLEAN NOT NULL DEFAULT FALSE,

  -- PDMP Check
  pdmp_checked BOOLEAN NOT NULL DEFAULT FALSE,
  pdmp_check_timestamp TIMESTAMPTZ,
  pdmp_query_id UUID,
  pdmp_override_reason TEXT, -- If PDMP check was overridden

  -- Transmission
  transmission_status VARCHAR(30) NOT NULL DEFAULT 'pending_signature',
  -- 'pending_signature', 'signed', 'transmitted', 'acknowledged', 'error', 'cancelled'
  transmitted_at TIMESTAMPTZ,
  acknowledgment_received_at TIMESTAMPTZ,
  transmission_error TEXT,

  -- Dispensing
  dispensed_at TIMESTAMPTZ,
  dispensed_quantity DECIMAL(10,2),
  partial_fill_allowed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  -- 'draft', 'pending_pdmp', 'pending_signature', 'signed', 'transmitted', 'filled', 'cancelled', 'expired'
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  cancelled_by UUID,

  -- Void (for errors)
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  voided_by UUID,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_dea_schedule CHECK (dea_schedule BETWEEN 2 AND 5),
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_days_supply CHECK (days_supply > 0),
  CONSTRAINT valid_refills CHECK (
    (dea_schedule = 2 AND refills_authorized = 0) OR
    (dea_schedule BETWEEN 3 AND 5 AND refills_authorized <= 5)
  ),
  CONSTRAINT valid_transmission_status CHECK (transmission_status IN (
    'pending_signature', 'signed', 'transmitted', 'acknowledged', 'error', 'cancelled'
  ))
);

CREATE INDEX idx_epcs_prescriptions_tenant ON epcs_prescriptions(tenant_id);
CREATE INDEX idx_epcs_prescriptions_patient ON epcs_prescriptions(patient_id);
CREATE INDEX idx_epcs_prescriptions_prescriber ON epcs_prescriptions(prescriber_id);
CREATE INDEX idx_epcs_prescriptions_status ON epcs_prescriptions(status);
CREATE INDEX idx_epcs_prescriptions_schedule ON epcs_prescriptions(dea_schedule);
CREATE INDEX idx_epcs_prescriptions_created ON epcs_prescriptions(created_at DESC);

-- Unique prescription number per tenant
CREATE UNIQUE INDEX idx_epcs_prescriptions_number_unique
ON epcs_prescriptions(tenant_id, prescription_number);

-- =====================================================
-- EPCS AUDIT LOG
-- Complete audit trail required by DEA (21 CFR 1311.305)
-- =====================================================

CREATE TABLE IF NOT EXISTS epcs_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Event Information
  event_type VARCHAR(50) NOT NULL,
  -- 'prescription_created', 'prescription_signed', 'prescription_transmitted',
  -- 'prescription_cancelled', 'prescription_voided', 'pdmp_checked',
  -- 'signature_failed', 'transmission_failed', 'provider_enrolled', 'provider_suspended'

  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Actor
  user_id UUID NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  user_ip_address INET,
  user_device_info JSONB,

  -- Subject
  prescription_id UUID REFERENCES epcs_prescriptions(id),
  provider_registration_id UUID REFERENCES epcs_provider_registrations(id),
  patient_id UUID,

  -- Details
  event_details JSONB NOT NULL DEFAULT '{}',

  -- For signature events
  signature_method VARCHAR(50),
  tfa_token_serial VARCHAR(100),

  -- Status
  success BOOLEAN NOT NULL DEFAULT TRUE,
  failure_reason TEXT,

  -- Retention (DEA requires 2 years minimum)
  retention_until DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '2 years'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_epcs_audit_tenant ON epcs_audit_log(tenant_id);
CREATE INDEX idx_epcs_audit_timestamp ON epcs_audit_log(event_timestamp DESC);
CREATE INDEX idx_epcs_audit_event_type ON epcs_audit_log(event_type);
CREATE INDEX idx_epcs_audit_user ON epcs_audit_log(user_id);
CREATE INDEX idx_epcs_audit_prescription ON epcs_audit_log(prescription_id);
CREATE INDEX idx_epcs_audit_retention ON epcs_audit_log(retention_until);

-- =====================================================
-- PDMP (Prescription Drug Monitoring Program) QUERIES
-- Tracks all PDMP queries for compliance
-- =====================================================

CREATE TABLE IF NOT EXISTS pdmp_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Query Information
  query_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  query_type VARCHAR(30) NOT NULL DEFAULT 'patient_history',
  -- 'patient_history', 'prescription_verification', 'dispenser_check'

  -- Requesting Provider
  provider_id UUID NOT NULL,
  provider_npi VARCHAR(10) NOT NULL,
  provider_dea VARCHAR(9),

  -- Patient
  patient_id UUID NOT NULL,
  patient_first_name VARCHAR(100) NOT NULL,
  patient_last_name VARCHAR(100) NOT NULL,
  patient_dob DATE NOT NULL,

  -- PDMP System
  pdmp_state CHAR(2) NOT NULL, -- Which state's PDMP
  pdmp_system_name VARCHAR(100), -- 'TX PDMP', 'PMP InterConnect', etc.

  -- Request/Response
  request_payload JSONB,
  response_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- 'pending', 'success', 'error', 'timeout', 'no_records'
  response_received_at TIMESTAMPTZ,
  response_payload JSONB,

  -- Results Summary
  prescriptions_found INTEGER,
  date_range_start DATE,
  date_range_end DATE,

  -- Risk Flags
  flags JSONB NOT NULL DEFAULT '{}',
  -- { "doctor_shopping": false, "pharmacy_shopping": false, "early_refill": false, "high_mme": false }
  morphine_milligram_equivalent DECIMAL(10,2),
  overlapping_prescriptions INTEGER,
  unique_prescribers INTEGER,
  unique_pharmacies INTEGER,

  -- Associated Prescription (if query was for a specific Rx)
  prescription_id UUID REFERENCES epcs_prescriptions(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_query_type CHECK (query_type IN ('patient_history', 'prescription_verification', 'dispenser_check')),
  CONSTRAINT valid_response_status CHECK (response_status IN ('pending', 'success', 'error', 'timeout', 'no_records'))
);

CREATE INDEX idx_pdmp_queries_tenant ON pdmp_queries(tenant_id);
CREATE INDEX idx_pdmp_queries_patient ON pdmp_queries(patient_id);
CREATE INDEX idx_pdmp_queries_provider ON pdmp_queries(provider_id);
CREATE INDEX idx_pdmp_queries_timestamp ON pdmp_queries(query_timestamp DESC);
CREATE INDEX idx_pdmp_queries_state ON pdmp_queries(pdmp_state);

-- =====================================================
-- PDMP PRESCRIPTION HISTORY
-- Stores prescription history returned from PDMP queries
-- =====================================================

CREATE TABLE IF NOT EXISTS pdmp_prescription_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pdmp_query_id UUID NOT NULL REFERENCES pdmp_queries(id) ON DELETE CASCADE,

  -- Prescription Details
  medication_name TEXT NOT NULL,
  medication_ndc VARCHAR(11),
  dea_schedule INTEGER,
  quantity DECIMAL(10,2),
  days_supply INTEGER,
  refills_authorized INTEGER,

  -- Dates
  written_date DATE,
  filled_date DATE NOT NULL,

  -- Prescriber
  prescriber_name TEXT,
  prescriber_npi VARCHAR(10),
  prescriber_dea VARCHAR(9),

  -- Pharmacy
  pharmacy_name TEXT,
  pharmacy_npi VARCHAR(10),
  pharmacy_ncpdp VARCHAR(10),
  pharmacy_address TEXT,

  -- Calculated Fields
  morphine_milligram_equivalent DECIMAL(10,2),

  -- Flags
  overlaps_with_other BOOLEAN NOT NULL DEFAULT FALSE,
  early_refill BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pdmp_history_query ON pdmp_prescription_history(pdmp_query_id);
CREATE INDEX idx_pdmp_history_filled ON pdmp_prescription_history(filled_date DESC);
CREATE INDEX idx_pdmp_history_schedule ON pdmp_prescription_history(dea_schedule);

-- =====================================================
-- DEA SCHEDULE REFERENCE
-- Reference data for controlled substance schedules
-- =====================================================

CREATE TABLE IF NOT EXISTS dea_schedule_reference (
  schedule INTEGER PRIMARY KEY,
  name VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  refills_allowed INTEGER NOT NULL,
  max_days_supply INTEGER,
  examples TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed DEA schedule reference data
INSERT INTO dea_schedule_reference (schedule, name, description, refills_allowed, max_days_supply, examples) VALUES
  (2, 'Schedule II', 'High potential for abuse. Currently accepted medical use. Abuse may lead to severe psychological or physical dependence.', 0, 90, ARRAY['Oxycodone', 'Fentanyl', 'Morphine', 'Hydromorphone', 'Methylphenidate', 'Amphetamines']),
  (3, 'Schedule III', 'Moderate to low potential for physical and psychological dependence. Currently accepted medical use.', 5, NULL, ARRAY['Tylenol with Codeine', 'Buprenorphine', 'Ketamine', 'Anabolic Steroids']),
  (4, 'Schedule IV', 'Low potential for abuse and low risk of dependence. Currently accepted medical use.', 5, NULL, ARRAY['Benzodiazepines', 'Zolpidem', 'Tramadol', 'Carisoprodol']),
  (5, 'Schedule V', 'Lower potential for abuse than Schedule IV. Currently accepted medical use.', 5, NULL, ARRAY['Cough preparations with <200mg codeine', 'Pregabalin', 'Lacosamide'])
ON CONFLICT (schedule) DO NOTHING;

-- =====================================================
-- STATE PDMP CONFIGURATION
-- Configuration for connecting to state PDMP systems
-- =====================================================

CREATE TABLE IF NOT EXISTS pdmp_state_config (
  state_code CHAR(2) PRIMARY KEY,
  state_name VARCHAR(50) NOT NULL,

  -- System Information
  pdmp_system_name VARCHAR(100) NOT NULL,
  pdmp_api_endpoint TEXT,
  pdmp_web_portal_url TEXT,

  -- Requirements
  mandatory_query BOOLEAN NOT NULL DEFAULT FALSE, -- Is query required before prescribing?
  query_timeframe_hours INTEGER NOT NULL DEFAULT 24, -- How recent must query be?
  schedules_covered INTEGER[] NOT NULL DEFAULT ARRAY[2,3,4,5],

  -- Interstate Connectivity
  pmp_interconnect_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  nabp_pmphub_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Texas-Specific (Target Market)
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Texas PDMP configuration
INSERT INTO pdmp_state_config (
  state_code, state_name, pdmp_system_name, pdmp_api_endpoint, pdmp_web_portal_url,
  mandatory_query, query_timeframe_hours, schedules_covered,
  pmp_interconnect_enabled, nabp_pmphub_enabled, is_active, notes
) VALUES (
  'TX', 'Texas', 'Texas Prescription Monitoring Program',
  'https://texas.pmpinterconnect.com/api/v1',
  'https://www.txpmp.org',
  TRUE, 24, ARRAY[2,3,4,5],
  TRUE, TRUE, TRUE,
  'Texas requires PDMP check before prescribing Schedule II-V controlled substances. Effective September 1, 2019.'
) ON CONFLICT (state_code) DO NOTHING;

-- Add other states for reference
INSERT INTO pdmp_state_config (state_code, state_name, pdmp_system_name, mandatory_query, is_active) VALUES
  ('CA', 'California', 'CURES 2.0', TRUE, FALSE),
  ('FL', 'Florida', 'E-FORCSE', TRUE, FALSE),
  ('NY', 'New York', 'I-STOP PMP', TRUE, FALSE),
  ('PA', 'Pennsylvania', 'PA PDMP', TRUE, FALSE)
ON CONFLICT (state_code) DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE epcs_provider_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE epcs_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE epcs_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdmp_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdmp_prescription_history ENABLE ROW LEVEL SECURITY;

-- Provider registrations - tenant isolation
CREATE POLICY epcs_provider_registrations_tenant_policy ON epcs_provider_registrations
  FOR ALL USING (tenant_id = get_current_tenant_id());

-- Prescriptions - tenant isolation
CREATE POLICY epcs_prescriptions_tenant_policy ON epcs_prescriptions
  FOR ALL USING (tenant_id = get_current_tenant_id());

-- Audit log - tenant isolation (read-only for most users)
CREATE POLICY epcs_audit_log_tenant_policy ON epcs_audit_log
  FOR ALL USING (tenant_id = get_current_tenant_id());

-- PDMP queries - tenant isolation
CREATE POLICY pdmp_queries_tenant_policy ON pdmp_queries
  FOR ALL USING (tenant_id = get_current_tenant_id());

-- PDMP history - through query relationship
CREATE POLICY pdmp_prescription_history_tenant_policy ON pdmp_prescription_history
  FOR ALL USING (
    pdmp_query_id IN (
      SELECT id FROM pdmp_queries WHERE tenant_id = get_current_tenant_id()
    )
  );

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to generate DEA-compliant unique prescription ID
CREATE OR REPLACE FUNCTION generate_dea_prescription_id(
  p_tenant_id UUID,
  p_prescriber_dea VARCHAR(9)
) RETURNS VARCHAR(100) AS $$
DECLARE
  v_sequence INTEGER;
  v_timestamp VARCHAR(14);
  v_unique_id VARCHAR(100);
BEGIN
  -- Get next sequence number for this prescriber
  SELECT COALESCE(MAX(CAST(SPLIT_PART(dea_unique_id, '-', 3) AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM epcs_prescriptions
  WHERE tenant_id = p_tenant_id
    AND dea_unique_id LIKE p_prescriber_dea || '-%';

  -- Format: DEA-TIMESTAMP-SEQUENCE
  v_timestamp := TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');
  v_unique_id := p_prescriber_dea || '-' || v_timestamp || '-' || LPAD(v_sequence::TEXT, 6, '0');

  RETURN v_unique_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if PDMP query is required
CREATE OR REPLACE FUNCTION pdmp_query_required(
  p_state CHAR(2),
  p_schedule INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_config pdmp_state_config%ROWTYPE;
BEGIN
  SELECT * INTO v_config
  FROM pdmp_state_config
  WHERE state_code = p_state
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN v_config.mandatory_query AND (p_schedule = ANY(v_config.schedules_covered));
END;
$$ LANGUAGE plpgsql;

-- Function to validate DEA number checksum
CREATE OR REPLACE FUNCTION validate_dea_number(p_dea VARCHAR(9)) RETURNS BOOLEAN AS $$
DECLARE
  v_letters VARCHAR(2);
  v_digits VARCHAR(7);
  v_sum INTEGER;
  v_check_digit INTEGER;
BEGIN
  -- DEA format: 2 letters + 7 digits
  -- First letter: Registrant type (A,B,C,D,E,F,G,H,J,K,L,M,P,R,S,T,U,X)
  -- Second letter: First letter of registrant's last name
  -- Digits 1-6: Assigned number
  -- Digit 7: Check digit

  IF p_dea IS NULL OR LENGTH(p_dea) != 9 THEN
    RETURN FALSE;
  END IF;

  v_letters := UPPER(SUBSTRING(p_dea FROM 1 FOR 2));
  v_digits := SUBSTRING(p_dea FROM 3 FOR 7);

  -- Validate first letter
  IF v_letters NOT SIMILAR TO '[ABCDEFGHJKLMPRSTU][A-Z]' THEN
    RETURN FALSE;
  END IF;

  -- Validate digits
  IF v_digits NOT SIMILAR TO '[0-9]{7}' THEN
    RETURN FALSE;
  END IF;

  -- Calculate checksum
  -- Sum of 1st, 3rd, 5th digits + 2*(sum of 2nd, 4th, 6th digits)
  v_sum := CAST(SUBSTRING(v_digits FROM 1 FOR 1) AS INTEGER) +
           CAST(SUBSTRING(v_digits FROM 3 FOR 1) AS INTEGER) +
           CAST(SUBSTRING(v_digits FROM 5 FOR 1) AS INTEGER) +
           2 * (CAST(SUBSTRING(v_digits FROM 2 FOR 1) AS INTEGER) +
                CAST(SUBSTRING(v_digits FROM 4 FOR 1) AS INTEGER) +
                CAST(SUBSTRING(v_digits FROM 6 FOR 1) AS INTEGER));

  -- Check digit is last digit of sum
  v_check_digit := v_sum % 10;

  RETURN v_check_digit = CAST(SUBSTRING(v_digits FROM 7 FOR 1) AS INTEGER);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to auto-generate DEA unique ID
CREATE OR REPLACE FUNCTION epcs_prescription_before_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_prescriber_dea VARCHAR(9);
BEGIN
  -- Get prescriber's DEA number
  SELECT dea_number INTO v_prescriber_dea
  FROM epcs_provider_registrations
  WHERE id = NEW.prescriber_registration_id;

  -- Generate unique ID if not set
  IF NEW.dea_unique_id IS NULL OR NEW.dea_unique_id = '' THEN
    NEW.dea_unique_id := generate_dea_prescription_id(NEW.tenant_id, v_prescriber_dea);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER epcs_prescription_before_insert_trigger
  BEFORE INSERT ON epcs_prescriptions
  FOR EACH ROW EXECUTE FUNCTION epcs_prescription_before_insert();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION epcs_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER epcs_provider_registrations_updated_trigger
  BEFORE UPDATE ON epcs_provider_registrations
  FOR EACH ROW EXECUTE FUNCTION epcs_update_timestamp();

CREATE TRIGGER epcs_prescriptions_updated_trigger
  BEFORE UPDATE ON epcs_prescriptions
  FOR EACH ROW EXECUTE FUNCTION epcs_update_timestamp();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE epcs_provider_registrations IS 'DEA-registered providers authorized for EPCS (21 CFR 1311)';
COMMENT ON TABLE epcs_prescriptions IS 'Controlled substance prescriptions with full DEA compliance tracking';
COMMENT ON TABLE epcs_audit_log IS 'Complete audit trail for EPCS (DEA requires 2-year retention)';
COMMENT ON TABLE pdmp_queries IS 'Prescription Drug Monitoring Program query history';
COMMENT ON TABLE pdmp_prescription_history IS 'Patient prescription history from PDMP responses';
COMMENT ON TABLE dea_schedule_reference IS 'Reference data for DEA controlled substance schedules';
COMMENT ON TABLE pdmp_state_config IS 'State PDMP system configurations and requirements';

COMMENT ON FUNCTION validate_dea_number IS 'Validates DEA number format and checksum per DEA standards';
COMMENT ON FUNCTION pdmp_query_required IS 'Checks if PDMP query is required for given state and schedule';
COMMENT ON FUNCTION generate_dea_prescription_id IS 'Generates DEA-compliant unique prescription identifier';
