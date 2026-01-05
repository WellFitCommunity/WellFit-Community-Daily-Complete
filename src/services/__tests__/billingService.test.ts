/**
 * Tests for BillingService
 *
 * Purpose: Comprehensive tests for billing provider, payer, claim, and fee schedule operations
 * Coverage: CRUD operations, fee lookups, X12 generation, batch management, metrics
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock Supabase client with hoisted mocks
vi.mock('../../lib/supabaseClient', () => {
  const mockSingle = vi.fn();
  const mockLimit = vi.fn(() => ({ single: mockSingle, then: (cb: (r: unknown) => void) => cb({ data: [] }) }));
  const mockOrder = vi.fn(() => ({ limit: mockLimit, single: mockSingle, then: (cb: (r: unknown) => void) => cb({ data: [] }) }));
  const mockLte = vi.fn(() => ({ order: mockOrder, limit: mockLimit }));
  const mockGte = vi.fn(() => ({ lte: mockLte, order: mockOrder, limit: mockLimit }));
  const mockIs = vi.fn(() => ({ is: vi.fn(), eq: vi.fn(), single: mockSingle }));
  const mockEq = vi.fn(() => ({ eq: mockEq, is: mockIs, select: vi.fn(), order: mockOrder, single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq, is: mockIs, order: mockOrder, single: mockSingle }));
  const mockInsert = vi.fn(() => ({ select: mockSelect }));
  const mockUpdate = vi.fn(() => ({ eq: mockEq, select: mockSelect }));
  const mockDelete = vi.fn(() => ({ eq: mockEq }));

  return {
    supabase: {
      from: vi.fn(() => ({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      })),
      rpc: vi.fn(),
      functions: {
        invoke: vi.fn(),
      },
    },
  };
});

// Mock pagination utilities
vi.mock('../../utils/pagination', () => ({
  PAGINATION_LIMITS: {
    PROVIDERS: 100,
    CLAIM_LINES: 100,
    FEE_SCHEDULES: 50,
    FEE_SCHEDULE_ITEMS: 1000,
  },
  applyLimit: vi.fn(async (query) => {
    const result = await query;
    return result.data || [];
  }),
}));

// Import after mocks are set up
import { BillingService } from '../billingService';
import { supabase } from '../../lib/supabaseClient';

describe('BillingService', () => {
  let mockFrom: Mock;
  let mockRpc: Mock;
  let mockInvoke: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = supabase.from as Mock;
    mockRpc = supabase.rpc as Mock;
    mockInvoke = supabase.functions.invoke as Mock;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Helper to setup chain mocks for a specific operation
  const setupQueryChain = (finalResult: { data?: unknown; error?: { message: string; code?: string } | null }) => {
    const mockSingle = vi.fn().mockResolvedValue(finalResult);
    const mockLimit = vi.fn().mockReturnValue({ single: mockSingle, order: vi.fn().mockReturnThis(), then: (cb: (r: unknown) => void) => cb(finalResult) });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit, single: mockSingle, then: (cb: (r: unknown) => void) => cb(finalResult) });
    const mockLte = vi.fn().mockReturnValue({ order: mockOrder, limit: mockLimit, then: (cb: (r: unknown) => void) => cb(finalResult) });
    const mockGte = vi.fn().mockReturnValue({ lte: mockLte, order: mockOrder, limit: mockLimit, then: (cb: (r: unknown) => void) => cb(finalResult) });
    const mockIs = vi.fn().mockReturnValue({ is: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockSingle, then: (cb: (r: unknown) => void) => cb(finalResult) });
    const mockEq = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: mockIs,
      select: vi.fn().mockReturnThis(),
      order: mockOrder,
      single: mockSingle,
      gte: mockGte,
      lte: mockLte,
      limit: mockLimit,
      then: (cb: (r: unknown) => void) => cb(finalResult)
    });
    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
      is: mockIs,
      order: mockOrder,
      single: mockSingle,
      gte: mockGte,
      lte: mockLte,
      limit: mockLimit,
      then: (cb: (r: unknown) => void) => cb(finalResult)
    });
    // mockInsert returns object with .select() that returns object with .single()
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mockSingle }),
      then: (cb: (r: unknown) => void) => cb(finalResult), // Also directly awaitable
    });
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
        then: (cb: (r: unknown) => void) => cb(finalResult), // Also directly awaitable
      })
    });
    const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(finalResult) });

    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });

    return { mockSingle, mockSelect, mockInsert, mockUpdate, mockDelete, mockEq, mockOrder };
  };

  // ==========================================
  // Provider CRUD Tests
  // ==========================================
  describe('Provider Operations', () => {
    const mockProvider = {
      id: 'provider-123',
      npi: '1234567890',
      organization_name: 'Test Medical Group',
      tax_id: '12-3456789',
      address_line1: '123 Main St',
      city: 'Houston',
      state: 'TX',
      zip_code: '77001',
      taxonomy_code: '207Q00000X',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    describe('createProvider', () => {
      it('should create a provider successfully', async () => {
        setupQueryChain({ data: mockProvider, error: null });

        const result = await BillingService.createProvider({
          npi: '1234567890',
          organization_name: 'Test Medical Group',
          tax_id: '12-3456789',
          address_line1: '123 Main St',
          city: 'Houston',
          state: 'TX',
          zip_code: '77001',
          taxonomy_code: '207Q00000X',
        });

        expect(result).toEqual(mockProvider);
      });

      it('should throw error when provider creation fails', async () => {
        setupQueryChain({ data: null, error: { message: 'Duplicate NPI' } });

        await expect(
          BillingService.createProvider({
            npi: '1234567890',
            organization_name: 'Test',
            tax_id: '12-3456789',
            address_line1: '123 Main',
            city: 'Houston',
            state: 'TX',
            zip_code: '77001',
            taxonomy_code: '207Q00000X',
          })
        ).rejects.toThrow('Failed to create provider: Duplicate NPI');
      });
    });

    describe('getProvider', () => {
      it('should get a provider by ID', async () => {
        setupQueryChain({ data: mockProvider, error: null });

        const result = await BillingService.getProvider('provider-123');

        expect(result).toEqual(mockProvider);
      });

      it('should throw error when provider not found', async () => {
        setupQueryChain({ data: null, error: { message: 'Not found', code: 'PGRST116' } });

        await expect(BillingService.getProvider('invalid-id')).rejects.toThrow(
          'Failed to get provider: Not found'
        );
      });
    });

    describe('getProviders', () => {
      it('should return list of providers', async () => {
        const providers = [mockProvider, { ...mockProvider, id: 'provider-456' }];
        setupQueryChain({ data: providers, error: null });

        const result = await BillingService.getProviders();

        expect(result).toEqual(providers);
      });
    });

    describe('updateProvider', () => {
      it('should update provider successfully', async () => {
        const updatedProvider = { ...mockProvider, organization_name: 'Updated Name' };
        setupQueryChain({ data: updatedProvider, error: null });

        const result = await BillingService.updateProvider('provider-123', {
          organization_name: 'Updated Name',
        });

        expect(result.organization_name).toBe('Updated Name');
      });

      it('should throw error when update fails', async () => {
        setupQueryChain({ data: null, error: { message: 'Provider not found' } });

        await expect(
          BillingService.updateProvider('invalid-id', { organization_name: 'Test' })
        ).rejects.toThrow('Failed to update provider: Provider not found');
      });
    });

    describe('deleteProvider', () => {
      it('should delete provider successfully', async () => {
        setupQueryChain({ data: null, error: null });

        await expect(BillingService.deleteProvider('provider-123')).resolves.toBeUndefined();
      });

      it('should throw error when delete fails', async () => {
        setupQueryChain({ data: null, error: { message: 'Provider has active claims' } });

        await expect(BillingService.deleteProvider('provider-123')).rejects.toThrow(
          'Failed to delete provider: Provider has active claims'
        );
      });
    });
  });

  // ==========================================
  // Payer CRUD Tests
  // ==========================================
  describe('Payer Operations', () => {
    const mockPayer = {
      id: 'payer-123',
      name: 'Blue Cross Blue Shield',
      payer_id: 'BCBS001',
      type: 'commercial' as const,
      address_line1: '456 Insurance Blvd',
      city: 'Dallas',
      state: 'TX',
      zip_code: '75001',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    describe('createPayer', () => {
      it('should create a payer successfully', async () => {
        setupQueryChain({ data: mockPayer, error: null });

        const result = await BillingService.createPayer({
          name: 'Blue Cross Blue Shield',
          payer_id: 'BCBS001',
          type: 'commercial',
          address_line1: '456 Insurance Blvd',
          city: 'Dallas',
          state: 'TX',
          zip_code: '75001',
        });

        expect(result).toEqual(mockPayer);
      });

      it('should throw error when payer creation fails', async () => {
        setupQueryChain({ data: null, error: { message: 'Duplicate payer ID' } });

        await expect(
          BillingService.createPayer({
            name: 'Test Payer',
            payer_id: 'DUP001',
            type: 'commercial',
            address_line1: '123 St',
            city: 'City',
            state: 'TX',
            zip_code: '75001',
          })
        ).rejects.toThrow('Failed to create payer: Duplicate payer ID');
      });
    });

    describe('getPayers', () => {
      it('should return list of payers', async () => {
        const payers = [mockPayer, { ...mockPayer, id: 'payer-456' }];
        setupQueryChain({ data: payers, error: null });

        const result = await BillingService.getPayers();

        expect(result).toEqual(payers);
      });
    });

    describe('getPayer', () => {
      it('should get a payer by ID', async () => {
        setupQueryChain({ data: mockPayer, error: null });

        const result = await BillingService.getPayer('payer-123');

        expect(result).toEqual(mockPayer);
      });

      it('should throw error when payer not found', async () => {
        setupQueryChain({ data: null, error: { message: 'Not found' } });

        await expect(BillingService.getPayer('invalid-id')).rejects.toThrow(
          'Failed to get payer: Not found'
        );
      });
    });
  });

  // ==========================================
  // Claims Management Tests
  // ==========================================
  describe('Claims Management', () => {
    const mockClaim = {
      id: 'claim-123',
      encounter_id: 'encounter-456',
      patient_id: 'patient-789',
      billing_provider_id: 'provider-123',
      payer_id: 'payer-123',
      status: 'draft' as const,
      total_amount: 150.0,
      service_date: '2024-01-15',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    };

    describe('createClaim', () => {
      it('should create a claim successfully', async () => {
        setupQueryChain({ data: mockClaim, error: null });

        const result = await BillingService.createClaim({
          encounter_id: 'encounter-456',
          patient_id: 'patient-789',
          billing_provider_id: 'provider-123',
          payer_id: 'payer-123',
          status: 'draft',
          total_amount: 150.0,
          service_date: '2024-01-15',
        });

        expect(result).toEqual(mockClaim);
      });

      it('should throw error when claim creation fails', async () => {
        setupQueryChain({ data: null, error: { message: 'Invalid encounter ID' } });

        await expect(
          BillingService.createClaim({
            encounter_id: 'invalid',
            patient_id: 'patient-789',
            billing_provider_id: 'provider-123',
            payer_id: 'payer-123',
            status: 'draft',
            total_amount: 150.0,
            service_date: '2024-01-15',
          })
        ).rejects.toThrow('Failed to create claim: Invalid encounter ID');
      });
    });

    describe('getClaim', () => {
      it('should get a claim by ID', async () => {
        setupQueryChain({ data: mockClaim, error: null });

        const result = await BillingService.getClaim('claim-123');

        expect(result).toEqual(mockClaim);
      });

      it('should throw error when claim not found', async () => {
        setupQueryChain({ data: null, error: { message: 'Claim not found' } });

        await expect(BillingService.getClaim('invalid-id')).rejects.toThrow(
          'Failed to get claim: Claim not found'
        );
      });
    });

    describe('getClaimsByEncounter', () => {
      it('should return claims for an encounter', async () => {
        const claims = [mockClaim, { ...mockClaim, id: 'claim-456' }];
        setupQueryChain({ data: claims, error: null });

        const result = await BillingService.getClaimsByEncounter('encounter-456');

        expect(result).toEqual(claims);
      });
    });

    describe('logClaimStatusChange', () => {
      it('should log status change to history', async () => {
        const historyEntry = {
          id: 'history-123',
          claim_id: 'claim-123',
          from_status: 'draft',
          to_status: 'submitted',
          note: 'Submitted for processing',
          created_at: '2024-01-15T10:00:00Z',
        };

        setupQueryChain({ data: historyEntry, error: null });

        const result = await BillingService.logClaimStatusChange(
          'claim-123',
          'draft',
          'submitted',
          'Submitted for processing'
        );

        expect(result).toEqual(historyEntry);
      });

      it('should log with optional payload', async () => {
        const historyEntry = {
          id: 'history-123',
          claim_id: 'claim-123',
          from_status: 'submitted',
          to_status: 'accepted',
          payload: { clearinghouse_ref: 'CH-001' },
        };

        setupQueryChain({ data: historyEntry, error: null });

        const result = await BillingService.logClaimStatusChange(
          'claim-123',
          'submitted',
          'accepted',
          undefined,
          { clearinghouse_ref: 'CH-001' }
        );

        expect(result).toEqual(historyEntry);
      });

      it('should throw error when logging fails', async () => {
        setupQueryChain({ data: null, error: { message: 'Insert failed' } });

        await expect(
          BillingService.logClaimStatusChange('claim-123', 'draft', 'submitted')
        ).rejects.toThrow('Failed to log status change: Insert failed');
      });
    });
  });

  // ==========================================
  // Claim Lines Tests
  // ==========================================
  describe('Claim Lines', () => {
    const mockClaimLine = {
      id: 'line-123',
      claim_id: 'claim-123',
      position: 1,
      cpt_code: '99213',
      description: 'Office visit - established patient',
      units: 1,
      unit_price: 150.0,
      total_price: 150.0,
      modifiers: ['25'],
      icd10_codes: ['J06.9'],
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    };

    describe('addClaimLine', () => {
      it('should add a claim line successfully', async () => {
        setupQueryChain({ data: mockClaimLine, error: null });

        const result = await BillingService.addClaimLine({
          claim_id: 'claim-123',
          position: 1,
          cpt_code: '99213',
          description: 'Office visit - established patient',
          units: 1,
          unit_price: 150.0,
          total_price: 150.0,
          modifiers: ['25'],
          icd10_codes: ['J06.9'],
        });

        expect(result).toEqual(mockClaimLine);
      });

      it('should throw error when adding claim line fails', async () => {
        setupQueryChain({ data: null, error: { message: 'Invalid CPT code' } });

        await expect(
          BillingService.addClaimLine({
            claim_id: 'claim-123',
            position: 1,
            cpt_code: 'INVALID',
            description: 'Test',
            units: 1,
            unit_price: 100.0,
            total_price: 100.0,
          })
        ).rejects.toThrow('Failed to add claim line: Invalid CPT code');
      });
    });

    describe('getClaimLines', () => {
      it('should return claim lines for a claim', async () => {
        const lines = [mockClaimLine, { ...mockClaimLine, id: 'line-456', position: 2 }];
        setupQueryChain({ data: lines, error: null });

        const result = await BillingService.getClaimLines('claim-123');

        expect(result).toEqual(lines);
      });
    });
  });

  // ==========================================
  // Fee Schedule Tests
  // ==========================================
  describe('Fee Schedules', () => {
    const mockFeeSchedule = {
      id: 'schedule-123',
      name: 'Medicare Fee Schedule 2024',
      payer_id: 'payer-medicare',
      effective_date: '2024-01-01',
      expiration_date: '2024-12-31',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockFeeItem = {
      id: 'item-123',
      fee_schedule_id: 'schedule-123',
      code_system: 'CPT' as const,
      code: '99213',
      description: 'Office visit - established patient',
      price: 89.67,
      modifier1: null,
      modifier2: null,
      modifier3: null,
      modifier4: null,
    };

    describe('getFeeSchedules', () => {
      it('should return list of fee schedules', async () => {
        const schedules = [mockFeeSchedule];
        setupQueryChain({ data: schedules, error: null });

        const result = await BillingService.getFeeSchedules();

        expect(result).toEqual(schedules);
      });
    });

    describe('getFeeScheduleItems', () => {
      it('should return fee schedule items', async () => {
        const items = [mockFeeItem];
        setupQueryChain({ data: items, error: null });

        const result = await BillingService.getFeeScheduleItems('schedule-123');

        expect(result).toEqual(items);
      });
    });

    describe('lookupFee', () => {
      it('should lookup fee for CPT code without modifiers', async () => {
        setupQueryChain({ data: { price: 89.67 }, error: null });

        const result = await BillingService.lookupFee('schedule-123', 'CPT', '99213');

        expect(result).toBe(89.67);
      });

      it('should lookup fee for CPT code with modifiers', async () => {
        setupQueryChain({ data: { price: 112.09 }, error: null });

        const result = await BillingService.lookupFee('schedule-123', 'CPT', '99213', ['25']);

        expect(result).toBe(112.09);
      });

      it('should lookup fee for HCPCS code', async () => {
        setupQueryChain({ data: { price: 45.32 }, error: null });

        const result = await BillingService.lookupFee('schedule-123', 'HCPCS', 'G0101');

        expect(result).toBe(45.32);
      });

      it('should return null when fee not found (no error)', async () => {
        setupQueryChain({ data: null, error: { message: 'Not found', code: 'PGRST116' } });

        const result = await BillingService.lookupFee('schedule-123', 'CPT', '99999');

        expect(result).toBeNull();
      });

      it('should throw error for database failures', async () => {
        setupQueryChain({ data: null, error: { message: 'Connection failed', code: 'CONN_ERR' } });

        await expect(BillingService.lookupFee('schedule-123', 'CPT', '99213')).rejects.toThrow(
          'Failed to lookup fee: Connection failed'
        );
      });
    });
  });

  // ==========================================
  // Coding Recommendations Tests
  // ==========================================
  describe('Coding Recommendations', () => {
    const mockRecommendation = {
      id: 'rec-123',
      encounter_id: 'encounter-456',
      patient_id: 'patient-789',
      payload: {
        cpt_codes: ['99213'],
        icd10_codes: ['J06.9'],
        modifiers: [],
        reasoning: 'Standard office visit for URI',
      },
      confidence: 0.92,
      created_at: '2024-01-15T10:00:00Z',
    };

    describe('saveCodingRecommendation', () => {
      it('should save coding recommendation successfully', async () => {
        setupQueryChain({ data: mockRecommendation, error: null });

        const result = await BillingService.saveCodingRecommendation(
          'encounter-456',
          'patient-789',
          {
            cpt_codes: ['99213'],
            icd10_codes: ['J06.9'],
            modifiers: [],
            reasoning: 'Standard office visit for URI',
          },
          0.92
        );

        expect(result).toEqual(mockRecommendation);
      });

      it('should save recommendation with null patient_id', async () => {
        const recWithNullPatient = { ...mockRecommendation, patient_id: null };
        setupQueryChain({ data: recWithNullPatient, error: null });

        const result = await BillingService.saveCodingRecommendation(
          'encounter-456',
          null,
          { cpt_codes: ['99213'], icd10_codes: ['J06.9'] },
          0.85
        );

        expect(result.patient_id).toBeNull();
      });

      it('should throw error when save fails', async () => {
        setupQueryChain({ data: null, error: { message: 'Invalid encounter' } });

        await expect(
          BillingService.saveCodingRecommendation('invalid', null, { cpt_codes: [] })
        ).rejects.toThrow('Failed to save coding recommendation: Invalid encounter');
      });
    });

    describe('getCodingRecommendations', () => {
      it('should return recommendations for an encounter', async () => {
        const recs = [mockRecommendation];
        setupQueryChain({ data: recs, error: null });

        const result = await BillingService.getCodingRecommendations('encounter-456');

        expect(result).toEqual(recs);
      });
    });
  });

  // ==========================================
  // X12 Generation Tests
  // ==========================================
  describe('X12 Generation', () => {
    describe('generateX12Claim', () => {
      const mockX12 = 'ISA*00*          *00*          *ZZ*SENDER...';

      it('should generate X12 claim as string response', async () => {
        mockInvoke.mockResolvedValue({ data: mockX12, error: null });

        const result = await BillingService.generateX12Claim('encounter-456', 'provider-123');

        expect(result).toBe(mockX12);
        expect(mockInvoke).toHaveBeenCalledWith('generate-837p', {
          body: { encounterId: 'encounter-456', billingProviderId: 'provider-123' },
        });
      });

      it('should generate X12 claim from object response with x12 field', async () => {
        mockInvoke.mockResolvedValue({ data: { x12: mockX12 }, error: null });

        const result = await BillingService.generateX12Claim('encounter-456', 'provider-123');

        expect(result).toBe(mockX12);
      });

      it('should throw error for invalid response format', async () => {
        mockInvoke.mockResolvedValue({ data: { invalid: 'response' }, error: null });

        await expect(
          BillingService.generateX12Claim('encounter-456', 'provider-123')
        ).rejects.toThrow('Invalid X12 response format');
      });

      it('should throw error when edge function fails', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: { message: 'Function timeout' } });

        await expect(
          BillingService.generateX12Claim('encounter-456', 'provider-123')
        ).rejects.toThrow('Failed to generate X12 claim: Function timeout');
      });
    });
  });

  // ==========================================
  // Coding Suggestions Tests
  // ==========================================
  describe('Coding Suggestions', () => {
    describe('getCodingSuggestions', () => {
      const mockSuggestion = {
        cpt_codes: ['99214'],
        icd10_codes: ['M54.5', 'G89.29'],
        modifiers: ['25'],
        reasoning: 'Extended visit with chronic pain management',
        confidence: 0.88,
      };

      it('should get coding suggestions from edge function', async () => {
        mockInvoke.mockResolvedValue({ data: mockSuggestion, error: null });

        const result = await BillingService.getCodingSuggestions('encounter-456');

        expect(result).toEqual(mockSuggestion);
        expect(mockInvoke).toHaveBeenCalledWith('coding-suggest', {
          body: { encounter: { id: 'encounter-456' } },
        });
      });

      it('should throw error when coding suggestions fail', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: { message: 'AI service unavailable' } });

        await expect(BillingService.getCodingSuggestions('encounter-456')).rejects.toThrow(
          'Failed to get coding suggestions: AI service unavailable'
        );
      });
    });
  });

  // ==========================================
  // Clearinghouse Batch Tests
  // ==========================================
  describe('Clearinghouse Batches', () => {
    const mockBatch = {
      id: 'batch-123',
      batch_ref: 'BATCH-2024-001',
      status: 'created' as const,
      created_at: '2024-01-15T10:00:00Z',
    };

    describe('createBatch', () => {
      it('should create a batch successfully', async () => {
        setupQueryChain({ data: mockBatch, error: null });

        const result = await BillingService.createBatch('BATCH-2024-001');

        expect(result).toEqual(mockBatch);
      });

      it('should throw error when batch creation fails', async () => {
        setupQueryChain({ data: null, error: { message: 'Duplicate batch ref' } });

        await expect(BillingService.createBatch('BATCH-2024-001')).rejects.toThrow(
          'Failed to create batch: Duplicate batch ref'
        );
      });
    });

    describe('addClaimToBatch', () => {
      it('should add claim to batch successfully', async () => {
        mockFrom.mockReturnValue({
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        });

        await expect(
          BillingService.addClaimToBatch('batch-123', 'claim-456', 'ST001')
        ).resolves.toBeUndefined();
      });

      it('should add claim without ST control number', async () => {
        mockFrom.mockReturnValue({
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        });

        await expect(BillingService.addClaimToBatch('batch-123', 'claim-456')).resolves.toBeUndefined();
      });

      it('should throw error when adding claim fails', async () => {
        mockFrom.mockReturnValue({
          insert: vi.fn().mockResolvedValue({ data: null, error: { message: 'Claim already in batch' } }),
        });

        await expect(
          BillingService.addClaimToBatch('batch-123', 'claim-456')
        ).rejects.toThrow('Failed to add claim to batch: Claim already in batch');
      });
    });

    describe('updateBatchStatus', () => {
      it('should update batch status successfully', async () => {
        mockFrom.mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        });

        await expect(
          BillingService.updateBatchStatus('batch-123', 'submitted')
        ).resolves.toBeUndefined();
      });

      it('should throw error when status update fails', async () => {
        mockFrom.mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Invalid status transition' } }),
          }),
        });

        await expect(
          BillingService.updateBatchStatus('batch-123', 'completed')
        ).rejects.toThrow('Failed to update batch status: Invalid status transition');
      });
    });
  });

  // ==========================================
  // Claim Metrics Tests
  // ==========================================
  describe('Claim Metrics', () => {
    describe('getClaimMetrics', () => {
      it('should return aggregated claim metrics', async () => {
        const rpcResult = [
          { status: 'draft', count: 10, total_amount: 1500.0 },
          { status: 'submitted', count: 25, total_amount: 5000.0 },
          { status: 'accepted', count: 50, total_amount: 12500.0 },
          { status: 'rejected', count: 5, total_amount: 750.0 },
        ];

        mockRpc.mockResolvedValue({ data: rpcResult, error: null });

        const result = await BillingService.getClaimMetrics();

        expect(result.total).toBe(90);
        expect(result.totalAmount).toBe(19750.0);
        expect(result.byStatus.draft).toBe(10);
        expect(result.byStatus.submitted).toBe(25);
        expect(result.byStatus.accepted).toBe(50);
        expect(result.byStatus.rejected).toBe(5);
      });

      it('should filter metrics by provider ID', async () => {
        mockRpc.mockResolvedValue({
          data: [{ status: 'submitted', count: 15, total_amount: 3000.0 }],
          error: null,
        });

        const result = await BillingService.getClaimMetrics('provider-123');

        expect(mockRpc).toHaveBeenCalledWith('get_claim_metrics', { p_provider_id: 'provider-123' });
        expect(result.total).toBe(15);
      });

      it('should return empty metrics when no data', async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });

        const result = await BillingService.getClaimMetrics();

        expect(result.total).toBe(0);
        expect(result.totalAmount).toBe(0);
        expect(Object.keys(result.byStatus)).toHaveLength(0);
      });

      it('should throw error when RPC fails', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC function not found' } });

        await expect(BillingService.getClaimMetrics()).rejects.toThrow(
          'Failed to get claim metrics: RPC function not found'
        );
      });
    });
  });

  // ==========================================
  // Search Claims Tests
  // ==========================================
  describe('Search Claims', () => {
    const mockClaims = [
      {
        id: 'claim-1',
        status: 'submitted',
        total_amount: 150.0,
        created_at: '2024-01-15T10:00:00Z',
      },
      {
        id: 'claim-2',
        status: 'submitted',
        total_amount: 200.0,
        created_at: '2024-01-14T10:00:00Z',
      },
    ];

    describe('searchClaims', () => {
      it('should search claims without filters', async () => {
        setupQueryChain({ data: mockClaims, error: null });

        const result = await BillingService.searchClaims({});

        expect(result).toEqual(mockClaims);
      });

      it('should search claims by status', async () => {
        setupQueryChain({ data: mockClaims, error: null });

        const result = await BillingService.searchClaims({ status: 'submitted' });

        expect(result).toEqual(mockClaims);
      });

      it('should search claims by provider ID', async () => {
        setupQueryChain({ data: [mockClaims[0]], error: null });

        const result = await BillingService.searchClaims({ providerId: 'provider-123' });

        expect(result).toHaveLength(1);
      });

      it('should search claims by payer ID', async () => {
        setupQueryChain({ data: mockClaims, error: null });

        const result = await BillingService.searchClaims({ payerId: 'payer-123' });

        expect(result).toEqual(mockClaims);
      });

      it('should search claims by date range', async () => {
        // Setup complete mock chain for date range queries
        const finalResult = { data: mockClaims, error: null };
        const chainObj = {
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue(finalResult),
        };
        mockFrom.mockReturnValue({
          select: vi.fn().mockReturnValue(chainObj),
        });

        const result = await BillingService.searchClaims({
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        });

        expect(result).toEqual(mockClaims);
      });

      it('should search claims with limit', async () => {
        // Setup complete mock chain for limit queries
        const finalResult = { data: [mockClaims[0]], error: null };
        const chainObj = {
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue(finalResult),
        };
        mockFrom.mockReturnValue({
          select: vi.fn().mockReturnValue(chainObj),
        });

        const result = await BillingService.searchClaims({ limit: 1 });

        expect(result).toHaveLength(1);
      });

      it('should search claims with all filters combined', async () => {
        // Setup complete mock chain for combined filters
        const finalResult = { data: mockClaims, error: null };
        const chainObj = {
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue(finalResult),
        };
        mockFrom.mockReturnValue({
          select: vi.fn().mockReturnValue(chainObj),
        });

        const result = await BillingService.searchClaims({
          status: 'submitted',
          providerId: 'provider-123',
          payerId: 'payer-123',
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
          limit: 50,
        });

        expect(result).toEqual(mockClaims);
      });

      it('should return empty array when no claims match', async () => {
        setupQueryChain({ data: [], error: null });

        const result = await BillingService.searchClaims({ status: 'rejected' });

        expect(result).toEqual([]);
      });

      it('should throw error when search fails', async () => {
        setupQueryChain({ data: null, error: { message: 'Query timeout' } });

        await expect(BillingService.searchClaims({ status: 'submitted' })).rejects.toThrow(
          'Failed to search claims: Query timeout'
        );
      });
    });
  });
});
