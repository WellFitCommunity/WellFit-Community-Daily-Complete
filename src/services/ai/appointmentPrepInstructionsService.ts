/**
 * Appointment Prep Instructions AI Service
 *
 * Generates personalized, condition-specific preparation instructions for patient appointments.
 * Uses Claude Haiku 4.5 for cost-effective generation of patient-friendly content.
 *
 * Features:
 * 1. Condition-specific preparation (fasting, medication holds, etc.)
 * 2. Appointment-type-specific instructions
 * 3. What-to-bring checklists
 * 4. Medication considerations
 * 5. Multi-language support
 * 6. Reading-level appropriate content (6th grade)
 *
 * @module appointmentPrepInstructionsService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AppointmentType =
  | 'annual_physical'
  | 'follow_up'
  | 'specialist_consult'
  | 'lab_work'
  | 'imaging'
  | 'procedure'
  | 'telehealth'
  | 'vaccination'
  | 'mental_health'
  | 'dental'
  | 'eye_exam'
  | 'pre_surgical'
  | 'post_surgical'
  | 'other';

export interface AppointmentDetails {
  /** Type of appointment */
  type: AppointmentType;
  /** Specialty or department */
  specialty?: string;
  /** Provider name */
  providerName?: string;
  /** Appointment date/time */
  appointmentDateTime: string;
  /** Location/facility */
  location?: string;
  /** Duration in minutes */
  durationMinutes?: number;
  /** Specific tests or procedures planned */
  plannedTests?: string[];
  /** Any special notes from scheduler */
  schedulerNotes?: string;
}

export interface PatientPrepContext {
  /** Patient age */
  age?: number;
  /** Active conditions (ICD-10/display) */
  activeConditions?: Array<{ code: string; display: string }>;
  /** Current medications */
  currentMedications?: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
  }>;
  /** Known allergies */
  allergies?: string[];
  /** Mobility limitations */
  mobilityLimitations?: string[];
  /** Preferred language */
  language?: string;
  /** Special needs (hearing, vision, cognitive) */
  specialNeeds?: string[];
}

export interface PrepInstructionItem {
  /** Category of instruction */
  category: 'before' | 'day_of' | 'bring' | 'medication' | 'dietary' | 'transportation' | 'after';
  /** Priority level */
  priority: 'required' | 'recommended' | 'optional';
  /** Timing (e.g., "24 hours before", "Morning of") */
  timing?: string;
  /** The instruction text */
  instruction: string;
  /** Why this is important */
  rationale?: string;
}

export interface AppointmentPrepResult {
  /** Personalized greeting */
  greeting: string;
  /** Brief summary of what to expect */
  appointmentSummary: string;
  /** Categorized preparation instructions */
  instructions: PrepInstructionItem[];
  /** Items to bring checklist */
  bringChecklist: Array<{
    item: string;
    required: boolean;
    note?: string;
  }>;
  /** Medication-specific instructions */
  medicationInstructions: Array<{
    medication: string;
    instruction: string;
    timing: string;
    warning?: string;
  }>;
  /** Dietary instructions if applicable */
  dietaryInstructions?: {
    fastingRequired: boolean;
    fastingHours?: number;
    foodRestrictions?: string[];
    hydrationGuidance?: string;
  };
  /** Transportation considerations */
  transportationNotes?: string[];
  /** What to expect during the appointment */
  whatToExpect: string[];
  /** Estimated appointment duration */
  estimatedDuration?: string;
  /** Questions patient might want to ask */
  suggestedQuestions?: string[];
  /** Contact information for questions */
  contactInfo?: string;
  /** Important reminders */
  keyReminders: string[];
}

export interface AppointmentPrepRequest {
  /** Patient ID */
  patientId: string;
  /** Appointment details */
  appointment: AppointmentDetails;
  /** Patient context for personalization */
  patientContext?: PatientPrepContext;
  /** Tenant ID */
  tenantId?: string;
}

