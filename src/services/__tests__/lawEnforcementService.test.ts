/**
 * Law Enforcement Service Tests
 * Comprehensive test suite for Precinct 3 welfare check system
 * Jest globals are available without import per project config
 */
import { LawEnforcementService } from '../lawEnforcementService';
import type { EmergencyResponseFormData, ResponsePriority } from '../../types/lawEnforcement';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: {
      invoke: vi.fn()
    }
  }
}));

describe('LawEnforcementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEmergencyResponseInfo', () => {
    it('should retrieve emergency response info for a patient', async () => {
      const mockData = {
        id: 'test-id',
        patient_id: 'patient-123',
        tenant_id: 'tenant-123',
        bed_bound: true,
        wheelchair_bound: false,
        oxygen_dependent: true,
        oxygen_tank_location: 'bedroom',
        hearing_impaired: true,
        hearing_impaired_notes: 'knock loudly',
        response_priority: 'high',
        escalation_delay_hours: 4,
        consent_obtained: true,
        hipaa_authorization: true,
        medical_equipment: ['CPAP', 'hospital bed'],
        critical_medications: ['insulin', 'blood thinners'],
        created_at: '2025-01-01',
        updated_at: '2025-01-01'
      };

      const { supabase } = require('../../lib/supabaseClient');
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockData,
              error: null
            })
          })
        })
      });

      const result = await LawEnforcementService.getEmergencyResponseInfo('patient-123');

      expect(result).toBeDefined();
      expect(result?.patientId).toBe('patient-123');
      expect(result?.bedBound).toBe(true);
      expect(result?.oxygenDependent).toBe(true);
      expect(result?.responsePriority).toBe('high');
    });

    it('should return null when no emergency info exists', async () => {
      const { supabase } = require('../../lib/supabaseClient');
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' } // Not found
            })
          })
        })
      });

      const result = await LawEnforcementService.getEmergencyResponseInfo('patient-123');
      expect(result).toBeNull();
    });
  });

  describe('upsertEmergencyResponseInfo', () => {
    it('should save emergency response information', async () => {
      const formData: Partial<EmergencyResponseFormData> = {
        bedBound: true,
        wheelchairBound: false,
        oxygenDependent: true,
        oxygenTankLocation: 'bedroom nightstand',
        hearingImpaired: true,
        hearingImpairedNotes: 'knock loudly, doorbell broken',
        responsePriority: 'high' as ResponsePriority,
        escalationDelayHours: 4,
        consentObtained: true,
        hipaaAuthorization: true
      };

      const mockResponse = {
        id: 'new-id',
        patient_id: 'patient-123',
        tenant_id: 'tenant-123',
        bed_bound: true,
        wheelchair_bound: false,
        oxygen_dependent: true,
        oxygen_tank_location: 'bedroom nightstand',
        hearing_impaired: true,
        hearing_impaired_notes: 'knock loudly, doorbell broken',
        response_priority: 'high',
        escalation_delay_hours: 4,
        consent_obtained: true,
        hipaa_authorization: true,
        medical_equipment: [],
        critical_medications: [],
        created_at: '2025-01-01',
        updated_at: '2025-01-01'
      };

      const { supabase } = require('../../lib/supabaseClient');
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockResponse,
              error: null
            })
          })
        })
      });

      const result = await LawEnforcementService.upsertEmergencyResponseInfo(
        'patient-123',
        formData
      );

      expect(result).toBeDefined();
      expect(result.patientId).toBe('patient-123');
      expect(result.bedBound).toBe(true);
      expect(result.responsePriority).toBe('high');
    });

    it('should throw error when save fails', async () => {
      const { supabase } = require('../../lib/supabaseClient');
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      await expect(
        LawEnforcementService.upsertEmergencyResponseInfo('patient-123', {})
      ).rejects.toThrow('Failed to save emergency response information');
    });
  });

  describe('getWelfareCheckInfo', () => {
    it('should retrieve complete welfare check information', async () => {
      const mockData = {
        patient_id: 'patient-123',
        patient_name: 'Margaret Johnson',
        patient_age: 78,
        patient_phone: '555-1234',
        patient_address: '123 Oak St',
        mobility_status: 'Bed-bound',
        medical_equipment: ['oxygen', 'CPAP'],
        communication_needs: 'Hearing impaired - knock loudly',
        access_instructions: 'Key with neighbor apt 4A',
        pets: '1 cat - friendly',
        response_priority: 'high',
        special_instructions: 'Door opens inward - may be blocked if fallen',
        emergency_contacts: [{ name: 'Sarah', phone: '555-5678' }],
        neighbor_info: { name: 'Robert', phone: '555-9999', address: 'Apt 4A' },
        fall_risk: true,
        cognitive_impairment: false,
        oxygen_dependent: true,
        last_check_in_time: '2025-01-01T08:00:00Z',
        hours_since_check_in: 8.5
      };

      const { supabase } = require('../../lib/supabaseClient');
      (supabase.rpc as ReturnType<typeof vi.fn>).mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockData,
          error: null
        })
      });

      const result = await LawEnforcementService.getWelfareCheckInfo('patient-123');

      expect(result).toBeDefined();
      expect(result?.patientName).toBe('Margaret Johnson');
      expect(result?.mobilityStatus).toBe('Bed-bound');
      expect(result?.responsePriority).toBe('high');
      expect(result?.hoursSinceCheckIn).toBe(8.5);
    });
  });

  describe('getMissedCheckInAlerts', () => {
    it('should retrieve prioritized list of missed check-ins', async () => {
      const mockAlerts = [
        {
          patient_id: 'patient-1',
          patient_name: 'John Doe',
          patient_address: '123 Main St',
          patient_phone: '555-1111',
          hours_since_check_in: 10.5,
          response_priority: 'critical',
          mobility_status: 'Bed-bound',
          special_needs: 'Oxygen, Cognitive impairment',
          emergency_contact_name: 'Jane Doe',
          emergency_contact_phone: '555-2222',
          urgency_score: 150
        },
        {
          patient_id: 'patient-2',
          patient_name: 'Mary Smith',
          patient_address: '456 Oak Ave',
          patient_phone: '555-3333',
          hours_since_check_in: 7.0,
          response_priority: 'high',
          mobility_status: 'Wheelchair',
          special_needs: 'Hearing impaired',
          emergency_contact_name: 'Bob Smith',
          emergency_contact_phone: '555-4444',
          urgency_score: 75
        }
      ];

      const { supabase } = require('../../lib/supabaseClient');
      supabase.rpc.mockResolvedValue({
        data: mockAlerts,
        error: null
      });

      const result = await LawEnforcementService.getMissedCheckInAlerts();

      expect(result).toHaveLength(2);
      expect(result[0].urgencyScore).toBe(150);
      expect(result[0].responsePriority).toBe('critical');
      expect(result[1].urgencyScore).toBe(75);
    });

    it('should return empty array when no alerts', async () => {
      const { supabase } = require('../../lib/supabaseClient');
      supabase.rpc.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await LawEnforcementService.getMissedCheckInAlerts();
      expect(result).toEqual([]);
    });
  });

  describe('transformFromDb', () => {
    it('should transform database record to TypeScript interface', () => {
      const dbRecord = {
        id: 'test-id',
        tenant_id: 'tenant-123',
        patient_id: 'patient-123',
        bed_bound: true,
        wheelchair_bound: false,
        walker_required: false,
        cane_required: false,
        mobility_notes: 'Limited mobility',
        oxygen_dependent: true,
        oxygen_tank_location: 'bedroom',
        medical_equipment: ['CPAP'],
        hearing_impaired: true,
        hearing_impaired_notes: 'knock loudly',
        response_priority: 'high',
        escalation_delay_hours: 4,
        critical_medications: ['insulin'],
        consent_obtained: true,
        hipaa_authorization: true,
        created_at: '2025-01-01',
        updated_at: '2025-01-01'
      };

      const result = LawEnforcementService.transformFromDb(dbRecord);

      expect(result.id).toBe('test-id');
      expect(result.patientId).toBe('patient-123');
      expect(result.bedBound).toBe(true);
      expect(result.oxygenDependent).toBe(true);
      expect(result.hearingImpaired).toBe(true);
      expect(result.responsePriority).toBe('high');
    });
  });

  describe('transformToDb', () => {
    it('should transform TypeScript interface to database format', () => {
      const formData: Partial<EmergencyResponseFormData> = {
        bedBound: true,
        wheelchairBound: false,
        oxygenDependent: true,
        oxygenTankLocation: 'bedroom',
        hearingImpaired: true,
        hearingImpairedNotes: 'knock loudly',
        responsePriority: 'high' as ResponsePriority,
        escalationDelayHours: 4
      };

      const result = LawEnforcementService.transformToDb(formData);

      expect(result.bed_bound).toBe(true);
      expect(result.wheelchair_bound).toBe(false);
      expect(result.oxygen_dependent).toBe(true);
      expect(result.oxygen_tank_location).toBe('bedroom');
      expect(result.hearing_impaired).toBe(true);
      expect(result.response_priority).toBe('high');
    });
  });
});
