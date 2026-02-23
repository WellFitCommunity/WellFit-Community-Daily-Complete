/**
 * useSmartScribe.types.ts — Type definitions for SmartScribe hook
 *
 * Extracted from useSmartScribe.ts for modularity.
 * All types are re-exported from useSmartScribe.ts for zero-breaking-change imports.
 */

// Re-export feedback types for consumers
export type { SessionFeedbackData } from '../../../services/scribeFeedbackService';

// ============================================================================
// Core Types
// ============================================================================

export interface CodeSuggestion {
  code: string;
  type: 'CPT' | 'ICD10' | 'HCPCS';
  description: string;
  reimbursement: number;
  confidence: number;
  reasoning?: string;
  transcriptEvidence?: string;
  missingDocumentation?: string;
}

/** Grounding flags from anti-hallucination system */
export interface GroundingFlags {
  statedCount: number;
  inferredCount: number;
  gapCount: number;
  gaps?: string[];
}

/** MDM complexity summary from progressive reasoning */
export interface MDMComplexitySummary {
  overallLevel: string;
  suggestedEMCode: string;
  nextLevelGap?: string;
}

/** Clinical completeness summary from progressive reasoning */
export interface CompletenessSummary {
  overallPercent: number;
  hpiLevel: string;
  rosLevel: string;
  expectedButMissing: string[];
}

/** Diagnosis summary from progressive reasoning */
export interface DiagnosisSummary {
  condition: string;
  icd10?: string;
  confidence: number;
}

/** Drift state summary from conversation drift guard */
export interface DriftStateSummary {
  primaryDomain: string | null;
  relatedDomains: string[];
  driftDetected: boolean;
  driftDescription: string | null;
}

/** Patient safety flags from drift guard */
export interface PatientSafetySummary {
  patientDirectAddress: boolean;
  emergencyDetected: boolean;
  emergencyReason: string | null;
  requiresProviderConsult: boolean;
  consultReason: string | null;
}

/** Evidence citation from PubMed search (Session 4: Evidence-Based Reasoning) */
export interface EvidenceCitationSummary {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: string;
  doi: string;
  relevanceNote: string;
}

/** Evidence search result (Session 4) */
export interface EvidenceSearchResultSummary {
  query: string;
  trigger: string;
  triggerDetail: string;
  citations: EvidenceCitationSummary[];
  searchTimeMs: number;
}

/** Guideline reference match (Session 5: Guideline Matcher Integration) */
export interface GuidelineMatchSummary {
  condition: string;
  icd10: string;
  guidelines: Array<{
    organization: string;
    guidelineName: string;
    year: number;
    keyRecommendations: string[];
    monitoringTargets: Array<{ metric: string; target: string; frequency: string }>;
    adherenceChecklist: string[];
  }>;
  adherenceFlags: string[];
  preventiveCareReminders: string[];
}

/** Treatment pathway step (Session 6: Treatment Pathway Integration) */
export interface TreatmentStepSummary {
  phase: string;
  intervention: string;
  medicationClass?: string;
  examples?: string[];
  evidenceLevel: string;
  guidelineSource: string;
  contraindications: string[];
  sdohNote?: string;
}

/** Treatment pathway result (Session 6) */
export interface TreatmentPathwaySummary {
  condition: string;
  icd10: string;
  pathway: {
    condition: string;
    treatmentGoal: string;
    steps: TreatmentStepSummary[];
    redFlags: string[];
    lifestyleRecommendations: string[];
  };
}

/** Session 8: Structured cannot-miss diagnosis */
export interface CannotMissDiagnosisSummary {
  diagnosis: string;
  severity: 'life-threatening' | 'emergent' | 'urgent';
  whyDangerous: string;
  distinguishingFeatures: string[];
  ruleOutTest: string;
  timeframe: string;
}

/** Consultation response (Sessions 7-8: Physician Consultation Mode) */
export interface ConsultationResponseSummary {
  casePresentation: {
    oneLiner: string;
    hpi: string;
    pastMedicalHistory: string[];
    medications: string[];
    allergies: string[];
    socialHistory: string[];
    familyHistory: string[];
    ros: string[];
    physicalExam: Record<string, string[]>;
    diagnostics: string[];
    assessment: string;
    differentials: Array<{
      diagnosis: string;
      icd10?: string;
      probability: 'high' | 'moderate' | 'low';
      supporting: string[];
      against: string[];
      /** Session 8: Red flag symptoms */
      redFlags?: string[];
      /** Session 8: Single most discriminating test */
      keyTest?: string;
      /** Session 8: Brief PubMed-sourced note */
      literatureNote?: string;
    }>;
    plan: string[];
  };
  reasoningSteps: Array<{
    question: string;
    analysis: string;
    considerations: string[];
    pivotPoints: string[];
  }>;
  /** Session 8: Structured cannot-miss (backwards-compat: accepts string[] or structured) */
  cannotMiss: CannotMissDiagnosisSummary[] | string[];
  suggestedWorkup: string[];
  guidelineNotes: string[];
  confidenceCalibration: {
    highConfidence: string[];
    uncertain: string[];
    insufficientData: string[];
  };
  groundingFlags: {
    statedCount: number;
    inferredCount: number;
    gapCount: number;
    gaps: string[];
  };
}

/** Session 8: Peer consult prep summary */
export interface ConsultPrepSummary {
  targetSpecialty: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  criticalData: string[];
  consultQuestion: string;
  urgency: 'stat' | 'urgent' | 'routine';
}

/** Encounter state summary sent from edge function (progressive clinical reasoning) */
export interface EncounterStateSummary {
  currentPhase: string;
  analysisCount: number;
  chiefComplaint: string | null;
  diagnosisCount: number;
  activeDiagnoses: DiagnosisSummary[];
  mdmComplexity: MDMComplexitySummary;
  completeness: CompletenessSummary;
  medicationCount: number;
  planItemCount: number;
  driftState: DriftStateSummary;
  patientSafety: PatientSafetySummary;
}

export interface ConversationalMessage {
  type: 'scribe' | 'system';
  message: string;
  timestamp: Date;
  context?: 'greeting' | 'suggestion' | 'code' | 'reminder';
}

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  hpi: string;
  ros: string;
}

// WebSocket response data for code suggestions
export interface CodeSuggestionResponse {
  type: 'code_suggestion';
  codes?: CodeSuggestion[];
  revenueIncrease?: number;
  soapNote?: Partial<SOAPNote>;
  conversational_note?: string;
  suggestions?: string[];
  groundingFlags?: GroundingFlags;
  /** Progressive reasoning: encounter state summary */
  encounterState?: EncounterStateSummary;
}

export interface AssistanceSettings {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  showConversationalMessages: boolean;
  showSuggestions: boolean;
  showReasoningDetails: boolean;
}

export interface UseSmartScribeProps {
  selectedPatientId?: string;
  selectedPatientName?: string;
  onSessionComplete?: (sessionId: string) => void;
  /** Force demo mode regardless of env var. When true, simulates a patient visit. */
  forceDemoMode?: boolean;
  /** Scribe mode - 'smartscribe' for nurses, 'compass-riley' for physicians, 'consultation' for clinical reasoning */
  scribeMode?: 'smartscribe' | 'compass-riley' | 'consultation';
}
