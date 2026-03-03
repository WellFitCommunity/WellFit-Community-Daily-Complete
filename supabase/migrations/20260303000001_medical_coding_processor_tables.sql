-- ============================================================
-- Migration: Medical Coding Processor — Chain 6 Foundation
-- Creates: payer_rules, daily_charge_snapshots, drg_grouping_results
-- Seeds: Medicare FY2026 DRG baseline + TX Medicaid per diem tiers
-- Registers: AI skills for DRG grouper + medical coding processor
-- ============================================================

-- ============================================================
-- Table 1: payer_rules
-- Stores payer-specific reimbursement rules by type/state/FY
-- Supports DRG-based (Medicare), per diem (Medicaid), and others
-- ============================================================
CREATE TABLE IF NOT EXISTS payer_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  payer_type TEXT NOT NULL CHECK (payer_type IN (
    'medicare', 'medicaid', 'commercial', 'tricare', 'workers_comp'
  )),
  state_code TEXT,                    -- NULL for federal (Medicare); 2-letter for state (Medicaid)
  fiscal_year INTEGER NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'drg_based', 'per_diem', 'case_rate', 'percent_of_charges', 'fee_schedule'
  )),
  acuity_tier TEXT,                   -- Per diem: icu, step_down, med_surg, rehab, psych, snf, ltac

  -- DRG-based fields (Medicare IPPS)
  base_rate_amount NUMERIC(12,2),     -- Federal operating base rate
  capital_rate_amount NUMERIC(12,2),  -- Capital base rate
  wage_index_factor NUMERIC(8,6) DEFAULT 1.000000,
  cost_of_living_adjustment NUMERIC(8,6) DEFAULT 1.000000,

  -- Per diem fields (Medicaid / Commercial)
  per_diem_rate NUMERIC(12,2),
  allowable_percentage NUMERIC(5,2),  -- e.g., 75.00 for 75%
  max_days INTEGER,                   -- Spell-of-illness limit
  outlier_threshold NUMERIC(12,2),    -- High-cost outlier threshold

  -- Complex fields (JSONB)
  revenue_codes JSONB DEFAULT '[]'::jsonb,
  cos_criteria JSONB DEFAULT '{}'::jsonb,       -- Conditions of service
  carve_out_codes JSONB DEFAULT '[]'::jsonb,    -- Codes billed separately from per diem
  drg_adjustments JSONB DEFAULT '{}'::jsonb,    -- DRG-specific rate adjustments

  -- Metadata
  rule_description TEXT,
  source_reference TEXT,              -- e.g., "CMS IPPS Final Rule FY2026"
  is_active BOOLEAN DEFAULT true,
  effective_date DATE NOT NULL,
  expiration_date DATE,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE NULLS NOT DISTINCT (tenant_id, payer_type, state_code, fiscal_year, rule_type, acuity_tier)
);

COMMENT ON TABLE payer_rules IS 'Payer-specific reimbursement rules: DRG rates, per diem tiers, carve-outs. Tenant-scoped.';

-- ============================================================
-- Table 2: daily_charge_snapshots
-- Per-day encounter ledger aggregating all billable activity
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_charge_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL,
  encounter_id UUID NOT NULL,
  admit_date DATE NOT NULL,
  service_date DATE NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number >= 1),

  -- Aggregated charges by category
  charges JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Expected shape: { lab: [...], imaging: [...], pharmacy: [...],
  --   nursing: [...], procedure: [...], evaluation: [...], other: [...] }
  total_charge_amount NUMERIC(12,2) DEFAULT 0,
  charge_count INTEGER DEFAULT 0,

  -- DRG projection (updated by run_drg_grouper)
  projected_drg_code TEXT,
  projected_drg_weight NUMERIC(8,4),
  projected_reimbursement NUMERIC(12,2),

  -- Revenue codes assigned
  revenue_codes JSONB DEFAULT '[]'::jsonb,

  -- AI optimization results
  optimization_suggestions JSONB DEFAULT '[]'::jsonb,
  missing_charge_alerts JSONB DEFAULT '[]'::jsonb,
  documentation_gaps JSONB DEFAULT '[]'::jsonb,

  -- Workflow status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'reviewed', 'finalized', 'billed'
  )),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES auth.users(id),
  finalized_at TIMESTAMPTZ,

  -- AI audit trail
  ai_skill_key TEXT DEFAULT 'medical_coding_processor',
  ai_model_used TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (tenant_id, encounter_id, service_date)
);

COMMENT ON TABLE daily_charge_snapshots IS 'Per-day encounter ledger: aggregated charges, DRG projection, optimization suggestions. Tenant-scoped.';

