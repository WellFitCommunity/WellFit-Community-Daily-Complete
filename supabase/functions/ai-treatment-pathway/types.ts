/**
 * Shared types for the AI Treatment Pathway Recommender (Skill #23).
 *
 * @module ai-treatment-pathway/types
 */

export interface TreatmentPathwayRequest {
  patientId: string;
  tenantId?: string;
  condition: string;
  conditionCode?: string; // ICD-10 code
  severity?: "mild" | "moderate" | "severe";
  isNewDiagnosis?: boolean;
  treatmentGoals?: string[];
  excludeMedications?: string[]; // Medications to avoid
}

export interface TreatmentStep {
  stepNumber: number;
  phase: "first_line" | "second_line" | "third_line" | "adjunct" | "monitoring";
  intervention: string;
  interventionType: "medication" | "lifestyle" | "procedure" | "referral" | "monitoring" | "education";
  rationale: string;
  expectedOutcome: string;
  timeframe: string;
  guidelineSource: string;
  evidenceLevel: "A" | "B" | "C" | "D" | "expert_consensus";
  considerations: string[];
  contraindications: string[];
  monitoringRequired: string[];
}

export interface MedicationRecommendation {
  medicationClass: string;
  examples: string[];
  startingApproach: string;
  targetOutcome: string;
  commonSideEffects: string[];
  monitoringParameters: string[];
  contraindicatedIn: string[];
  guidelineSource: string;
  requiresReview: boolean;
}

export interface LifestyleRecommendation {
  category: "diet" | "exercise" | "smoking_cessation" | "alcohol" | "sleep" | "stress" | "weight";
  recommendation: string;
  specificGuidance: string;
  expectedBenefit: string;
  timeframe: string;
  resources: string[];
}

export interface TreatmentPathway {
  condition: string;
  conditionCode: string;
  pathwayTitle: string;
  summary: string;
  severity: string;
  treatmentGoal: string;
  steps: TreatmentStep[];
  medications: MedicationRecommendation[];
  lifestyle: LifestyleRecommendation[];
  referrals: Array<{ specialty: string; reason: string; urgency: string }>;
  monitoringPlan: Array<{ parameter: string; frequency: string; target: string }>;
  followUpSchedule: string;
  redFlags: string[];
  patientEducation: string[];
  guidelinesSummary: Array<{ guideline: string; year: number; recommendation: string }>;
  contraindications: string[];
  allergyConflicts: string[];
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  disclaimer: string;
}

export interface PatientContext {
  demographics: { ageGroup: string; sex: string };
  conditions: Array<{ code: string; display: string }>;
  medications: Array<{ name: string; rxcui?: string }>;
  allergies: string[];
  contraindications: string[];
  sdohFactors: {
    hasTransportationBarriers: boolean;
    hasFinancialBarriers: boolean;
    hasSocialSupport: boolean;
  };
  recentLabs: Record<string, { value: number; unit: string; date: string }>;
  vitals: Record<string, { value: number; unit: string }>;
}

// Database record types for FHIR data
export interface FHIRConditionRecord {
  code?: { coding?: Array<{ code?: string; display?: string }> };
  clinical_status?: string;
}

export interface FHIRMedicationRecord {
  medication_codeable_concept?: { coding?: Array<{ display?: string }>; rxcui?: string };
}

export interface FHIRAllergyRecord {
  code?: { coding?: Array<{ display?: string }>; text?: string };
  criticality?: string;
}

// Parsed pathway response from AI
export interface ParsedPathwayResponse {
  condition?: string;
  conditionCode?: string;
  pathwayTitle?: string;
  summary?: string;
  severity?: string;
  treatmentGoal?: string;
  steps?: Array<Partial<TreatmentStep>>;
  medications?: Array<Partial<MedicationRecommendation>>;
  lifestyle?: LifestyleRecommendation[];
  referrals?: Array<{ specialty: string; reason: string; urgency: string }>;
  monitoringPlan?: Array<{ parameter: string; frequency: string; target: string }>;
  followUpSchedule?: string;
  redFlags?: string[];
  patientEducation?: string[];
  guidelinesSummary?: Array<{ guideline: string; year: number; recommendation: string }>;
  contraindications?: string[];
  allergyConflicts?: string[];
  confidence?: number;
  requiresReview?: boolean;
  reviewReasons?: string[];
  disclaimer?: string;
}
