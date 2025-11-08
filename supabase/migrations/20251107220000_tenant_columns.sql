-- Add tenant_id columns - Phase 1
BEGIN;

ALTER TABLE profiles ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE check_ins ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE encounters ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE admin_users ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE affirmations ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE community_moments ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE handoff_packets ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE scribe_sessions ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE billing_workflows ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE physicians ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX idx_check_ins_tenant_id ON check_ins(tenant_id);
CREATE INDEX idx_encounters_tenant_id ON encounters(tenant_id);

COMMIT;
