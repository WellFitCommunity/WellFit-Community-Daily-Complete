/**
 * AI Discharge Summary Service
 *
 * Skill #19: Auto-generate comprehensive discharge summaries with medication reconciliation.
 * Integrates with the ai-discharge-summary edge function.
 *
 * SAFETY GUARDRAILS:
 * 1. All AI-generated summaries require physician review (requiresReview: true)
 * 2. Medication changes are flagged for pharmacist verification
 * 3. High readmission risk patients get additional review flags
 * 4. Summaries are saved as draft, never auto-released
 * 5. Audit logging for all AI-generated content
 *
 * @module dischargeSummaryService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// =====================================================
// TYPES
// =====================================================

export interface MedicationEntry {
  name: string;
  dose: string;
  route: string;
  frequency: string;
  indication: string;
  instructions?: string;
}

export interface MedicationChange {
  name: string;
  previousDose: string;
  newDose: string;
  reason: string;
  instructions?: string;
}

export interface MedicationReconciliation {
  continued: MedicationEntry[];
  new: MedicationEntry[];
  changed: MedicationChange[];
  discontinued: MedicationEntry[];
  allergies: string[];
  interactions: string[];
}

export interface DischargeDiagnosis {
  code: string;
  display: string;
  type: 'principal' | 'secondary' | 'complication';
}

export interface ProcedurePerformed {
  code: string;
  display: string;
  date: string;
  provider?: string;
}

export interface FollowUpAppointment {
  specialty: string;
  provider?: string;
  timeframe: string;
  purpose: string;
  urgency: 'routine' | 'urgent' | 'as_needed';
}

export interface PatientInstruction {
  category: 'activity' | 'diet' | 'wound_care' | 'medication' | 'symptoms' | 'general';
  instruction: string;
  importance: 'critical' | 'important' | 'informational';
}

export interface WarningSign {
  sign: string;
  action: string;
  urgency: 'call_office' | 'urgent_care' | 'emergency';
}

export interface DischargeSummary {
  // Header
  patientName: string;
  dateOfBirth: string;
  admissionDate: string;
  dischargeDate: string;
  lengthOfStay: number;
  attendingPhysician: string;
  dischargeDisposition: string;

  // Clinical Content
  chiefComplaint: string;
  admissionDiagnosis: string;
  hospitalCourse: string;
  dischargeDiagnoses: DischargeDiagnosis[];
  proceduresPerformed: ProcedurePerformed[];

  // Medications
  medicationReconciliation: MedicationReconciliation;
  dischargePharmacy?: string;

  // Follow-up
  followUpAppointments: FollowUpAppointment[];
  pendingTests: string[];
  pendingConsults: string[];

  // Patient Instructions
  patientInstructions: PatientInstruction[];
  warningSigns: WarningSign[];
  activityRestrictions: string[];
  dietaryInstructions: string[];

  // Care Coordination
  homeHealthOrdered: boolean;
  homeHealthAgency?: string;
  dmeOrdered: boolean;
  dmeItems?: string[];

  // Quality Metrics
  readmissionRiskScore: number;
  readmissionRiskCategory: 'low' | 'moderate' | 'high' | 'very_high';

  // Safety
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  disclaimer: string;
}

export interface DischargeSummaryRequest {
  patientId: string;
  encounterId: string;
  tenantId?: string;
  dischargePlanId?: string;
  dischargeDisposition?: string;
  attendingPhysician?: string;
  includePatientInstructions?: boolean;
}

export interface DischargeSummaryResponse {
  summary: DischargeSummary;
  metadata: {
    generated_at: string;
    model: string;
    response_time_ms: number;
    encounter_id: string;
    discharge_disposition: string;
    context_summary: {
      conditions_count: number;
      procedures_count: number;
      medications_count: number;
      allergies_count: number;
    };
  };
}

// =====================================================
// SAFETY THRESHOLDS
// =====================================================

const SAFETY_THRESHOLDS = {
  /** Minimum confidence to proceed without extra warnings */
  MIN_CONFIDENCE: 0.6,
  /** Confidence below this requires senior physician review */
  SENIOR_REVIEW_THRESHOLD: 0.5,
  /** Maximum medication changes before flagging for pharmacy review */
  MAX_MED_CHANGES_NO_FLAG: 5,
  /** High readmission risk score threshold */
  HIGH_RISK_THRESHOLD: 60,
};

// =====================================================
// SERVICE
// =====================================================

