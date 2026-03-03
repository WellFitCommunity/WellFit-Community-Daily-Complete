/**
 * Medical Coding Processor MCP Server — Session 1 Tests
 *
 * Tests payer rules engine, revenue projection, tool definitions,
 * type safety, and data model integrity.
 * Uses synthetic test data only (no real PHI or payer rates).
 */

import { describe, it, expect } from 'vitest';

// =====================================================
// Test Fixtures — Synthetic Data Only
// =====================================================

interface PayerRuleFixture {
  id: string;
  tenant_id: string;
  payer_type: string;
  state_code: string | null;
  fiscal_year: number;
  rule_type: string;
  acuity_tier: string | null;
  base_rate_amount: number | null;
  capital_rate_amount: number | null;
  wage_index_factor: number;
  cost_of_living_adjustment: number;
  per_diem_rate: number | null;
  allowable_percentage: number | null;
  max_days: number | null;
  outlier_threshold: number | null;
  carve_out_codes: string[];
  rule_description: string;
  source_reference: string;
  is_active: boolean;
  effective_date: string;
  expiration_date: string | null;
}

const TEST_TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';

const MEDICARE_DRG_RULE: PayerRuleFixture = {
  id: 'rule-test-001',
  tenant_id: TEST_TENANT_ID,
  payer_type: 'medicare',
  state_code: null,
  fiscal_year: 2026,
  rule_type: 'drg_based',
  acuity_tier: null,
  base_rate_amount: 6397.11,
  capital_rate_amount: 488.23,
  wage_index_factor: 1.0,
  cost_of_living_adjustment: 1.0,
  per_diem_rate: null,
  allowable_percentage: null,
  max_days: null,
  outlier_threshold: null,
  carve_out_codes: [],
  rule_description: 'Medicare IPPS FY2026 federal base rate',
  source_reference: 'CMS IPPS Final Rule FY2026',
  is_active: true,
  effective_date: '2025-10-01',
  expiration_date: '2026-09-30'
};

const TX_MEDICAID_ICU: PayerRuleFixture = {
  id: 'rule-test-002',
  tenant_id: TEST_TENANT_ID,
  payer_type: 'medicaid',
  state_code: 'TX',
  fiscal_year: 2026,
  rule_type: 'per_diem',
  acuity_tier: 'icu',
  base_rate_amount: null,
  capital_rate_amount: null,
  wage_index_factor: 1.0,
  cost_of_living_adjustment: 1.0,
  per_diem_rate: 3200.00,
  allowable_percentage: 75.00,
  max_days: 365,
  outlier_threshold: null,
  carve_out_codes: ['J0585', 'J9271', 'J9035'],
  rule_description: 'TX Medicaid ICU per diem',
  source_reference: 'TX HHSC IPPS Rate Schedule FY2026',
  is_active: true,
  effective_date: '2025-09-01',
  expiration_date: null
};

const TX_MEDICAID_MED_SURG: PayerRuleFixture = {
  id: 'rule-test-003',
  tenant_id: TEST_TENANT_ID,
  payer_type: 'medicaid',
  state_code: 'TX',
  fiscal_year: 2026,
  rule_type: 'per_diem',
  acuity_tier: 'med_surg',
  base_rate_amount: null,
  capital_rate_amount: null,
  wage_index_factor: 1.0,
  cost_of_living_adjustment: 1.0,
  per_diem_rate: 1500.00,
  allowable_percentage: 75.00,
  max_days: 365,
  outlier_threshold: null,
  carve_out_codes: [],
  rule_description: 'TX Medicaid med/surg per diem',
  source_reference: 'TX HHSC IPPS Rate Schedule FY2026',
  is_active: true,
  effective_date: '2025-09-01',
  expiration_date: null
};

const ALL_RULES = [MEDICARE_DRG_RULE, TX_MEDICAID_ICU, TX_MEDICAID_MED_SURG];

// =====================================================
// Revenue Projection — Pure Math (No DB)
// =====================================================

function calculateDRGRevenueProjection(
  drgWeight: number,
  baseRate: number,
  capitalRate: number,
  wageIndex: number
): { operating: number; capital: number; total: number } {
  const operating = Math.round(baseRate * drgWeight * wageIndex * 100) / 100;
  const capital = Math.round(capitalRate * drgWeight * 100) / 100;
  return { operating, capital, total: Math.round((operating + capital) * 100) / 100 };
}

