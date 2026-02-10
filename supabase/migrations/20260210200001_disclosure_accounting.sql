-- Accounting of Disclosures per 45 CFR 164.528
-- Tracks all PHI disclosures beyond treatment, payment, and healthcare operations

CREATE TABLE IF NOT EXISTS disclosure_accounting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES auth.users(id),
  disclosed_by UUID REFERENCES auth.users(id),
  disclosure_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_name TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN (
    'healthcare_provider', 'health_plan', 'public_health', 'law_enforcement',
    'research', 'judicial', 'organ_procurement', 'coroner', 'workers_comp',
    'government_program', 'abuse_report', 'other'
  )),
  purpose TEXT NOT NULL,
  phi_types_disclosed TEXT[] NOT NULL DEFAULT '{}',
  disclosure_method TEXT NOT NULL CHECK (disclosure_method IN (
    'electronic', 'fax', 'mail', 'verbal', 'in_person', 'portal'
  )),
  data_classes_disclosed TEXT[] NOT NULL DEFAULT '{}',
  legal_authority TEXT,
  patient_authorization_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_disclosure_patient ON disclosure_accounting(patient_id, disclosure_date DESC);
CREATE INDEX idx_disclosure_tenant ON disclosure_accounting(tenant_id);

-- RLS
ALTER TABLE disclosure_accounting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view disclosures"
  ON disclosure_accounting FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can insert disclosures"
  ON disclosure_accounting FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
