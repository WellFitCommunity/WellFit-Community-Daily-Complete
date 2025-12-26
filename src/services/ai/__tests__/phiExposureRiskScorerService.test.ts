/**
 * Tests for PHI Exposure Risk Scorer Service
 *
 * Covers PHI exposure risk assessment and analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PHIExposureRiskScorerService,
  PHIExposureRequest,
  PHIExposureResponse,
  AccessPattern,
  DataClassification,
} from '../phiExposureRiskScorerService';

// Mock supabaseClient
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    })),
  },
}));

// =====================================================
// MOCK DATA FACTORIES
// =====================================================

function createMockAccessPattern(overrides?: Partial<AccessPattern>): AccessPattern {
  return {
    userId: 'user-123',
    resourceType: 'patient_records',
    accessCount: 50,
    uniquePatients: 30,
    avgRecordsPerAccess: 5,
    accessTimes: ['09:00', '14:00', '16:00'],
    accessMethods: ['web', 'api'],
    exportCount: 2,
    printCount: 5,
    ...overrides,
  };
}

function createMockDataClassification(overrides?: Partial<DataClassification>): DataClassification {
  return {
    resourceType: 'patient_records',
    sensitivityLevel: 'phi',
    phiElements: ['name', 'dob', 'ssn', 'medical_records'],
    retentionPolicy: '7 years',
    encryptionStatus: 'encrypted',
    accessControls: ['role_based', 'audit_logged'],
    ...overrides,
  };
}

function createMockPHIRequest(overrides?: Partial<PHIExposureRequest>): PHIExposureRequest {
  return {
    scope: 'user',
    scopeId: 'user-123',
    accessPatterns: [createMockAccessPattern()],
    timeWindowDays: 30,
    includeRecommendations: true,
    tenantId: 'test-tenant',
    ...overrides,
  };
}

function createMockPHIResponse(): PHIExposureResponse {
  return {
    result: {
      scoreId: 'score-123',
      scoredAt: new Date().toISOString(),
      scope: 'user',
      scopeId: 'user-123',
      scopeName: 'John Smith',
      overallRiskScore: 65,
      riskLevel: 'medium',
      accessPatternScore: 55,
      dataSensitivityScore: 80,
      roleAppropriatenessScore: 70,
      temporalPatternScore: 60,
      riskFactors: [
        {
          factor: 'High export activity',
          category: 'access',
          severity: 'medium',
          score: 20,
          description: 'User has exported data 5 times in past 30 days',
          evidence: ['Export log entries'],
          mitigationActions: ['Review export necessity'],
        },
      ],
      topExposures: [
        {
          resourceType: 'patient_records',
          exposureType: 'bulk_access',
          riskScore: 0.7,
          patientCount: 150,
          description: 'Access to 150 patient records in 30 days',
        },
      ],
      complianceImpact: {
        hipaaRisk: 'medium',
        affectedSafeguards: ['Access Controls', 'Audit Controls'],
        regulatoryExposure: ['164.312(a)(1)'],
      },
      mitigationRecommendations: [
        {
          priority: 'high',
          recommendation: 'Implement access alerts for bulk downloads',
          expectedRiskReduction: 15,
          implementationEffort: 'low',
          affectedFactors: ['export_activity'],
        },
      ],
      trendData: [
        { date: '2025-01-01', score: 60 },
        { date: '2025-01-15', score: 65 },
      ],
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-sonnet-4.5',
      responseTimeMs: 1000,
      dataPointsAnalyzed: 500,
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe('PHIExposureRiskScorerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateRiskScore', () => {
    it('should return failure when scope is missing', async () => {
      const request = createMockPHIRequest({ scope: undefined as unknown as 'user' });
      const result = await PHIExposureRiskScorerService.calculateRiskScore(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when scopeId is missing', async () => {
      const request = createMockPHIRequest({ scopeId: '' });
      const result = await PHIExposureRiskScorerService.calculateRiskScore(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle edge function errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      });

      const request = createMockPHIRequest();
      const result = await PHIExposureRiskScorerService.calculateRiskScore(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SCORING_FAILED');
    });

    it('should successfully calculate risk score', async () => {
      const mockResponse = createMockPHIResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockPHIRequest();
      const result = await PHIExposureRiskScorerService.calculateRiskScore(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.riskLevel).toBe('medium');
      expect(result.data?.result.overallRiskScore).toBe(65);
    });
  });

  describe('saveScore', () => {
    it('should save score successfully', async () => {
      const request = createMockPHIRequest();
      const response = createMockPHIResponse();

      const result = await PHIExposureRiskScorerService.saveScore(request, response);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-id');
    });
  });

  describe('getHighRiskUsers', () => {
    it('should fetch high-risk users', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [
        { scope_id: 'user-1', overall_risk_score: 85, risk_level: 'high' },
        { scope_id: 'user-2', overall_risk_score: 75, risk_level: 'high' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await PHIExposureRiskScorerService.getHighRiskUsers('tenant-123', 70);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
      expect(result.data?.[0].riskScore).toBe(85);
    });
  });

  describe('getDepartmentRiskSummary', () => {
    it('should fetch department risk summary', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [
        { scope_id: 'ICU', overall_risk_score: 70, risk_level: 'high' },
        { scope_id: 'ER', overall_risk_score: 55, risk_level: 'medium' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await PHIExposureRiskScorerService.getDepartmentRiskSummary('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });
  });

  describe('getRiskScoreHistory', () => {
    it('should fetch risk score history', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [
        { scored_at: '2025-01-01', overall_risk_score: 60 },
        { scored_at: '2025-01-15', overall_risk_score: 65 },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await PHIExposureRiskScorerService.getRiskScoreHistory('user', 'user-123', 'tenant-123', 90);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });
  });

  describe('getSystemRiskDashboard', () => {
    it('should return dashboard data', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockSystemScore = { result: createMockPHIResponse().result };
      const mockUserScores = [
        { risk_level: 'critical' },
        { risk_level: 'high' },
        { risk_level: 'high' },
        { risk_level: 'medium' },
      ];

      // Create properly chainable mocks for both queries
      const systemQueryMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSystemScore, error: null }),
      };

      const userQueryMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({ data: mockUserScores, error: null }),
        })),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(systemQueryMock as never)
        .mockReturnValueOnce(userQueryMock as never);

      const result = await PHIExposureRiskScorerService.getSystemRiskDashboard('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('overallRiskScore');
      expect(result.data).toHaveProperty('criticalUsers');
      expect(result.data).toHaveProperty('highRiskUsers');
    });
  });

  describe('calculateQuickRiskScore', () => {
    it('should calculate low risk for normal access', () => {
      const accessPattern = createMockAccessPattern({
        accessCount: 20,
        uniquePatients: 10,
        exportCount: 0,
        printCount: 2,
      });
      const dataClassification = createMockDataClassification({
        sensitivityLevel: 'confidential',
        encryptionStatus: 'encrypted',
      });

      const result = PHIExposureRiskScorerService.calculateQuickRiskScore(accessPattern, dataClassification);

      expect(result.level).toBe('low');
      expect(result.score).toBeLessThan(40);
    });

    it('should calculate high risk for bulk PHI access with exports', () => {
      const accessPattern = createMockAccessPattern({
        accessCount: 200,
        uniquePatients: 100,
        exportCount: 10,
        printCount: 20,
      });
      const dataClassification = createMockDataClassification({
        sensitivityLevel: 'phi',
        encryptionStatus: 'unencrypted',
      });

      const result = PHIExposureRiskScorerService.calculateQuickRiskScore(accessPattern, dataClassification);

      expect(result.level).toBe('critical');
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('should identify specific risk factors', () => {
      const accessPattern = createMockAccessPattern({
        exportCount: 5,
      });
      const dataClassification = createMockDataClassification({
        sensitivityLevel: 'phi',
      });

      const result = PHIExposureRiskScorerService.calculateQuickRiskScore(accessPattern, dataClassification);

      expect(result.factors).toContain('Data export activity');
      expect(result.factors).toContain('PHI data access');
    });

    it('should flag unencrypted data', () => {
      const accessPattern = createMockAccessPattern();
      const dataClassification = createMockDataClassification({
        encryptionStatus: 'unencrypted',
      });

      const result = PHIExposureRiskScorerService.calculateQuickRiskScore(accessPattern, dataClassification);

      expect(result.factors).toContain('Unencrypted data exposure');
    });
  });
});