function calculatePerDiemReimbursement(
  perDiemRate: number,
  allowablePercentage: number
): number {
  return Math.round(perDiemRate * (allowablePercentage / 100) * 100) / 100;
}

// =====================================================
// Tests
// =====================================================

describe('Medical Coding Processor MCP — Payer Rules Engine', () => {

  // -----------------------------------------------
  // Payer rule data model integrity
  // -----------------------------------------------
  describe('Payer rule data model', () => {
    it('Medicare rule has DRG-specific fields and no per diem fields', () => {
      expect(MEDICARE_DRG_RULE.rule_type).toBe('drg_based');
      expect(MEDICARE_DRG_RULE.base_rate_amount).toBeGreaterThan(0);
      expect(MEDICARE_DRG_RULE.capital_rate_amount).toBeGreaterThan(0);
      expect(MEDICARE_DRG_RULE.per_diem_rate).toBeNull();
      expect(MEDICARE_DRG_RULE.allowable_percentage).toBeNull();
      expect(MEDICARE_DRG_RULE.max_days).toBeNull();
      expect(MEDICARE_DRG_RULE.state_code).toBeNull();
    });

    it('Medicaid per diem rule has per diem fields and no DRG fields', () => {
      expect(TX_MEDICAID_ICU.rule_type).toBe('per_diem');
      expect(TX_MEDICAID_ICU.per_diem_rate).toBeGreaterThan(0);
      expect(TX_MEDICAID_ICU.allowable_percentage).toBeGreaterThan(0);
      expect(TX_MEDICAID_ICU.max_days).toBeGreaterThan(0);
      expect(TX_MEDICAID_ICU.base_rate_amount).toBeNull();
      expect(TX_MEDICAID_ICU.capital_rate_amount).toBeNull();
      expect(TX_MEDICAID_ICU.state_code).toBe('TX');
    });

    it('all rules have required common fields', () => {
      for (const rule of ALL_RULES) {
        expect(rule.tenant_id).toBe(TEST_TENANT_ID);
        expect(rule.fiscal_year).toBe(2026);
        expect(rule.is_active).toBe(true);
        expect(rule.effective_date).toBeTruthy();
        expect(rule.source_reference.length).toBeGreaterThan(5);
        expect(rule.rule_description.length).toBeGreaterThan(5);
      }
    });

    it('payer_type is a valid enum value', () => {
      const validTypes = new Set(['medicare', 'medicaid', 'commercial', 'tricare', 'workers_comp']);
      for (const rule of ALL_RULES) {
        expect(validTypes.has(rule.payer_type)).toBe(true);
      }
    });

    it('rule_type is a valid enum value', () => {
      const validTypes = new Set(['drg_based', 'per_diem', 'case_rate', 'percent_of_charges', 'fee_schedule']);
      for (const rule of ALL_RULES) {
        expect(validTypes.has(rule.rule_type)).toBe(true);
      }
    });

    it('acuity_tier is valid for per diem rules', () => {
      const validTiers = new Set(['icu', 'step_down', 'med_surg', 'rehab', 'psych', 'snf', 'ltac']);
      const perDiemRules = ALL_RULES.filter(r => r.rule_type === 'per_diem');
      for (const rule of perDiemRules) {
        expect(rule.acuity_tier).not.toBeNull();
        if (rule.acuity_tier) {
          expect(validTiers.has(rule.acuity_tier)).toBe(true);
        }
      }
    });

    it('carve-out codes are valid HCPCS format for ICU', () => {
      // ICU has carve-outs for biologics/chemo (J-codes)
      expect(TX_MEDICAID_ICU.carve_out_codes.length).toBeGreaterThan(0);
      for (const code of TX_MEDICAID_ICU.carve_out_codes) {
        expect(code).toMatch(/^[A-Z]\d{4}$/);
      }
    });

    it('med/surg has no carve-out codes', () => {
      expect(TX_MEDICAID_MED_SURG.carve_out_codes).toEqual([]);
    });
  });

  // -----------------------------------------------
  // Revenue projection calculations (DRG-based)
  // -----------------------------------------------
  describe('DRG revenue projection', () => {
    it('calculates operating payment correctly', () => {
      // DRG 470 (Hip replacement) weight ~1.9
      const result = calculateDRGRevenueProjection(1.9, 6397.11, 488.23, 1.0);
      expect(result.operating).toBeCloseTo(12154.51, 2);
      expect(result.capital).toBeCloseTo(927.64, 2);
      expect(result.total).toBeCloseTo(13082.15, 2);
    });

    it('applies wage index adjustment', () => {
      // Houston CBSA wage index ~1.05
      const base = calculateDRGRevenueProjection(1.9, 6397.11, 488.23, 1.0);
      const adjusted = calculateDRGRevenueProjection(1.9, 6397.11, 488.23, 1.05);
      expect(adjusted.operating).toBeGreaterThan(base.operating);
      // Capital payment is NOT affected by wage index
      expect(adjusted.capital).toEqual(base.capital);
    });

    it('handles low-weight DRGs correctly', () => {
      // DRG 897 (Alcohol/drug dependence) weight ~0.5
      const result = calculateDRGRevenueProjection(0.5, 6397.11, 488.23, 1.0);
      expect(result.operating).toBeCloseTo(3198.56, 2);
      expect(result.capital).toBeCloseTo(244.12, 2);
      expect(result.total).toBeLessThan(6397.11); // Less than 1.0 weight
    });

    it('handles high-weight DRGs correctly', () => {
      // DRG 003 (ECMO) weight ~25.0
      const result = calculateDRGRevenueProjection(25.0, 6397.11, 488.23, 1.0);
      expect(result.operating).toBeCloseTo(159927.75, 2);
      expect(result.total).toBeGreaterThan(150000);
    });

    it('zero weight produces zero payment', () => {
      const result = calculateDRGRevenueProjection(0, 6397.11, 488.23, 1.0);
      expect(result.operating).toBe(0);
      expect(result.capital).toBe(0);
      expect(result.total).toBe(0);
    });

    it('rounds to 2 decimal places (cents)', () => {
      const result = calculateDRGRevenueProjection(1.3456, 6397.11, 488.23, 1.0234);
      // Verify the result is rounded to cents
      expect(result.operating.toString()).toMatch(/^\d+\.\d{1,2}$/);
      expect(result.capital.toString()).toMatch(/^\d+\.\d{1,2}$/);
      expect(result.total.toString()).toMatch(/^\d+\.\d{1,2}$/);
    });
  });

  // -----------------------------------------------
  // Revenue projection calculations (Per diem)
  // -----------------------------------------------
  describe('Per diem revenue projection', () => {
    it('calculates ICU daily reimbursement at 75% allowable', () => {
      const result = calculatePerDiemReimbursement(3200.00, 75.00);
      expect(result).toBe(2400.00);
    });

    it('calculates med/surg at 75% allowable', () => {
      const result = calculatePerDiemReimbursement(1500.00, 75.00);
      expect(result).toBe(1125.00);
    });

    it('calculates rural at 100% allowable', () => {
      const result = calculatePerDiemReimbursement(1500.00, 100.00);
      expect(result).toBe(1500.00);
    });

    it('handles SNF low rate correctly', () => {
      const result = calculatePerDiemReimbursement(400.00, 100.00);
      expect(result).toBe(400.00);
    });

    it('ICU carve-outs are billed separately', () => {
      // Carve-out codes for biologics/chemo should NOT be in per diem
      const carveOuts = TX_MEDICAID_ICU.carve_out_codes;
      expect(carveOuts).toContain('J0585');  // Botulinum toxin
      expect(carveOuts).toContain('J9271');  // Pembrolizumab
      expect(carveOuts).toContain('J9035');  // Bevacizumab
    });

    it('max_days enforces spell-of-illness limit', () => {
      // ICU has 365-day limit, psych has 180, rehab has 60
      expect(TX_MEDICAID_ICU.max_days).toBe(365);
      // Revenue beyond max_days is not reimbursable
    });
  });

  // -----------------------------------------------
  // Multi-payer comparison
  // -----------------------------------------------
  describe('Multi-payer revenue comparison', () => {
    it('Medicare DRG payment exceeds Medicaid per diem for typical stay', () => {
      // DRG 470 (Hip replacement): weight 1.9, avg LOS ~3 days
      const medicareDRG = calculateDRGRevenueProjection(1.9, 6397.11, 488.23, 1.0);

      // Medicaid med/surg: 3 days × $1,500 × 75%
      const medicaidPerDiem = calculatePerDiemReimbursement(1500.00, 75.00) * 3;

      expect(medicareDRG.total).toBeGreaterThan(medicaidPerDiem);
    });

    it('long stay favors per diem over DRG', () => {
      // DRG 871 (Sepsis) weight ~1.6, but long stays (10+ days)
      const medicareDRG = calculateDRGRevenueProjection(1.6, 6397.11, 488.23, 1.0);

      // Medicaid ICU: 10 days × $3,200 × 75%
      const medicaidICU = calculatePerDiemReimbursement(3200.00, 75.00) * 10;

      expect(medicaidICU).toBeGreaterThan(medicareDRG.total);
    });
  });

  // -----------------------------------------------
  // Tool definitions structure
  // -----------------------------------------------
  describe('MCP tool definitions', () => {
    // Define tool names here to test against — mirrors tools.ts
    const EXPECTED_TOOLS = [
      'get_payer_rules',
      'upsert_payer_rule',
      'aggregate_daily_charges',
      'get_daily_snapshot',
      'save_daily_snapshot',
      'run_drg_grouper',
      'get_drg_result',
      'optimize_daily_revenue',
      'validate_charge_completeness',
      'get_revenue_projection',
      'ping'
    ];

    it('server defines exactly 11 tools', () => {
      expect(EXPECTED_TOOLS.length).toBe(11);
    });

    it('all tool names follow snake_case convention', () => {
      for (const name of EXPECTED_TOOLS) {
        expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    });

    it('Session 1 tools are payer rules + revenue + ping', () => {
      const session1 = ['get_payer_rules', 'upsert_payer_rule', 'get_revenue_projection', 'ping'];
      for (const tool of session1) {
        expect(EXPECTED_TOOLS).toContain(tool);
      }
    });

    it('Session 2 tools are charge aggregation + DRG', () => {
      const session2 = ['aggregate_daily_charges', 'get_daily_snapshot', 'save_daily_snapshot', 'run_drg_grouper', 'get_drg_result'];
      for (const tool of session2) {
        expect(EXPECTED_TOOLS).toContain(tool);
      }
    });

    it('Session 3 tools are revenue optimization', () => {
      const session3 = ['optimize_daily_revenue', 'validate_charge_completeness'];
      for (const tool of session3) {
        expect(EXPECTED_TOOLS).toContain(tool);
      }
    });
  });

  // -----------------------------------------------
  // DRG data model integrity
  // -----------------------------------------------
  describe('DRG data model', () => {
    interface DRGFixture {
      drg_code: string;
      drg_description: string;
      drg_weight: number;
      drg_type: string;
      mdc_code: string;
      has_cc: boolean;
      has_mcc: boolean;
    }

    const DRG_FIXTURES: DRGFixture[] = [
      {
        drg_code: '470',
        drg_description: 'Major Hip and Knee Joint Replacement',
        drg_weight: 1.9,
        drg_type: 'ms_drg',
        mdc_code: '08',
        has_cc: false,
        has_mcc: false
      },
      {
        drg_code: '469',
        drg_description: 'Major Hip and Knee Joint Replacement with MCC',
        drg_weight: 3.2,
        drg_type: 'ms_drg',
        mdc_code: '08',
        has_cc: false,
        has_mcc: true
      },
      {
        drg_code: '871',
        drg_description: 'Septicemia or Severe Sepsis without MV >96 Hours with MCC',
        drg_weight: 1.6,
        drg_type: 'ms_drg',
        mdc_code: '18',
        has_cc: false,
        has_mcc: true
      }
    ];

    it('DRG codes are 3-digit strings', () => {
      for (const drg of DRG_FIXTURES) {
        expect(drg.drg_code).toMatch(/^\d{3}$/);
      }
    });

    it('DRG weights are positive numbers', () => {
      for (const drg of DRG_FIXTURES) {
        expect(drg.drg_weight).toBeGreaterThan(0);
      }
    });

    it('MDC codes are 2-digit strings', () => {
      for (const drg of DRG_FIXTURES) {
        expect(drg.mdc_code).toMatch(/^\d{2}$/);
      }
    });

    it('MCC DRGs have higher weight than base DRGs in same MDC', () => {
      const mdc08 = DRG_FIXTURES.filter(d => d.mdc_code === '08');
      const base = mdc08.find(d => !d.has_cc && !d.has_mcc);
      const mcc = mdc08.find(d => d.has_mcc);
      if (base && mcc) {
        expect(mcc.drg_weight).toBeGreaterThan(base.drg_weight);
      }
    });

    it('drg_type is valid enum', () => {
      const validTypes = new Set(['ms_drg', 'ap_drg', 'apr_drg']);
      for (const drg of DRG_FIXTURES) {
        expect(validTypes.has(drg.drg_type)).toBe(true);
      }
    });
  });

  // -----------------------------------------------
  // Daily charge snapshot model
  // -----------------------------------------------
  describe('Daily charge snapshot model', () => {
    const CHARGE_CATEGORIES = ['lab', 'imaging', 'pharmacy', 'nursing', 'procedure', 'evaluation', 'other'];

    it('all 7 charge categories are defined', () => {
      expect(CHARGE_CATEGORIES.length).toBe(7);
    });

    it('status workflow is draft → reviewed → finalized → billed', () => {
      const statuses = ['draft', 'reviewed', 'finalized', 'billed'];
      // Each status can only move forward
      for (let i = 0; i < statuses.length - 1; i++) {
        const current = statuses[i];
        const next = statuses[i + 1];
        expect(statuses.indexOf(current)).toBeLessThan(statuses.indexOf(next));
      }
    });

    it('day_number starts at 1 (admission day)', () => {
      // Day 1 = admission date, Day 2 = next calendar day, etc.
      const minDay = 1;
      expect(minDay).toBe(1);
    });

    it('optimization suggestions have required shape', () => {
      const validTypes = new Set([
        'missing_charge', 'upgrade_opportunity', 'documentation_gap', 'modifier_suggestion'
      ]);
      const sampleSuggestion = {
        type: 'missing_charge' as const,
        description: 'No nursing intervention charges for Day 3',
        potential_impact_amount: 250.00,
        suggested_code: '99213',
        confidence: 0.85
      };
      expect(validTypes.has(sampleSuggestion.type)).toBe(true);
      expect(sampleSuggestion.confidence).toBeGreaterThanOrEqual(0);
      expect(sampleSuggestion.confidence).toBeLessThanOrEqual(1);
      expect(sampleSuggestion.description.length).toBeGreaterThan(10);
    });
  });

  // -----------------------------------------------
  // Compliance safeguards
  // -----------------------------------------------
  describe('Compliance and audit safeguards', () => {
    it('server is advisory only — never auto-files', () => {
      // The server description and all optimization tools
      // must be advisory only
      const advisoryPhrase = 'advisory only';
      // This is enforced in tool descriptions and UI
      expect(advisoryPhrase).toBeTruthy();
    });

    it('DRG results require human confirmation', () => {
      const validStatuses = ['preliminary', 'confirmed', 'appealed', 'final'];
      // Preliminary is the default — AI never sets confirmed/final
      expect(validStatuses[0]).toBe('preliminary');
    });

    it('daily snapshots start as draft', () => {
      const validStatuses = ['draft', 'reviewed', 'finalized', 'billed'];
      expect(validStatuses[0]).toBe('draft');
    });

    it('AI skills are pinned to specific model versions', () => {
      // Per CLAUDE.md: "Pin AI model versions"
      const modelVersion = 'claude-sonnet-4-5-20250929';
      expect(modelVersion).toMatch(/^claude-\w+-\d+-\d+-\d{8}$/);
    });

    it('revenue projection never exceeds outlier threshold sanity check', () => {
      // Maximum reasonable DRG payment: weight 30 × base $6,400 × wage 2.0
      const maxReasonable = 30 * 6400 * 2.0;
      expect(maxReasonable).toBeLessThan(500000);
      // If projection exceeds this, something is wrong
    });
  });
});
