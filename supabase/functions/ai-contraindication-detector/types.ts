/**
 * Shared types for the ai-contraindication-detector edge function.
 *
 * Extracted from index.ts to keep that file under the 600-line limit
 * (CLAUDE.md #12). Pure type declarations — no runtime behavior.
 */

export interface ContraindicationRequest {
  patientId: string;
  providerId: string;
  medicationRxcui: string;
  medicationName: string;
  indication?: string;
  proposedDosage?: string;
  includeDrugInteractions?: boolean;
  tenantId?: string;
}

export interface PatientContext {
  demographics: {
    age?: number;
    sex?: string;
    weight?: number;
    pregnancyStatus?: string;
    lactationStatus?: string;
  };
  activeConditions: Array<{ code: string; display: string; category?: string }>;
  activeMedications: Array<{ rxcui?: string; name: string; dosage?: string }>;
  allergies: Array<{
    allergen: string;
    allergenType: string;
    severity?: string;
    criticality?: string;
    reactions?: string[];
  }>;
  labValues: Record<string, number | undefined>;
  // True when the allergy lookup FAILED (vs. genuinely empty) — the prompt must then say
  // "unavailable", never "NKDA", so the model does not assume the patient has no allergies.
  allergiesUnavailable?: boolean;
}

export interface ContraindicationFinding {
  type: string;
  severity: "contraindicated" | "high" | "moderate" | "low";
  title: string;
  description: string;
  clinicalReasoning: string;
  triggerFactor: string;
  recommendations: string[];
  alternatives?: string[];
  confidence: number;
  source: string;
}
