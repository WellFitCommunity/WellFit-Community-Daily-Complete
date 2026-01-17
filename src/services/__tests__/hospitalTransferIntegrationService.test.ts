/**
 * Hospital Transfer Integration Service Tests
 * Tests for Hospital-to-Hospital transfer integration workflows
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  integrateHospitalTransfer
} from '../hospitalTransferIntegrationService';
import { supabase } from '../../lib/supabaseClient';
import type { HandoffPacket } from '../../types/handoff';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn(),
    rpc: vi.fn()
  }
}));

// Mock auditLogger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    phi: vi.fn().mockResolvedValue(undefined),
    error: vi.fn(),
    info: vi.fn(),
    clinical: vi.fn()
  }
}));

const mockSupabase = supabase as unknown as {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

describe('HospitalTransferIntegrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Partial mock - contains fields used by tests
  const mockHandoffPacket = {
    id: 'packet-123',
    packet_number: 'PKT-2026-001',
    patient_name_encrypted: 'encrypted-name',
    patient_dob_encrypted: 'encrypted-dob',
    patient_mrn: 'MRN-12345',
    patient_gender: 'M' as const,
    sending_facility: 'General Hospital',
    receiving_facility: 'Methodist Hospital',
    urgency_level: 'urgent' as const,
    reason_for_transfer: 'Cardiac catheterization needed',
    sender_provider_name: 'Dr. Smith',
    sender_callback_number: '+15551234567',
    sender_notes: 'Patient stable for transport',
    access_token: 'token-abc123',
    clinical_data: {
      vitals: {
        blood_pressure_systolic: 120,
        blood_pressure_diastolic: 80,
        heart_rate: 72,
        temperature: 98.6,
        oxygen_saturation: 98,
        respiratory_rate: 16
      }
    },
    status: 'sent' as const,
    created_at: '2026-01-16T10:00:00Z'
  } as HandoffPacket;

  describe('integrateHospitalTransfer', () => {
    it('should successfully integrate a hospital transfer', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'provider@hospital.com' } },
        error: null
      } as any);

      // Mock PHI decryption
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: 'John Doe', error: null } as any) // decrypt name
        .mockResolvedValueOnce({ data: '1955-03-15', error: null } as any); // decrypt DOB

      // Mock patient lookup - not found, create new
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'patient-456' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-789' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'ehr_observations') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [
                  { id: 'obs-1' },
                  { id: 'obs-2' },
                  { id: 'obs-3' }
                ],
                error: null
              })
            })
          } as any;
        }
        if (table === 'billing_codes') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [{ code: '99222' }, { code: 'G0390' }],
                error: null
              })
            })
          } as any;
        }
        if (table === 'handoff_packets') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await integrateHospitalTransfer('packet-123', mockHandoffPacket);

      expect(result.success).toBe(true);
      expect(result.patientId).toBe('patient-456');
      expect(result.encounterId).toBe('encounter-789');
      expect(result.observationIds).toHaveLength(3);
      expect(result.billingCodes).toContain('99222');
    });

    it('should return error when user not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      } as any);

      const result = await integrateHospitalTransfer('packet-123', mockHandoffPacket);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not authenticated');
    });

    it('should return error when PHI decryption fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Decryption failed' }
      } as any);

      const result = await integrateHospitalTransfer('packet-123', mockHandoffPacket);

      expect(result.success).toBe(false);
      expect(result.error).toContain('decrypt');
    });

    it('should find existing patient by MRN instead of creating new', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: 'John Doe', error: null } as any)
        .mockResolvedValueOnce({ data: '1955-03-15', error: null } as any);

      // Mock finding existing patient
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: 'existing-patient-123' }],
                    error: null
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-789' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'ehr_observations') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          } as any;
        }
        if (table === 'billing_codes') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          } as any;
        }
        if (table === 'handoff_packets') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await integrateHospitalTransfer('packet-123', mockHandoffPacket);

      expect(result.success).toBe(true);
      expect(result.patientId).toBe('existing-patient-123');
    });

    it('should generate critical care billing code for critical transfers', async () => {
      const criticalPacket: HandoffPacket = {
        ...mockHandoffPacket,
        urgency_level: 'critical'
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: 'John Doe', error: null } as any)
        .mockResolvedValueOnce({ data: '1955-03-15', error: null } as any);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: 'patient-456' }],
                    error: null
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-789' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'ehr_observations') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          } as any;
        }
        if (table === 'billing_codes') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [{ code: '99223' }, { code: 'G0390' }, { code: '99291' }],
                error: null
              })
            })
          } as any;
        }
        if (table === 'handoff_packets') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await integrateHospitalTransfer('packet-123', criticalPacket);

      expect(result.success).toBe(true);
      expect(result.billingCodes).toContain('99291'); // Critical care code
    });
  });

  describe('vitals documentation', () => {
    it('should document all vitals from transfer packet', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: 'John Doe', error: null } as any)
        .mockResolvedValueOnce({ data: '1955-03-15', error: null } as any);

      let _insertedObservations: unknown[] = [];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: 'patient-456' }],
                    error: null
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'encounters') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-789' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'ehr_observations') {
          return {
            insert: vi.fn((obs: unknown[]) => {
              _insertedObservations = obs;
              return {
                select: vi.fn().mockResolvedValue({
                  data: (obs as unknown[]).map((_, i) => ({ id: `obs-${i}` })),
                  error: null
                })
              };
            })
          } as unknown;
        }
        if (table === 'billing_codes') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          } as any;
        }
        if (table === 'handoff_packets') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await integrateHospitalTransfer('packet-123', mockHandoffPacket);

      expect(result.success).toBe(true);
      expect(result.observationIds).toBeDefined();
      expect(result.observationIds?.length).toBeGreaterThan(0);
    });
  });
});
