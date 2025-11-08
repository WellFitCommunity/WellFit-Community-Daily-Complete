-- Add tenant_id to final critical tables
BEGIN;

-- These were missed in batch runs
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE consent_verification_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE fhir_care_plans ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE fhir_medication_requests ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE fhir_observations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE handoff_sections ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE phi_access_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE scribe_audit_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE staff_audit_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_tenant_id ON admin_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consent_verification_log_tenant_id ON consent_verification_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fhir_care_plans_tenant_id ON fhir_care_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fhir_medication_requests_tenant_id ON fhir_medication_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fhir_observations_tenant_id ON fhir_observations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_handoff_sections_tenant_id ON handoff_sections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phi_access_log_tenant_id ON phi_access_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scribe_audit_log_tenant_id ON scribe_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_audit_log_tenant_id ON staff_audit_log(tenant_id);

-- Backfill
DO $$
DECLARE default_tenant UUID;
BEGIN
  SELECT id INTO default_tenant FROM tenants WHERE subdomain = 'www' LIMIT 1;
  UPDATE admin_audit_logs SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE audit_logs SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE consent_verification_log SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE fhir_care_plans SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE fhir_medication_requests SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE fhir_observations SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE handoff_sections SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE phi_access_log SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE scribe_audit_log SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE staff_audit_log SET tenant_id = default_tenant WHERE tenant_id IS NULL;
END$$;

COMMIT;

-- NOTE: Remaining 28 tables are system/reference tables that don't need tenant_id:
-- _func_backup_search_path, _policy_*, _trigger_log, backup_verification_logs,
-- cache_statistics, code_cpt, code_hcpcs, code_icd10, code_modifiers,
-- consent_log, cpt_code_reference, drill_metrics_log, error_logs,
-- guardian_cron_log, parkinsons_medication_log, shift_handoff_override_log,
-- spatial_ref_sys, tenants, test_pt_table, vulnerability_remediation_log
