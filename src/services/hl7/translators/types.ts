/**
 * FHIR R4 Resource Types for HL7-to-FHIR Translation
 *
 * Simplified FHIR R4 resource interfaces used by the HL7 v2.x to FHIR translator.
 * These cover the core resources produced from ADT, ORU, and ORM messages.
 */

// ============================================================================
// FHIR R4 BASE TYPES
// ============================================================================

export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    source?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  identifier?: FHIRIdentifier[];
}

export interface FHIRIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: FHIRCodeableConcept;
  system?: string;
  value: string;
  period?: { start?: string; end?: string };
  assigner?: { display?: string };
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface FHIRHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: { start?: string; end?: string };
}

export interface FHIRAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: { start?: string; end?: string };
}

export interface FHIRContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: { start?: string; end?: string };
}

export interface FHIRReference {
  reference?: string;
  type?: string;
  identifier?: FHIRIdentifier;
  display?: string;
}

// ============================================================================
// FHIR R4 RESOURCE TYPES
// ============================================================================

export interface FHIRPatient extends FHIRResource {
  resourceType: 'Patient';
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: FHIRAddress[];
  maritalStatus?: FHIRCodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  communication?: Array<{
    language: FHIRCodeableConcept;
    preferred?: boolean;
  }>;
}

export interface FHIREncounter extends FHIRResource {
  resourceType: 'Encounter';
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
  class: FHIRCoding;
  type?: FHIRCodeableConcept[];
  priority?: FHIRCodeableConcept;
  subject?: FHIRReference;
  participant?: Array<{
    type?: FHIRCodeableConcept[];
    period?: { start?: string; end?: string };
    individual?: FHIRReference;
  }>;
  period?: { start?: string; end?: string };
  reasonCode?: FHIRCodeableConcept[];
  diagnosis?: Array<{
    condition: FHIRReference;
    use?: FHIRCodeableConcept;
    rank?: number;
  }>;
  hospitalization?: {
    preAdmissionIdentifier?: FHIRIdentifier;
    origin?: FHIRReference;
    admitSource?: FHIRCodeableConcept;
    reAdmission?: FHIRCodeableConcept;
    destination?: FHIRReference;
    dischargeDisposition?: FHIRCodeableConcept;
  };
  location?: Array<{
    location: FHIRReference;
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    period?: { start?: string; end?: string };
  }>;
  serviceProvider?: FHIRReference;
}

export interface FHIRDiagnosticReport extends FHIRResource {
  resourceType: 'DiagnosticReport';
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject?: FHIRReference;
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  effectivePeriod?: { start?: string; end?: string };
  issued?: string;
  performer?: FHIRReference[];
  result?: FHIRReference[];
  conclusion?: string;
  conclusionCode?: FHIRCodeableConcept[];
}

export interface FHIRObservation extends FHIRResource {
  resourceType: 'Observation';
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject?: FHIRReference;
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: FHIRReference[];
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  dataAbsentReason?: FHIRCodeableConcept;
  interpretation?: FHIRCodeableConcept[];
  referenceRange?: Array<{
    low?: { value?: number; unit?: string };
    high?: { value?: number; unit?: string };
    text?: string;
  }>;
}

export interface FHIRServiceRequest extends FHIRResource {
  resourceType: 'ServiceRequest';
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: FHIRCodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  code?: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
  occurrenceDateTime?: string;
  authoredOn?: string;
  requester?: FHIRReference;
  performer?: FHIRReference[];
  reasonCode?: FHIRCodeableConcept[];
  note?: Array<{ text: string }>;
}

export interface FHIRAllergyIntolerance extends FHIRResource {
  resourceType: 'AllergyIntolerance';
  clinicalStatus?: FHIRCodeableConcept;
  verificationStatus?: FHIRCodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: Array<'food' | 'medication' | 'environment' | 'biologic'>;
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: FHIRCodeableConcept;
  patient: FHIRReference;
  onsetDateTime?: string;
  recordedDate?: string;
  reaction?: Array<{
    substance?: FHIRCodeableConcept;
    manifestation: FHIRCodeableConcept[];
    severity?: 'mild' | 'moderate' | 'severe';
  }>;
}

export interface FHIRCondition extends FHIRResource {
  resourceType: 'Condition';
  clinicalStatus?: FHIRCodeableConcept;
  verificationStatus?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept[];
  severity?: FHIRCodeableConcept;
  code?: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
  onsetDateTime?: string;
  recordedDate?: string;
  recorder?: FHIRReference;
}

export interface FHIRCoverage extends FHIRResource {
  resourceType: 'Coverage';
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type?: FHIRCodeableConcept;
  subscriber?: FHIRReference;
  subscriberId?: string;
  beneficiary: FHIRReference;
  relationship?: FHIRCodeableConcept;
  period?: { start?: string; end?: string };
  payor: FHIRReference[];
  class?: Array<{
    type: FHIRCodeableConcept;
    value: string;
    name?: string;
  }>;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'collection' | 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset';
  timestamp?: string;
  entry?: Array<{
    fullUrl?: string;
    resource: FHIRResource;
  }>;
}

// ============================================================================
// TRANSLATION RESULT
// ============================================================================

/**
 * Successful translation result data
 */
export interface FHIRTranslationSuccess {
  bundle: FHIRBundle;
  resources: FHIRResource[];
  warnings: string[];
  sourceMessageId: string;
  sourceMessageType: string;
}

/**
 * @deprecated Use ServiceResult<FHIRTranslationSuccess> instead
 */
export interface TranslationResult {
  success: boolean;
  bundle?: FHIRBundle;
  resources: FHIRResource[];
  errors: string[];
  warnings: string[];
  sourceMessageId?: string;
  sourceMessageType?: string;
}
