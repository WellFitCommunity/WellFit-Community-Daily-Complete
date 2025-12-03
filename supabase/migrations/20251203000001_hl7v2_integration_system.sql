-- ============================================================================
-- HL7 v2.x Integration System
-- ============================================================================
-- This migration adds support for legacy HL7 v2.x message processing,
-- which is still used by 80%+ of hospital interfaces for:
-- - ADT (Admit/Discharge/Transfer) messages
-- - ORU (Observation Results/Lab Results) messages
-- - ORM (Order Messages)
--
-- This bridges legacy systems to our FHIR R4 infrastructure.
-- ============================================================================

-- ============================================================================
-- HL7 Connection Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS hl7_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Connection identification
    name TEXT NOT NULL,
    description TEXT,

    -- Connection details
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 2575, -- Standard HL7 MLLP port
    protocol TEXT NOT NULL DEFAULT 'MLLP' CHECK (protocol IN ('MLLP', 'HTTP', 'HTTPS')),

    -- HL7 header configuration
    sending_application TEXT NOT NULL,
    sending_facility TEXT NOT NULL,
    receiving_application TEXT NOT NULL,
    receiving_facility TEXT NOT NULL,

    -- Version and settings
    hl7_version TEXT NOT NULL DEFAULT '2.5.1' CHECK (
        hl7_version IN ('2.3', '2.3.1', '2.4', '2.5', '2.5.1', '2.6', '2.7', '2.8')
    ),

    -- Processing settings
    auto_ack BOOLEAN NOT NULL DEFAULT true,
    translate_to_fhir BOOLEAN NOT NULL DEFAULT true,
    store_raw_messages BOOLEAN NOT NULL DEFAULT true,

    -- Security (encrypted at rest)
    auth_type TEXT DEFAULT 'none' CHECK (auth_type IN ('none', 'basic', 'certificate', 'api_key')),
    auth_credentials JSONB, -- Encrypted credentials

    -- Status tracking
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_connected_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    last_error TEXT,
    connection_status TEXT DEFAULT 'disconnected' CHECK (
        connection_status IN ('connected', 'disconnected', 'error', 'testing')
    ),

    -- Statistics
    messages_received INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    -- Constraints
    UNIQUE(tenant_id, name)
);

-- Indexes for HL7 connections
CREATE INDEX idx_hl7_connections_tenant ON hl7_connections(tenant_id);
CREATE INDEX idx_hl7_connections_enabled ON hl7_connections(enabled) WHERE enabled = true;
CREATE INDEX idx_hl7_connections_status ON hl7_connections(connection_status);

-- ============================================================================
-- HL7 Message Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS hl7_message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES hl7_connections(id) ON DELETE SET NULL,

    -- Message identification
    message_control_id TEXT NOT NULL,

    -- Message type
    message_type TEXT NOT NULL, -- ADT, ORU, ORM, ACK, etc.
    event_type TEXT, -- A01, R01, O01, etc.
    message_structure TEXT, -- ADT_A01, ORU_R01, etc.

    -- Direction
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),

    -- Processing status
    status TEXT NOT NULL DEFAULT 'received' CHECK (
        status IN ('received', 'parsing', 'parsed', 'translating', 'translated',
                   'processing', 'processed', 'error', 'ack_sent', 'ack_received')
    ),

    -- Raw message (encrypted for PHI protection)
    raw_message BYTEA, -- Encrypted storage
    message_size INTEGER,

    -- Parsed metadata (no PHI)
    sending_application TEXT,
    sending_facility TEXT,
    receiving_application TEXT,
    receiving_facility TEXT,
    message_datetime TIMESTAMPTZ,
    hl7_version TEXT,

    -- Patient linkage (for audit, no PHI stored here)
    patient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    mrn_hash TEXT, -- Hashed MRN for lookup without storing PHI

    -- Translation results
    fhir_bundle_id TEXT,
    fhir_resources_created INTEGER DEFAULT 0,

    -- ACK tracking
    ack_code TEXT, -- AA, AE, AR
    ack_message_id TEXT,
    ack_sent_at TIMESTAMPTZ,

    -- Error tracking
    error_count INTEGER DEFAULT 0,
    errors JSONB, -- Array of error messages
    warnings JSONB, -- Array of warning messages

    -- Performance metrics
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    parsed_at TIMESTAMPTZ,
    translated_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for message log
