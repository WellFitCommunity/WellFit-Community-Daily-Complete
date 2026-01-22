/**
 * PDMP Service Tests
 *
 * ONC Criteria: 170.315(b)(3) - Electronic Prescribing
 * Tests for Prescription Drug Monitoring Program queries.
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
              gte: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
              single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            order: vi.fn(() => ({
              ascending: false,
            })),
          })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
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
  getStateConfig,
  getActiveStateConfigs,
  isPDMPQueryRequired,
  queryPDMP,
  getPDMPQuery,
  getPDMPPrescriptionHistory,
  getPatientPDMPQueries,
  hasRecentPDMPQuery,
  getPDMPStats,
  type PDMPQueryInput,
} from '../pdmpService';
import { supabase } from '../../lib/supabaseClient';

describe('PDMPService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStateConfig', () => {
    it('should fetch Texas PDMP configuration', async () => {
      const mockConfig = {
        state_code: 'TX',
        state_name: 'Texas',
        pdmp_system_name: 'Texas Prescription Monitoring Program',
        pdmp_api_endpoint: 'https://texas.pmpinterconnect.com/api/v1',
        pdmp_web_portal_url: 'https://www.txpmp.org',
        mandatory_query: true,
        query_timeframe_hours: 24,
        schedules_covered: [2, 3, 4, 5],
        pmp_interconnect_enabled: true,
        nabp_pmphub_enabled: true,
        is_active: true,
        notes: 'Texas requires PDMP check before prescribing Schedule II-V',
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockConfig, error: null }),
          }),
        }),
      } as never);

      const result = await getStateConfig('TX');

      expect(result.success).toBe(true);
      expect(result.data?.stateCode).toBe('TX');
      expect(result.data?.mandatoryQuery).toBe(true);
      expect(result.data?.schedulesCovered).toContain(2);
    });

    it('should return null for unconfigured state', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      } as never);

      const result = await getStateConfig('ZZ');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('getActiveStateConfigs', () => {
    it('should fetch all active state configurations', async () => {
      const mockConfigs = [
        {
          state_code: 'TX',
          state_name: 'Texas',
          pdmp_system_name: 'Texas PMP',
          mandatory_query: true,
          query_timeframe_hours: 24,
          schedules_covered: [2, 3, 4, 5],
          pmp_interconnect_enabled: true,
          nabp_pmphub_enabled: true,
          is_active: true,
        },
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockConfigs, error: null }),
          }),
        }),
      } as never);

      const result = await getActiveStateConfigs();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].stateCode).toBe('TX');
    });
  });

  describe('isPDMPQueryRequired', () => {
    it('should return true for Texas Schedule II', async () => {
      const mockConfig = {
        state_code: 'TX',
        state_name: 'Texas',
        pdmp_system_name: 'Texas PMP',
        mandatory_query: true,
        query_timeframe_hours: 24,
        schedules_covered: [2, 3, 4, 5],
        pmp_interconnect_enabled: true,
        nabp_pmphub_enabled: true,
        is_active: true,
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockConfig, error: null }),
          }),
        }),
      } as never);

      const result = await isPDMPQueryRequired('TX', 2);

      expect(result.success).toBe(true);
      expect(result.data?.required).toBe(true);
      expect(result.data?.timeframeHours).toBe(24);
    });

    it('should return false for unconfigured state', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      } as never);

      const result = await isPDMPQueryRequired('ZZ', 2);

      expect(result.success).toBe(true);
      expect(result.data?.required).toBe(false);
    });
  });

  describe('queryPDMP', () => {
    const mockInput: PDMPQueryInput = {
      providerId: 'provider-456',
      providerNpi: '1234567890',
      providerDea: 'AB1234563',
      patientId: 'patient-789',
      patientFirstName: 'John',
      patientLastName: 'Doe',
      patientDob: new Date('1985-03-15'),
      state: 'TX',
    };

    it('should create a PDMP query', async () => {
      // Mock state config
      const mockConfig = {
        state_code: 'TX',
        state_name: 'Texas',
        pdmp_system_name: 'Texas PMP',
        mandatory_query: true,
        query_timeframe_hours: 24,
        schedules_covered: [2, 3, 4, 5],
        pmp_interconnect_enabled: true,
        nabp_pmphub_enabled: true,
        is_active: true,
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockConfig, error: null }),
          }),
        }),
      } as never);

      // Mock query insert
      const mockQuery = {
        id: 'query-123',
        tenant_id: 'tenant-123',
        query_timestamp: new Date().toISOString(),
        query_type: 'patient_history',
        provider_id: 'provider-456',
        provider_npi: '1234567890',
        provider_dea: 'AB1234563',
        patient_id: 'patient-789',
        patient_first_name: 'John',
        patient_last_name: 'Doe',
        patient_dob: '1985-03-15',
        pdmp_state: 'TX',
        pdmp_system_name: 'Texas PMP',
        response_status: 'pending',
        flags: {},
        created_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockQuery, error: null }),
          }),
        }),
      } as never);

      // Mock query update after simulated response
      const updatedQuery = {
        ...mockQuery,
        response_status: 'success',
        response_received_at: new Date().toISOString(),
        prescriptions_found: 0,
        flags: {
          doctor_shopping: false,
          pharmacy_shopping: false,
          early_refill: false,
          high_mme: false,
          overlapping_controlled: false,
        },
        morphine_milligram_equivalent: 0,
        overlapping_prescriptions: 0,
        unique_prescribers: 0,
        unique_pharmacies: 0,
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedQuery, error: null }),
            }),
          }),
        }),
      } as never);

      const result = await queryPDMP('tenant-123', mockInput);

      expect(result.success).toBe(true);
      expect(result.data?.responseStatus).toBe('success');
      expect(result.data?.pdmpState).toBe('TX');
    });

    it('should fail for inactive state', async () => {
      const mockConfig = {
        state_code: 'CA',
        state_name: 'California',
        pdmp_system_name: 'CURES 2.0',
        mandatory_query: true,
        query_timeframe_hours: 24,
        schedules_covered: [2, 3, 4, 5],
        pmp_interconnect_enabled: false,
        nabp_pmphub_enabled: false,
        is_active: false, // Not active
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockConfig, error: null }),
          }),
        }),
      } as never);

      const caInput = { ...mockInput, state: 'CA' };
      const result = await queryPDMP('tenant-123', caInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('getPDMPQuery', () => {
    it('should fetch a PDMP query by ID', async () => {
      const mockQuery = {
        id: 'query-123',
        tenant_id: 'tenant-123',
        query_timestamp: new Date().toISOString(),
        query_type: 'patient_history',
        provider_id: 'provider-456',
        provider_npi: '1234567890',
        patient_id: 'patient-789',
        patient_first_name: 'John',
        patient_last_name: 'Doe',
        patient_dob: '1985-03-15',
        pdmp_state: 'TX',
        pdmp_system_name: 'Texas PMP',
        response_status: 'success',
        prescriptions_found: 3,
        flags: { doctor_shopping: false, high_mme: false },
        created_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockQuery, error: null }),
            }),
          }),
        }),
      } as never);

      const result = await getPDMPQuery('tenant-123', 'query-123');

      expect(result.success).toBe(true);
      expect(result.data?.prescriptionsFound).toBe(3);
    });
  });

  describe('getPDMPPrescriptionHistory', () => {
    it('should fetch prescription history for a query', async () => {
      const mockHistory = [
        {
          id: 'hist-1',
          pdmp_query_id: 'query-123',
          medication_name: 'Oxycodone 5mg',
          dea_schedule: 2,
          quantity: 30,
          days_supply: 30,
          filled_date: '2026-01-10',
          prescriber_name: 'Dr. Smith',
          prescriber_npi: '9876543210',
          pharmacy_name: 'CVS Pharmacy',
          morphine_milligram_equivalent: 45,
          overlaps_with_other: false,
          early_refill: false,
        },
        {
          id: 'hist-2',
          pdmp_query_id: 'query-123',
          medication_name: 'Hydrocodone 10mg',
          dea_schedule: 2,
          quantity: 60,
          days_supply: 30,
          filled_date: '2025-12-15',
          prescriber_name: 'Dr. Jones',
          prescriber_npi: '5555555555',
          pharmacy_name: 'Walgreens',
          morphine_milligram_equivalent: 60,
          overlaps_with_other: false,
          early_refill: false,
        },
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockHistory, error: null }),
          }),
        }),
      } as never);

      const result = await getPDMPPrescriptionHistory('query-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].medicationName).toBe('Oxycodone 5mg');
      expect(result.data?.[0].deaSchedule).toBe(2);
    });
  });

  describe('hasRecentPDMPQuery', () => {
    it('should find recent query within timeframe', async () => {
      const mockQuery = {
        id: 'query-123',
        tenant_id: 'tenant-123',
        query_timestamp: new Date().toISOString(),
        query_type: 'patient_history',
        provider_id: 'provider-456',
        provider_npi: '1234567890',
        patient_id: 'patient-789',
        patient_first_name: 'John',
        patient_last_name: 'Doe',
        patient_dob: '1985-03-15',
        pdmp_state: 'TX',
        response_status: 'success',
        flags: {},
        created_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: mockQuery, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      } as never);

      const result = await hasRecentPDMPQuery('tenant-123', 'patient-789', 'TX', 24);

      expect(result.success).toBe(true);
      expect(result.data?.exists).toBe(true);
    });
  });

  describe('getPDMPStats', () => {
    it('should calculate PDMP statistics', async () => {
      const mockQueries = [
        {
          pdmp_state: 'TX',
          flags: { doctor_shopping: true, high_mme: false },
          morphine_milligram_equivalent: 45,
          response_status: 'success',
        },
        {
          pdmp_state: 'TX',
          flags: { doctor_shopping: false, high_mme: true },
          morphine_milligram_equivalent: 120,
          response_status: 'success',
        },
        {
          pdmp_state: 'TX',
          flags: { doctor_shopping: false, high_mme: false },
          morphine_milligram_equivalent: 30,
          response_status: 'success',
        },
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockQueries, error: null }),
          }),
        }),
      } as never);

      const result = await getPDMPStats('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.totalQueries).toBe(3);
      expect(result.data?.flagBreakdown.doctorShopping).toBe(1);
      expect(result.data?.flagBreakdown.highMme).toBe(1);
      expect(result.data?.byState['TX']).toBe(3);
    });
  });
});
