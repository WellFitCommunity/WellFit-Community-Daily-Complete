// =====================================================
// MCP FHIR Server - Bundle Builder
// Purpose: FHIR Bundle construction and Patient resource mapping
// =====================================================

import type { FHIRResource, ProfileRecord } from "./types.ts";

/**
 * Creates a FHIR Bundle from an array of resources.
 * Supports searchset, collection, and document bundle types.
 */
export function createFHIRBundle(
  resources: FHIRResource[],
  type: 'searchset' | 'collection' | 'document' = 'collection'
): Record<string, unknown> {
  return {
    resourceType: 'Bundle',
    type,
    timestamp: new Date().toISOString(),
    total: resources.length,
    entry: resources.map(resource => ({
      fullUrl: `urn:uuid:${resource.id}`,
      resource
    }))
  };
}

/**
 * Converts a database profile record into a FHIR R4 Patient resource.
 */
export function toFHIRPatient(profile: ProfileRecord): FHIRResource {
  return {
    resourceType: 'Patient',
    id: profile.id,
    meta: {
      lastUpdated: profile.updated_at || profile.created_at
    },
    identifier: profile.mrn ? [{
      system: 'http://hospital.example.org/mrn',
      value: profile.mrn
    }] : undefined,
    name: [{
      use: 'official',
      family: profile.last_name,
      given: [profile.first_name, profile.middle_name].filter(Boolean)
    }],
    gender: profile.gender?.toLowerCase(),
    birthDate: profile.date_of_birth,
    telecom: [
      profile.phone && { system: 'phone', value: profile.phone },
      profile.email && { system: 'email', value: profile.email }
    ].filter(Boolean),
    address: profile.address_line1 ? [{
      line: [profile.address_line1, profile.address_line2].filter(Boolean),
      city: profile.city,
      state: profile.state,
      postalCode: profile.zip_code,
      country: 'US'
    }] : undefined
  };
}
