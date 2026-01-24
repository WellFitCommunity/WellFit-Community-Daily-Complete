/**
 * Tests for Batch Inference Service
 */

import { BatchInferenceService, batchInference } from '../batchInference';
import type { InferenceType, InferencePriority } from '../batchInference';

// Mock supabaseClient
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// Mock MCP optimizer
vi.mock('../../mcp/mcp-cost-optimizer', () => ({
  mcpOptimizer: {
    call: vi.fn().mockResolvedValue({
      response: JSON.stringify([
        { index: 0, risk_score: 0.75, risk_level: 'high', factors: ['age', 'history'] },
      ]),
      fromCache: false,
      cost: 0.003,
      model: 'claude-sonnet-4-5-20250929',
    }),
    getMetrics: vi.fn().mockReturnValue({
      totalCalls: 100,
      cachedCalls: 30,
      totalCost: 0.50,
      savedCost: 0.15,
      haikuCalls: 60,
      sonnetCalls: 40,
    }),
    getCacheHitRate: vi.fn().mockReturnValue(30),
  },
  MCPCostOptimizer: {
    getInstance: vi.fn(),
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
    logSync: vi.fn(),
  },
}));

describe('BatchInferenceService', () => {
  let service: BatchInferenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton for testing
    (BatchInferenceService as any).instance = null;
    service = BatchInferenceService.getInstance();
    service.reset();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = BatchInferenceService.getInstance();
      const instance2 = BatchInferenceService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export a singleton batchInference', () => {
      expect(batchInference).toBeDefined();
    });
  });

  describe('Queue Management', () => {
    it('should enqueue a request successfully', async () => {
      const result = await service.enqueue('readmission_risk', { patientId: '123' }, {
        tenantId: 'tenant-1',
        priority: 'normal',
      });

      expect(result.success).toBe(true);
      expect(result.data?.requestId).toBeDefined();
      expect(result.data?.position).toBe(1);
    });

    it('should assign queue position based on order', async () => {
      await service.enqueue('readmission_risk', { patientId: '1' }, {
        tenantId: 'tenant-1',
        priority: 'normal',
      });

      const result2 = await service.enqueue('readmission_risk', { patientId: '2' }, {
        tenantId: 'tenant-1',
        priority: 'normal',
      });

      expect(result2.data?.position).toBe(2);
    });

    it('should prioritize higher priority requests', async () => {
      // Add low priority first
      await service.enqueue('readmission_risk', { patientId: '1' }, {
        tenantId: 'tenant-1',
        priority: 'low',
      });

      // Add critical priority second
      const criticalResult = await service.enqueue('readmission_risk', { patientId: '2' }, {
        tenantId: 'tenant-1',
        priority: 'critical',
      });

      // Critical should be at position 1 despite being added second
      expect(criticalResult.data?.position).toBe(1);
    });
  });

  describe('Queue Statistics', () => {
    it('should return accurate queue stats', async () => {
      await service.enqueue('readmission_risk', { patientId: '1' }, {
        tenantId: 'tenant-1',
        priority: 'high',
      });

      await service.enqueue('sdoh_detection', { patientId: '2' }, {
        tenantId: 'tenant-1',
        priority: 'normal',
      });

      const stats = service.getQueueStats();

      expect(stats.totalQueued).toBe(2);
      expect(stats.byType.readmission_risk).toBe(1);
      expect(stats.byType.sdoh_detection).toBe(1);
      expect(stats.byPriority.high).toBe(1);
      expect(stats.byPriority.normal).toBe(1);
    });

    it('should track oldest request age', async () => {
      await service.enqueue('readmission_risk', { patientId: '1' }, {
        tenantId: 'tenant-1',
      });

      // Small delay to ensure measurable age
      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = service.getQueueStats();
      expect(stats.oldestRequestAge).toBeGreaterThan(0);
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel a queued request', async () => {
      const enqueueResult = await service.enqueue('readmission_risk', { patientId: '1' }, {
        tenantId: 'tenant-1',
      });

      const requestId = enqueueResult.data?.requestId ?? '';
      const cancelResult = await service.cancel(requestId);

      expect(cancelResult.success).toBe(true);
      expect(cancelResult.data).toBe(true);
    });

    it('should return false when cancelling non-existent request', async () => {
      const result = await service.cancel('non-existent-id');

      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });

  describe('Result Retrieval', () => {
    it('should return null for pending requests', async () => {
      const enqueueResult = await service.enqueue('readmission_risk', { patientId: '1' }, {
        tenantId: 'tenant-1',
      });

      const requestId = enqueueResult.data?.requestId ?? '';
      const result = await service.getResult(requestId);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull(); // Still pending
    });

    it('should return failure for non-existent requests', async () => {
      const result = await service.getResult('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('Convenience Methods', () => {
    it('should queue readmission risk assessment', async () => {
      const result = await service.queueReadmissionRisk(
        'patient-123',
        'tenant-1',
        { age: 75, conditions: ['diabetes'] },
        'high'
      );

      expect(result.success).toBe(true);
      const stats = service.getQueueStats();
      expect(stats.byType.readmission_risk).toBe(1);
      expect(stats.byPriority.high).toBe(1);
    });

    it('should queue SDOH detection', async () => {
      const result = await service.queueSDOHDetection(
        'patient-456',
        'tenant-1',
        { notes: 'patient mentions transportation issues' }
      );

      expect(result.success).toBe(true);
      const stats = service.getQueueStats();
      expect(stats.byType.sdoh_detection).toBe(1);
    });

    it('should queue billing codes with high priority by default', async () => {
      const result = await service.queueBillingCodes(
        'encounter-789',
        'tenant-1',
        { diagnoses: ['E11.9'], procedures: ['99213'] }
      );

      expect(result.success).toBe(true);
      const stats = service.getQueueStats();
      expect(stats.byType.billing_codes).toBe(1);
      expect(stats.byPriority.high).toBe(1);
    });
  });

  describe('Bulk Enqueue', () => {
    it('should enqueue multiple items at once', async () => {
      const items = [
        { payload: { patientId: '1' }, patientId: '1' },
        { payload: { patientId: '2' }, patientId: '2' },
        { payload: { patientId: '3' }, patientId: '3' },
      ];

      const result = await service.bulkEnqueue('readmission_risk', items, 'tenant-1');

      expect(result.success).toBe(true);
      expect(result.data?.requestIds).toHaveLength(3);
      expect(result.data?.queueSize).toBe(3);
    });

    it('should use batch priority by default for bulk enqueue', async () => {
      const items = [{ payload: { patientId: '1' } }];

      await service.bulkEnqueue('sdoh_detection', items, 'tenant-1');

      const stats = service.getQueueStats();
      expect(stats.byPriority.batch).toBe(1);
    });
  });

  describe('Cumulative Stats', () => {
    it('should track cumulative statistics', () => {
      const stats = service.getCumulativeStats();

      expect(stats).toHaveProperty('totalRequestsProcessed');
      expect(stats).toHaveProperty('totalCostSaved');
      expect(stats).toHaveProperty('currentQueueSize');
      expect(stats).toHaveProperty('processingCount');
    });

    it('should reflect queue size in stats', async () => {
      await service.enqueue('readmission_risk', { patientId: '1' }, {
        tenantId: 'tenant-1',
      });

      const stats = service.getCumulativeStats();
      expect(stats.currentQueueSize).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should reset all state', async () => {
      await service.enqueue('readmission_risk', { patientId: '1' }, {
        tenantId: 'tenant-1',
      });

      service.reset();

      const stats = service.getQueueStats();
      expect(stats.totalQueued).toBe(0);

      const cumulativeStats = service.getCumulativeStats();
      expect(cumulativeStats.totalCostSaved).toBe(0);
      expect(cumulativeStats.totalRequestsProcessed).toBe(0);
    });
  });

  describe('Inference Types', () => {
    const inferenceTypes: InferenceType[] = [
      'readmission_risk',
      'sdoh_detection',
      'billing_codes',
      'welfare_priority',
      'engagement_score',
      'cultural_coaching',
      'handoff_risk',
      'ccm_eligibility',
      'custom',
    ];

    test.each(inferenceTypes)('should accept %s inference type', async (type) => {
      const result = await service.enqueue(type, { data: 'test' }, {
        tenantId: 'tenant-1',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Priority Levels', () => {
    const priorities: InferencePriority[] = ['critical', 'high', 'normal', 'low', 'batch'];

    test.each(priorities)('should accept %s priority level', async (priority) => {
      const result = await service.enqueue('readmission_risk', { data: 'test' }, {
        tenantId: 'tenant-1',
        priority,
      });

      expect(result.success).toBe(true);
    });
  });
});
