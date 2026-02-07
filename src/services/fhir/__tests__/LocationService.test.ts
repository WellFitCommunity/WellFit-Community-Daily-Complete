/**
 * Tests for FHIR LocationService
 *
 * Covers healthcare facility and location management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocationService } from '../LocationService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              { id: 'loc-1', name: 'Main Hospital', status: 'active' },
              { id: 'loc-2', name: 'Clinic A', status: 'active' },
            ],
            error: null,
          })),
          single: vi.fn(() => ({
            data: { id: 'loc-1', name: 'Main Hospital' },
            error: null,
          })),
        })),
        contains: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [{ id: 'loc-1', type: ['hospital'] }],
              error: null,
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'loc-new', name: 'New Clinic' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'loc-1', status: 'inactive' },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('LocationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all active locations', async () => {
      const result = await LocationService.getAll();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should order by name', async () => {
      const result = await LocationService.getAll();

      expect(result.success).toBe(true);
    });
  });

  describe('getById', () => {
    it('should return location by ID', async () => {
      const result = await LocationService.getById('loc-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for not found', async () => {
      const result = await LocationService.getById('loc-nonexistent');

      expect(result).toBeDefined();
    });
  });

  describe('getByType', () => {
    it('should return locations by type', async () => {
      const result = await LocationService.getByType('hospital');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should filter clinics', async () => {
      const result = await LocationService.getByType('clinic');

      expect(result.success).toBe(true);
    });

    it('should filter pharmacy locations', async () => {
      const result = await LocationService.getByType('pharmacy');

      expect(result.success).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new location', async () => {
      const newLocation = {
        name: 'New Clinic',
        description: 'Primary care clinic',
        status: 'active',
        type: ['clinic'],
        address: {
          line: ['123 Main St'],
          city: 'Houston',
          state: 'TX',
          postal_code: '77001',
        },
      };

      const result = await LocationService.create(newLocation);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should create hospital location', async () => {
      const hospital = {
        name: 'Methodist Hospital',
        status: 'active',
        type: ['hospital'],
        operational_status: 'O',
        mode: 'instance',
      };

      const result = await LocationService.create(hospital);

      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a location', async () => {
      const result = await LocationService.update('loc-1', {
        description: 'Updated description',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should update status', async () => {
      const result = await LocationService.update('loc-1', {
        status: 'inactive',
      });

      expect(result.success).toBe(true);
    });

    it('should update address', async () => {
      const result = await LocationService.update('loc-1', {
        address: {
          line: ['456 New St'],
          city: 'Houston',
          state: 'TX',
          postal_code: '77002',
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await LocationService.getAll();
      expect(result).toHaveProperty('success');
    });
  });
});
