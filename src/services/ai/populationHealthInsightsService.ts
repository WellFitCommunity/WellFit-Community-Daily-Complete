/**
 * Population Health Insights Service
 *
 * AI-powered cohort analysis, disease prevalence trends, risk stratification,
 * and predictive analytics for value-based care contracts.
 *
 * @module populationHealthInsightsService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CohortCriteria {
  ageRange?: { min: number; max: number };
  conditions?: string[];
  medications?: string[];
  riskLevels?: string[];
  carePrograms?: string[];
  providers?: string[];
  dateRange?: { start: string; end: string };
  customFilters?: Record<string, unknown>;
}

export interface DiseasePrevalence {
  condition: string;
  icdCode: string;
  prevalenceRate: number;
  patientCount: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  percentChange: number;
  riskFactors: string[];
}

export interface RiskStratification {
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  patientCount: number;
  percentage: number;
  avgCost: number;
  avgUtilization: number;
  topConditions: string[];
  interventionOpportunities: string[];
}

export interface CostAnalysis {
  totalCost: number;
  costPerPatient: number;
  costByCategory: Array<{ category: string; amount: number; percentage: number }>;
  costTrend: Array<{ month: string; amount: number }>;
  savingsOpportunities: Array<{
    intervention: string;
    estimatedSavings: number;
    patientCount: number;
  }>;
}

export interface QualityMetrics {
  measureName: string;
  measureId: string;
  currentRate: number;
  targetRate: number;
  benchmark: number;
  trend: 'improving' | 'stable' | 'declining';
  gap: number;
  improvementOpportunities: string[];
}

export interface PopulationHealthInsight {
  insightId: string;
  insightType: 'cohort_analysis' | 'trend' | 'risk_stratification' | 'prediction' | 'cost_analysis';
  title: string;
  summary: string;
  populationSize: number;
  analysisDate: string;
  diseasePrevalence: DiseasePrevalence[];
  riskStratification: RiskStratification[];
  costAnalysis: CostAnalysis;
  qualityMetrics: QualityMetrics[];
  predictions: Array<{
    metric: string;
    currentValue: number;
    predictedValue: number;
    confidence: number;
    timeframe: string;
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    expectedImpact: string;
    targetPopulation: string;
    estimatedROI?: number;
  }>;
  keyFindings: string[];
  actionItems: Array<{
    action: string;
    owner: string;
    dueDate: string;
    priority: string;
  }>;
}

export interface PopulationHealthRequest {
  insightType: 'cohort_analysis' | 'trend' | 'risk_stratification' | 'prediction' | 'cost_analysis';
  cohortCriteria?: CohortCriteria;
  compareToBaseline?: boolean;
  includeCostAnalysis?: boolean;
  includeQualityMetrics?: boolean;
  tenantId?: string;
}

export interface PopulationHealthResponse {
  result: PopulationHealthInsight;
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    dataCompleteness: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class PopulationHealthInsightsService {
  /**
   * Generate population health insights
   */
  static async generateInsights(
    request: PopulationHealthRequest
  ): Promise<ServiceResult<PopulationHealthResponse>> {
    try {
      if (!request.insightType) {
        return failure('INVALID_INPUT', 'Insight type is required');
      }

      const { data, error } = await supabase.functions.invoke('ai-population-health-insights', {
        body: {
          insightType: request.insightType,
          cohortCriteria: request.cohortCriteria || {},
          compareToBaseline: request.compareToBaseline ?? true,
          includeCostAnalysis: request.includeCostAnalysis ?? true,
          includeQualityMetrics: request.includeQualityMetrics ?? true,
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      return success(data as PopulationHealthResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('INSIGHTS_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Save generated insights
   */
  static async saveInsights(
    request: PopulationHealthRequest,
    response: PopulationHealthResponse
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const { data, error } = await supabase
        .from('ai_population_health_insights')
        .insert({
          insight_id: response.result.insightId,
          insight_type: request.insightType,
          cohort_criteria: request.cohortCriteria || {},
          population_size: response.result.populationSize,
          analysis_period_start: request.cohortCriteria?.dateRange?.start,
          analysis_period_end: request.cohortCriteria?.dateRange?.end,
          key_findings: response.result.keyFindings,
          risk_distribution: response.result.riskStratification,
          trends: response.result.predictions,
          recommendations: response.result.recommendations,
          result: response.result,
          tenant_id: request.tenantId,
        })
        .select('id')
        .single();

      if (error) throw error;

      return success({ id: data.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Get risk stratification summary
   */
  static async getRiskStratification(
    tenantId: string
  ): Promise<ServiceResult<RiskStratification[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_population_health_insights')
        .select('risk_distribution')
        .eq('tenant_id', tenantId)
        .eq('insight_type', 'risk_stratification')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      return success(data.risk_distribution as RiskStratification[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get trending conditions
   */
  static async getTrendingConditions(
    tenantId: string,
    limit: number = 10
  ): Promise<ServiceResult<DiseasePrevalence[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_population_health_insights')
        .select('result')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      const result = data.result as PopulationHealthInsight;
      const trending = result.diseasePrevalence
        .filter((d) => d.trend === 'increasing')
        .sort((a, b) => b.percentChange - a.percentChange)
        .slice(0, limit);

      return success(trending);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get quality gaps
   */
  static async getQualityGaps(
    tenantId: string
  ): Promise<ServiceResult<QualityMetrics[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_population_health_insights')
        .select('result')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      const result = data.result as PopulationHealthInsight;
      const gaps = result.qualityMetrics
        .filter((m) => m.gap > 0)
        .sort((a, b) => b.gap - a.gap);

      return success(gaps);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }
}

export default PopulationHealthInsightsService;