CREATE INDEX idx_hl7_message_log_tenant ON hl7_message_log(tenant_id);
CREATE INDEX idx_hl7_message_log_connection ON hl7_message_log(connection_id);
CREATE INDEX idx_hl7_message_log_control_id ON hl7_message_log(message_control_id);
CREATE INDEX idx_hl7_message_log_type ON hl7_message_log(message_type, event_type);
CREATE INDEX idx_hl7_message_log_status ON hl7_message_log(status);
CREATE INDEX idx_hl7_message_log_patient ON hl7_message_log(patient_id);
CREATE INDEX idx_hl7_message_log_received ON hl7_message_log(received_at DESC);
CREATE INDEX idx_hl7_message_log_mrn_hash ON hl7_message_log(mrn_hash);

-- Partial index for unprocessed messages
CREATE INDEX idx_hl7_message_log_pending ON hl7_message_log(status, received_at)
    WHERE status NOT IN ('processed', 'error');

-- ============================================================================
-- HL7 Message Queue (for async processing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hl7_message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    message_log_id UUID NOT NULL REFERENCES hl7_message_log(id) ON DELETE CASCADE,

    -- Queue management
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,

    -- Scheduling
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ,
    locked_by TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')
    ),

    -- Result
    completed_at TIMESTAMPTZ,
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for message queue
CREATE INDEX idx_hl7_queue_pending ON hl7_message_queue(scheduled_at, priority DESC)
    WHERE status = 'pending' AND (locked_at IS NULL OR locked_at < now() - INTERVAL '5 minutes');
CREATE INDEX idx_hl7_queue_tenant ON hl7_message_queue(tenant_id);
CREATE INDEX idx_hl7_queue_status ON hl7_message_queue(status);

-- ============================================================================
-- HL7 to FHIR Mapping Rules (customizable per tenant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hl7_fhir_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Source HL7 field
    hl7_segment TEXT NOT NULL,
    hl7_field TEXT NOT NULL,
    hl7_component INTEGER,
    hl7_subcomponent INTEGER,

    -- Target FHIR resource
    fhir_resource_type TEXT NOT NULL,
    fhir_path TEXT NOT NULL,

    -- Transformation
    transformation_type TEXT NOT NULL DEFAULT 'direct' CHECK (
        transformation_type IN ('direct', 'lookup', 'function', 'constant', 'template')
    ),
    transformation_config JSONB,

    -- Conditions
    condition_expression TEXT,

    -- Active status
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    -- Unique constraint
    UNIQUE(tenant_id, hl7_segment, hl7_field, fhir_resource_type, fhir_path)
);

-- Index for mapping lookups
CREATE INDEX idx_hl7_fhir_mappings_lookup ON hl7_fhir_mappings(tenant_id, hl7_segment, enabled)
    WHERE enabled = true;

-- ============================================================================
-- HL7 Code Mapping (value set translations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hl7_code_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global mapping

    -- Source
    source_system TEXT NOT NULL, -- HL7 table ID (e.g., "0001" for sex)
    source_code TEXT NOT NULL,
    source_display TEXT,

    -- Target
    target_system TEXT NOT NULL, -- FHIR code system URL
    target_code TEXT NOT NULL,
    target_display TEXT,

    -- Metadata
    enabled BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unique constraint
    UNIQUE(tenant_id, source_system, source_code, target_system)
);

-- Index for code lookups
CREATE INDEX idx_hl7_code_mappings_lookup ON hl7_code_mappings(source_system, source_code)
    WHERE enabled = true;

-- ============================================================================
-- Insert Default Code Mappings
-- ============================================================================

