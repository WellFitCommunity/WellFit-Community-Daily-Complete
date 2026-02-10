-- FHIR Bulk Data Access IG - Export Job Tracking
-- Implements async polling per HL7 FHIR Bulk Data Access IG
-- Reference: https://hl7.org/fhir/uv/bulkdata/

CREATE TABLE IF NOT EXISTS fhir_bulk_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'error', 'cancelled')),
  export_type TEXT NOT NULL CHECK (export_type IN ('system', 'patient', 'group')),
  resource_types TEXT[] NOT NULL DEFAULT '{}',
  since_date TIMESTAMPTZ,
  patient_id UUID,
  group_id TEXT,
  output_format TEXT NOT NULL DEFAULT 'application/fhir+ndjson',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  total_resources INTEGER NOT NULL DEFAULT 0,
  exported_resources INTEGER NOT NULL DEFAULT 0,
  output_files JSONB NOT NULL DEFAULT '[]',
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_bulk_export_tenant ON fhir_bulk_export_jobs(tenant_id, status);
CREATE INDEX idx_bulk_export_status ON fhir_bulk_export_jobs(status, requested_at);

-- RLS
ALTER TABLE fhir_bulk_export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own export jobs"
  ON fhir_bulk_export_jobs FOR SELECT
  USING (requested_by = auth.uid() OR tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create export jobs"
  ON fhir_bulk_export_jobs FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "System can update export jobs"
  ON fhir_bulk_export_jobs FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
