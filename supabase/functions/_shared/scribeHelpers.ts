// Shared helpers for real-time medical transcription edge functions
// Extracted from realtime_medical_transcription/index.ts for 600-line compliance
// Session 7 of Compass Riley Clinical Reasoning Hardening
// SmartScribe nurse guardrail hardening: fallback prompt builders added (2026-02-23)

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type { EncounterState } from './encounterStateManager.ts';
import { CONDENSED_GROUNDING_RULES, NURSE_SCOPE_GUARD } from './clinicalGroundingRules.ts';
import { CONDENSED_DRIFT_GUARD } from './conversationDriftGuard.ts';

/** Parsed transcription analysis response from Claude */
export interface TranscriptionAnalysis {
  conversational_note?: string;
  suggestedCodes?: Array<{
    code: string;
    type?: string;
    description?: string;
    reimbursement?: number;
    confidence?: number;
    reasoning?: string;
    transcriptEvidence?: string;
    missingDocumentation?: string;
  }>;
  totalRevenueIncrease?: number;
  complianceRisk?: string;
  conversational_suggestions?: string[];
  soapNote?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    hpi?: string;
    ros?: string;
  };
  groundingFlags?: {
    statedCount?: number;
    inferredCount?: number;
    gapCount?: number;
    gaps?: string[];
  };
  /** Progressive reasoning: encounter state update from this analysis chunk */
  encounterStateUpdate?: Partial<EncounterState>;
}

/** Standard audit logger interface for edge functions */
export interface AuditLogger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  security: (message: string, data?: Record<string, unknown>) => void;
  phi: (message: string, data?: Record<string, unknown>) => void;
}

/** Audit log parameters for Claude API calls */
export interface ClaudeAuditParams {
  requestId: string;
  userId: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  responseTimeMs: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  transcriptLength: number;
  metadata?: Record<string, unknown>;
}

/** Insert a claude_api_audit row (fire-and-forget) */
export async function logClaudeAudit(
  client: SupabaseClient, logger: AuditLogger, params: ClaudeAuditParams
): Promise<void> {
  try {
    await client.from('claude_api_audit').insert({
      request_id: params.requestId, user_id: params.userId,
      request_type: 'transcription', model: 'claude-sonnet-4-5-20250929',
      input_tokens: params.inputTokens, output_tokens: params.outputTokens,
      cost: params.cost, response_time_ms: params.responseTimeMs,
      success: params.success, error_code: params.errorCode ?? null,
      error_message: params.errorMessage ?? null, phi_scrubbed: true,
      metadata: { transcript_length: params.transcriptLength, ...(params.metadata || {}) }
    });
  } catch (logError: unknown) {
    logger.error('Audit log insertion failed', {
      error: logError instanceof Error ? logError.message : String(logError),
    });
  }
}

/** Client-safe encounter state serialization for WebSocket responses */
export function serializeEncounterStateForClient(state: EncounterState): Record<string, unknown> {
  return {
    currentPhase: state.currentPhase,
    analysisCount: state.analysisCount,
    chiefComplaint: state.chiefComplaint,
    diagnosisCount: state.diagnoses.length,
    activeDiagnoses: state.diagnoses
      .filter(d => d.status !== 'ruled_out')
      .map(d => ({ condition: d.condition, icd10: d.icd10, confidence: d.confidence })),
    mdmComplexity: {
      overallLevel: state.mdmComplexity.overallLevel,
      suggestedEMCode: state.mdmComplexity.suggestedEMCode,
      nextLevelGap: state.mdmComplexity.nextLevelGap,
    },
    completeness: {
      overallPercent: state.completeness.overallPercent,
      hpiLevel: state.completeness.hpiLevel,
      rosLevel: state.completeness.rosLevel,
      expectedButMissing: state.completeness.expectedButMissing,
    },
    medicationCount: state.medications.length,
    planItemCount: state.planItems.length,
    driftState: {
      primaryDomain: state.driftState.primaryDomain,
      relatedDomains: state.driftState.relatedDomains,
      driftDetected: state.driftState.driftDetected,
      driftDescription: state.driftState.driftDescription ?? null,
    },
    patientSafety: {
      patientDirectAddress: state.patientSafety.patientDirectAddress,
      emergencyDetected: state.patientSafety.emergencyDetected,
      emergencyReason: state.patientSafety.emergencyReason ?? null,
      requiresProviderConsult: state.patientSafety.requiresProviderConsult,
      consultReason: state.patientSafety.consultReason ?? null,
    },
  };
}

