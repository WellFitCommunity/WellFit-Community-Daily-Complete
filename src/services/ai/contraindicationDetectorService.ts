/**
 * Contraindication Detector AI Service
 *
 * Performs comprehensive patient-specific contraindication checking for medications.
 * Goes beyond simple drug-drug interactions to evaluate clinical context.
 *
 * Checks:
 * 1. Medication vs Patient Conditions (disease-drug contraindications)
 * 2. Medication vs Allergies (cross-reactivity, drug class allergies)
 * 3. Medication vs Lab Values (renal function, liver function, electrolytes)
 * 4. Age-specific contraindications
 * 5. Pregnancy/Lactation contraindications
 * 6. Organ impairment (renal, hepatic dosing considerations)
 *
 * Uses Claude Sonnet 4.5 for clinical reasoning and safety.
 *
 * SAFETY GUARDRAILS:
 * 1. All contraindicated findings require clinical review
 * 2. Never auto-approve medications with contraindications
 * 3. PHI protection in all logs
 * 4. Evidence-based reasoning for each finding
 *
 * @module contraindicationDetectorService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ContraindicationType =
  | 'disease_contraindication'
  | 'allergy_contraindication'
  | 'drug_class_allergy'
  | 'lab_value_contraindication'
  | 'age_contraindication'
  | 'pregnancy_contraindication'
  | 'lactation_contraindication'
  | 'renal_impairment'
  | 'hepatic_impairment'
  | 'drug_drug_interaction';

export type ContraindicationSeverity = 'contraindicated' | 'high' | 'moderate' | 'low';

export interface ContraindicationCheckRequest {
  /** Patient ID (UUID) */
  patientId: string;
  /** Provider ID requesting the check */
  providerId: string;
  /** Medication RxCUI code */
  medicationRxcui: string;
  /** Medication display name */
  medicationName: string;
  /** Indication for prescribing */
  indication?: string;
  /** Proposed dosage */
  proposedDosage?: string;
  /** Include drug-drug interaction check */
  includeDrugInteractions?: boolean;
  /** Tenant ID for multi-tenant support */
  tenantId?: string;
}

export interface ContraindicationFinding {
  /** Type of contraindication found */
  type: ContraindicationType;
  /** Severity level */
  severity: ContraindicationSeverity;
  /** Brief title of the finding */
  title: string;
  /** Detailed description */
  description: string;
  /** Clinical reasoning for this finding */
  clinicalReasoning: string;
  /** What triggered this finding */
  triggerFactor: string;
  /** Evidence-based recommendations */
  recommendations: string[];
  /** Alternative medications if applicable */
  alternatives?: string[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Source of the information */
  source: 'ai_analysis' | 'drug_database' | 'clinical_guideline';
}

export interface PatientContext {
  /** Patient demographics */
  demographics: {
    age?: number;
    sex?: 'male' | 'female' | 'other';
    weight?: number;
    pregnancyStatus?: 'pregnant' | 'possibly_pregnant' | 'not_pregnant' | 'unknown';
    lactationStatus?: 'breastfeeding' | 'not_breastfeeding' | 'unknown';
  };
  /** Active medical conditions */
  activeConditions: Array<{
    code: string;
    display: string;
    category?: string;
  }>;
  /** Current medications */
  activeMedications: Array<{
    rxcui?: string;
    name: string;
    dosage?: string;
  }>;
  /** Known allergies */
  allergies: Array<{
    allergen: string;
    allergenType: 'medication' | 'food' | 'environment' | 'biologic';
    severity?: 'mild' | 'moderate' | 'severe';
    criticality?: 'low' | 'high';
    reactions?: string[];
  }>;
  /** Recent lab values */
  labValues: {
    /** Creatinine in mg/dL */
    creatinine?: number;
    /** eGFR in mL/min/1.73m² */
    eGFR?: number;
    /** BUN in mg/dL */
    bun?: number;
    /** ALT in U/L */
    alt?: number;
    /** AST in U/L */
    ast?: number;
    /** Bilirubin in mg/dL */
    bilirubin?: number;
    /** Potassium in mEq/L */
    potassium?: number;
    /** Sodium in mEq/L */
    sodium?: number;
    /** INR */
    inr?: number;
    /** Platelets in K/uL */
    platelets?: number;
  };
}

export interface ContraindicationCheckResult {
  /** Overall safety assessment */
  overallAssessment: 'safe' | 'caution' | 'warning' | 'contraindicated';
  /** Whether clinical review is required */
  requiresClinicalReview: boolean;
  /** Reasons for requiring review */
  reviewReasons: string[];
  /** All findings */
  findings: ContraindicationFinding[];
  /** Count by severity */
  findingsSummary: {
    contraindicated: number;
    high: number;
    moderate: number;
    low: number;
    total: number;
  };
  /** Patient context used for analysis */
  patientContext: PatientContext;
  /** Overall confidence in the assessment */
  confidence: number;
  /** AI-generated summary */
  clinicalSummary: string;
}

export interface ContraindicationCheckResponse {
  /** Check results */
  result: ContraindicationCheckResult;
  /** Medication checked */
  medication: {
    rxcui: string;
    name: string;
    proposedDosage?: string;
  };
  /** Generation metadata */
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    checksPerformed: string[];
  };
}

