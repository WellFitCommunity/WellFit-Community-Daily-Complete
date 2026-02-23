// Shared helpers for real-time medical transcription edge functions
// Extracted from realtime_medical_transcription/index.ts for 600-line compliance
// Session 7 of Compass Riley Clinical Reasoning Hardening

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type { EncounterState } from './encounterStateManager.ts';

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
