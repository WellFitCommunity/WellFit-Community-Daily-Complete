/**
 * Medication Instructions Generator AI Service
 *
 * Generates personalized, patient-friendly medication instructions with visual aids.
 * Uses Claude Haiku 4.5 for cost-effective generation of 6th-grade reading level content.
 *
 * Features:
 * 1. Personalized dosing schedules with timing
 * 2. Visual pill identification descriptions
 * 3. Food/drink interaction warnings
 * 4. Storage instructions
 * 5. Missed dose guidance
 * 6. Side effect awareness
 * 7. Multi-language support
 * 8. Caregiver-friendly formatting
 *
 * @module medicationInstructionsService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MedicationInfo {
  /** Medication name (brand or generic) */
  name: string;
  /** Generic name if different from brand */
  genericName?: string;
  /** Dosage (e.g., "10mg", "500mg") */
  dosage: string;
  /** Form (tablet, capsule, liquid, patch, injection, etc.) */
  form: 'tablet' | 'capsule' | 'liquid' | 'patch' | 'injection' | 'inhaler' | 'cream' | 'drops' | 'suppository' | 'other';
  /** Frequency (e.g., "twice daily", "every 8 hours") */
  frequency: string;
  /** Route of administration */
  route?: 'oral' | 'topical' | 'subcutaneous' | 'intramuscular' | 'inhaled' | 'rectal' | 'ophthalmic' | 'otic' | 'nasal' | 'sublingual';
  /** Purpose/indication */
  purpose?: string;
  /** Prescriber name */
  prescriber?: string;
  /** Start date */
  startDate?: string;
  /** End date (if temporary) */
  endDate?: string;
  /** Special instructions from prescriber */
  specialInstructions?: string;
  /** Refills remaining */
  refillsRemaining?: number;
  /** NDC code for pill identification */
  ndcCode?: string;
  /** Pill imprint for identification */
  pillImprint?: string;
  /** Pill color */
  pillColor?: string;
  /** Pill shape */
  pillShape?: string;
}

export interface PatientMedContext {
  /** Patient age */
  age?: number;
  /** Weight for dosing context */
  weightKg?: number;
  /** Known allergies */
  allergies?: string[];
  /** Current conditions */
  conditions?: string[];
  /** Other medications (for interaction context) */
  otherMedications?: string[];
  /** Kidney function (for dosing alerts) */
  kidneyFunction?: 'normal' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment';
  /** Liver function */
  liverFunction?: 'normal' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment';
  /** Pregnancy status */
  pregnancyStatus?: 'not_pregnant' | 'pregnant' | 'breastfeeding' | 'trying_to_conceive';
  /** Preferred language */
  language?: string;
  /** Reading level preference */
  readingLevel?: 'simple' | 'standard' | 'detailed';
  /** Vision impairment (for large text) */
  hasVisionImpairment?: boolean;
  /** Cognitive considerations */
  hasCognitiveImpairment?: boolean;
  /** Caregiver will administer */
  caregiverAdministered?: boolean;
}

export interface DosingScheduleItem {
  /** Time of day */
  timeOfDay: string;
  /** Specific time (e.g., "8:00 AM") */
  specificTime?: string;
  /** Dose amount */
  doseAmount: string;
  /** With food requirement */
  withFood: 'required' | 'recommended' | 'avoid' | 'no_preference';
  /** Special timing notes */
  timingNotes?: string;
}

export interface PillIdentification {
  /** Color description */
  color: string;
  /** Shape description */
  shape: string;
  /** Size description */
  size: string;
  /** Imprint/markings */
  imprint?: string;
  /** Coating type */
  coating?: string;
  /** Visual description for identification */
  visualDescription: string;
}

export interface SideEffectInfo {
  /** Side effect name */
  effect: string;
  /** Likelihood */
  likelihood: 'common' | 'less_common' | 'rare';
  /** Severity */
  severity: 'mild' | 'moderate' | 'severe';
  /** What to do */
  action: string;
  /** When to call doctor */
  callDoctorIf?: string;
}

export interface MedicationInteraction {
  /** Interacting substance */
  substance: string;
  /** Type of interaction */
  type: 'drug' | 'food' | 'alcohol' | 'supplement' | 'condition';
  /** Severity */
  severity: 'avoid' | 'caution' | 'monitor';
  /** Description */
  description: string;
  /** Recommendation */
  recommendation: string;
}

