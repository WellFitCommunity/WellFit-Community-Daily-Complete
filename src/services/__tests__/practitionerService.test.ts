/**
 * FHIR Practitioner Service Tests
 * Comprehensive unit tests for PractitionerService and PractitionerRoleService
 */

import {
  PractitionerService,
  PractitionerRoleService,
} from '../fhirResourceService';
import { supabase } from '../../lib/supabaseClient';
import type { FHIRPractitioner, FHIRPractitionerRole } from '../../types/fhir';

// Mock Supabase client
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('PractitionerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Sample practitioner data for tests
  const mockPractitioner: FHIRPractitioner = {
    id: 'pract-123',
    fhir_id: 'Practitioner/pract-123',
    user_id: 'user-456',
    active: true,
    npi: '1234567890',
    family_name: 'Smith',
    given_names: ['John', 'Michael'],
    prefix: ['Dr.'],
    suffix: ['MD', 'FACP'],
    gender: 'male',
    specialties: ['Family Medicine', 'Geriatrics'],
    telecom: [
      { system: 'phone', value: '555-1234', use: 'work' },
      { system: 'email', value: 'dr.smith@example.com', use: 'work' },
    ],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockPractitioners: FHIRPractitioner[] = [
    mockPractitioner,
    {
      id: 'pract-124',
      fhir_id: 'Practitioner/pract-124',
      user_id: 'user-457',
      active: true,
      npi: '9876543210',
      family_name: 'Johnson',
      given_names: ['Sarah'],
      prefix: ['Dr.'],
      suffix: ['MD'],
      gender: 'female',
      specialties: ['Cardiology'],
      created_at: '2025-01-02T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    },
  ];

  describe('getAll', () => {
    it('should fetch all active practitioners', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockPractitioners,
        error: null,
      });

      const result = await PractitionerService.getAll();

      expect(result).toEqual(mockPractitioners);
      expect(supabase.rpc).toHaveBeenCalledWith('get_active_practitioners');
    });

    it('should return empty array when no practitioners found', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await PractitionerService.getAll();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockError = new Error('Database connection failed');
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(PractitionerService.getAll()).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('getById', () => {
    it('should fetch practitioner by ID', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockPractitioner,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await PractitionerService.getById('pract-123');

      expect(result).toEqual(mockPractitioner);
      expect(supabase.from).toHaveBeenCalledWith('fhir_practitioners');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'pract-123');
    });

    it('should throw error when practitioner not found', async () => {
      const mockError = new Error('Practitioner not found');
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await expect(PractitionerService.getById('invalid-id')).rejects.toThrow(
        'Practitioner not found'
      );
    });
  });

  describe('getByUserId', () => {
    it('should fetch practitioner by user ID', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockPractitioner,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await PractitionerService.getByUserId('user-456');

      expect(result).toEqual(mockPractitioner);
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-456');
    });

    it('should return null when practitioner not found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // Not found error
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await PractitionerService.getByUserId('user-999');

      expect(result).toBeNull();
    });
  });

  describe('getByNPI', () => {
    it('should fetch practitioner by NPI', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [mockPractitioner],
        error: null,
      });

      const result = await PractitionerService.getByNPI('1234567890');

      expect(result).toEqual(mockPractitioner);
      expect(supabase.rpc).toHaveBeenCalledWith('get_practitioner_by_npi', {
        p_npi: '1234567890',
      });
    });

    it('should return null when NPI not found', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await PractitionerService.getByNPI('0000000000');

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should search practitioners by name', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [mockPractitioner],
        error: null,
      });

      const result = await PractitionerService.search('Smith');

      expect(result).toEqual([mockPractitioner]);
      expect(supabase.rpc).toHaveBeenCalledWith('search_practitioners', {
        p_search_term: 'Smith',
      });
    });

    it('should search practitioners by specialty', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockPractitioners.filter((p) =>
          p.specialties?.includes('Cardiology')
        ),
        error: null,
      });

      const result = await PractitionerService.search('Cardiology');

      expect(result).toHaveLength(1);
      expect(result[0].family_name).toBe('Johnson');
    });

    it('should return empty array when no matches found', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await PractitionerService.search('NonExistent');

      expect(result).toEqual([]);
    });
  });

  describe('getBySpecialty', () => {
    it('should fetch practitioners by specialty', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [mockPractitioner],
        error: null,
      });

      const result = await PractitionerService.getBySpecialty('Family Medicine');

      expect(result).toEqual([mockPractitioner]);
      expect(supabase.rpc).toHaveBeenCalledWith('get_practitioners_by_specialty', {
        p_specialty: 'Family Medicine',
      });
    });
  });

  describe('create', () => {
    it('should create a new practitioner', async () => {
      const newPractitioner: Partial<FHIRPractitioner> = {
        user_id: 'user-789',
        active: true,
        npi: '5555555555',
        family_name: 'Williams',
        given_names: ['Emily'],
        prefix: ['Dr.'],
        suffix: ['MD'],
        gender: 'female',
        specialties: ['Pediatrics'],
      };

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'pract-125', ...newPractitioner },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await PractitionerService.create(newPractitioner);

      expect(result.id).toBe('pract-125');
      expect(result.family_name).toBe('Williams');
      expect(supabase.from).toHaveBeenCalledWith('fhir_practitioners');
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...newPractitioner,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        })
      );
    });

    it('should throw error on duplicate NPI', async () => {
      const mockError = new Error('Duplicate NPI');
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await expect(
        PractitionerService.create({
          npi: '1234567890',
          family_name: 'Test',
          given_names: ['Test'],
        })
      ).rejects.toThrow('Duplicate NPI');
    });
  });

  describe('update', () => {
    it('should update practitioner', async () => {
      const updates: Partial<FHIRPractitioner> = {
        specialties: ['Family Medicine', 'Geriatrics', 'Internal Medicine'],
      };

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockPractitioner, ...updates },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await PractitionerService.update('pract-123', updates);

      expect(result.specialties).toHaveLength(3);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'pract-123');
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          updated_at: expect.any(String),
        })
      );
    });
  });

  describe('delete (soft delete)', () => {
    it('should soft delete practitioner by setting active to false', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await PractitionerService.delete('pract-123');

      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          active: false,
          updated_at: expect.any(String),
        })
      );
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'pract-123');
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete practitioner', async () => {
      const mockQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await PractitionerService.hardDelete('pract-123');

      expect(mockQuery.delete).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'pract-123');
    });
  });

  describe('validateNPI', () => {
    it('should validate correct NPI format', () => {
      expect(PractitionerService.validateNPI('1234567890')).toBe(true);
      expect(PractitionerService.validateNPI('9876543210')).toBe(true);
    });

    it('should reject invalid NPI formats', () => {
      expect(PractitionerService.validateNPI('123456789')).toBe(false); // Too short
      expect(PractitionerService.validateNPI('12345678901')).toBe(false); // Too long
      expect(PractitionerService.validateNPI('12345ABC90')).toBe(false); // Contains letters
      expect(PractitionerService.validateNPI('12-3456-789')).toBe(false); // Contains hyphens
      expect(PractitionerService.validateNPI('')).toBe(false); // Empty
    });
  });

  describe('getFullName', () => {
    it('should generate full name with all name parts', () => {
      const fullName = PractitionerService.getFullName(mockPractitioner);
      expect(fullName).toBe('Dr. John Michael Smith MD, FACP');
    });

    it('should generate name without prefix', () => {
      const practitioner = { ...mockPractitioner, prefix: undefined };
      const fullName = PractitionerService.getFullName(practitioner);
      expect(fullName).toBe('John Michael Smith MD, FACP');
    });

    it('should generate name without suffix', () => {
      const practitioner = { ...mockPractitioner, suffix: undefined };
      const fullName = PractitionerService.getFullName(practitioner);
      expect(fullName).toBe('Dr. John Michael Smith');
    });

    it('should handle single given name', () => {
      const practitioner = { ...mockPractitioner, given_names: ['John'] };
      const fullName = PractitionerService.getFullName(practitioner);
      expect(fullName).toBe('Dr. John Smith MD, FACP');
    });

    it('should handle minimal name', () => {
      const practitioner: FHIRPractitioner = {
        id: 'test',
        fhir_id: 'Practitioner/test',
        active: true,
        family_name: 'Doe',
        given_names: ['Jane'],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      const fullName = PractitionerService.getFullName(practitioner);
      expect(fullName).toBe('Jane Doe');
    });
  });
});

