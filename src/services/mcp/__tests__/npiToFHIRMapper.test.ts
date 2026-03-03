/**
 * npiToFHIRMapper — Unit tests
 *
 * Tests the NPI Registry → FHIR R4 Practitioner mapping logic.
 * Uses synthetic test data (no real NPI/PHI).
 */

import { describe, it, expect } from 'vitest';
import { mapNPIToFHIRPractitioner } from '../npiToFHIRMapper';
import type { ProviderDetails } from '../mcpNPIRegistryClient';

// =====================================================
// Test Fixtures — Synthetic Data Only
// =====================================================

const INDIVIDUAL_PROVIDER: ProviderDetails = {
  name: 'DOE, JANE M',
  type: 'Individual',
  credential: 'MD',
  gender: 'F',
  sole_proprietor: false,
  enumeration_date: '2005-01-15',
  last_updated: '2024-06-01',
  status: 'Active',
  taxonomies: [
    {
      code: '207R00000X',
      description: 'Internal Medicine',
      primary: true,
      state: 'TX',
      license: 'BP12345',
    },
    {
      code: '207RC0000X',
      description: 'Cardiovascular Disease',
      primary: false,
    },
  ],
  addresses: [
    {
      type: 'LOCATION',
      address_1: '123 Test Medical Blvd',
      address_2: 'Suite 100',
      city: 'Test City',
      state: 'TX',
      postal_code: '75001',
      telephone: '555-0100',
      fax: '555-0101',
    },
    {
      type: 'MAILING',
      address_1: '456 Test Mail St',
      city: 'Test City',
      state: 'TX',
      postal_code: '75002',
    },
  ],
  identifiers: [
    {
      identifier: 'DEA-TEST-001',
      type: '2.16.840.1.113883.4.814',
      state: 'TX',
      issuer: 'DEA',
    },
  ],
};

const ORGANIZATION_PROVIDER: ProviderDetails = {
  name: 'TEST HOSPITAL SYSTEM INC',
  type: 'Organization',
  enumeration_date: '2010-03-20',
  last_updated: '2024-01-15',
  status: 'A',
  taxonomies: [
    {
      code: '282N00000X',
      description: 'General Acute Care Hospital',
      primary: true,
    },
  ],
  addresses: [
    {
      type: 'LOCATION',
      address_1: '789 Test Hospital Way',
      city: 'Test Town',
      state: 'CA',
      postal_code: '90001',
      telephone: '555-0200',
    },
  ],
  identifiers: [],
};

const DEACTIVATED_PROVIDER: ProviderDetails = {
  name: 'SMITH, TEST A',
  type: 'Individual',
  gender: 'M',
  enumeration_date: '2000-01-01',
  last_updated: '2023-12-01',
  status: 'Deactivated',
  taxonomies: [],
  addresses: [],
  identifiers: [],
};

// =====================================================
// Tests
// =====================================================

