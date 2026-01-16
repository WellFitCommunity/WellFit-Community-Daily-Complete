/**
 * Tests for NPI Registry MCP Client
 *
 * Tests National Provider Identifier operations:
 * - NPI validation (Luhn check + registry lookup)
 * - Provider lookup by NPI
 * - Provider search by name, specialty, location
 * - Taxonomy code lookup
 * - Bulk NPI validation
 */

import {
  validateNPI,
  bulkValidateNPIs,
  lookupProviderByNPI,
  searchProvidersByName,
  searchOrganizationsByName,
  searchProvidersBySpecialty,
  getTaxonomyCodesForSpecialty,
  getProviderIdentifiers,
  checkNPIDeactivation,
  isValidNPIFormat,
  COMMON_TAXONOMY_CODES,
  NPIRegistryMCPClient
} from '../mcpNPIRegistryClient';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {
  'sb-xkybsjnvuohpqpbkikyn-auth-token': JSON.stringify({ access_token: 'test-token' })
};

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
  }
});

describe('NPIRegistryMCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateNPI', () => {
    it('should validate an active NPI', async () => {
      const mockValidation = {
        npi: '1234567893',
        valid_format: true,
        is_active: true,
        provider_name: 'John Smith MD',
        enumeration_type: 'NPI-1',
        status: 'active',
        validation_message: 'NPI is valid and active for John Smith MD'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockValidation }]
        })
      });

      const result = await validateNPI('1234567893');

      expect(result.success).toBe(true);
      expect(result.data?.valid_format).toBe(true);
      expect(result.data?.is_active).toBe(true);
      expect(result.data?.status).toBe('active');
    });

    it('should detect invalid NPI format', async () => {
      const mockValidation = {
        npi: '1234567890',
        valid_format: false,
        is_active: false,
        status: 'invalid',
        validation_message: 'NPI fails Luhn check'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockValidation }]
        })
      });

      const result = await validateNPI('1234567890');

      expect(result.success).toBe(true);
      expect(result.data?.valid_format).toBe(false);
      expect(result.data?.status).toBe('invalid');
    });

    it('should handle deactivated NPIs', async () => {
      const mockValidation = {
        npi: '1234567893',
        valid_format: true,
        is_active: false,
        provider_name: 'Jane Doe MD',
        enumeration_type: 'NPI-1',
        status: 'deactivated',
        validation_message: 'NPI was deactivated on 2024-01-15'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockValidation }]
        })
      });

      const result = await validateNPI('1234567893');

      expect(result.success).toBe(true);
      expect(result.data?.is_active).toBe(false);
      expect(result.data?.status).toBe('deactivated');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const result = await validateNPI('1234567893');

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });
  });

  describe('bulkValidateNPIs', () => {
    it('should validate multiple NPIs', async () => {
      const mockBulkResult = {
        total: 3,
        valid: 2,
        invalid: 1,
        results: [
          { npi: '1234567893', valid: true, status: 'active', provider_name: 'John Smith MD' },
          { npi: '9876543210', valid: true, status: 'active', provider_name: 'Jane Doe NP' },
          { npi: '1111111111', valid: false, status: 'invalid' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockBulkResult }]
        })
      });

      const result = await bulkValidateNPIs(['1234567893', '9876543210', '1111111111']);

      expect(result.success).toBe(true);
      expect(result.data?.total).toBe(3);
      expect(result.data?.valid).toBe(2);
      expect(result.data?.invalid).toBe(1);
      expect(result.data?.results).toHaveLength(3);
    });

    it('should limit to 50 NPIs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { total: 50, valid: 50, invalid: 0, results: [] } }]
        })
      });

      const npis = Array(100).fill('1234567893');
      await bulkValidateNPIs(npis);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.any(String)
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.arguments.npis).toHaveLength(50);
    });
  });

  describe('lookupProviderByNPI', () => {
    it('should return provider details', async () => {
      const mockProvider = {
        found: true,
        npi: '1234567893',
        provider: {
          name: 'John Smith MD',
          type: 'Individual',
          credential: 'MD',
          gender: 'M',
          enumeration_date: '2006-05-23',
          last_updated: '2024-01-15',
          status: 'Active',
          taxonomies: [
            { code: '207RC0000X', description: 'Cardiovascular Disease', primary: true }
          ],
          addresses: [
            {
              type: 'LOCATION',
              address_1: '123 Medical Center Dr',
              city: 'Houston',
              state: 'TX',
              postal_code: '77001',
              telephone: '713-555-0100'
            }
          ],
          identifiers: [
            { identifier: 'AB1234567', type: 'State License', state: 'TX' }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockProvider }]
        })
      });

      const result = await lookupProviderByNPI('1234567893');

      expect(result.success).toBe(true);
      expect(result.data?.found).toBe(true);
      expect(result.data?.provider?.name).toBe('John Smith MD');
      expect(result.data?.provider?.taxonomies).toHaveLength(1);
    });

    it('should handle NPI not found', async () => {
      const mockNotFound = {
        found: false,
        npi: '9999999999',
        provider: null
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockNotFound }]
        })
      });

      const result = await lookupProviderByNPI('9999999999');

      expect(result.success).toBe(true);
      expect(result.data?.found).toBe(false);
    });
  });

  describe('searchProvidersByName', () => {
    it('should search individual providers by name', async () => {
      const mockResults = {
        total_results: 2,
        providers: [
          { npi: '1234567893', name: 'John Smith MD', type: 'Individual', specialty: 'Cardiology', city: 'Houston', state: 'TX' },
          { npi: '9876543210', name: 'John Smith DO', type: 'Individual', specialty: 'Family Medicine', city: 'Dallas', state: 'TX' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockResults }]
        })
      });

      const result = await searchProvidersByName('John', 'Smith', 'TX');

      expect(result.success).toBe(true);
      expect(result.data?.total_results).toBe(2);
      expect(result.data?.providers).toHaveLength(2);
    });

    it('should filter by state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { total_results: 0, providers: [] } }]
        })
      });

      await searchProvidersByName('John', 'Smith', 'CA');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"state":"CA"')
        })
      );
    });
  });

  describe('searchOrganizationsByName', () => {
    it('should search organization providers', async () => {
      const mockResults = {
        total_results: 1,
        providers: [
          { npi: '1234567893', name: 'Methodist Hospital', type: 'Organization', city: 'Houston', state: 'TX' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockResults }]
        })
      });

      const result = await searchOrganizationsByName('Methodist Hospital', 'TX');

      expect(result.success).toBe(true);
      expect(result.data?.providers[0].type).toBe('Organization');
    });

    it('should use NPI-2 enumeration type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { total_results: 0, providers: [] } }]
        })
      });

      await searchOrganizationsByName('Test Clinic');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"enumeration_type":"NPI-2"')
        })
      );
    });
  });

  describe('searchProvidersBySpecialty', () => {
    it('should search by specialty/taxonomy', async () => {
      const mockResults = {
        total_results: 5,
        providers: [
          { npi: '1234567893', name: 'John Smith MD', type: 'Individual', specialty: 'Cardiology', city: 'Houston', state: 'TX' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockResults }]
        })
      });

      const result = await searchProvidersBySpecialty('Cardiology', 'TX');

      expect(result.success).toBe(true);
      expect(result.data?.providers[0].specialty).toBe('Cardiology');
    });
  });

  describe('getTaxonomyCodesForSpecialty', () => {
    it('should return taxonomy codes', async () => {
      const mockTaxonomies = {
        specialty: 'cardiology',
        matches: [
          { code: '207RC0000X', type: 'individual', classification: 'Internal Medicine', specialization: 'Cardiovascular Disease' },
          { code: '207RI0200X', type: 'individual', classification: 'Internal Medicine', specialization: 'Interventional Cardiology' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockTaxonomies }]
        })
      });

      const result = await getTaxonomyCodesForSpecialty('cardiology');

      expect(result.success).toBe(true);
      expect(result.data?.matches).toHaveLength(2);
      expect(result.data?.matches[0].code).toBe('207RC0000X');
    });

    it('should filter by category', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { specialty: 'hospital', matches: [] } }]
        })
      });

      await getTaxonomyCodesForSpecialty('hospital', 'organization');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"category":"organization"')
        })
      );
    });
  });

  describe('getProviderIdentifiers', () => {
    it('should return provider identifiers', async () => {
      const mockIdentifiers = {
        npi: '1234567893',
        found: true,
        identifiers: [
          { identifier: 'AB1234567', type: 'State License', state: 'TX' },
          { identifier: 'FS1234567', type: 'DEA', issuer: 'DEA' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockIdentifiers }]
        })
      });

      const result = await getProviderIdentifiers('1234567893');

      expect(result.success).toBe(true);
      expect(result.data?.identifiers).toHaveLength(2);
      expect(result.data?.identifiers[0].type).toBe('State License');
    });
  });

  describe('checkNPIDeactivation', () => {
    it('should check for deactivated NPI', async () => {
      const mockDeactivation = {
        npi: '1234567893',
        is_deactivated: true,
        deactivation_date: '2024-01-15',
        reason: 'Provider retired',
        provider_name: 'John Smith MD'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockDeactivation }]
        })
      });

      const result = await checkNPIDeactivation('1234567893');

      expect(result.success).toBe(true);
      expect(result.data?.is_deactivated).toBe(true);
      expect(result.data?.reason).toBe('Provider retired');
    });

    it('should confirm active NPI', async () => {
      const mockActive = {
        npi: '9876543210',
        is_deactivated: false,
        provider_name: 'Jane Doe NP'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockActive }]
        })
      });

      const result = await checkNPIDeactivation('9876543210');

      expect(result.success).toBe(true);
      expect(result.data?.is_deactivated).toBe(false);
    });
  });

  describe('isValidNPIFormat (Luhn algorithm)', () => {
    it('should validate correct NPI format', () => {
      // NPI with valid Luhn check digit using healthcare prefix 80840
      expect(isValidNPIFormat('1234567893')).toBe(true);
    });

    it('should reject NPI with wrong length', () => {
      expect(isValidNPIFormat('123456789')).toBe(false); // 9 digits
      expect(isValidNPIFormat('12345678901')).toBe(false); // 11 digits
    });

    it('should reject NPI with non-numeric characters', () => {
      expect(isValidNPIFormat('123456789A')).toBe(false);
      expect(isValidNPIFormat('NPI1234567')).toBe(false);
    });

    it('should reject NPI failing Luhn check', () => {
      expect(isValidNPIFormat('1234567890')).toBe(false);
      expect(isValidNPIFormat('1111111111')).toBe(false);
    });
  });

  describe('COMMON_TAXONOMY_CODES', () => {
    it('should have internal medicine code', () => {
      expect(COMMON_TAXONOMY_CODES.internal_medicine).toBeDefined();
      expect(COMMON_TAXONOMY_CODES.internal_medicine.code).toBe('207R00000X');
      expect(COMMON_TAXONOMY_CODES.internal_medicine.type).toBe('individual');
    });

    it('should have cardiology code', () => {
      expect(COMMON_TAXONOMY_CODES.cardiology).toBeDefined();
      expect(COMMON_TAXONOMY_CODES.cardiology.code).toBe('207RC0000X');
      expect(COMMON_TAXONOMY_CODES.cardiology.specialization).toBe('Cardiovascular Disease');
    });

    it('should have organization codes', () => {
      expect(COMMON_TAXONOMY_CODES.hospital).toBeDefined();
      expect(COMMON_TAXONOMY_CODES.hospital.type).toBe('organization');
      expect(COMMON_TAXONOMY_CODES.hospital.code).toBe('282N00000X');

      expect(COMMON_TAXONOMY_CODES.pharmacy).toBeDefined();
      expect(COMMON_TAXONOMY_CODES.pharmacy.type).toBe('organization');
    });

    it('should have nurse practitioner code', () => {
      expect(COMMON_TAXONOMY_CODES.nurse_practitioner).toBeDefined();
      expect(COMMON_TAXONOMY_CODES.nurse_practitioner.code).toBe('363L00000X');
    });
  });

  describe('NPIRegistryMCPClient class', () => {
    it('should instantiate correctly', () => {
      const client = new NPIRegistryMCPClient();
      expect(client).toBeDefined();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await validateNPI('1234567893');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      });

      const result = await validateNPI('1234567893');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response format');
    });
  });
});
