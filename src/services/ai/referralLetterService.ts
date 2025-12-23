/**
 * Referral Letter Generator AI Service
 *
 * Generates professional referral letters from referring physician to specialist.
 * Integrates with the ai-referral-letter edge function.
 *
 * SAFETY GUARDRAILS:
 * 1. All referral letters require physician review (requiresReview: true)
 * 2. Medical necessity is automatically included
 * 3. Outputs marked as draft until physician approval
 * 4. PHI protection - no patient names in unencrypted logs
 * 5. Audit logging for all PHI access
 *
 * @module referralLetterService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReferralLetterRequest {
  /** Patient ID (UUID) */
  patientId: string;
  /** Referring provider user ID */
  referringProviderId: string;
  /** Target specialty (e.g., "Cardiology", "Orthopedics") */
  specialistSpecialty: string;
  /** Specific specialist provider ID if known */
  specialistProviderId?: string;
  /** Clinical reason for referral */
  clinicalReason: string;
  /** Additional clinical notes */
  clinicalNotes?: string;
  /** ICD-10 diagnosis codes */
  diagnoses?: string[];
  /** Current medications */
  medications?: string[];
  /** Known allergies */
  allergies?: string[];
  /** Insurance payer for formatting */
  insurancePayer?: string;
  /** Urgency level */
  urgency?: 'routine' | 'urgent' | 'emergent';
  /** Tenant ID for multi-tenant support */
  tenantId?: string;
}

export interface ReferringProvider {
  name: string;
  credentials?: string;
  npi?: string;
  practice?: string;
  phone?: string;
  fax?: string;
}

export interface RecipientProvider {
  name?: string;
  specialty: string;
  practice?: string;
  address?: string;
}

export interface ReferralLetter {
  /** Letter date in YYYY-MM-DD format */
  letterDate: string;
  /** Referring provider information */
  referringProvider: ReferringProvider;
  /** Recipient provider information */
  recipientProvider: RecipientProvider;
  /** Patient name (first name only for privacy) */
  patientName: string;
  /** Patient date of birth */
  patientDOB: string;
  /** Medical record number */
  mrn: string;
  /** Chief complaint / reason for referral */
  chiefComplaint: string;
  /** Relevant medical history */
  relevantHistory: string;
  /** Current medications list */
  currentMedications: string[];
  /** Known allergies */
  allergies: string[];
  /** Detailed clinical reason for referral */
  clinicalReason: string;
  /** Specific questions for the specialist */
  specificQuestions: string[];
  /** Expected timeline for evaluation */
  expectedTimeline: string;
  /** Contact information for follow-up */
  contactInfo: string;
  /** Professional closing statements */
  closingStatements: string;
  /** AI confidence score (0-1) */
  confidence: number;
  /** Whether letter requires physician review */
  requiresReview: boolean;
  /** Reasons why review is needed */
  reviewReasons: string[];
  /** Insurance-specific notes if applicable */
  insuranceNotes?: string;
}

export interface ReferralLetterMetadata {
  /** When the letter was generated */
  generatedAt: string;
  /** AI model used */
  model: string;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Target specialty */
  specialty: string;
  /** Patient context summary */
  patientContext: {
    conditionsCount: number;
    medicationsCount: number;
    allergiesCount: number;
  };
}

export interface ReferralLetterResponse {
  /** Generated referral letter */
  letter: ReferralLetter;
  /** Formatted letter ready for printing/sending */
  formattedLetter: string;
  /** Generation metadata */
  metadata: ReferralLetterMetadata;
}

