/**
 * Facility Types
 *
 * Represents healthcare facilities (hospitals, clinics) within a tenant organization.
 * Used for location attribution and reporting, not access control.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

export type FacilityType =
  | 'hospital'
  | 'clinic'
  | 'urgent_care'
  | 'emergency'
  | 'rehabilitation'
  | 'nursing_facility'
  | 'home_health'
  | 'telehealth'
  | 'other';

/**
 * CMS Place of Service codes used in X12 837 claims
 * @see https://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set
 */
export type PlaceOfServiceCode =
  | '02'  // Telehealth (patient home)
  | '10'  // Telehealth (other)
  | '11'  // Office
  | '12'  // Home
  | '19'  // Off Campus-Outpatient Hospital
  | '20'  // Urgent Care Facility
  | '21'  // Inpatient Hospital
  | '22'  // On Campus-Outpatient Hospital
  | '23'  // Emergency Room - Hospital
  | '24'  // Ambulatory Surgical Center
  | '31'  // Skilled Nursing Facility
  | '32'  // Nursing Facility
  | '33'  // Custodial Care Facility
  | '34'  // Hospice
  | '41'  // Ambulance - Land
  | '42'  // Ambulance - Air or Water
  | '49'  // Independent Clinic
  | '50'  // Federally Qualified Health Center
  | '51'  // Inpatient Psychiatric Facility
  | '52'  // Psychiatric Facility - Partial Hospitalization
  | '53'  // Community Mental Health Center
  | '54'  // Intermediate Care Facility/Mental Illness
  | '55'  // Residential Substance Abuse Treatment
  | '56'  // Psychiatric Residential Treatment Center
  | '57'  // Non-residential Substance Abuse Treatment
  | '60'  // Mass Immunization Center
  | '61'  // Comprehensive Inpatient Rehabilitation
  | '62'  // Comprehensive Outpatient Rehabilitation
  | '65'  // End-Stage Renal Disease Treatment
  | '71'  // State or Local Public Health Clinic
  | '72'  // Rural Health Clinic
  | '81'  // Independent Laboratory
  | '99'; // Other Place of Service

export interface Facility {
  id: string;
  tenant_id: string;

  // Basic Info
  name: string;
  facility_code: string | null;
  facility_type: FacilityType;

  // Address
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  county: string | null;
  country: string;

  // Contact
  phone: string | null;
  fax: string | null;
  email: string | null;

  // Billing/Compliance Identifiers
  npi: string | null;
  tax_id: string | null;
  taxonomy_code: string | null;
  clia_number: string | null;
  medicare_provider_number: string | null;
  medicaid_provider_number: string | null;

  // CMS Place of Service
  place_of_service_code: PlaceOfServiceCode;

  // Operational
  is_active: boolean;
  is_primary: boolean;
  timezone: string;
  bed_count: number | null;

  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateFacility {
  tenant_id: string;
  name: string;
  facility_code?: string;
  facility_type: FacilityType;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  county?: string;
  phone?: string;
  fax?: string;
  email?: string;
  npi?: string;
  tax_id?: string;
  taxonomy_code?: string;
  place_of_service_code?: PlaceOfServiceCode;
  is_primary?: boolean;
  timezone?: string;
  bed_count?: number;
}

export interface UpdateFacility {
  name?: string;
  facility_code?: string;
  facility_type?: FacilityType;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  county?: string;
  phone?: string;
  fax?: string;
  email?: string;
  npi?: string;
  tax_id?: string;
  taxonomy_code?: string;
  clia_number?: string;
  medicare_provider_number?: string;
  medicaid_provider_number?: string;
  place_of_service_code?: PlaceOfServiceCode;
  is_active?: boolean;
  is_primary?: boolean;
  timezone?: string;
  bed_count?: number;
}

/**
 * Facility summary for dropdowns and lists
 */
export interface FacilitySummary {
  id: string;
  name: string;
  facility_code: string | null;
  facility_type: FacilityType;
  city: string | null;
  state: string | null;
  is_primary: boolean;
}

/**
 * Facility with usage statistics
 */
export interface FacilityWithStats extends Facility {
  encounter_count?: number;
  staff_count?: number;
  active_patients?: number;
}

/**
 * Helper to get display label for facility type
 */
export function getFacilityTypeLabel(type: FacilityType): string {
  const labels: Record<FacilityType, string> = {
    hospital: 'Hospital',
    clinic: 'Clinic',
    urgent_care: 'Urgent Care',
    emergency: 'Emergency Room',
    rehabilitation: 'Rehabilitation Center',
    nursing_facility: 'Nursing Facility',
    home_health: 'Home Health',
    telehealth: 'Telehealth',
    other: 'Other',
  };
  return labels[type] || type;
}

/**
 * Helper to get Place of Service description
 */
export function getPlaceOfServiceLabel(code: PlaceOfServiceCode): string {
  const labels: Record<PlaceOfServiceCode, string> = {
    '02': 'Telehealth (Patient Home)',
    '10': 'Telehealth (Other)',
    '11': 'Office',
    '12': 'Home',
    '19': 'Off Campus-Outpatient Hospital',
    '20': 'Urgent Care Facility',
    '21': 'Inpatient Hospital',
    '22': 'On Campus-Outpatient Hospital',
    '23': 'Emergency Room - Hospital',
    '24': 'Ambulatory Surgical Center',
    '31': 'Skilled Nursing Facility',
    '32': 'Nursing Facility',
    '33': 'Custodial Care Facility',
    '34': 'Hospice',
    '41': 'Ambulance - Land',
    '42': 'Ambulance - Air/Water',
    '49': 'Independent Clinic',
    '50': 'FQHC',
    '51': 'Inpatient Psych',
    '52': 'Psych Partial Hospitalization',
    '53': 'CMHC',
    '54': 'ICF/Mental Illness',
    '55': 'Residential Substance Abuse',
    '56': 'PRTC',
    '57': 'Non-residential Substance Abuse',
    '60': 'Mass Immunization Center',
    '61': 'Comprehensive Inpatient Rehab',
    '62': 'Comprehensive Outpatient Rehab',
    '65': 'ESRD Treatment',
    '71': 'Public Health Clinic',
    '72': 'Rural Health Clinic',
    '81': 'Independent Lab',
    '99': 'Other',
  };
  return labels[code] || `POS ${code}`;
}
