-- ============================================================================
-- Healthcare Integrations System
-- ============================================================================
-- This migration adds support for external healthcare system integrations:
-- - Lab Systems (LabCorp, Quest Diagnostics) via FHIR R4
-- - Pharmacy (Surescripts, PillPack) via NCPDP/SCRIPT
-- - Imaging (PACS, DICOM) integration
-- - Insurance Verification (X12 270/271)
--
-- Builds on top of existing FHIR and HL7 v2 infrastructure.
-- ============================================================================

-- ============================================================================
-- SECTION 1: LAB SYSTEMS INTEGRATION
-- ============================================================================

-- Lab provider connections (LabCorp, Quest, etc.)
CREATE TABLE IF NOT EXISTS lab_provider_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Provider identification
    provider_code TEXT NOT NULL CHECK (provider_code IN ('LABCORP', 'QUEST', 'BIOREFERENCE', 'SONIC', 'CUSTOM')),
    provider_name TEXT NOT NULL,
    description TEXT,

    -- FHIR connection settings
    fhir_base_url TEXT NOT NULL,
    fhir_version TEXT NOT NULL DEFAULT 'R4',

    -- Authentication
    auth_type TEXT NOT NULL DEFAULT 'oauth2' CHECK (auth_type IN ('oauth2', 'api_key', 'basic', 'smart_on_fhir')),
    client_id TEXT,
    client_secret_encrypted BYTEA, -- Encrypted storage
    api_key_encrypted BYTEA,

    -- OAuth2 tokens (encrypted)
    access_token_encrypted BYTEA,
    refresh_token_encrypted BYTEA,
    token_expires_at TIMESTAMPTZ,

    -- SMART on FHIR settings
    smart_authorize_url TEXT,
    smart_token_url TEXT,
    smart_scopes TEXT[],

    -- Facility/account identifiers
    facility_id TEXT, -- Lab's identifier for our facility
    account_number TEXT,

    -- Settings
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_fetch_results BOOLEAN NOT NULL DEFAULT true,
    fetch_interval_minutes INTEGER DEFAULT 60,
    result_notification_enabled BOOLEAN DEFAULT true,

    -- Status tracking
    last_connected_at TIMESTAMPTZ,
    last_fetch_at TIMESTAMPTZ,
    last_error TEXT,
    connection_status TEXT DEFAULT 'disconnected' CHECK (
        connection_status IN ('connected', 'disconnected', 'error', 'testing')
    ),

    -- Statistics
    orders_sent INTEGER DEFAULT 0,
    results_received INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    UNIQUE(tenant_id, provider_code)
);

-- Lab orders
CREATE TABLE IF NOT EXISTS lab_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES lab_provider_connections(id) ON DELETE SET NULL,

    -- Patient
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Order identification
    internal_order_id TEXT NOT NULL,
    external_order_id TEXT, -- Lab's order ID
    accession_number TEXT, -- Lab's specimen accession number

    -- Ordering provider
    ordering_provider_id UUID REFERENCES profiles(id),
    ordering_provider_npi TEXT,

    -- Order details
    order_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        order_status IN ('pending', 'submitted', 'received', 'in_progress', 'resulted', 'partial', 'cancelled', 'error')
    ),
    priority TEXT DEFAULT 'routine' CHECK (priority IN ('stat', 'asap', 'routine', 'preop', 'callback')),

    -- Clinical info
    diagnosis_codes TEXT[], -- ICD-10 codes
    clinical_notes TEXT,
    fasting_required BOOLEAN DEFAULT false,
    fasting_hours INTEGER,

    -- Specimen info
    specimen_collected_at TIMESTAMPTZ,
    specimen_type TEXT,
    specimen_source TEXT,

    -- Timing
    ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    received_by_lab_at TIMESTAMPTZ,
    expected_results_at TIMESTAMPTZ,
    resulted_at TIMESTAMPTZ,

    -- FHIR references
    fhir_service_request_id TEXT,
    fhir_diagnostic_report_id TEXT,

    -- HL7 tracking
    hl7_message_id UUID REFERENCES hl7_message_log(id),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lab order tests (individual tests within an order)
CREATE TABLE IF NOT EXISTS lab_order_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,

    -- Test identification
    test_code TEXT NOT NULL, -- CPT or lab-specific code
    test_name TEXT NOT NULL,
    loinc_code TEXT, -- LOINC if available

    -- Status
    test_status TEXT NOT NULL DEFAULT 'ordered' CHECK (
        test_status IN ('ordered', 'received', 'in_progress', 'resulted', 'cancelled', 'error')
    ),

    -- Results (when available)
    result_value TEXT,
    result_unit TEXT,
    reference_range TEXT,
    abnormal_flag TEXT, -- H, L, HH, LL, A, etc.
    interpretation TEXT,

    -- Result details
    resulted_at TIMESTAMPTZ,
    performing_lab TEXT,
    pathologist_notes TEXT,

    -- FHIR reference
    fhir_observation_id TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lab results (full result documents)
