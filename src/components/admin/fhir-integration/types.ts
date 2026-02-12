// FHIR Integration Service — Type Definitions
// All interfaces for FHIR R4 resources and database row types

// FHIR R4 Resource Types
export interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  identifier: Array<{
    use: string;
    type: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    system: string;
    value: string;
  }>;
  active: boolean;
  name: Array<{
    use: string;
    family: string;
    given: string[];
  }>;
  telecom: Array<{
    system: 'phone' | 'email';
    value: string;
    use: string;
  }>;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string;
  address: Array<{
    use: string;
    type: string;
    line: string[];
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
  contact?: Array<{
    relationship: Array<{
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    }>;
    name: {
      family: string;
      given: string[];
    };
    telecom: Array<{
      system: string;
      value: string;
    }>;
  }>;
}

export interface FHIRObservation {
  resourceType: 'Observation';
  id: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended';
  category: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
    display: string;
  };
  effectiveDateTime: string;
  issued: string;
  performer?: Array<{
    reference: string;
    display: string;
  }>;
  valueQuantity?: {
    value: number;
    unit: string;
    system: string;
    code: string;
  };
  valueString?: string;
  component?: Array<{
    code: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    valueQuantity: {
      value: number;
      unit: string;
      system: string;
      code: string;
    };
  }>;
}

export interface FHIRMedicationStatement {
  resourceType: 'MedicationStatement';
  id: string;
  status: 'active' | 'completed' | 'entered-in-error' | 'intended' | 'stopped' | 'on-hold' | 'unknown' | 'not-taken';
  medicationCodeableConcept: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  subject: {
    reference: string;
    display: string;
  };
  effectiveDateTime: string;
  dateAsserted: string;
  informationSource: {
    reference: string;
    display: string;
  };
  dosage?: Array<{
    text: string;
    timing?: {
      repeat: {
        frequency: number;
        period: number;
        periodUnit: string;
      };
    };
    route?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    doseAndRate?: Array<{
      doseQuantity: {
        value?: number;
        unit: string;
        system: string;
      };
    }>;
  }>;
  note?: Array<{
    text: string;
  }>;
}

// FHIR Immunization resource type
export interface FHIRImmunization {
  resourceType: 'Immunization';
  id: string;
  status: string;
  vaccineCode: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  patient: {
    reference: string;
  };
  occurrenceDateTime: string;
  recorded: string;
  primarySource: boolean;
  lotNumber?: string;
  expirationDate?: string;
  site?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  route?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  doseQuantity?: {
    value: number;
    unit: string;
    system: string;
    code: string;
  };
  performer?: Array<{
    actor: {
      display: string;
    };
  }>;
  note?: Array<{
    text: string;
  }>;
  protocolApplied?: Array<{
    doseNumberPositiveInt: number;
    seriesDosesPositiveInt?: number;
  }>;
  reaction?: Array<{
    date: string;
    reported?: boolean;
  }>;
}

// FHIR CarePlan resource type
export interface FHIRCarePlan {
  resourceType: 'CarePlan';
  id: string;
  status: string;
  intent: string;
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  title?: string;
  description?: string;
  subject: {
    reference: string;
  };
  period?: {
    start?: string;
    end?: string;
  };
  created?: string;
  author?: {
    display: string;
  };
  careTeam?: Array<{
    reference: string;
    display?: string;
  }>;
  addresses?: Array<{
    reference: string;
    display?: string;
  }>;
  goal?: Array<{
    display: string;
  }>;
  activity?: Array<{
    detail: {
      kind: string;
      status?: string;
      description?: string;
      scheduledTiming?: {
        repeat: {
          boundsPeriod: {
            start?: string;
            end?: string;
          };
        };
      };
    };
  }>;
  note?: Array<{
    text: string;
  }>;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  id: string;
  meta: {
    versionId: string;
    lastUpdated: string;
    profile: string[];
  };
  identifier: {
    system: string;
    value: string;
  };
  type: 'collection' | 'searchset' | 'history';
  timestamp: string;
  entry: Array<{
    fullUrl: string;
    resource: FHIRPatient | FHIRObservation | FHIRMedicationStatement | FHIRImmunization | FHIRCarePlan;
  }>;
}

// Database row types for FHIR resource mapping
export interface ImmunizationDbRow {
  id: string;
  patient_id: string;
  status: string;
  vaccine_code: string;
  vaccine_display?: string;
  vaccine_name?: string;
  occurrence_datetime: string;
  created_at: string;
  primary_source?: boolean;
  lot_number?: string;
  expiration_date?: string;
  site_display?: string;
  route_display?: string;
  dose_quantity_value?: number;
  dose_quantity_unit?: string;
  performer_actor_display?: string;
  note?: string;
  protocol_dose_number_positive_int?: number;
  protocol_series_doses_positive_int?: number;
  reaction_date?: string;
  reaction_reported?: boolean;
}

export interface CarePlanActivity {
  kind?: string;
  status?: string;
  detail?: string;
  description?: string;
  scheduled_start?: string;
  scheduled_end?: string;
}

export interface CarePlanDbRow {
  id: string;
  patient_id: string;
  status: string;
  intent: string;
  category?: string[];
  title?: string;
  description?: string;
  period_start?: string;
  period_end?: string;
  created?: string;
  created_at?: string;
  author_display?: string;
  care_team_reference?: string;
  care_team_display?: string;
  addresses_condition_references?: string[];
  addresses_condition_displays?: string[];
  goal_displays?: string[];
  activities?: CarePlanActivity[];
  note?: string;
}

// Your existing database types (from schema)
export interface Profile {
  id: string;
  user_id: string;
  phone: string;
  first_name: string;
  last_name: string;
  email?: string;
  dob?: string;
  address?: string;
  caregiver_email?: string;
  emergency_contact_name?: string;
  created_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  is_emergency: boolean;
  label?: string;
  notes?: string;
  mood?: string;
  activity_level?: string;
  heart_rate?: number;
  pulse_oximeter?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  glucose_mg_dl?: number;
  created_at: string;
}

export interface HealthEntry {
  id: string;
  user_id: string;
  entry_type: string;
  data: {
    mood?: string;
    symptoms?: string;
    activity_description?: string;
  };
  created_at: string;
}

export interface Medication {
  id: string;
  user_id: string;
  medication_name: string;
  generic_name?: string;
  brand_name?: string;
  dosage?: string;
  dosage_form?: string;
  strength?: string;
  instructions?: string;
  frequency?: string;
  route?: string;
  prescribed_by?: string;
  prescribed_date?: string;
  prescription_number?: string;
  pharmacy_name?: string;
  pharmacy_phone?: string;
  quantity?: number;
  refills_remaining?: number;
  last_refill_date?: string;
  next_refill_date?: string;
  ndc_code?: string;
  purpose?: string;
  side_effects?: string[];
  warnings?: string[];
  interactions?: string[];
  status: string;
  discontinued_date?: string;
  discontinued_reason?: string;
  ai_confidence?: number;
  extraction_notes?: string;
  needs_review?: boolean;
  created_at: string;
  updated_at: string;
}

/** Strongly typed vitals row for population health queries */
export type VitalsRow = {
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  glucose_mg_dl: number | null;
};
