/**
 * Tests for CMS Coverage MCP Client
 *
 * Tests Medicare coverage database operations:
 * - LCD/NCD search
 * - Coverage requirements
 * - Prior authorization checking
 * - MAC contractor lookup
 */

import {
  searchLCDs,
  searchNCDs,
  getCoverageRequirements,
  checkPriorAuthRequired,
  getMACContractorInfo,
  getCoverageArticles,
  getLCDDetails,
  getNCDDetails,
  COMMON_PRIOR_AUTH_CODES,
  CMSCoverageMCPClient
} from '../mcpCMSCoverageClient';

// Mock fetch
const mockFetch = vi.fn();
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

describe('CMSCoverageMCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchLCDs', () => {
    it('should search LCDs by query', async () => {
      const mockLCDs = {
        lcds: [
          {
            lcd_id: 'L33777',
            title: 'Local Coverage Determination for MRI',
            contractor: 'Novitas Solutions',
            contractor_number: 'JH',
            status: 'active',
            effective_date: '2024-01-01',
            related_codes: ['70553'],
            summary: 'Coverage is provided for MRI when medical necessity criteria are met.'
          }
        ],
        total: 1
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockLCDs }]
        })
      });

      const result = await searchLCDs('MRI');

      expect(result.success).toBe(true);
      expect(result.data?.lcds).toHaveLength(1);
      expect(result.data?.lcds[0].lcd_id).toBe('L33777');
      expect(result.data?.total).toBe(1);
    });

    it('should filter by state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { lcds: [], total: 0 } }]
        })
      });

      await searchLCDs('MRI', { state: 'TX' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"state":"TX"')
        })
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const result = await searchLCDs('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });
  });

  describe('searchNCDs', () => {
    it('should search NCDs by query', async () => {
      const mockNCDs = {
        ncds: [
          {
            ncd_id: '220.6.1',
            title: 'National Coverage Determination for Cardiac Rehab',
            status: 'active',
            effective_date: '2023-07-01',
            manual_section: '220.6',
            coverage_provisions: 'Medicare covers cardiac rehabilitation when medically necessary.',
            indications: ['Medical necessity established'],
            limitations: ['Annual limits may apply']
          }
        ],
        total: 1
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockNCDs }]
        })
      });

      const result = await searchNCDs('cardiac rehabilitation');

      expect(result.success).toBe(true);
      expect(result.data?.ncds).toHaveLength(1);
      expect(result.data?.ncds[0].ncd_id).toBe('220.6.1');
    });
  });

  describe('getCoverageRequirements', () => {
    it('should get coverage requirements for a CPT code', async () => {
      const mockRequirements = {
        code: '70553',
        description: 'MRI brain with and without contrast',
        coverage_status: 'Prior authorization required',
        requirements: [
          'Prior authorization required',
          'Typical approval time: 2-5 business days'
        ],
        documentation_needed: [
          'Clinical indication',
          'Prior imaging results',
          'Neurological exam'
        ],
        lcd_references: ['L33777'],
        ncd_references: ['220.6']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockRequirements }]
        })
      });

      const result = await getCoverageRequirements('70553', 'TX');

      expect(result.success).toBe(true);
      expect(result.data?.code).toBe('70553');
      expect(result.data?.coverage_status).toContain('Prior authorization');
      expect(result.data?.documentation_needed).toContain('Clinical indication');
    });

    it('should include payer type in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { code: '99213' } }]
        })
      });

      await getCoverageRequirements('99213', 'CA', 'medicare_advantage');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"payer_type":"medicare_advantage"')
        })
      );
    });
  });

  describe('checkPriorAuthRequired', () => {
    it('should check prior auth for MRI code', async () => {
      const mockPriorAuth = {
        cpt_code: '70553',
        requires_prior_auth: true,
        confidence: 'high',
        reason: 'MRI brain with and without contrast typically requires prior authorization under Medicare guidelines.',
        documentation_required: [
          'Clinical indication',
          'Prior imaging results',
          'Neurological exam'
        ],
        estimated_approval_time: '2-5 business days',
        appeal_process: 'Submit reconsideration within 60 days if denied'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockPriorAuth }]
        })
      });

      const result = await checkPriorAuthRequired('70553', ['G43.909'], 'TX');

      expect(result.success).toBe(true);
      expect(result.data?.requires_prior_auth).toBe(true);
      expect(result.data?.confidence).toBe('high');
      expect(result.data?.documentation_required).toContain('Clinical indication');
    });

    it('should return false for routine procedures', async () => {
      const mockPriorAuth = {
        cpt_code: '99213',
        requires_prior_auth: false,
        confidence: 'high',
        reason: 'Office visit does not typically require prior authorization.',
        documentation_required: ['Clinical indication'],
        estimated_approval_time: 'N/A',
        appeal_process: 'Submit reconsideration within 60 days if denied'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockPriorAuth }]
        })
      });

      const result = await checkPriorAuthRequired('99213');

      expect(result.success).toBe(true);
      expect(result.data?.requires_prior_auth).toBe(false);
    });

    it('should include ICD-10 codes in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { cpt_code: '27447', requires_prior_auth: true } }]
        })
      });

      await checkPriorAuthRequired('27447', ['M17.11', 'M17.12']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"icd10_codes":["M17.11","M17.12"]')
        })
      );
    });
  });

  describe('getMACContractorInfo', () => {
    it('should get MAC contractor for Texas', async () => {
      const mockContractors = {
        state: 'TX',
        contractors: {
          part_a_b: { name: 'Novitas Solutions', number: 'JH' },
          dme: { name: 'CGS Administrators', number: 'DME-C' }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockContractors }]
        })
      });

      const result = await getMACContractorInfo('TX');

      expect(result.success).toBe(true);
      expect(result.data?.state).toBe('TX');
      expect(result.data?.contractors.part_a_b.name).toBe('Novitas Solutions');
      expect(result.data?.contractors.dme.name).toBe('CGS Administrators');
    });

    it('should handle unknown states', async () => {
      const mockContractors = {
        state: 'XX',
        contractors: {
          part_a_b: { name: 'Check CMS.gov for your jurisdiction', number: 'Unknown' },
          dme: { name: 'Check CMS.gov for your jurisdiction', number: 'Unknown' }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockContractors }]
        })
      });

      const result = await getMACContractorInfo('XX');

      expect(result.success).toBe(true);
      expect(result.data?.contractors.part_a_b.number).toBe('Unknown');
    });
  });

  describe('getCoverageArticles', () => {
    it('should get billing articles for a code', async () => {
      const mockArticles = {
        articles: [
          {
            article_id: 'A52345',
            type: 'billing',
            title: 'Billing and Coding Article for 70553',
            content: 'Billing guidance for 70553: Ensure appropriate modifier usage.',
            effective_date: '2024-01-01'
          },
          {
            article_id: 'A52346',
            type: 'coding',
            title: 'Coding Guidelines for 70553',
            content: 'Code 70553 should be reported with appropriate ICD-10 codes.',
            effective_date: '2024-01-01'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockArticles }]
        })
      });

      const result = await getCoverageArticles('70553');

      expect(result.success).toBe(true);
      expect(result.data?.articles).toHaveLength(2);
      expect(result.data?.articles[0].type).toBe('billing');
    });

    it('should filter by article type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { articles: [] } }]
        })
      });

      await getCoverageArticles('70553', 'billing');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"article_type":"billing"')
        })
      );
    });
  });

  describe('getLCDDetails', () => {
    it('should get LCD details by ID', async () => {
      const mockLCD = {
        lcd_id: 'L33777',
        title: 'Local Coverage Determination for MRI',
        contractor: 'Multiple MACs',
        status: 'active',
        effective_date: '2024-01-01',
        revision_history: [
          { date: '2024-01-01', change: 'Initial publication' },
          { date: '2025-01-15', change: 'Updated coverage criteria' }
        ],
        coverage_indications: ['Medical necessity established'],
        limitations: ['Coverage frequency limits may apply'],
        related_articles: ['A33777'],
        hcpcs_codes: ['70553', '70551', '70552']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockLCD }]
        })
      });

      const result = await getLCDDetails('L33777');

      expect(result.success).toBe(true);
      expect(result.data?.lcd_id).toBe('L33777');
      expect(result.data?.revision_history).toHaveLength(2);
    });
  });

  describe('getNCDDetails', () => {
    it('should get NCD details by ID', async () => {
      const mockNCD = {
        ncd_id: '220.6.1',
        title: 'National Coverage Determination for Cardiac Rehab',
        manual_section: '220',
        status: 'active',
        effective_date: '2023-01-01',
        coverage_provisions: 'Medicare covers this service when medically necessary.',
        covered_indications: ['Appropriate clinical indication documented'],
        non_covered_indications: ['Screening without symptoms'],
        documentation_requirements: ['Written order from treating physician']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockNCD }]
        })
      });

      const result = await getNCDDetails('220.6.1');

      expect(result.success).toBe(true);
      expect(result.data?.ncd_id).toBe('220.6.1');
      expect(result.data?.documentation_requirements).toBeDefined();
    });
  });

  describe('COMMON_PRIOR_AUTH_CODES', () => {
    it('should have MRI codes', () => {
      expect(COMMON_PRIOR_AUTH_CODES['70553']).toBeDefined();
      expect(COMMON_PRIOR_AUTH_CODES['70553'].requires_prior_auth).toBe(true);
      expect(COMMON_PRIOR_AUTH_CODES['70553'].documentation).toContain('Clinical indication');
    });

    it('should have joint replacement codes', () => {
      expect(COMMON_PRIOR_AUTH_CODES['27447']).toBeDefined();
      expect(COMMON_PRIOR_AUTH_CODES['27447'].description).toContain('knee replacement');
    });

    it('should have DME codes', () => {
      expect(COMMON_PRIOR_AUTH_CODES['E0601']).toBeDefined();
      expect(COMMON_PRIOR_AUTH_CODES['E0601'].description).toContain('CPAP');
    });
  });

  describe('CMSCoverageMCPClient class', () => {
    it('should instantiate correctly', () => {
      const client = new CMSCoverageMCPClient();
      expect(client).toBeDefined();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await searchLCDs('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      });

      const result = await searchLCDs('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response format');
    });
  });
});