CREATE TABLE IF NOT EXISTS lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES lab_orders(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES lab_provider_connections(id) ON DELETE SET NULL,

    -- Result identification
    accession_number TEXT NOT NULL,
    report_id TEXT, -- Lab's report ID

    -- Report info
    report_status TEXT NOT NULL DEFAULT 'preliminary' CHECK (
        report_status IN ('registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled')
    ),
    report_type TEXT, -- Panel name, test category

    -- Dates
    specimen_collected_at TIMESTAMPTZ,
    specimen_received_at TIMESTAMPTZ,
    reported_at TIMESTAMPTZ NOT NULL,

    -- Provider info
    ordering_provider_name TEXT,
    performing_lab_name TEXT,
    pathologist_name TEXT,

    -- Content
    results_summary JSONB, -- Structured results
    pdf_report_url TEXT, -- Signed URL to PDF
    pdf_report_encrypted BYTEA, -- Or encrypted local storage

    -- FHIR references
    fhir_diagnostic_report_id TEXT,
    fhir_bundle_id TEXT,

    -- Notification tracking
    patient_notified BOOLEAN DEFAULT false,
    patient_notified_at TIMESTAMPTZ,
    provider_notified BOOLEAN DEFAULT false,
    provider_notified_at TIMESTAMPTZ,

    -- Review tracking
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Critical values
    has_critical_values BOOLEAN DEFAULT false,
    critical_values_acknowledged BOOLEAN DEFAULT false,
    critical_values_acknowledged_at TIMESTAMPTZ,
    critical_values_acknowledged_by UUID REFERENCES auth.users(id),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lab tables
CREATE INDEX idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX idx_lab_orders_status ON lab_orders(order_status);
CREATE INDEX idx_lab_orders_ordered ON lab_orders(ordered_at DESC);
CREATE INDEX idx_lab_orders_external ON lab_orders(external_order_id);
CREATE INDEX idx_lab_results_patient ON lab_results(patient_id);
CREATE INDEX idx_lab_results_accession ON lab_results(accession_number);
CREATE INDEX idx_lab_results_reported ON lab_results(reported_at DESC);
CREATE INDEX idx_lab_results_critical ON lab_results(has_critical_values) WHERE has_critical_values = true;

-- ============================================================================
-- SECTION 2: PHARMACY INTEGRATION
-- ============================================================================

-- Pharmacy connections (Surescripts, PillPack, local pharmacies)
CREATE TABLE IF NOT EXISTS pharmacy_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Pharmacy identification
    pharmacy_type TEXT NOT NULL CHECK (
        pharmacy_type IN ('SURESCRIPTS', 'PILLPACK', 'CVS', 'WALGREENS', 'LOCAL', 'MAIL_ORDER', 'SPECIALTY', 'CUSTOM')
    ),
    pharmacy_name TEXT NOT NULL,
    ncpdp_id TEXT, -- National Council for Prescription Drug Programs ID
    npi TEXT, -- National Provider Identifier
    dea_number TEXT, -- DEA registration (for controlled substances)

    -- Contact info
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    phone TEXT,
    fax TEXT,

    -- Integration settings
    protocol TEXT NOT NULL DEFAULT 'NCPDP_SCRIPT' CHECK (
        protocol IN ('NCPDP_SCRIPT', 'FHIR', 'API', 'FAX', 'MANUAL')
    ),
    api_endpoint TEXT,

    -- Authentication
    auth_type TEXT DEFAULT 'api_key' CHECK (auth_type IN ('api_key', 'oauth2', 'basic', 'certificate')),
    credentials_encrypted BYTEA, -- Encrypted credentials

    -- Capabilities
    supports_erx BOOLEAN DEFAULT true, -- Electronic prescribing
    supports_refill_requests BOOLEAN DEFAULT true,
    supports_medication_history BOOLEAN DEFAULT true,
    supports_eligibility BOOLEAN DEFAULT true,
    supports_controlled_substances BOOLEAN DEFAULT false, -- EPCS

    -- Settings
    enabled BOOLEAN NOT NULL DEFAULT true,
    is_preferred BOOLEAN DEFAULT false, -- Preferred pharmacy for patients

    -- Status
    last_connected_at TIMESTAMPTZ,
    last_transaction_at TIMESTAMPTZ,
    connection_status TEXT DEFAULT 'active',

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    UNIQUE(tenant_id, ncpdp_id)
);