export interface MedicationInstructionResult {
  /** Medication name (friendly) */
  medicationName: string;
  /** What this medication does (patient-friendly) */
  whatItDoes: string;
  /** Why you're taking it */
  whyYouTakeIt: string;
  /** Pill identification */
  pillIdentification?: PillIdentification;
  /** Dosing schedule */
  dosingSchedule: DosingScheduleItem[];
  /** How to take it (step-by-step) */
  howToTake: string[];
  /** Food and drink interactions */
  foodDrinkInteractions: MedicationInteraction[];
  /** Other medication interactions */
  drugInteractions: MedicationInteraction[];
  /** Storage instructions */
  storageInstructions: string[];
  /** What to do if you miss a dose */
  missedDoseInstructions: string[];
  /** Common side effects */
  sideEffects: SideEffectInfo[];
  /** Warning signs to watch for */
  warningSigns: Array<{
    sign: string;
    action: string;
    urgency: 'call_doctor' | 'seek_emergency' | 'monitor';
  }>;
  /** Refill information */
  refillInfo?: {
    refillsRemaining: number;
    howToRefill: string;
  };
  /** Tips for remembering */
  reminderTips: string[];
  /** Questions to ask your doctor */
  questionsForDoctor: string[];
  /** Important do's and don'ts */
  dosAndDonts: {
    dos: string[];
    donts: string[];
  };
  /** Caregiver notes (if applicable) */
  caregiverNotes?: string[];
  /** Emergency information */
  emergencyInfo: {
    overdoseSymptoms: string[];
    overdoseAction: string;
    poisonControlNumber: string;
  };
}

export interface MedicationInstructionsRequest {
  /** Patient ID */
  patientId: string;
  /** Medication information */
  medication: MedicationInfo;
  /** Patient context for personalization */
  patientContext?: PatientMedContext;
  /** Include visual aids */
  includeVisualAids?: boolean;
  /** Tenant ID */
  tenantId?: string;
}

export interface MedicationInstructionsResponse {
  /** Generated instructions */
  result: MedicationInstructionResult;
  /** Metadata */
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    language: string;
    readingLevel: string;
  };
}