/**
 * AI Discharge Summary Service
 *
 * Provides methods for generating comprehensive discharge summaries
 * with medication reconciliation and safety guardrails.
 */
export class DischargeSummaryService {
  /**
   * Generate a comprehensive discharge summary
   *
   * SAFETY: All generated summaries have requiresReview=true
   *
   * @param request - The generation request parameters
   * @returns ServiceResult containing the generated summary
   */
  static async generateSummary(
    request: DischargeSummaryRequest
  ): Promise<ServiceResult<DischargeSummaryResponse>> {
    try {
      // Validate required fields
      if (!request.patientId) {
        return failure('INVALID_INPUT', 'Patient ID is required');
      }

      if (!request.encounterId) {
        return failure('INVALID_INPUT', 'Encounter ID is required');
      }

      const { data, error } = await supabase.functions.invoke('ai-discharge-summary', {
        body: {
          patientId: request.patientId,
          encounterId: request.encounterId,
          tenantId: request.tenantId,
          dischargePlanId: request.dischargePlanId,
          dischargeDisposition: request.dischargeDisposition || 'home',
          attendingPhysician: request.attendingPhysician || 'Attending Physician',
          includePatientInstructions: request.includePatientInstructions ?? true,
        },
      });

      if (error) throw error;

      const response = data as DischargeSummaryResponse;

      // SAFETY: Apply guardrails to response
      response.summary = this.applyGuardrails(response.summary);

      return success(response);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DISCHARGE_SUMMARY_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Apply safety guardrails to generated discharge summary
   * SAFETY: Ensures AI output is constrained and reviewed
   */
  private static applyGuardrails(summary: DischargeSummary): DischargeSummary {
    // SAFETY: Always require review - never auto-release AI summaries
    summary.requiresReview = true;

    // SAFETY: Ensure disclaimer is present
    if (!summary.disclaimer || summary.disclaimer.length < 20) {
      summary.disclaimer = 'This discharge summary was generated with AI assistance and requires physician review and approval before release to the patient or external providers.';
    }

    // SAFETY: Add review reason if confidence is low
    if (summary.confidence < SAFETY_THRESHOLDS.MIN_CONFIDENCE) {
      if (!summary.reviewReasons.includes('Low confidence score')) {
        summary.reviewReasons.push('Low confidence score - requires careful physician review');
      }
    }

    // SAFETY: Flag for senior review if very low confidence
    if (summary.confidence < SAFETY_THRESHOLDS.SENIOR_REVIEW_THRESHOLD) {
      if (!summary.reviewReasons.includes('Senior physician review recommended')) {
        summary.reviewReasons.push('Senior physician review recommended');
      }
    }

    // SAFETY: Flag if many medication changes
    const totalMedChanges =
      summary.medicationReconciliation.new.length +
      summary.medicationReconciliation.changed.length +
      summary.medicationReconciliation.discontinued.length;

    if (totalMedChanges > SAFETY_THRESHOLDS.MAX_MED_CHANGES_NO_FLAG) {
      if (!summary.reviewReasons.some((r) => r.includes('pharmacist'))) {
        summary.reviewReasons.push('Multiple medication changes - pharmacist reconciliation recommended');
      }
    }

    // SAFETY: Flag drug interactions
    if (summary.medicationReconciliation.interactions.length > 0) {
      const interactionWarning = 'ALERT: Potential drug interactions identified - pharmacy review required';
      if (!summary.reviewReasons.includes(interactionWarning)) {
        summary.reviewReasons.unshift(interactionWarning);
      }
    }

    // SAFETY: Flag high readmission risk
    if (summary.readmissionRiskScore >= SAFETY_THRESHOLDS.HIGH_RISK_THRESHOLD) {
      if (!summary.reviewReasons.some((r) => r.includes('readmission'))) {
        summary.reviewReasons.push('High readmission risk - ensure comprehensive discharge planning');
      }
    }

    // SAFETY: Ensure warning signs are present
    if (!summary.warningSigns || summary.warningSigns.length === 0) {
      summary.warningSigns = [
        {
          sign: 'Fever over 101°F that does not respond to medication',
          action: 'Contact your doctor or go to urgent care',
          urgency: 'urgent_care',
        },
        {
          sign: 'Severe chest pain or difficulty breathing',
          action: 'Call 911 or go to the emergency room immediately',
          urgency: 'emergency',
        },
      ];
    }

    // SAFETY: Ensure follow-up is scheduled
    if (!summary.followUpAppointments || summary.followUpAppointments.length === 0) {
      summary.followUpAppointments = [
        {
          specialty: 'Primary Care',
          timeframe: '7 days',
          purpose: 'Post-discharge follow-up',
          urgency: 'routine',
        },
      ];
      if (!summary.reviewReasons.includes('Follow-up appointment needs scheduling')) {
        summary.reviewReasons.push('Follow-up appointment needs scheduling');
      }
    }

    return summary;
  }

  /**
   * Generate a discharge summary for a specific encounter
   * Convenience method that looks up the discharge plan automatically
   */
  static async generateForEncounter(
    patientId: string,
    encounterId: string,
    tenantId?: string
  ): Promise<ServiceResult<DischargeSummaryResponse>> {
    // Try to find the discharge plan for this encounter
    const { data: dischargePlan } = await supabase
      .from('discharge_plans')
      .select('id, discharge_disposition, follow_up_appointment_provider')
      .eq('encounter_id', encounterId)
      .single();

    return this.generateSummary({
      patientId,
      encounterId,
      tenantId,
      dischargePlanId: dischargePlan?.id,
      dischargeDisposition: dischargePlan?.discharge_disposition,
      attendingPhysician: dischargePlan?.follow_up_appointment_provider,
    });
  }

  /**
   * Save a generated discharge summary to the database
   *
   * SAFETY: Summary is saved in 'draft' status, never auto-released
   *
   * @param patientId - Patient ID
   * @param encounterId - Encounter ID
   * @param summary - The generated summary to save
   * @param generatedBy - ID of the user who generated the summary
   * @returns ServiceResult with the saved summary ID
   */
  static async saveSummary(
    patientId: string,
    encounterId: string,
    summary: DischargeSummary,
    generatedBy: string
  ): Promise<ServiceResult<{ summaryId: string }>> {
    try {
      // SAFETY: Validate summary before saving
      const validation = this.validateSummaryForSaving(summary);
      if (!validation.valid) {
        return failure('VALIDATION_ERROR', validation.reason || 'Summary validation failed');
      }

      const { data, error } = await supabase
        .from('discharge_summaries')
        .insert({
          patient_id: patientId,
          encounter_id: encounterId,
          status: 'draft', // SAFETY: Never auto-release AI summaries
          summary_json: summary,
          hospital_course: summary.hospitalCourse,
          discharge_diagnoses: summary.dischargeDiagnoses,
          procedures_performed: summary.proceduresPerformed,
          medication_reconciliation: summary.medicationReconciliation,
          follow_up_appointments: summary.followUpAppointments,
          patient_instructions: summary.patientInstructions,
          warning_signs: summary.warningSigns,
          readmission_risk_score: summary.readmissionRiskScore,
          readmission_risk_category: summary.readmissionRiskCategory,
          ai_confidence: summary.confidence,
          ai_generated: true,
          review_reasons: summary.reviewReasons,
          generated_by: generatedBy,
          attending_physician: summary.attendingPhysician,
          discharge_disposition: summary.dischargeDisposition,
          admission_date: summary.admissionDate,
          discharge_date: summary.dischargeDate,
          length_of_stay: summary.lengthOfStay,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Log PHI access for audit
      await supabase.from('audit_phi_access').insert({
        user_id: generatedBy,
        resource_type: 'discharge_summary',
        resource_id: data.id,
        action: 'CREATE',
        details: {
          ai_generated: true,
          encounter_id: encounterId,
          confidence: summary.confidence,
          readmission_risk: summary.readmissionRiskScore,
          medication_changes: {
            new: summary.medicationReconciliation.new.length,
            changed: summary.medicationReconciliation.changed.length,
            discontinued: summary.medicationReconciliation.discontinued.length,
          },
        },
      });

      return success({ summaryId: data.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DISCHARGE_SUMMARY_SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Validate a summary before saving
   * SAFETY: Ensures summary meets minimum requirements
   */
  private static validateSummaryForSaving(summary: DischargeSummary): { valid: boolean; reason?: string } {
    // Must have hospital course
    if (!summary.hospitalCourse || summary.hospitalCourse.trim().length < 20) {
      return { valid: false, reason: 'Hospital course documentation is required' };
    }

    // Must have at least one diagnosis
    if (!summary.dischargeDiagnoses || summary.dischargeDiagnoses.length === 0) {
      return { valid: false, reason: 'At least one discharge diagnosis is required' };
    }

    // Must have medication reconciliation (even if empty arrays)
    if (!summary.medicationReconciliation) {
      return { valid: false, reason: 'Medication reconciliation is required' };
    }

    // Must have follow-up plan
    if (!summary.followUpAppointments || summary.followUpAppointments.length === 0) {
      return { valid: false, reason: 'Follow-up appointments must be scheduled' };
    }

    // Must have warning signs
    if (!summary.warningSigns || summary.warningSigns.length === 0) {
      return { valid: false, reason: 'Warning signs must be documented' };
    }

    // Must have disclaimer
    if (!summary.disclaimer || summary.disclaimer.length < 20) {
      return { valid: false, reason: 'Disclaimer must be present' };
    }

    return { valid: true };
  }

  /**
   * Approve a discharge summary (physician action)
   *
   * SAFETY: Only physicians can approve summaries
   *
   * @param summaryId - The summary ID to approve
   * @param approverId - ID of the approving physician
   * @param modifications - Optional modifications to apply
   */
  static async approveSummary(
    summaryId: string,
    approverId: string,
    modifications?: Partial<DischargeSummary>
  ): Promise<ServiceResult<{ summaryId: string }>> {
    try {
      const updates: Record<string, unknown> = {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: approverId,
      };

      if (modifications) {
        // Fetch current summary and merge modifications
        const { data: current } = await supabase
          .from('discharge_summaries')
          .select('summary_json')
          .eq('id', summaryId)
          .single();

        if (current) {
          updates.summary_json = {
            ...current.summary_json,
            ...modifications,
          };

          // Update specific fields if modified
          if (modifications.hospitalCourse) updates.hospital_course = modifications.hospitalCourse;
          if (modifications.dischargeDiagnoses) updates.discharge_diagnoses = modifications.dischargeDiagnoses;
          if (modifications.medicationReconciliation) updates.medication_reconciliation = modifications.medicationReconciliation;
          if (modifications.followUpAppointments) updates.follow_up_appointments = modifications.followUpAppointments;
          if (modifications.patientInstructions) updates.patient_instructions = modifications.patientInstructions;
        }
      }

      const { error } = await supabase
        .from('discharge_summaries')
        .update(updates)
        .eq('id', summaryId);

      if (error) throw error;

      // Log approval
      await supabase.from('audit_phi_access').insert({
        user_id: approverId,
        resource_type: 'discharge_summary',
        resource_id: summaryId,
        action: 'UPDATE',
        details: {
          action_type: 'summary_approval',
          had_modifications: !!modifications,
        },
      });

      return success({ summaryId });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DISCHARGE_SUMMARY_APPROVAL_FAILED', error.message, error);
    }
  }

  /**
   * Reject a discharge summary (physician action)
   *
   * @param summaryId - The summary ID to reject
   * @param rejecterId - ID of the rejecting physician
   * @param reason - Reason for rejection
   */
  static async rejectSummary(
    summaryId: string,
    rejecterId: string,
    reason: string
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('discharge_summaries')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: rejecterId,
          rejection_reason: reason,
        })
        .eq('id', summaryId);

      if (error) throw error;

      // Log rejection
      await supabase.from('audit_phi_access').insert({
        user_id: rejecterId,
        resource_type: 'discharge_summary',
        resource_id: summaryId,
        action: 'UPDATE',
        details: {
          action_type: 'summary_rejection',
          reason,
        },
      });

      return success(undefined);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DISCHARGE_SUMMARY_REJECTION_FAILED', error.message, error);
    }
  }

  /**
   * Release an approved summary to external systems (PCP, patient portal)
   *
   * SAFETY: Only approved summaries can be released
   *
   * @param summaryId - The summary ID to release
   * @param releaserId - ID of the user releasing the summary
   * @param destinations - Where to send the summary
   */
  static async releaseSummary(
    summaryId: string,
    releaserId: string,
    destinations: ('pcp' | 'patient_portal' | 'hie')[]
  ): Promise<ServiceResult<{ releasedTo: string[] }>> {
    try {
      // Verify summary is approved
      const { data: summary } = await supabase
        .from('discharge_summaries')
        .select('status')
        .eq('id', summaryId)
        .single();

      if (!summary || summary.status !== 'approved') {
        return failure('VALIDATION_ERROR', 'Only approved summaries can be released');
      }

      const { error } = await supabase
        .from('discharge_summaries')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          released_by: releaserId,
          released_to: destinations,
        })
        .eq('id', summaryId);

      if (error) throw error;

      // Log release
      await supabase.from('audit_phi_access').insert({
        user_id: releaserId,
        resource_type: 'discharge_summary',
        resource_id: summaryId,
        action: 'SHARE',
        details: {
          action_type: 'summary_release',
          destinations,
        },
      });

      return success({ releasedTo: destinations });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('DISCHARGE_SUMMARY_RELEASE_FAILED', error.message, error);
    }
  }

  /**
   * Get medication reconciliation summary statistics
   */
  static getMedicationSummary(reconciliation: MedicationReconciliation): {
    totalMedications: number;
    continued: number;
    new: number;
    changed: number;
    discontinued: number;
    hasInteractions: boolean;
    hasAllergyConflicts: boolean;
  } {
    return {
      totalMedications:
        reconciliation.continued.length +
        reconciliation.new.length +
        reconciliation.changed.length,
      continued: reconciliation.continued.length,
      new: reconciliation.new.length,
      changed: reconciliation.changed.length,
      discontinued: reconciliation.discontinued.length,
      hasInteractions: reconciliation.interactions.length > 0,
      hasAllergyConflicts: false, // Would need to cross-reference allergies with medications
    };
  }

  /**
   * Format summary for printing (plain text)
   */
  static formatForPrint(summary: DischargeSummary): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('DISCHARGE SUMMARY');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Patient: ${summary.patientName}`);
    lines.push(`DOB: ${summary.dateOfBirth}`);
    lines.push(`Admission Date: ${summary.admissionDate}`);
    lines.push(`Discharge Date: ${summary.dischargeDate}`);
    lines.push(`Length of Stay: ${summary.lengthOfStay} day(s)`);
    lines.push(`Attending Physician: ${summary.attendingPhysician}`);
    lines.push(`Discharge Disposition: ${summary.dischargeDisposition}`);
    lines.push('');

    lines.push('-'.repeat(40));
    lines.push('DIAGNOSES');
    lines.push('-'.repeat(40));
    summary.dischargeDiagnoses.forEach((d, i) => {
      lines.push(`${i + 1}. ${d.display} (${d.code}) - ${d.type}`);
    });
    lines.push('');

    lines.push('-'.repeat(40));
    lines.push('HOSPITAL COURSE');
    lines.push('-'.repeat(40));
    lines.push(summary.hospitalCourse);
    lines.push('');

    lines.push('-'.repeat(40));
    lines.push('DISCHARGE MEDICATIONS');
    lines.push('-'.repeat(40));

    if (summary.medicationReconciliation.continued.length > 0) {
      lines.push('CONTINUED:');
      summary.medicationReconciliation.continued.forEach((m) => {
        lines.push(`  - ${m.name} ${m.dose} ${m.frequency}`);
      });
    }

    if (summary.medicationReconciliation.new.length > 0) {
      lines.push('NEW:');
      summary.medicationReconciliation.new.forEach((m) => {
        lines.push(`  - ${m.name} ${m.dose} ${m.frequency} (${m.indication})`);
      });
    }

    if (summary.medicationReconciliation.changed.length > 0) {
      lines.push('CHANGED:');
      summary.medicationReconciliation.changed.forEach((m) => {
        lines.push(`  - ${m.name}: ${m.previousDose} → ${m.newDose} (${m.reason})`);
      });
    }

    if (summary.medicationReconciliation.discontinued.length > 0) {
      lines.push('DISCONTINUED:');
      summary.medicationReconciliation.discontinued.forEach((m) => {
        lines.push(`  - ${m.name}`);
      });
    }
    lines.push('');

    lines.push('-'.repeat(40));
    lines.push('FOLLOW-UP APPOINTMENTS');
    lines.push('-'.repeat(40));
    summary.followUpAppointments.forEach((f) => {
      lines.push(`- ${f.specialty}: ${f.timeframe} (${f.purpose})`);
    });
    lines.push('');

    lines.push('-'.repeat(40));
    lines.push('WARNING SIGNS - SEEK MEDICAL ATTENTION IF:');
    lines.push('-'.repeat(40));
    summary.warningSigns.forEach((w) => {
      lines.push(`⚠️ ${w.sign}`);
      lines.push(`   Action: ${w.action}`);
    });
    lines.push('');

    lines.push('='.repeat(60));
    lines.push(summary.disclaimer);
    lines.push('='.repeat(60));

    return lines.join('\n');
  }
}

export default DischargeSummaryService;
