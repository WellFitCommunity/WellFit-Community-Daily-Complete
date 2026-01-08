/**
 * Patient-Friendly After Visit Summary (AVS) Service
 *
 * Generates low-literacy, patient-friendly discharge instructions
 * from clinical documentation (SmartScribe sessions, SOAP notes).
 *
 * Target: Flesch-Kincaid Grade Level 6 or lower
 *
 * Part of the P1 AI/ML Scale Optimization initiative.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  AVSInput,
  AVSGenerationRequest,
  AVSGenerationOptions,
  AVSGenerationResult,
  PatientFriendlyAVS,
  AVSRecord,
  MedicationChangesSection,
} from '../types/patientFriendlyAVS';
import {
  calculateFleschKincaidGrade as calcGrade,
  formatAVSAsPlainText as formatPlainText,
} from '../types/patientFriendlyAVS';

// Default generation options
const DEFAULT_OPTIONS: AVSGenerationOptions = {
  includeMedications: true,
  includeFollowUp: true,
  includeResources: true,
  targetGradeLevel: 6,
  requireReview: true,
  includeOriginalNote: false,
};

// Medical term simplification dictionary
const MEDICAL_TERM_SIMPLIFICATIONS: Record<string, string> = {
  hypertension: 'high blood pressure',
  hypotension: 'low blood pressure',
  tachycardia: 'fast heartbeat',
  bradycardia: 'slow heartbeat',
  dyspnea: 'trouble breathing',
  edema: 'swelling',
  pruritus: 'itching',
  nausea: 'feeling sick to your stomach',
  emesis: 'throwing up',
  vertigo: 'dizziness',
  syncope: 'fainting',
  cephalgia: 'headache',
  myalgia: 'muscle pain',
  arthralgia: 'joint pain',
  hyperglycemia: 'high blood sugar',
  hypoglycemia: 'low blood sugar',
  febrile: 'having a fever',
  afebrile: 'no fever',
  ambulatory: 'able to walk',
  bilateral: 'on both sides',
  unilateral: 'on one side',
  acute: 'sudden or severe',
  chronic: 'ongoing or long-term',
  benign: 'not harmful',
  malignant: 'cancerous',
  antibiotic: 'medicine that kills germs',
  analgesic: 'pain medicine',
  antipyretic: 'fever-reducing medicine',
  antihypertensive: 'blood pressure medicine',
  diuretic: 'water pill',
  anticoagulant: 'blood thinner',
  statin: 'cholesterol medicine',
  bronchodilator: 'medicine that opens your airways',
  subcutaneous: 'under the skin',
  intramuscular: 'into the muscle',
  intravenous: 'into the vein',
  oral: 'by mouth',
  topical: 'on the skin',
  bid: 'twice a day',
  tid: 'three times a day',
  qid: 'four times a day',
  qd: 'once a day',
  prn: 'as needed',
  po: 'by mouth',
  mg: 'milligrams',
  ml: 'milliliters',
  cc: 'milliliters',
};

/**
 * Simplify medical terminology in text
 */
function simplifyMedicalTerms(text: string): string {
  let simplified = text.toLowerCase();

  for (const [term, simple] of Object.entries(MEDICAL_TERM_SIMPLIFICATIONS)) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    simplified = simplified.replace(regex, simple);
  }

  // Capitalize first letter of sentences
  simplified = simplified.replace(/(^|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());

  return simplified;
}

/**
 * Generate patient-friendly explanation from SOAP assessment
 */
function generateWhatHappened(input: AVSInput): string {
  const { soapNote, patientFirstName } = input;

  if (!soapNote) {
    return 'You came in for a visit with your healthcare provider today.';
  }

  // Start with personalization
  let text = patientFirstName
    ? `${patientFirstName}, you came in today because `
    : 'You came in today because ';

  // Extract chief complaint from subjective
  const subjective = simplifyMedicalTerms(soapNote.subjective);

  // Try to extract the reason for visit
  if (subjective.includes('presents for') || subjective.includes('comes in for')) {
    const match = subjective.match(/(?:presents for|comes in for)\s+([^.]+)/i);
    if (match) {
      text += match[1].trim() + '.';
    } else {
      text += 'you had some health concerns we needed to address.';
    }
  } else if (subjective.includes('reports')) {
    const match = subjective.match(/reports?\s+([^.]+)/i);
    if (match) {
      text += 'you were having ' + match[1].trim() + '.';
    } else {
      text += 'you had some symptoms we needed to look at.';
    }
  } else {
    text += 'you needed to be checked out.';
  }

  return text;
}

