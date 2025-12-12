/**
 * Patient-Friendly After Visit Summary (AVS) Types
 *
 * Types for generating low-literacy, patient-friendly discharge instructions
 * from clinical documentation (SmartScribe sessions, SOAP notes, etc.)
 *
 * Target: Flesch-Kincaid Grade Level 6 or lower
 *
 * Part of the P1 AI/ML Scale Optimization initiative.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

/**
 * Input for AVS generation - clinical documentation
 */
export interface AVSInput {
  /** SmartScribe session ID if available */
  sessionId?: string;
  /** Patient ID */
  patientId: string;
  /** Patient first name for personalization */
  patientFirstName?: string;
  /** Provider name */
  providerName?: string;
  /** Visit date */
  visitDate: string;
  /** Raw transcript from SmartScribe */
  transcript?: string;
  /** Structured SOAP note */
  soapNote?: SOAPNoteInput;
  /** Suggested billing codes for context */
  suggestedCodes?: BillingCodeInput[];
  /** Additional clinical context */
  clinicalContext?: string;
  /** Target reading level (default: 6) */
  targetGradeLevel?: number;
  /** Preferred language (default: 'en') */
  language?: 'en' | 'es';
}

/**
 * SOAP note input structure (matches SmartScribe output)
 */
export interface SOAPNoteInput {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  hpi?: string;
  ros?: string;
}

/**
 * Billing code input for context
 */
export interface BillingCodeInput {
  code: string;
  type: 'CPT' | 'ICD10' | 'HCPCS';
  description: string;
  confidence?: number;
}

/**
 * Patient-Friendly AVS Output - The generated summary
 */
export interface PatientFriendlyAVS {
  /** Unique AVS ID */
  id: string;
  /** Patient ID */
  patientId: string;
  /** Source session ID if from SmartScribe */
  sourceSessionId?: string;
  /** Generation timestamp */
  generatedAt: string;
  /** Provider who approved/generated */
  generatedBy?: string;

  // Main content sections
  /** What brought you in today */
  whatHappened: string;
  /** What we found during the visit */
  whatWeFound: string;
  /** What you should do next (list) */
  whatToDoNext: string[];
  /** Warning signs to watch for (list) */
  warningSignsToWatch: string[];

  // Medication section
  medicationChanges: MedicationChangesSection;

  // Follow-up section
  nextAppointment?: NextAppointmentSection;

  // Additional resources
  /** Questions patient might want to ask at follow-up */
  questionsToAsk: string[];
  /** Educational resources links */
  educationalResources?: EducationalResource[];

  // Metadata
  /** Flesch-Kincaid grade level achieved */
  readingGradeLevel: number;
  /** Language */
  language: 'en' | 'es';
  /** AI confidence in accuracy (0-1) */
  confidence: number;
  /** Sections that need provider review */
  flaggedForReview?: string[];
}

/**
 * Medication changes section
 */
export interface MedicationChangesSection {
  /** New medications starting */
  newMedicines: MedicationInstruction[];
  /** Medications being stopped */
  stoppedMedicines: MedicationInstruction[];
  /** Medications with changed doses */
  changedDoses: MedicationInstruction[];
  /** Medications continuing unchanged */
  continuingMedicines?: MedicationInstruction[];
  /** General medication reminders */
  reminders?: string[];
}

/**
 * Individual medication instruction
 */
export interface MedicationInstruction {
  /** Medication name (simplified if possible) */
  name: string;
  /** What it's for in plain language */
  purpose: string;
  /** How to take it */
  howToTake: string;
  /** When to take it */
  whenToTake: string;
  /** Important warnings */
  warnings?: string[];
  /** What to do if missed */
  ifMissed?: string;
}

/**
 * Next appointment section
 */
export interface NextAppointmentSection {
  /** When - in friendly format ("Tuesday, December 17th at 2:00 PM") */
  when: string;
  /** Where - with address */
  where: string;
  /** What to bring */
  bringWith: string[];
  /** How to prepare */
  howToPrepare?: string[];
  /** Contact info for questions */
  contactInfo?: string;
}

/**
 * Educational resource link
 */
