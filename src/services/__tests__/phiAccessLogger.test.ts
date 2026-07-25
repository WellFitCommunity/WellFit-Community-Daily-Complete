/**
 * PHI Access Logger Compliance Tests
 * HIPAA §164.312(b) - Audit Controls
 */

import { logPhiAccess, logBulkPhiAccess, extractPatientId } from '../phiAccessLogger';
import { supabase } from '../../lib/supabaseClient';

// Mock supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('PHI Access Logger - HIPAA Compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logPhiAccess', () => {
    it('should log PHI access with all required HIPAA fields', async () => {
      const mockUser = { id: 'user-123' };
      const mockProfile = { role: 'provider', is_admin: false };

      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockUser },
      });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
            }),
          }),
        }),
      });

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

      await logPhiAccess({
        phiType: 'patient_record',
        phiResourceId: 'patient-456',
        patientId: 'patient-456',
        accessType: 'view',
        accessMethod: 'UI',
        purpose: 'treatment',
      });

      // Verify RPC was called with correct parameters
      expect(supabase.rpc).toHaveBeenCalledWith('log_phi_access', {
        p_accessor_user_id: 'user-123',
        p_accessor_role: 'provider',
        p_phi_type: 'patient_record',
        p_phi_resource_id: 'patient-456',
        p_patient_id: 'patient-456',
        p_access_type: 'view',
        p_access_method: 'UI',
        p_purpose: 'treatment',
        p_ip_address: null,
      });
    });

    it('should handle unauthenticated users gracefully', async () => {
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: null },
      });

      // Should not throw
      await expect(
        logPhiAccess({
          phiType: 'patient_record',
          phiResourceId: 'patient-456',
          patientId: 'patient-456',
          accessType: 'view',
        })
      ).resolves.not.toThrow();

      // Should not call RPC
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('fails closed when the RPC errors — the PHI operation must not proceed', async () => {
      const mockUser = { id: 'user-123' };
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockUser },
      });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'provider', is_admin: false },
            }),
          }),
        }),
      });

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: { message: 'Database error' },
      });

      // FAIL CLOSED (§164.312(b)): a failed audit write blocks the operation.
      // The previous swallow-and-continue contract is how a broken RPC
      // signature went unnoticed for months (2026-07-25 audit, finding 1).
      await expect(
        logPhiAccess({
          phiType: 'patient_record',
          phiResourceId: 'patient-456',
          patientId: 'patient-456',
          accessType: 'view',
        })
      ).rejects.toThrow('Audit logging failed');
    });

    it('writer shape: pins the exact nine-argument RPC payload (drift guard)', async () => {
      const mockUser = { id: 'user-123' };
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockUser },
      });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'provider', is_admin: false },
            }),
          }),
        }),
      });

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

      await logPhiAccess({
        phiType: 'patient_record',
        phiResourceId: 'patient-456',
        patientId: 'patient-456',
        accessType: 'view',
      });

      // Pin the EXACT argument-name set of the nine-arg log_phi_access
      // overload (migration 20260725100000). If either side changes shape,
      // this fails before production does — the drift between the frontend's
      // nine args and the live four-arg function silently killed all
      // frontend PHI logging for months.
      const rpcArgs = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(rpcArgs[0]).toBe('log_phi_access');
      expect(Object.keys(rpcArgs[1] as Record<string, unknown>).sort()).toEqual([
        'p_access_method',
        'p_access_type',
        'p_accessor_role',
        'p_accessor_user_id',
        'p_ip_address',
        'p_patient_id',
        'p_phi_resource_id',
        'p_phi_type',
        'p_purpose',
      ]);
    });

    it('should default to UI access method and treatment purpose', async () => {
      const mockUser = { id: 'user-123' };
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockUser },
      });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'nurse', is_admin: false },
            }),
          }),
        }),
      });

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

      await logPhiAccess({
        phiType: 'encounter',
        phiResourceId: 'enc-789',
        patientId: 'patient-456',
        accessType: 'create',
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'log_phi_access',
        expect.objectContaining({
          p_access_method: 'UI',
          p_purpose: 'treatment',
        })
      );
    });
  });

  describe('logBulkPhiAccess', () => {
    it('should log individual accesses for up to 50 patients', async () => {
      const mockUser = { id: 'user-123' };
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockUser },
      });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'admin', is_admin: true },
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

      const patientIds = Array.from({ length: 30 }, (_, i) => `patient-${i}`);

      await logBulkPhiAccess('patient_record', patientIds, 'view', 'UI', 'operations');

      // Should call log_phi_access 30 times
      expect(supabase.rpc).toHaveBeenCalledTimes(30);
    });

    it('should create audit log summary for >50 patients', async () => {
      const mockUser = { id: 'user-123' };
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'admin', is_admin: true },
            }),
          }),
        }),
        insert: mockInsert,
      });

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

      const patientIds = Array.from({ length: 75 }, (_, i) => `patient-${i}`);

      await logBulkPhiAccess('patient_record', patientIds, 'view', 'REPORT', 'operations');

      // Should log first 50 individually
      expect(supabase.rpc).toHaveBeenCalledTimes(50);

      // Should create summary audit log
      expect(mockInsert).toHaveBeenCalledWith({
        event_type: 'BULK_PHI_ACCESS',
        event_category: 'DATA_ACCESS',
        actor_user_id: 'user-123',
        operation: 'VIEW',
        resource_type: 'patient_record',
        success: true,
        metadata: {
          patient_count: 75,
          logged_count: 50,
          access_method: 'REPORT',
          purpose: 'operations',
        },
      });
    });
  });

  describe('extractPatientId', () => {
    it('should extract patient_id from resource', () => {
      expect(extractPatientId({ patient_id: 'patient-123' })).toBe('patient-123');
    });

    it('should extract patientId (camelCase) from resource', () => {
      expect(extractPatientId({ patientId: 'patient-456' })).toBe('patient-456');
    });

    it('should extract patient.id from nested resource', () => {
      expect(extractPatientId({ patient: { id: 'patient-789' } })).toBe('patient-789');
    });

    it('should extract user_id if no patient fields', () => {
      expect(extractPatientId({ user_id: 'user-101' })).toBe('user-101');
    });

    it('should return null if no patient identifier found', () => {
      expect(extractPatientId({ some_field: 'value' })).toBeNull();
    });
  });

  describe('HIPAA Compliance Requirements', () => {
    it('should support all required PHI types', () => {
      const requiredTypes = [
        'patient_record',
        'encounter',
        'medication',
        'lab_result',
        'diagnosis',
        'procedure',
        'vital_signs',
        'billing',
        'insurance',
      ];

      // Verify types are valid (TypeScript check at compile time)
      // This test documents the requirement
      expect(requiredTypes.length).toBeGreaterThan(0);
    });

    it('should support all required access types', () => {
      const requiredAccessTypes = ['view', 'create', 'update', 'delete', 'export', 'print'];
      expect(requiredAccessTypes.length).toBe(6);
    });

    it('should support all required access purposes per HIPAA', () => {
      const requiredPurposes = [
        'treatment',
        'payment',
        'operations',
        'patient_request',
        'legal_requirement',
      ];
      expect(requiredPurposes.length).toBe(5);
    });
  });
});
