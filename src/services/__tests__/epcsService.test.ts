/**
 * EPCS Service Tests
 *
 * ONC Criteria: 170.315(b)(3) - Electronic Prescribing
 * Tests for DEA-compliant controlled substance prescribing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing service
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
            })),
          })),
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
          })),
        })),
      })),
    })),
  },
}));

// Mock auditLogger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  validateDEANumber,
  getProviderRegistration,
  verifyProviderAuthorization,
  createPrescription,
  getPrescription,
  getPatientPrescriptions,
  signPrescription,
  cancelPrescription,
  getEPCSStats,
  type CreatePrescriptionInput,
} from '../epcsService';
import { supabase } from '../../lib/supabaseClient';

describe('EPCSService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateDEANumber', () => {
    it('should validate correct DEA numbers', () => {
      // Format: 2 letters + 7 digits
      // First letter: Registrant type
      // Last digit: Checksum
      expect(validateDEANumber('AB1234563')).toBe(true); // Valid checksum
      expect(validateDEANumber('BM1234563')).toBe(true);
    });

    it('should reject invalid DEA number formats', () => {
      expect(validateDEANumber('123456789')).toBe(false); // No letters
      expect(validateDEANumber('ABC123456')).toBe(false); // 3 letters
      expect(validateDEANumber('AB123456')).toBe(false); // Too short
      expect(validateDEANumber('')).toBe(false);
    });

    it('should reject invalid first letter', () => {
      // First letter must be one of: A,B,C,D,E,F,G,H,J,K,L,M,P,R,S,T,U,X
      expect(validateDEANumber('ZB1234563')).toBe(false); // Z not valid
      expect(validateDEANumber('IB1234563')).toBe(false); // I not valid
      expect(validateDEANumber('OB1234563')).toBe(false); // O not valid
    });

    it('should reject invalid checksums', () => {
      // AB1234560 would have wrong checksum
      expect(validateDEANumber('AB1234560')).toBe(false);
      expect(validateDEANumber('AB1234561')).toBe(false);
      expect(validateDEANumber('AB1234562')).toBe(false);
    });
  });

  describe('getProviderRegistration', () => {
    it('should fetch active provider registration', async () => {
      const mockRegistration = {
        id: 'reg-123',
        tenant_id: 'tenant-123',
        provider_id: 'provider-456',
        dea_number: 'AB1234563',
        dea_expiration_date: '2027-12-31',
        dea_schedules: [2, 3, 4, 5],
        state_license_number: 'TX123456',
        state_license_state: 'TX',
        state_license_expiration: '2027-06-30',
        identity_proofing_method: 'in_person',
        identity_proofed_date: '2025-01-15',
        tfa_method: 'hard_token',
        tfa_device_serial: 'HT123456',
        tfa_enrollment_date: '2025-01-15',
        status: 'active',
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRegistration, error: null }),
              }),
            }),
          }),
        }),
      } as never);

      const result = await getProviderRegistration('tenant-123', 'provider-456');

      expect(result.success).toBe(true);
      expect(result.data?.deaNumber).toBe('AB1234563');
      expect(result.data?.status).toBe('active');
    });

    it('should return null for non-existent registration', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
          }),
        }),
      } as never);

      const result = await getProviderRegistration('tenant-123', 'unknown-provider');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('verifyProviderAuthorization', () => {
    it('should verify provider is authorized for schedule', async () => {
      const mockRegistration = {
        id: 'reg-123',
        tenant_id: 'tenant-123',
        provider_id: 'provider-456',
        dea_number: 'AB1234563',
        dea_expiration_date: '2027-12-31',
        dea_schedules: [2, 3, 4, 5],
        state_license_number: 'TX123456',
        state_license_state: 'TX',
        state_license_expiration: '2027-06-30',
        identity_proofing_method: 'in_person',
        identity_proofed_date: '2025-01-15',
        tfa_method: 'hard_token',
        tfa_enrollment_date: '2025-01-15',
        status: 'active',
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRegistration, error: null }),
              }),
            }),
          }),
        }),
      } as never);

      const result = await verifyProviderAuthorization('tenant-123', 'provider-456', 2);

      expect(result.success).toBe(true);
      expect(result.data?.authorized).toBe(true);
    });

    it('should deny authorization for unregistered provider', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
          }),
        }),
      } as never);

      const result = await verifyProviderAuthorization('tenant-123', 'unknown', 2);

      expect(result.success).toBe(true);
      expect(result.data?.authorized).toBe(false);
      expect(result.data?.reason).toContain('not registered');
    });
  });

  describe('createPrescription', () => {
    const mockInput: CreatePrescriptionInput = {
      patientId: 'patient-789',
      prescriberId: 'provider-456',
      medicationName: 'Oxycodone 5mg',
      deaSchedule: 2,
      quantity: 30,
      quantityUnit: 'tablets',
      daysSupply: 30,
      sig: 'Take 1 tablet by mouth every 6 hours as needed for pain',
      route: 'oral',
      diagnosisCode: 'M54.5',
      diagnosisDescription: 'Low back pain',
    };

    it('should create a draft prescription', async () => {
      const mockRegistration = {
        id: 'reg-123',
        tenant_id: 'tenant-123',
        provider_id: 'provider-456',
        dea_number: 'AB1234563',
        dea_expiration_date: '2027-12-31',
        dea_schedules: [2, 3, 4, 5],
        state_license_number: 'TX123456',
        state_license_state: 'TX',
        state_license_expiration: '2027-06-30',
        identity_proofing_method: 'in_person',
        identity_proofed_date: '2025-01-15',
        tfa_method: 'hard_token',
        tfa_enrollment_date: '2025-01-15',
        status: 'active',
      };

      // Mock authorization check
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRegistration, error: null }),
              }),
            }),
          }),
        }),
      } as never);

      // Mock prescription insert
      const mockPrescription = {
        id: 'rx-123',
        tenant_id: 'tenant-123',
        prescription_number: 'RX12345ABC',
        dea_unique_id: 'AB1234563-20260122-000001',
        patient_id: 'patient-789',
        prescriber_id: 'provider-456',
        prescriber_registration_id: 'reg-123',
        medication_name: 'Oxycodone 5mg',
        dea_schedule: 2,
        quantity: 30,
        quantity_unit: 'tablets',
        days_supply: 30,
        refills_authorized: 0,
        refills_remaining: 0,
        sig: mockInput.sig,
        status: 'draft',
        transmission_status: 'pending_signature',
        digital_signature_verified: false,
        pdmp_checked: false,
        partial_fill_allowed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockPrescription, error: null }),
          }),
        }),
      } as never);

      // Mock audit log
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as never);

      const result = await createPrescription('tenant-123', mockInput);

      expect(result.success).toBe(true);
      expect(result.data?.medicationName).toBe('Oxycodone 5mg');
      expect(result.data?.deaSchedule).toBe(2);
      expect(result.data?.refillsAuthorized).toBe(0); // Schedule II can't have refills
      expect(result.data?.status).toBe('draft');
    });

    it('should enforce no refills for Schedule II', async () => {
      // Schedule II medications cannot have refills per DEA regulation
      const inputWithRefills = { ...mockInput, refillsAuthorized: 5 };

      const mockRegistration = {
        id: 'reg-123',
        tenant_id: 'tenant-123',
        provider_id: 'provider-456',
        dea_number: 'AB1234563',
        dea_expiration_date: '2027-12-31',
        dea_schedules: [2, 3, 4, 5],
        state_license_number: 'TX123456',
        state_license_state: 'TX',
        state_license_expiration: '2027-06-30',
        identity_proofing_method: 'in_person',
        identity_proofed_date: '2025-01-15',
        tfa_method: 'hard_token',
        tfa_enrollment_date: '2025-01-15',
        status: 'active',
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRegistration, error: null }),
              }),
            }),
          }),
        }),
      } as never);

      const mockPrescription = {
        id: 'rx-123',
        tenant_id: 'tenant-123',
        prescription_number: 'RX12345ABC',
        dea_unique_id: 'AB1234563-20260122-000001',
        patient_id: 'patient-789',
        prescriber_id: 'provider-456',
        prescriber_registration_id: 'reg-123',
        medication_name: 'Oxycodone 5mg',
        dea_schedule: 2,
        quantity: 30,
        quantity_unit: 'tablets',
        days_supply: 30,
        refills_authorized: 0, // Should be 0 for Schedule II
        refills_remaining: 0,
        sig: inputWithRefills.sig,
        status: 'draft',
        transmission_status: 'pending_signature',
        digital_signature_verified: false,
        pdmp_checked: false,
        partial_fill_allowed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockPrescription, error: null }),
          }),
        }),
      } as never);

      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as never);

      const result = await createPrescription('tenant-123', inputWithRefills);

      expect(result.success).toBe(true);
      expect(result.data?.refillsAuthorized).toBe(0);
    });
  });

  describe('signPrescription', () => {
    it('should require PDMP check before signing', async () => {
      const mockPrescription = {
        id: 'rx-123',
        tenant_id: 'tenant-123',
        prescription_number: 'RX12345',
        dea_unique_id: 'AB1234563-20260122-000001',
        patient_id: 'patient-789',
        prescriber_id: 'provider-456',
        prescriber_registration_id: 'reg-123',
        medication_name: 'Oxycodone 5mg',
        dea_schedule: 2,
        quantity: 30,
        quantity_unit: 'tablets',
        days_supply: 30,
        refills_authorized: 0,
        refills_remaining: 0,
        sig: 'Take as directed',
        status: 'pending_signature',
        transmission_status: 'pending_signature',
        digital_signature_verified: false,
        pdmp_checked: false, // Not checked
        partial_fill_allowed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockPrescription, error: null }),
            }),
          }),
        }),
      } as never);

      const result = await signPrescription('tenant-123', {
        prescriptionId: 'rx-123',
        userId: 'provider-456',
        tfaMethod: 'hard_token',
        tfaToken: '123456',
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('PDMP check required');
    });
  });

  describe('cancelPrescription', () => {
    it('should cancel a prescription', async () => {
      const mockPrescription = {
        id: 'rx-123',
        tenant_id: 'tenant-123',
        prescription_number: 'RX12345',
        dea_unique_id: 'AB1234563-20260122-000001',
        patient_id: 'patient-789',
        prescriber_id: 'provider-456',
        prescriber_registration_id: 'reg-123',
        medication_name: 'Oxycodone 5mg',
        dea_schedule: 2,
        quantity: 30,
        quantity_unit: 'tablets',
        days_supply: 30,
        refills_authorized: 0,
        refills_remaining: 0,
        sig: 'Take as directed',
        status: 'signed',
        transmission_status: 'signed',
        digital_signature_verified: true,
        pdmp_checked: true,
        partial_fill_allowed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock getPrescription
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockPrescription, error: null }),
            }),
          }),
        }),
      } as never);

      // Mock update
      const cancelledPrescription = {
        ...mockPrescription,
        status: 'cancelled',
        transmission_status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: 'Patient changed medication',
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: cancelledPrescription, error: null }),
              }),
            }),
          }),
        }),
      } as never);

      // Mock audit log
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as never);

      const result = await cancelPrescription(
        'tenant-123',
        'rx-123',
        'provider-456',
        'Patient changed medication'
      );

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('cancelled');
    });

    it('should not cancel already filled prescriptions', async () => {
      const filledPrescription = {
        id: 'rx-123',
        tenant_id: 'tenant-123',
        prescription_number: 'RX12345',
        dea_unique_id: 'AB1234563-20260122-000001',
        patient_id: 'patient-789',
        prescriber_id: 'provider-456',
        prescriber_registration_id: 'reg-123',
        medication_name: 'Oxycodone 5mg',
        dea_schedule: 2,
        quantity: 30,
        quantity_unit: 'tablets',
        days_supply: 30,
        refills_authorized: 0,
        refills_remaining: 0,
        sig: 'Take as directed',
        status: 'filled', // Already filled
        transmission_status: 'acknowledged',
        digital_signature_verified: true,
        pdmp_checked: true,
        partial_fill_allowed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: filledPrescription, error: null }),
            }),
          }),
        }),
      } as never);

      const result = await cancelPrescription(
        'tenant-123',
        'rx-123',
        'provider-456',
        'Patient request'
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Cannot cancel a filled prescription');
    });
  });

  describe('getPatientPrescriptions', () => {
    it('should fetch patient prescriptions', async () => {
      const mockPrescriptions = [
        {
          id: 'rx-1',
          tenant_id: 'tenant-123',
          prescription_number: 'RX001',
          dea_unique_id: 'AB1234563-20260122-000001',
          patient_id: 'patient-789',
          prescriber_id: 'provider-456',
          prescriber_registration_id: 'reg-123',
          medication_name: 'Oxycodone 5mg',
          dea_schedule: 2,
          quantity: 30,
          quantity_unit: 'tablets',
          days_supply: 30,
          refills_authorized: 0,
          refills_remaining: 0,
          sig: 'Take as directed',
          status: 'signed',
          transmission_status: 'signed',
          digital_signature_verified: true,
          pdmp_checked: true,
          partial_fill_allowed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockPrescriptions, error: null }),
            }),
          }),
        }),
      } as never);

      const result = await getPatientPrescriptions('tenant-123', 'patient-789');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].deaSchedule).toBe(2);
    });
  });

  describe('getEPCSStats', () => {
    it('should calculate EPCS statistics', async () => {
      const mockPrescriptions = [
        { dea_schedule: 2, status: 'signed' },
        { dea_schedule: 2, status: 'filled' },
        { dea_schedule: 3, status: 'signed' },
        { dea_schedule: 4, status: 'cancelled' },
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockPrescriptions, error: null }),
        }),
      } as never);

      const result = await getEPCSStats('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.totalPrescriptions).toBe(4);
      expect(result.data?.bySchedule[2]).toBe(2);
      expect(result.data?.bySchedule[3]).toBe(1);
      expect(result.data?.bySchedule[4]).toBe(1);
      expect(result.data?.cancelledCount).toBe(1);
    });
  });
});