-- E-Prescriptions
CREATE TABLE IF NOT EXISTS e_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pharmacy_connection_id UUID REFERENCES pharmacy_connections(id),

    -- Patient
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Prescriber
    prescriber_id UUID REFERENCES profiles(id),
    prescriber_npi TEXT NOT NULL,
    prescriber_dea TEXT, -- Required for controlled substances

    -- Prescription identification
    internal_rx_id TEXT NOT NULL,
    external_rx_id TEXT, -- Pharmacy's Rx number
    surescripts_message_id TEXT,

    -- Medication details
    medication_name TEXT NOT NULL,
    medication_ndc TEXT, -- National Drug Code
    rxnorm_code TEXT, -- RxNorm CUI
    strength TEXT,
    dosage_form TEXT, -- tablet, capsule, solution, etc.

    -- Prescription details
    quantity INTEGER NOT NULL,
    quantity_unit TEXT DEFAULT 'EA', -- Each, mL, etc.
    days_supply INTEGER,
    refills_authorized INTEGER DEFAULT 0,
    refills_remaining INTEGER,

    -- Instructions
    sig TEXT NOT NULL, -- Directions for use
    sig_code TEXT, -- Structured sig code

    -- Dispensing
    dispense_as_written BOOLEAN DEFAULT false,
    substitution_allowed BOOLEAN DEFAULT true,

    -- Clinical info
    diagnosis_codes TEXT[], -- ICD-10
    indication TEXT,
    prior_auth_number TEXT,

    -- Controlled substance info
    is_controlled_substance BOOLEAN DEFAULT false,
    schedule TEXT CHECK (schedule IN ('II', 'III', 'IV', 'V')),

    -- Status tracking
    rx_status TEXT NOT NULL DEFAULT 'draft' CHECK (
        rx_status IN ('draft', 'pending_review', 'signed', 'transmitted', 'dispensed',
                      'partially_filled', 'cancelled', 'expired', 'transfer_out', 'error')
    ),

    -- Timing
    written_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    signed_at TIMESTAMPTZ,
    transmitted_at TIMESTAMPTZ,
    dispensed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- Errors and responses
    transmission_error TEXT,
    pharmacy_response JSONB,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Medication history (from pharmacy benefit managers)
CREATE TABLE IF NOT EXISTS medication_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Source
    source TEXT NOT NULL CHECK (source IN ('SURESCRIPTS', 'PBM', 'PATIENT_REPORTED', 'FHIR', 'MANUAL')),
    source_pharmacy_name TEXT,
    source_pharmacy_ncpdp TEXT,

    -- Medication
    medication_name TEXT NOT NULL,
    ndc TEXT,
    rxnorm_code TEXT,
    strength TEXT,
    dosage_form TEXT,

    -- Fill details
    fill_date DATE,
    quantity_dispensed INTEGER,
    days_supply INTEGER,
    refills_remaining INTEGER,

    -- Prescriber
    prescriber_name TEXT,
    prescriber_npi TEXT,

    -- Status
    is_active BOOLEAN DEFAULT true,
    discontinued_date DATE,
    discontinued_reason TEXT,

    -- Fetched from external source
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_data JSONB, -- Original data from source

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refill requests
CREATE TABLE IF NOT EXISTS refill_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- References
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    original_prescription_id UUID REFERENCES e_prescriptions(id),
    pharmacy_connection_id UUID REFERENCES pharmacy_connections(id),

    -- Request details
    medication_name TEXT NOT NULL,
    request_source TEXT NOT NULL CHECK (request_source IN ('PHARMACY', 'PATIENT', 'AUTOMATED')),

    -- Status
    request_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        request_status IN ('pending', 'approved', 'denied', 'new_rx_needed', 'expired')
    ),

    -- Response
    response_prescription_id UUID REFERENCES e_prescriptions(id),
    response_notes TEXT,
    responded_by UUID REFERENCES auth.users(id),
    responded_at TIMESTAMPTZ,

    -- Timing
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_by TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for pharmacy tables
CREATE INDEX idx_pharmacy_erx_patient ON e_prescriptions(patient_id);
CREATE INDEX idx_pharmacy_erx_status ON e_prescriptions(rx_status);
CREATE INDEX idx_pharmacy_erx_transmitted ON e_prescriptions(transmitted_at DESC);
CREATE INDEX idx_med_history_patient ON medication_history(patient_id);
CREATE INDEX idx_med_history_active ON medication_history(patient_id, is_active) WHERE is_active = true;
CREATE INDEX idx_refill_requests_pending ON refill_requests(request_status, requested_at) WHERE request_status = 'pending';