// ============================================================================
// PRACTITIONER ROLE SERVICE TESTS
// ============================================================================

describe('PractitionerRoleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockRole: FHIRPractitionerRole = {
    id: 'role-123',
    fhir_id: 'PractitionerRole/role-123',
    practitioner_id: 'pract-123',
    organization_id: 'org-456',
    location_id: 'loc-789',
    active: true,
    code: ['doctor', 'attending'],
    code_display: ['Doctor', 'Attending Physician'],
    specialty: ['Family Medicine'],
    specialty_display: ['Family Medicine'],
    period_start: '2025-01-01T00:00:00Z',
    period_end: undefined,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  describe('getByPractitioner', () => {
    it('should fetch all roles for a practitioner', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [mockRole],
        error: null,
      });

      const result = await PractitionerRoleService.getByPractitioner('pract-123');

      expect(result).toEqual([mockRole]);
      expect(supabase.rpc).toHaveBeenCalledWith('get_practitioner_roles', {
        p_practitioner_id: 'pract-123',
      });
    });
  });

  describe('getActiveByPractitioner', () => {
    it('should fetch active roles for a practitioner', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({
          data: [mockRole],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await PractitionerRoleService.getActiveByPractitioner(
        'pract-123'
      );

      expect(result).toEqual([mockRole]);
      expect(mockQuery.eq).toHaveBeenCalledWith('practitioner_id', 'pract-123');
      expect(mockQuery.eq).toHaveBeenCalledWith('active', true);
    });
  });

  describe('create', () => {
    it('should create a new practitioner role', async () => {
      const newRole: Partial<FHIRPractitionerRole> = {
        practitioner_id: 'pract-123',
        organization_id: 'org-456',
        active: true,
        code: ['doctor'],
        specialty: ['Cardiology'],
      };

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'role-124', ...newRole },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await PractitionerRoleService.create(newRole);

      expect(result.id).toBe('role-124');
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...newRole,
          period_start: expect.any(String),
          created_at: expect.any(String),
          updated_at: expect.any(String),
        })
      );
    });
  });

  describe('update', () => {
    it('should update a practitioner role', async () => {
      const updates: Partial<FHIRPractitionerRole> = {
        specialty: ['Cardiology', 'Internal Medicine'],
      };

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockRole, ...updates },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await PractitionerRoleService.update('role-123', updates);

      expect(result.specialty).toEqual(['Cardiology', 'Internal Medicine']);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'role-123');
    });
  });

  describe('end', () => {
    it('should end a practitioner role by setting period_end', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await PractitionerRoleService.end('role-123');

      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          period_end: expect.any(String),
          active: false,
          updated_at: expect.any(String),
        })
      );
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'role-123');
    });
  });

  describe('delete', () => {
    it('should delete a practitioner role', async () => {
      const mockQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await PractitionerRoleService.delete('role-123');

      expect(mockQuery.delete).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'role-123');
    });
  });
});
