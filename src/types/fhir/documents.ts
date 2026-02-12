/**
 * FHIR R4 Document & Encounter Types
 *
 * Encounter, DocumentReference, Provenance.
 * Part of the fhir types decomposition (Strangler Fig from fhir.ts).
 */

import type { FHIRResource, CodeableConcept, Reference, Period } from './base';

// ============================================================================
// ENCOUNTER (US Core Required)
// ============================================================================

export interface FHIREncounter extends FHIRResource {
  patient_id: string;

  // Status and class (required)
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  status_history?: Array<{
    status: string;
    period: Period;
  }>;

  // Class (inpatient, outpatient, emergency, etc.)
  class_code: string;
  class_display: string;
  class_system?: string;

  class_history?: Array<{
    class_code: string;
    class_display: string;
    period: Period;
  }>;

  // Type of encounter (office visit, hospital admission, etc.)
  type?: CodeableConcept[];

  // Service type
  service_type?: CodeableConcept;

  // Priority (routine, urgent, emergency)
  priority?: CodeableConcept;

  // Participants (providers involved)
  participant?: Array<{
    type?: CodeableConcept[];
    period?: Period;
    individual_id?: string;
    individual_display?: string;
  }>;

  // Appointment reference
  appointment?: Reference[];

  // Period
  period_start?: string;
  period_end?: string;

  // Length of encounter in minutes
  length_minutes?: number;

  // Reason for encounter
  reason_code?: CodeableConcept[];
  reason_reference?: Reference[];

  // Diagnosis
  diagnosis?: Array<{
    condition_id?: string;
    condition_display?: string;
    use_code?: string;
    use_display?: string;
    rank?: number;
  }>;

  // Account/billing
  account_id?: string;

  // Hospitalization details (for inpatient encounters)
  hospitalization?: {
    pre_admission_identifier?: string;
    origin?: Reference;
    admit_source?: CodeableConcept;
    re_admission?: CodeableConcept;
    diet_preference?: CodeableConcept[];
    special_courtesy?: CodeableConcept[];
    special_arrangement?: CodeableConcept[];
    destination?: Reference;
    discharge_disposition?: CodeableConcept;
  };

  // Location history
  location?: Array<{
    location_id?: string;
    location_display?: string;
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    physical_type?: CodeableConcept;
    period_start?: string;
    period_end?: string;
  }>;

  // Service provider organization
  service_provider_id?: string;
  service_provider_display?: string;

  // Part of (for sub-encounters)
  part_of_encounter_id?: string;
}

export interface CreateFHIREncounter extends Partial<FHIREncounter> {
  patient_id: string;
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class_code: string;
  class_display: string;
}

// ============================================================================
// DOCUMENT REFERENCE (US Core Required - for clinical notes)
// ============================================================================

export interface FHIRDocumentReference extends FHIRResource {
  patient_id: string;

  // Master identifier
  master_identifier?: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;

  // Status
  status: 'current' | 'superseded' | 'entered-in-error';
  doc_status?: 'preliminary' | 'final' | 'amended' | 'entered-in-error';

  // Type of document (required for US Core)
  type_code: string; // LOINC code
  type_display: string;
  type_system?: string;

  // Category
  category?: CodeableConcept[];

  // Subject (patient)
  subject_id: string;
  subject_display?: string;

  // Date document was created
  date?: string;

  // Author(s)
  author?: Array<{
    reference: string;
    display?: string;
  }>;

  // Authenticator (who verified)
  authenticator?: Reference;

  // Custodian (organization responsible)
  custodian?: Reference;

  // Related documents
  related_to?: Array<{
    reference: string;
    display?: string;
  }>;

  // Description
  description?: string;

  // Security label (confidentiality)
  security_label?: CodeableConcept[];

  // Content (the actual document)
  content: Array<{
    attachment: {
      content_type: string;
      language?: string;
      data?: string;
      url?: string;
      size?: number;
      hash?: string;
      title?: string;
      creation?: string;
    };
    format?: CodeableConcept;
  }>;

  // Context (clinical context)
  context?: {
    encounter_id?: string;
    event?: CodeableConcept[];
    period?: Period;
    facility_type?: CodeableConcept;
    practice_setting?: CodeableConcept;
    source_patient_info?: Reference;
    related?: Reference[];
  };
}

export interface CreateDocumentReference extends Partial<FHIRDocumentReference> {
  patient_id: string;
  status: 'current' | 'superseded' | 'entered-in-error';
  type_code: string;
  type_display: string;
  content: Array<{
    attachment: {
      content_type: string;
      data?: string;
      url?: string;
    };
  }>;
}

// ============================================================================
// PROVENANCE (US Core Required for data integrity)
// ============================================================================

export interface FHIRProvenance extends FHIRResource {
  // Target (required - what this provenance is about)
  target_references: string[];
  target_types?: string[];

  // Occurred (when the activity occurred)
  occurred_period_start?: string;
  occurred_period_end?: string;
  occurred_datetime?: string;

  // Recorded (when provenance was recorded) - REQUIRED
  recorded: string;

  // Policy (authorization policy)
  policy?: string[];

  // Location (where activity occurred)
  location_id?: string;
  location_display?: string;

  // Reason (why activity occurred)
  reason?: CodeableConcept[];

  // Activity (what was done) - REQUIRED
  activity?: CodeableConcept;

  // Agent (who was involved) - REQUIRED
  agent: Array<{
    type?: CodeableConcept;
    role?: CodeableConcept[];
    who_id: string;
    who_display?: string;
    on_behalf_of_id?: string;
    on_behalf_of_display?: string;
  }>;

  // Entity (what was involved)
  entity?: Array<{
    role: 'derivation' | 'revision' | 'quotation' | 'source' | 'removal';
    what_id: string;
    what_display?: string;
    agent?: Array<{
      type?: CodeableConcept;
      role?: CodeableConcept[];
      who_id: string;
      who_display?: string;
    }>;
  }>;

  // Signature (digital signature)
  signature?: Array<{
    type: CodeableConcept[];
    when: string;
    who_id: string;
    who_display?: string;
    on_behalf_of_id?: string;
    target_format?: string;
    sig_format?: string;
    data?: string;
  }>;

  // Audit
  created_by?: string;
}

export interface CreateProvenance extends Partial<FHIRProvenance> {
  target_references: string[];
  recorded: string;
  agent: Array<{
    who_id: string;
    type?: CodeableConcept;
  }>;
}