-- ============================================================================
-- SECTION 3: IMAGING/PACS INTEGRATION
-- ============================================================================

-- PACS connections
CREATE TABLE IF NOT EXISTS pacs_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- PACS identification
    pacs_vendor TEXT NOT NULL, -- GE, Philips, Fuji, etc.
    pacs_name TEXT NOT NULL,
    description TEXT,

    -- DICOM settings
    ae_title TEXT NOT NULL, -- Application Entity Title
    hostname TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 104, -- Standard DICOM port

    -- Query/Retrieve settings
    query_ae_title TEXT,
    query_port INTEGER,

    -- WADO (Web Access to DICOM Objects) settings
    wado_url TEXT, -- For web-based image retrieval
    wado_auth_type TEXT CHECK (wado_auth_type IN ('none', 'basic', 'oauth2', 'api_key')),
    wado_credentials_encrypted BYTEA,

    -- DICOMweb API (modern REST API)
    dicomweb_url TEXT,
    dicomweb_qido_path TEXT DEFAULT '/dicom-web/studies',
    dicomweb_wado_path TEXT DEFAULT '/dicom-web/studies',
    dicomweb_stow_path TEXT DEFAULT '/dicom-web/studies',

    -- Settings
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_fetch_studies BOOLEAN DEFAULT false,
    store_images_locally BOOLEAN DEFAULT false,

    -- Status
    last_connected_at TIMESTAMPTZ,
    last_query_at TIMESTAMPTZ,
    connection_status TEXT DEFAULT 'disconnected',

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    UNIQUE(tenant_id, ae_title)
);

-- Imaging orders
CREATE TABLE IF NOT EXISTS imaging_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pacs_connection_id UUID REFERENCES pacs_connections(id) ON DELETE SET NULL,

    -- Patient
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Order identification
    internal_order_id TEXT NOT NULL,
    accession_number TEXT, -- Radiology accession number

    -- Ordering provider
    ordering_provider_id UUID REFERENCES profiles(id),
    ordering_provider_npi TEXT,

    -- Order details
    modality TEXT NOT NULL, -- CR, CT, MR, US, XA, etc.
    procedure_code TEXT NOT NULL, -- CPT code
    procedure_name TEXT NOT NULL,
    body_part TEXT, -- SNOMED or RadLex code
    laterality TEXT CHECK (laterality IN ('LEFT', 'RIGHT', 'BILATERAL', 'N/A')),

    -- Clinical info
    reason_for_exam TEXT,
    diagnosis_codes TEXT[], -- ICD-10
    clinical_history TEXT,

    -- Priority
    priority TEXT DEFAULT 'routine' CHECK (priority IN ('stat', 'urgent', 'routine', 'scheduled')),

    -- Status
    order_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        order_status IN ('pending', 'scheduled', 'in_progress', 'completed', 'dictated',
                         'finalized', 'cancelled', 'no_show')
    ),

    -- Scheduling
    scheduled_at TIMESTAMPTZ,
    performed_at TIMESTAMPTZ,

    -- Performing location
    performing_facility TEXT,
    performing_location TEXT, -- Room/equipment

    -- Reporting
    interpreting_radiologist TEXT,
    dictated_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,

    -- DICOM UIDs
    study_instance_uid TEXT,

    -- FHIR references
    fhir_imaging_study_id TEXT,
    fhir_diagnostic_report_id TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Imaging studies (DICOM metadata)
