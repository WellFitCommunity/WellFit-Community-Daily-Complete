-- Minimum Necessary Field-Level Policies per 45 CFR 164.502(b)
-- Defines which fields each role can access per table
--
-- The "minimum necessary" standard requires covered entities to make
-- reasonable efforts to limit PHI access to the minimum necessary
-- to accomplish the intended purpose of the use, disclosure, or request.

CREATE TABLE IF NOT EXISTS minimum_necessary_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  table_name TEXT NOT NULL,
  role_name TEXT NOT NULL,
  allowed_fields TEXT[] NOT NULL DEFAULT '{}',
  denied_fields TEXT[] NOT NULL DEFAULT '{}',
  purpose TEXT NOT NULL CHECK (purpose IN (
    'treatment', 'payment', 'operations', 'research', 'public_health', 'audit'
  )),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, table_name, role_name, purpose)
);

-- Indexes
CREATE INDEX idx_min_necessary_lookup ON minimum_necessary_policies(tenant_id, table_name, role_name, is_active);

-- RLS
ALTER TABLE minimum_necessary_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage policies"
  ON minimum_necessary_policies FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- Seed default policies for common roles
INSERT INTO minimum_necessary_policies (tenant_id, table_name, role_name, allowed_fields, denied_fields, purpose) VALUES
-- Nurse accessing patients (treatment)
('2b902657-6a20-4435-a78a-576f397517ca', 'profiles', 'nurse',
  ARRAY['user_id','first_name','last_name','date_of_birth','gender','blood_type','emergency_contact_name','emergency_contact_phone','primary_physician'],
  ARRAY['ssn_last_four','financial_notes','billing_account_number'],
  'treatment'),
-- Billing staff accessing patients (payment)
('2b902657-6a20-4435-a78a-576f397517ca', 'profiles', 'billing_staff',
  ARRAY['user_id','first_name','last_name','date_of_birth','insurance_provider','insurance_id','billing_account_number'],
  ARRAY['blood_type','emergency_contact_name','emergency_contact_phone','primary_physician','medical_notes'],
  'payment'),
-- Admin accessing patients (operations)
('2b902657-6a20-4435-a78a-576f397517ca', 'profiles', 'admin',
  ARRAY['user_id','first_name','last_name','email','phone','date_of_birth','gender','tenant_id','created_at'],
  ARRAY['ssn_last_four'],
  'operations'),
-- Researcher accessing patients (research - de-identified)
('2b902657-6a20-4435-a78a-576f397517ca', 'profiles', 'researcher',
  ARRAY['gender','date_of_birth','blood_type'],
  ARRAY['user_id','first_name','last_name','email','phone','ssn_last_four','address','emergency_contact_name','emergency_contact_phone'],
  'research')
ON CONFLICT (tenant_id, table_name, role_name, purpose) DO NOTHING;