/**
 * Generate patient-friendly findings from SOAP objective
 */
function generateWhatWeFound(input: AVSInput): string {
  const { soapNote } = input;

  if (!soapNote) {
    return 'Your healthcare provider examined you and reviewed your health information.';
  }

  const objective = simplifyMedicalTerms(soapNote.objective);
  const assessment = simplifyMedicalTerms(soapNote.assessment);

  let findings = 'During your visit, we checked you over. ';

  // Look for vital signs
  if (objective.includes('blood pressure') || objective.includes('bp')) {
    findings += 'We measured your blood pressure. ';
  }
  if (objective.includes('temperature') || objective.includes('temp')) {
    findings += 'We checked your temperature. ';
  }

  // Summarize assessment in simple terms
  if (assessment) {
    // Try to extract diagnoses
    const diagnoses = assessment.split(/\d+\.\s+/).filter(d => d.trim().length > 0);
    if (diagnoses.length > 0) {
      findings += 'Based on what we found, ';
      if (diagnoses.length === 1) {
        findings += 'your main health issue is ' + diagnoses[0].split('-')[0].trim() + '. ';
      } else {
        findings += 'we identified some things to work on. ';
      }
    }
  }

  return findings;
}

/**
 * Generate action items from SOAP plan
 */
function generateWhatToDoNext(input: AVSInput): string[] {
  const { soapNote } = input;

  if (!soapNote?.plan) {
    return ['Follow your healthcare provider\'s instructions.'];
  }

  const plan = simplifyMedicalTerms(soapNote.plan);

  // Split plan into action items
  const items: string[] = [];

  // Try to parse numbered list
  const numbered = plan.split(/\d+\.\s+/).filter(item => item.trim().length > 0);
  if (numbered.length > 0) {
    for (const item of numbered) {
      // Clean up and simplify each item
      let action = item.trim();
      // Remove trailing periods if we're going to add our own
      action = action.replace(/\.$/, '');
      // Capitalize first letter
      action = action.charAt(0).toUpperCase() + action.slice(1);
      items.push(action);
    }
  } else {
    // Try to split by sentences
    const sentences = plan.split(/[.!]/).filter(s => s.trim().length > 10);
    for (const sentence of sentences.slice(0, 5)) {
      let action = sentence.trim();
      action = action.charAt(0).toUpperCase() + action.slice(1);
      items.push(action);
    }
  }

  // Ensure we have at least one item
  if (items.length === 0) {
    items.push('Follow your healthcare provider\'s instructions');
  }

  return items;
}

/**
 * Generate warning signs based on assessment
 */
function generateWarningSigns(input: AVSInput): string[] {
  const { suggestedCodes } = input;

  const warningSigns: string[] = [];

  // Generic warning signs that apply to most visits
  warningSigns.push('You have a fever over 101°F that does not go down with medicine');
  warningSigns.push('Your symptoms get much worse instead of better');

  // Add condition-specific warnings based on ICD-10 codes
  if (suggestedCodes) {
    for (const code of suggestedCodes) {
      if (code.type !== 'ICD10') continue;

      const codeUpper = code.code.toUpperCase();

      // Diabetes-related
      if (codeUpper.startsWith('E11') || codeUpper.startsWith('E10')) {
        warningSigns.push('Your blood sugar is very high (over 300) or very low (under 70)');
        warningSigns.push('You feel very thirsty, need to pee a lot, or feel confused');
      }

      // Respiratory
      if (codeUpper.startsWith('J')) {
        warningSigns.push('You have trouble breathing or chest pain');
        warningSigns.push('Your lips or fingernails turn blue');
      }

      // Cardiac
      if (codeUpper.startsWith('I')) {
        warningSigns.push('You have chest pain, pressure, or tightness');
        warningSigns.push('You feel like your heart is racing or skipping beats');
      }

      // Infection
      if (codeUpper.startsWith('A') || codeUpper.startsWith('B')) {
        warningSigns.push('You have shaking chills or feel very weak');
      }
    }
  }

  // Deduplicate
  return [...new Set(warningSigns)].slice(0, 5);
}

