/**
 * Type definitions for AI Medication Adherence Predictor
 *
 * All interfaces used across the adherence prediction modules.
 *
 * @skill #31 - Medication Adherence Predictor
 */

// ============================================================================
// Request Types
// ============================================================================

export interface MedicationInfo {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  indication?: string;
  cost_tier?: 'generic' | 'preferred_brand' | 'non_preferred' | 'specialty';
  side_effects_reported?: string[];
  start_date?: string;
}

export interface AdherenceRequest {
  patientId: string;
  assessorId: string;
  medications?: MedicationInfo[];
  tenantId?: string;
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface AdherenceBarrier {
  barrier: string;
  category: 'cost' | 'complexity' | 'side_effects' | 'cognitive' | 'social' | 'access' | 'belief' | 'physical';
  severity: 'low' | 'moderate' | 'high' | 'critical';
  evidence: string;
  mitigable: boolean;
  interventions: string[];
}

export interface MedicationRisk {
  medication: string;
  adherenceRisk: 'low' | 'moderate' | 'high' | 'very_high';
  riskScore: number;
  riskFactors: string[];
  simplificationOpportunity?: string;
}

export interface AdherenceIntervention {
  intervention: string;
  category: 'education' | 'simplification' | 'reminder' | 'financial' | 'social_support' | 'monitoring';
  priority: 'routine' | 'recommended' | 'strongly_recommended' | 'critical';
  expectedImpact: 'low' | 'moderate' | 'high';
  implementedBy: string;
  timeframe: string;
}

export interface RegimenComplexity {
  totalMedications: number;
  dailyDoses: number;
  uniqueDoseTimes: number;
  complexityScore: number;
  complexityLevel: 'simple' | 'moderate' | 'complex' | 'very_complex';
}

export interface HistoricalAdherence {
  refillAdherence: number;
  appointmentAdherence: number;
  checkInAdherence: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface OverallScoreResult {
  score: number;
  category: 'excellent' | 'good' | 'moderate' | 'poor' | 'very_poor';
}

// ============================================================================
// Prediction Output
// ============================================================================

export interface AdherencePrediction {
  assessmentId: string;
  patientId: string;
  assessorId: string;
  assessmentDate: string;

  // Overall prediction
  overallAdherenceScore: number; // 0-100, higher = better predicted adherence
  adherenceCategory: 'excellent' | 'good' | 'moderate' | 'poor' | 'very_poor';
  confidenceLevel: number;

  // Barriers analysis
  barriers: AdherenceBarrier[];
  primaryBarrier: string | null;
  barrierCount: number;

  // Per-medication analysis
  medicationRisks: MedicationRisk[];
  highRiskMedications: string[];

  // Regimen analysis
  regimenComplexity: RegimenComplexity;

  // Historical patterns
  historicalAdherence?: HistoricalAdherence;

  // Interventions
  recommendedInterventions: AdherenceIntervention[];
  urgentInterventions: string[];

  // Risk factors
  riskFactorSummary: {
    factor: string;
    impact: 'low' | 'moderate' | 'high';
    modifiable: boolean;
  }[];

  // Patient context
  healthLiteracy: 'low' | 'moderate' | 'adequate' | 'high' | 'unknown';
  socialSupport: 'none' | 'limited' | 'moderate' | 'strong' | 'unknown';
  financialConcerns: boolean;
  cognitiveImpairment: boolean;

  // Safety
  requiresPharmacistReview: boolean;
  requiresCareCoordination: boolean;
  reviewReasons: string[];

  // Summary
  clinicalSummary: string;
  patientTalkingPoints: string[];
}
