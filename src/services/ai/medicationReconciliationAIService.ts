/**
 * Medication Reconciliation AI Service
 *
 * AI-enhanced medication reconciliation that goes beyond rule-based discrepancy detection
 * to provide clinical reasoning, deprescribing opportunities, and patient counseling.
 *
 * Enhances the existing MedicationReconciliationService with:
 * 1. Clinical reasoning for WHY discrepancies occurred
 * 2. Deprescribing opportunities for polypharmacy reduction
 * 3. Patient counseling generation
 * 4. Pharmacy verification checklists
 * 5. Priority-ranked action items
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy - medication safety is critical.
 *
 * SAFETY GUARDRAILS:
 * 1. ALL outputs require clinician review (requiresReview: true)
 * 2. Pharmacist review required for high-severity discrepancies
 * 3. Never auto-approve medication changes
 * 4. PHI protection in all logs
 *
 * @module medicationReconciliationAIService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MedicationEntry {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  rxcui?: string;
  startDate?: string;
  endDate?: string;
  prescriber?: string;
  indication?: string;
}

export interface MedicationSource {
  /** Medications from admission/prior to encounter */
  admission: MedicationEntry[];
  /** Medications prescribed during encounter */
  prescribed: MedicationEntry[];
  /** Patient's current/home medications */
  current: MedicationEntry[];
  /** Medications at discharge (if applicable) */
  discharge?: MedicationEntry[];
}

export interface DiscrepancyAnalysis {
  /** Medication involved */
  medication: string;
  /** Type of discrepancy */
  discrepancyType: 'missing' | 'duplicate' | 'dose_change' | 'route_change' | 'new' | 'discontinued' | 'frequency_change';
  /** AI-generated explanation of WHY this discrepancy occurred */
  likelyReason: string;
  /** Clinical significance */
  clinicalSignificance: 'critical' | 'high' | 'medium' | 'low';
  /** Recommended action */
  recommendation: string;
  /** Whether pharmacist review is specifically required */
  requiresPharmacistReview: boolean;
  /** Confidence in this analysis */
  confidence: number;
}

export interface DeprescribingCandidate {
  /** Medication that may be a candidate for deprescribing */
  medication: string;
  /** Reason this medication is a deprescribing candidate */
  reason: string;
  /** Evidence/guideline supporting deprescribing */
  evidence: string;
  /** Risk if medication is continued unnecessarily */
  riskIfContinued: string;
  /** Suggested approach for deprescribing */
  suggestedApproach: string;
  /** Priority (high = strong candidate, low = consider) */
  priority: 'high' | 'medium' | 'low';
}

export interface PatientCounselingPoint {
  /** Topic for counseling */
  topic: string;
  /** Key points to discuss with patient */
  keyPoints: string[];
  /** Medications to specifically discuss */
  relatedMedications: string[];
  /** Warning signs patient should watch for */
  warningSignsToWatch?: string[];
}

export interface ReconciliationSummary {
  /** Continued medications (no change) */
  continued: MedicationEntry[];
  /** New medications added */
  new: MedicationEntry[];
  /** Medications with changes */
  changed: Array<{
    medication: string;
    changeType: string;
    from: string;
    to: string;
  }>;
  /** Discontinued medications */
  discontinued: MedicationEntry[];
  /** Known allergies considered */
  allergiesConsidered: string[];
  /** Drug interactions identified */
  interactionsIdentified: string[];
}

