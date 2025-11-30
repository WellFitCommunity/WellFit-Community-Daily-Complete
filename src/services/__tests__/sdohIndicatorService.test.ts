/**
 * SDOH Indicator Service Tests
 * Enterprise-grade test suite for SDOH indicator service
 */

// Note: jest, describe, it, expect, beforeEach are globals - don't import from @jest/globals
import { SDOHIndicatorService } from '../sdohIndicatorService';
import { SDOHService } from '../fhir/SDOHService';
import type { SDOHCategory, SDOHRiskLevel } from '../../types/sdohIndicators';

// Mock Supabase client
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: null,
            error: null
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: null
            }))
          }))
        }))
      }))
    }))
  }
}));

// Mock SDOHService
jest.mock('../fhir/SDOHService', () => ({
  SDOHService: {
    getAll: jest.fn(),
    getByCategory: jest.fn(),
    getHighRisk: jest.fn()
  }
}));

describe('SDOHIndicatorService', () => {
  const mockPatientId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPatientProfile', () => {
    it('should return empty profile when no observations exist', async () => {
      (SDOHService.getAll as jest.Mock).mockResolvedValue([]);

      const profile = await SDOHIndicatorService.getPatientProfile(mockPatientId);

      expect(profile).toBeDefined();
      expect(profile.patientId).toBe(mockPatientId);
      expect(profile.factors).toEqual([]);
      expect(profile.overallRiskScore).toBe(0);
      expect(profile.highRiskCount).toBe(0);
      expect(profile.activeInterventionCount).toBe(0);
    });

    it('should correctly transform SDOH observations to factors', async () => {
      const mockObservations = [
        {
          id: '1',
          patient_id: mockPatientId,
          category: 'housing',
          risk_level: 'high',
          status: 'final',
          intervention_provided: false,
          referral_made: true,
          effective_datetime: '2025-11-10T00:00:00Z',
          z_codes: ['Z59.0'],
          loinc_code: '71802-3',
          value_text: 'Homeless',
          notes: 'Patient experiencing homelessness',
          health_impact: 'severe',
          priority_level: 5
        },
        {
          id: '2',
          patient_id: mockPatientId,
          category: 'food-security',
          risk_level: 'moderate',
          status: 'final',
          intervention_provided: false,
          referral_made: false,
          effective_datetime: '2025-11-10T00:00:00Z',
          value_text: 'Food insecure',
          priority_level: 3
        }
      ];

      (SDOHService.getAll as jest.Mock).mockResolvedValue(mockObservations);

      const profile = await SDOHIndicatorService.getPatientProfile(mockPatientId);

      expect(profile.factors).toHaveLength(2);
      expect(profile.factors[0].category).toBe('housing');
      expect(profile.factors[0].riskLevel).toBe('high');
      expect(profile.factors[0].interventionStatus).toBe('referral-made');
      expect(profile.factors[1].category).toBe('food-security');
      expect(profile.factors[1].riskLevel).toBe('moderate');
    });

    it('should calculate overall risk score correctly', async () => {
      const mockObservations = [
        {
          patient_id: mockPatientId,
          category: 'housing',
          risk_level: 'critical',
          status: 'final',
          priority_level: 5,
          effective_datetime: '2025-11-10T00:00:00Z'
        },
        {
          patient_id: mockPatientId,
          category: 'food-security',
          risk_level: 'high',
          status: 'final',
          priority_level: 4,
          effective_datetime: '2025-11-10T00:00:00Z'
        }
      ];

      (SDOHService.getAll as jest.Mock).mockResolvedValue(mockObservations);

      const profile = await SDOHIndicatorService.getPatientProfile(mockPatientId);

      expect(profile.overallRiskScore).toBeGreaterThan(70);
      expect(profile.highRiskCount).toBe(2);
    });

    it('should count active interventions correctly', async () => {
      const mockObservations = [
        {
          patient_id: mockPatientId,
          category: 'housing',
          risk_level: 'high',
          status: 'final',
          intervention_provided: true,
          referral_made: true,
          effective_datetime: '2025-11-10T00:00:00Z'
        },
        {
          patient_id: mockPatientId,
          category: 'food-security',
          risk_level: 'moderate',
          status: 'final',
          intervention_provided: false,
          referral_made: true,
          effective_datetime: '2025-11-10T00:00:00Z'
        }
      ];

      (SDOHService.getAll as jest.Mock).mockResolvedValue(mockObservations);

      const profile = await SDOHIndicatorService.getPatientProfile(mockPatientId);

      expect(profile.activeInterventionCount).toBe(2);
    });

    it('should handle errors gracefully', async () => {
      (SDOHService.getAll as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        SDOHIndicatorService.getPatientProfile(mockPatientId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('mapInterventionStatus', () => {
    it('should map not-assessed status correctly', () => {
      const obs = { status: 'preliminary', intervention_provided: false, referral_made: false };
      const status = SDOHIndicatorService.mapInterventionStatus(obs);
      expect(status).toBe('not-assessed');
    });

    it('should map identified status correctly', () => {
      const obs = { status: 'final', intervention_provided: false, referral_made: false };
      const status = SDOHIndicatorService.mapInterventionStatus(obs);
      expect(status).toBe('identified');
    });

    it('should map referral-made status correctly', () => {
      const obs = { status: 'final', intervention_provided: false, referral_made: true };
      const status = SDOHIndicatorService.mapInterventionStatus(obs);
      expect(status).toBe('referral-made');
    });

    it('should map in-progress status correctly', () => {
      const obs = { status: 'final', intervention_provided: true, referral_made: true };
      const status = SDOHIndicatorService.mapInterventionStatus(obs);
      expect(status).toBe('in-progress');
    });

    it('should map resolved status correctly', () => {
      const obs = { status: 'final', intervention_provided: true, referral_made: false };
      const status = SDOHIndicatorService.mapInterventionStatus(obs);
      expect(status).toBe('resolved');
    });

    it('should map declined status correctly', () => {
      const obs = { status: 'cancelled', intervention_provided: false, referral_made: false };
      const status = SDOHIndicatorService.mapInterventionStatus(obs);
      expect(status).toBe('declined');
    });
  });

  describe('calculatePriorityFromRisk', () => {
    it('should calculate priority for critical risk', () => {
      expect(SDOHIndicatorService.calculatePriorityFromRisk('critical')).toBe(5);
    });

    it('should calculate priority for high risk', () => {
      expect(SDOHIndicatorService.calculatePriorityFromRisk('high')).toBe(4);
    });

    it('should calculate priority for moderate risk', () => {
      expect(SDOHIndicatorService.calculatePriorityFromRisk('moderate')).toBe(3);
    });

    it('should calculate priority for low risk', () => {
      expect(SDOHIndicatorService.calculatePriorityFromRisk('low')).toBe(2);
    });

    it('should calculate priority for none/unknown risk', () => {
      expect(SDOHIndicatorService.calculatePriorityFromRisk('none')).toBe(1);
      expect(SDOHIndicatorService.calculatePriorityFromRisk('unknown')).toBe(1);
    });
  });

  describe('getHighPriorityAlerts', () => {
    it('should return only high/critical factors needing attention', async () => {
      const mockObservations = [
        {
          patient_id: mockPatientId,
          category: 'housing',
          risk_level: 'critical',
          status: 'final',
          intervention_provided: false,
          referral_made: false,
          effective_datetime: '2025-11-10T00:00:00Z'
        },
        {
          patient_id: mockPatientId,
          category: 'food-security',
          risk_level: 'moderate',
          status: 'final',
          intervention_provided: false,
          referral_made: false,
          effective_datetime: '2025-11-10T00:00:00Z'
        },
        {
          patient_id: mockPatientId,
          category: 'transportation',
          risk_level: 'high',
          status: 'final',
          intervention_provided: true,
          referral_made: true,
          effective_datetime: '2025-11-10T00:00:00Z'
        }
      ];

      (SDOHService.getAll as jest.Mock).mockResolvedValue(mockObservations);

      const alerts = await SDOHIndicatorService.getHighPriorityAlerts(mockPatientId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].category).toBe('housing');
      expect(alerts[0].riskLevel).toBe('critical');
    });

    it('should return empty array when no high-priority factors exist', async () => {
      const mockObservations = [
        {
          patient_id: mockPatientId,
          category: 'food-security',
          risk_level: 'low',
          status: 'final',
          intervention_provided: false,
          referral_made: false,
          effective_datetime: '2025-11-10T00:00:00Z'
        }
      ];

      (SDOHService.getAll as jest.Mock).mockResolvedValue(mockObservations);

      const alerts = await SDOHIndicatorService.getHighPriorityAlerts(mockPatientId);

      expect(alerts).toHaveLength(0);
    });
  });
});

describe('SDOHIndicatorService - Multi-tenant Security', () => {
  const mockPatientId = '123e4567-e89b-12d3-a456-426614174000';

  it('should include patient_id in all queries for data isolation', async () => {
    (SDOHService.getAll as jest.Mock).mockResolvedValue([]);

    await SDOHIndicatorService.getPatientProfile(mockPatientId);

    expect(SDOHService.getAll).toHaveBeenCalledWith(mockPatientId);
  });

  it('should prevent cross-patient data access', async () => {
    const differentPatientId = '987e6543-e89b-12d3-a456-426614174999';

    (SDOHService.getAll as jest.Mock).mockImplementation((patientId: string) => {
      // Simulate RLS - only return data for the correct patient
      if (patientId === mockPatientId) {
        return Promise.resolve([
          {
            patient_id: mockPatientId,
            category: 'housing',
            risk_level: 'high',
            status: 'final',
            effective_datetime: '2025-11-10T00:00:00Z'
          }
        ]);
      }
      return Promise.resolve([]);
    });

    const profile1 = await SDOHIndicatorService.getPatientProfile(mockPatientId);
    const profile2 = await SDOHIndicatorService.getPatientProfile(differentPatientId);

    expect(profile1.factors).toHaveLength(1);
    expect(profile2.factors).toHaveLength(0);
  });
});
