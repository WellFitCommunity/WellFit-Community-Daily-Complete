/**
 * PHI Logging Integration Tests
 * Verifies end-to-end PHI access logging across services
 * HIPAA §164.312(b) - Audit Controls Compliance
 */

import { EncounterService } from '../encounterService';
import { SDOHBillingService } from '../sdohBillingService';
import { supabase } from '../../lib/supabaseClient';

// Mock supabase for integration tests
vi.mock('../../lib/supabaseClient');

describe('PHI Logging Integration Tests', () => {
  const mockUser = { id: 'provider-123' };
  const mockProfile = { role: 'provider', is_admin: false };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup auth mock
    (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: mockUser },
    });

    // Setup profile lookup mock
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProfile }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'enc-123', patient_id: 'patient-456' },
            }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'enc-123', patient_id: 'patient-456' },
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'enc-123', patient_id: 'patient-456' },
              }),
            }),
          }),
        }),
      };
    });

    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
  });

  describe('EncounterService PHI Logging', () => {
    it('should log PHI access when creating an encounter', async () => {
      const encounterData = {
        patient_id: 'patient-456',
        provider_id: 'provider-123',
        payer_id: 'payer-001',
        date_of_service: '2025-10-23',
        place_of_service: '11',
      };

      await EncounterService.createEncounter(encounterData);

      // Verify log_phi_access was called
      expect(supabase.rpc).toHaveBeenCalledWith(
        'log_phi_access',
        expect.objectContaining({
          p_accessor_user_id: 'provider-123',
          p_phi_type: 'encounter',
          p_patient_id: 'patient-456',
          p_access_type: 'create',
          p_purpose: 'treatment',
        })
      );
    });

    it('should log PHI access when viewing an encounter', async () => {
      await EncounterService.getEncounter('enc-123');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'log_phi_access',
        expect.objectContaining({
          p_phi_type: 'encounter',
          p_phi_resource_id: 'enc-123',
          p_patient_id: 'patient-456',
          p_access_type: 'view',
        })
      );
    });

    it('should log PHI access when updating an encounter', async () => {
      await EncounterService.updateEncounter('enc-123', {});

      expect(supabase.rpc).toHaveBeenCalledWith(
        'log_phi_access',
        expect.objectContaining({
          p_phi_type: 'encounter',
          p_phi_resource_id: 'enc-123',
          p_patient_id: 'patient-456',
          p_access_type: 'update',
        })
      );
    });

    it('should log PHI access when viewing patient encounters', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProfile }),
              }),
            }),
          };
        }
        // encounters table
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: 'enc-1', patient_id: 'patient-456' },
                  { id: 'enc-2', patient_id: 'patient-456' },
                ],
                error: null,
              }),
            }),
          }),
        };
      });

      await EncounterService.getEncountersByPatient('patient-456');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'log_phi_access',
        expect.objectContaining({
          p_phi_type: 'encounter',
          p_patient_id: 'patient-456',
          p_access_type: 'view',
        })
      );
    });
  });

  describe('SDOHBillingService PHI Logging', () => {
    it('should log PHI access when assessing SDOH complexity', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProfile }),
              }),
            }),
          };
        }
        if (table === 'check_ins') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'sdoh_assessments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'assessment-123', patient_id: 'patient-789' },
                  error: null
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      await SDOHBillingService.assessSDOHComplexity('patient-789');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'log_phi_access',
        expect.objectContaining({
          p_phi_type: 'assessment',
          p_phi_resource_id: 'sdoh_patient-789',
          p_patient_id: 'patient-789',
          p_access_type: 'view',
          p_purpose: 'treatment',
        })
      );
    });
  });

  describe('PHI Logging Error Handling', () => {
    it('should continue operation if PHI logging fails', async () => {
      // Make log_phi_access fail
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: { message: 'Logging failed' },
      });

      // Should still create encounter successfully
      const encounterData = {
        patient_id: 'patient-456',
        provider_id: 'provider-123',
        payer_id: 'payer-001',
        date_of_service: '2025-10-23',
        place_of_service: '11',
      };

      await expect(
        EncounterService.createEncounter(encounterData)
      ).resolves.not.toThrow();
    });

    it('should handle missing user gracefully', async () => {
      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: null },
      });

      const encounterData = {
        patient_id: 'patient-456',
        provider_id: 'provider-123',
        payer_id: 'payer-001',
        date_of_service: '2025-10-23',
        place_of_service: '11',
      };

      // Should still work without user
      await expect(
        EncounterService.createEncounter(encounterData)
      ).resolves.not.toThrow();

      // Should not call log_phi_access
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('HIPAA Audit Trail Requirements', () => {
    it('should log all required HIPAA audit fields', async () => {
      await EncounterService.getEncounter('enc-123');

      expect(supabase.rpc).toHaveBeenCalledWith('log_phi_access', {
        p_accessor_user_id: expect.any(String), // Who accessed
        p_accessor_role: expect.any(String), // User role
        p_phi_type: expect.any(String), // Type of PHI
        p_phi_resource_id: expect.any(String), // What was accessed
        p_patient_id: expect.any(String), // Patient identifier
        p_access_type: expect.any(String), // View/Create/Update/Delete
        p_access_method: expect.any(String), // UI/API/etc
        p_purpose: expect.any(String), // Treatment/Payment/Operations
        p_ip_address: null, // IP (null for frontend)
      });
    });

    it('should support patient self-access logging', async () => {
      const patientUser = { id: 'patient-456' };
      const patientProfile = { role: 'patient', is_admin: false };

      (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: patientUser },
      });

      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: patientProfile }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'enc-123', patient_id: 'patient-456' },
              }),
            }),
          }),
        };
      });

      await EncounterService.getEncounter('enc-123');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'log_phi_access',
        expect.objectContaining({
          p_accessor_user_id: 'patient-456',
          p_accessor_role: 'patient',
          p_purpose: 'treatment',
        })
      );
    });
  });
});