-- Sex/Gender mappings (HL7 Table 0001)
INSERT INTO hl7_code_mappings (tenant_id, source_system, source_code, source_display, target_system, target_code, target_display) VALUES
(NULL, '0001', 'M', 'Male', 'http://hl7.org/fhir/administrative-gender', 'male', 'Male'),
(NULL, '0001', 'F', 'Female', 'http://hl7.org/fhir/administrative-gender', 'female', 'Female'),
(NULL, '0001', 'O', 'Other', 'http://hl7.org/fhir/administrative-gender', 'other', 'Other'),
(NULL, '0001', 'U', 'Unknown', 'http://hl7.org/fhir/administrative-gender', 'unknown', 'Unknown'),
(NULL, '0001', 'A', 'Ambiguous', 'http://hl7.org/fhir/administrative-gender', 'other', 'Other'),
(NULL, '0001', 'N', 'Not applicable', 'http://hl7.org/fhir/administrative-gender', 'unknown', 'Unknown')
ON CONFLICT DO NOTHING;

-- Marital Status mappings (HL7 Table 0002)
INSERT INTO hl7_code_mappings (tenant_id, source_system, source_code, source_display, target_system, target_code, target_display) VALUES
(NULL, '0002', 'A', 'Separated', 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', 'L', 'Legally Separated'),
(NULL, '0002', 'D', 'Divorced', 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', 'D', 'Divorced'),
(NULL, '0002', 'M', 'Married', 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', 'M', 'Married'),
(NULL, '0002', 'S', 'Single', 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', 'S', 'Never Married'),
(NULL, '0002', 'W', 'Widowed', 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', 'W', 'Widowed'),
(NULL, '0002', 'C', 'Common law', 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', 'T', 'Domestic Partner'),
(NULL, '0002', 'P', 'Domestic partner', 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', 'T', 'Domestic Partner'),
(NULL, '0002', 'U', 'Unknown', 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', 'UNK', 'Unknown')
ON CONFLICT DO NOTHING;

-- Patient Class mappings (HL7 Table 0004)
INSERT INTO hl7_code_mappings (tenant_id, source_system, source_code, source_display, target_system, target_code, target_display) VALUES
(NULL, '0004', 'E', 'Emergency', 'http://terminology.hl7.org/CodeSystem/v3-ActCode', 'EMER', 'emergency'),
(NULL, '0004', 'I', 'Inpatient', 'http://terminology.hl7.org/CodeSystem/v3-ActCode', 'IMP', 'inpatient'),
(NULL, '0004', 'O', 'Outpatient', 'http://terminology.hl7.org/CodeSystem/v3-ActCode', 'AMB', 'ambulatory'),
(NULL, '0004', 'P', 'Preadmit', 'http://terminology.hl7.org/CodeSystem/v3-ActCode', 'PRENC', 'pre-admission'),
(NULL, '0004', 'R', 'Recurring patient', 'http://terminology.hl7.org/CodeSystem/v3-ActCode', 'SS', 'short stay'),
(NULL, '0004', 'B', 'Obstetrics', 'http://terminology.hl7.org/CodeSystem/v3-ActCode', 'OBSENC', 'observation'),
(NULL, '0004', 'N', 'Not applicable', 'http://terminology.hl7.org/CodeSystem/v3-ActCode', 'VR', 'virtual')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE hl7_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl7_message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl7_message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl7_fhir_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl7_code_mappings ENABLE ROW LEVEL SECURITY;

-- Connection policies
CREATE POLICY hl7_connections_tenant_isolation ON hl7_connections
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_code IN (1, 2))
    );

-- Message log policies
CREATE POLICY hl7_message_log_tenant_isolation ON hl7_message_log
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_code IN (1, 2))
    );

-- Queue policies
CREATE POLICY hl7_queue_tenant_isolation ON hl7_message_queue
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_code IN (1, 2))
    );

-- Mapping policies (include global mappings)
CREATE POLICY hl7_fhir_mappings_access ON hl7_fhir_mappings
    FOR ALL USING (
        tenant_id IS NULL
        OR tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_code IN (1, 2))
    );

CREATE POLICY hl7_code_mappings_access ON hl7_code_mappings
    FOR ALL USING (
        tenant_id IS NULL
        OR tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_code IN (1, 2))
    );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to log incoming HL7 message
