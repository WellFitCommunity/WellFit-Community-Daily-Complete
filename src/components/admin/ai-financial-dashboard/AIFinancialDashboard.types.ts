/**
 * AIFinancialDashboard Types
 *
 * Shared type definitions for the AI Financial Dashboard sub-modules.
 */

export interface CostMetrics {
  totalCalls: number;
  cachedCalls: number;
  totalCost: number;
  savedCost: number;
  haikuCalls: number;
  sonnetCalls: number;
  cacheHitRate: number;
}

export interface CostTrend {
  date: string;
  cost: number;
  savings: number;
  calls: number;
}

export interface ModelDistribution {
  model: string;
  calls: number;
  cost: number;
  percentage: number;
}

export interface OptimizationRecommendation {
  type: 'cost' | 'performance' | 'batch';
  title: string;
  description: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
}

export interface MCPUserMetrics {
  total_spent: number;
  total_saved: number;
  avg_cache_hit_rate: number;
  total_calls: number;
  total_cached_calls: number;
  total_haiku_calls: number;
  total_sonnet_calls: number;
}

export interface DailySavings {
  date: string;
  total_cost: number;
  saved_cost: number;
  cache_hit_rate: number;
  efficiency_score: number;
}

export interface RevenueSummary {
  totalMonthlyPotential: number;
  ccmEligiblePatients: number;
  pendingBillingSuggestions: number;
  highRiskPatients: number;
  projectedAnnualRevenue: number;
}

export interface CCMPatientSummary {
  patientId: string;
  eligibilityScore: number;
  chronicConditions: number;
  predictedReimbursement: number;
  recommendation: string;
  assessmentDate: string;
}

export type TabValue = 'costs' | 'savings' | 'revenue';

export interface CCMRow {
  patient_id: string;
  overall_eligibility_score: number | null;
  chronic_conditions_count: number | null;
  predicted_monthly_reimbursement: number | null;
  enrollment_recommendation: string | null;
  assessment_date: string | null;
}
