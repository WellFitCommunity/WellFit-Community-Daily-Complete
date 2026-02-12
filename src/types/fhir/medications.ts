/**
 * FHIR R4 Medication Types
 *
 * MedicationRequest, Medication, MedicationAffordabilityCheck.
 * Part of the fhir types decomposition (Strangler Fig from fhir.ts).
 */

import type { FHIRResource, CodeableConcept, Quantity } from './base';

// ============================================================================
// MEDICATION REQUEST
// ============================================================================

export interface MedicationRequest extends FHIRResource {
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  patient_id: string;

  // Medication
  medication_code_system?: string;
  medication_code: string;
  medication_display: string;
  medication_text?: string;

  // Dosage
  dosage_text?: string;
  dosage_timing_frequency?: number;
  dosage_timing_period?: number;
  dosage_timing_period_unit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  dosage_route_code?: string;
  dosage_route_display?: string;
  dosage_route?: string; // Backwards compatibility - simplified field
  dosage_dose_quantity?: number;
  dosage_dose_unit?: string;
  dosage_dose_code?: string;
  dosage_additional_instruction?: string[];
  dosage_patient_instruction?: string;
  dosage_as_needed_boolean?: boolean;
  dosage_as_needed_reason?: string;

  // Supply
  dispense_quantity?: number;
  dispense_unit?: string;
  dispense_quantity_unit?: string; // Backwards compatibility - simplified field
  dispense_number_of_repeats?: number; // Backwards compatibility - simplified field
  dispense_expected_supply_duration?: number;
  dispense_expected_supply_duration_unit?: string;
  number_of_repeats_allowed?: number;

  // Validity
  validity_period_start?: string;
  validity_period_end?: string;

  // Dates
  authored_on: string;

  // Requester
  requester_type?: string;
  requester_id?: string;
  requester_display?: string;
  requester_practitioner_id?: string; // FK to fhir_practitioners

  // Performer
  performer_type?: string;
  performer_id?: string;
  performer_display?: string;

  // Reason
  reason_code?: string[];
  reason_reference?: string[];

  // Priority
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';

  // Category
  category?: string[];

  // Notes
  note?: string;

  // Substitution
  substitution_allowed?: boolean;
  substitution_reason_code?: string;

  // References
  prior_prescription_id?: string;
  based_on_type?: string;
  based_on_id?: string;
  reported_boolean?: boolean;
  reported_reference_type?: string;
  reported_reference_id?: string;
  encounter_id?: string;
  insurance_id?: string;
}

export interface CreateMedicationRequest extends Partial<MedicationRequest> {
  patient_id: string;
  medication_code: string;
  medication_display: string;
  status: MedicationRequest['status'];
  intent: MedicationRequest['intent'];
}

// ============================================================================
// MEDICATION (US Core Required)
// ============================================================================

export interface FHIRMedication extends FHIRResource {
  // Code (required - RxNorm preferred)
  code_system?: string;
  code: string;
  code_display: string;
  code_text?: string;

  // Status
  status?: 'active' | 'inactive' | 'entered-in-error';

  // Manufacturer
  manufacturer_id?: string;
  manufacturer_display?: string;

  // Form (tablet, capsule, liquid, etc.)
  form?: CodeableConcept;

  // Amount (concentration)
  amount_numerator?: Quantity;
  amount_denominator?: Quantity;

  // Ingredient
  ingredient?: Array<{
    item_codeable_concept?: CodeableConcept;
    item_reference?: string;
    is_active?: boolean;
    strength_numerator?: Quantity;
    strength_denominator?: Quantity;
  }>;

  // Batch info
  batch?: {
    lot_number?: string;
    expiration_date?: string;
  };

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateMedication extends Partial<FHIRMedication> {
  code: string;
  code_display: string;
}

// ============================================================================
// MEDICATION AFFORDABILITY & ALTERNATIVES
// ============================================================================

export interface MedicationAffordabilityCheck extends FHIRResource {
  patient_id: string;
  medication_name: string;
  rxnorm_code?: string;
  ndc_code?: string; // National Drug Code

  // Prescription details
  quantity: number;
  days_supply: number;
  dosage_form: string;
  strength: string;

  // Cost data
  average_retail_price?: number;
  insurance_copay?: number;
  goodrx_price?: number;
  costplus_price?: number;
  medicare_price?: number;

  // Affordability assessment
  is_affordable: boolean;
  affordability_barrier?: 'high' | 'moderate' | 'low';
  patient_expressed_concern?: boolean;

  // Therapeutic alternatives (generic, biosimilar, or different class)
  alternatives?: Array<{
    medication_name: string;
    rxnorm_code?: string;
    type: 'generic' | 'biosimilar' | 'therapeutic-equivalent' | 'different-class';
    average_retail_price?: number;
    estimated_savings: number;
    clinical_note?: string;
  }>;

  // Manufacturer assistance programs
  patient_assistance_available?: boolean;
  manufacturer_coupon_url?: string;

  // Provider recommendation
  provider_recommendation?: 'continue-brand' | 'switch-generic' | 'switch-alternative' | 'apply-assistance';
  recommendation_reason?: string;

  checked_date: string;
  checked_by?: string;
}
