/**
 * Patient Service Tests
 *
 * Tests for enterprise-grade patient data access service:
 * - Pagination with PAGINATION_LIMITS.PATIENTS (50)
 * - ServiceResult pattern for error handling
 * - HIPAA-compliant PHI access audit logging
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type { Patient, HospitalPatient, PatientWithRisk } from '../patientService';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
  }));

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Mock audit logger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
};

const mockAuditLogger = auditLogger as unknown as {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  phi: ReturnType<typeof vi.fn>;
};

describe('PatientService', () => {
  let patientService: typeof import('../patientService').patientService;

  const mockPatients = [
    {
      user_id: 'patient-001',
      first_name: 'John',
      last_name: 'Doe',
      phone: '555-0101',
      dob: '1950-01-15',
      role_code: 4,
      tenant_id: 'WF-0001',
      enrollment_type: 'app',
      created_at: '2024-01-15T10:00:00Z',
    },
    {
      user_id: 'patient-002',
      first_name: 'Jane',
      last_name: 'Smith',
      phone: '555-0102',
      dob: '1945-06-20',
      role_code: 4,
      tenant_id: 'WF-0001',
      enrollment_type: 'app',
      created_at: '2024-01-14T10:00:00Z',
    },
  ];

  const mockHospitalPatients = [
    {
      user_id: 'patient-h001',
      first_name: 'Robert',
      last_name: 'Johnson',
      mrn: 'MRN-12345',
      hospital_unit: 'unit-1',
      room_number: '201',
      bed_number: 'A',
      acuity_level: 2,
      enrollment_type: 'hospital',
      admission_date: '2024-01-10T08:00:00Z',
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    // Re-import to get fresh instance
    vi.resetModules();
    const module = await import('../patientService');
    patientService = module.patientService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // getPatients() Tests
  // ===========================================================================

  describe('getPatients', () => {
    it('should return paginated list of patients', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatients();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(2);
        expect(result.data.data[0].first_name).toBe('John');
      }
    });

    it('should filter by patient role codes (1, 4, 19)', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatients();

      expect(mockQuery.in).toHaveBeenCalledWith('role_code', [1, 4, 19]);
    });

    it('should log patient list access', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatients();

      expect(mockAuditLogger.info).toHaveBeenCalledWith(
        'PATIENT_LIST_ACCESSED',
        expect.objectContaining({
          page: 1,
          resultCount: 2,
        })
      );
    });

    it('should handle pagination options', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [mockPatients[1]],
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatients({ page: 2, pageSize: 1 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(1);
      }
    });

    it('should handle database errors', async () => {
      // applyPagination first calls select for count, then range for data
      // Simulating error from the count query
      const mockQuery = {
        select: vi.fn().mockResolvedValue({
          count: null,
          error: { message: 'Connection failed' },
        }),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Connection failed' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatients();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });

    it('should log errors on failure', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockRejectedValue(new Error('Query failed')),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatients();

      expect(mockAuditLogger.error).toHaveBeenCalledWith(
        'PATIENT_LIST_ERROR',
        expect.any(Error)
      );
    });
  });

  // ===========================================================================
  // getPatientById() Tests
  // ===========================================================================

  describe('getPatientById', () => {
    it('should return patient by ID', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockPatients[0],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatientById('patient-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.user_id).toBe('patient-001');
        expect(result.data?.first_name).toBe('John');
      }
    });

    it('should log PHI access with patient ID', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockPatients[0],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientById('patient-001');

      expect(mockAuditLogger.phi).toHaveBeenCalledWith(
        'READ',
        'patient-001',
        expect.objectContaining({ resourceType: 'patient' })
      );
    });

    it('should return null for non-existent patient', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatientById('non-existent');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('should handle database errors', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'CONNECTION_ERROR', message: 'Database unavailable' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatientById('patient-001');

      expect(result.success).toBe(false);
    });

    it('should log errors with patient ID context', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockRejectedValue(new Error('Query failed')),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientById('patient-001');

      expect(mockAuditLogger.error).toHaveBeenCalledWith(
        'PATIENT_FETCH_ERROR',
        expect.any(Error),
        { userId: 'patient-001' }
      );
    });
  });

  // ===========================================================================
  // searchPatients() Tests
  // ===========================================================================

  describe('searchPatients', () => {
    it('should search patients by name', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [mockPatients[0]],
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.searchPatients('John');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(1);
        expect(result.data.data[0].first_name).toBe('John');
      }
    });

    it('should reject search terms less than 2 characters', async () => {
      const result = await patientService.searchPatients('J');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toContain('at least 2 characters');
      }
    });

    it('should reject empty search terms', async () => {
      const result = await patientService.searchPatients('');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should search by phone number', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [mockPatients[0]],
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.searchPatients('555-0101');

      expect(mockQuery.or).toHaveBeenCalledWith(
        expect.stringContaining('phone.ilike.%555-0101%')
      );
    });

    it('should log search without PHI', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.searchPatients('doe');

      expect(mockAuditLogger.info).toHaveBeenCalledWith(
        'PATIENT_SEARCH_PERFORMED',
        expect.objectContaining({
          searchTermLength: 3,
          resultCount: 2,
        })
      );
    });

    it('should trim and lowercase search terms', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.searchPatients('  JOHN  ');

      expect(mockQuery.or).toHaveBeenCalledWith(
        expect.stringContaining('john')
      );
    });
  });

  // ===========================================================================
  // getPatientsByUnit() Tests
  // ===========================================================================

  describe('getPatientsByUnit', () => {
    it('should return patients for a hospital unit', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockHospitalPatients,
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatientsByUnit('unit-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(1);
        expect(result.data.data[0].hospital_unit).toBe('unit-1');
      }
    });

    it('should filter by hospital enrollment type', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockHospitalPatients,
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientsByUnit('unit-1');

      // eq should be called with both unit and enrollment type
      expect(mockQuery.eq).toHaveBeenCalledWith('hospital_unit', 'unit-1');
      expect(mockQuery.eq).toHaveBeenCalledWith('enrollment_type', 'hospital');
    });

    it('should order by room number', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockHospitalPatients,
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientsByUnit('unit-1');

      expect(mockQuery.order).toHaveBeenCalledWith('room_number', { ascending: true });
    });

    it('should log unit access with unit ID', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockHospitalPatients,
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientsByUnit('unit-1');

      expect(mockAuditLogger.info).toHaveBeenCalledWith(
        'UNIT_PATIENT_LIST_ACCESSED',
        expect.objectContaining({
          unitId: 'unit-1',
          resultCount: 1,
        })
      );
    });
  });

  // ===========================================================================
  // getPatientsByRisk() Tests
  // ===========================================================================

  describe('getPatientsByRisk', () => {
    const mockRiskPatients = [
      {
        patient_id: 'patient-001',
        risk_level: 'high',
        risk_score: 85,
        last_assessment_date: '2024-01-15',
        profiles: mockPatients[0],
      },
    ];

    it('should return patients by risk level', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockRiskPatients,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatientsByRisk('high');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].risk_level).toBe('high');
      }
    });

    it('should query patient_risk_registry table', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockRiskPatients,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientsByRisk('high');

      expect(mockSupabase.from).toHaveBeenCalledWith('patient_risk_registry');
    });

    it('should order by risk score descending', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockRiskPatients,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientsByRisk('critical');

      expect(mockQuery.order).toHaveBeenCalledWith('risk_score', { ascending: false });
    });

    it('should fallback to empty array if registry not available', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST200', message: 'relationship not found' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatientsByRisk('high');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('should apply limit to results', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockRiskPatients,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientsByRisk('high', 10);

      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should log risk patient list access', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockRiskPatients,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientsByRisk('high');

      expect(mockAuditLogger.info).toHaveBeenCalledWith(
        'RISK_PATIENT_LIST_ACCESSED',
        expect.objectContaining({
          riskLevel: 'high',
        })
      );
    });
  });

  // ===========================================================================
  // getHospitalPatients() Tests
  // ===========================================================================

  describe('getHospitalPatients', () => {
    it('should return hospital-enrolled patients', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockHospitalPatients,
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getHospitalPatients();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data[0].enrollment_type).toBe('hospital');
      }
    });

    it('should filter by hospital enrollment type', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockHospitalPatients,
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getHospitalPatients();

      expect(mockQuery.eq).toHaveBeenCalledWith('enrollment_type', 'hospital');
    });

    it('should order by admission date descending', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockHospitalPatients,
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getHospitalPatients();

      expect(mockQuery.order).toHaveBeenCalledWith('admission_date', { ascending: false });
    });
  });

  // ===========================================================================
  // getAppPatients() Tests
  // ===========================================================================

  describe('getAppPatients', () => {
    it('should return app-enrolled patients (seniors/community)', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getAppPatients();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(2);
      }
    });

    it('should filter by app enrollment and senior/patient roles', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getAppPatients();

      expect(mockQuery.eq).toHaveBeenCalledWith('enrollment_type', 'app');
      expect(mockQuery.in).toHaveBeenCalledWith('role_code', [4, 19]);
    });
  });

  // ===========================================================================
  // getPatientsByTenant() Tests
  // ===========================================================================

  describe('getPatientsByTenant', () => {
    it('should return patients for a specific tenant', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatientsByTenant('WF-0001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(2);
      }
    });

    it('should filter by tenant ID', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientsByTenant('WF-0001');

      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', 'WF-0001');
    });

    it('should log tenant access with tenant ID', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientsByTenant('WF-0001');

      expect(mockAuditLogger.info).toHaveBeenCalledWith(
        'TENANT_PATIENT_LIST_ACCESSED',
        expect.objectContaining({
          tenantId: 'WF-0001',
        })
      );
    });
  });

  // ===========================================================================
  // getFilteredPatients() Tests
  // ===========================================================================

  describe('getFilteredPatients', () => {
    it('should apply search filter', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [mockPatients[0]],
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getFilteredPatients({ search: 'John' });

      expect(result.success).toBe(true);
      expect(mockQuery.or).toHaveBeenCalled();
    });

    it('should apply role code filter', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getFilteredPatients({ roleCode: 4 });

      expect(mockQuery.eq).toHaveBeenCalledWith('role_code', 4);
    });

    it('should apply enrollment type filter', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getFilteredPatients({ enrollmentType: 'app' });

      expect(mockQuery.eq).toHaveBeenCalledWith('enrollment_type', 'app');
    });

    it('should apply tenant filter', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getFilteredPatients({ tenantId: 'WF-0001' });

      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', 'WF-0001');
    });

    it('should apply unit filter', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockHospitalPatients,
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getFilteredPatients({ unitId: 'unit-1' });

      expect(mockQuery.eq).toHaveBeenCalledWith('hospital_unit', 'unit-1');
    });

    it('should apply multiple filters together', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [mockPatients[0]],
          error: null,
          count: 1,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getFilteredPatients({
        search: 'John',
        enrollmentType: 'app',
        tenantId: 'WF-0001',
      });

      expect(mockQuery.or).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('enrollment_type', 'app');
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', 'WF-0001');
    });

    it('should log filter usage', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null,
          count: 2,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getFilteredPatients({
        search: 'test',
        roleCode: 4,
        enrollmentType: 'app',
        tenantId: 'WF-0001',
      });

      expect(mockAuditLogger.info).toHaveBeenCalledWith(
        'FILTERED_PATIENT_LIST_ACCESSED',
        expect.objectContaining({
          hasSearch: true,
          hasRoleFilter: true,
          hasEnrollmentFilter: true,
          hasTenantFilter: true,
        })
      );
    });
  });

  // ===========================================================================
  // getRecentPatients() Tests
  // ===========================================================================

  describe('getRecentPatients', () => {
    it('should return patients from last 7 days', async () => {
      // The applyLimit utility uses .range() not .limit()
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockPatients, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getRecentPatients();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it('should filter by created_at >= 7 days ago', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockPatients, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getRecentPatients();

      expect(mockQuery.gte).toHaveBeenCalledWith(
        'created_at',
        expect.any(String)
      );
    });

    it('should order by created_at descending', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockPatients, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getRecentPatients();

      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should apply limit to query', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [mockPatients[0]], error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getRecentPatients(10);

      // Verify range was called (applyLimit uses the range method)
      expect(mockQuery.range).toHaveBeenCalledWith(0, 9);
    });
  });

  // ===========================================================================
  // getPatientCount() Tests
  // ===========================================================================

  describe('getPatientCount', () => {
    it('should return total patient count', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          count: 150,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatientCount();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(150);
      }
    });

    it('should filter count by tenant ID', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          count: 50,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatientCount('WF-0001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(50);
      }
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', 'WF-0001');
    });

    it('should return 0 for null count', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          count: null,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatientCount();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0);
      }
    });

    it('should use exact count mode', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          count: 100,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await patientService.getPatientCount();

      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    });

    it('should handle database errors', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          count: null,
          error: { message: 'Count failed', code: 'DB_ERROR' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await patientService.getPatientCount();

      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // Type Definitions Tests
  // ===========================================================================

  describe('Type Definitions', () => {
    it('should export Patient interface correctly', async () => {
      // Type check - Patient interface should have expected properties
      const patient: Patient = {
        user_id: 'test',
        first_name: null,
        last_name: null,
        phone: null,
        dob: null,
        address: null,
        city: null,
        state: null,
        zip: null,
        gender: null,
        role_code: null,
        is_admin: false,
        tenant_id: null,
        created_at: null,
        enrollment_type: null,
      };

      expect(patient.user_id).toBe('test');
    });

    it('should export HospitalPatient interface with extended fields', async () => {
      const hospitalPatient: HospitalPatient = {
        user_id: 'test',
        first_name: null,
        last_name: null,
        phone: null,
        dob: null,
        address: null,
        city: null,
        state: null,
        zip: null,
        gender: null,
        role_code: null,
        is_admin: false,
        tenant_id: null,
        created_at: null,
        enrollment_type: 'hospital',
        mrn: 'MRN-123',
        hospital_unit: 'unit-1',
        room_number: '201',
        bed_number: 'A',
        acuity_level: 2,
        code_status: 'Full Code',
        admission_date: null,
        attending_physician_id: null,
      };

      expect(hospitalPatient.mrn).toBe('MRN-123');
    });

    it('should export PatientWithRisk interface', async () => {
      const riskPatient: PatientWithRisk = {
        user_id: 'test',
        first_name: null,
        last_name: null,
        phone: null,
        dob: null,
        address: null,
        city: null,
        state: null,
        zip: null,
        gender: null,
        role_code: null,
        is_admin: false,
        tenant_id: null,
        created_at: null,
        enrollment_type: null,
        risk_level: 'high',
        risk_score: 85,
        last_assessment_date: '2024-01-15',
      };

      expect(riskPatient.risk_level).toBe('high');
    });
  });

  // ===========================================================================
  // Class Export Tests
  // ===========================================================================

  describe('Class Export', () => {
    it('should export PatientService class for testing', async () => {
      const module = await import('../patientService');

      expect(module.PatientService).toBeDefined();
      expect(typeof module.PatientService).toBe('function');
    });

    it('should export singleton instance', async () => {
      const module = await import('../patientService');

      expect(module.patientService).toBeDefined();
      expect(typeof module.patientService.getPatients).toBe('function');
      expect(typeof module.patientService.getPatientById).toBe('function');
    });
  });
});
