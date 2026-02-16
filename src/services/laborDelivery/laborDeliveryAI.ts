/**
 * L&D AI Integration Service
 *
 * Purpose: Wire existing AI edge functions into the L&D module
 * Calls: ai-care-escalation-scorer, ai-progress-note-synthesizer,
 *   check-drug-interactions, ai-discharge-summary
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type { ServiceResult } from '../_base';
import { success, failure } from '../_base';

// =====================================================
// TYPES — Escalation Scoring
// =====================================================

export interface LDEscalationRecommendation {
  action: string;
  urgency: 'routine' | 'soon' | 'urgent' | 'immediate';
  responsible: string;
  timeframe: string;
  rationale: string;
}

export interface LDEscalationResult {
  assessmentId: string;
  overallEscalationScore: number;
  confidenceLevel: number;
  escalationCategory: 'none' | 'monitor' | 'notify' | 'escalate' | 'emergency';
  urgencyLevel: 'routine' | 'elevated' | 'urgent' | 'critical';
  recommendations: LDEscalationRecommendation[];
  requiredNotifications: string[];
  requiresPhysicianReview: boolean;
  requiresRapidResponse: boolean;
  clinicalSummary: string;
  hoursToReassess: number;
}

// =====================================================
// TYPES — Progress Notes
// =====================================================

export interface LDProgressNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  generatedAt: string;
  model: string;
}

// =====================================================
// TYPES — Drug Interactions
// =====================================================

export interface LDDrugInteraction {
  severity: string;
  interacting_medication: string;
  description: string;
}

export interface LDDrugInteractionResult {
  has_interactions: boolean;
  interactions: LDDrugInteraction[];
  checked_against: string[];
  alternatives?: Array<{
    medication_name: string;
    rationale: string;
    considerations: string[];
  }>;
}

// =====================================================
// TYPES — Discharge Summary
// =====================================================

export interface LDDischargeSummary {
  hospitalCourse: string;
  diagnoses: Array<{ code: string; display: string; type: string }>;
  procedures: string[];
  medications: Array<{ name: string; dose: string; frequency: string; instructions: string }>;
  followUpInstructions: string[];
  warningSignsMother: string[];
  warningSignsNewborn: string[];
  patientEducation: string[];
  generatedAt: string;
  requiresReview: boolean;
  confidenceScore: number;
}

// =====================================================
// ESCALATION SCORING — ai-care-escalation-scorer
// =====================================================

export async function requestEscalationScore(
  patientId: string,
  assessorId: string,
  triggerReason?: string
): Promise<ServiceResult<LDEscalationResult>> {
  try {
    await auditLogger.info('LD_ESCALATION_SCORE_START', {
      patientId,
      skillKey: 'care_escalation_scorer',
    });

    const { data, error } = await supabase.functions.invoke('ai-care-escalation-scorer', {
      body: {
        patientId,
        assessorId,
        context: 'condition_change' as const,
        triggerReason: triggerReason ?? 'L&D clinical data update',
      },
    });

    if (error) {
      await auditLogger.error('LD_ESCALATION_SCORE_FAILED',
        new Error(error.message), { patientId });
      return failure('AI_SERVICE_ERROR', error.message);
    }

    const assessment = data?.assessment as Record<string, unknown> | undefined;
    if (!assessment) {
      return failure('AI_SERVICE_ERROR', 'No assessment returned');
    }

    const result: LDEscalationResult = {
      assessmentId: (assessment.assessmentId as string) ?? '',
      overallEscalationScore: (assessment.overallEscalationScore as number) ?? 0,
      confidenceLevel: (assessment.confidenceLevel as number) ?? 0,
      escalationCategory: (assessment.escalationCategory as LDEscalationResult['escalationCategory']) ?? 'none',
      urgencyLevel: (assessment.urgencyLevel as LDEscalationResult['urgencyLevel']) ?? 'routine',
      recommendations: (assessment.recommendations as LDEscalationRecommendation[]) ?? [],
      requiredNotifications: (assessment.requiredNotifications as string[]) ?? [],
      requiresPhysicianReview: (assessment.requiresPhysicianReview as boolean) ?? false,
      requiresRapidResponse: (assessment.requiresRapidResponse as boolean) ?? false,
      clinicalSummary: (assessment.clinicalSummary as string) ?? '',
      hoursToReassess: (assessment.hoursToReassess as number) ?? 4,
    };

    await auditLogger.info('LD_ESCALATION_SCORE_COMPLETE', {
      patientId,
      score: result.overallEscalationScore,
      category: result.escalationCategory,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LD_ESCALATION_SCORE_ERROR', error, { patientId });
    return failure('AI_SERVICE_ERROR', error.message);
  }
}

// =====================================================
// PROGRESS NOTES — ai-progress-note-synthesizer
// =====================================================

export async function generateLaborProgressNote(
  patientId: string,
  providerId: string
): Promise<ServiceResult<LDProgressNote>> {
  try {
    await auditLogger.info('LD_PROGRESS_NOTE_START', {
      patientId,
      skillKey: 'progress_note_synthesizer',
    });

    const { data, error } = await supabase.functions.invoke('ai-progress-note-synthesizer', {
      body: {
        patientId,
        providerId,
        periodDays: 1,
        noteType: 'focused',
        focusAreas: ['labor progress', 'fetal monitoring', 'maternal vitals', 'medications'],
        includeVitals: true,
        includeMood: true,
        includeActivities: false,
      },
    });

    if (error) {
      await auditLogger.error('LD_PROGRESS_NOTE_FAILED',
        new Error(error.message), { patientId });
      return failure('AI_SERVICE_ERROR', error.message);
    }

    const note = data?.note as Record<string, unknown> | undefined;
    if (!note) {
      return failure('AI_SERVICE_ERROR', 'No progress note returned');
    }

    const result: LDProgressNote = {
      subjective: (note.subjective as string) ?? '',
      objective: (note.objective as string) ?? '',
      assessment: (note.assessment as string) ?? '',
      plan: (note.plan as string) ?? '',
      generatedAt: new Date().toISOString(),
      model: (data?.metadata?.model as string) ?? 'claude-haiku-4-5',
    };

    await auditLogger.info('LD_PROGRESS_NOTE_COMPLETE', { patientId });
    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LD_PROGRESS_NOTE_ERROR', error, { patientId });
    return failure('AI_SERVICE_ERROR', error.message);
  }
}

// =====================================================
// DRUG INTERACTIONS — check-drug-interactions
// =====================================================

/** Common L&D medication RxCUI codes for interaction checking */
const LD_MEDICATION_RXCUI: Record<string, string> = {
  'Oxytocin (Pitocin)': '7052',
  'Magnesium Sulfate': '6585',
  'Misoprostol (Cytotec)': '42331',
  'Methylergonovine (Methergine)': '6837',
  'Carboprost (Hemabate)': '1310271',
  'Terbutaline': '10154',
  'Nifedipine': '7417',
  'Betamethasone': '1514',
  'Fentanyl': '4337',
  'Ondansetron (Zofran)': '26225',
};

