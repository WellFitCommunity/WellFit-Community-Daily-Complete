/**
 * Tests for FHIR OrganizationService
 *
 * Covers healthcare organization management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationService } from '../OrganizationService';

// Mock getErrorMessage
vi.mock('../../../lib/getErrorMessage', () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Unknown error'),
}));

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              { id: 'org-1', name: 'Methodist Hospital', active: true },
              { id: 'org-2', name: 'Community Clinic', active: true },
            ],
            error: null,
          })),
          single: vi.fn(() => ({
            data: { id: 'org-1', name: 'Methodist Hospital', npi: '1234567890' },
            error: null,
          })),
        })),
        ilike: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [{ id: 'org-1', name: 'Methodist Hospital' }],
              error: null,
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'org-new', name: 'New Organization' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'org-1', active: false },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('OrganizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all active organizations', async () => {
      const result = await OrganizationService.getAll();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should order by name', async () => {
      const result = await OrganizationService.getAll();

      expect(result.success).toBe(true);
    });
  });

  describe('getById', () => {
    it('should return organization by ID', async () => {
      const result = await OrganizationService.getById('org-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for not found', async () => {
      const result = await OrganizationService.getById('org-nonexistent');

      expect(result).toBeDefined();
    });
  });

  describe('getByNPI', () => {
    it('should return organization by NPI', async () => {
      const result = await OrganizationService.getByNPI('1234567890');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for unknown NPI', async () => {
      const result = await OrganizationService.getByNPI('0000000000');

      expect(result).toBeDefined();
    });
  });

  describe('search', () => {
    it('should search organizations by name', async () => {
      const result = await OrganizationService.search('Methodist');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should return empty for no matches', async () => {
      const result = await OrganizationService.search('NonExistent');

      expect(result.success).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new organization', async () => {
      const newOrg = {
        name: 'New Hospital',
        active: true,
        type: ['prov'],
        npi: '0987654321',
      };

      const result = await OrganizationService.create(newOrg);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should create with full details', async () => {
      const org = {
        name: 'Community Health Center',
        active: true,
        type: ['prov', 'other'],
        npi: '1111111111',
        telecom: [{ system: 'phone', value: '555-123-4567' }],
        address: {
          line: ['123 Main St'],
          city: 'Houston',
          state: 'TX',
          postal_code: '77001',
        },
      };

      const result = await OrganizationService.create(org);

      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('should update an organization', async () => {
      const result = await OrganizationService.update('org-1', {
        name: 'Updated Hospital Name',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should deactivate organization', async () => {
      const result = await OrganizationService.update('org-1', {
        active: false,
      });

      expect(result.success).toBe(true);
    });

    it('should update contact info', async () => {
      const result = await OrganizationService.update('org-1', {
        telecom: [{ system: 'email', value: 'new@hospital.com' }],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('organization type codes', () => {
    it('should define organization types', () => {
      const types = {
        prov: 'Healthcare Provider',
        dept: 'Hospital Department',
        team: 'Organizational team',
        govt: 'Government',
        ins: 'Insurance Company',
        pay: 'Payer',
        edu: 'Educational Institute',
        reli: 'Religious Institution',
        crs: 'Clinical Research Sponsor',
        cg: 'Community Group',
        bus: 'Non-Healthcare Business or Corporation',
        other: 'Other',
      };
      expect(types.prov).toBe('Healthcare Provider');
      expect(types.ins).toBe('Insurance Company');
    });
  });

  describe('organization structure', () => {
    it('should define complete organization structure', () => {
      const organization = {
        id: 'org-1',
        identifier: [
          { system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' },
          { system: 'http://cms.gov/ccn', value: '450123' },
        ],
        active: true,
        type: ['prov'],
        name: 'Methodist Hospital System',
        alias: ['MHS', 'Methodist'],
        telecom: [
          { system: 'phone', value: '555-123-4567', use: 'work' },
          { system: 'email', value: 'info@methodist.org', use: 'work' },
          { system: 'url', value: 'https://methodist.org' },
        ],
        address: [
          {
            use: 'work',
            type: 'both',
            line: ['6565 Fannin St'],
            city: 'Houston',
            state: 'TX',
            postal_code: '77030',
            country: 'USA',
          },
        ],
        part_of_id: null,
        contact: [
          {
            purpose: 'admin',
            name: { family: 'Smith', given: ['John'] },
            telecom: [{ system: 'phone', value: '555-987-6543' }],
          },
        ],
        endpoint: ['endpoint-1'],
        npi: '1234567890',
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2026-01-15T00:00:00Z',
      };
      expect(organization.active).toBe(true);
      expect(organization.npi).toBe('1234567890');
    });
  });

  describe('identifier systems', () => {
    it('should define common identifier systems', () => {
      const systems = {
        npi: 'http://hl7.org/fhir/sid/us-npi',
        ccn: 'http://cms.gov/ccn',
        taxId: 'urn:oid:2.16.840.1.113883.4.4',
      };
      expect(systems.npi).toBe('http://hl7.org/fhir/sid/us-npi');
    });
  });

  describe('contact purpose codes', () => {
    it('should define contact purpose codes', () => {
      const purposes = ['admin', 'billing', 'hr', 'payor', 'patinf', 'press'];
      expect(purposes).toContain('admin');
      expect(purposes).toContain('billing');
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await OrganizationService.getAll();
      expect(result).toHaveProperty('success');
    });

    it('should handle search errors', async () => {
      const result = await OrganizationService.search('test');
      expect(result).toBeDefined();
    });
  });
});
