/**
 * NPI Registry MCP Client
 *
 * Browser-safe client for National Provider Identifier operations:
 * - NPI validation (Luhn check + registry lookup)
 * - Provider lookup by NPI
 * - Provider search by name, specialty, location
 * - Taxonomy code lookup
 * - Bulk NPI validation
 *
 * HIPAA Compliance:
 * - NPI numbers are not PHI (public provider identifiers)
 * - All queries use provider identifiers only
 * - Audit logging for all operations
 */

import { SB_URL } from '../../settings/settings';
import { getSupabaseAuthToken } from './mcpHelpers';

// =====================================================
// Types
// =====================================================

export type EnumerationType = 'NPI-1' | 'NPI-2';

export interface NPIValidation {
  npi: string;
  valid_format: boolean;
  is_active: boolean;
  provider_name?: string;
  enumeration_type?: EnumerationType;
  status: 'active' | 'deactivated' | 'invalid' | 'not_found';
  validation_message: string;
}

export interface ProviderTaxonomy {
  code: string;
  description: string;
  primary: boolean;
  state?: string;
  license?: string;
}

export interface ProviderAddress {
  type: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postal_code: string;
  telephone?: string;
  fax?: string;
}

export interface ProviderIdentifier {
  identifier: string;
  type: string;
  state?: string;
  issuer?: string;
}

export interface ProviderDetails {
  name: string;
  type: 'Individual' | 'Organization';
  credential?: string;
  gender?: string;
  sole_proprietor?: boolean;
  enumeration_date: string;
  last_updated: string;
  status: string;
  taxonomies: ProviderTaxonomy[];
  addresses: ProviderAddress[];
  identifiers: ProviderIdentifier[];
}

export interface ProviderSearchResult {
  npi: string;
  name: string;
  type: 'Individual' | 'Organization';
  specialty?: string;
  city?: string;
  state?: string;
  phone?: string;
}

export interface TaxonomyCode {
  code: string;
  type: 'individual' | 'organization';
  classification: string;
  specialization?: string;
}

export interface BulkValidationResult {
  total: number;
  valid: number;
  invalid: number;
  results: Array<{
    npi: string;
    valid: boolean;
    status: string;
    provider_name?: string;
  }>;
}

export interface NPIRegistryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =====================================================
// Client Class
// =====================================================

export class NPIRegistryMCPClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${SB_URL}/functions/v1/mcp-npi-registry-server`;
  }

  private getAuthToken(): string {
    return getSupabaseAuthToken();
  }

  private async request<T>(tool: string, args: Record<string, unknown>): Promise<NPIRegistryResult<T>> {
    try {
      const token = this.getAuthToken();

      const response = await fetch(`${this.baseUrl}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': token
        },
        body: JSON.stringify({ name: tool, arguments: args })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = await response.json();

      if (result.content?.[0]?.data) {
        return { success: true, data: result.content[0].data as T };
      }

      return { success: false, error: 'Invalid response format' };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  // Validation Operations
  async validateNPI(npi: string): Promise<NPIRegistryResult<NPIValidation>> {
    return this.request('validate_npi', { npi });
  }

  async bulkValidateNPIs(npis: string[]): Promise<NPIRegistryResult<BulkValidationResult>> {
    return this.request('bulk_validate_npis', { npis: npis.slice(0, 50) });
  }

  async checkNPIDeactivation(npi: string): Promise<NPIRegistryResult<{
    npi: string;
    is_deactivated: boolean;
    deactivation_date?: string;
    reactivation_date?: string;
    reason?: string;
    provider_name?: string;
  }>> {
    return this.request('check_npi_deactivation', { npi });
  }

  // Lookup Operations
  async lookupNPI(npi: string): Promise<NPIRegistryResult<{
    found: boolean;
    npi: string;
    provider?: ProviderDetails;
  }>> {
    return this.request('lookup_npi', { npi });
  }

  async getProviderIdentifiers(npi: string): Promise<NPIRegistryResult<{
    npi: string;
    found: boolean;
    identifiers: ProviderIdentifier[];
  }>> {
    return this.request('get_provider_identifiers', { npi });
  }

  // Search Operations
  async searchProviders(params: {
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    taxonomy_description?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    enumeration_type?: EnumerationType;
    limit?: number;
  }): Promise<NPIRegistryResult<{
    total_results: number;
    providers: ProviderSearchResult[];
  }>> {
    return this.request('search_providers', params);
  }

  async searchBySpecialty(params: {
    taxonomy_code: string;
    state?: string;
    city?: string;
    limit?: number;
  }): Promise<NPIRegistryResult<{
    total_results: number;
    taxonomy_code: string;
    taxonomy_description?: string;
    providers: Array<{ npi: string; name: string; city?: string; state?: string }>;
  }>> {
    return this.request('search_by_specialty', params);
  }

  // Taxonomy Operations
  async getTaxonomyCodes(params: {
    specialty: string;
    category?: 'individual' | 'organization' | 'all';
  }): Promise<NPIRegistryResult<{
    specialty: string;
    matches: TaxonomyCode[];
  }>> {
    return this.request('get_taxonomy_codes', params);
  }
}

