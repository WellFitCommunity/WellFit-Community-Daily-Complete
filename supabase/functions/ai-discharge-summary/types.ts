/**
 * Type definitions for the AI Discharge Summary Generator
 *
 * All interfaces, database record types, and utility functions
 * shared across the discharge summary edge function modules.
 *
 * @module ai-discharge-summary/types
 */

// =====================================================
// REQUEST / RESPONSE TYPES
// =====================================================

export interface DischargeSummaryRequest {
  patientId: string;
  encounterId: string;
  tenantId?: string;
  dischargePlanId?: string;
  dischargeDisposition?: string;
  attendingPhysician?: string;
  includePatientInstructions?: boolean;
}

export interface MedicationReconciliation {
  continued: MedicationEntry[];
  new: MedicationEntry[];
  changed: MedicationChange[];
  discontinued: MedicationEntry[];
  allergies: string[];
  interactions: string[];
}

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

export interface DischargeDiagnosis {
  code: string;
  display: string;
  type: "principal" | "secondary" | "complication";
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
  urgency: "routine" | "urgent" | "as_needed";
}

export interface PatientInstruction {
  category: "activity" | "diet" | "wound_care" | "medication" | "symptoms" | "general";
  instruction: string;
  importance: "critical" | "important" | "informational";
}

export interface WarningSign {
  sign: string;
  action: string;
  urgency: "call_office" | "urgent_care" | "emergency";
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
  readmissionRiskCategory: "low" | "moderate" | "high" | "very_high";

  // Safety
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  disclaimer: string;
}

// =====================================================
// PATIENT CONTEXT
// =====================================================

export interface PatientContext {
  name: string;
  dateOfBirth: string;
  sex: string;
  allergies: string[];
  admissionDate: string;
  chiefComplaint: string;
  admissionDiagnosis: string;
  conditions: Array<{ code: string; display: string }>;
  procedures: Array<{ code: string; display: string; date: string }>;
  admissionMedications: Array<{ name: string; dose: string; frequency: string }>;
  dischargeMedications: Array<{ name: string; dose: string; frequency: string; status: string }>;
  vitalSigns: Record<string, { value: number; unit: string }>;
  labResults: Array<{ name: string; value: string; unit: string; date: string; abnormal: boolean }>;
  notes: string[];
  dischargePlan?: {
    disposition: string;
    followUpDate?: string;
    followUpProvider?: string;
    homeHealthNeeded: boolean;
    dmeNeeded: boolean;
    readmissionRiskScore: number;
  };
}

// =====================================================
// DATABASE RECORD TYPES (query result shapes)
// =====================================================

export interface AllergyRecord {
  code?: { coding?: Array<{ display?: string }>; text?: string };
  criticality?: string;
}

export interface ConditionRecord {
  code?: { coding?: Array<{ code?: string; display?: string }> };
  clinical_status?: string;
  onset_datetime?: string;
}

export interface ProcedureRecord {
  code?: { coding?: Array<{ code?: string; display?: string }> };
  performed_datetime?: string;
  status?: string;
}

export interface MedicationRequestRecord {
  medication_codeable_concept?: { coding?: Array<{ display?: string }> };
  dosage_instruction?: Array<{
    dose_and_rate?: Array<{ dose_quantity?: { value?: string } }>;
    timing?: { code?: { text?: string } };
  }>;
  status?: string;
  intent?: string;
}

export interface VitalRecord {
  code?: { coding?: Array<{ code?: string }> };
  value_quantity_value?: number;
  value_quantity_unit?: string;
}

export interface LabRecord {
  code?: { coding?: Array<{ display?: string }>; text?: string };
  value_quantity_value?: number | null;
  value_quantity_unit?: string;
  effective_datetime?: string;
  interpretation?: { coding?: Array<{ code?: string }> };
}

export interface NoteRecord {
  note_type?: string;
  content?: string;
  created_at?: string;
}

export interface ParsedSummary {
  patientName?: string;
  dateOfBirth?: string;
  admissionDate?: string;
  dischargeDate?: string;
  lengthOfStay?: number;
  attendingPhysician?: string;
  dischargeDisposition?: string;
  chiefComplaint?: string;
  admissionDiagnosis?: string;
  hospitalCourse?: string;
  dischargeDiagnoses?: DischargeDiagnosis[];
  proceduresPerformed?: ProcedurePerformed[];
  medicationReconciliation?: {
    continued?: MedicationEntry[];
    new?: MedicationEntry[];
    changed?: MedicationChange[];
    discontinued?: MedicationEntry[];
    interactions?: string[];
  };
  dischargePharmacy?: string;
  followUpAppointments?: FollowUpAppointment[];
  pendingTests?: string[];
  pendingConsults?: string[];
  patientInstructions?: PatientInstruction[];
  warningSigns?: WarningSign[];
  activityRestrictions?: string[];
  dietaryInstructions?: string[];
  homeHealthOrdered?: boolean;
  homeHealthAgency?: string;
  dmeOrdered?: boolean;
  dmeItems?: string[];
  readmissionRiskScore?: number;
  confidence?: number;
  reviewReasons?: string[];
  disclaimer?: string;
}

// =====================================================
// UTILITY
// =====================================================

/** Redact PHI patterns (email, phone, SSN) from strings */
export const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");