/**
 * Extract medication information from plan and assessment
 */
function extractMedicationChanges(input: AVSInput): MedicationChangesSection {
  const section: MedicationChangesSection = {
    newMedicines: [],
    stoppedMedicines: [],
    changedDoses: [],
    reminders: [],
  };

  if (!input.soapNote?.plan) {
    return section;
  }

  const plan = input.soapNote.plan.toLowerCase();

  // Look for common medication change patterns
  // "Start metformin" or "begin lisinopril"
  const startPatterns = plan.match(/(?:start|begin|initiate|add)\s+([a-z]+(?:\s+\d+\s*mg)?)/gi);
  if (startPatterns) {
    for (const match of startPatterns) {
      const medName = match.replace(/^(start|begin|initiate|add)\s+/i, '').trim();
      section.newMedicines.push({
        name: medName.charAt(0).toUpperCase() + medName.slice(1),
        purpose: 'As prescribed by your provider',
        howToTake: 'Follow the instructions on your prescription label',
        whenToTake: 'As directed',
      });
    }
  }

  // "Increase metformin" or "decrease lisinopril"
  const changePatterns = plan.match(/(?:increase|decrease|adjust|change)\s+([a-z]+(?:\s+(?:to|from)\s+\d+\s*mg)?)/gi);
  if (changePatterns) {
    for (const match of changePatterns) {
      const medInfo = match.replace(/^(increase|decrease|adjust|change)\s+/i, '').trim();
      section.changedDoses.push({
        name: medInfo.charAt(0).toUpperCase() + medInfo.slice(1),
        purpose: 'Dose adjustment as discussed',
        howToTake: 'Follow the new instructions on your prescription',
        whenToTake: 'As directed',
      });
    }
  }

  // "Stop aspirin" or "discontinue ibuprofen"
  const stopPatterns = plan.match(/(?:stop|discontinue|hold|avoid)\s+([a-z]+)/gi);
  if (stopPatterns) {
    for (const match of stopPatterns) {
      const medName = match.replace(/^(stop|discontinue|hold|avoid)\s+/i, '').trim();
      section.stoppedMedicines.push({
        name: medName.charAt(0).toUpperCase() + medName.slice(1),
        purpose: 'No longer needed or needs to be stopped',
        howToTake: 'Do not take this medicine anymore',
        whenToTake: 'N/A',
      });
    }
  }

  // Add helpful reminders
  if (section.newMedicines.length > 0) {
    section.reminders = [
      'Take all new medicines exactly as directed',
      'If you have questions about any medicine, call your pharmacy or our office',
      'Keep a list of all your medicines and bring it to every visit',
    ];
  }

  return section;
}

/**
 * Generate questions the patient might want to ask
 */
function generateQuestionsToAsk(input: AVSInput): string[] {
  const questions: string[] = [
    'When should I expect to feel better?',
    'Are there any activities I should avoid?',
    'What should I do if my symptoms come back?',
  ];

  // Add condition-specific questions
  if (input.soapNote?.plan?.toLowerCase().includes('medication')) {
    questions.push('What are the side effects I should watch for with my new medicine?');
  }

  if (input.soapNote?.plan?.toLowerCase().includes('follow')) {
    questions.push('What will happen at my follow-up appointment?');
  }

  return questions.slice(0, 5);
}

/**
 * Patient-Friendly AVS Service
 */
