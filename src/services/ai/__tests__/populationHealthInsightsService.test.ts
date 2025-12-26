/**
 * Tests for Population Health Insights Service
 *
 * Covers cohort analysis, risk stratification, and VBC analytics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PopulationHealthInsightsService,
  PopulationHealthRequest,
  PopulationHealthResponse,
  CohortCriteria,
} from '../populationHealthInsightsService';

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
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    })),
  },
}));

// =====================================================
// MOCK DATA FACTORIES
// =====================================================

function createMockCohortCriteria(overrides?: Partial<CohortCriteria>): CohortCriteria {
  return {
    ageRange: { min: 65, max: 85 },
    conditions: ['diabetes', 'hypertension'],
    riskLevels: ['high', 'moderate'],
    dateRange: { start: '2025-01-01', end: '2025-12-31' },
    ...overrides,
  };
}

function createMockPopulationRequest(overrides?: Partial<PopulationHealthRequest>): PopulationHealthRequest {
  return {
    insightType: 'cohort_analysis',
    cohortCriteria: createMockCohortCriteria(),
    compareToBaseline: true,
    includeCostAnalysis: true,
    includeQualityMetrics: true,
    tenantId: 'test-tenant',
    ...overrides,
  };
}

function createMockPopulationResponse(): PopulationHealthResponse {
  return {
    result: {
      insightId: 'insight-123',
      insightType: 'cohort_analysis',
      title: 'Diabetic Population Analysis',
      summary: 'Analysis of 1,500 patients with diabetes and hypertension',
      populationSize: 1500,
      analysisDate: new Date().toISOString(),
      diseasePrevalence: [
        {
          condition: 'Type 2 Diabetes',
          icdCode: 'E11.9',
          prevalenceRate: 0.32,
          patientCount: 480,
          trend: 'increasing',
          percentChange: 5.2,
          riskFactors: ['obesity', 'sedentary_lifestyle'],
        },
        {
          condition: 'Hypertension',
          icdCode: 'I10',
          prevalenceRate: 0.45,
          patientCount: 675,
          trend: 'stable',
          percentChange: 1.1,
          riskFactors: ['age', 'sodium_intake'],
        },
      ],
      riskStratification: [
        {
          riskLevel: 'high',
          patientCount: 300,
          percentage: 20,
          avgCost: 25000,
          avgUtilization: 8.5,
          topConditions: ['CHF', 'CKD'],
          interventionOpportunities: ['Care management enrollment'],
        },
        {
          riskLevel: 'moderate',
          patientCount: 600,
          percentage: 40,
          avgCost: 12000,
          avgUtilization: 4.2,
          topConditions: ['Diabetes', 'Hypertension'],
          interventionOpportunities: ['Medication adherence programs'],
        },
        {
          riskLevel: 'low',
          patientCount: 600,
          percentage: 40,
          avgCost: 5000,
          avgUtilization: 2.1,
          topConditions: ['Well visits'],
          interventionOpportunities: ['Preventive care'],
        },
      ],
      costAnalysis: {
        totalCost: 15000000,
        costPerPatient: 10000,
        costByCategory: [
          { category: 'Inpatient', amount: 6000000, percentage: 40 },
          { category: 'Outpatient', amount: 4500000, percentage: 30 },
          { category: 'Pharmacy', amount: 3000000, percentage: 20 },
          { category: 'Other', amount: 1500000, percentage: 10 },
        ],
        costTrend: [
          { month: 'January', amount: 1200000 },
          { month: 'February', amount: 1250000 },
        ],
        savingsOpportunities: [
          {
            intervention: 'Reduce avoidable ED visits',
            estimatedSavings: 500000,
            patientCount: 200,
          },
        ],
      },
      qualityMetrics: [
        {
          measureName: 'HbA1c Control',
          measureId: 'NQF-0059',
          currentRate: 0.72,
          targetRate: 0.80,
          benchmark: 0.78,
          trend: 'improving',
          gap: 0.08,
          improvementOpportunities: ['Outreach to non-compliant patients'],
        },
      ],
      predictions: [
        {
          metric: 'Readmission Rate',
          currentValue: 0.15,
          predictedValue: 0.12,
          confidence: 0.85,
          timeframe: '6 months',
        },
      ],
      recommendations: [
        {
          priority: 'high',
          recommendation: 'Implement chronic care management program',
          expectedImpact: 'Reduce hospitalizations by 15%',
          targetPopulation: 'High-risk diabetic patients',
          estimatedROI: 3.5,
        },
      ],
      keyFindings: [
        'Diabetic population growing at 5% annually',
        '20% of patients account for 60% of costs',
      ],
      actionItems: [
        {
          action: 'Launch diabetes care management pilot',
          owner: 'Clinical Director',
          dueDate: '2025-03-01',
          priority: 'high',
        },
      ],
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-sonnet-4.5',
      responseTimeMs: 2000,
      dataCompleteness: 0.95,
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe('PopulationHealthInsightsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateInsights', () => {
    it('should return failure when insightType is missing', async () => {
      const request = createMockPopulationRequest({ insightType: undefined as unknown as 'cohort_analysis' });
      const result = await PopulationHealthInsightsService.generateInsights(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle edge function errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      });

      const request = createMockPopulationRequest();
      const result = await PopulationHealthInsightsService.generateInsights(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INSIGHTS_GENERATION_FAILED');
    });

    it('should successfully generate insights', async () => {
      const mockResponse = createMockPopulationResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockPopulationRequest();
      const result = await PopulationHealthInsightsService.generateInsights(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.populationSize).toBe(1500);
      expect(result.data?.result.riskStratification.length).toBe(3);
    });

    it('should use default values when optional params not provided', async () => {
      const mockResponse = createMockPopulationResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request: PopulationHealthRequest = { insightType: 'trend', tenantId: 'test' };
      const result = await PopulationHealthInsightsService.generateInsights(request);

      expect(result.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'ai-population-health-insights',
        expect.objectContaining({
          body: expect.objectContaining({
            compareToBaseline: true,
            includeCostAnalysis: true,
            includeQualityMetrics: true,
          }),
        })
      );
    });
  });

  describe('saveInsights', () => {
    it('should save insights successfully', async () => {
      const request = createMockPopulationRequest();
      const response = createMockPopulationResponse();

      const result = await PopulationHealthInsightsService.saveInsights(request, response);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-id');
    });
  });

  describe('getRiskStratification', () => {
    it('should fetch risk stratification data', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = {
        risk_distribution: createMockPopulationResponse().result.riskStratification,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await PopulationHealthInsightsService.getRiskStratification('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(3);
    });
  });

  describe('getTrendingConditions', () => {
    it('should fetch trending conditions', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = {
        result: createMockPopulationResponse().result,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await PopulationHealthInsightsService.getTrendingConditions('tenant-123');

      expect(result.success).toBe(true);
      // Only returns conditions with 'increasing' trend
      expect(result.data?.[0].trend).toBe('increasing');
    });
  });

  describe('getQualityGaps', () => {
    it('should fetch quality gaps', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = {
        result: createMockPopulationResponse().result,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await PopulationHealthInsightsService.getQualityGaps('tenant-123');

      expect(result.success).toBe(true);
      // Returns metrics with gap > 0
      expect(result.data?.[0].gap).toBeGreaterThan(0);
    });
  });

  describe('insight types', () => {
    it('should support cohort_analysis insight type', async () => {
      const mockResponse = createMockPopulationResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockPopulationRequest({ insightType: 'cohort_analysis' });
      const result = await PopulationHealthInsightsService.generateInsights(request);

      expect(result.success).toBe(true);
    });

    it('should support risk_stratification insight type', async () => {
      const mockResponse = createMockPopulationResponse();
      mockResponse.result.insightType = 'risk_stratification';

      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockPopulationRequest({ insightType: 'risk_stratification' });
      const result = await PopulationHealthInsightsService.generateInsights(request);

      expect(result.success).toBe(true);
    });

    it('should support cost_analysis insight type', async () => {
      const mockResponse = createMockPopulationResponse();
      mockResponse.result.insightType = 'cost_analysis';

      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockPopulationRequest({ insightType: 'cost_analysis' });
      const result = await PopulationHealthInsightsService.generateInsights(request);

      expect(result.success).toBe(true);
    });
  });
});
