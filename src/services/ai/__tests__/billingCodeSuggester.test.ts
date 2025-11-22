/**
 * Jest Tests for Billing Code Suggester
 * Covers: Unit tests, integration tests, security, edge cases
 */

// Mock MCP modules before imports
jest.mock('../../mcp/mcpClient');
jest.mock('../../mcp/mcpCostOptimizer');

// Mock Supabase
jest.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}));

import { BillingCodeSuggester } from '../billingCodeSuggester';
import { supabase } from '../../../lib/supabaseClient';
import type { EncounterContext } from '../billingCodeSuggester';

// Mock MCP Cost Optimizer
const mockOptimizer = {
  call: jest.fn()
};

describe('BillingCodeSuggester', () => {
  let suggester: BillingCodeSuggester;
  let mockSupabaseFrom: jest.Mock;
  let mockSupabaseRpc: jest.Mock;

  beforeEach(() => {
    suggester = new BillingCodeSuggester(mockOptimizer as any);
    mockSupabaseFrom = supabase.from as jest.Mock;
    mockSupabaseRpc = supabase.rpc as jest.Mock;
    jest.clearAllMocks();
  });

  describe('Input Validation (Security)', () => {
    it('should reject invalid UUID for encounterId', async () => {
      const invalidContext: EncounterContext = {
        encounterId: 'invalid-uuid',
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        encounterType: 'outpatient',
        encounterStart: '2025-11-15T10:00:00Z'
      };

      await expect(suggester.suggestCodes(invalidContext)).rejects.toThrow('Invalid encounterId');
    });

    it('should reject SQL injection attempts in chiefComplaint', async () => {
      const context: EncounterContext = {
        encounterId: '123e4567-e89b-12d3-a456-426614174000',
        patientId: '123e4567-e89b-12d3-a456-426614174001',
        tenantId: '123e4567-e89b-12d3-a456-426614174002',
        encounterType: 'outpatient',
        encounterStart: '2025-11-15T10:00:00Z',
        chiefComplaint: "Headache'; DROP TABLE users;--"
      };

      // Mock tenant config
      mockSupabaseRpc.mockResolvedValue({
        data: { billing_suggester_enabled: true },
        error: null
      });

      // Mock cache miss
      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        })
      });

      // Mock AI response
      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({
          cpt: [{ code: '99214', description: 'Office visit', confidence: 0.9, rationale: 'Standard visit' }],
          hcpcs: [],
          icd10: [{ code: 'R51', description: 'Headache', confidence: 0.95, rationale: 'Chief complaint' }]
        }),
        cost: 0.01,
        model: 'claude-haiku-4-5-20250929',
        fromCache: false
      });

      // Mock insert
      mockSupabaseFrom.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await suggester.suggestCodes(context);

      // Verify SQL injection characters were removed (but legitimate words like DROP are kept)
      const aiCallArgs = mockOptimizer.call.mock.calls[0][0];
      expect(aiCallArgs.prompt).not.toContain(';'); // SQL terminator removed
      expect(aiCallArgs.prompt).not.toContain('--'); // SQL comment removed
      expect(aiCallArgs.prompt).not.toContain("'"); // Quote removed
      expect(aiCallArgs.prompt).toContain('DROP'); // Legitimate word kept (e.g., "blood pressure drop")
    });

    it('should reject XSS attempts in chiefComplaint', async () => {
      const context: EncounterContext = {
        encounterId: '123e4567-e89b-12d3-a456-426614174000',
        patientId: '123e4567-e89b-12d3-a456-426614174001',
        tenantId: '123e4567-e89b-12d3-a456-426614174002',
        encounterType: 'outpatient',
        encounterStart: '2025-11-15T10:00:00Z',
        chiefComplaint: '<script>alert("XSS")</script>'
      };

      mockSupabaseRpc.mockResolvedValue({
        data: { billing_suggester_enabled: true },
        error: null
      });

      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        })
      });

      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({
          cpt: [],
          hcpcs: [],
          icd10: []
        }),
        cost: 0.01,
        model: 'claude-haiku-4-5-20250929',
        fromCache: false
      });

      mockSupabaseFrom.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      await suggester.suggestCodes(context);

      const aiCallArgs = mockOptimizer.call.mock.calls[0][0];
      expect(aiCallArgs.prompt).not.toContain('<script>');
      expect(aiCallArgs.prompt).not.toContain('</script>');
    });

    it('should enforce max length on text inputs', async () => {
      const longText = 'a'.repeat(2000); // 2000 characters
      const context: EncounterContext = {
        encounterId: '123e4567-e89b-12d3-a456-426614174000',
        patientId: '123e4567-e89b-12d3-a456-426614174001',
        tenantId: '123e4567-e89b-12d3-a456-426614174002',
        encounterType: 'outpatient',
        encounterStart: '2025-11-15T10:00:00Z',
        chiefComplaint: longText
      };

      mockSupabaseRpc.mockResolvedValue({
        data: { billing_suggester_enabled: true },
        error: null
      });

      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        })
      });

      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({ cpt: [], hcpcs: [], icd10: [] }),
        cost: 0.01,
        model: 'claude-haiku-4-5-20250929',
        fromCache: false
      });

      mockSupabaseFrom.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      await suggester.suggestCodes(context);

      // Chief complaint should be truncated to 500 chars
      const aiCallArgs = mockOptimizer.call.mock.calls[0][0];
      expect(aiCallArgs.prompt.length).toBeLessThan(1000);
    });

    it('should validate ICD-10 code format', async () => {
      const context: EncounterContext = {
        encounterId: '123e4567-e89b-12d3-a456-426614174000',
        patientId: '123e4567-e89b-12d3-a456-426614174001',
        tenantId: '123e4567-e89b-12d3-a456-426614174002',
        encounterType: 'outpatient',
        encounterStart: '2025-11-15T10:00:00Z',
        diagnosisCodes: ['INVALID_CODE']
      };

      await expect(suggester.suggestCodes(context)).rejects.toThrow('Invalid ICD-10 code');
    });
  });

  describe('Caching Functionality', () => {
    it('should return cached results when available', async () => {
      const context: EncounterContext = {
        encounterId: '123e4567-e89b-12d3-a456-426614174000',
        patientId: '123e4567-e89b-12d3-a456-426614174001',
        tenantId: '123e4567-e89b-12d3-a456-426614174002',
        encounterType: 'outpatient',
        encounterStart: '2025-11-15T10:00:00Z',
        diagnosisCodes: ['E11.9'] // Type 2 diabetes
      };

      // Mock cache hit
      const cachedData = {
        id: 'cache-id-123',
        suggested_cpt_codes: [
          { code: '99214', description: 'Office visit', confidence: 0.95, rationale: 'Cached' }
        ],
        suggested_hcpcs_codes: [],
        suggested_icd10_codes: [
          { code: 'E11.9', description: 'Type 2 diabetes', confidence: 0.98, rationale: 'Cached' }
        ],
        model_used: 'claude-haiku-4-5-20250929'
      };

      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: cachedData, error: null })
              })
            })
          })
        })
      });

      // Mock tenant config (first RPC call)
      mockSupabaseRpc.mockResolvedValueOnce({
        data: { billing_suggester_enabled: true },
        error: null
      });

      // Mock increment hit count (second RPC call)
      mockSupabaseRpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await suggester.suggestCodes(context);

      // Verify cache was used
      expect(result.fromCache).toBe(true);
      expect(result.aiCost).toBe(0); // No cost for cached results
      expect(mockOptimizer.call).not.toHaveBeenCalled(); // AI not called

      // Verify cache hit was incremented
      expect(mockSupabaseRpc).toHaveBeenCalledWith('increment_billing_cache_hit', {
        p_cache_id: 'cache-id-123'
      });
    });

    it('should call AI when cache misses', async () => {
      const context: EncounterContext = {
        encounterId: '123e4567-e89b-12d3-a456-426614174000',
        patientId: '123e4567-e89b-12d3-a456-426614174001',
        tenantId: '123e4567-e89b-12d3-a456-426614174002',
        encounterType: 'outpatient',
        encounterStart: '2025-11-15T10:00:00Z',
        diagnosisCodes: ['J44.1'] // COPD with exacerbation
      };

      // Mock tenant config
      mockSupabaseRpc.mockResolvedValueOnce({
        data: { billing_suggester_enabled: true },
        error: null
      });

      // Mock cache miss (first from() call for cache lookup)
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        })
      });

      // Mock AI response
      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({
          cpt: [{ code: '99214', description: 'Office visit', confidence: 0.9, rationale: 'Standard' }],
          hcpcs: [],
          icd10: [{ code: 'J44.1', description: 'COPD with exacerbation', confidence: 0.96, rationale: 'Primary' }]
        }),
        cost: 0.02,
        model: 'claude-haiku-4-5-20250929',
        fromCache: false
      });

      // Mock insert for suggestion storage (second from() call)
      mockSupabaseFrom.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      // Mock upsert for cache storage (third from() call)
      mockSupabaseFrom.mockReturnValueOnce({
        upsert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await suggester.suggestCodes(context);

      expect(result.fromCache).toBe(false);
      expect(result.aiCost).toBe(0.02);
      expect(mockOptimizer.call).toHaveBeenCalled();
    });
  });

  describe('Business Logic', () => {
    it('should flag low confidence suggestions for review', async () => {
      const context: EncounterContext = {
        encounterId: '123e4567-e89b-12d3-a456-426614174000',
        patientId: '123e4567-e89b-12d3-a456-426614174001',
        tenantId: '123e4567-e89b-12d3-a456-426614174002',
        encounterType: 'outpatient',
        encounterStart: '2025-11-15T10:00:00Z'
      };

      mockSupabaseRpc.mockResolvedValue({
        data: {
          billing_suggester_enabled: true,
          billing_suggester_confidence_threshold: 0.85
        },
        error: null
      });

      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        })
      });

      // Low confidence AI response
      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({
          cpt: [{ code: '99213', description: 'Office visit', confidence: 0.70, rationale: 'Uncertain' }],
          hcpcs: [],
          icd10: []
        }),
        cost: 0.01,
        model: 'claude-haiku-4-5-20250929',
        fromCache: false
      });

      mockSupabaseFrom.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await suggester.suggestCodes(context);

      expect(result.requiresReview).toBe(true);
      expect(result.overallConfidence).toBeLessThan(0.85);
    });

    it('should use Claude Haiku model for cost efficiency', async () => {
      const context: EncounterContext = {
        encounterId: '123e4567-e89b-12d3-a456-426614174000',
        patientId: '123e4567-e89b-12d3-a456-426614174001',
        tenantId: '123e4567-e89b-12d3-a456-426614174002',
        encounterType: 'outpatient',
        encounterStart: '2025-11-15T10:00:00Z'
      };

      mockSupabaseRpc.mockResolvedValue({
        data: {
          billing_suggester_enabled: true,
          billing_suggester_model: 'claude-haiku-4-5-20250929'
        },
        error: null
      });

      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        })
      });

      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({ cpt: [], hcpcs: [], icd10: [] }),
        cost: 0.01,
        model: 'claude-haiku-4-5-20250929',
        fromCache: false
      });

      mockSupabaseFrom.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      await suggester.suggestCodes(context);

      expect(mockOptimizer.call).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20250929'
        })
      );
    });

    it('should throw error if skill not enabled for tenant', async () => {
      const context: EncounterContext = {
        encounterId: '123e4567-e89b-12d3-a456-426614174000',
        patientId: '123e4567-e89b-12d3-a456-426614174001',
        tenantId: '123e4567-e89b-12d3-a456-426614174002',
        encounterType: 'outpatient',
        encounterStart: '2025-11-15T10:00:00Z'
      };

      mockSupabaseRpc.mockResolvedValue({
        data: { billing_suggester_enabled: false }, // DISABLED
        error: null
      });

      await expect(suggester.suggestCodes(context)).rejects.toThrow(
        'Billing code suggester is not enabled for this tenant'
      );
    });
  });

  describe('Provider Actions', () => {
    it('should accept suggestions', async () => {
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      const mockSingle = jest.fn().mockResolvedValue({
        data: { suggested_codes: { cpt: [], hcpcs: [], icd10: [] } },
        error: null
      });

      // Mock first from() call - outer update chain
      mockSupabaseFrom.mockReturnValueOnce({
        update: mockUpdate
      });

      // Mock second from() call - inner select query (evaluated when building update object)
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: mockSingle
          })
        })
      });

      await suggester.acceptSuggestion(
        '123e4567-e89b-12d3-a456-426614174000',
        '123e4567-e89b-12d3-a456-426614174001'
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'accepted'
        })
      );
    });

    it('should reject invalid UUIDs for provider actions', async () => {
      await expect(
        suggester.acceptSuggestion('invalid-id', '123e4567-e89b-12d3-a456-426614174000')
      ).rejects.toThrow('Invalid suggestionId');
    });
  });
});
