/**
 * MIPS Types — Merit-based Incentive Payment System
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 */

export interface MipsCompositeScore {
  id: string;
  tenantId: string;
  reportingYear: number;
  qualityScore: number;
  qualityWeight: number;
  costScore: number;
  costWeight: number;
  improvementActivitiesScore: number;
  improvementActivitiesWeight: number;
  promotingInteroperabilityScore: number;
  promotingInteroperabilityWeight: number;
  finalCompositeScore: number;
  paymentAdjustmentPercent: number;
  benchmarkDecile: number | null;
  qualityMeasureScores: MipsQualityMeasureScore[];
  qualityMeasuresReported: number;
  qualityBonusPoints: number;
  calculatedAt: string;
  notes: string | null;
}

export interface MipsQualityMeasureScore {
  measureId: string;
  cmsId: string;
  title: string;
  performanceRate: number | null;
  benchmarkDecile: number | null;
  points: number;
  maxPoints: number;
  isHighPriority: boolean;
  isBonus: boolean;
}

export interface MipsImprovementActivity {
  id: string;
  tenantId: string;
  reportingYear: number;
  activityId: string;
  title: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  weight: 'medium' | 'high';
  points: number;
  isAttested: boolean;
  attestationDate: string | null;
  attestedBy: string | null;
  evidenceNotes: string | null;
}

export interface MipsCompositeRow {
  id: string;
  tenant_id: string;
  reporting_year: number;
  quality_score: number;
  quality_weight: number;
  cost_score: number;
  cost_weight: number;
  improvement_activities_score: number;
  improvement_activities_weight: number;
  promoting_interoperability_score: number;
  promoting_interoperability_weight: number;
  final_composite_score: number;
  payment_adjustment_percent: number;
  benchmark_decile: number | null;
  quality_measure_scores: MipsQualityMeasureScore[];
  quality_measures_reported: number;
  quality_bonus_points: number;
  calculated_at: string;
  calculated_by: string | null;
  notes: string | null;
}

export interface MipsImprovementActivityRow {
  id: string;
  tenant_id: string;
  reporting_year: number;
  activity_id: string;
  title: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  weight: 'medium' | 'high';
  points: number;
  is_attested: boolean;
  attestation_date: string | null;
  attested_by: string | null;
  evidence_notes: string | null;
}

export interface MipsPaymentAdjustment {
  compositeScore: number;
  adjustmentPercent: number;
  tier: 'exceptional' | 'above_threshold' | 'at_threshold' | 'below_threshold' | 'penalty';
}

export interface CalculateMipsOptions {
  tenantId: string;
  reportingYear: number;
  qualityMeasureIds?: string[];
}