CREATE OR REPLACE FUNCTION log_hl7_message(
    p_tenant_id UUID,
    p_connection_id UUID,
    p_message_control_id TEXT,
    p_message_type TEXT,
    p_event_type TEXT,
    p_direction TEXT,
    p_raw_message BYTEA DEFAULT NULL,
    p_sending_app TEXT DEFAULT NULL,
    p_sending_facility TEXT DEFAULT NULL,
    p_receiving_app TEXT DEFAULT NULL,
    p_receiving_facility TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO hl7_message_log (
        tenant_id,
        connection_id,
        message_control_id,
        message_type,
        event_type,
        direction,
        raw_message,
        message_size,
        sending_application,
        sending_facility,
        receiving_application,
        receiving_facility,
        status
    ) VALUES (
        p_tenant_id,
        p_connection_id,
        p_message_control_id,
        p_message_type,
        p_event_type,
        p_direction,
        p_raw_message,
        COALESCE(length(p_raw_message), 0),
        p_sending_app,
        p_sending_facility,
        p_receiving_app,
        p_receiving_facility,
        'received'
    )
    RETURNING id INTO v_log_id;

    -- Update connection stats
    IF p_connection_id IS NOT NULL THEN
        UPDATE hl7_connections
        SET
            last_message_at = now(),
            messages_received = messages_received + CASE WHEN p_direction = 'inbound' THEN 1 ELSE 0 END,
            messages_sent = messages_sent + CASE WHEN p_direction = 'outbound' THEN 1 ELSE 0 END,
            updated_at = now()
        WHERE id = p_connection_id;
    END IF;

    RETURN v_log_id;
END;
$$;

-- Function to update message status
CREATE OR REPLACE FUNCTION update_hl7_message_status(
    p_log_id UUID,
    p_status TEXT,
    p_errors JSONB DEFAULT NULL,
    p_warnings JSONB DEFAULT NULL,
    p_fhir_bundle_id TEXT DEFAULT NULL,
    p_fhir_resources_created INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_connection_id UUID;
BEGIN
    -- Get connection ID for stats update
    SELECT connection_id INTO v_connection_id FROM hl7_message_log WHERE id = p_log_id;

    -- Update message log
    UPDATE hl7_message_log
    SET
        status = p_status,
        errors = COALESCE(p_errors, errors),
        warnings = COALESCE(p_warnings, warnings),
        error_count = CASE WHEN p_errors IS NOT NULL THEN jsonb_array_length(p_errors) ELSE error_count END,
        fhir_bundle_id = COALESCE(p_fhir_bundle_id, fhir_bundle_id),
        fhir_resources_created = COALESCE(p_fhir_resources_created, fhir_resources_created),
        parsed_at = CASE WHEN p_status = 'parsed' THEN now() ELSE parsed_at END,
        translated_at = CASE WHEN p_status = 'translated' THEN now() ELSE translated_at END,
        processed_at = CASE WHEN p_status IN ('processed', 'error') THEN now() ELSE processed_at END,
        processing_duration_ms = CASE
            WHEN p_status IN ('processed', 'error')
            THEN EXTRACT(EPOCH FROM (now() - received_at)) * 1000
            ELSE processing_duration_ms
        END
    WHERE id = p_log_id;

    -- Update connection error stats if failed
    IF p_status = 'error' AND v_connection_id IS NOT NULL THEN
        UPDATE hl7_connections
        SET
            messages_failed = messages_failed + 1,
            last_error = (p_errors->0->>'message')::TEXT,
            updated_at = now()
        WHERE id = v_connection_id;
    END IF;
END;
$$;

-- Function to get pending messages for processing
CREATE OR REPLACE FUNCTION get_pending_hl7_messages(
    p_tenant_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    message_log_id UUID,
    priority INTEGER,
    attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    UPDATE hl7_message_queue q
    SET
        locked_at = now(),
        locked_by = gen_random_uuid()::TEXT,
        status = 'processing',
        updated_at = now()
    WHERE q.id IN (
        SELECT q2.id
        FROM hl7_message_queue q2
        WHERE q2.tenant_id = p_tenant_id
          AND q2.status = 'pending'
          AND q2.scheduled_at <= now()
          AND (q2.locked_at IS NULL OR q2.locked_at < now() - INTERVAL '5 minutes')
        ORDER BY q2.priority DESC, q2.scheduled_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING q.id, q.message_log_id, q.priority, q.attempts;
END;
$$;

-- Function to get HL7 integration stats
CREATE OR REPLACE FUNCTION get_hl7_integration_stats(
    p_tenant_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT now() - INTERVAL '7 days',
    p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
    total_messages BIGINT,
    messages_received BIGINT,
    messages_sent BIGINT,
    messages_processed BIGINT,
    messages_failed BIGINT,
    avg_processing_time_ms NUMERIC,
    messages_by_type JSONB,
    messages_by_status JSONB,
    fhir_resources_created BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_messages,
        COUNT(*) FILTER (WHERE direction = 'inbound')::BIGINT as messages_received,
        COUNT(*) FILTER (WHERE direction = 'outbound')::BIGINT as messages_sent,
        COUNT(*) FILTER (WHERE status = 'processed')::BIGINT as messages_processed,
        COUNT(*) FILTER (WHERE status = 'error')::BIGINT as messages_failed,
        AVG(processing_duration_ms)::NUMERIC as avg_processing_time_ms,
        jsonb_object_agg(COALESCE(message_type, 'UNKNOWN'), type_count) as messages_by_type,
        jsonb_object_agg(status, status_count) as messages_by_status,
        SUM(COALESCE(fhir_resources_created, 0))::BIGINT as fhir_resources_created
    FROM (
        SELECT
            direction, status, message_type, processing_duration_ms, fhir_resources_created,
            COUNT(*) OVER (PARTITION BY message_type) as type_count,
            COUNT(*) OVER (PARTITION BY status) as status_count
        FROM hl7_message_log
        WHERE tenant_id = p_tenant_id
          AND received_at BETWEEN p_start_date AND p_end_date
    ) sub
    GROUP BY ();
END;
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_hl7_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hl7_connections_updated_at
    BEFORE UPDATE ON hl7_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_hl7_updated_at();

CREATE TRIGGER hl7_queue_updated_at
    BEFORE UPDATE ON hl7_message_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_hl7_updated_at();

CREATE TRIGGER hl7_fhir_mappings_updated_at
    BEFORE UPDATE ON hl7_fhir_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_hl7_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE hl7_connections IS 'HL7 v2.x interface connections for receiving ADT, ORU, ORM messages from legacy hospital systems';
COMMENT ON TABLE hl7_message_log IS 'Audit log of all HL7 v2.x messages received and sent, with encrypted raw message storage';
COMMENT ON TABLE hl7_message_queue IS 'Queue for async processing of HL7 messages with retry support';
COMMENT ON TABLE hl7_fhir_mappings IS 'Custom HL7 to FHIR field mapping rules per tenant';
COMMENT ON TABLE hl7_code_mappings IS 'Value set translations from HL7 tables to FHIR code systems';

COMMENT ON FUNCTION log_hl7_message IS 'Logs an incoming or outgoing HL7 message with automatic connection stats update';
COMMENT ON FUNCTION update_hl7_message_status IS 'Updates the processing status of an HL7 message with timing metrics';
COMMENT ON FUNCTION get_pending_hl7_messages IS 'Gets and locks pending messages for processing (for worker processes)';
COMMENT ON FUNCTION get_hl7_integration_stats IS 'Returns HL7 integration statistics for a tenant within a date range';
