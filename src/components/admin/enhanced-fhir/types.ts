/**
 * Enhanced FHIR Service — Type Definitions
 *
 * All interfaces and type aliases used across the enhanced FHIR service modules.
 */

import FHIRIntegrationService from '../FhirIntegrationService';
import type {
  PatientInsight,
  PopulationInsights,
  EmergencyAlert,
  HealthStatistics,
  AiConfiguration
} from '../FhirAiService';

// Re-export types from FhirAiService for convenience
export type {
  PatientInsight,
  PopulationInsights,
  EmergencyAlert,
  HealthStatistics,
  AiConfiguration
};

// Use generic FHIR bundle type - compatible with FHIRIntegrationService
export type FhirBundle = ReturnType<typeof FHIRIntegrationService.prototype.exportPatientData> extends Promise<infer T> ? T : never;

// Type definitions for patient data structures
export interface PatientProfile {
  id?: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  age?: number;
  [key: string]: unknown;
}

export interface VitalsEntry {
  created_at?: string;
  bp_systolic?: number;
  bp_diastolic?: number;
  heart_rate?: number;
  glucose_mg_dl?: number;
  blood_sugar?: number;
  pulse_oximeter?: number;
  blood_oxygen?: number;
  spo2?: number;
  weight?: number;
  mood?: string;
  physical_activity?: string;
  social_engagement?: string;
  symptoms?: string;
  activity_description?: string;
  is_emergency?: boolean;
  [key: string]: unknown;
}

export interface CheckInRecord {
  user_id: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface MedicationRecord {
  medication_display?: string;
  name?: string;
  [key: string]: unknown;
}

export interface ComprehensivePatientData {
  profile?: PatientProfile;
  checkIns?: CheckInRecord[];
  vitals?: VitalsEntry[];
  healthEntries?: VitalsEntry[];
  medications?: MedicationRecord[];
  medicationRequests?: MedicationRecord[];
  conditions?: string[];
}

export interface CacheEntry {
  data: ComprehensivePatientData | ComprehensivePatientData[];
  timestamp: number;
  ttl: number;
}

export interface EvidenceBasedRecommendation {
  recommendation: string;
  evidenceLevel: 'A' | 'B' | 'C' | 'D';
  source: string;
  contraindications?: string[];
}

export interface DrugInteraction {
  medications: string[];
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CONTRAINDICATED';
  description: string;
  recommendation: string;
}

export interface ClinicalGuideline {
  guideline: string;
  organization: string;
  applicability: number;
  keyPoints: string[];
  patientSpecificNotes?: string;
}

export interface WeeklyReport {
  period: string;
  generatedAt: string;
  summary: {
    totalPatients: number;
    activePatients: number;
    highRiskPatients: number;
    newEmergencyAlerts: number;
  };
  keyInsights: string[];
  actionItems: string[];
}

export interface MonthlyReport {
  period: string;
  generatedAt: string;
  executiveSummary: {
    populationHealth: number;
    riskDistribution: Record<string, number>;
    qualityScores: {
      fhirCompliance: number;
      dataQuality: number;
      clinicalQuality: number;
    };
  };
  trends: string[];
  recommendations: ResourceRecommendation[];
  nextMonthPredictions: PredictiveAlert[];
}

export interface EmergencyReport {
  alertCount: number;
  generatedAt: string;
  criticalAlerts: PredictiveAlert[];
  immediateActions: string[];
  escalationRequired: boolean;
}

export interface FhirComplianceResult {
  score: number;
  issues: string[];
  recommendations: string[];
}

export interface DataQualityResult {
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  issues: Array<{ type: string; count: number; description: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }>;
}

export interface ClinicalQualityResult {
  adherenceToGuidelines: number;
  outcomeMetrics: {
    readmissionRate: number;
    mortalityRate: number;
    patientSatisfaction: number;
    qualityOfLifeImprovement: number;
  };
}

export interface SmartSession {
  accessToken: string;
  patient: string;
  [key: string]: unknown;
}

export interface EnhancedPatientData {
  fhirBundle: FhirBundle;
  aiInsights: PatientInsight;
  emergencyAlerts: EmergencyAlert[];
  recommendedActions: string[];
  nextReviewDate: string;
  clinicalSummary: string;
  healthStatistics: HealthStatistics;
}

export interface PopulationDashboard {
  overview: PopulationInsights;
  riskMatrix: RiskMatrix;
  interventionQueue: InterventionItem[];
  resourceAllocation: ResourceRecommendation[];
  predictiveAlerts: PredictiveAlert[];
}

export interface RiskMatrix {
  quadrants: {
    highRiskHighAdherence: number;
    highRiskLowAdherence: number;
    lowRiskHighAdherence: number;
    lowRiskLowAdherence: number;
  };
  actionPriority: Array<{
    quadrant: string;
    patientCount: number;
    recommendedAction: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
}

export interface InterventionItem {
  patientId: string;
  patientName: string;
  interventionType: 'CLINICAL' | 'MEDICATION' | 'LIFESTYLE' | 'MONITORING' | 'EMERGENCY' | 'FOLLOW_UP' | 'INTERVENTION';
  priority: number;
  description: string;
  estimatedTimeToComplete: string;
  expectedOutcome: string;
  assignedTo?: string;
  dueDate: string;
}

export interface ResourceRecommendation {
  resourceType: 'STAFF' | 'EQUIPMENT' | 'MEDICATION' | 'TRAINING' | 'TECHNOLOGY';
  recommendation: string;
  justification: string;
  estimatedCost: string;
  expectedRoi: string;
  implementationTimeframe: string;
  priority: number;
}

export interface PredictiveAlert {
  type: 'PATIENT_DETERIORATION' | 'MEDICATION_ADHERENCE' | 'READMISSION_RISK' | 'POPULATION_TREND';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  affectedPatients?: string[];
  probabilityScore: number;
  timeframe: string;
  recommendedActions: string[];
  isActionable: boolean;
}

export interface ClinicalDecisionSupport {
  patientId: string;
  condition: string;
  evidenceBasedRecommendations: Array<{
    recommendation: string;
    evidenceLevel: 'A' | 'B' | 'C' | 'D';
    source: string;
    contraindications?: string[];
  }>;
  drugInteractionAlerts: Array<{
    medications: string[];
    severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CONTRAINDICATED';
    description: string;
    recommendation: string;
  }>;
  clinicalGuidelines: Array<{
    guideline: string;
    organization: string;
    applicability: number;
    keyPoints: string[];
  }>;
}

export interface QualityMetrics {
  fhirCompliance: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  dataQuality: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    issues: Array<{
      type: string;
      count: number;
      description: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
  };
  clinicalQuality: {
    adherenceToGuidelines: number;
    outcomeMetrics: {
      readmissionRate: number;
      mortalityRate: number;
      patientSatisfaction: number;
      qualityOfLifeImprovement: number;
    };
  };
}
