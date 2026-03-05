/**
 * Tests for Medical Coding MCP Client
 *
 * Tests revenue cycle and medical coding operations:
 * - Payer reimbursement rule lookups
 * - Daily charge aggregation
 * - DRG grouper execution and lookup
 * - Revenue optimization and charge validation
 * - Revenue projection calculation
 */

import {
  getPayerRules,
  upsertPayerRule,
  aggregateDailyCharges,
  getDailySnapshot,
  saveDailySnapshot,
  runDRGGrouper,
  getDRGResult,
  optimizeDailyRevenue,
  validateChargeCompleteness,
  getRevenueProjection,
  MedicalCodingMCPClient,
} from '../mcpMedicalCodingClient';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {
  'sb-xkybsjnvuohpqpbkikyn-auth-token': JSON.stringify({ access_token: 'test-token' }),
};

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]); },
  },
});

const mockMCPResponse = <T>(data: T) => ({
  ok: true,
  json: async () => ({
    jsonrpc: '2.0',
    result: { content: [{ type: 'text', text: JSON.stringify(data) }] },
    id: 1,
  }),
});

const mockErrorResponse = (status: number, text: string) => ({
  ok: false,
  status,
  text: async () => text,
});

describe('MedicalCodingMCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPayerRules', () => {
    it('should fetch Medicare DRG-based payer rules', async () => {
      const mockRules = {
        rules: [
          {
            id: 'rule-1',
            payer_type: 'medicare',
            state_code: null,
            fiscal_year: 2026,
            rule_type: 'drg_based',
            acuity_tier: null,
            base_rate_amount: 6500.5,
            capital_rate_amount: 476.12,
            wage_index_factor: 1.0234,
            per_diem_rate: null,
            allowable_percentage: null,
            max_days: null,
            outlier_threshold: 32500,
            carve_out_codes: null,
            rule_description: 'Medicare FY2026 IPPS base rate',
            source_reference: 'CMS Final Rule FY2026',
            effective_date: '2025-10-01',
            expiration_date: null,
            is_active: true,
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce(mockMCPResponse(mockRules));

      const result = await getPayerRules('medicare', 2026);

      expect(result.success).toBe(true);
      expect(result.data?.rules).toHaveLength(1);
      expect(result.data?.rules[0].payer_type).toBe('medicare');
      expect(result.data?.rules[0].base_rate_amount).toBe(6500.5);
      expect(result.data?.total).toBe(1);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(fetchBody.method).toBe('tools/call');
      expect(fetchBody.params.name).toBe('get_payer_rules');
      expect(fetchBody.params.arguments.payer_type).toBe('medicare');
      expect(fetchBody.params.arguments.fiscal_year).toBe(2026);
    });

    it('should pass optional state code and rule type filters', async () => {
      mockFetch.mockResolvedValueOnce(mockMCPResponse({ rules: [], total: 0 }));

      await getPayerRules('medicaid', 2026, { stateCode: 'TX', ruleType: 'per_diem' });

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(fetchBody.params.arguments.state_code).toBe('TX');
      expect(fetchBody.params.arguments.rule_type).toBe('per_diem');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'Internal server error'));

      const result = await getPayerRules('medicare', 2026);

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });
  });

  describe('upsertPayerRule', () => {
    it('should create a new payer rule', async () => {
      const newRule = {
        id: 'rule-new',
        payer_type: 'medicaid' as const,
        state_code: 'CA',
        fiscal_year: 2026,
        rule_type: 'per_diem' as const,
        acuity_tier: 'med_surg',
        base_rate_amount: null,
        capital_rate_amount: null,
        wage_index_factor: 1.0,
        per_diem_rate: 850.0,
        allowable_percentage: null,
        max_days: 30,
        outlier_threshold: null,
        carve_out_codes: null,
        rule_description: 'CA Medicaid med/surg per diem',
        source_reference: null,
        effective_date: '2026-01-01',
        expiration_date: null,
        is_active: true,
      };

      mockFetch.mockResolvedValueOnce(mockMCPResponse({ rule: newRule, action: 'created' }));

      const result = await upsertPayerRule({
        payer_type: 'medicaid',
        fiscal_year: 2026,
        rule_type: 'per_diem',
        effective_date: '2026-01-01',
        state_code: 'CA',
        per_diem_rate: 850.0,
        max_days: 30,
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('created');
      expect(result.data?.rule.per_diem_rate).toBe(850.0);
    });
  });

  describe('aggregateDailyCharges', () => {
    it('should aggregate charges for an encounter', async () => {
      const mockSnapshot = {
        encounter_id: 'enc-1',
        patient_id: 'pat-1',
        service_date: '2026-03-04',
        day_number: 3,
        charges: {
          pharmacy: {
            category: 'pharmacy',
            charges: [
              { code: 'J0171', description: 'Adrenalin epinephrine inject', charge_amount: 45.0, quantity: 2, source: 'pharmacy' },
            ],
            subtotal: 90.0,
          },
        },
        total_charge_amount: 90.0,
        charge_count: 1,
        status: 'draft',
      };

      mockFetch.mockResolvedValueOnce(mockMCPResponse(mockSnapshot));

      const result = await aggregateDailyCharges('pat-1', 'enc-1', '2026-03-04');

      expect(result.success).toBe(true);
      expect(result.data?.total_charge_amount).toBe(90.0);
      expect(result.data?.day_number).toBe(3);
      expect(result.data?.charges.pharmacy.subtotal).toBe(90.0);
    });
  });

  describe('runDRGGrouper', () => {
    it('should run the 3-pass DRG grouper', async () => {
      const mockDRG = {
        encounter_id: 'enc-1',
        drg_code: '193',
        drg_description: 'Simple pneumonia and pleurisy w MCC',
        drg_weight: 1.4974,
        mdc: '04',
        severity: 'mcc',
        principal_diagnosis: 'J18.9',
        secondary_diagnoses: ['E11.9', 'I10'],
        procedures: [],
        grouper_version: 'MS-DRG v41',
        analysis: {
          base_drg: { code: '195', weight: 0.7197, description: 'Simple pneumonia and pleurisy w/o CC/MCC' },
          cc_drg: { code: '194', weight: 1.0079, description: 'Simple pneumonia and pleurisy w CC' },
          mcc_drg: { code: '193', weight: 1.4974, description: 'Simple pneumonia and pleurisy w MCC' },
          selected: 'mcc',
          rationale: 'E11.9 (Type 2 DM) qualifies as MCC',
        },
        advisory_disclaimer: 'Advisory only — review by certified coder required',
      };

      mockFetch.mockResolvedValueOnce(mockMCPResponse(mockDRG));

      const result = await runDRGGrouper('enc-1', 'pat-1', {
        principalDiagnosis: 'J18.9',
        additionalDiagnoses: ['E11.9', 'I10'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.drg_code).toBe('193');
      expect(result.data?.severity).toBe('mcc');
      expect(result.data?.analysis.selected).toBe('mcc');
      expect(result.data?.drg_weight).toBe(1.4974);

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(fetchBody.method).toBe('tools/call');
      expect(fetchBody.params.name).toBe('run_drg_grouper');
      expect(fetchBody.params.arguments.principal_diagnosis).toBe('J18.9');
      expect(fetchBody.params.arguments.additional_diagnoses).toEqual(['E11.9', 'I10']);
    });
  });

  describe('getDRGResult', () => {
    it('should look up an existing DRG result', async () => {
      mockFetch.mockResolvedValueOnce(
        mockMCPResponse({
          encounter_id: 'enc-1',
          drg_code: '470',
          drg_description: 'Major hip and knee joint replacement',
          drg_weight: 1.905,
          mdc: '08',
          severity: 'base',
          principal_diagnosis: 'M16.11',
          secondary_diagnoses: [],
          procedures: ['0SR9019'],
          grouper_version: 'MS-DRG v41',
          analysis: {
            base_drg: { code: '470', weight: 1.905, description: 'Major hip and knee joint replacement' },
            cc_drg: null,
            mcc_drg: null,
            selected: 'base',
            rationale: 'No CC/MCC qualifying conditions',
          },
          advisory_disclaimer: 'Advisory only',
        })
      );

      const result = await getDRGResult('enc-1');

      expect(result.success).toBe(true);
      expect(result.data?.drg_code).toBe('470');
      expect(result.data?.drg_weight).toBe(1.905);
    });
  });

  describe('getRevenueProjection', () => {
    it('should calculate expected reimbursement', async () => {
      const mockProjection = {
        payer_type: 'medicare',
        drg_code: '470',
        drg_weight: 1.905,
        operating_payment: 12382.5,
        capital_payment: 907.58,
        total_expected: 13290.08,
        base_rate: 6500.5,
        wage_index: 1.0234,
        methodology: 'MS-DRG weight x adjusted base rate',
        breakdown: {
          operating_base: 6500.5,
          wage_adjusted: 6652.21,
          weight_applied: 12682.96,
        },
      };

      mockFetch.mockResolvedValueOnce(mockMCPResponse(mockProjection));

      const result = await getRevenueProjection('medicare', {
        drgCode: '470',
        drgWeight: 1.905,
      });

      expect(result.success).toBe(true);
      expect(result.data?.total_expected).toBe(13290.08);
      expect(result.data?.operating_payment).toBe(12382.5);
      expect(result.data?.methodology).toContain('MS-DRG');
    });
  });

  describe('validateChargeCompleteness', () => {
    it('should return completeness score and alerts', async () => {
      const mockValidation = {
        encounter_id: 'enc-1',
        service_date: '2026-03-04',
        completeness_score: 72,
        alerts: [
          {
            category: 'Missing Charge',
            severity: 'warning',
            message: 'Pharmacy charges not present for day with documented medications',
            suggested_codes: ['J0171'],
            estimated_impact: 45.0,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(mockMCPResponse(mockValidation));

      const result = await validateChargeCompleteness('enc-1', '2026-03-04');

      expect(result.success).toBe(true);
      expect(result.data?.completeness_score).toBe(72);
      expect(result.data?.alerts).toHaveLength(1);
      expect(result.data?.alerts[0].severity).toBe('warning');
    });
  });

  describe('optimizeDailyRevenue', () => {
    it('should return optimization findings', async () => {
      const mockOptimization = {
        encounter_id: 'enc-1',
        service_date: '2026-03-04',
        findings: [
          {
            type: 'missing_code',
            severity: 'high',
            description: 'Sepsis screening (R65.20) documented but not coded',
            suggested_action: 'Add R65.20 as secondary diagnosis',
            estimated_impact: 4500.0,
            codes: ['R65.20'],
          },
        ],
        summary: {
          total_findings: 1,
          estimated_revenue_impact: 4500.0,
          critical_items: 1,
        },
        advisory_disclaimer: 'Advisory only — certified coder review required',
      };

      mockFetch.mockResolvedValueOnce(mockMCPResponse(mockOptimization));

      const result = await optimizeDailyRevenue('enc-1', '2026-03-04');

      expect(result.success).toBe(true);
      expect(result.data?.summary.estimated_revenue_impact).toBe(4500.0);
      expect(result.data?.findings[0].type).toBe('missing_code');
      expect(result.data?.findings[0].severity).toBe('high');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getPayerRules('medicare', 2026);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unexpected: 'format' }),
      });

      const result = await getPayerRules('medicare', 2026);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response format');
    });

    it('should handle missing auth token', async () => {
      const original = mockLocalStorage['sb-xkybsjnvuohpqpbkikyn-auth-token'];
      delete mockLocalStorage['sb-xkybsjnvuohpqpbkikyn-auth-token'];

      mockFetch.mockResolvedValueOnce(mockMCPResponse({ rules: [], total: 0 }));

      const result = await getPayerRules('medicare', 2026);

      expect(result.success).toBe(true);
      // Verify empty token was sent
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer ');

      mockLocalStorage['sb-xkybsjnvuohpqpbkikyn-auth-token'] = original;
    });
  });

  describe('MedicalCodingMCPClient class', () => {
    it('should instantiate and have all methods', () => {
      const client = new MedicalCodingMCPClient();

      expect(typeof client.getPayerRules).toBe('function');
      expect(typeof client.upsertPayerRule).toBe('function');
      expect(typeof client.aggregateDailyCharges).toBe('function');
      expect(typeof client.getDailySnapshot).toBe('function');
      expect(typeof client.saveDailySnapshot).toBe('function');
      expect(typeof client.runDRGGrouper).toBe('function');
      expect(typeof client.getDRGResult).toBe('function');
      expect(typeof client.optimizeDailyRevenue).toBe('function');
      expect(typeof client.validateChargeCompleteness).toBe('function');
      expect(typeof client.getRevenueProjection).toBe('function');
    });
  });

  describe('getDailySnapshot', () => {
    it('should retrieve daily charge snapshot by encounter', async () => {
      mockFetch.mockResolvedValueOnce(
        mockMCPResponse({
          encounter_id: 'enc-1',
          patient_id: 'pat-1',
          service_date: '2026-03-04',
          day_number: 1,
          charges: {},
          total_charge_amount: 0,
          charge_count: 0,
          status: 'draft',
        })
      );

      const result = await getDailySnapshot('enc-1', '2026-03-04');

      expect(result.success).toBe(true);
      expect(result.data?.encounter_id).toBe('enc-1');
      expect(result.data?.status).toBe('draft');
    });
  });

  describe('saveDailySnapshot', () => {
    it('should save a charge snapshot', async () => {
      mockFetch.mockResolvedValueOnce(
        mockMCPResponse({ snapshot_id: 'snap-1', status: 'saved' })
      );

      const result = await saveDailySnapshot({
        encounter_id: 'enc-1',
        patient_id: 'pat-1',
        admit_date: '2026-03-01',
        service_date: '2026-03-04',
        day_number: 4,
        status: 'reviewed',
      });

      expect(result.success).toBe(true);
      expect(result.data?.snapshot_id).toBe('snap-1');
    });
  });
});
