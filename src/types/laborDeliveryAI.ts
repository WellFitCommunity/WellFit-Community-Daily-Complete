/**
 * =====================================================
 * LABOR & DELIVERY — AI & ALERT TYPE DEFINITIONS
 * =====================================================
 * Purpose: Types for L&D alerts and Tier 3 AI moonshot features
 * Extracted from laborDelivery.ts for 600-line compliance
 * =====================================================
 */

// =====================================================
// ALERT TYPES (moved from laborDelivery.ts)
// =====================================================

export type LDAlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export type LDAlertType =
  | 'fetal_bradycardia'
  | 'severe_preeclampsia'
  | 'category_iii_tracing'
  | 'postpartum_hemorrhage'
  | 'neonatal_distress'
  | 'prolonged_labor'
  | 'meconium'
  | 'gbs_no_antibiotics'
  | 'maternal_fever'
  | 'cord_prolapse'
  | 'ppd_positive_screen';

export interface LDAlert {
  id: string;
  type: LDAlertType;
  severity: LDAlertSeverity;
  message: string;
  timestamp: string;
  source_record_id: string | null;
  acknowledged: boolean;
}

export interface LDUnitMetrics {
  active_pregnancies: number;
  deliveries_today: number;
  active_labors_today: number;
  active_alerts: number;
}

// =====================================================
// TIER 3 — BIRTH PLAN GENERATION
// =====================================================

export interface LDBirthPlanSection {
  title: string;
  content: string;
  preferences: string[];
}

export interface LDBirthPlan {
  patientId: string;
  generatedAt: string;
  sections: {
    labor_environment: LDBirthPlanSection;
    pain_management: LDBirthPlanSection;
    delivery_preferences: LDBirthPlanSection;
    newborn_care: LDBirthPlanSection;
    feeding_plan: LDBirthPlanSection;
    support_team: LDBirthPlanSection;
    emergency_preferences: LDBirthPlanSection;
    postpartum_wishes: LDBirthPlanSection;
  };
  requiresReview: boolean;
  confidenceScore: number;
}

// =====================================================
// TIER 3 — PPD EARLY WARNING
// =====================================================

export interface LDPPDContributingFactor {
  dimension: string;
  score: number;
  weight: number;
  description: string;
}

export interface LDPPDRiskResult {
  compositeScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  epdsScore: number | null;
  contributingFactors: LDPPDContributingFactor[];
  recommendedActions: string[];
  requiresIntervention: boolean;
  calculatedAt: string;
}

// =====================================================
// TIER 3 — CONTRAINDICATION CHECKING
// =====================================================

export type LDContraindicationAssessment =
  | 'safe'
  | 'caution'
  | 'warning'
  | 'contraindicated';

export interface LDContraindicationFinding {
  type: string;
  severity: string;
  description: string;
  source: string;
  recommendation: string;
}

export interface LDContraindicationResult {
  assessment: LDContraindicationAssessment;
  findings: LDContraindicationFinding[];
  clinicalSummary: string;
  requiresClinicalReview: boolean;
  checkedAt: string;
}

// =====================================================
// TIER 3 — PATIENT EDUCATION
// =====================================================

export interface LDPatientEducationContent {
  topic: string;
  title: string;
  content: string;
  format: 'text' | 'structured' | 'qa';
  generatedAt: string;
  requiresReview: boolean;
}
