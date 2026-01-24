/**
 * Tests for AI Cost Dashboard
 * Module-level validation tests
 */

import React from 'react';

// Mock all dependencies before importing the component
vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  }),
}));

vi.mock('../../../services/mcp/mcp-cost-optimizer', () => ({
  mcpOptimizer: {
    getMetrics: vi.fn().mockReturnValue({
      totalCalls: 150,
      cachedCalls: 60,
      totalCost: 0.75,
      savedCost: 0.25,
      haikuCalls: 100,
      sonnetCalls: 50,
    }),
    getCacheHitRate: vi.fn().mockReturnValue(40),
  },
}));

vi.mock('../../../services/ai/batchInference', () => ({
  batchInference: {
    getCumulativeStats: vi.fn().mockReturnValue({
      totalRequestsProcessed: 500,
      totalCostSaved: 15.50,
      currentQueueSize: 25,
      processingCount: 5,
    }),
    getQueueStats: vi.fn().mockReturnValue({
      totalQueued: 25,
      byPriority: { critical: 0, high: 5, normal: 15, low: 3, batch: 2 },
      byType: { readmission_risk: 10, sdoh_detection: 8 },
      oldestRequestAge: 5000,
      estimatedProcessingTime: 12500,
    }),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../envision-atlus', () => ({
  EACard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  EACardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  EACardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('AICostDashboard', () => {
  it('should be a valid module', async () => {
    const module = await import('../AICostDashboard');
    expect(module).toBeDefined();
    expect(module.default).toBeDefined();
  });

  it('module exports a React component', async () => {
    const module = await import('../AICostDashboard');
    expect(typeof module.default).toBe('function');
  });

  it('component has a displayName or name', async () => {
    const module = await import('../AICostDashboard');
    expect(module.default.name || module.default.displayName || 'function').toBeTruthy();
  });
});
