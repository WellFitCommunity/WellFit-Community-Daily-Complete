/**
 * Tests for HIPAA Violation Predictor Service
 *
 * Covers predictive compliance and violation risk scoring
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HIPAAViolationPredictorService,
  HIPAAViolationRequest,
  HIPAAViolationResponse,
  HIPAAViolationPrediction,
} from '../hipaaViolationPredictorService';

// Mock supabaseClient
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    })),
  },
}));

// =====================================================
// MOCK DATA FACTORIES
// =====================================================

function createMockHIPAARequest(overrides?: Partial<HIPAAViolationRequest>): HIPAAViolationRequest {
  return {
    analysisScope: 'full',
    timeframeMonths: 6,
    includeHistoricalPatterns: true,
    tenantId: 'test-tenant',
    ...overrides,
  };
}

function createMockPrediction(): HIPAAViolationPrediction {
  return {
    predictionId: 'pred-123',
    predictedAt: new Date().toISOString(),
    violationType: 'access_control',
    probability: 0.75,
    riskLevel: 'high',
    timeframe: '30 days',
    description: 'Potential unauthorized access pattern detected',
    potentialImpact: {
      patientCount: 150,
      financialExposure: '$50,000 - $100,000',
      reputationalRisk: 'Significant',
      operationalImpact: 'Moderate',
    },
    contributingFactors: [
      {
        factor: 'Excessive PHI access',
        category: 'Access patterns',
        weight: 0.4,
        description: 'Users accessing more records than typical',
        evidence: ['Access logs show 3x normal volume'],
        remediationSteps: ['Implement access alerts'],
      },
    ],
    affectedSystems: [
      { system: 'EHR', component: 'Patient records', vulnerability: 'Excessive access' },
    ],
    affectedUsers: [
      { userId: 'user-1', role: 'nurse', riskContribution: 0.3 },
    ],
    preventiveActions: [
      {
        action: 'Enable access monitoring alerts',
        priority: 'high',
        effort: 'low',
        expectedEffectiveness: 0.8,
        responsibleParty: 'Security team',
        implementationSteps: ['Configure alerts', 'Test thresholds'],
      },
    ],
    regulatoryReferences: [
      {
        regulation: 'HIPAA',
        section: '164.312(a)(1)',
        requirement: 'Access control',
        description: 'Implement technical policies',
      },
    ],
    status: 'active',
    confidence: 0.85,
  };
}

function createMockHIPAAResponse(): HIPAAViolationResponse {
  return {
    result: {
      predictions: [createMockPrediction()],
      complianceGaps: [
        {
          requirement: 'Audit logging',
          regulation: 'HIPAA 164.312(b)',
          currentState: 'Partial',
          requiredState: 'Complete',
          gapSeverity: 'medium',
          remediationCost: '$5,000',
          remediationTimeframe: '2 weeks',
        },
      ],
      overallComplianceScore: 78,
      riskSummary: {
        criticalRisks: 0,
        highRisks: 2,
        mediumRisks: 5,
        lowRisks: 8,
        totalPredictions: 15,
      },
      topPriorities: [],
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-sonnet-4.5',
      responseTimeMs: 1500,
      factorsAnalyzed: 25,
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe('HIPAAViolationPredictorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('predictViolations', () => {
    it('should handle edge function errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      });

      const request = createMockHIPAARequest();
      const result = await HIPAAViolationPredictorService.predictViolations(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PREDICTION_FAILED');
    });

    it('should successfully predict violations', async () => {
      const mockResponse = createMockHIPAAResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockHIPAARequest();
      const result = await HIPAAViolationPredictorService.predictViolations(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.predictions.length).toBeGreaterThan(0);
      expect(result.data?.result.overallComplianceScore).toBe(78);
    });

    it('should use default values when optional params not provided', async () => {
      const mockResponse = createMockHIPAAResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request: HIPAAViolationRequest = { tenantId: 'test' };
      const result = await HIPAAViolationPredictorService.predictViolations(request);

      expect(result.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-hipaa-violation-predictor',
        expect.objectContaining({
          body: expect.objectContaining({
            analysisScope: 'full',
            timeframeMonths: 6,
            includeHistoricalPatterns: true,
          }),
        })
      );
    });
  });

  describe('savePrediction', () => {
    it('should save prediction successfully', async () => {
      const prediction = createMockPrediction();
      const result = await HIPAAViolationPredictorService.savePrediction(prediction, 'tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-id');
    });
  });

  describe('getActivePredictions', () => {
    it('should fetch active predictions', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [{ result: createMockPrediction() }];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await HIPAAViolationPredictorService.getActivePredictions('tenant-123');

      expect(result.success).toBe(true);
    });

    it('should filter by risk level when provided', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockFrom = vi.mocked(supabase.from);

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as never);

      await HIPAAViolationPredictorService.getActivePredictions('tenant-123', 'critical');

      expect(mockFrom).toHaveBeenCalled();
    });
  });

  describe('updatePredictionStatus', () => {
    it('should update prediction status', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      } as never);

      const result = await HIPAAViolationPredictorService.updatePredictionStatus(
        'pred-123',
        'mitigated',
        'user-1'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('quickRiskAssessment', () => {
    it('should calculate critical risk for missing multiple controls', () => {
      const result = HIPAAViolationPredictorService.quickRiskAssessment({
        hasAuditLogs: false,
        hasAccessControls: false,
        hasEncryption: false,
        hasTraining: false,
        hasBaaWithVendors: false,
        hasIncidentPlan: false,
        lastRiskAssessmentMonths: 18,
      });

      expect(result.level).toBe('critical');
      expect(result.score).toBeLessThan(50);
      expect(result.gaps.length).toBeGreaterThan(5);
    });

    it('should calculate low risk for fully compliant system', () => {
      const result = HIPAAViolationPredictorService.quickRiskAssessment({
        hasAuditLogs: true,
        hasAccessControls: true,
        hasEncryption: true,
        hasTraining: true,
        hasBaaWithVendors: true,
        hasIncidentPlan: true,
        lastRiskAssessmentMonths: 6,
      });

      expect(result.level).toBe('low');
      expect(result.score).toBe(100);
      expect(result.gaps.length).toBe(0);
    });

    it('should identify overdue risk assessment', () => {
      const result = HIPAAViolationPredictorService.quickRiskAssessment({
        hasAuditLogs: true,
        hasAccessControls: true,
        hasEncryption: true,
        hasTraining: true,
        hasBaaWithVendors: true,
        hasIncidentPlan: true,
        lastRiskAssessmentMonths: 18,
      });

      expect(result.gaps).toContain('Risk assessment overdue');
    });
  });

  describe('getComplianceDashboard', () => {
    it('should return dashboard data', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockPredictions = [
        { result: createMockPrediction(), risk_level: 'high', status: 'active' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockPredictions, error: null }),
      } as never);

      const result = await HIPAAViolationPredictorService.getComplianceDashboard('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('complianceScore');
      expect(result.data).toHaveProperty('activeThreats');
    });
  });
});
