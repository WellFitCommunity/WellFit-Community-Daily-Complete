/**
 * Tests for Medical Codes MCP Client
 */

import {
  searchCPTCodes,
  searchICD10Codes,
  searchHCPCSCodes,
  getCodeModifiers,
  validateBillingCodes,
  checkCodeBundling,
  getCodeInfo,
  suggestCodesForDescription,
  getSDOHZCodes,
  EM_CODES,
  COMMON_MODIFIERS,
  MedicalCodesMCPClient
} from '../mcpMedicalCodesClient';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {
  'sb-xkybsjnvuohpqpbkikyn-auth-token': JSON.stringify({ access_token: 'test-token' })
};

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
  }
});

describe('MedicalCodesMCPClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchCPTCodes', () => {
    it('should search CPT codes by description', async () => {
      const mockData = [
        { code: '99213', short_description: 'Office visit, established patient', category: 'E/M' },
        { code: '99214', short_description: 'Office visit, established patient, detailed', category: 'E/M' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 2, executionTimeMs: 30 }
        })
      });

      const result = await searchCPTCodes('office visit');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].code).toBe('99213');
    });

    it('should search CPT codes by code', async () => {
      const mockData = [
        { code: '99213', short_description: 'Office visit, established patient', work_rvu: 1.3 }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 1, executionTimeMs: 20 }
        })
      });

      const result = await searchCPTCodes('99213');

      expect(result.success).toBe(true);
      expect(result.data?.[0].code).toBe('99213');
    });
  });

  describe('searchICD10Codes', () => {
    it('should search ICD-10 codes by diagnosis', async () => {
      const mockData = [
        { code: 'I10', description: 'Essential (primary) hypertension', is_billable: true },
        { code: 'I11.0', description: 'Hypertensive heart disease with heart failure', is_billable: true }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 2, executionTimeMs: 25 }
        })
      });

      const result = await searchICD10Codes('hypertension');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].code).toBe('I10');
    });
  });

  describe('searchHCPCSCodes', () => {
    it('should search HCPCS codes', async () => {
      const mockData = [
        { code: 'A4253', short_description: 'Blood glucose test strips', level: 'II' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 1, executionTimeMs: 20 }
        })
      });

      const result = await searchHCPCSCodes('glucose strips');

      expect(result.success).toBe(true);
      expect(result.data?.[0].code).toBe('A4253');
    });
  });

  describe('getCodeModifiers', () => {
    it('should return modifiers for a CPT code', async () => {
      const mockData = [
        { modifier: '25', description: 'Significant, separately identifiable E/M service', applies_to: ['cpt'] },
        { modifier: '59', description: 'Distinct procedural service', applies_to: ['cpt'] }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 2, executionTimeMs: 15 }
        })
      });

      const result = await getCodeModifiers('99213', 'cpt');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('validateBillingCodes', () => {
    it('should validate a valid code combination', async () => {
      const mockData = {
        cpt_validation: [{ code: '99213', valid: true }],
        icd10_validation: [{ code: 'I10', valid: true }],
        bundling_issues: [],
        is_valid: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 2, executionTimeMs: 50 }
        })
      });

      const result = await validateBillingCodes(['99213'], ['I10']);

      expect(result.success).toBe(true);
      expect(result.data?.is_valid).toBe(true);
      expect(result.data?.bundling_issues).toHaveLength(0);
    });

    it('should detect bundling issues', async () => {
      const mockData = {
        cpt_validation: [
          { code: '99213', valid: true },
          { code: '99214', valid: true }
        ],
        icd10_validation: [{ code: 'I10', valid: true }],
        bundling_issues: [{
          codes: ['99213', '99214'],
          issue: 'Cannot bill multiple E/M codes same day same provider',
          suggestion: 'Remove one of the codes or document medical necessity'
        }],
        is_valid: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 3, executionTimeMs: 45 }
        })
      });

      const result = await validateBillingCodes(['99213', '99214'], ['I10']);

      expect(result.success).toBe(true);
      expect(result.data?.is_valid).toBe(false);
      expect(result.data?.bundling_issues).toHaveLength(1);
    });
  });

  describe('checkCodeBundling', () => {
    it('should return bundling issues', async () => {
      const mockData = [{
        codes: ['99213', '99214'],
        issue: 'Cannot bill multiple E/M codes same day',
        suggestion: 'Remove one code'
      }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 2, executionTimeMs: 20 }
        })
      });

      const result = await checkCodeBundling(['99213', '99214']);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getCodeInfo', () => {
    it('should get detailed CPT code info', async () => {
      const mockData = {
        code: '99214',
        short_description: 'Office visit, established patient, detailed',
        long_description: 'Office or other outpatient visit for the evaluation and management of an established patient...',
        work_rvu: 1.92,
        facility_rvu: 0.81
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 1, executionTimeMs: 15 }
        })
      });

      const result = await getCodeInfo('99214', 'cpt');

      expect(result.success).toBe(true);
      expect(result.data?.code).toBe('99214');
    });
  });

  describe('suggestCodesForDescription', () => {
    it('should suggest codes for a clinical description', async () => {
      const mockData = {
        cpt: [{ code: '99214', short_description: 'Office visit' }],
        icd10: [{ code: 'I10', description: 'Hypertension' }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 2, executionTimeMs: 35 }
        })
      });

      const result = await suggestCodesForDescription('patient with hypertension follow-up');

      expect(result.success).toBe(true);
      expect(result.data?.cpt).toBeDefined();
      expect(result.data?.icd10).toBeDefined();
    });
  });

  describe('getSDOHZCodes', () => {
    it('should return SDOH codes for a category', async () => {
      const mockData = {
        housing: [
          { code: 'Z59.0', description: 'Homelessness' },
          { code: 'Z59.1', description: 'Inadequate housing' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 2, executionTimeMs: 10 }
        })
      });

      const result = await getSDOHZCodes('housing');

      expect(result.success).toBe(true);
      expect(result.data?.housing).toHaveLength(2);
    });

    it('should return all SDOH codes when no category specified', async () => {
      const mockData = {
        housing: [{ code: 'Z59.0', description: 'Homelessness' }],
        food: [{ code: 'Z59.41', description: 'Food insecurity' }],
        transportation: [{ code: 'Z59.82', description: 'Transportation insecurity' }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }],
          metadata: { codesReturned: 3, executionTimeMs: 15 }
        })
      });

      const result = await getSDOHZCodes('all');

      expect(result.success).toBe(true);
      expect(Object.keys(result.data || {})).toHaveLength(3);
    });
  });

  describe('Quick reference constants', () => {
    it('should have E/M codes defined', () => {
      expect(EM_CODES.NEW_99201).toBe('99201');
      expect(EM_CODES.EST_99213).toBe('99213');
      expect(EM_CODES.MODIFIER_95).toBe('95');
    });

    it('should have common modifiers defined', () => {
      expect(COMMON_MODIFIERS.SEPARATE_EM).toBe('25');
      expect(COMMON_MODIFIERS.PROFESSIONAL).toBe('26');
      expect(COMMON_MODIFIERS.TECHNICAL).toBe('TC');
      expect(COMMON_MODIFIERS.DISTINCT).toBe('59');
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await searchCPTCodes('test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Internal server error' }
        })
      });

      const result = await searchCPTCodes('test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
    });
  });
});