export const PatientFriendlyAVSService = {
  /**
   * Generate AVS from clinical documentation
   */
  async generateAVS(request: AVSGenerationRequest): Promise<AVSGenerationResult> {
    const startTime = Date.now();
    const { input, options: userOptions } = request;
    const options = { ...DEFAULT_OPTIONS, ...userOptions };

    try {
      // Generate AVS content
      const whatHappened = generateWhatHappened(input);
      const whatWeFound = generateWhatWeFound(input);
      const whatToDoNext = generateWhatToDoNext(input);
      const warningSignsToWatch = generateWarningSigns(input);
      const medicationChanges = options.includeMedications ? extractMedicationChanges(input) : {
        newMedicines: [],
        stoppedMedicines: [],
        changedDoses: [],
      };
      const questionsToAsk = generateQuestionsToAsk(input);

      // Combine all text for readability scoring
      const allText = [
        whatHappened,
        whatWeFound,
        ...whatToDoNext,
        ...warningSignsToWatch,
        ...questionsToAsk,
      ].join(' ');

      const readingGradeLevel = calcGrade(allText);

      // Flag if above target
      const flaggedForReview: string[] = [];
      if (readingGradeLevel > options.targetGradeLevel) {
        flaggedForReview.push(`Reading level ${readingGradeLevel} exceeds target ${options.targetGradeLevel}`);
      }

      // Build AVS object
      const avs: PatientFriendlyAVS = {
        id: crypto.randomUUID(),
        patientId: input.patientId,
        sourceSessionId: input.sessionId,
        generatedAt: new Date().toISOString(),
        whatHappened,
        whatWeFound,
        whatToDoNext,
        warningSignsToWatch,
        medicationChanges,
        questionsToAsk,
        readingGradeLevel,
        language: input.language || 'en',
        confidence: readingGradeLevel <= options.targetGradeLevel ? 0.85 : 0.7,
        flaggedForReview: flaggedForReview.length > 0 ? flaggedForReview : undefined,
      };

      // Generate plain text version
      const plainTextContent = formatPlainText(avs);

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user?.id ?? '')
        .single();

      if (profile?.tenant_id) {
        const { error: insertError } = await supabase.from('patient_friendly_avs').insert({
          id: avs.id,
          tenant_id: profile.tenant_id,
          patient_id: input.patientId,
          session_id: input.sessionId || null,
          visit_date: input.visitDate,
          generated_by: user?.id || null,
          content_json: avs,
          plain_text_content: plainTextContent,
          reading_grade_level: readingGradeLevel,
          language: input.language || 'en',
          ai_confidence: avs.confidence,
          status: options.requireReview ? 'draft' : 'approved',
          processing_time_ms: Date.now() - startTime,
        });

        if (insertError) {
          await auditLogger.warn('AVS_SAVE_FAILED', {
            patientId: input.patientId,
            error: insertError.message,
          });
        }
      }

      await auditLogger.info('AVS_GENERATED', {
        avsId: avs.id,
        patientId: input.patientId,
        readingGradeLevel,
        processingTimeMs: Date.now() - startTime,
        category: 'CLINICAL',
      });

      return {
        success: true,
        avs,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      await auditLogger.error('AVS_GENERATION_FAILED', err as Error, {
        patientId: input.patientId,
        category: 'CLINICAL',
      });

      return {
        success: false,
        errors: [(err as Error).message],
        processingTimeMs: Date.now() - startTime,
      };
    }
  },

  /**
   * Get AVS by ID
   */
  async getAVS(avsId: string): Promise<ServiceResult<AVSRecord | null>> {
    try {
      const { data, error } = await supabase
        .from('patient_friendly_avs')
        .select('*')
        .eq('id', avsId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return success(null);
        }
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(mapDbToRecord(data));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get AVS', err);
    }
  },

  /**
   * Get AVS by session ID
   */
  async getAVSBySession(sessionId: string): Promise<ServiceResult<AVSRecord | null>> {
    try {
      const { data, error } = await supabase
        .from('patient_friendly_avs')
        .select('*')
        .eq('session_id', sessionId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return success(null);
        }
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(mapDbToRecord(data));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get AVS by session', err);
    }
  },

  /**
   * Get patient's AVS history
   */
  async getPatientAVSHistory(
    patientId: string,
    limit: number = 10
  ): Promise<ServiceResult<AVSRecord[]>> {
    try {
      const { data, error } = await supabase
        .from('patient_friendly_avs')
        .select('*')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []).map(mapDbToRecord));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient AVS history', err);
    }
  },

  /**
   * Approve AVS (provider review complete)
   */
  async approveAVS(avsId: string, approverId: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('patient_friendly_avs')
        .update({
          status: 'approved',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', avsId);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('AVS_APPROVED', {
        avsId,
        approverId,
        category: 'CLINICAL',
      });

      return success(undefined);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to approve AVS', err);
    }
  },

  /**
   * Mark AVS as delivered
   */
  async markDelivered(
    avsId: string,
    method: 'print' | 'email' | 'portal' | 'sms'
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('patient_friendly_avs')
        .update({
          status: 'delivered',
          delivery_method: method,
          delivered_at: new Date().toISOString(),
        })
        .eq('id', avsId);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('AVS_DELIVERED', {
        avsId,
        method,
        category: 'CLINICAL',
      });

      return success(undefined);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to mark AVS delivered', err);
    }
  },

  /**
   * Record patient feedback
   */
  async recordFeedback(
    avsId: string,
    feedback: 'helpful' | 'confusing' | 'incomplete',
    notes?: string
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('patient_friendly_avs')
        .update({
          patient_feedback: feedback,
          feedback_notes: notes,
          feedback_recorded_at: new Date().toISOString(),
        })
        .eq('id', avsId);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('AVS_FEEDBACK_RECORDED', {
        avsId,
        feedback,
        category: 'CLINICAL',
      });

      return success(undefined);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to record feedback', err);
    }
  },

  /**
   * Get plain text version for printing
   */
  async getPlainText(avsId: string): Promise<ServiceResult<string>> {
    try {
      const { data, error } = await supabase
        .from('patient_friendly_avs')
        .select('plain_text_content')
        .eq('id', avsId)
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data?.plain_text_content || '');
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get plain text', err);
    }
  },
};

