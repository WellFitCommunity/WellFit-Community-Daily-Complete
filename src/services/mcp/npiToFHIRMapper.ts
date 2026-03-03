/**
 * NPI-to-FHIR Practitioner Mapper
 *
 * Maps NPI Registry provider details to a FHIR R4 Practitioner resource.
 * Used by BillingProviderForm to create FHIR Practitioners from validated NPI data.
 *
 * FHIR R4 Practitioner spec: https://hl7.org/fhir/R4/practitioner.html
 * NPI system OID: http://hl7.org/fhir/sid/us-npi
 */

import type {
  ProviderDetails,
  ProviderTaxonomy,
  ProviderAddress,
} from './mcpNPIRegistryClient';

// =====================================================
// FHIR R4 Practitioner Resource Shape
// =====================================================

export interface FHIRPractitionerResource {
  resourceType: 'Practitioner';
  identifier: Array<{
    system: string;
    value: string;
    use?: string;
  }>;
  active: boolean;
  name: Array<{
    use: string;
    family: string;
    given?: string[];
    suffix?: string[];
  }>;
  gender?: string;
  telecom?: Array<{
    system: string;
    value: string;
    use?: string;
  }>;
  address?: Array<{
    use: string;
    type: string;
    line: string[];
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
  qualification?: Array<{
    code: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
      text: string;
    };
  }>;
}

// =====================================================
// Mapping Logic
// =====================================================

/**
 * Parse an NPI provider name into family/given components.
 * NPI Registry returns names in formats like:
 *  - Individual: "DOE, JANE M" or "SMITH JOHN"
 *  - Organization: "WELLFIT HOSPITAL INC"
 */
function parseProviderName(
  name: string,
  type: 'Individual' | 'Organization'
): { family: string; given?: string[]; suffix?: string[] } {
  if (type === 'Organization') {
    return { family: name };
  }

  // Individual: try comma-separated first (FAMILY, GIVEN MIDDLE)
  if (name.includes(',')) {
    const [family, rest] = name.split(',').map(s => s.trim());
    const givenParts = rest ? rest.split(/\s+/).filter(Boolean) : [];
    return { family, given: givenParts.length > 0 ? givenParts : undefined };
  }

  // No comma: treat last word as family, rest as given
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { family: parts[0] || name };
  }

  const family = parts[parts.length - 1];
  const given = parts.slice(0, -1);
  return { family, given };
}

/**
 * Map NPI gender code to FHIR gender.
 */
function mapGender(npiGender: string | undefined): string | undefined {
  if (!npiGender) return undefined;
  const lower = npiGender.toLowerCase();
  if (lower === 'm' || lower === 'male') return 'male';
  if (lower === 'f' || lower === 'female') return 'female';
  return 'unknown';
}

/**
 * Map NPI address type to FHIR address use.
 */
function mapAddressUse(npiType: string): string {
  const upper = npiType.toUpperCase();
  if (upper === 'LOCATION' || upper === 'PRACTICE') return 'work';
  if (upper === 'MAILING') return 'home';
  return 'work';
}

/**
 * Map NPI taxonomy to FHIR qualification.
 */
function mapTaxonomyToQualification(taxonomy: ProviderTaxonomy): {
  code: { coding: Array<{ system: string; code: string; display: string }>; text: string };
} {
  return {
    code: {
      coding: [{
        system: 'http://nucc.org/provider-taxonomy',
        code: taxonomy.code,
        display: taxonomy.description,
      }],
      text: taxonomy.description,
    },
  };
}

/**
 * Map NPI address to FHIR address.
 */
function mapAddress(addr: ProviderAddress): {
  use: string;
  type: string;
  line: string[];
  city: string;
  state: string;
  postalCode: string;
  country: string;
} {
  const lines = [addr.address_1];
  if (addr.address_2) lines.push(addr.address_2);

  return {
    use: mapAddressUse(addr.type),
    type: 'physical',
    line: lines,
    city: addr.city,
    state: addr.state,
    postalCode: addr.postal_code,
    country: 'US',
  };
}

// =====================================================
// Main Mapper
// =====================================================

/**
 * Map an NPI Registry ProviderDetails to a FHIR R4 Practitioner resource.
 *
 * @param npi - The 10-digit NPI number
 * @param provider - Provider details from NPI Registry lookup
 * @returns FHIR R4 Practitioner resource ready for createResource()
 */
export function mapNPIToFHIRPractitioner(
  npi: string,
  provider: ProviderDetails
): FHIRPractitionerResource {
  const { family, given, suffix } = parseProviderName(provider.name, provider.type);

  const practitioner: FHIRPractitionerResource = {
    resourceType: 'Practitioner',
    identifier: [{
      system: 'http://hl7.org/fhir/sid/us-npi',
      value: npi,
      use: 'official',
    }],
    active: provider.status.toLowerCase() === 'active' || provider.status === 'A',
    name: [{
      use: 'official',
      family,
      ...(given && { given }),
      ...(suffix && { suffix }),
    }],
  };

  // Gender (individual providers only)
  const gender = mapGender(provider.gender);
  if (gender) {
    practitioner.gender = gender;
  }

  // Telecom from addresses
  const telecoms: Array<{ system: string; value: string; use?: string }> = [];
  for (const addr of provider.addresses) {
    if (addr.telephone) {
      telecoms.push({ system: 'phone', value: addr.telephone, use: 'work' });
    }
    if (addr.fax) {
      telecoms.push({ system: 'fax', value: addr.fax, use: 'work' });
    }
  }
  if (telecoms.length > 0) {
    practitioner.telecom = telecoms;
  }

  // Addresses
  if (provider.addresses.length > 0) {
    practitioner.address = provider.addresses.map(mapAddress);
  }

  // Qualifications from taxonomies
  if (provider.taxonomies.length > 0) {
    practitioner.qualification = provider.taxonomies.map(mapTaxonomyToQualification);
  }

  // Additional identifiers (state license, DEA, etc.)
  for (const ident of provider.identifiers) {
    practitioner.identifier.push({
      system: `urn:oid:${ident.type}`,
      value: ident.identifier,
    });
  }

  // Credential as suffix
  if (provider.credential) {
    practitioner.name[0].suffix = [provider.credential];
  }

  return practitioner;
}