-- ============================================================
-- Table 3: drg_grouping_results
-- AI-powered MS-DRG assignment with multi-pass analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS drg_grouping_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL,
  encounter_id UUID NOT NULL,

  -- Input ICD-10 codes
  principal_diagnosis_code TEXT NOT NULL,
  secondary_diagnosis_codes TEXT[] DEFAULT '{}',
  procedure_codes TEXT[] DEFAULT '{}',

  -- Primary DRG result
  drg_code TEXT NOT NULL,
  drg_description TEXT,
  drg_weight NUMERIC(8,4) NOT NULL,
  drg_type TEXT NOT NULL CHECK (drg_type IN ('ms_drg', 'ap_drg', 'apr_drg')),
  mdc_code TEXT,                      -- Major Diagnostic Category
  mdc_description TEXT,

  -- CC/MCC analysis
  has_cc BOOLEAN DEFAULT false,
  has_mcc BOOLEAN DEFAULT false,
  cc_codes TEXT[] DEFAULT '{}',
  mcc_codes TEXT[] DEFAULT '{}',

  -- Multi-pass comparison (base vs +CC vs +MCC)
  base_drg_code TEXT,
  base_drg_weight NUMERIC(8,4),
  cc_drg_code TEXT,
  cc_drg_weight NUMERIC(8,4),
  mcc_drg_code TEXT,
  mcc_drg_weight NUMERIC(8,4),
  optimal_drg_code TEXT,              -- Highest valid DRG from 3 passes

  -- Revenue calculation
  estimated_reimbursement NUMERIC(12,2),
  base_rate_used NUMERIC(12,2),

  -- AI provenance
  grouper_version TEXT NOT NULL,      -- e.g., "MS-DRG v43"
  ai_skill_key TEXT DEFAULT 'drg_grouper',
  ai_model_used TEXT,
  ai_confidence NUMERIC(5,4),        -- 0.0000–1.0000
  ai_reasoning TEXT,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'preliminary' CHECK (status IN (
    'preliminary', 'confirmed', 'appealed', 'final'
  )),
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (tenant_id, encounter_id, grouper_version)
);

COMMENT ON TABLE drg_grouping_results IS 'AI-powered DRG assignment: 3-pass analysis (base, +CC, +MCC), confidence scoring. Tenant-scoped.';

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE payer_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_charge_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE drg_grouping_results ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (standard for edge functions)

-- payer_rules: readable by all authenticated users in tenant, writable by admins
CREATE POLICY "payer_rules_tenant_read" ON payer_rules
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "payer_rules_admin_insert" ON payer_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'billing_admin')
    )
  );

CREATE POLICY "payer_rules_admin_update" ON payer_rules
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'billing_admin')
    )
  );

-- daily_charge_snapshots: admin/billing access within tenant
CREATE POLICY "daily_charge_snapshots_tenant_read" ON daily_charge_snapshots
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'billing_admin', 'provider', 'nurse')
    )
  );

CREATE POLICY "daily_charge_snapshots_admin_write" ON daily_charge_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'billing_admin')
    )
  );

CREATE POLICY "daily_charge_snapshots_admin_update" ON daily_charge_snapshots
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'billing_admin')
    )
  );

-- drg_grouping_results: clinical/billing read, admin write
CREATE POLICY "drg_grouping_results_tenant_read" ON drg_grouping_results
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'billing_admin', 'provider', 'nurse')
    )
  );

CREATE POLICY "drg_grouping_results_admin_write" ON drg_grouping_results
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'billing_admin')
    )
  );

CREATE POLICY "drg_grouping_results_admin_update" ON drg_grouping_results
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'billing_admin')
    )
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_payer_rules_lookup
  ON payer_rules (tenant_id, payer_type, fiscal_year, is_active);
CREATE INDEX idx_payer_rules_state
  ON payer_rules (tenant_id, state_code, payer_type) WHERE state_code IS NOT NULL;

CREATE INDEX idx_daily_charge_snapshots_encounter
  ON daily_charge_snapshots (tenant_id, encounter_id, service_date);
CREATE INDEX idx_daily_charge_snapshots_patient
  ON daily_charge_snapshots (tenant_id, patient_id, service_date);
CREATE INDEX idx_daily_charge_snapshots_status
  ON daily_charge_snapshots (tenant_id, status) WHERE status != 'billed';

CREATE INDEX idx_drg_grouping_encounter
  ON drg_grouping_results (tenant_id, encounter_id);
CREATE INDEX idx_drg_grouping_drg_code
  ON drg_grouping_results (tenant_id, drg_code);

-- ============================================================
-- Updated-at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payer_rules_updated_at
  BEFORE UPDATE ON payer_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER daily_charge_snapshots_updated_at
  BEFORE UPDATE ON daily_charge_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER drg_grouping_results_updated_at
  BEFORE UPDATE ON drg_grouping_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Seed Data: Medicare FY2026 IPPS Baseline
