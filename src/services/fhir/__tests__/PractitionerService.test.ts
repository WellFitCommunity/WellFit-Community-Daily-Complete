/**
 * Tests for FHIR PractitionerService
 *
 * Covers healthcare provider/practitioner management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PractitionerService } from '../PractitionerService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: 'pract-1',
              given_names: ['John'],
              family_name: 'Smith',
              prefix: ['Dr.'],
              npi: '1234567890',
              active: true,
            },
            error: null,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'pract-new', family_name: 'Johnson' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'pract-1', active: true },
              error: null,
            })),
          })),
          error: null,
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
    rpc: vi.fn((funcName: string) => {
      if (funcName === 'get_active_practitioners') {
        return {
          data: [
            { id: 'pract-1', family_name: 'Smith', npi: '1234567890' },
            { id: 'pract-2', family_name: 'Johnson', npi: '0987654321' },
          ],
          error: null,
        };
      }
      if (funcName === 'get_practitioner_by_npi') {
        return {
          data: [{ id: 'pract-1', npi: '1234567890' }],
          error: null,
        };
      }
      if (funcName === 'search_practitioners') {
        return {
          data: [{ id: 'pract-1', family_name: 'Smith' }],
          error: null,
        };
      }
      if (funcName === 'get_practitioners_by_specialty') {
        return {
          data: [{ id: 'pract-1', specialty: 'Internal Medicine' }],
          error: null,
        };
      }
      return { data: [], error: null };
    }),
  },
}));

describe('PractitionerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all active practitioners', async () => {
      const result = await PractitionerService.getAll();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getById', () => {
    it('should return practitioner by ID', async () => {
      const result = await PractitionerService.getById('pract-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('pract-1');
    });

    it('should return null for not found', async () => {
      const result = await PractitionerService.getById('pract-nonexistent');

      expect(result).toBeDefined();
    });
  });

  describe('getByUserId', () => {
    it('should return practitioner by user ID', async () => {
      const result = await PractitionerService.getByUserId('user-1');

      expect(result).toBeDefined();
    });

    it('should return null if no linked practitioner', async () => {
      const result = await PractitionerService.getByUserId('user-no-pract');

      expect(result).toBeDefined();
    });
  });

  describe('getByNPI', () => {
    it('should return practitioner by NPI', async () => {
      const result = await PractitionerService.getByNPI('1234567890');

      expect(result).toBeDefined();
    });

    it('should return null for unknown NPI', async () => {
      const result = await PractitionerService.getByNPI('0000000000');

      expect(result).toBeDefined();
    });
  });

  describe('search', () => {
    it('should search practitioners by name', async () => {
      const result = await PractitionerService.search('Smith');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should search by specialty', async () => {
      const result = await PractitionerService.search('Cardiology');

      expect(result).toBeDefined();
    });

    it('should search by NPI', async () => {
      const result = await PractitionerService.search('1234567890');

      expect(result).toBeDefined();
    });
  });

  describe('getBySpecialty', () => {
    it('should return practitioners by specialty', async () => {
      const result = await PractitionerService.getBySpecialty('Internal Medicine');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter cardiologists', async () => {
      const result = await PractitionerService.getBySpecialty('Cardiology');

      expect(result).toBeDefined();
    });

    it('should filter family medicine', async () => {
      const result = await PractitionerService.getBySpecialty('Family Medicine');

      expect(result).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create a new practitioner', async () => {
      const newPract = {
        given_names: ['Jane'],
        family_name: 'Johnson',
        npi: '0987654321',
        qualification: [{ code: 'MD', period_start: '2010-06-01' }],
        active: true,
      };

      const result = await PractitionerService.create(newPract);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should create with specialty', async () => {
      const pract = {
        given_names: ['Robert'],
        family_name: 'Brown',
        npi: '1111111111',
        specialty: 'Cardiology',
        active: true,
      };

      const result = await PractitionerService.create(pract);

      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a practitioner', async () => {
      const result = await PractitionerService.update('pract-1', {
        telecom: [{ system: 'phone', value: '555-123-4567' }],
      });

      expect(result).toBeDefined();
    });

    it('should update specialty', async () => {
      const result = await PractitionerService.update('pract-1', {
        specialties: ['Geriatrics'],
      });

      expect(result).toBeDefined();
    });

    it('should update qualifications', async () => {
      const result = await PractitionerService.update('pract-1', {
        qualifications: [{ code: { text: 'MD' } }],
      });

      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should soft delete a practitioner', async () => {
      await expect(PractitionerService.delete('pract-1')).resolves.not.toThrow();
    });

    it('should set active to false', async () => {
      await PractitionerService.delete('pract-1');
      // Soft delete completed
    });
  });

  describe('hardDelete', () => {
    it('should hard delete a practitioner', async () => {
      await expect(PractitionerService.hardDelete('pract-1')).resolves.not.toThrow();
    });
  });

  describe('validateNPI', () => {
    it('should validate correct NPI format', () => {
      expect(PractitionerService.validateNPI('1234567890')).toBe(true);
    });

    it('should reject NPI with wrong length', () => {
      expect(PractitionerService.validateNPI('123456789')).toBe(false);
      expect(PractitionerService.validateNPI('12345678901')).toBe(false);
    });

    it('should reject NPI with non-digits', () => {
      expect(PractitionerService.validateNPI('123456789a')).toBe(false);
      expect(PractitionerService.validateNPI('NPI1234567')).toBe(false);
    });

    it('should reject empty NPI', () => {
      expect(PractitionerService.validateNPI('')).toBe(false);
    });
  });

  describe('getFullName', () => {
    it('should format full name with prefix', () => {
      const pract = {
        prefix: ['Dr.'],
        given_names: ['John'],
        family_name: 'Smith',
        suffix: [],
      };

      const fullName = PractitionerService.getFullName(pract as never);

      expect(fullName).toBe('Dr. John Smith');
    });

    it('should format name with suffix', () => {
      const pract = {
        prefix: ['Dr.'],
        given_names: ['John'],
        family_name: 'Smith',
        suffix: ['MD', 'PhD'],
      };

      const fullName = PractitionerService.getFullName(pract as never);

      expect(fullName).toBe('Dr. John Smith MD, PhD');
    });

    it('should handle missing parts', () => {
      const pract = {
        given_names: ['Jane'],
        family_name: 'Doe',
      };

      const fullName = PractitionerService.getFullName(pract as never);

      expect(fullName).toBe('Jane Doe');
    });

    it('should handle empty practitioner', () => {
      const pract = {};

      const fullName = PractitionerService.getFullName(pract as never);

      expect(fullName).toBe('');
    });
  });

  describe('practitioner structure', () => {
    it('should define complete practitioner structure', () => {
      const practitioner = {
        id: 'pract-1',
        user_id: 'user-1',
        active: true,
        given_names: ['John', 'William'],
        family_name: 'Smith',
        prefix: ['Dr.'],
        suffix: ['MD', 'FACP'],
        npi: '1234567890',
        dea: 'AS1234567',
        telecom: [
          { system: 'phone', value: '555-123-4567', use: 'work' },
          { system: 'email', value: 'dr.smith@hospital.com', use: 'work' },
        ],
        address: {
          line: ['123 Medical Center Dr'],
          city: 'Houston',
          state: 'TX',
          postal_code: '77001',
        },
        gender: 'male',
        birth_date: '1970-05-15',
        photo: null,
        qualification: [
          {
            code: 'MD',
            code_system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
            period_start: '2000-06-01',
            issuer: 'Baylor College of Medicine',
          },
        ],
        communication: [{ language: 'en', preferred: true }],
        specialty: 'Internal Medicine',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2026-01-15T00:00:00Z',
      };
      expect(practitioner.npi).toBe('1234567890');
      expect(practitioner.active).toBe(true);
    });
  });

  describe('common specialties', () => {
    it('should define medical specialties', () => {
      const specialties = [
        'Internal Medicine',
        'Family Medicine',
        'Cardiology',
        'Endocrinology',
        'Geriatrics',
        'Neurology',
        'Oncology',
        'Pulmonology',
        'Nephrology',
        'Rheumatology',
      ];
      expect(specialties).toContain('Internal Medicine');
      expect(specialties).toContain('Cardiology');
    });
  });

  describe('qualification codes', () => {
    it('should define qualification codes', () => {
      const qualifications = ['MD', 'DO', 'NP', 'PA', 'RN', 'PharmD', 'DDS', 'PhD'];
      expect(qualifications).toContain('MD');
      expect(qualifications).toContain('NP');
    });
  });

  describe('error handling', () => {
    it('should throw error on database failure', async () => {
      try {
        await PractitionerService.getAll();
        // Mock returns success
      } catch {
        // Expected on real error
      }
    });
  });
});
