/**
 * Tests for Extended Readmission Predictor Service
 *
 * Covers 1-year readmission prediction with seasonal and SDOH factors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ExtendedReadmissionPredictorService,
  ExtendedReadmissionRequest,
  ExtendedReadmissionResponse,
  PatientProfile,
} from '../extendedReadmissionPredictorService';

// Mock supabaseClient
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    })),
  },
}));

// =====================================================
// MOCK DATA FACTORIES
// =====================================================

function createMockPatientProfile(overrides?: Partial<PatientProfile>): PatientProfile {
  return {
    patientId: 'patient-123',
    age: 72,
    gender: 'male',
    primaryDiagnoses: [{ code: 'I50.9', display: 'Heart failure' }],
    comorbidities: [
      { code: 'E11.9', display: 'Type 2 diabetes' },
      { code: 'I10', display: 'Hypertension' },
    ],
    medications: [
      { name: 'Metformin', class: 'antidiabetic' },
      { name: 'Lisinopril', class: 'ace_inhibitor' },
    ],
    recentAdmissions: [
      {
        admitDate: '2024-09-01',
        dischargeDate: '2024-09-05',
        primaryDiagnosis: 'Heart failure exacerbation',
        lengthOfStay: 4,
      },
    ],
    sdohFactors: {
      housingInstability: false,
      foodInsecurity: true,
      transportationBarriers: true,
      socialIsolation: false,
      financialStrain: true,
    },
    behavioralFactors: {
      medicationAdherence: 'moderate',
      appointmentCompliance: 'high',
      substanceUse: false,
    },
    ...overrides,
  };
}

function createMockReadmissionRequest(overrides?: Partial<ExtendedReadmissionRequest>): ExtendedReadmissionRequest {
  return {
    patientId: 'patient-123',
    patientProfile: createMockPatientProfile(),
    predictionHorizon: '1_year',
    includeMonthlyProjection: true,
    tenantId: 'test-tenant',
    ...overrides,
  };
}

function createMockReadmissionResponse(): ExtendedReadmissionResponse {
  return {
    result: {
      overallRiskScore: 0.72,
      riskLevel: 'high',
      confidenceInterval: { lower: 0.65, upper: 0.79 },
      predictionHorizon: '1_year',
      baselineRisk: 0.45,
      seasonalFactors: [
        {
          factor: 'Flu season',
          period: 'November-March',
          riskMultiplier: 1.3,
          description: 'Increased respiratory complications',
        },
      ],
      chronicDiseaseFactors: [
        {
          condition: 'Heart failure',
          currentStage: 'Stage C',
          projectedProgression: 'Stable with treatment',
          riskContribution: 0.25,
        },
      ],
      sdohRiskContribution: 0.15,
      behavioralRiskContribution: 0.08,
      topRiskFactors: [
        {
          factor: 'Prior hospitalization',
          contribution: 0.20,
          modifiable: false,
        },
        {
          factor: 'Medication adherence',
          contribution: 0.08,
          modifiable: true,
          intervention: 'Medication management program',
        },
      ],
      recommendedInterventions: [
        {
          intervention: 'Home health nursing visits',
          priority: 'high',
          expectedRiskReduction: 0.15,
          timeframe: 'Within 2 weeks',
        },
      ],
      monthlyRiskProjection: [
        { month: 'January', riskScore: 0.75, seasonalInfluence: 'Flu season peak' },
        { month: 'February', riskScore: 0.73, seasonalInfluence: 'Flu season' },
      ],
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-sonnet-4.5',
      responseTimeMs: 1200,
      dataCompleteness: 0.92,
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe('ExtendedReadmissionPredictorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('predictReadmission', () => {
    it('should return failure when patientId is empty', async () => {
      const request = createMockReadmissionRequest({ patientId: '' });
      const result = await ExtendedReadmissionPredictorService.predictReadmission(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when patientId is whitespace only', async () => {
      const request = createMockReadmissionRequest({ patientId: '   ' });
      const result = await ExtendedReadmissionPredictorService.predictReadmission(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when patientProfile is missing', async () => {
      const request = createMockReadmissionRequest({ patientProfile: undefined as unknown as PatientProfile });
      const result = await ExtendedReadmissionPredictorService.predictReadmission(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle edge function errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      });

      const request = createMockReadmissionRequest();
      const result = await ExtendedReadmissionPredictorService.predictReadmission(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PREDICTION_FAILED');
    });

    it('should successfully predict readmission', async () => {
      const mockResponse = createMockReadmissionResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockReadmissionRequest();
      const result = await ExtendedReadmissionPredictorService.predictReadmission(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.riskLevel).toBe('high');
      expect(result.data?.result.overallRiskScore).toBeGreaterThan(0.7);
    });

    it('should include monthly projection when requested', async () => {
      const mockResponse = createMockReadmissionResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockReadmissionRequest({ includeMonthlyProjection: true });
      const result = await ExtendedReadmissionPredictorService.predictReadmission(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.monthlyRiskProjection.length).toBeGreaterThan(0);
    });
  });

  describe('savePrediction', () => {
    it('should save prediction successfully', async () => {
      const request = createMockReadmissionRequest();
      const response = createMockReadmissionResponse();

      const result = await ExtendedReadmissionPredictorService.savePrediction(request, response);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-id');
    });
  });

  describe('getPatientPredictions', () => {
    it('should fetch patient prediction history', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [{ result: createMockReadmissionResponse().result }];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await ExtendedReadmissionPredictorService.getPatientPredictions('patient-123');

      expect(result.success).toBe(true);
    });
  });

  describe('getHighRiskPatients', () => {
    it('should fetch high-risk patients', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [
        { patient_id: 'p1', risk_score: 0.85, risk_level: 'very_high' },
        { patient_id: 'p2', risk_score: 0.72, risk_level: 'high' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await ExtendedReadmissionPredictorService.getHighRiskPatients('tenant-123', 0.7);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
      expect(result.data?.[0].riskScore).toBe(0.85);
    });
  });
});