CREATE TABLE IF NOT EXISTS imaging_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES imaging_orders(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pacs_connection_id UUID REFERENCES pacs_connections(id) ON DELETE SET NULL,

    -- DICOM UIDs
    study_instance_uid TEXT NOT NULL UNIQUE,
    series_count INTEGER DEFAULT 0,
    instance_count INTEGER DEFAULT 0,

    -- Study details
    study_date DATE NOT NULL,
    study_time TIME,
    accession_number TEXT,

    -- Modality info
    modalities TEXT[], -- Array of modalities in study
    study_description TEXT,
    body_part_examined TEXT,

    -- Patient info (from DICOM, may differ from system)
    dicom_patient_name TEXT,
    dicom_patient_id TEXT, -- MRN in DICOM

    -- Institution info
    institution_name TEXT,
    referring_physician TEXT,
    performing_physician TEXT,

    -- Storage info
    storage_location TEXT, -- PACS, local archive, cloud
    total_size_bytes BIGINT,

    -- Status
    availability TEXT DEFAULT 'ONLINE' CHECK (availability IN ('ONLINE', 'NEARLINE', 'OFFLINE', 'UNAVAILABLE')),

    -- Report
    has_report BOOLEAN DEFAULT false,
    report_id UUID, -- Reference to imaging_reports

    -- Audit
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Imaging reports (radiology reports)
CREATE TABLE IF NOT EXISTS imaging_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    study_id UUID REFERENCES imaging_studies(id) ON DELETE SET NULL,
    order_id UUID REFERENCES imaging_orders(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Report identification
    report_id TEXT NOT NULL,
    accession_number TEXT,

    -- Report content
    report_status TEXT NOT NULL DEFAULT 'preliminary' CHECK (
        report_status IN ('draft', 'preliminary', 'final', 'amended', 'cancelled')
    ),

    -- Sections
    clinical_info TEXT,
    comparison TEXT, -- Prior studies compared
    technique TEXT,
    findings TEXT NOT NULL,
    impression TEXT NOT NULL, -- Key findings summary

    -- Structured findings (RadLex/SNOMED coded)
    coded_findings JSONB,

    -- Critical/urgent findings
    has_critical_finding BOOLEAN DEFAULT false,
    critical_finding_description TEXT,
    critical_finding_communicated BOOLEAN DEFAULT false,
    critical_finding_communicated_to TEXT,
    critical_finding_communicated_at TIMESTAMPTZ,

    -- Radiologist
    dictating_radiologist TEXT,
    dictating_radiologist_npi TEXT,
    signing_radiologist TEXT,
    signing_radiologist_npi TEXT,

    -- Timing
    dictated_at TIMESTAMPTZ,
    transcribed_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    amended_at TIMESTAMPTZ,

    -- Amendment tracking
    is_amended BOOLEAN DEFAULT false,
    amendment_reason TEXT,
    original_report_id UUID REFERENCES imaging_reports(id),

    -- FHIR reference
    fhir_diagnostic_report_id TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for imaging tables
CREATE INDEX idx_imaging_orders_patient ON imaging_orders(patient_id);
CREATE INDEX idx_imaging_orders_status ON imaging_orders(order_status);
CREATE INDEX idx_imaging_studies_patient ON imaging_studies(patient_id);
CREATE INDEX idx_imaging_studies_uid ON imaging_studies(study_instance_uid);
CREATE INDEX idx_imaging_studies_date ON imaging_studies(study_date DESC);
CREATE INDEX idx_imaging_reports_patient ON imaging_reports(patient_id);
CREATE INDEX idx_imaging_reports_critical ON imaging_reports(has_critical_finding) WHERE has_critical_finding = true;

-- ============================================================================
-- SECTION 4: INSURANCE VERIFICATION (X12 270/271)
-- ============================================================================

-- Insurance payer connections
CREATE TABLE IF NOT EXISTS insurance_payer_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Payer identification
    payer_id TEXT NOT NULL, -- Payer ID for EDI
    payer_name TEXT NOT NULL,
    payer_type TEXT CHECK (payer_type IN ('COMMERCIAL', 'MEDICARE', 'MEDICAID', 'TRICARE', 'WORKERS_COMP', 'AUTO', 'OTHER')),

    -- EDI settings
    edi_receiver_id TEXT, -- ISA08
    edi_interchange_qualifier TEXT DEFAULT '30', -- ISA07 (30 = HICN)

    -- Connection method
    connection_type TEXT NOT NULL CHECK (connection_type IN ('CLEARINGHOUSE', 'DIRECT', 'PORTAL', 'API')),

    -- Clearinghouse (if applicable)
    clearinghouse_name TEXT,
    clearinghouse_id TEXT,

    -- API/Portal settings
    api_endpoint TEXT,
    portal_url TEXT,

    -- Authentication
    auth_type TEXT DEFAULT 'api_key' CHECK (auth_type IN ('api_key', 'oauth2', 'basic', 'certificate', 'sftp')),
    credentials_encrypted BYTEA,

    -- Capabilities
    supports_270_271 BOOLEAN DEFAULT true, -- Eligibility
    supports_276_277 BOOLEAN DEFAULT false, -- Claim status
    supports_278 BOOLEAN DEFAULT false, -- Prior auth
    supports_835 BOOLEAN DEFAULT false, -- Remittance
    supports_837 BOOLEAN DEFAULT false, -- Claims

    -- Real-time vs batch
    supports_real_time BOOLEAN DEFAULT false,
    batch_schedule TEXT, -- Cron expression

    -- Settings
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Status
    last_transaction_at TIMESTAMPTZ,
    last_error TEXT,
    connection_status TEXT DEFAULT 'active',

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    UNIQUE(tenant_id, payer_id)
);

-- Eligibility verification requests (270)
CREATE TABLE IF NOT EXISTS eligibility_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payer_connection_id UUID REFERENCES insurance_payer_connections(id) ON DELETE SET NULL,

    -- Patient/subscriber
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subscriber_id TEXT NOT NULL, -- Member ID
    subscriber_name TEXT,
    subscriber_dob DATE,

    -- Dependent info (if checking dependent)
    is_dependent BOOLEAN DEFAULT false,
    dependent_name TEXT,
    dependent_dob DATE,
    relationship_code TEXT, -- 01=Spouse, 19=Child, etc.

    -- Service info
    service_type_codes TEXT[], -- Professional, Hospital, Mental Health, etc.
    date_of_service DATE NOT NULL,
    provider_npi TEXT,
    provider_taxonomy TEXT,

    -- Request tracking
    request_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        request_status IN ('pending', 'submitted', 'received', 'error', 'timeout')
    ),

    -- EDI tracking
    trace_number TEXT, -- TRN02
    submitter_trace TEXT,

    -- Timing
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    response_received_at TIMESTAMPTZ,

    -- Raw EDI (for troubleshooting)
    raw_270 TEXT, -- Outbound request
    raw_271 TEXT, -- Inbound response

    -- Response reference
    response_id UUID, -- References eligibility_responses

    -- Error tracking
    error_code TEXT,
    error_message TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Eligibility responses (271)
