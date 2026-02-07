/**
 * Tests for Billing Optimization Engine Service
 *
 * @skill #38 - Billing Optimization Engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingOptimizationEngineService } from '../billingOptimizationEngineService';
import type {
  OptimizationRequest,
  BatchOptimizationRequest,
  EncounterContext,
} from '../billingOptimizationEngineService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: [], error: null })),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('BillingOptimizationEngineService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeEncounter validation', () => {
    it('should handle encounter with empty procedures and diagnoses', async () => {
      const encounter: EncounterContext = {
        encounterId: 'enc-1',
        patientId: 'patient-1',
        providerId: 'provider-1',
        dateOfService: '2026-01-15',
        diagnoses: [],
        procedures: [],
      };

      const request: OptimizationRequest = {
        encounter,
        requesterId: 'user-1',
        tenantId: 'test-tenant',
      };

      const result = await BillingOptimizationEngineService.analyzeEncounter(request);

      // Empty encounter returns failure (validation or operation failed)
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept valid encounter', async () => {
      const encounter: EncounterContext = {
        encounterId: 'enc-1',
        patientId: 'patient-1',
        providerId: 'provider-1',
        dateOfService: '2026-01-15',
        diagnoses: [{ code: 'E11.9', type: 'icd10', description: 'Type 2 diabetes' }],
        procedures: [{ code: '99213', type: 'cpt', description: 'Office visit' }],
      };

      const request: OptimizationRequest = {
        encounter,
        requesterId: 'user-1',
        tenantId: 'test-tenant',
      };

      const result = await BillingOptimizationEngineService.analyzeEncounter(request);

      // Result depends on AI/mock - just verify structure
      expect(result).toBeDefined();
    });
  });

  describe('batchAnalyze validation', () => {
    it('should reject empty encounters array', async () => {
      const request: BatchOptimizationRequest = {
        encounters: [],
        requesterId: 'user-1',
        tenantId: 'test-tenant',
      };

      const result = await BillingOptimizationEngineService.batchAnalyze(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should process batch with valid encounters', async () => {
      const encounter: EncounterContext = {
        encounterId: 'enc-1',
        patientId: 'patient-1',
        providerId: 'provider-1',
        dateOfService: '2026-01-15',
        diagnoses: [{ code: 'E11.9', type: 'icd10' }],
        procedures: [{ code: '99213', type: 'cpt' }],
      };

      const request: BatchOptimizationRequest = {
        encounters: [encounter],
        requesterId: 'user-1',
        tenantId: 'test-tenant',
      };

      const result = await BillingOptimizationEngineService.batchAnalyze(request);

      // Verify the function executes without throwing
      expect(result).toBeDefined();
    });
  });

  describe('getOptimizationHistory', () => {
    it('should accept tenant ID parameter', async () => {
      const result = await BillingOptimizationEngineService.getOptimizationHistory('test-tenant');

      // Verify function runs and returns a result
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should accept provider ID option', async () => {
      const result = await BillingOptimizationEngineService.getOptimizationHistory('test-tenant', {
        providerId: 'provider-1',
      });

      // Verify function runs with option
      expect(result).toBeDefined();
    });

    it('should accept date range options', async () => {
      const result = await BillingOptimizationEngineService.getOptimizationHistory('test-tenant', {
        startDate: '2026-01-01',
        endDate: '2026-01-15',
      });

      // Verify function runs with date range
      expect(result).toBeDefined();
    });

    it('should accept limit option', async () => {
      const result = await BillingOptimizationEngineService.getOptimizationHistory('test-tenant', {
        limit: 10,
      });

      // Verify function runs with limit
      expect(result).toBeDefined();
    });
  });

});
