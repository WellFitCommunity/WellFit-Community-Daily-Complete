/**
 * FHIR R4 Provider & Organization Types
 *
 * Practitioner, PractitionerRole, Location, Organization, role constants.
 * Part of the fhir types decomposition (Strangler Fig from fhir.ts).
 */

import type { FHIRResource, CodeableConcept, FHIRContactPoint, FHIRAddress } from './base';

// ============================================================================
// PRACTITIONER
// ============================================================================

export interface FHIRPractitioner extends FHIRResource {
  // Link to auth.users
  user_id?: string;

  // External System Integration
  external_id?: string;
  external_system?: string;

  // FHIR Meta
  version_id?: string;
  last_updated?: string;

  // Required US Core Fields
  active: boolean;

  // Identifiers (NPI is REQUIRED for US Core)
  npi?: string; // National Provider Identifier (10 digits)
  state_license_number?: string;
  dea_number?: string; // Drug Enforcement Administration
  taxonomy_code?: string; // Healthcare Provider Taxonomy Code

  // Name (REQUIRED for US Core)
  family_name: string; // Last name
  given_names: string[]; // First, middle names
  prefix?: string[]; // Dr., Mr., Ms., Prof.
  suffix?: string[]; // MD, PhD, RN, BSN
  full_name?: string; // Generated full name

  // Demographics
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birth_date?: string;

  // Contact
  telecom?: FHIRContactPoint[]; // Phone, email, fax
  email?: string;
  phone?: string;

  // Addresses
  addresses?: FHIRAddress[];

  // Photo
  photo_url?: string;

  // Qualifications (degrees, licenses, certifications)
  qualifications?: FHIRPractitionerQualification[];

  // Specialties
  specialties?: string[]; // ['Family Medicine', 'Geriatrics']
  specialty_codes?: string[]; // SNOMED CT or NUCC codes

  // Languages
  communication_languages?: string[]; // ['en', 'es']

  // Biography
  bio?: string;

  // Availability
  availability_hours?: Record<string, { start: string; end: string }>;

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface FHIRPractitionerQualification {
  identifier?: {
    value: string;
    system?: string;
  };
  code?: {
    text: string;
    coding?: {
      system: string;
      code: string;
      display: string;
    }[];
  };
  issuer?: string;
  period?: {
    start?: string;
    end?: string;
  };
}

// ============================================================================
// PRACTITIONER ROLE
// ============================================================================

export interface FHIRPractitionerRole extends FHIRResource {
  practitioner_id: string; // Reference to Practitioner
  organization_id?: string; // Reference to Organization
  location_id?: string; // Reference to Location

  active: boolean;

  // Role/Position
  code: string[]; // ['doctor', 'researcher', 'educator']
  code_display?: string[];

  // Specialty in this role
  specialty?: string[];
  specialty_display?: string[];

  // Period
  period_start: string;
  period_end?: string;

  // Contact in this role
  telecom?: FHIRContactPoint[];

  // Availability
  available_time?: Array<{
    daysOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
    allDay?: boolean;
    availableStartTime?: string;
    availableEndTime?: string;
  }>;
  not_available?: Array<{
    description: string;
    during?: {
      start?: string;
      end?: string;
    };
  }>;

  // Endpoints
  endpoint_references?: string[];
}

// ============================================================================
// LOCATION (US Core Required)
// ============================================================================

export interface FHIRLocation extends FHIRResource {
  // Status
  status: 'active' | 'suspended' | 'inactive';

  // Operational status
  operational_status?: CodeableConcept;

  // Name (required)
  name: string;
  alias?: string[];

  // Description
  description?: string;

  // Mode
  mode?: 'instance' | 'kind';

  // Type (required for US Core)
  type?: CodeableConcept[];

  // Telecom
  telecom?: FHIRContactPoint[];

  // Address
  address?: FHIRAddress;

  // Physical form
  physical_type?: CodeableConcept;

  // Position (GPS coordinates)
  position?: {
    longitude: number;
    latitude: number;
    altitude?: number;
  };

  // Managing organization
  managing_organization_id?: string;
  managing_organization_display?: string;

  // Part of (parent location)
  part_of_location_id?: string;
  part_of_location_display?: string;

  // Hours of operation
  hours_of_operation?: Array<{
    days_of_week?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
    all_day?: boolean;
    opening_time?: string;
    closing_time?: string;
  }>;

  // Availability exceptions
  availability_exceptions?: string;