export interface EducationalResource {
  title: string;
  description: string;
  url?: string;
  type: 'video' | 'article' | 'pdf' | 'website';
  language: 'en' | 'es';
}

/**
 * AVS Generation request
 */
export interface AVSGenerationRequest {
  input: AVSInput;
  options?: AVSGenerationOptions;
}

/**
 * Generation options
 */
export interface AVSGenerationOptions {
  /** Include medication section */
  includeMedications: boolean;
  /** Include follow-up section */
  includeFollowUp: boolean;
  /** Include educational resources */
  includeResources: boolean;
  /** Target grade level (default 6) */
  targetGradeLevel: number;
  /** Auto-approve or require review */
  requireReview: boolean;
  /** Include original clinical note for provider */
  includeOriginalNote: boolean;
}

/**
 * AVS Generation result
 */
export interface AVSGenerationResult {
  success: boolean;
  avs?: PatientFriendlyAVS;
  /** Errors if generation failed */
  errors?: string[];
  /** Warnings that don't block generation */
  warnings?: string[];
  /** Processing time in ms */
  processingTimeMs: number;
  /** Tokens used */
  tokensUsed?: number;
  /** Cost estimate */
  estimatedCost?: number;
}

/**
 * Database record for AVS (for audit and retrieval)
 */
export interface AVSRecord {
  id: string;
  tenantId: string;
  patientId: string;
  sessionId?: string;
  encounterId?: string;
  visitDate: string;
  generatedAt: string;
  generatedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  /** Full AVS content as JSON */
  contentJson: PatientFriendlyAVS;
  /** Plain text version for printing */
  plainTextContent: string;
  /** Reading grade level achieved */
  readingGradeLevel: number;
  language: 'en' | 'es';
  /** Status: draft, approved, delivered, archived */
  status: 'draft' | 'approved' | 'delivered' | 'archived';
  /** Delivery method: print, email, portal, sms */
  deliveryMethod?: 'print' | 'email' | 'portal' | 'sms';
  deliveredAt?: string;
  /** Patient feedback if collected */
  patientFeedback?: 'helpful' | 'confusing' | 'incomplete';
  feedbackNotes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Service interface for Patient-Friendly AVS
 */
export interface IPatientFriendlyAVSService {
  /** Generate AVS from clinical documentation */
  generateAVS(request: AVSGenerationRequest): Promise<AVSGenerationResult>;

  /** Get AVS by ID */
  getAVS(avsId: string): Promise<AVSRecord | null>;

  /** Get AVS by session ID */
  getAVSBySession(sessionId: string): Promise<AVSRecord | null>;

  /** Get patient's AVS history */
  getPatientAVSHistory(patientId: string, limit?: number): Promise<AVSRecord[]>;

  /** Approve AVS (provider review complete) */
  approveAVS(avsId: string, approverId: string): Promise<void>;

  /** Mark AVS as delivered */
  markDelivered(
    avsId: string,
    method: 'print' | 'email' | 'portal' | 'sms'
  ): Promise<void>;

  /** Record patient feedback */
  recordFeedback(
    avsId: string,
    feedback: 'helpful' | 'confusing' | 'incomplete',
    notes?: string
  ): Promise<void>;

  /** Get plain text version for printing */
  getPlainText(avsId: string): Promise<string>;