// =====================================================
// Singleton Instance & Helper Functions
// =====================================================

const npiRegistryClient = new NPIRegistryMCPClient();

/**
 * Validate an NPI number
 */
export async function validateNPI(npi: string): Promise<NPIRegistryResult<NPIValidation>> {
  return npiRegistryClient.validateNPI(npi);
}

/**
 * Validate multiple NPI numbers (max 50)
 */
export async function bulkValidateNPIs(npis: string[]): Promise<NPIRegistryResult<BulkValidationResult>> {
  return npiRegistryClient.bulkValidateNPIs(npis);
}

/**
 * Look up provider details by NPI
 */
export async function lookupProviderByNPI(npi: string): Promise<NPIRegistryResult<{
  found: boolean;
  npi: string;
  provider?: ProviderDetails;
}>> {
  return npiRegistryClient.lookupNPI(npi);
}

/**
 * Search providers by name
 */
export async function searchProvidersByName(
  firstName?: string,
  lastName?: string,
  state?: string,
  limit?: number
): Promise<NPIRegistryResult<{ total_results: number; providers: ProviderSearchResult[] }>> {
  return npiRegistryClient.searchProviders({
    first_name: firstName,
    last_name: lastName,
    state,
    limit,
    enumeration_type: 'NPI-1'
  });
}

/**
 * Search organizations by name
 */
export async function searchOrganizationsByName(
  organizationName: string,
  state?: string,
  limit?: number
): Promise<NPIRegistryResult<{ total_results: number; providers: ProviderSearchResult[] }>> {
  return npiRegistryClient.searchProviders({
    organization_name: organizationName,
    state,
    limit,
    enumeration_type: 'NPI-2'
  });
}

/**
 * Search providers by specialty
 */
export async function searchProvidersBySpecialty(
  specialty: string,
  state?: string,
  limit?: number
): Promise<NPIRegistryResult<{ total_results: number; providers: ProviderSearchResult[] }>> {
  return npiRegistryClient.searchProviders({
    taxonomy_description: specialty,
    state,
    limit
  });
}

/**
 * Get taxonomy codes for a specialty
 */
export async function getTaxonomyCodesForSpecialty(
  specialty: string,
  category?: 'individual' | 'organization' | 'all'
): Promise<NPIRegistryResult<{ specialty: string; matches: TaxonomyCode[] }>> {
  return npiRegistryClient.getTaxonomyCodes({ specialty, category });
}

/**
 * Get provider identifiers (licenses, DEA, etc.)
 */
export async function getProviderIdentifiers(npi: string): Promise<NPIRegistryResult<{
  npi: string;
  found: boolean;
  identifiers: ProviderIdentifier[];
}>> {
  return npiRegistryClient.getProviderIdentifiers(npi);
}

/**
 * Check if NPI has been deactivated
 */
export async function checkNPIDeactivation(npi: string): Promise<NPIRegistryResult<{
  npi: string;
  is_deactivated: boolean;
  reason?: string;
  provider_name?: string;
}>> {
  return npiRegistryClient.checkNPIDeactivation(npi);
}

// =====================================================
// NPI Validation Utilities
// =====================================================

/**
 * Validate NPI format using Luhn algorithm (client-side check)
 * This can be used before making API calls
 */
