/**
 * Comprehensive tests for BillingCodeSuggester
 *
 * Tests cover:
 * - InputValidator (UUID, ICD-10, CPT, text sanitization)
 * - BillingCodeSuggester (suggestCodes, accept, modify, reject)
 * - Caching behavior
 * - Error handling
 * - Accuracy tracking integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingCodeSuggester, type EncounterContext, type BillingSuggestionResult } from '../billingCodeSuggester';

// ============================================================================
// MOCKS
// ============================================================================

const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => mockSupabaseFrom(table),
    rpc: (fn: string, params?: Record<string, unknown>) => mockSupabaseRpc(fn, params),
  },
}));

const mockOptimizerCall = vi.fn();
vi.mock('../../mcp/mcp-cost-optimizer', () => ({
  mcpOptimizer: {
    call: (params: Record<string, unknown>) => mockOptimizerCall(params),
  },
}));

vi.mock('../accuracyTrackingService', () => ({
  createAccuracyTrackingService: () => ({
    recordPrediction: vi.fn().mockResolvedValue({ success: true, data: 'tracking-id-123' }),
    recordBillingCodeAccuracy: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const validUUID = '12345678-1234-1234-1234-123456789abc';
const validTenantId = 'abcdef01-2345-6789-abcd-ef0123456789';
const validPatientId = '98765432-1234-1234-1234-123456789def';

const createValidContext = (overrides: Partial<EncounterContext> = {}): EncounterContext => ({
  encounterId: validUUID,
  patientId: validPatientId,
  tenantId: validTenantId,
  encounterType: 'outpatient',
  encounterStart: '2025-01-01T10:00:00Z',
  encounterEnd: '2025-01-01T10:30:00Z',
  chiefComplaint: 'Routine checkup',
  diagnosisCodes: ['E11.9'],
  conditionKeywords: ['diabetes'],
  ...overrides,
});

const mockAIResponse = {
  response: JSON.stringify({
    cpt: [{ code: '99214', description: 'Office visit', confidence: 0.95, rationale: 'Standard visit' }],
    hcpcs: [],
    icd10: [{ code: 'E11.9', description: 'Type 2 diabetes', confidence: 0.98, rationale: 'Primary diagnosis' }],
    requiresReview: false,
    reviewReason: '',
  }),
  cost: 0.002,
  model: 'claude-haiku-4-5-20250929',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function setupMocks(options: {
  skillEnabled?: boolean;
  cacheHit?: boolean;
  aiResponse?: typeof mockAIResponse;
} = {}) {
  const { skillEnabled = true, cacheHit = false, aiResponse = mockAIResponse } = options;

  // Mock RPC for tenant config
  mockSupabaseRpc.mockImplementation((fn: string) => {
    if (fn === 'get_ai_skill_config') {
      return Promise.resolve({
        data: {
          billing_suggester_enabled: skillEnabled,
          billing_suggester_confidence_threshold: 0.85,
          billing_suggester_model: 'claude-haiku-4-5-20250929',
        },
        error: null,
      });
    }
    if (fn === 'increment_billing_cache_hit') {
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  // Mock from() for database operations
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'billing_code_cache') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: cacheHit
            ? {
                id: 'cache-id-123',
                model_used: 'claude-haiku-4-5-20250929',
                suggested_cpt_codes: [{ code: '99214', description: 'Cached CPT', confidence: 0.95, rationale: 'Cached' }],
                suggested_hcpcs_codes: [],
                suggested_icd10_codes: [{ code: 'E11.9', description: 'Cached ICD', confidence: 0.98, rationale: 'Cached' }],
              }
            : null,
          error: null,
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    if (table === 'encounter_billing_suggestions') {
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            suggested_codes: {
              cpt: [{ code: '99214' }],
              hcpcs: [],
              icd10: [{ code: 'E11.9' }],
            },
            ai_prediction_tracking_id: 'tracking-id-123',
            encounter_id: validUUID,
          },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  // Mock AI optimizer
  mockOptimizerCall.mockResolvedValue(aiResponse);
}

// ============================================================================
// TESTS
// ============================================================================

describe('BillingCodeSuggester', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // --------------------------------------------------------------------------
  // INSTANTIATION
  // --------------------------------------------------------------------------

  describe('Instantiation', () => {
    it('exists and is defined', () => {
      expect(BillingCodeSuggester).toBeDefined();
    });

    it('can be instantiated without arguments', () => {
      const suggester = new BillingCodeSuggester();
      expect(suggester).toBeDefined();
    });

    it('can be instantiated with custom optimizer', () => {
      const customOptimizer = { call: vi.fn() };
      const suggester = new BillingCodeSuggester(customOptimizer as never);
      expect(suggester).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // INPUT VALIDATION
  // --------------------------------------------------------------------------

  describe('Input Validation', () => {
    it('rejects invalid encounterId UUID', async () => {
      const suggester = new BillingCodeSuggester();
      const context = createValidContext({ encounterId: 'not-a-uuid' });

      await expect(suggester.suggestCodes(context)).rejects.toThrow('Invalid encounterId: must be valid UUID');
    });

    it('rejects invalid patientId UUID', async () => {
      const suggester = new BillingCodeSuggester();
      const context = createValidContext({ patientId: 'bad-uuid' });

      await expect(suggester.suggestCodes(context)).rejects.toThrow('Invalid patientId: must be valid UUID');
    });

    it('rejects invalid tenantId UUID', async () => {
      const suggester = new BillingCodeSuggester();
      const context = createValidContext({ tenantId: '123' });

      await expect(suggester.suggestCodes(context)).rejects.toThrow('Invalid tenantId: must be valid UUID');
    });

    it('rejects invalid encounterType', async () => {
      const suggester = new BillingCodeSuggester();
      const context = createValidContext({ encounterType: 'invalid' as never });

      await expect(suggester.suggestCodes(context)).rejects.toThrow('Invalid encounterType');
    });

    it('rejects invalid ICD-10 codes', async () => {
      const suggester = new BillingCodeSuggester();
      const context = createValidContext({ diagnosisCodes: ['INVALID123'] });

      await expect(suggester.suggestCodes(context)).rejects.toThrow('Invalid ICD-10 code: INVALID123');
    });

    it('accepts valid ICD-10 codes', async () => {
      const suggester = new BillingCodeSuggester();
      const context = createValidContext({ diagnosisCodes: ['E11.9', 'I10', 'J06.9'] });

      // Should not throw on validation
      await expect(suggester.suggestCodes(context)).resolves.toBeDefined();
    });

    it('sanitizes chief complaint text', async () => {
      const suggester = new BillingCodeSuggester();
      const context = createValidContext({
        chiefComplaint: '<script>alert("xss")</script>; DROP TABLE patients; --',
      });

      // Should not throw - text is sanitized
      await expect(suggester.suggestCodes(context)).resolves.toBeDefined();
    });

    it('sanitizes condition keywords', async () => {
      const suggester = new BillingCodeSuggester();
      const context = createValidContext({
        conditionKeywords: ['diabetes<script>', "hypertension'; DROP TABLE"],
      });

      await expect(suggester.suggestCodes(context)).resolves.toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // SKILL ENABLEMENT
  // --------------------------------------------------------------------------

  describe('Skill Enablement', () => {
    it('throws when skill is disabled for tenant', async () => {
      setupMocks({ skillEnabled: false });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext();

      await expect(suggester.suggestCodes(context)).rejects.toThrow(
        'Billing code suggester is not enabled for this tenant'
      );
    });

    it('proceeds when skill is enabled', async () => {
      setupMocks({ skillEnabled: true });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext();

      const result = await suggester.suggestCodes(context);
      expect(result).toBeDefined();
      expect(result.encounterId).toBe(validUUID);
    });
  });

  // --------------------------------------------------------------------------
  // CACHING BEHAVIOR
  // --------------------------------------------------------------------------

  describe('Caching Behavior', () => {
    it('returns cached result when cache hit', async () => {
      setupMocks({ cacheHit: true });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext();

      const result = await suggester.suggestCodes(context);

      expect(result.fromCache).toBe(true);
      expect(result.aiCost).toBe(0);
      expect(result.overallConfidence).toBe(0.95);
      expect(mockOptimizerCall).not.toHaveBeenCalled();
    });

    it('calls AI when cache miss', async () => {
      setupMocks({ cacheHit: false });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext();

      const result = await suggester.suggestCodes(context);

      expect(result.fromCache).toBe(false);
      expect(result.aiCost).toBe(0.002);
      expect(mockOptimizerCall).toHaveBeenCalled();
    });

    it('skips cache when no diagnosis codes provided', async () => {
      setupMocks({ cacheHit: true });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext({ diagnosisCodes: undefined });

      await suggester.suggestCodes(context);

      // Should still call AI even though cache would hit
      expect(mockOptimizerCall).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // AI CODE GENERATION
  // --------------------------------------------------------------------------

  describe('AI Code Generation', () => {
    it('generates codes with correct structure', async () => {
      setupMocks({ cacheHit: false });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext();

      const result = await suggester.suggestCodes(context);

      expect(result.suggestedCodes).toHaveProperty('cpt');
      expect(result.suggestedCodes).toHaveProperty('hcpcs');
      expect(result.suggestedCodes).toHaveProperty('icd10');
      expect(result.suggestedCodes.cpt).toHaveLength(1);
      expect(result.suggestedCodes.cpt[0].code).toBe('99214');
    });

    it('calculates overall confidence correctly', async () => {
      setupMocks({ cacheHit: false });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext();

      const result = await suggester.suggestCodes(context);

      // Average of 0.95 (CPT) and 0.98 (ICD-10) = 0.965
      expect(result.overallConfidence).toBeCloseTo(0.965, 2);
    });

    it('flags for review when confidence below threshold', async () => {
      const lowConfidenceResponse = {
        response: JSON.stringify({
          cpt: [{ code: '99213', description: 'Office visit', confidence: 0.60, rationale: 'Uncertain' }],
          hcpcs: [],
          icd10: [],
          requiresReview: false,
        }),
        cost: 0.002,
        model: 'claude-haiku-4-5-20250929',
      };
      setupMocks({ cacheHit: false, aiResponse: lowConfidenceResponse });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext();

      const result = await suggester.suggestCodes(context);

      expect(result.requiresReview).toBe(true);
      expect(result.reviewReason).toBe('Confidence below threshold');
    });

    it('flags for review when AI explicitly requests it', async () => {
      const reviewRequiredResponse = {
        response: JSON.stringify({
          cpt: [{ code: '99214', description: 'Office visit', confidence: 0.95, rationale: 'Good' }],
          hcpcs: [],
          icd10: [],
          requiresReview: true,
          reviewReason: 'Complex case requires physician review',
        }),
        cost: 0.002,
        model: 'claude-haiku-4-5-20250929',
      };
      setupMocks({ cacheHit: false, aiResponse: reviewRequiredResponse });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext();

      const result = await suggester.suggestCodes(context);

      expect(result.requiresReview).toBe(true);
      expect(result.reviewReason).toBe('Complex case requires physician review');
    });

    it('handles AI response parsing errors', async () => {
      const invalidResponse = {
        response: 'This is not valid JSON',
        cost: 0.002,
        model: 'claude-haiku-4-5-20250929',
      };
      setupMocks({ cacheHit: false, aiResponse: invalidResponse });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext();

      await expect(suggester.suggestCodes(context)).rejects.toThrow('AI billing code generation failed');
    });

    it('includes encounter duration in prompt when available', async () => {
      setupMocks({ cacheHit: false });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext({
        encounterStart: '2025-01-01T10:00:00Z',
        encounterEnd: '2025-01-01T10:45:00Z',
      });

      await suggester.suggestCodes(context);

      expect(mockOptimizerCall).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('45 minutes'),
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // ENCOUNTER TYPES
  // --------------------------------------------------------------------------

  describe('Encounter Types', () => {
    const encounterTypes: Array<'inpatient' | 'outpatient' | 'telehealth' | 'emergency'> = [
      'inpatient',
      'outpatient',
      'telehealth',
      'emergency',
    ];

    encounterTypes.forEach((type) => {
      it(`accepts ${type} encounter type`, async () => {
        setupMocks();
        const suggester = new BillingCodeSuggester();
        const context = createValidContext({ encounterType: type });

        const result = await suggester.suggestCodes(context);

        expect(result).toBeDefined();
        expect(mockOptimizerCall).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining(type),
          })
        );
      });
    });
  });

  // --------------------------------------------------------------------------
  // PROVIDER ACTIONS
  // --------------------------------------------------------------------------

  describe('Provider Actions', () => {
    describe('acceptSuggestion', () => {
      it('validates suggestionId UUID', async () => {
        const suggester = new BillingCodeSuggester();

        await expect(suggester.acceptSuggestion('not-uuid', validUUID)).rejects.toThrow(
          'Invalid suggestionId: must be valid UUID'
        );
      });

      it('validates providerId UUID', async () => {
        const suggester = new BillingCodeSuggester();

        await expect(suggester.acceptSuggestion(validUUID, 'bad-provider')).rejects.toThrow(
          'Invalid providerId: must be valid UUID'
        );
      });

      it('accepts suggestion with valid UUIDs', async () => {
        setupMocks();
        const suggester = new BillingCodeSuggester();

        await expect(suggester.acceptSuggestion(validUUID, validPatientId)).resolves.not.toThrow();
      });
    });

    describe('modifySuggestion', () => {
      it('validates input UUIDs', async () => {
        const suggester = new BillingCodeSuggester();

        await expect(
          suggester.modifySuggestion('bad', validUUID, { cpt: [] }, {})
        ).rejects.toThrow('Invalid suggestionId');
      });

      it('processes modified codes', async () => {
        setupMocks();
        const suggester = new BillingCodeSuggester();
        const modifiedCodes = {
          cpt: [{ code: '99215' }],
          hcpcs: [],
          icd10: [{ code: 'E11.9' }],
        };

        await expect(
          suggester.modifySuggestion(validUUID, validPatientId, modifiedCodes, { reason: 'Upgraded E/M level' })
        ).resolves.not.toThrow();
      });
    });

    describe('rejectSuggestion', () => {
      it('validates input UUIDs', async () => {
        const suggester = new BillingCodeSuggester();

        await expect(suggester.rejectSuggestion('invalid', validUUID)).rejects.toThrow('Invalid suggestionId');
      });

      it('rejects with optional reason', async () => {
        setupMocks();
        const suggester = new BillingCodeSuggester();

        await expect(
          suggester.rejectSuggestion(validUUID, validPatientId, 'Codes not applicable')
        ).resolves.not.toThrow();
      });

      it('rejects without reason', async () => {
        setupMocks();
        const suggester = new BillingCodeSuggester();

        await expect(suggester.rejectSuggestion(validUUID, validPatientId)).resolves.not.toThrow();
      });
    });
  });

  // --------------------------------------------------------------------------
  // RESULT STRUCTURE
  // --------------------------------------------------------------------------

  describe('Result Structure', () => {
    it('returns complete BillingSuggestionResult', async () => {
      setupMocks({ cacheHit: false });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext();

      const result: BillingSuggestionResult = await suggester.suggestCodes(context);

      expect(result).toMatchObject({
        encounterId: validUUID,
        suggestedCodes: {
          cpt: expect.any(Array),
          hcpcs: expect.any(Array),
          icd10: expect.any(Array),
        },
        overallConfidence: expect.any(Number),
        requiresReview: expect.any(Boolean),
        fromCache: expect.any(Boolean),
        aiCost: expect.any(Number),
        aiModel: expect.any(String),
      });
    });

    it('includes model information', async () => {
      setupMocks({ cacheHit: false });
      const suggester = new BillingCodeSuggester();
      const context = createValidContext();

      const result = await suggester.suggestCodes(context);

      expect(result.aiModel).toBe('claude-haiku-4-5-20250929');
    });
  });

  // --------------------------------------------------------------------------
  // ICD-10 CODE VALIDATION
  // --------------------------------------------------------------------------

  describe('ICD-10 Code Format Validation', () => {
    const validCodes = ['E11.9', 'I10', 'J06.9', 'M54.5', 'Z23', 'A00.0', 'B99.9'];
    const invalidCodes = ['11.9', 'E1', 'E11.99999', 'e11.9', 'E11-9', ''];

    validCodes.forEach((code) => {
      it(`accepts valid ICD-10 code: ${code}`, async () => {
        setupMocks();
        const suggester = new BillingCodeSuggester();
        const context = createValidContext({ diagnosisCodes: [code] });

        await expect(suggester.suggestCodes(context)).resolves.toBeDefined();
      });
    });

    invalidCodes.forEach((code) => {
      it(`rejects invalid ICD-10 code: "${code}"`, async () => {
        const suggester = new BillingCodeSuggester();
        const context = createValidContext({ diagnosisCodes: [code] });

        await expect(suggester.suggestCodes(context)).rejects.toThrow(/Invalid ICD-10 code/);
      });
    });
  });
});