/**
 * Nurse-mode fallback prompt for realtime_medical_transcription
 * Used when prefs is null AND scribeMode === "smartscribe"
 * Focuses on transcription accuracy — no billing, no MDM, no revenue optimization
 */
export function buildNurseFallbackPrompt(transcript: string): string {
  return `You are SmartScribe — a voice-to-text documentation assistant for nurses. Your job is accurate transcription and organized nursing documentation, NOT billing.

${CONDENSED_GROUNDING_RULES}
${NURSE_SCOPE_GUARD}
${CONDENSED_DRIFT_GUARD}

TRANSCRIPT (PHI-SCRUBBED):
${transcript}

Return ONLY strict JSON:
{
  "conversational_note": "Brief helpful comment about the documentation (1-2 sentences)",
  "soapNote": {
    "subjective": "ONLY what the patient reported — quote key phrases from transcript. Mark unmentioned elements as '[NOT DOCUMENTED]'. 2-4 sentences.",
    "objective": "ONLY vitals, exam findings, and assessments explicitly stated in transcript. Do NOT add findings not described. Mark missing expected elements as '[GAP]'. 2-3 sentences.",
    "assessment": "Nursing assessment connecting ONLY documented findings. Every assessment must trace to transcript evidence. 2-3 sentences.",
    "plan": "ONLY nursing interventions and care plan updates stated. Do NOT invent actions not discussed. 3-5 bullet points."
  },
  "conversational_suggestions": ["1-2 documentation tips"],
  "groundingFlags": {
    "statedCount": 0,
    "inferredCount": 0,
    "gapCount": 0,
    "gaps": ["List expected nursing assessment elements not found in transcript"]
  }
}`;
}

/**
 * Physician-mode fallback prompt for realtime_medical_transcription
 * Used when prefs is null AND scribeMode !== "smartscribe"
 * Full SOAP + billing codes + grounding + drift guard
 */
export function buildPhysicianFallbackPrompt(transcript: string): string {
  return `You are an experienced, intelligent medical scribe with deep clinical knowledge. Analyze this encounter transcript and generate:

1. **Complete SOAP Note** - Professional clinical documentation ready for EHR
2. **Billing Codes** - Accurate CPT, ICD-10, HCPCS codes
3. **Conversational Coaching** - Helpful suggestions for the provider

${CONDENSED_GROUNDING_RULES}
${CONDENSED_DRIFT_GUARD}

TRANSCRIPT (PHI-SCRUBBED):
${transcript}

Return ONLY strict JSON:
{
  "conversational_note": "Brief friendly comment about the encounter (1-2 sentences, conversational tone)",

  "soapNote": {
    "subjective": "ONLY what the patient reported — quote key phrases from transcript. If OLDCARTS elements were not mentioned, write '[NOT DOCUMENTED]' for those elements. 2-4 sentences.",
    "objective": "ONLY vitals, exam findings, and labs explicitly stated in transcript. Do NOT add findings not described. Mark missing expected elements as '[GAP]'. 2-3 sentences.",
    "assessment": "Clinical reasoning connecting ONLY documented findings to diagnoses. Every diagnosis must trace to transcript evidence. Include ICD-10 codes. 2-3 sentences.",
    "plan": "ONLY actions the provider stated they will take. Do NOT invent follow-up plans, referrals, or medication changes not discussed. 3-5 bullet points.",
    "hpi": "Narrative HPI using ONLY information from the transcript. For OLDCARTS elements not mentioned, write '[NOT DOCUMENTED]'. 3-5 sentences.",
    "ros": "ONLY review-of-systems elements actually discussed. Systems not reviewed should be listed as '[NOT REVIEWED]' — never fabricate negative findings. 2-4 sentences."
  },

  "suggestedCodes": [
    {"code": "99214", "type": "CPT", "description": "Office visit, moderate complexity", "reimbursement": 164.00, "confidence": 0.92, "reasoning": "Why this code fits", "transcriptEvidence": "Quote from transcript", "missingDocumentation": "What to add"}
  ],
  "totalRevenueIncrease": 164.00,
  "complianceRisk": "low",
  "conversational_suggestions": ["1-2 tips"],
  "groundingFlags": {
    "statedCount": 0,
    "inferredCount": 0,
    "gapCount": 0,
    "gaps": ["List expected elements not found in transcript"]
  }
}`;
}
