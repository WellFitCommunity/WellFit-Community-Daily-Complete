/**
 * Type definitions for the AI Care Plan Generator
 *
 * All interfaces, database record types, and utility types
 * shared across the care plan generator edge function modules.
 *
 * @module ai-care-plan-generator/types
 */

// =====================================================
// REQUEST / RESPONSE TYPES
// =====================================================

export interface CarePlanRequest {
  patientId: string;
  tenantId?: string;
  planType:
    | "readmission_prevention"
    | "chronic_care"
    | "transitional_care"
    | "high_utilizer"
    | "preventive";
  focusConditions?: string[];
  includeSDOH?: boolean;
  includeMedications?: boolean;
  careTeamRoles?: string[];
  durationWeeks?: number;
  /** Cultural competency: population hints for culturally-informed care plans */
  populationHints?: string[];
}

// =====================================================
// CARE PLAN DOMAIN TYPES
// =====================================================

export interface CarePlanGoal {
  goal: string;
  target: string;
  timeframe: string;
  measurementMethod: string;
  priority: "high" | "medium" | "low";
  evidenceBasis?: string;
}

export interface CarePlanIntervention {
  intervention: string;
  frequency: string;
  responsible: string;
  duration: string;
  rationale: string;
  cptCode?: string;
  billingEligible: boolean;
}

export interface CarePlanBarrier {
  barrier: string;
  category:
    | "transportation"
    | "financial"
    | "social"
    | "cognitive"
    | "physical"
    | "language"
    | "other";
  solution: string;
  resources: string[];
  priority: "high" | "medium" | "low";
}

export interface CarePlanActivity {
  activityType:
    | "appointment"
    | "medication"
    | "education"
    | "monitoring"
    | "referral"
    | "follow_up";
  description: string;
  scheduledDate?: string;
  frequency?: string;
  status: "scheduled" | "pending" | "completed";
}

export interface GeneratedCarePlan {
  title: string;
  description: string;
  planType: string;
  priority: "critical" | "high" | "medium" | "low";
  goals: CarePlanGoal[];
  interventions: CarePlanIntervention[];
  barriers: CarePlanBarrier[];
  activities: CarePlanActivity[];
  careTeam: Array<{ role: string; responsibilities: string[] }>;
  estimatedDuration: string;
  reviewSchedule: string;
  successCriteria: string[];
  riskFactors: string[];
  icd10Codes: Array<{ code: string; display: string }>;
  ccmEligible: boolean;
  tcmEligible: boolean;
  confidence: number;
  evidenceSources: string[];
  requiresReview: boolean;
  reviewReasons: string[];
}

// =====================================================
// PATIENT CONTEXT TYPES
// =====================================================

export interface PatientContext {
  demographics: {
    ageGroup: string;
    preferredLanguage: string;
  };
  conditions: Array<{
    code: string;
    display: string;
    status: string;
    isPrimary: boolean;
  }>;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  vitals: Record<string, { value: number; unit: string; date: string }>;
  sdohFactors: {
    housing: string;
    food: string;
    transportation: string;
    social: string;
    financial: string;
    overallRisk: string;
    complexityScore: number;
  } | null;
  utilizationHistory: {
    edVisits30Days: number;
    edVisits90Days: number;
    admissions30Days: number;
    admissions90Days: number;
    readmissionRisk: string;
  };
  allergies: string[];
  careGaps: string[];
}

// =====================================================
// DATABASE RECORD TYPES
// =====================================================

export interface FHIRConditionRecord {
  code?: { coding?: Array<{ code?: string; display?: string }> };
  clinical_status?: string;
}

export interface DiagnosisRecord {
  diagnosis_name?: string;
  icd10_code?: string;
  is_primary?: boolean;
  status?: string;
}

export interface FHIRMedicationRecord {
  medication_codeable_concept?: {
    coding?: Array<{ display?: string }>;
  };
  dosage_instruction?: Array<{
    dose_and_rate?: Array<{
      dose_quantity?: { value?: number };
    }>;
    timing?: { code?: { text?: string } };
  }>;
}

export interface ReadmissionRecord {
  admission_date: string;
  facility_type?: string;
}

export interface FHIRAllergyRecord {
  code?: { coding?: Array<{ display?: string }>; text?: string };
}

// =====================================================
// PARSED AI RESPONSE
// =====================================================

export interface ParsedCarePlanResponse {
  title?: string;
  description?: string;
  planType?: string;
  priority?: "critical" | "high" | "medium" | "low";
  goals?: CarePlanGoal[];
  interventions?: CarePlanIntervention[];
  barriers?: CarePlanBarrier[];
  activities?: CarePlanActivity[];
  careTeam?: Array<{ role: string; responsibilities: string[] }>;
  estimatedDuration?: string;
  reviewSchedule?: string;
  successCriteria?: string[];
  riskFactors?: string[];
  icd10Codes?: Array<{ code: string; display: string }>;
  ccmEligible?: boolean;
  tcmEligible?: boolean;
  confidence?: number;
  evidenceSources?: string[];
  requiresReview?: boolean;
  reviewReasons?: string[];
}

// =====================================================
// UTILITY
// =====================================================

/** Redact PHI patterns (emails, phones, SSNs) from strings */
export const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");
