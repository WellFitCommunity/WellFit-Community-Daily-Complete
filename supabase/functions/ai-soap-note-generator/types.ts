/**
 * Type definitions for AI SOAP Note Generator
 *
 * Extracted from index.ts for modularity.
 */

/**
 * Physician style hint passed from the UI to the edge function.
 * Derived from the physician_style_profiles table (Ambient Learning Session 2/3).
 */
export interface PhysicianStyleHint {
  preferredVerbosity: "terse" | "moderate" | "verbose";
  specialtyDetected: string | null;
  terminologyPreferences: Array<{ aiTerm: string; physicianPreferred: string }>;
  avgNoteWordCount: number;
}

export interface SOAPNoteRequest {
  encounterId: string;
  patientId?: string;
  tenantId?: string;
  includeTranscript?: boolean;
  providerNotes?: string;
  templateStyle?: "standard" | "comprehensive" | "brief";
  /** Session 3 (3.5): Optional physician style hint for adaptive generation */
  physicianStyle?: PhysicianStyleHint;
}

export interface SOAPNoteSection {
  content: string;
  confidence: number;
  sources: string[];
}

export interface GeneratedSOAPNote {
  subjective: SOAPNoteSection;
  objective: SOAPNoteSection;
  assessment: SOAPNoteSection;
  plan: SOAPNoteSection;
  hpi?: SOAPNoteSection;
  ros?: SOAPNoteSection;
  icd10Suggestions: Array<{ code: string; display: string; confidence: number }>;
  cptSuggestions: Array<{ code: string; display: string; confidence: number }>;
  requiresReview: boolean;
  reviewReasons: string[];
}

export interface EncounterContext {
  chiefComplaint?: string;
  visitType: string;
  durationMinutes?: number;
  vitals: Record<string, { value: number; unit: string }>;
  diagnoses: Array<{ code: string; display: string; status: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  labResults: Array<{ test: string; value: string; unit: string; interpretation?: string }>;
  transcript?: string;
  providerNotes?: string;
  allergies: string[];
  socialHistory?: string;
  medicalHistory: string[];
}

// Database record types for FHIR data
export interface FHIRConditionRecord {
  code?: { coding?: Array<{ code?: string; display?: string }> };
  clinical_status?: string;
}

export interface FHIRMedicationRecord {
  medication_codeable_concept?: { coding?: Array<{ display?: string }> };
  dosage_instruction?: Array<{ dose_and_rate?: Array<{ dose_quantity?: { value?: number } }>; timing?: { code?: { text?: string } } }>;
  status?: string;
}

export interface FHIRAllergyRecord {
  code?: { coding?: Array<{ display?: string }>; text?: string };
}

export interface DiagnosisRecord {
  diagnosis_name: string;
}

// Parsed AI response structure
export interface ParsedSOAPResponse {
  subjective?: string | SOAPNoteSection;
  objective?: string | SOAPNoteSection;
  assessment?: string | SOAPNoteSection;
  plan?: string | SOAPNoteSection;
  hpi?: string | SOAPNoteSection;
  ros?: string | SOAPNoteSection;
  icd10Suggestions?: Array<{ code: string; display: string; confidence: number }>;
  cptSuggestions?: Array<{ code: string; display: string; confidence: number }>;
  requiresReview?: boolean;
  reviewReasons?: string[];
}
