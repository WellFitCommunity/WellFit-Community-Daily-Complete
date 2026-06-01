/**
 * Readmission Risk Predictor — Shared Types & Type Guards
 *
 * Extracted verbatim from readmissionRiskPredictor.ts during god-file
 * decomposition (CLAUDE.md Commandment #12). Behavior-preserving move only.
 */

// =====================================================
// PUBLIC TYPES
// =====================================================

export interface DischargeContext {
  patientId: string;
  tenantId: string;
  dischargeDate: string; // ISO timestamp
  dischargeFacility: string;
  dischargeDisposition: 'home' | 'home_health' | 'snf' | 'ltac' | 'rehab' | 'hospice';
  primaryDiagnosisCode?: string;
  primaryDiagnosisDescription?: string;
  secondaryDiagnoses?: string[];
  lengthOfStay?: number; // days
}

export interface RiskFactor {
  factor: string;
  weight: number; // 0.00 to 1.00 contribution to overall risk
  category: 'utilization_history' | 'social_determinants' | 'medication' | 'clinical' | 'adherence';
  evidence?: string;
}

export interface ProtectiveFactor {
  factor: string;
  impact: string; // Description of how it reduces risk
  category: string;
}

export interface RecommendedIntervention {
  intervention: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: number; // 0.00 to 1.00 reduction in readmission risk
  timeframe: string; // e.g., "within 48 hours", "daily for 14 days"
  responsible: string; // Role responsible
}

export interface ReadmissionPrediction {
  patientId: string;
  dischargeDate: string;
  readmissionRisk30Day: number; // 0.00 to 1.00
  readmissionRisk7Day: number;
  readmissionRisk90Day: number;
  riskCategory: 'low' | 'moderate' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  protectiveFactors: ProtectiveFactor[];
  recommendedInterventions: RecommendedIntervention[];
  predictedReadmissionDate?: string; // ISO date
  predictionConfidence: number; // 0.00 to 1.00
  /**
   * Plain-language explanation of risk assessment
   * Written at 6th grade reading level for patient/family understanding
   * Example: "Risk is HIGH because Maria missed 3 check-ins AND has transportation barriers"
   */
  plainLanguageExplanation: string;
  dataSourcesAnalyzed: {
    readmissionHistory: boolean;
    sdohIndicators: boolean;
    checkinPatterns: boolean;
    medicationAdherence: boolean;
    carePlanAdherence: boolean;
  };
  aiModel: string;
  aiCost: number;
}

// =====================================================
// INTERNAL TYPES
// =====================================================

export type PatientDataSources = {
  readmissionHistory: boolean;
  sdohIndicators: boolean;
  checkinPatterns: boolean;
  medicationAdherence: boolean;
  carePlanAdherence: boolean;
};

export type ReadmissionRow = { admission_date: string; [key: string]: unknown };
export type SdohIndicatorRow = { risk_level?: unknown; [key: string]: unknown };
export type CheckInRow = { status?: unknown; alert_triggered?: unknown; check_in_date?: unknown; [key: string]: unknown };
export type MedicationRequestRow = Record<string, unknown>;
export type CarePlanRow = Record<string, unknown>;
export type PatientProfileRow = { date_of_birth?: unknown; chronic_conditions?: unknown; [key: string]: unknown };

export type GatheredPatientData = {
  sources: PatientDataSources;
  readmissions?: ReadmissionRow[];
  readmissionCount?: number;
  recentReadmissions7d?: number;
  recentReadmissions30d?: number;
  sdohIndicators?: SdohIndicatorRow[];
  highRiskSDOH?: SdohIndicatorRow[];
  checkIns?: CheckInRow[];
  checkInCompletionRate?: number;
  missedCheckIns?: number;
  alertsTriggered?: number;
  activeMedications?: MedicationRequestRow[];
  medicationCount?: number;
  hasActiveCarePlan?: boolean;
  carePlan?: CarePlanRow;
  profile?: PatientProfileRow;
  age?: number;
  chronicConditionsCount?: number;
};

export type TenantConfig = {
  readmission_predictor_enabled: boolean;
  readmission_predictor_auto_create_care_plan: boolean;
  readmission_predictor_high_risk_threshold: number;
  readmission_predictor_model?: string;
  [key: string]: unknown;
};

export type ParsedAIPrediction = {
  readmissionRisk30Day: number;
  readmissionRisk7Day: number;
  readmissionRisk90Day: number;
  riskCategory: 'low' | 'moderate' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  protectiveFactors?: ProtectiveFactor[];
  recommendedInterventions: RecommendedIntervention[];
  predictedReadmissionDate?: string;
  predictionConfidence: number;
};

// =====================================================
// TYPE GUARDS
// =====================================================

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isHighRiskLevel(value: unknown): boolean {
  return value === 'high' || value === 'critical';
}

export function isCompletedStatus(value: unknown): boolean {
  return value === 'completed';
}

export function isMissedStatus(value: unknown): boolean {
  return value === 'missed';
}

export function isTruthy(value: unknown): boolean {
  return value === true;
}

export function isTenantConfig(value: unknown): value is Partial<TenantConfig> {
  if (!isRecord(value)) return false;
  return (
    typeof value.readmission_predictor_enabled === 'boolean' ||
    typeof value.readmission_predictor_auto_create_care_plan === 'boolean' ||
    typeof value.readmission_predictor_high_risk_threshold === 'number' ||
    typeof value.readmission_predictor_model === 'string'
  );
}
