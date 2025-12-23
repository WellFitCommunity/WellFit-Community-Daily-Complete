/**
 * AI Treatment Pathway Recommender Service
 *
 * Skill #23: Evidence-based treatment pathway recommendations.
 * Integrates with the ai-treatment-pathway edge function.
 *
 * SAFETY GUARDRAILS:
 * 1. All AI-generated pathways require clinician review (requiresReview: true)
 * 2. Allergy conflicts are prominently flagged
 * 3. Contraindications are checked against recommendations
 * 4. Clinical guidelines are referenced (ADA, ACC, USPSTF, etc.)
 * 5. Confidence thresholds flag low-confidence recommendations
 * 6. Audit logging for all AI-generated content
 *
 * @module treatmentPathwayService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// =====================================================
// TYPES
// =====================================================

export interface TreatmentStep {
  stepNumber: number;
  phase: 'first_line' | 'second_line' | 'third_line' | 'adjunct' | 'monitoring';
  intervention: string;
  interventionType: 'medication' | 'lifestyle' | 'procedure' | 'referral' | 'monitoring' | 'education';
  rationale: string;
  expectedOutcome: string;
  timeframe: string;
  guidelineSource: string;
  evidenceLevel: 'A' | 'B' | 'C' | 'D' | 'expert_consensus';
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
  category: 'diet' | 'exercise' | 'smoking_cessation' | 'alcohol' | 'sleep' | 'stress' | 'weight';
  recommendation: string;
  specificGuidance: string;
  expectedBenefit: string;
  timeframe: string;
  resources: string[];
}

export interface ReferralRecommendation {
  specialty: string;
  reason: string;
  urgency: 'routine' | 'urgent' | 'emergent';
}

export interface MonitoringParameter {
  parameter: string;
  frequency: string;
  target: string;
}

export interface GuidelineSummary {
  guideline: string;
  year: number;
  recommendation: string;
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
  referrals: ReferralRecommendation[];
  monitoringPlan: MonitoringParameter[];
  followUpSchedule: string;
  redFlags: string[];
  patientEducation: string[];
  guidelinesSummary: GuidelineSummary[];
  contraindications: string[];
  allergyConflicts: string[];
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  disclaimer: string;
}

export interface TreatmentPathwayRequest {
  patientId: string;
  tenantId?: string;
  condition: string;
  conditionCode?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  isNewDiagnosis?: boolean;
  treatmentGoals?: string[];
  excludeMedications?: string[];
}

export interface TreatmentPathwayResponse {
  pathway: TreatmentPathway;
  metadata: {
    generated_at: string;
    model: string;
    response_time_ms: number;
    condition: string;
    severity: string;
    patient_context: {
      conditions_count: number;
      medications_count: number;
      allergies_count: number;
      has_contraindications: boolean;
    };
  };
}

// =====================================================
// SAFETY THRESHOLDS
// =====================================================

const SAFETY_THRESHOLDS = {
  /** Minimum confidence to proceed without extra warnings */
  MIN_CONFIDENCE: 0.6,
  /** Confidence below this requires specialist review */
  SPECIALIST_REVIEW_THRESHOLD: 0.5,
  /** Maximum treatment steps to prevent overly complex pathways */
  MAX_STEPS: 8,
  /** Maximum medication recommendations */
  MAX_MEDICATIONS: 6,
  /** Maximum referrals */
  MAX_REFERRALS: 4,
};

// =====================================================
// SERVICE
// =====================================================

/**
 * AI Treatment Pathway Recommender Service
 *
 * Provides methods for generating evidence-based treatment pathway
 * recommendations with comprehensive safety guardrails.
 */