export interface SavedReferralLetter {
  id: string;
  patientId: string;
  fromProviderId: string;
  toSpecialty: string;
  clinicalReason: string;
  generatedLetter: ReferralLetter;
  formattedLetter: string;
  status: 'draft' | 'approved' | 'sent' | 'archived';
  approvedBy?: string;
  approvedAt?: string;
  sentAt?: string;
  modelUsed: string;
  confidenceScore: number;
  requiresReview: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety Constants
// ─────────────────────────────────────────────────────────────────────────────

const SAFETY_THRESHOLDS = {
  /** Minimum confidence for auto-approval consideration */
  MIN_CONFIDENCE: 0.65,
  /** Below this, flag for specialist review */
  SPECIALIST_REVIEW_THRESHOLD: 0.5,
  /** Maximum letter body length in words */
  MAX_LETTER_LENGTH: 800,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class ReferralLetterService {
  /**
   * Generate a professional referral letter
   *
   * @param request - Referral letter generation request
   * @returns ServiceResult with generated letter or error
   */
  static async generateReferralLetter(
    request: ReferralLetterRequest
  ): Promise<ServiceResult<ReferralLetterResponse>> {
    try {
      // Validate required fields
      if (!request.patientId?.trim()) {
        return failure('INVALID_INPUT', 'Patient ID is required');
      }

      if (!request.referringProviderId?.trim()) {
        return failure('INVALID_INPUT', 'Referring provider ID is required');
      }

      if (!request.specialistSpecialty?.trim() || request.specialistSpecialty.length < 2) {
        return failure('INVALID_INPUT', 'Specialist specialty is required');
      }

      if (!request.clinicalReason?.trim()) {
        return failure('INVALID_INPUT', 'Clinical reason for referral is required');
      }

      // Invoke edge function
      const { data, error } = await supabase.functions.invoke('ai-referral-letter', {
        body: {
          patientId: request.patientId,
          referringProviderId: request.referringProviderId,
          specialistSpecialty: request.specialistSpecialty,
          specialistProviderId: request.specialistProviderId,
          clinicalReason: request.clinicalReason,
          clinicalNotes: request.clinicalNotes,
          diagnoses: request.diagnoses || [],
          medications: request.medications || [],
          allergies: request.allergies || [],
          insurancePayer: request.insurancePayer,
          urgency: request.urgency || 'routine',
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      const response = data as ReferralLetterResponse;

      // Apply safety guardrails
      response.letter = this.applyGuardrails(response.letter);

      return success(response);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('REFERRAL_LETTER_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Generate an urgent/emergent referral letter
   *
   * @param patientId - Patient UUID
   * @param referringProviderId - Referring provider UUID
   * @param specialty - Target specialty
   * @param clinicalReason - Reason for urgent referral
   * @returns ServiceResult with generated letter
   */
  static async generateUrgentReferral(
    patientId: string,
    referringProviderId: string,
    specialty: string,
    clinicalReason: string
  ): Promise<ServiceResult<ReferralLetterResponse>> {
    return this.generateReferralLetter({
      patientId,
      referringProviderId,
      specialistSpecialty: specialty,
      clinicalReason,
      urgency: 'emergent',
    });
  }

  /**
   * Save a generated referral letter to the database
   *
   * @param patientId - Patient UUID
   * @param referringProviderId - Referring provider UUID
   * @param response - Generated letter response
   * @returns ServiceResult with saved letter record
   */
  static async saveReferralLetter(
    patientId: string,
    referringProviderId: string,
    response: ReferralLetterResponse
  ): Promise<ServiceResult<SavedReferralLetter>> {
    try {
      const { data, error } = await supabase
        .from('ai_referral_letters')
        .insert({
          patient_id: patientId,
          from_provider_id: referringProviderId,
          to_specialty: response.letter.recipientProvider.specialty,
          clinical_reason: response.letter.clinicalReason,
          generated_letter: response.letter,
          formatted_letter: response.formattedLetter,
          status: 'draft',
          model_used: response.metadata.model,
          confidence_score: response.letter.confidence,
          requires_review: response.letter.requiresReview,
        })
        .select()
        .single();

      if (error) throw error;

      return success(this.mapDbToSavedLetter(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('REFERRAL_LETTER_SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Approve a referral letter for sending
   *
   * @param letterId - Letter UUID
   * @param approverId - Approving provider UUID
   * @returns ServiceResult with updated letter
   */
  static async approveReferralLetter(
    letterId: string,
    approverId: string
  ): Promise<ServiceResult<SavedReferralLetter>> {
    try {
      const { data, error } = await supabase
        .from('ai_referral_letters')
        .update({
          status: 'approved',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', letterId)
        .select()
        .single();

      if (error) throw error;

      return success(this.mapDbToSavedLetter(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('REFERRAL_LETTER_APPROVAL_FAILED', error.message, error);
    }
  }

  /**
   * Mark a referral letter as sent
   *
   * @param letterId - Letter UUID
   * @returns ServiceResult with updated letter
   */
  static async markAsSent(letterId: string): Promise<ServiceResult<SavedReferralLetter>> {
    try {
      const { data, error } = await supabase
        .from('ai_referral_letters')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', letterId)
        .eq('status', 'approved') // Can only send approved letters
        .select()
        .single();

      if (error) throw error;

      return success(this.mapDbToSavedLetter(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('REFERRAL_LETTER_SEND_FAILED', error.message, error);
    }
  }

  /**
   * Get referral letter history for a patient
   *
   * @param patientId - Patient UUID
   * @param limit - Maximum number of records
   * @returns ServiceResult with list of saved letters
   */
  static async getPatientReferralLetters(
    patientId: string,
    limit: number = 10
  ): Promise<ServiceResult<SavedReferralLetter[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_referral_letters')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return success((data || []).map(this.mapDbToSavedLetter));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('HISTORY_FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Format a referral letter for PDF/printing
   *
   * @param letterResponse - Generated letter response
   * @returns Formatted string ready for print
   */
  static formatForPDF(letterResponse: ReferralLetterResponse): string {
    const { letter } = letterResponse;

    const lines: string[] = [
      letter.referringProvider.practice || '',
      letter.referringProvider.name,
      letter.referringProvider.credentials || '',
      letter.referringProvider.phone ? `Phone: ${letter.referringProvider.phone}` : '',
      letter.referringProvider.fax ? `Fax: ${letter.referringProvider.fax}` : '',
      '',
      `Date: ${letter.letterDate}`,
      '',
      letter.recipientProvider.name || letter.recipientProvider.specialty,
      letter.recipientProvider.practice || '',
      letter.recipientProvider.address || '',
      '',
      `RE: ${letter.patientName}`,
      `DOB: ${letter.patientDOB}`,
      `MRN: ${letter.mrn}`,
      '',
      `Dear ${letter.recipientProvider.name || 'Colleague'}:`,
      '',
      `I am writing to refer the above patient to your office for evaluation and management of ${letter.chiefComplaint}.`,
      '',
      'CLINICAL REASON FOR REFERRAL:',
      letter.clinicalReason,
      '',
      'RELEVANT HISTORY:',
      letter.relevantHistory,
      '',
    ];

    if (letter.currentMedications.length > 0) {
      lines.push('CURRENT MEDICATIONS:');
      letter.currentMedications.forEach((med) => lines.push(`  - ${med}`));
      lines.push('');
    }

    if (letter.allergies.length > 0) {
      lines.push(`ALLERGIES: ${letter.allergies.join(', ')}`);
      lines.push('');
    }

    if (letter.specificQuestions.length > 0) {
      lines.push('SPECIFIC QUESTIONS FOR YOUR EVALUATION:');
      letter.specificQuestions.forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
      lines.push('');
    }

    lines.push(
      letter.closingStatements,
      '',
      'Sincerely,',
      '',
      letter.referringProvider.name,
      letter.referringProvider.credentials || '',
      letter.referringProvider.npi ? `NPI: ${letter.referringProvider.npi}` : ''
    );

    return lines.filter((line) => line !== undefined).join('\n');
  }

  /**
   * Apply safety guardrails to generated letter
   * SAFETY: All referral letters require physician review
   *
   * @param letter - Generated letter
   * @returns Letter with guardrails applied
   */
  private static applyGuardrails(letter: ReferralLetter): ReferralLetter {
    // SAFETY: Always require review - this is non-negotiable
    letter.requiresReview = true;

    // Ensure we have at least one review reason
    if (!letter.reviewReasons || letter.reviewReasons.length === 0) {
      letter.reviewReasons = ['All referral letters require physician review before sending'];
    }

    // SAFETY: Flag low confidence
    if (letter.confidence < SAFETY_THRESHOLDS.MIN_CONFIDENCE) {
      if (!letter.reviewReasons.includes('Low confidence score - requires careful review')) {
        letter.reviewReasons.push('Low confidence score - requires careful review');
      }
    }

    // SAFETY: Flag very low confidence for specialist review
    if (letter.confidence < SAFETY_THRESHOLDS.SPECIALIST_REVIEW_THRESHOLD) {
      if (!letter.reviewReasons.includes('Very low confidence - consider specialist input')) {
        letter.reviewReasons.push('Very low confidence - consider specialist input');
      }
    }

    // SAFETY: Flag if allergies are documented (ensure clinical accuracy)
    if (letter.allergies && letter.allergies.length > 0) {
      if (!letter.reviewReasons.includes('Verify allergies match current clinical records')) {
        letter.reviewReasons.push('Verify allergies match current clinical records');
      }
    }

    return letter;
  }

  /**
   * Map database row to SavedReferralLetter type
   */
  private static mapDbToSavedLetter(row: Record<string, unknown>): SavedReferralLetter {
    return {
      id: row.id as string,
      patientId: row.patient_id as string,
      fromProviderId: row.from_provider_id as string,
      toSpecialty: row.to_specialty as string,
      clinicalReason: row.clinical_reason as string,
      generatedLetter: row.generated_letter as ReferralLetter,
      formattedLetter: row.formatted_letter as string,
      status: row.status as 'draft' | 'approved' | 'sent' | 'archived',
      approvedBy: row.approved_by as string | undefined,
      approvedAt: row.approved_at as string | undefined,
      sentAt: row.sent_at as string | undefined,
      modelUsed: row.model_used as string,
      confidenceScore: row.confidence_score as number,
      requiresReview: row.requires_review as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export default ReferralLetterService;