-- Test tenant: WF-0001 (2b902657-6a20-4435-a78a-576f397517ca)
-- ============================================================
INSERT INTO payer_rules (
  tenant_id, payer_type, fiscal_year, rule_type,
  base_rate_amount, capital_rate_amount, wage_index_factor,
  rule_description, source_reference, effective_date, expiration_date
) VALUES (
  '2b902657-6a20-4435-a78a-576f397517ca',
  'medicare', 2026, 'drg_based',
  6397.11, 488.23, 1.000000,
  'Medicare IPPS FY2026 federal base rate (2.6% increase). Wage index 1.0 = national average; adjust per CBSA.',
  'CMS IPPS Final Rule FY2026 (84 FR)',
  '2025-10-01', '2026-09-30'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed Data: TX Medicaid Per Diem Tiers (FY2026)
-- ============================================================
INSERT INTO payer_rules (
  tenant_id, payer_type, state_code, fiscal_year, rule_type, acuity_tier,
  per_diem_rate, allowable_percentage, max_days,
  carve_out_codes, rule_description, source_reference, effective_date
) VALUES
  -- ICU
  ('2b902657-6a20-4435-a78a-576f397517ca',
   'medicaid', 'TX', 2026, 'per_diem', 'icu',
   3200.00, 75.00, 365,
   '["J0585","J9271","J9035"]'::jsonb,
   'TX Medicaid ICU per diem. Biologics and chemo agents carved out (billed separately).',
   'TX HHSC IPPS Rate Schedule FY2026', '2025-09-01'),
  -- Step-down
  ('2b902657-6a20-4435-a78a-576f397517ca',
   'medicaid', 'TX', 2026, 'per_diem', 'step_down',
   2400.00, 75.00, 365,
   '[]'::jsonb,
   'TX Medicaid step-down per diem.',
   'TX HHSC IPPS Rate Schedule FY2026', '2025-09-01'),
  -- Med/Surg
  ('2b902657-6a20-4435-a78a-576f397517ca',
   'medicaid', 'TX', 2026, 'per_diem', 'med_surg',
   1500.00, 75.00, 365,
   '[]'::jsonb,
   'TX Medicaid med/surg per diem. Urban facilities at 75% allowable.',
   'TX HHSC IPPS Rate Schedule FY2026', '2025-09-01'),
  -- Med/Surg Rural (100% allowable)
  ('2b902657-6a20-4435-a78a-576f397517ca',
   'medicaid', 'TX', 2026, 'per_diem', 'med_surg',
   1500.00, 100.00, 365,
   '[]'::jsonb,
   'TX Medicaid med/surg per diem — RURAL designation (100% allowable).',
   'TX HHSC IPPS Rate Schedule FY2026', '2025-09-01'),
  -- Rehab
  ('2b902657-6a20-4435-a78a-576f397517ca',
   'medicaid', 'TX', 2026, 'per_diem', 'rehab',
   1200.00, 75.00, 60,
   '[]'::jsonb,
   'TX Medicaid rehab per diem. 60-day spell-of-illness limit.',
   'TX HHSC IPPS Rate Schedule FY2026', '2025-09-01'),
  -- Psych
  ('2b902657-6a20-4435-a78a-576f397517ca',
   'medicaid', 'TX', 2026, 'per_diem', 'psych',
   750.00, 75.00, 180,
   '[]'::jsonb,
   'TX Medicaid psych per diem. 180-day limit.',
   'TX HHSC IPPS Rate Schedule FY2026', '2025-09-01'),
  -- SNF
  ('2b902657-6a20-4435-a78a-576f397517ca',
   'medicaid', 'TX', 2026, 'per_diem', 'snf',
   400.00, 100.00, 100,
   '[]'::jsonb,
   'TX Medicaid SNF per diem. 100-day Medicare crossover limit.',
   'TX HHSC IPPS Rate Schedule FY2026', '2025-09-01')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Register AI Skills
-- ============================================================
INSERT INTO ai_skills (skill_key, skill_number, name, category, description, model, is_active)
VALUES
  ('medical_coding_processor', 63, 'Medical Coding Processor',
   'billing',
   'Aggregates daily billable activity, validates charge completeness, and suggests missing codes for inpatient encounters. Advisory only — never auto-files charges.',
   'claude-sonnet-4-5-20250929', true),
  ('drg_grouper', 64, 'DRG Grouper',
   'billing',
   'AI-powered MS-DRG assignment: extracts ICD-10 codes from clinical documentation, runs 3-pass analysis (base, +CC, +MCC), selects highest valid DRG with confidence scoring.',
   'claude-sonnet-4-5-20250929', true)
ON CONFLICT (skill_key) DO NOTHING;