export class TreatmentPathwayService {
  /**
   * Generate an evidence-based treatment pathway for a condition
   *
   * SAFETY: All generated pathways have requiresReview=true
   *
   * @param request - The generation request parameters
   * @returns ServiceResult containing the generated pathway
   */
  static async generatePathway(
    request: TreatmentPathwayRequest
  ): Promise<ServiceResult<TreatmentPathwayResponse>> {
    try {
      // Validate required fields
      if (!request.patientId) {
        return failure('INVALID_INPUT', 'Patient ID is required');
      }

      if (!request.condition || request.condition.trim().length < 2) {
        return failure('INVALID_INPUT', 'Condition name is required (minimum 2 characters)');
      }

      // Validate severity if provided
      const validSeverities = ['mild', 'moderate', 'severe'];
      if (request.severity && !validSeverities.includes(request.severity)) {
        return failure('INVALID_INPUT', `Invalid severity. Must be one of: ${validSeverities.join(', ')}`);
      }

      const { data, error } = await supabase.functions.invoke('ai-treatment-pathway', {
        body: {
          patientId: request.patientId,
          tenantId: request.tenantId,
          condition: request.condition,
          conditionCode: request.conditionCode || '',
          severity: request.severity || 'moderate',
          isNewDiagnosis: request.isNewDiagnosis ?? false,
          treatmentGoals: request.treatmentGoals || [],
          excludeMedications: request.excludeMedications || [],
        },
      });

      if (error) throw error;

      const response = data as TreatmentPathwayResponse;

      // SAFETY: Apply guardrails to response
      response.pathway = this.applyGuardrails(response.pathway);

      return success(response);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('TREATMENT_PATHWAY_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Apply safety guardrails to generated treatment pathway
   * SAFETY: Ensures AI output is constrained and reviewed
   */
  private static applyGuardrails(pathway: TreatmentPathway): TreatmentPathway {
    // SAFETY: Always require review - never auto-approve AI recommendations
    pathway.requiresReview = true;

    // SAFETY: Ensure disclaimer is present
    if (!pathway.disclaimer || pathway.disclaimer.length < 20) {
      pathway.disclaimer = 'These recommendations are for clinical decision support only and require verification by a licensed healthcare provider. This is not a substitute for professional medical judgment.';
    }

    // SAFETY: Add review reason if confidence is low
    if (pathway.confidence < SAFETY_THRESHOLDS.MIN_CONFIDENCE) {
      if (!pathway.reviewReasons.includes('Low confidence score')) {
        pathway.reviewReasons.push('Low confidence score - requires careful clinician review');
      }
    }

    // SAFETY: Flag for specialist review if very low confidence
    if (pathway.confidence < SAFETY_THRESHOLDS.SPECIALIST_REVIEW_THRESHOLD) {
      if (!pathway.reviewReasons.includes('Specialist review recommended')) {
        pathway.reviewReasons.push('Specialist review recommended due to complexity');
      }
    }

    // SAFETY: Flag if there are allergy conflicts
    if (pathway.allergyConflicts && pathway.allergyConflicts.length > 0) {
      if (!pathway.reviewReasons.includes('Allergy conflicts detected')) {
        pathway.reviewReasons.unshift('CRITICAL: Allergy conflicts detected - review before prescribing');
      }
    }

    // SAFETY: Flag if there are contraindications
    if (pathway.contraindications && pathway.contraindications.length > 0) {
      if (!pathway.reviewReasons.includes('Contraindications present')) {
        pathway.reviewReasons.push('Contraindications present - verify appropriateness');
      }
    }

    // SAFETY: Limit treatment steps to prevent overly complex pathways
    if (pathway.steps.length > SAFETY_THRESHOLDS.MAX_STEPS) {
      pathway.steps = pathway.steps.slice(0, SAFETY_THRESHOLDS.MAX_STEPS);
      pathway.reviewReasons.push(`Steps limited to ${SAFETY_THRESHOLDS.MAX_STEPS} - review for completeness`);
    }

    // SAFETY: Limit medication recommendations
    if (pathway.medications.length > SAFETY_THRESHOLDS.MAX_MEDICATIONS) {
      pathway.medications = pathway.medications.slice(0, SAFETY_THRESHOLDS.MAX_MEDICATIONS);
      pathway.reviewReasons.push(`Medications limited to ${SAFETY_THRESHOLDS.MAX_MEDICATIONS}`);
    }

    // SAFETY: Limit referrals
    if (pathway.referrals.length > SAFETY_THRESHOLDS.MAX_REFERRALS) {
      pathway.referrals = pathway.referrals.slice(0, SAFETY_THRESHOLDS.MAX_REFERRALS);
    }

    // SAFETY: Ensure all medication recommendations require review
    pathway.medications = pathway.medications.map((med) => ({
      ...med,
      requiresReview: true,
    }));

    // SAFETY: Ensure red flags are present
    if (!pathway.redFlags || pathway.redFlags.length === 0) {
      pathway.redFlags = ['Any concerning symptoms should prompt immediate clinical evaluation'];
    }

    return pathway;
  }

  /**
   * Generate a treatment pathway for diabetes
   * References ADA Standards of Care
   */
  static async generateDiabetesPathway(
    patientId: string,
    severity: 'mild' | 'moderate' | 'severe' = 'moderate',
    isNewDiagnosis: boolean = false,
    tenantId?: string
  ): Promise<ServiceResult<TreatmentPathwayResponse>> {
    return this.generatePathway({
      patientId,
      tenantId,
      condition: 'Type 2 Diabetes Mellitus',
      conditionCode: 'E11.9',
      severity,
      isNewDiagnosis,
      treatmentGoals: ['Glycemic control', 'Cardiovascular risk reduction', 'Prevent complications'],
    });
  }

  /**
   * Generate a treatment pathway for hypertension
   * References ACC/AHA Guidelines
   */
  static async generateHypertensionPathway(
    patientId: string,
    severity: 'mild' | 'moderate' | 'severe' = 'moderate',
    tenantId?: string
  ): Promise<ServiceResult<TreatmentPathwayResponse>> {
    return this.generatePathway({
      patientId,
      tenantId,
      condition: 'Essential Hypertension',
      conditionCode: 'I10',
      severity,
      treatmentGoals: ['Blood pressure control', 'Cardiovascular risk reduction', 'End-organ protection'],
    });
  }

  /**
   * Generate a treatment pathway for heart failure
   * References ACC/AHA Heart Failure Guidelines
   */
  static async generateHeartFailurePathway(
    patientId: string,
    severity: 'mild' | 'moderate' | 'severe' = 'moderate',
    tenantId?: string
  ): Promise<ServiceResult<TreatmentPathwayResponse>> {
    return this.generatePathway({
      patientId,
      tenantId,
      condition: 'Heart Failure',
      conditionCode: 'I50.9',
      severity,
      treatmentGoals: ['Symptom relief', 'Prevent hospitalizations', 'Improve quality of life', 'Reduce mortality'],
    });
  }

  /**
   * Generate a treatment pathway for COPD
   * References GOLD Guidelines
   */
  static async generateCOPDPathway(
    patientId: string,
    severity: 'mild' | 'moderate' | 'severe' = 'moderate',
    tenantId?: string
  ): Promise<ServiceResult<TreatmentPathwayResponse>> {
    return this.generatePathway({
      patientId,
      tenantId,
      condition: 'Chronic Obstructive Pulmonary Disease',
      conditionCode: 'J44.9',
      severity,
      treatmentGoals: ['Reduce exacerbations', 'Improve exercise tolerance', 'Slow disease progression'],
    });
  }

  /**
   * Generate a treatment pathway for depression
   * References APA/CANMAT Guidelines
   */
  static async generateDepressionPathway(
    patientId: string,
    severity: 'mild' | 'moderate' | 'severe' = 'moderate',
    tenantId?: string
  ): Promise<ServiceResult<TreatmentPathwayResponse>> {
    return this.generatePathway({
      patientId,
      tenantId,
      condition: 'Major Depressive Disorder',
      conditionCode: 'F32.9',
      severity,
      treatmentGoals: ['Symptom remission', 'Functional improvement', 'Prevent relapse'],
    });
  }

  /**
   * Save a generated pathway recommendation to the patient record
   *
   * SAFETY: Saved as recommendation only, not as active order
   *
   * @param patientId - Patient ID
   * @param pathway - The generated pathway to save
   * @param clinicianId - ID of the clinician saving the pathway
   * @returns ServiceResult with the saved recommendation ID
   */
  static async savePathwayRecommendation(
    patientId: string,
    pathway: TreatmentPathway,
    clinicianId: string
  ): Promise<ServiceResult<{ recommendationId: string }>> {
    try {
      // SAFETY: Validate pathway before saving
      const validation = this.validatePathwayForSaving(pathway);
      if (!validation.valid) {
        return failure('VALIDATION_ERROR', validation.reason || 'Pathway validation failed');
      }

      const { data, error } = await supabase
        .from('clinical_recommendations')
        .insert({
          patient_id: patientId,
          recommendation_type: 'treatment_pathway',
          status: 'pending_review', // SAFETY: Never auto-approved
          title: pathway.pathwayTitle,
          condition: pathway.condition,
          condition_code: pathway.conditionCode,
          content: {
            summary: pathway.summary,
            severity: pathway.severity,
            treatmentGoal: pathway.treatmentGoal,
            steps: pathway.steps,
            medications: pathway.medications,
            lifestyle: pathway.lifestyle,
            referrals: pathway.referrals,
            monitoringPlan: pathway.monitoringPlan,
            followUpSchedule: pathway.followUpSchedule,
            redFlags: pathway.redFlags,
            patientEducation: pathway.patientEducation,
            guidelinesSummary: pathway.guidelinesSummary,
            contraindications: pathway.contraindications,
            allergyConflicts: pathway.allergyConflicts,
          },
          confidence_score: pathway.confidence,
          review_reasons: pathway.reviewReasons,
          ai_generated: true,
          disclaimer: pathway.disclaimer,
          created_by: clinicianId,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Log PHI access for audit
      await supabase.from('audit_phi_access').insert({
        user_id: clinicianId,
        resource_type: 'clinical_recommendation',
        resource_id: data.id,
        action: 'CREATE',
        details: {
          ai_generated: true,
          recommendation_type: 'treatment_pathway',
          condition: pathway.condition,
          confidence: pathway.confidence,
          has_allergy_conflicts: pathway.allergyConflicts.length > 0,
        },
      });

      return success({ recommendationId: data.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('TREATMENT_PATHWAY_SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Validate a pathway before saving
   * SAFETY: Ensures pathway meets minimum requirements
   */
  private static validatePathwayForSaving(pathway: TreatmentPathway): { valid: boolean; reason?: string } {
    // Must have condition
    if (!pathway.condition || pathway.condition.trim().length < 2) {
      return { valid: false, reason: 'Pathway must specify a condition' };
    }

    // Must have at least one treatment step
    if (!pathway.steps || pathway.steps.length === 0) {
      return { valid: false, reason: 'Pathway must have at least one treatment step' };
    }

    // Must have a title
    if (!pathway.pathwayTitle || pathway.pathwayTitle.trim().length < 5) {
      return { valid: false, reason: 'Pathway must have a descriptive title' };
    }

    // Must have summary
    if (!pathway.summary || pathway.summary.trim().length < 10) {
      return { valid: false, reason: 'Pathway must have a summary' };
    }

    // Steps must have required fields
    for (const step of pathway.steps) {
      if (!step.intervention || !step.rationale) {
        return { valid: false, reason: 'All treatment steps must have intervention and rationale' };
      }
    }

    // Must have disclaimer
    if (!pathway.disclaimer || pathway.disclaimer.length < 20) {
      return { valid: false, reason: 'Pathway must have a clinical disclaimer' };
    }

    return { valid: true };
  }

  /**
   * Approve a pathway recommendation (clinician action)
   *
   * SAFETY: Only clinicians can approve recommendations
   *
   * @param recommendationId - The recommendation ID to approve
   * @param approverId - ID of the approving clinician
   * @param modifications - Optional modifications to apply
   */
  static async approvePathway(
    recommendationId: string,
    approverId: string,
    modifications?: Partial<TreatmentPathway>
  ): Promise<ServiceResult<{ recommendationId: string }>> {
    try {
      const updates: Record<string, unknown> = {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: approverId,
      };

      if (modifications) {
        // Fetch current content and merge modifications
        const { data: current } = await supabase
          .from('clinical_recommendations')
          .select('content')
          .eq('id', recommendationId)
          .single();

        if (current) {
          updates.content = {
            ...current.content,
            ...modifications,
          };
        }
      }

      const { error } = await supabase
        .from('clinical_recommendations')
        .update(updates)
        .eq('id', recommendationId);

      if (error) throw error;

      // Log approval
      await supabase.from('audit_phi_access').insert({
        user_id: approverId,
        resource_type: 'clinical_recommendation',
        resource_id: recommendationId,
        action: 'UPDATE',
        details: {
          action_type: 'pathway_approval',
          had_modifications: !!modifications,
        },
      });

      return success({ recommendationId });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('TREATMENT_PATHWAY_APPROVAL_FAILED', error.message, error);
    }
  }

  /**
   * Reject a pathway recommendation (clinician action)
   *
   * @param recommendationId - The recommendation ID to reject
   * @param rejecterId - ID of the rejecting clinician
   * @param reason - Reason for rejection
   */
  static async rejectPathway(
    recommendationId: string,
    rejecterId: string,
    reason: string
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('clinical_recommendations')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: rejecterId,
          rejection_reason: reason,
        })
        .eq('id', recommendationId);

      if (error) throw error;

      // Log rejection
      await supabase.from('audit_phi_access').insert({
        user_id: rejecterId,
        resource_type: 'clinical_recommendation',
        resource_id: recommendationId,
        action: 'UPDATE',
        details: {
          action_type: 'pathway_rejection',
          reason,
        },
      });

      return success(undefined);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('TREATMENT_PATHWAY_REJECTION_FAILED', error.message, error);
    }
  }

  /**
   * Get clinical guidelines summary for a condition
   */
  static getGuidelinesForCondition(condition: string): string[] {
    const conditionLower = condition.toLowerCase();
    const guidelinesMap: Record<string, string[]> = {
      diabetes: ['ADA Standards of Care 2024', 'AACE Guidelines 2023'],
      hypertension: ['ACC/AHA Hypertension Guidelines 2017', 'JNC 8'],
      cholesterol: ['ACC/AHA Cholesterol Guidelines 2018'],
      'heart failure': ['ACC/AHA Heart Failure Guidelines 2022'],
      copd: ['GOLD Guidelines 2024'],
      asthma: ['GINA Guidelines 2024'],
      depression: ['APA Practice Guidelines', 'CANMAT Guidelines 2023'],
      anxiety: ['APA Practice Guidelines', 'NICE Guidelines'],
      obesity: ['Obesity Medicine Association Guidelines 2023'],
      'kidney disease': ['KDIGO Guidelines 2024'],
      'atrial fibrillation': ['ACC/AHA/HRS Atrial Fibrillation Guidelines 2023'],
      osteoporosis: ['AACE/ACE Osteoporosis Guidelines 2020'],
      thyroid: ['ATA Thyroid Guidelines 2023'],
    };

    for (const [key, guidelines] of Object.entries(guidelinesMap)) {
      if (conditionLower.includes(key)) {
        return guidelines;
      }
    }

    return ['Consult relevant clinical guidelines'];
  }

  /**
   * Check if a patient has potential contraindications for common drug classes
   */
  static async checkContraindications(
    patientId: string
  ): Promise<ServiceResult<{ contraindications: string[]; warnings: string[] }>> {
    try {
      // Fetch patient conditions
      const { data: conditions } = await supabase
        .from('fhir_conditions')
        .select('code')
        .eq('patient_id', patientId)
        .eq('clinical_status', 'active');

      // Fetch patient allergies
      const { data: allergies } = await supabase
        .from('fhir_allergy_intolerances')
        .select('code')
        .eq('patient_id', patientId);

      const contraindications: string[] = [];
      const warnings: string[] = [];

      // Check conditions for common contraindications
      const conditionDisplays = (conditions || [])
        .map((c: any) => c.code?.coding?.[0]?.display || '')
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (conditionDisplays.includes('kidney') || conditionDisplays.includes('renal')) {
        contraindications.push('Renal impairment - dose adjustments required for renally-cleared medications');
      }
      if (conditionDisplays.includes('liver') || conditionDisplays.includes('hepatic')) {
        contraindications.push('Hepatic impairment - avoid hepatotoxic medications');
      }
      if (conditionDisplays.includes('heart failure')) {
        contraindications.push('Heart failure - avoid fluid-retaining medications, caution with rate-limiting agents');
      }
      if (conditionDisplays.includes('bleeding') || conditionDisplays.includes('coagulopathy')) {
        warnings.push('Bleeding risk - caution with anticoagulants and NSAIDs');
      }
      if (conditionDisplays.includes('bradycardia')) {
        warnings.push('Bradycardia - caution with beta-blockers and rate-limiting calcium channel blockers');
      }

      // Check allergies
      const allergyDisplays = (allergies || [])
        .map((a: any) => a.code?.coding?.[0]?.display || a.code?.text || '')
        .filter(Boolean);

      for (const allergy of allergyDisplays) {
        const allergyLower = allergy.toLowerCase();
        if (allergyLower.includes('penicillin')) {
          contraindications.push(`Penicillin allergy: ${allergy} - avoid penicillin-class antibiotics`);
        }
        if (allergyLower.includes('sulfa')) {
          contraindications.push(`Sulfa allergy: ${allergy} - avoid sulfonamide medications`);
        }
        if (allergyLower.includes('nsaid') || allergyLower.includes('aspirin')) {
          contraindications.push(`NSAID/Aspirin allergy: ${allergy} - avoid NSAIDs`);
        }
        if (allergyLower.includes('ace')) {
          warnings.push(`ACE inhibitor sensitivity: ${allergy} - consider ARBs as alternative`);
        }
        if (allergyLower.includes('statin')) {
          warnings.push(`Statin intolerance: ${allergy} - consider alternative lipid-lowering therapy`);
        }
      }

      return success({ contraindications, warnings });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('CONTRAINDICATION_CHECK_FAILED', error.message, error);
    }
  }
}

export default TreatmentPathwayService;