CREATE TABLE IF NOT EXISTS eligibility_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES eligibility_requests(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Response status
    response_status TEXT NOT NULL CHECK (
        response_status IN ('ACTIVE', 'INACTIVE', 'NOT_FOUND', 'REQUIRES_REVIEW', 'ERROR')
    ),

    -- Subscriber info (from response)
    subscriber_name_response TEXT,
    subscriber_id_response TEXT,
    subscriber_group_number TEXT,
    subscriber_group_name TEXT,

    -- Plan info
    plan_name TEXT,
    plan_number TEXT,
    plan_effective_date DATE,
    plan_term_date DATE,

    -- Coverage details (structured)
    coverage_details JSONB, -- Array of coverage info by service type

    -- Key coverage info (denormalized for quick access)
    has_active_coverage BOOLEAN,
    pcp_required BOOLEAN,
    pcp_name TEXT,
    pcp_npi TEXT,

    -- Deductibles and out-of-pocket
    individual_deductible DECIMAL(10,2),
    individual_deductible_met DECIMAL(10,2),
    family_deductible DECIMAL(10,2),
    family_deductible_met DECIMAL(10,2),
    individual_oop_max DECIMAL(10,2),
    individual_oop_met DECIMAL(10,2),
    family_oop_max DECIMAL(10,2),
    family_oop_met DECIMAL(10,2),

    -- Copays/coinsurance (for common services)
    office_visit_copay DECIMAL(10,2),
    specialist_copay DECIMAL(10,2),
    er_copay DECIMAL(10,2),
    inpatient_coinsurance INTEGER, -- Percentage

    -- Prior auth requirements
    prior_auth_required_services TEXT[], -- Service types requiring prior auth

    -- Benefit notes
    benefit_notes TEXT[],
    rejection_reasons TEXT[],

    -- Raw AAA segments (rejection codes)
    aaa_errors JSONB,

    -- Timing
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patient insurance records (verified)
CREATE TABLE IF NOT EXISTS patient_insurance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Payer info
    payer_connection_id UUID REFERENCES insurance_payer_connections(id) ON DELETE SET NULL,
    payer_id TEXT NOT NULL,
    payer_name TEXT NOT NULL,

    -- Subscriber info
    subscriber_id TEXT NOT NULL,
    group_number TEXT,
    group_name TEXT,

    -- Subscriber relationship
    subscriber_relationship TEXT NOT NULL CHECK (
        subscriber_relationship IN ('SELF', 'SPOUSE', 'CHILD', 'OTHER')
    ),
    subscriber_name TEXT,
    subscriber_dob DATE,

    -- Plan info
    plan_name TEXT,
    plan_type TEXT, -- HMO, PPO, EPO, POS, etc.

    -- Coverage dates
    effective_date DATE NOT NULL,
    termination_date DATE,

    -- Priority
    coverage_priority INTEGER NOT NULL DEFAULT 1, -- 1=Primary, 2=Secondary, etc.

    -- Verification
    last_verified_at TIMESTAMPTZ,
    last_verification_request_id UUID REFERENCES eligibility_requests(id),
    verification_status TEXT DEFAULT 'unverified' CHECK (
        verification_status IN ('unverified', 'verified', 'needs_review', 'inactive')
    ),

    -- Active status
    is_active BOOLEAN DEFAULT true,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    UNIQUE(patient_id, payer_id, subscriber_id, coverage_priority)
);