describe('mapNPIToFHIRPractitioner', () => {
  describe('Individual Provider', () => {
    const result = mapNPIToFHIRPractitioner('1234567890', INDIVIDUAL_PROVIDER);

    it('sets resourceType to Practitioner', () => {
      expect(result.resourceType).toBe('Practitioner');
    });

    it('includes NPI as official identifier with US-NPI system', () => {
      const npiIdentifier = result.identifier.find(
        id => id.system === 'http://hl7.org/fhir/sid/us-npi'
      );
      expect(npiIdentifier).toBeDefined();
      expect(npiIdentifier?.value).toBe('1234567890');
      expect(npiIdentifier?.use).toBe('official');
    });

    it('maps active status correctly', () => {
      expect(result.active).toBe(true);
    });

    it('parses comma-separated name into family/given', () => {
      expect(result.name[0].family).toBe('DOE');
      expect(result.name[0].given).toEqual(['JANE', 'M']);
      expect(result.name[0].use).toBe('official');
    });

    it('adds credential as suffix', () => {
      expect(result.name[0].suffix).toEqual(['MD']);
    });

    it('maps female gender correctly', () => {
      expect(result.gender).toBe('female');
    });

    it('maps taxonomies to qualifications', () => {
      expect(result.qualification).toHaveLength(2);
      expect(result.qualification?.[0].code.coding[0].system).toBe(
        'http://nucc.org/provider-taxonomy'
      );
      expect(result.qualification?.[0].code.coding[0].code).toBe('207R00000X');
      expect(result.qualification?.[0].code.text).toBe('Internal Medicine');
    });

    it('maps addresses including address_2', () => {
      expect(result.address).toHaveLength(2);
      const locAddr = result.address?.[0];
      expect(locAddr?.use).toBe('work');
      expect(locAddr?.line).toEqual(['123 Test Medical Blvd', 'Suite 100']);
      expect(locAddr?.city).toBe('Test City');
      expect(locAddr?.state).toBe('TX');
      expect(locAddr?.postalCode).toBe('75001');
      expect(locAddr?.country).toBe('US');
    });

    it('maps mailing address with home use', () => {
      const mailAddr = result.address?.[1];
      expect(mailAddr?.use).toBe('home');
    });

    it('extracts phone and fax from addresses', () => {
      expect(result.telecom).toHaveLength(2);
      const phone = result.telecom?.find(t => t.system === 'phone');
      const fax = result.telecom?.find(t => t.system === 'fax');
      expect(phone?.value).toBe('555-0100');
      expect(fax?.value).toBe('555-0101');
    });

    it('includes additional identifiers (DEA)', () => {
      const deaId = result.identifier.find(id => id.value === 'DEA-TEST-001');
      expect(deaId).toBeDefined();
      expect(deaId?.system).toBe('urn:oid:2.16.840.1.113883.4.814');
    });
  });

  describe('Organization Provider', () => {
    const result = mapNPIToFHIRPractitioner('9876543210', ORGANIZATION_PROVIDER);

    it('uses organization name as family name', () => {
      expect(result.name[0].family).toBe('TEST HOSPITAL SYSTEM INC');
      expect(result.name[0].given).toBeUndefined();
    });

    it('maps status code "A" as active', () => {
      expect(result.active).toBe(true);
    });

    it('does not set gender for organizations', () => {
      expect(result.gender).toBeUndefined();
    });

    it('maps single taxonomy', () => {
      expect(result.qualification).toHaveLength(1);
      expect(result.qualification?.[0].code.coding[0].code).toBe('282N00000X');
    });

    it('has no additional identifiers beyond NPI', () => {
      expect(result.identifier).toHaveLength(1);
    });
  });

  describe('Deactivated Provider', () => {
    const result = mapNPIToFHIRPractitioner('0000000000', DEACTIVATED_PROVIDER);

    it('sets active to false for deactivated providers', () => {
      expect(result.active).toBe(false);
    });

    it('handles missing taxonomies gracefully', () => {
      expect(result.qualification).toBeUndefined();
    });

    it('handles missing addresses gracefully', () => {
      expect(result.address).toBeUndefined();
      expect(result.telecom).toBeUndefined();
    });

    it('maps male gender correctly', () => {
      expect(result.gender).toBe('male');
    });
  });

  describe('Edge Cases', () => {
    it('handles name without comma (space-separated)', () => {
      const provider: ProviderDetails = {
        ...INDIVIDUAL_PROVIDER,
        name: 'JOHN SMITH',
      };
      const result = mapNPIToFHIRPractitioner('1111111111', provider);
      expect(result.name[0].family).toBe('SMITH');
      expect(result.name[0].given).toEqual(['JOHN']);
    });

    it('handles single-word name', () => {
      const provider: ProviderDetails = {
        ...ORGANIZATION_PROVIDER,
        name: 'CLINICNAME',
      };
      const result = mapNPIToFHIRPractitioner('2222222222', provider);
      expect(result.name[0].family).toBe('CLINICNAME');
    });

    it('handles unknown gender value', () => {
      const provider: ProviderDetails = {
        ...INDIVIDUAL_PROVIDER,
        gender: 'X',
      };
      const result = mapNPIToFHIRPractitioner('3333333333', provider);
      expect(result.gender).toBe('unknown');
    });
  });
});