export interface AppointmentPrepResponse {
  /** Generated prep instructions */
  result: AppointmentPrepResult;
  /** Metadata about generation */
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    appointmentType: string;
    language: string;
  };
}

export interface SavedAppointmentPrep {
  id: string;
  prepId: string;
  patientId: string;
  appointmentType: string;
  appointmentDateTime: string;
  result: AppointmentPrepResult;
  sentVia?: 'sms' | 'email' | 'app' | 'print';
  sentAt?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class AppointmentPrepInstructionsService {
  /**
   * Generate personalized appointment preparation instructions
   *
   * @param request - Prep instruction request with appointment and patient context
   * @returns ServiceResult with generated instructions or error
   */
  static async generatePrepInstructions(
    request: AppointmentPrepRequest
  ): Promise<ServiceResult<AppointmentPrepResponse>> {
    try {
      // Validate required fields
      if (!request.patientId?.trim()) {
        return failure('INVALID_INPUT', 'Patient ID is required');
      }

      if (!request.appointment) {
        return failure('INVALID_INPUT', 'Appointment details are required');
      }

      if (!request.appointment.type) {
        return failure('INVALID_INPUT', 'Appointment type is required');
      }

      if (!request.appointment.appointmentDateTime) {
        return failure('INVALID_INPUT', 'Appointment date/time is required');
      }

      // Invoke edge function
      const { data, error } = await supabase.functions.invoke('ai-appointment-prep-instructions', {
        body: {
          patientId: request.patientId,
          appointment: request.appointment,
          patientContext: request.patientContext || {},
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      return success(data as AppointmentPrepResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('APPOINTMENT_PREP_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Save generated prep instructions to database
   *
   * @param request - Original request
   * @param response - AI response to save
   * @returns ServiceResult with saved record
   */
  static async savePrepInstructions(
    request: AppointmentPrepRequest,
    response: AppointmentPrepResponse
  ): Promise<ServiceResult<SavedAppointmentPrep>> {
    try {
      const prepId = crypto.randomUUID();

      const { data, error } = await supabase
        .from('ai_appointment_prep_instructions')
        .insert({
          prep_id: prepId,
          patient_id: request.patientId,
          appointment_type: request.appointment.type,
          appointment_date_time: request.appointment.appointmentDateTime,
          specialty: request.appointment.specialty,
          provider_name: request.appointment.providerName,
          location: request.appointment.location,
          patient_context: request.patientContext || {},
          result: response.result,
          language: response.metadata.language,
        })
        .select()
        .single();

      if (error) throw error;

      return success(this.mapDbToSaved(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('APPOINTMENT_PREP_SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Mark prep instructions as sent to patient
   *
   * @param prepId - Prep instruction record ID
   * @param sentVia - Delivery method
   * @returns ServiceResult with updated record
   */
  static async markAsSent(
    prepId: string,
    sentVia: 'sms' | 'email' | 'app' | 'print'
  ): Promise<ServiceResult<SavedAppointmentPrep>> {
    try {
      const { data, error } = await supabase
        .from('ai_appointment_prep_instructions')
        .update({
          sent_via: sentVia,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', prepId)
        .select()
        .single();

      if (error) throw error;

      return success(this.mapDbToSaved(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('APPOINTMENT_PREP_UPDATE_FAILED', error.message, error);
    }
  }

  /**
   * Get prep instructions history for a patient
   *
   * @param patientId - Patient UUID
   * @param limit - Maximum records to return
   * @returns ServiceResult with prep history
   */
  static async getPatientPrepHistory(
    patientId: string,
    limit: number = 20
  ): Promise<ServiceResult<SavedAppointmentPrep[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_appointment_prep_instructions')
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
   * Get upcoming appointment preps that haven't been sent
   *
   * @param daysAhead - How many days ahead to look
   * @returns ServiceResult with unsent preps
   */
  static async getUnsentPrepInstructions(
    daysAhead: number = 7
  ): Promise<ServiceResult<SavedAppointmentPrep[]>> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const { data, error } = await supabase
        .from('ai_appointment_prep_instructions')
        .select('*')
        .is('sent_at', null)
        .gte('appointment_date_time', new Date().toISOString())
        .lte('appointment_date_time', futureDate.toISOString())
        .order('appointment_date_time', { ascending: true });

      if (error) throw error;

      return success((data || []).map(this.mapDbToSaved));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('HISTORY_FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Generate a quick prep summary for common appointment types
   * Uses cached templates for faster response
   *
   * @param appointmentType - Type of appointment
   * @param language - Target language
   * @returns ServiceResult with quick prep summary
   */
  static getQuickPrepSummary(
    appointmentType: AppointmentType,
    _language: string = 'English'
  ): ServiceResult<string[]> {
    // Quick reference summaries for common appointments
    const quickSummaries: Record<AppointmentType, string[]> = {
      annual_physical: [
        'Wear comfortable, loose-fitting clothing',
        'Bring a list of all current medications',
        'Bring your insurance card and photo ID',
        'Prepare a list of questions or concerns',
        'Be ready to discuss your medical history',
      ],
      lab_work: [
        'Check if fasting is required (typically 8-12 hours)',
        'Drink plenty of water unless told otherwise',
        'Wear short sleeves or loose sleeves',
        'Bring your lab order if you have one',
        'Take medications as directed unless told to hold',
      ],
      imaging: [
        'Wear comfortable clothing without metal',
        'Remove jewelry before the appointment',
        'Inform staff if you are pregnant or might be',
        'Bring previous imaging CDs if requested',
        'Arrive 15 minutes early for registration',
      ],
      procedure: [
        'Follow all pre-procedure instructions carefully',
        'Arrange for someone to drive you home',
        'Do not eat or drink after midnight unless told otherwise',
        'Wear comfortable, loose clothing',
        'Leave valuables at home',
      ],
      telehealth: [
        'Test your device and internet connection beforehand',
        'Find a quiet, well-lit, private space',
        'Have your medications nearby for reference',
        'Prepare a list of questions',
        'Log in 5 minutes early',
      ],
      specialist_consult: [
        'Bring referral paperwork if required',
        'Bring all relevant medical records',
        'List all medications including supplements',
        'Prepare questions specific to your condition',
        'Bring someone to help remember information',
      ],
      follow_up: [
        'Review your previous visit notes',
        'Track any symptoms since last visit',
        'Bring current medication list',
        'Note any side effects from treatments',
        'Prepare questions about next steps',
      ],
      vaccination: [
        'Wear a shirt that allows easy arm access',
        'Eat a light meal beforehand',
        'Bring your vaccination record',
        'Be prepared to wait 15 minutes after',
        'Know your allergy history',
      ],
      mental_health: [
        'Find a private, comfortable space',
        'Have tissues and water nearby',
        'Consider keeping a journal of thoughts',
        'Be honest and open during the session',
        'Note any medication changes or side effects',
      ],
      dental: [
        'Brush and floss before your appointment',
        'Avoid eating right before the visit',
        'Bring dental insurance information',
        'List any medications including blood thinners',
        'Inform staff of any dental anxiety',
      ],
      eye_exam: [
        'Bring current glasses or contact lenses',
        'Know your prescription if available',
        'Arrange a driver if dilation is planned',
        'Bring sunglasses for after dilation',
        'List all medications and supplements',
      ],
      pre_surgical: [
        'Complete all required pre-op tests',
        'Stop blood thinners as directed',
        'Do not eat or drink after midnight',
        'Arrange post-surgery transportation',
        'Prepare your home for recovery',
      ],
      post_surgical: [
        'Bring any surgical documentation',
        'List all post-op symptoms and concerns',
        'Know your medication schedule',
        'Wear loose, comfortable clothing',
        'Prepare questions about activity restrictions',
      ],
      other: [
        'Bring your insurance card and photo ID',
        'List all current medications',
        'Prepare a list of questions',
        'Arrive 15 minutes early',
        'Bring relevant medical records',
      ],
    };

    const summary = quickSummaries[appointmentType] || quickSummaries.other;
    return success(summary);
  }

  /**
   * Format prep instructions for SMS delivery
   *
   * @param result - Prep instruction result
   * @param patientName - Patient's first name
   * @returns Formatted SMS text (max 1600 chars)
   */
  static formatForSMS(result: AppointmentPrepResult, patientName: string): string {
    const lines: string[] = [
      `Hi ${patientName}! Here's how to prepare for your appointment:`,
      '',
    ];

    // Add key reminders first (most important)
    if (result.keyReminders.length > 0) {
      lines.push('IMPORTANT:');
      result.keyReminders.slice(0, 3).forEach((r) => lines.push(`- ${r}`));
      lines.push('');
    }

    // Add required instructions
    const required = result.instructions.filter((i) => i.priority === 'required').slice(0, 3);
    if (required.length > 0) {
      lines.push('BEFORE YOUR VISIT:');
      required.forEach((i) => lines.push(`- ${i.instruction}`));
      lines.push('');
    }

    // Add checklist (top 3 items)
    const requiredItems = result.bringChecklist.filter((i) => i.required).slice(0, 3);
    if (requiredItems.length > 0) {
      lines.push('BRING:');
      requiredItems.forEach((i) => lines.push(`- ${i.item}`));
    }

    // Truncate to SMS limit
    let text = lines.join('\n');
    if (text.length > 1500) {
      text = text.slice(0, 1497) + '...';
    }

    return text;
  }

  /**
   * Format prep instructions for email delivery
   *
   * @param result - Prep instruction result
   * @param patientName - Patient's name
   * @param appointmentDetails - Appointment info
   * @returns Formatted HTML email body
   */
  static formatForEmail(
    result: AppointmentPrepResult,
    patientName: string,
    appointmentDetails: AppointmentDetails
  ): string {
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    };

    let html = `
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #4A90D9; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .section { margin-bottom: 20px; }
    .section-title { color: #4A90D9; font-weight: bold; margin-bottom: 10px; }
    .checklist { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .checklist li { margin: 5px 0; }
    .important { background: #FFF3CD; padding: 10px; border-left: 4px solid #FFC107; margin: 10px 0; }
    .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Your Appointment Preparation Guide</h1>
    <p>${formatDate(appointmentDetails.appointmentDateTime)}</p>
  </div>
  <div class="content">
    <p>${result.greeting}</p>

    <div class="important">
      <strong>Key Reminders:</strong>
      <ul>
        ${result.keyReminders.map((r) => `<li>${r}</li>`).join('')}
      </ul>
    </div>

    <div class="section">
      <div class="section-title">What to Expect</div>
      <p>${result.appointmentSummary}</p>
      <ul>
        ${result.whatToExpect.map((w) => `<li>${w}</li>`).join('')}
      </ul>
    </div>

    <div class="section checklist">
      <div class="section-title">What to Bring</div>
      <ul>
        ${result.bringChecklist.map((i) => `<li>${i.required ? '<strong>' : ''}${i.item}${i.required ? '</strong>' : ''}${i.note ? ` - ${i.note}` : ''}</li>`).join('')}
      </ul>
    </div>
`;

    // Add dietary instructions if present
    if (result.dietaryInstructions?.fastingRequired) {
      html += `
    <div class="section important">
      <div class="section-title">Dietary Instructions</div>
      <p><strong>Fasting Required:</strong> ${result.dietaryInstructions.fastingHours} hours before your appointment</p>
      ${result.dietaryInstructions.hydrationGuidance ? `<p>${result.dietaryInstructions.hydrationGuidance}</p>` : ''}
    </div>
`;
    }

    // Add medication instructions if present
    if (result.medicationInstructions.length > 0) {
      html += `
    <div class="section">
      <div class="section-title">Medication Instructions</div>
      <ul>
        ${result.medicationInstructions.map((m) => `<li><strong>${m.medication}:</strong> ${m.instruction} (${m.timing})${m.warning ? ` <em>- ${m.warning}</em>` : ''}</li>`).join('')}
      </ul>
    </div>
`;
    }

    // Add suggested questions
    if (result.suggestedQuestions && result.suggestedQuestions.length > 0) {
      html += `
    <div class="section">
      <div class="section-title">Questions You Might Want to Ask</div>
      <ul>
        ${result.suggestedQuestions.map((q) => `<li>${q}</li>`).join('')}
      </ul>
    </div>
`;
    }

    html += `
  </div>
  <div class="footer">
    <p>This preparation guide was generated to help you prepare for your appointment.</p>
    <p>If you have questions, please contact your healthcare provider.</p>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Format prep instructions for printing
   *
   * @param result - Prep instruction result
   * @param patientName - Patient's name
   * @param appointmentDetails - Appointment info
   * @returns Plain text for printing
   */
  static formatForPrint(
    result: AppointmentPrepResult,
    patientName: string,
    appointmentDetails: AppointmentDetails
  ): string {
    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════',
      'APPOINTMENT PREPARATION INSTRUCTIONS',
      '═══════════════════════════════════════════════════════════════',
      `Patient: ${patientName}`,
      `Appointment: ${new Date(appointmentDetails.appointmentDateTime).toLocaleString()}`,
      `Type: ${appointmentDetails.type.replace(/_/g, ' ').toUpperCase()}`,
      appointmentDetails.providerName ? `Provider: ${appointmentDetails.providerName}` : '',
      appointmentDetails.location ? `Location: ${appointmentDetails.location}` : '',
      '',
      '── KEY REMINDERS ──',
      ...result.keyReminders.map((r) => `  ! ${r}`),
      '',
      '── WHAT TO EXPECT ──',
      result.appointmentSummary,
      '',
      ...result.whatToExpect.map((w) => `  • ${w}`),
      '',
      '── WHAT TO BRING ──',
      ...result.bringChecklist.map(
        (i) => `  ${i.required ? '[REQUIRED]' : '[Optional]'} ${i.item}${i.note ? ` - ${i.note}` : ''}`
      ),
      '',
    ];

    // Add dietary instructions
    if (result.dietaryInstructions?.fastingRequired) {
      lines.push(
        '── DIETARY INSTRUCTIONS ──',
        `  FASTING REQUIRED: ${result.dietaryInstructions.fastingHours} hours before appointment`,
        result.dietaryInstructions.hydrationGuidance
          ? `  ${result.dietaryInstructions.hydrationGuidance}`
          : '',
        ''
      );
    }

    // Add medication instructions
    if (result.medicationInstructions.length > 0) {
      lines.push(
        '── MEDICATION INSTRUCTIONS ──',
        ...result.medicationInstructions.map(
          (m) =>
            `  ${m.medication}: ${m.instruction} (${m.timing})${m.warning ? ` WARNING: ${m.warning}` : ''}`
        ),
        ''
      );
    }

    // Add suggested questions
    if (result.suggestedQuestions && result.suggestedQuestions.length > 0) {
      lines.push(
        '── QUESTIONS TO ASK ──',
        ...result.suggestedQuestions.map((q) => `  ? ${q}`),
        ''
      );
    }

    lines.push(
      '═══════════════════════════════════════════════════════════════',
      `Generated: ${new Date().toISOString()}`,
      '═══════════════════════════════════════════════════════════════'
    );

    return lines.filter((l) => l !== '').join('\n');
  }

  /**
   * Map database row to typed object
   */
  private static mapDbToSaved(row: Record<string, unknown>): SavedAppointmentPrep {
    return {
      id: row.id as string,
      prepId: row.prep_id as string,
      patientId: row.patient_id as string,
      appointmentType: row.appointment_type as string,
      appointmentDateTime: row.appointment_date_time as string,
      result: row.result as AppointmentPrepResult,
      sentVia: row.sent_via as 'sms' | 'email' | 'app' | 'print' | undefined,
      sentAt: row.sent_at as string | undefined,
      createdAt: row.created_at as string,
    };
  }
}

export default AppointmentPrepInstructionsService;