export async function checkLDDrugInteraction(
  medicationName: string,
  patientId: string
): Promise<ServiceResult<LDDrugInteractionResult>> {
  try {
    const rxcui = LD_MEDICATION_RXCUI[medicationName] ?? '';

    await auditLogger.info('LD_DRUG_INTERACTION_CHECK_START', {
      patientId,
      medication: medicationName,
    });

    const { data, error } = await supabase.functions.invoke('check-drug-interactions', {
      body: {
        medication_rxcui: rxcui,
        patient_id: patientId,
        medication_name: medicationName,
        suggestAlternatives: true,
        patientConditions: ['pregnancy', 'labor'],
      },
    });

    if (error) {
      await auditLogger.error('LD_DRUG_INTERACTION_CHECK_FAILED',
        new Error(error.message), { patientId, medicationName });
      return failure('AI_SERVICE_ERROR', error.message);
    }

    const result: LDDrugInteractionResult = {
      has_interactions: (data?.has_interactions as boolean) ?? false,
      interactions: (data?.interactions as LDDrugInteraction[]) ?? [],
      checked_against: (data?.checked_against as string[]) ?? [],
      alternatives: data?.alternatives as LDDrugInteractionResult['alternatives'],
    };

    await auditLogger.info('LD_DRUG_INTERACTION_CHECK_COMPLETE', {
      patientId,
      hasInteractions: result.has_interactions,
      interactionCount: result.interactions.length,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LD_DRUG_INTERACTION_CHECK_ERROR', error, { patientId });
    return failure('AI_SERVICE_ERROR', error.message);
  }
}

// =====================================================
// DISCHARGE SUMMARY — ai-discharge-summary
// =====================================================

export async function generateDischargeSummary(
  patientId: string,
  tenantId: string
): Promise<ServiceResult<LDDischargeSummary>> {
  try {
    await auditLogger.info('LD_DISCHARGE_SUMMARY_START', {
      patientId,
      skillKey: 'discharge_summary_generator',
    });

    // We pass patientId as encounterId since L&D uses pregnancy as the encounter
    const { data, error } = await supabase.functions.invoke('ai-discharge-summary', {
      body: {
        patientId,
        encounterId: patientId,
        tenantId,
        includePatientInstructions: true,
      },
    });

    if (error) {
      await auditLogger.error('LD_DISCHARGE_SUMMARY_FAILED',
        new Error(error.message), { patientId });
      return failure('AI_SERVICE_ERROR', error.message);
    }

    const summary = data?.summary as Record<string, unknown> | undefined;
    if (!summary) {
      return failure('AI_SERVICE_ERROR', 'No discharge summary returned');
    }

    const result: LDDischargeSummary = {
      hospitalCourse: (summary.hospitalCourse as string) ?? '',
      diagnoses: (summary.diagnoses as LDDischargeSummary['diagnoses']) ?? [],
      procedures: (summary.procedures as string[]) ?? [],
      medications: (summary.medications as LDDischargeSummary['medications']) ?? [],
      followUpInstructions: (summary.followUpInstructions as string[]) ?? [],
      warningSignsMother: (summary.warningSignsMother as string[]) ??
        (summary.redFlags as string[]) ?? [],
      warningSignsNewborn: (summary.warningSignsNewborn as string[]) ?? [],
      patientEducation: (summary.patientEducation as string[]) ?? [],
      generatedAt: new Date().toISOString(),
      requiresReview: true,
      confidenceScore: (data?.metadata?.confidence as number) ?? 0.85,
    };

    await auditLogger.info('LD_DISCHARGE_SUMMARY_COMPLETE', { patientId });
    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LD_DISCHARGE_SUMMARY_ERROR', error, { patientId });
    return failure('AI_SERVICE_ERROR', error.message);
  }
}