-- Indexes for insurance tables
CREATE INDEX idx_eligibility_requests_patient ON eligibility_requests(patient_id);
CREATE INDEX idx_eligibility_requests_status ON eligibility_requests(request_status);
CREATE INDEX idx_eligibility_requests_date ON eligibility_requests(requested_at DESC);
CREATE INDEX idx_patient_insurance_patient ON patient_insurance(patient_id);
CREATE INDEX idx_patient_insurance_active ON patient_insurance(patient_id, is_active) WHERE is_active = true;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE lab_provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_order_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE e_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE refill_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacs_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE imaging_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE imaging_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE imaging_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_payer_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_insurance ENABLE ROW LEVEL SECURITY;

-- Lab policies
CREATE POLICY lab_connections_tenant ON lab_provider_connections
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY lab_orders_tenant ON lab_orders
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY lab_tests_access ON lab_order_tests
    FOR ALL USING (
        order_id IN (SELECT id FROM lab_orders WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    );

CREATE POLICY lab_results_tenant ON lab_results
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Pharmacy policies
CREATE POLICY pharmacy_connections_tenant ON pharmacy_connections
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY prescriptions_tenant ON e_prescriptions
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY med_history_tenant ON medication_history
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY refill_requests_tenant ON refill_requests
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Imaging policies
CREATE POLICY pacs_connections_tenant ON pacs_connections
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY imaging_orders_tenant ON imaging_orders
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY imaging_studies_tenant ON imaging_studies
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY imaging_reports_tenant ON imaging_reports
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Insurance policies
CREATE POLICY insurance_payers_tenant ON insurance_payer_connections
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY eligibility_requests_tenant ON eligibility_requests
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY eligibility_responses_access ON eligibility_responses
    FOR ALL USING (
        request_id IN (SELECT id FROM eligibility_requests WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    );

CREATE POLICY patient_insurance_tenant ON patient_insurance
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get patient's active insurance
CREATE OR REPLACE FUNCTION get_patient_active_insurance(p_patient_id UUID)
RETURNS TABLE (
    insurance_id UUID,
    payer_name TEXT,
    subscriber_id TEXT,
    group_number TEXT,
    plan_name TEXT,
    coverage_priority INTEGER,
    last_verified_at TIMESTAMPTZ,
    verification_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.id,
        pi.payer_name,
        pi.subscriber_id,
        pi.group_number,
        pi.plan_name,
        pi.coverage_priority,
        pi.last_verified_at,
        pi.verification_status
    FROM patient_insurance pi
    WHERE pi.patient_id = p_patient_id
      AND pi.is_active = true
      AND (pi.termination_date IS NULL OR pi.termination_date >= CURRENT_DATE)
    ORDER BY pi.coverage_priority ASC;
END;
$$;

-- Get lab results for patient
CREATE OR REPLACE FUNCTION get_patient_lab_results(
    p_patient_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    result_id UUID,
    accession_number TEXT,
    report_type TEXT,
    report_status TEXT,
    reported_at TIMESTAMPTZ,
    has_critical_values BOOLEAN,
    performing_lab_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        lr.id,
        lr.accession_number,
        lr.report_type,
        lr.report_status,
        lr.reported_at,
        lr.has_critical_values,
        lr.performing_lab_name
    FROM lab_results lr
    WHERE lr.patient_id = p_patient_id
      AND (p_start_date IS NULL OR lr.reported_at >= p_start_date)
      AND (p_end_date IS NULL OR lr.reported_at <= p_end_date)
    ORDER BY lr.reported_at DESC
    LIMIT p_limit;
END;
$$;

-- Get imaging studies for patient
CREATE OR REPLACE FUNCTION get_patient_imaging_studies(
    p_patient_id UUID,
    p_modality TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    study_id UUID,
    study_instance_uid TEXT,
    study_date DATE,
    modalities TEXT[],
    study_description TEXT,
    has_report BOOLEAN,
    report_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ist.id,
        ist.study_instance_uid,
        ist.study_date,
        ist.modalities,
        ist.study_description,
        ist.has_report,
        ir.report_status
    FROM imaging_studies ist
    LEFT JOIN imaging_reports ir ON ir.study_id = ist.id
    WHERE ist.patient_id = p_patient_id
      AND (p_modality IS NULL OR p_modality = ANY(ist.modalities))
      AND (p_start_date IS NULL OR ist.study_date >= p_start_date)
      AND (p_end_date IS NULL OR ist.study_date <= p_end_date)
    ORDER BY ist.study_date DESC
    LIMIT p_limit;
END;
$$;

-- Get healthcare integration statistics
CREATE OR REPLACE FUNCTION get_healthcare_integration_stats(
    p_tenant_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT now() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
    lab_orders_total BIGINT,
    lab_results_received BIGINT,
    lab_critical_values BIGINT,
    prescriptions_sent BIGINT,
    refill_requests_pending BIGINT,
    imaging_studies_total BIGINT,
    imaging_reports_final BIGINT,
    eligibility_checks BIGINT,
    eligibility_verified BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM lab_orders WHERE tenant_id = p_tenant_id AND ordered_at BETWEEN p_start_date AND p_end_date)::BIGINT,
        (SELECT COUNT(*) FROM lab_results WHERE tenant_id = p_tenant_id AND reported_at BETWEEN p_start_date AND p_end_date)::BIGINT,
        (SELECT COUNT(*) FROM lab_results WHERE tenant_id = p_tenant_id AND has_critical_values = true AND reported_at BETWEEN p_start_date AND p_end_date)::BIGINT,
        (SELECT COUNT(*) FROM e_prescriptions WHERE tenant_id = p_tenant_id AND transmitted_at BETWEEN p_start_date AND p_end_date)::BIGINT,
        (SELECT COUNT(*) FROM refill_requests WHERE tenant_id = p_tenant_id AND request_status = 'pending')::BIGINT,
        (SELECT COUNT(*) FROM imaging_studies WHERE tenant_id = p_tenant_id AND received_at BETWEEN p_start_date AND p_end_date)::BIGINT,
        (SELECT COUNT(*) FROM imaging_reports WHERE tenant_id = p_tenant_id AND report_status = 'final' AND signed_at BETWEEN p_start_date AND p_end_date)::BIGINT,
        (SELECT COUNT(*) FROM eligibility_requests WHERE tenant_id = p_tenant_id AND requested_at BETWEEN p_start_date AND p_end_date)::BIGINT,
        (SELECT COUNT(*) FROM eligibility_responses WHERE tenant_id = p_tenant_id AND response_status = 'ACTIVE' AND received_at BETWEEN p_start_date AND p_end_date)::BIGINT;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_healthcare_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lab_orders_updated_at BEFORE UPDATE ON lab_orders FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
CREATE TRIGGER lab_results_updated_at BEFORE UPDATE ON lab_results FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
CREATE TRIGGER lab_connections_updated_at BEFORE UPDATE ON lab_provider_connections FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
CREATE TRIGGER pharmacy_connections_updated_at BEFORE UPDATE ON pharmacy_connections FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
CREATE TRIGGER prescriptions_updated_at BEFORE UPDATE ON e_prescriptions FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
CREATE TRIGGER refill_requests_updated_at BEFORE UPDATE ON refill_requests FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
CREATE TRIGGER pacs_connections_updated_at BEFORE UPDATE ON pacs_connections FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
CREATE TRIGGER imaging_orders_updated_at BEFORE UPDATE ON imaging_orders FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
CREATE TRIGGER imaging_studies_updated_at BEFORE UPDATE ON imaging_studies FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
CREATE TRIGGER imaging_reports_updated_at BEFORE UPDATE ON imaging_reports FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
CREATE TRIGGER insurance_payers_updated_at BEFORE UPDATE ON insurance_payer_connections FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
CREATE TRIGGER patient_insurance_updated_at BEFORE UPDATE ON patient_insurance FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE lab_provider_connections IS 'Connections to laboratory providers (LabCorp, Quest) via FHIR R4';
COMMENT ON TABLE lab_orders IS 'Lab test orders with tracking from submission to results';
COMMENT ON TABLE lab_results IS 'Lab result documents with critical value flagging';
COMMENT ON TABLE pharmacy_connections IS 'Pharmacy connections for e-prescribing via Surescripts/NCPDP';
COMMENT ON TABLE e_prescriptions IS 'Electronic prescriptions with controlled substance support';
COMMENT ON TABLE medication_history IS 'Medication history from pharmacy benefit managers';
COMMENT ON TABLE pacs_connections IS 'PACS/DICOM connections for radiology image retrieval';
COMMENT ON TABLE imaging_orders IS 'Radiology/imaging orders with scheduling and status';
COMMENT ON TABLE imaging_studies IS 'DICOM study metadata from PACS systems';
COMMENT ON TABLE imaging_reports IS 'Radiology reports with critical finding alerts';
COMMENT ON TABLE insurance_payer_connections IS 'Insurance payer connections for eligibility verification';
COMMENT ON TABLE eligibility_requests IS 'X12 270 eligibility verification requests';
COMMENT ON TABLE eligibility_responses IS 'X12 271 eligibility responses with benefit details';
COMMENT ON TABLE patient_insurance IS 'Verified patient insurance coverage records';