  /** Regenerate AVS (e.g., after edits) */
  regenerateAVS(avsId: string, updatedInput?: Partial<AVSInput>): Promise<AVSGenerationResult>;
}

// Helper functions

/**
 * Calculate Flesch-Kincaid Grade Level
 * Formula: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
 */
export function calculateFleschKincaidGrade(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
  const words = text.split(/\s+/).filter(w => w.length > 0).length || 1;
  const syllables = countSyllables(text);

  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

/**
 * Count syllables in text (approximation)
 */
export function countSyllables(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  let total = 0;

  for (const word of words) {
    // Remove non-alpha
    const cleaned = word.replace(/[^a-z]/g, '');
    if (cleaned.length === 0) continue;

    // Count vowel groups
    const vowelGroups = cleaned.match(/[aeiouy]+/g);
    let count = vowelGroups ? vowelGroups.length : 1;

    // Adjust for silent e
    if (cleaned.endsWith('e') && count > 1) count--;
    // Ensure at least 1
    total += Math.max(1, count);
  }

  return total || 1;
}

/**
 * Check if text meets target grade level
 */
export function meetsGradeLevel(text: string, targetGrade: number): boolean {
  return calculateFleschKincaidGrade(text) <= targetGrade;
}

/**
 * Get reading level badge color
 */
export function getReadingLevelColor(grade: number): string {
  if (grade <= 6) return 'bg-green-100 text-green-700';
  if (grade <= 8) return 'bg-yellow-100 text-yellow-700';
  if (grade <= 10) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

/**
 * Get reading level description
 */
export function getReadingLevelDescription(grade: number): string {
  if (grade <= 4) return 'Very Easy - Elementary level';
  if (grade <= 6) return 'Easy - Middle school level';
  if (grade <= 8) return 'Moderate - High school freshman';
  if (grade <= 10) return 'Somewhat Difficult - High school';
  if (grade <= 12) return 'Difficult - College level';
  return 'Very Difficult - Graduate level';
}

/**
 * Format AVS for plain text printing
 */
export function formatAVSAsPlainText(avs: PatientFriendlyAVS): string {
  const lines: string[] = [];
  const divider = '─'.repeat(50);

  lines.push('AFTER VISIT SUMMARY');
  lines.push(divider);
  lines.push('');

  // What happened
  lines.push('WHAT HAPPENED TODAY');
  lines.push(avs.whatHappened);
  lines.push('');

  // What we found
  lines.push('WHAT WE FOUND');
  lines.push(avs.whatWeFound);
  lines.push('');

  // What to do next
  lines.push('WHAT TO DO NEXT');
  avs.whatToDoNext.forEach((item, i) => {
    lines.push(`${i + 1}. ${item}`);
  });
  lines.push('');

  // Warning signs
  if (avs.warningSignsToWatch.length > 0) {
    lines.push('⚠️ WARNING SIGNS - CALL US IF:');
    avs.warningSignsToWatch.forEach(sign => {
      lines.push(`• ${sign}`);
    });
    lines.push('');
  }

  // Medications
  if (avs.medicationChanges) {
    lines.push('MEDICATION CHANGES');
    if (avs.medicationChanges.newMedicines.length > 0) {
      lines.push('New Medicines:');
      avs.medicationChanges.newMedicines.forEach(med => {
        lines.push(`  • ${med.name} - ${med.purpose}`);
        lines.push(`    How: ${med.howToTake}`);
        lines.push(`    When: ${med.whenToTake}`);
      });
    }
    if (avs.medicationChanges.stoppedMedicines.length > 0) {
      lines.push('Stopped Medicines:');
      avs.medicationChanges.stoppedMedicines.forEach(med => {
        lines.push(`  • ${med.name}`);
      });
    }
    if (avs.medicationChanges.changedDoses.length > 0) {
      lines.push('Changed Doses:');
      avs.medicationChanges.changedDoses.forEach(med => {
        lines.push(`  • ${med.name} - ${med.howToTake}`);
      });
    }
    lines.push('');
  }

  // Next appointment
  if (avs.nextAppointment) {
    lines.push('NEXT APPOINTMENT');
    lines.push(`When: ${avs.nextAppointment.when}`);
    lines.push(`Where: ${avs.nextAppointment.where}`);
    if (avs.nextAppointment.bringWith.length > 0) {
      lines.push('Bring:');
      avs.nextAppointment.bringWith.forEach(item => {
        lines.push(`  • ${item}`);
      });
    }
    if (avs.nextAppointment.contactInfo) {
      lines.push(`Questions? Call: ${avs.nextAppointment.contactInfo}`);
    }
    lines.push('');
  }

  // Questions to ask
  if (avs.questionsToAsk.length > 0) {
    lines.push('QUESTIONS YOU MIGHT WANT TO ASK');
    avs.questionsToAsk.forEach(q => {
      lines.push(`• ${q}`);
    });
    lines.push('');
  }

  lines.push(divider);
  lines.push(`Generated: ${new Date(avs.generatedAt).toLocaleDateString()}`);
  lines.push(`Reading Level: Grade ${avs.readingGradeLevel}`);

  return lines.join('\n');
}