/**
 * Database record shape from patient_friendly_avs table
 */
interface AVSDbRecord {
  id: string;
  tenant_id: string;
  patient_id: string;
  session_id: string | null;
  encounter_id: string | null;
  visit_date: string;
  generated_at: string;
  generated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  content_json: PatientFriendlyAVS;
  plain_text_content: string;
  reading_grade_level: number;
  language: string;
  status: 'draft' | 'approved' | 'delivered' | 'archived';
  delivery_method: 'email' | 'sms' | 'print' | 'portal' | null;
  delivered_at: string | null;
  patient_feedback: 'helpful' | 'incomplete' | 'confusing' | null;
  feedback_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Override language in AVSRecord to accept database value
type _AVSDbLanguage = 'en' | 'es' | string;

/**
 * Map database record to AVSRecord type
 */
function mapDbToRecord(data: AVSDbRecord): AVSRecord {
  return {
    id: data.id,
    tenantId: data.tenant_id,
    patientId: data.patient_id,
    sessionId: data.session_id ?? undefined,
    encounterId: data.encounter_id ?? undefined,
    visitDate: data.visit_date,
    generatedAt: data.generated_at,
    generatedBy: data.generated_by ?? undefined,
    approvedBy: data.approved_by ?? undefined,
    approvedAt: data.approved_at ?? undefined,
    contentJson: data.content_json,
    plainTextContent: data.plain_text_content,
    readingGradeLevel: data.reading_grade_level,
    language: data.language as 'en' | 'es',
    status: data.status,
    deliveryMethod: data.delivery_method ?? undefined,
    deliveredAt: data.delivered_at ?? undefined,
    patientFeedback: data.patient_feedback ?? undefined,
    feedbackNotes: data.feedback_notes ?? undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export default PatientFriendlyAVSService;
