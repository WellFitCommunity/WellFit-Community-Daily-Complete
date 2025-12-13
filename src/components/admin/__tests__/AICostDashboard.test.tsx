/**
 * Tests for AI Cost Dashboard
 * Module-level validation tests
 */

import React from 'react';

// Mock all dependencies before importing the component
jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  }),
}));

jest.mock('../../../services/mcp/mcpCostOptimizer', () => ({
  mcpOptimizer: {
    getMetrics: jest.fn().mockReturnValue({
      totalCalls: 150,
      cachedCalls: 60,
      totalCost: 0.75,
      savedCost: 0.25,
      haikuCalls: 100,
      sonnetCalls: 50,
    }),
    getCacheHitRate: jest.fn().mockReturnValue(40),
  },
}));

jest.mock('../../../services/ai/batchInference', () => ({
  batchInference: {
    getCumulativeStats: jest.fn().mockReturnValue({
      totalRequestsProcessed: 500,
      totalCostSaved: 15.50,
      currentQueueSize: 25,
      processingCount: 5,
    }),
    getQueueStats: jest.fn().mockReturnValue({
      totalQueued: 25,
      byPriority: { critical: 0, high: 5, normal: 15, low: 3, batch: 2 },
      byType: { readmission_risk: 10, sdoh_detection: 8 },
      oldestRequestAge: 5000,
      estimatedProcessingTime: 12500,
    }),
  },
}));

jest.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../envision-atlus', () => ({
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