export function isValidNPIFormat(npi: string): boolean {
  // NPI must be exactly 10 digits
  if (!/^\d{10}$/.test(npi)) {
    return false;
  }

  // Luhn algorithm check with healthcare prefix "80840"
  const prefixedNPI = '80840' + npi;
  let sum = 0;
  let alternate = false;

  for (let i = prefixedNPI.length - 1; i >= 0; i--) {
    let digit = parseInt(prefixedNPI[i], 10);

    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

// =====================================================
// Common Taxonomy Codes Reference
// =====================================================

export const COMMON_TAXONOMY_CODES: Record<string, TaxonomyCode> = {
  // Physicians
  internal_medicine: { code: '207R00000X', type: 'individual', classification: 'Internal Medicine' },
  family_medicine: { code: '207Q00000X', type: 'individual', classification: 'Family Medicine' },
  cardiology: { code: '207RC0000X', type: 'individual', classification: 'Internal Medicine', specialization: 'Cardiovascular Disease' },
  orthopedic_surgery: { code: '207X00000X', type: 'individual', classification: 'Orthopaedic Surgery' },
  neurology: { code: '2084N0400X', type: 'individual', classification: 'Psychiatry & Neurology', specialization: 'Neurology' },
  pediatrics: { code: '208000000X', type: 'individual', classification: 'Pediatrics' },
  ob_gyn: { code: '207V00000X', type: 'individual', classification: 'Obstetrics & Gynecology' },
  psychiatry: { code: '2084P0800X', type: 'individual', classification: 'Psychiatry & Neurology', specialization: 'Psychiatry' },
  emergency_medicine: { code: '207P00000X', type: 'individual', classification: 'Emergency Medicine' },
  general_surgery: { code: '208600000X', type: 'individual', classification: 'Surgery' },
  dermatology: { code: '207N00000X', type: 'individual', classification: 'Dermatology' },
  radiology: { code: '2085R0202X', type: 'individual', classification: 'Radiology', specialization: 'Diagnostic Radiology' },
  anesthesiology: { code: '207L00000X', type: 'individual', classification: 'Anesthesiology' },
  urology: { code: '208800000X', type: 'individual', classification: 'Urology' },
  oncology: { code: '207RX0202X', type: 'individual', classification: 'Internal Medicine', specialization: 'Medical Oncology' },
  gastroenterology: { code: '207RG0100X', type: 'individual', classification: 'Internal Medicine', specialization: 'Gastroenterology' },
  pulmonology: { code: '207RP1001X', type: 'individual', classification: 'Internal Medicine', specialization: 'Pulmonary Disease' },
  nephrology: { code: '207RN0300X', type: 'individual', classification: 'Internal Medicine', specialization: 'Nephrology' },
  endocrinology: { code: '207RE0101X', type: 'individual', classification: 'Internal Medicine', specialization: 'Endocrinology, Diabetes & Metabolism' },
  geriatric_medicine: { code: '207RG0300X', type: 'individual', classification: 'Internal Medicine', specialization: 'Geriatric Medicine' },
  hospitalist: { code: '207RI0008X', type: 'individual', classification: 'Internal Medicine', specialization: 'Hospitalist' },
  ophthalmology: { code: '207W00000X', type: 'individual', classification: 'Ophthalmology' },
  // Nursing & PAs
  nursing: { code: '163W00000X', type: 'individual', classification: 'Registered Nurse' },
  nurse_practitioner: { code: '363L00000X', type: 'individual', classification: 'Nurse Practitioner' },
  nurse_anesthetist: { code: '367500000X', type: 'individual', classification: 'Certified Registered Nurse Anesthetist' },
  physician_assistant: { code: '363A00000X', type: 'individual', classification: 'Physician Assistant' },
  clinical_social_worker: { code: '1041C0700X', type: 'individual', classification: 'Social Worker', specialization: 'Clinical' },
  // Therapy
  physical_therapy: { code: '225100000X', type: 'individual', classification: 'Physical Therapist' },
  occupational_therapy: { code: '225X00000X', type: 'individual', classification: 'Occupational Therapist' },
  speech_language_pathologist: { code: '235Z00000X', type: 'individual', classification: 'Speech-Language Pathologist' },
  respiratory_therapist: { code: '227800000X', type: 'individual', classification: 'Respiratory Therapist, Certified' },
  // Behavioral
  psychologist_clinical: { code: '103TC0700X', type: 'individual', classification: 'Psychologist', specialization: 'Clinical' },
  counselor_mental_health: { code: '101YM0800X', type: 'individual', classification: 'Counselor', specialization: 'Mental Health' },
  // Pharmacy & Other
  pharmacist: { code: '183500000X', type: 'individual', classification: 'Pharmacist' },
  dietitian: { code: '133V00000X', type: 'individual', classification: 'Dietitian, Registered' },
  chiropractor: { code: '111N00000X', type: 'individual', classification: 'Chiropractor' },
  optometrist: { code: '152W00000X', type: 'individual', classification: 'Optometrist' },
  podiatrist: { code: '213E00000X', type: 'individual', classification: 'Podiatrist' },
  community_health_worker: { code: '172V00000X', type: 'individual', classification: 'Community Health Worker' },
  paramedic: { code: '146L00000X', type: 'individual', classification: 'Emergency Medical Technician, Paramedic' },
  // Organizations
  hospital: { code: '282N00000X', type: 'organization', classification: 'General Acute Care Hospital' },
  clinic: { code: '261QM1300X', type: 'organization', classification: 'Clinic/Center', specialization: 'Multi-Specialty' },
  clinic_federally_qualified: { code: '261QF0400X', type: 'organization', classification: 'Clinic/Center', specialization: 'Federally Qualified Health Center' },
  clinic_urgent_care: { code: '261QU0200X', type: 'organization', classification: 'Clinic/Center', specialization: 'Urgent Care' },
  pharmacy: { code: '333600000X', type: 'organization', classification: 'Pharmacy' },
  home_health: { code: '251E00000X', type: 'organization', classification: 'Home Health' },
  skilled_nursing: { code: '314000000X', type: 'organization', classification: 'Skilled Nursing Facility' },
  dme_supplier: { code: '332B00000X', type: 'organization', classification: 'Durable Medical Equipment & Medical Supplies' },
  clinical_lab: { code: '291U00000X', type: 'organization', classification: 'Clinical Medical Laboratory' },
  ambulance_ground: { code: '341100000X', type: 'organization', classification: 'Transportation Services', specialization: 'Ambulance, Ground' },
};

export default npiRegistryClient;
