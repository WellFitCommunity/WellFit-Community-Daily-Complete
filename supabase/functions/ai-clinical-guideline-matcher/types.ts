/**
 * Type definitions for AI Clinical Guideline Matcher
 *
 * All interfaces used across the guideline matching modules.
 *
 * @module ai-clinical-guideline-matcher/types
 */

// =====================================================
// REQUEST / RESPONSE TYPES
// =====================================================

export interface GuidelineMatchRequest {
  patientId: string;
  tenantId?: string;
  /** Optional: Focus on specific conditions */
  focusConditions?: string[];
  /** Include preventive care screening recommendations */
  includePreventiveCare?: boolean;
  /** Match against specific guideline categories */
  guidelineCategories?: string[];
}

// =====================================================
// CLINICAL GUIDELINE TYPES
// =====================================================

export interface ClinicalGuideline {
  guidelineId: string;
  guidelineName: string;
  organization: string;
  year: number;
  condition: string;
  conditionCode?: string;
  url?: string;
}

export interface GuidelineRecommendation {
  recommendationId: string;
  guideline: ClinicalGuideline;
  category: "treatment" | "monitoring" | "screening" | "lifestyle" | "referral" | "diagnostic";
  recommendation: string;
  rationale: string;
  evidenceLevel: "A" | "B" | "C" | "D" | "expert_consensus";
  urgency: "routine" | "soon" | "urgent" | "emergent";
  targetValue?: string;
  currentValue?: string;
  gap?: string;
  actionItems: string[];
}

export interface AdherenceGap {
  gapId: string;
  guideline: ClinicalGuideline;
  gapType: "missing_medication" | "missing_test" | "suboptimal_control" | "missing_referral" | "missing_screening" | "lifestyle";
  description: string;
  expectedCare: string;
  currentState: string;
  recommendation: string;
  priority: "low" | "medium" | "high" | "critical";
}

export interface PreventiveScreening {
  screeningId: string;
  screeningName: string;
  guidelineSource: string;
  applicableFor: string;
  frequency: string;
  lastPerformed?: string;
  nextDue?: string;
  status: "current" | "overdue" | "never_done" | "not_applicable";
  recommendation: string;
}

export interface GuidelineMatchResult {
  patientId: string;
  matchedGuidelines: ClinicalGuideline[];
  recommendations: GuidelineRecommendation[];
  adherenceGaps: AdherenceGap[];
  preventiveScreenings: PreventiveScreening[];
  summary: {
    totalGuidelines: number;
    totalRecommendations: number;
    criticalGaps: number;
    highPriorityGaps: number;
    overdueScreenings: number;
  };
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  disclaimer: string;
}

// =====================================================
// PATIENT CONTEXT TYPES
// =====================================================

export interface PatientContext {
  demographics: {
    age: number;
    ageGroup: string;
    sex: string;
  };
  conditions: Array<{ code: string; display: string }>;
  medications: Array<{ name: string; rxcui?: string }>;
  allergies: string[];
  recentLabs: Record<string, { value: number; unit: string; date: string }>;
  vitals: Record<string, { value: number; unit: string }>;
  lastScreenings: Record<string, string>; // screening name -> date
}

// =====================================================
// DATABASE RECORD TYPES
// =====================================================

export interface ConditionRecord {
  code?: { coding?: Array<{ code?: string; display?: string }> };
  clinical_status?: string;
}

export interface MedicationRecord {
  medication_codeable_concept?: { coding?: Array<{ display?: string }>; rxcui?: string };
}

export interface AllergyRecord {
  code?: { coding?: Array<{ display?: string }>; text?: string };
  criticality?: string;
}

// =====================================================
// PARSED AI RESPONSE TYPES
// =====================================================

export interface ParsedRecommendation {
  recommendationId?: string;
  guideline?: ClinicalGuideline;
  category?: string;
  recommendation?: string;
  rationale?: string;
  evidenceLevel?: string;
  urgency?: string;
  targetValue?: string;
  currentValue?: string;
  gap?: string;
  actionItems?: string[];
}

export interface ParsedGap {
  gapId?: string;
  guideline?: ClinicalGuideline;
  gapType?: string;
  description?: string;
  expectedCare?: string;
  currentState?: string;
  recommendation?: string;
  priority?: string;
}

export interface ParsedMatchResult {
  recommendations?: ParsedRecommendation[];
  adherenceGaps?: ParsedGap[];
  confidence?: number;
  reviewReasons?: string[];
}

// =====================================================
// SCREENING CONFIG TYPE
// =====================================================

export interface ScreeningConfig {
  name: string;
  frequency: string;
  ages: { min: number; max?: number };
  sex?: string;
  guidelineSource: string;
}