  // Endpoint
  endpoint_references?: string[];

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateLocation extends Partial<FHIRLocation> {
  status: 'active' | 'suspended' | 'inactive';
  name: string;
}

// ============================================================================
// ORGANIZATION (US Core Required)
// ============================================================================

export interface FHIROrganization extends FHIRResource {
  // Identifiers
  npi?: string; // National Provider Identifier (Type 2)
  tax_id?: string; // EIN
  ccn?: string; // CMS Certification Number (for hospitals)

  // Active status
  active: boolean;

  // Type (required for US Core)
  type?: CodeableConcept[];

  // Name (required)
  name: string;
  alias?: string[];

  // Telecom
  telecom?: FHIRContactPoint[];

  // Address
  address?: FHIRAddress[];

  // Part of (parent organization)
  part_of_id?: string;
  part_of_display?: string;

  // Contact (administrative contacts)
  contact?: Array<{
    purpose?: CodeableConcept;
    name?: {
      family?: string;
      given?: string[];
      prefix?: string[];
      suffix?: string[];
    };
    telecom?: FHIRContactPoint[];
    address?: FHIRAddress;
  }>;

  // Endpoint (technical endpoints)
  endpoint_references?: string[];

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateOrganization extends Partial<FHIROrganization> {
  active: boolean;
  name: string;
}

// ============================================================================
// ROLE CODE SYSTEM (1-18)
// ============================================================================

export const ROLE_CODES = {
  ADMIN: 1,
  SUPER_ADMIN: 2,
  STAFF: 3,
  SENIOR: 4,
  DOCTOR: 5,
  NURSE_PRACTITIONER: 6,
  REGISTERED_NURSE: 7,
  LICENSED_PRACTICAL_NURSE: 8,
  CARE_MANAGER: 9,
  SOCIAL_WORKER: 10,
  PHARMACIST: 11,
  LAB_TECH: 12,
  PHYSICAL_THERAPIST: 13,
  OCCUPATIONAL_THERAPIST: 14,
  DIETITIAN: 15,
  CASE_MANAGER: 16,
  PHYSICIAN_ASSISTANT: 17,
  CAREGIVER: 18,
} as const;

export const ROLE_NAMES: Record<number, string> = {
  1: 'admin',
  2: 'super_admin',
  3: 'staff',
  4: 'senior',
  5: 'doctor',
  6: 'nurse_practitioner',
  7: 'registered_nurse',
  8: 'licensed_practical_nurse',
  9: 'care_manager',
  10: 'social_worker',
  11: 'pharmacist',
  12: 'lab_tech',
  13: 'physical_therapist',
  14: 'occupational_therapist',
  15: 'dietitian',
  16: 'case_manager',
  17: 'physician_assistant',
  18: 'caregiver',
};

export const ROLE_DISPLAY_NAMES: Record<number, string> = {
  1: 'Administrator',
  2: 'Super Administrator',
  3: 'Staff',
  4: 'Senior/Patient',
  5: 'Doctor/Physician',
  6: 'Nurse Practitioner',
  7: 'Registered Nurse (RN)',
  8: 'Licensed Practical Nurse (LPN)',
  9: 'Care Manager',
  10: 'Social Worker',
  11: 'Pharmacist',
  12: 'Laboratory Technician',
  13: 'Physical Therapist (PT)',
  14: 'Occupational Therapist (OT)',
  15: 'Dietitian/Nutritionist',
  16: 'Case Manager',
  17: 'Physician Assistant (PA)',
  18: 'Caregiver',
};

// Healthcare provider roles (5-18, excluding patient/admin roles)
export const PRACTITIONER_ROLE_CODES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;

// Common medical specialties
export const MEDICAL_SPECIALTIES = {
  FAMILY_MEDICINE: 'Family Medicine',
  INTERNAL_MEDICINE: 'Internal Medicine',
  GERIATRICS: 'Geriatrics',
  CARDIOLOGY: 'Cardiology',
  ENDOCRINOLOGY: 'Endocrinology',
  NEUROLOGY: 'Neurology',
  PSYCHIATRY: 'Psychiatry',
  ORTHOPEDICS: 'Orthopedics',
  PHYSICAL_MEDICINE: 'Physical Medicine and Rehabilitation',
  PALLIATIVE_CARE: 'Palliative Care',
  HOSPICE_CARE: 'Hospice and Palliative Medicine',
} as const;

// Nursing specialties
export const NURSING_SPECIALTIES = {
  GERIATRIC_NURSING: 'Geriatric Nursing',
  ACUTE_CARE: 'Acute Care',
  CRITICAL_CARE: 'Critical Care',
  EMERGENCY: 'Emergency Nursing',
  WOUND_CARE: 'Wound Care',
  DIABETES_EDUCATION: 'Diabetes Education',
} as const;
