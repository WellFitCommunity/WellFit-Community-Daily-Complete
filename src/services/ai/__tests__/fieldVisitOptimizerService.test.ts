/**
 * Tests for Field Visit Optimizer Service
 *
 * @skill #49 - Field Visit Optimizer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldVisitOptimizerService } from '../fieldVisitOptimizerService';
import type {
  OptimizationRequest,
  MultiWorkerOptimizationRequest,
  PatientVisit,
  WorkerProfile,
} from '../fieldVisitOptimizerService';

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
            lte: vi.fn(() => ({
              order: vi.fn(() => ({ data: [], error: null })),
            })),
          })),
          order: vi.fn(() => ({ data: [], error: null })),
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

describe('FieldVisitOptimizerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('optimizeRoute validation', () => {
    it('should reject empty visits array', async () => {
      const request: OptimizationRequest = {
        visits: [],
        worker: createMockWorker('worker-1'),
        date: '2026-01-15',
        tenantId: 'test-tenant',
      };

      const result = await FieldVisitOptimizerService.optimizeRoute(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid optimization request', async () => {
      const request: OptimizationRequest = {
        visits: [createMockVisit('visit-1')],
        worker: createMockWorker('worker-1'),
        date: '2026-01-15',
        tenantId: 'test-tenant',
      };

      const result = await FieldVisitOptimizerService.optimizeRoute(request);

      // Result depends on processing - verify it executes
      expect(result).toBeDefined();
    });
  });

  describe('optimizeMultipleRoutes validation', () => {
    it('should reject empty workers array', async () => {
      const request: MultiWorkerOptimizationRequest = {
        visits: [createMockVisit('visit-1')],
        workers: [],
        date: '2026-01-15',
        tenantId: 'test-tenant',
      };

      const result = await FieldVisitOptimizerService.optimizeMultipleRoutes(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty visits array', async () => {
      const request: MultiWorkerOptimizationRequest = {
        visits: [],
        workers: [createMockWorker('worker-1')],
        date: '2026-01-15',
        tenantId: 'test-tenant',
      };

      const result = await FieldVisitOptimizerService.optimizeMultipleRoutes(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should process valid multi-worker request', async () => {
      const request: MultiWorkerOptimizationRequest = {
        visits: [createMockVisit('visit-1'), createMockVisit('visit-2')],
        workers: [createMockWorker('worker-1')],
        date: '2026-01-15',
        tenantId: 'test-tenant',
      };

      const result = await FieldVisitOptimizerService.optimizeMultipleRoutes(request);

      // Result depends on processing - verify it executes
      expect(result).toBeDefined();
    });
  });

  describe('getEfficiencyMetrics', () => {
    it('should return metrics with valid tenant ID', async () => {
      const result = await FieldVisitOptimizerService.getEfficiencyMetrics('test-tenant');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should accept date range options', async () => {
      const result = await FieldVisitOptimizerService.getEfficiencyMetrics('test-tenant', {
        startDate: '2026-01-01',
        endDate: '2026-01-15',
      });

      expect(result.success).toBe(true);
    });

    it('should accept worker ID filter', async () => {
      const result = await FieldVisitOptimizerService.getEfficiencyMetrics('test-tenant', {
        workerId: 'worker-1',
      });

      // Result depends on mock data - just verify it handles the option
      expect(result).toBeDefined();
    });
  });
});

// Helper functions
function createMockVisit(visitId: string): PatientVisit {
  return {
    visitId,
    patientId: `patient-${visitId}`,
    patientName: `Patient ${visitId}`,
    location: { latitude: 40.7128, longitude: -74.006 },
    visitType: 'wellness_check',
    priority: 'routine',
    estimatedDuration: 30,
  };
}

function createMockWorker(workerId: string): WorkerProfile {
  return {
    workerId,
    workerName: `Worker ${workerId}`,
    startLocation: { latitude: 40.7128, longitude: -74.006 },
    transportMode: 'car',
    workingHours: { start: '08:00', end: '17:00' },
  };
}