export interface SavedMedicationInstructions {
  id: string;
  instructionId: string;
  patientId: string;
  medicationName: string;
  dosage: string;
  result: MedicationInstructionResult;
  deliveredVia?: 'sms' | 'email' | 'app' | 'print';
  deliveredAt?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class MedicationInstructionsService {
  /**
   * Generate personalized medication instructions
   *
   * @param request - Medication instruction request
   * @returns ServiceResult with generated instructions
   */
  static async generateInstructions(
    request: MedicationInstructionsRequest
  ): Promise<ServiceResult<MedicationInstructionsResponse>> {
    try {
      // Validate required fields
      if (!request.patientId?.trim()) {
        return failure('INVALID_INPUT', 'Patient ID is required');
      }

      if (!request.medication) {
        return failure('INVALID_INPUT', 'Medication information is required');
      }

      if (!request.medication.name?.trim()) {
        return failure('INVALID_INPUT', 'Medication name is required');
      }

      if (!request.medication.dosage?.trim()) {
        return failure('INVALID_INPUT', 'Medication dosage is required');
      }

      // Invoke edge function
      const { data, error } = await supabase.functions.invoke('ai-medication-instructions', {
        body: {
          patientId: request.patientId,
          medication: request.medication,
          patientContext: request.patientContext || {},
          includeVisualAids: request.includeVisualAids ?? true,
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      return success(data as MedicationInstructionsResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('MEDICATION_INSTRUCTIONS_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Generate instructions for multiple medications (med list)
   *
   * @param patientId - Patient ID
   * @param medications - Array of medications
   * @param patientContext - Patient context
   * @param tenantId - Tenant ID
   * @returns ServiceResult with array of instructions
   */
  static async generateBulkInstructions(
    patientId: string,
    medications: MedicationInfo[],
    patientContext?: PatientMedContext,
    tenantId?: string
  ): Promise<ServiceResult<MedicationInstructionsResponse[]>> {
    try {
      if (!patientId?.trim()) {
        return failure('INVALID_INPUT', 'Patient ID is required');
      }

      if (!medications || medications.length === 0) {
        return failure('INVALID_INPUT', 'At least one medication is required');
      }

      // Generate instructions for each medication
      const results: MedicationInstructionsResponse[] = [];
      const errors: string[] = [];

      for (const medication of medications) {
        const result = await this.generateInstructions({
          patientId,
          medication,
          patientContext,
          tenantId,
        });

        if (result.success && result.data) {
          results.push(result.data);
        } else {
          errors.push(`${medication.name}: ${result.error?.message || 'Unknown error'}`);
        }
      }

      if (results.length === 0) {
        return failure('BULK_GENERATION_FAILED', `All medications failed: ${errors.join('; ')}`);
      }

      return success(results);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('BULK_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Save generated instructions to database
   *
   * @param request - Original request
   * @param response - AI response
   * @returns ServiceResult with saved record
   */
  static async saveInstructions(
    request: MedicationInstructionsRequest,
    response: MedicationInstructionsResponse
  ): Promise<ServiceResult<SavedMedicationInstructions>> {
    try {
      const instructionId = crypto.randomUUID();

      const { data, error } = await supabase
        .from('ai_medication_instructions')
        .insert({
          instruction_id: instructionId,
          patient_id: request.patientId,
          medication_name: request.medication.name,
          dosage: request.medication.dosage,
          form: request.medication.form,
          frequency: request.medication.frequency,
          patient_context: request.patientContext || {},
          result: response.result,
          language: response.metadata.language,
          reading_level: response.metadata.readingLevel,
        })
        .select()
        .single();

      if (error) throw error;

      return success(this.mapDbToSaved(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('SAVE_INSTRUCTIONS_FAILED', error.message, error);
    }
  }

  /**
   * Mark instructions as delivered
   *
   * @param instructionId - Instruction record ID
   * @param deliveredVia - Delivery method
   * @returns ServiceResult with updated record
   */
  static async markAsDelivered(
    instructionId: string,
    deliveredVia: 'sms' | 'email' | 'app' | 'print'
  ): Promise<ServiceResult<SavedMedicationInstructions>> {
    try {
      const { data, error } = await supabase
        .from('ai_medication_instructions')
        .update({
          delivered_via: deliveredVia,
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', instructionId)
        .select()
        .single();

      if (error) throw error;

      return success(this.mapDbToSaved(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('UPDATE_INSTRUCTIONS_FAILED', error.message, error);
    }
  }

  /**
   * Get patient's medication instruction history
   *
   * @param patientId - Patient ID
   * @param limit - Max records
   * @returns ServiceResult with instruction history
   */
  static async getPatientInstructionHistory(
    patientId: string,
    limit: number = 50
  ): Promise<ServiceResult<SavedMedicationInstructions[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_medication_instructions')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return success((data || []).map(this.mapDbToSaved));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_HISTORY_FAILED', error.message, error);
    }
  }

  /**
   * Format instructions for SMS delivery
   * Condensed version with essentials only
   *
   * @param result - Instruction result
   * @param patientName - Patient's first name
   * @returns Formatted SMS text
   */
  static formatForSMS(result: MedicationInstructionResult, patientName: string): string {
    const lines: string[] = [
      `Hi ${patientName}! Your ${result.medicationName} instructions:`,
      '',
      `WHAT: ${result.whatItDoes}`,
      '',
      'WHEN TO TAKE:',
    ];

    result.dosingSchedule.forEach((dose) => {
      lines.push(`- ${dose.timeOfDay}: ${dose.doseAmount}${dose.withFood === 'required' ? ' WITH FOOD' : ''}`);
    });

    if (result.dosAndDonts.donts.length > 0) {
      lines.push('', 'AVOID:');
      result.dosAndDonts.donts.slice(0, 2).forEach((dont) => lines.push(`- ${dont}`));
    }

    lines.push('', 'Questions? Call your pharmacy or doctor.');

    let text = lines.join('\n');
    if (text.length > 1500) {
      text = text.slice(0, 1497) + '...';
    }

    return text;
  }

  /**
   * Format instructions for print (large text, caregiver-friendly)
   *
   * @param result - Instruction result
   * @param patientName - Patient name
   * @returns Formatted print text
   */
  static formatForPrint(result: MedicationInstructionResult, patientName: string): string {
    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════',
      `MEDICATION INSTRUCTIONS FOR ${patientName.toUpperCase()}`,
      '═══════════════════════════════════════════════════════════════',
      '',
      `MEDICATION: ${result.medicationName}`,
      '',
      `WHAT IT DOES: ${result.whatItDoes}`,
      '',
      `WHY YOU TAKE IT: ${result.whyYouTakeIt}`,
      '',
    ];

    // Pill identification
    if (result.pillIdentification) {
      lines.push(
        '── HOW TO IDENTIFY YOUR PILLS ──',
        result.pillIdentification.visualDescription,
        ''
      );
    }

    // Dosing schedule
    lines.push('── WHEN TO TAKE ──');
    result.dosingSchedule.forEach((dose) => {
      let doseText = `  ${dose.timeOfDay}${dose.specificTime ? ` (${dose.specificTime})` : ''}: ${dose.doseAmount}`;
      if (dose.withFood === 'required') doseText += ' - TAKE WITH FOOD';
      if (dose.withFood === 'avoid') doseText += ' - TAKE ON EMPTY STOMACH';
      lines.push(doseText);
    });
    lines.push('');

    // How to take
    lines.push('── HOW TO TAKE ──');
    result.howToTake.forEach((step, i) => lines.push(`  ${i + 1}. ${step}`));
    lines.push('');

    // Side effects
    lines.push('── POSSIBLE SIDE EFFECTS ──');
    result.sideEffects.forEach((se) => {
      lines.push(`  • ${se.effect} (${se.likelihood}) - ${se.action}`);
    });
    lines.push('');

    // Warning signs
    lines.push('── CALL YOUR DOCTOR IF ──');
    result.warningSigns.forEach((ws) => {
      const urgencyLabel = ws.urgency === 'seek_emergency' ? '🚨 EMERGENCY' : '📞 CALL';
      lines.push(`  ${urgencyLabel}: ${ws.sign}`);
    });
    lines.push('');

    // Do's and Don'ts
    lines.push('── DO ──');
    result.dosAndDonts.dos.forEach((d) => lines.push(`  ✓ ${d}`));
    lines.push('');
    lines.push('── DO NOT ──');
    result.dosAndDonts.donts.forEach((d) => lines.push(`  ✗ ${d}`));
    lines.push('');

    // Missed dose
    lines.push('── IF YOU MISS A DOSE ──');
    result.missedDoseInstructions.forEach((i) => lines.push(`  • ${i}`));
    lines.push('');

    // Storage
    lines.push('── HOW TO STORE ──');
    result.storageInstructions.forEach((s) => lines.push(`  • ${s}`));
    lines.push('');

    // Emergency info
    lines.push(
      '── EMERGENCY ──',
      `  Poison Control: ${result.emergencyInfo.poisonControlNumber}`,
      `  Overdose symptoms: ${result.emergencyInfo.overdoseSymptoms.join(', ')}`,
      `  If overdose suspected: ${result.emergencyInfo.overdoseAction}`,
      ''
    );

    lines.push(
      '═══════════════════════════════════════════════════════════════',
      `Generated: ${new Date().toLocaleDateString()}`,
      '═══════════════════════════════════════════════════════════════'
    );

    return lines.join('\n');
  }

  /**
   * Generate simple reminder card text
   *
   * @param result - Instruction result
   * @returns Short reminder card text
   */
  static generateReminderCard(result: MedicationInstructionResult): string {
    const lines: string[] = [
      `💊 ${result.medicationName}`,
      '',
    ];

    result.dosingSchedule.forEach((dose) => {
      const food = dose.withFood === 'required' ? '🍽️' : dose.withFood === 'avoid' ? '⏸️' : '';
      lines.push(`${dose.timeOfDay}: ${dose.doseAmount} ${food}`);
    });

    if (result.dosAndDonts.donts.length > 0) {
      lines.push('', `⚠️ ${result.dosAndDonts.donts[0]}`);
    }

    return lines.join('\n');
  }

  /**
   * Map database row to typed object
   */
  private static mapDbToSaved(row: Record<string, unknown>): SavedMedicationInstructions {
    return {
      id: row.id as string,
      instructionId: row.instruction_id as string,
      patientId: row.patient_id as string,
      medicationName: row.medication_name as string,
      dosage: row.dosage as string,
      result: row.result as MedicationInstructionResult,
      deliveredVia: row.delivered_via as 'sms' | 'email' | 'app' | 'print' | undefined,
      deliveredAt: row.delivered_at as string | undefined,
      createdAt: row.created_at as string,
    };
  }
}

export default MedicationInstructionsService;