export interface MedicationReconciliationAIResult {
  /** Standard reconciliation summary */
  reconciliationSummary: ReconciliationSummary;
  /** AI-enhanced discrepancy analysis */
  discrepancyAnalysis: DiscrepancyAnalysis[];
  /** Deprescribing opportunities */
  deprescribingCandidates: DeprescribingCandidate[];
  /** Patient counseling points */
  patientCounseling: PatientCounselingPoint[];
  /** Pharmacy verification checklist */
  pharmacyChecklist: string[];
  /** Priority-ranked action items */
  actionItems: Array<{
    priority: 'immediate' | 'high' | 'medium' | 'low';
    action: string;
    rationale: string;
  }>;
  /** Overall medication count statistics */
  statistics: {
    totalMedicationsReviewed: number;
    continued: number;
    new: number;
    changed: number;
    discontinued: number;
    discrepanciesFound: number;
    deprescribingOpportunities: number;
  };
  /** AI confidence in overall analysis */
  confidence: number;
  /** Whether clinical review is required */
  requiresReview: boolean;
  /** Reasons for requiring review */
  reviewReasons: string[];
  /** Whether pharmacist review is specifically required */
  pharmacistReviewRequired: boolean;
  /** AI-generated narrative summary */
  narrativeSummary: string;
}

export interface MedicationReconciliationRequest {
  /** Patient ID */
  patientId: string;
  /** Provider performing reconciliation */
  providerId: string;
  /** Medication sources to reconcile */
  medications: MedicationSource;
  /** Patient's known allergies */
  allergies?: string[];
  /** Patient's active conditions (for clinical context) */
  activeConditions?: Array<{ code: string; display: string }>;
  /** Recent lab values (for dosing considerations) */
  labValues?: {
    creatinine?: number;
    eGFR?: number;
    alt?: number;
    ast?: number;
  };
  /** Patient age (for age-appropriate prescribing) */
  patientAge?: number;
  /** Encounter type (admission, discharge, transfer) */
  encounterType?: 'admission' | 'discharge' | 'transfer' | 'ambulatory';
  /** Tenant ID */
  tenantId?: string;
}

export interface MedicationReconciliationResponse {
  /** AI analysis result */
  result: MedicationReconciliationAIResult;
  /** Metadata about the generation */
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    encounterType: string;
  };
}