export interface SavedContraindicationCheck {
  id: string;
  patientId: string;
  providerId: string;
  medicationRxcui: string;
  medicationName: string;
  overallAssessment: string;
  requiresClinicalReview: boolean;
  findings: ContraindicationFinding[];
  patientContext: PatientContext;
  confidence: number;
  clinicalSummary: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewDecision?: 'approved' | 'rejected' | 'modified';
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class ContraindicationDetectorService {
  /**
   * Perform comprehensive contraindication check for a medication
   *
   * @param request - Contraindication check request
   * @returns ServiceResult with check results or error
   */
  static async checkContraindications(
    request: ContraindicationCheckRequest
  ): Promise<ServiceResult<ContraindicationCheckResponse>> {
    try {
      // Validate required fields
      if (!request.patientId?.trim()) {
        return failure('INVALID_INPUT', 'Patient ID is required');
      }

      if (!request.providerId?.trim()) {
        return failure('INVALID_INPUT', 'Provider ID is required');
      }

      if (!request.medicationRxcui?.trim() && !request.medicationName?.trim()) {
        return failure('INVALID_INPUT', 'Medication RxCUI or name is required');
      }

      // Invoke edge function
      const { data, error } = await supabase.functions.invoke('ai-contraindication-detector', {
        body: {
          patientId: request.patientId,
          providerId: request.providerId,
          medicationRxcui: request.medicationRxcui,
          medicationName: request.medicationName,
          indication: request.indication,
          proposedDosage: request.proposedDosage,
          includeDrugInteractions: request.includeDrugInteractions ?? true,
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      const response = data as ContraindicationCheckResponse;

      // Apply safety guardrails
      response.result = this.applyGuardrails(response.result);

      return success(response);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('CONTRAINDICATION_CHECK_FAILED', error.message, error);
    }
  }

  /**
   * Quick check for critical contraindications only
   * Faster but less comprehensive - use for real-time UI validation
   *
   * @param patientId - Patient UUID
   * @param medicationName - Medication name
   * @returns ServiceResult with quick check results
   */
  static async quickCheck(
    patientId: string,
    medicationName: string
  ): Promise<ServiceResult<{ hasCriticalContraindications: boolean; summary: string }>> {
    try {
      // Check allergies first (fastest)
      const { data: allergies } = await supabase
        .from('allergy_intolerances')
        .select('allergen_name, criticality, severity')
        .eq('patient_id', patientId)
        .eq('clinical_status', 'active')
        .ilike('allergen_name', `%${medicationName}%`);

      if (allergies && allergies.length > 0) {
        const critical = allergies.some((a) => a.criticality === 'high' || a.severity === 'severe');
        return success({
          hasCriticalContraindications: critical,
          summary: critical
            ? `ALLERGY ALERT: Patient has documented allergy to ${medicationName}`
            : `Potential allergy match for ${medicationName} - review recommended`,
        });
      }

      return success({
        hasCriticalContraindications: false,
        summary: 'No immediate contraindications detected - full check recommended',
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('QUICK_CHECK_FAILED', error.message, error);
    }
  }

  /**
   * Save contraindication check result to database
   *
   * @param patientId - Patient UUID
   * @param providerId - Provider UUID
   * @param response - Check response to save
   * @returns ServiceResult with saved record
   */
  static async saveCheckResult(
    patientId: string,
    providerId: string,
    response: ContraindicationCheckResponse
  ): Promise<ServiceResult<SavedContraindicationCheck>> {
    try {
      const { data, error } = await supabase
        .from('ai_contraindication_checks')
        .insert({
          patient_id: patientId,
          provider_id: providerId,
          medication_rxcui: response.medication.rxcui,
          medication_name: response.medication.name,
          overall_assessment: response.result.overallAssessment,
          requires_clinical_review: response.result.requiresClinicalReview,
          findings: response.result.findings,
          patient_context: response.result.patientContext,
          confidence: response.result.confidence,
          clinical_summary: response.result.clinicalSummary,
        })
        .select()
        .single();

      if (error) throw error;

      return success(this.mapDbToSavedCheck(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('CONTRAINDICATION_SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Record clinical review decision
   *
   * @param checkId - Check record UUID
   * @param reviewerId - Reviewer UUID
   * @param decision - Approval decision
   * @param notes - Optional review notes
   * @returns ServiceResult with updated record
   */
  static async recordReviewDecision(
    checkId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected' | 'modified',
    notes?: string
  ): Promise<ServiceResult<SavedContraindicationCheck>> {
    try {
      const { data, error } = await supabase
        .from('ai_contraindication_checks')
        .update({
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_decision: decision,
          review_notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', checkId)
        .select()
        .single();

      if (error) throw error;

      return success(this.mapDbToSavedCheck(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('CONTRAINDICATION_REVIEW_FAILED', error.message, error);
    }
  }

  /**
   * Get contraindication check history for a patient
   *
   * @param patientId - Patient UUID
   * @param limit - Maximum records to return
   * @returns ServiceResult with check history
   */
  static async getPatientCheckHistory(
    patientId: string,
    limit: number = 20
  ): Promise<ServiceResult<SavedContraindicationCheck[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_contraindication_checks')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return success((data || []).map(this.mapDbToSavedCheck));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('HISTORY_FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get severity color for UI display
   */
  static getSeverityColor(severity: ContraindicationSeverity): string {
    switch (severity) {
      case 'contraindicated':
        return '#DC2626'; // Red
      case 'high':
        return '#EA580C'; // Orange
      case 'moderate':
        return '#F59E0B'; // Yellow
      case 'low':
        return '#10B981'; // Green
      default:
        return '#6B7280'; // Gray
    }
  }

  /**
   * Get severity icon for UI display
   */
  static getSeverityIcon(severity: ContraindicationSeverity): string {
    switch (severity) {
      case 'contraindicated':
        return '🛑';
      case 'high':
        return '⚠️';
      case 'moderate':
        return '⚡';
      case 'low':
        return 'ℹ️';
      default:
        return '❓';
    }
  }

  /**
   * Apply safety guardrails to results
   * SAFETY: Critical findings always require review
   */
  private static applyGuardrails(result: ContraindicationCheckResult): ContraindicationCheckResult {
    // SAFETY: Any contraindicated or high-severity finding requires review
    const hasCriticalFinding = result.findings.some(
      (f) => f.severity === 'contraindicated' || f.severity === 'high'
    );

    if (hasCriticalFinding) {
      result.requiresClinicalReview = true;
      if (!result.reviewReasons.includes('Critical contraindication finding detected')) {
        result.reviewReasons.push('Critical contraindication finding detected');
      }
    }

    // SAFETY: Contraindicated assessment always requires review
    if (result.overallAssessment === 'contraindicated') {
      result.requiresClinicalReview = true;
      if (!result.reviewReasons.includes('Medication is contraindicated for this patient')) {
        result.reviewReasons.push('Medication is contraindicated for this patient');
      }
    }

    // SAFETY: Low confidence requires review
    if (result.confidence < 0.7) {
      result.requiresClinicalReview = true;
      if (!result.reviewReasons.includes('Low confidence - requires clinical verification')) {
        result.reviewReasons.push('Low confidence - requires clinical verification');
      }
    }

    // Ensure review reasons array exists
    if (!result.reviewReasons) {
      result.reviewReasons = [];
    }

    return result;
  }

  /**
   * Map database row to typed object
   */
  private static mapDbToSavedCheck(row: Record<string, unknown>): SavedContraindicationCheck {
    return {
      id: row.id as string,
      patientId: row.patient_id as string,
      providerId: row.provider_id as string,
      medicationRxcui: row.medication_rxcui as string,
      medicationName: row.medication_name as string,
      overallAssessment: row.overall_assessment as string,
      requiresClinicalReview: row.requires_clinical_review as boolean,
      findings: row.findings as ContraindicationFinding[],
      patientContext: row.patient_context as PatientContext,
      confidence: row.confidence as number,
      clinicalSummary: row.clinical_summary as string,
      reviewedBy: row.reviewed_by as string | undefined,
      reviewedAt: row.reviewed_at as string | undefined,
      reviewDecision: row.review_decision as 'approved' | 'rejected' | 'modified' | undefined,
      reviewNotes: row.review_notes as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export default ContraindicationDetectorService;