export interface SavedReconciliation {
  id: string;
  reconciliationId: string;
  patientId: string;
  providerId: string;
  encounterType: string;
  medicationSources: MedicationSource;
  result: MedicationReconciliationAIResult;
  status: 'pending_review' | 'reviewed' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class MedicationReconciliationAIService {
  /**
   * Perform AI-enhanced medication reconciliation
   *
   * @param request - Reconciliation request with medication sources
   * @returns ServiceResult with AI analysis or error
   */
  static async performReconciliation(
    request: MedicationReconciliationRequest
  ): Promise<ServiceResult<MedicationReconciliationResponse>> {
    try {
      // Validate required fields
      if (!request.patientId?.trim()) {
        return failure('INVALID_INPUT', 'Patient ID is required');
      }

      if (!request.providerId?.trim()) {
        return failure('INVALID_INPUT', 'Provider ID is required');
      }

      if (!request.medications) {
        return failure('INVALID_INPUT', 'Medication sources are required');
      }

      const totalMeds =
        (request.medications.admission?.length || 0) +
        (request.medications.prescribed?.length || 0) +
        (request.medications.current?.length || 0) +
        (request.medications.discharge?.length || 0);

      if (totalMeds === 0) {
        return failure('INVALID_INPUT', 'At least one medication list is required');
      }

      // Invoke edge function
      const { data, error } = await supabase.functions.invoke('ai-medication-reconciliation', {
        body: {
          patientId: request.patientId,
          providerId: request.providerId,
          medications: request.medications,
          allergies: request.allergies || [],
          activeConditions: request.activeConditions || [],
          labValues: request.labValues,
          patientAge: request.patientAge,
          encounterType: request.encounterType || 'ambulatory',
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      const response = data as MedicationReconciliationResponse;

      // Apply safety guardrails
      response.result = this.applyGuardrails(response.result);

      return success(response);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('MEDICATION_RECONCILIATION_FAILED', error.message, error);
    }
  }

  /**
   * Save reconciliation result to database
   *
   * @param request - Original request
   * @param response - AI response to save
   * @returns ServiceResult with saved record
   */
  static async saveReconciliation(
    request: MedicationReconciliationRequest,
    response: MedicationReconciliationResponse
  ): Promise<ServiceResult<SavedReconciliation>> {
    try {
      const reconciliationId = crypto.randomUUID();

      const { data, error } = await supabase
        .from('ai_medication_reconciliations')
        .insert({
          reconciliation_id: reconciliationId,
          patient_id: request.patientId,
          provider_id: request.providerId,
          encounter_type: request.encounterType || 'ambulatory',
          medication_sources: request.medications,
          allergies: request.allergies || [],
          active_conditions: request.activeConditions || [],
          lab_values: request.labValues,
          patient_age: request.patientAge,
          result: response.result,
          confidence: response.result.confidence,
          requires_review: response.result.requiresReview,
          review_reasons: response.result.reviewReasons,
          pharmacist_review_required: response.result.pharmacistReviewRequired,
          status: 'pending_review',
        })
        .select()
        .single();

      if (error) throw error;

      return success(this.mapDbToSaved(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('RECONCILIATION_SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Record review decision for a reconciliation
   *
   * @param reconciliationId - Reconciliation record ID
   * @param reviewerId - Reviewer's user ID
   * @param decision - Approval decision
   * @param notes - Optional review notes
   * @returns ServiceResult with updated record
   */
  static async recordReviewDecision(
    reconciliationId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected',
    notes?: string
  ): Promise<ServiceResult<SavedReconciliation>> {
    try {
      const { data, error } = await supabase
        .from('ai_medication_reconciliations')
        .update({
          status: decision === 'approved' ? 'approved' : 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reconciliationId)
        .select()
        .single();

      if (error) throw error;

      return success(this.mapDbToSaved(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('RECONCILIATION_REVIEW_FAILED', error.message, error);
    }
  }

  /**
   * Get reconciliation history for a patient
   *
   * @param patientId - Patient UUID
   * @param limit - Maximum records to return
   * @returns ServiceResult with reconciliation history
   */
  static async getPatientHistory(
    patientId: string,
    limit: number = 20
  ): Promise<ServiceResult<SavedReconciliation[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_medication_reconciliations')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return success((data || []).map(this.mapDbToSaved));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('HISTORY_FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Generate a printable reconciliation summary
   *
   * @param result - Reconciliation result
   * @param patientName - Patient name for header
   * @returns Formatted string for printing
   */
  static formatForPrint(result: MedicationReconciliationAIResult, patientName: string): string {
    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════',
      'MEDICATION RECONCILIATION SUMMARY',
      '═══════════════════════════════════════════════════════════════',
      `Patient: ${patientName}`,
      `Date: ${new Date().toLocaleDateString()}`,
      '',
      '── NARRATIVE SUMMARY ──',
      result.narrativeSummary,
      '',
      '── MEDICATION CHANGES ──',
      '',
      `CONTINUED (${result.reconciliationSummary.continued.length}):`,
      ...result.reconciliationSummary.continued.map(
        (m) => `  • ${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`
      ),
      '',
      `NEW (${result.reconciliationSummary.new.length}):`,
      ...result.reconciliationSummary.new.map(
        (m) => `  + ${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`
      ),
      '',
      `CHANGED (${result.reconciliationSummary.changed.length}):`,
      ...result.reconciliationSummary.changed.map(
        (c) => `  Δ ${c.medication}: ${c.from} → ${c.to} (${c.changeType})`
      ),
      '',
      `DISCONTINUED (${result.reconciliationSummary.discontinued.length}):`,
      ...result.reconciliationSummary.discontinued.map(
        (m) => `  ✗ ${m.name}${m.dosage ? ` ${m.dosage}` : ''}`
      ),
      '',
    ];

    if (result.discrepancyAnalysis.length > 0) {
      lines.push('── DISCREPANCIES REQUIRING ATTENTION ──', '');
      result.discrepancyAnalysis.forEach((d, i) => {
        lines.push(
          `${i + 1}. [${d.clinicalSignificance.toUpperCase()}] ${d.medication}`,
          `   Type: ${d.discrepancyType}`,
          `   Reason: ${d.likelyReason}`,
          `   Action: ${d.recommendation}`,
          ''
        );
      });
    }

    if (result.deprescribingCandidates.length > 0) {
      lines.push('── DEPRESCRIBING OPPORTUNITIES ──', '');
      result.deprescribingCandidates.forEach((d) => {
        lines.push(
          `• ${d.medication} [${d.priority}]`,
          `  Reason: ${d.reason}`,
          `  Approach: ${d.suggestedApproach}`,
          ''
        );
      });
    }

    if (result.actionItems.length > 0) {
      lines.push('── ACTION ITEMS ──', '');
      result.actionItems.forEach((a) => {
        lines.push(`[${a.priority.toUpperCase()}] ${a.action}`);
      });
      lines.push('');
    }

    lines.push(
      '═══════════════════════════════════════════════════════════════',
      `Generated: ${new Date().toISOString()}`,
      'This document requires clinician review before implementation.',
      '═══════════════════════════════════════════════════════════════'
    );

    return lines.join('\n');
  }

  /**
   * Apply safety guardrails to ensure clinical review
   */
  private static applyGuardrails(
    result: MedicationReconciliationAIResult
  ): MedicationReconciliationAIResult {
    // SAFETY: Always require review
    result.requiresReview = true;

    // Initialize review reasons if empty
    if (!result.reviewReasons || result.reviewReasons.length === 0) {
      result.reviewReasons = ['All medication reconciliations require clinician review'];
    }

    // SAFETY: Multiple discrepancies require pharmacist
    if (result.discrepancyAnalysis.length >= 3) {
      result.pharmacistReviewRequired = true;
      if (!result.reviewReasons.includes('Multiple discrepancies require pharmacist review')) {
        result.reviewReasons.push('Multiple discrepancies require pharmacist review');
      }
    }

    // SAFETY: Critical discrepancies require immediate attention
    const criticalDiscrepancies = result.discrepancyAnalysis.filter(
      (d) => d.clinicalSignificance === 'critical'
    );
    if (criticalDiscrepancies.length > 0) {
      result.pharmacistReviewRequired = true;
      if (!result.reviewReasons.includes('Critical discrepancy detected - immediate review required')) {
        result.reviewReasons.push('Critical discrepancy detected - immediate review required');
      }
    }

    // SAFETY: Deprescribing requires physician review
    if (result.deprescribingCandidates.length > 0) {
      if (!result.reviewReasons.includes('Deprescribing opportunities identified - physician review required')) {
        result.reviewReasons.push('Deprescribing opportunities identified - physician review required');
      }
    }

    // SAFETY: Low confidence requires careful review
    if (result.confidence < 0.7) {
      if (!result.reviewReasons.includes('Low confidence - careful clinical review recommended')) {
        result.reviewReasons.push('Low confidence - careful clinical review recommended');
      }
    }

    return result;
  }

  /**
   * Map database row to typed object
   */
  private static mapDbToSaved(row: Record<string, unknown>): SavedReconciliation {
    return {
      id: row.id as string,
      reconciliationId: row.reconciliation_id as string,
      patientId: row.patient_id as string,
      providerId: row.provider_id as string,
      encounterType: row.encounter_type as string,
      medicationSources: row.medication_sources as MedicationSource,
      result: row.result as MedicationReconciliationAIResult,
      status: row.status as 'pending_review' | 'reviewed' | 'approved' | 'rejected',
      reviewedBy: row.reviewed_by as string | undefined,
      reviewedAt: row.reviewed_at as string | undefined,
      reviewNotes: row.review_notes as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export default MedicationReconciliationAIService;
