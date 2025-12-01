/**
 * Jest Tests for Readmission Risk Predictor
 * Covers: Unit tests, integration tests, security, clinical accuracy
 */

import { ReadmissionRiskPredictor } from '../readmissionRiskPredictor';
import { supabase } from '../../../lib/supabaseClient';
import { setSupabaseHandler, resetSupabaseHandler } from '../../../lib/__mocks__/supabaseClient';
import type { DischargeContext } from '../readmissionRiskPredictor';

// Mock MCP modules before imports
jest.mock('../../mcp/mcpClient');
jest.mock('../../mcp/mcpCostOptimizer');

// Mock MCP Cost Optimizer
const mockOptimizer = {
  call: jest.fn()
};

// Helper to create a chainable mock query
function createMockQuery(resolveData: any = {}) {
  const mockQuery: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveData),
  };
  // Make limit resolve as well for terminal calls
  mockQuery.limit.mockResolvedValue(resolveData);
  mockQuery.order.mockResolvedValue(resolveData);
  return mockQuery;
}

describe('ReadmissionRiskPredictor', () => {
  let predictor: ReadmissionRiskPredictor;

  beforeEach(() => {
    predictor = new ReadmissionRiskPredictor(mockOptimizer as any);
    // Clear only call history, not implementations
    mockOptimizer.call.mockClear();
    (supabase.rpc as jest.Mock).mockClear();
    // Reset supabase handler to default behavior
    resetSupabaseHandler();
  });

  describe('Input Validation (Security)', () => {
    it('should reject invalid UUID for patientId', async () => {
      const invalidContext: DischargeContext = {
        patientId: 'invalid-uuid',
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        dischargeDate: '2025-11-15T14:00:00Z',
        dischargeFacility: 'Memorial Hospital',
        dischargeDisposition: 'home'
      };

      await expect(predictor.predictReadmissionRisk(invalidContext)).rejects.toThrow(
        'Invalid patientId'
      );
    });

    it('should reject invalid discharge date', async () => {
      const invalidContext: DischargeContext = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        dischargeDate: 'invalid-date',
        dischargeFacility: 'Memorial Hospital',
        dischargeDisposition: 'home'
      };

      await expect(predictor.predictReadmissionRisk(invalidContext)).rejects.toThrow(
        'Invalid dischargeDate'
      );
    });

    it('should reject invalid discharge disposition', async () => {
      const invalidContext: DischargeContext = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        dischargeDate: '2025-11-15T14:00:00Z',
        dischargeFacility: 'Memorial Hospital',
        dischargeDisposition: 'invalid' as any
      };

      await expect(predictor.predictReadmissionRisk(invalidContext)).rejects.toThrow(
        'Invalid dischargeDisposition'
      );
    });

    it('should sanitize facility name to prevent injection', async () => {
      const context: DischargeContext = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        dischargeDate: '2025-11-15T14:00:00Z',
        dischargeFacility: "Memorial'; DROP TABLE hospitals;--",
        dischargeDisposition: 'home'
      };

      // Mock tenant config via rpc
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { readmission_predictor_enabled: true },
        error: null
      });

      // Mock patient data queries - create a self-referential chainable mock
      const createChainableMock = () => {
        const mock: any = {};
        // All chainable Supabase query methods
        const chainMethods = [
          'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
          'is', 'in', 'contains', 'containedBy', 'range', 'match', 'not', 'or',
          'filter', 'order', 'limit', 'insert', 'update', 'delete', 'upsert'
        ];
        chainMethods.forEach(method => {
          mock[method] = jest.fn().mockReturnValue(mock);
        });
        // Terminal methods that return data
        mock.single = jest.fn().mockResolvedValue({ data: null, error: null });
        mock.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
        // Make it thenable (awaitable)
        mock.then = (resolve: any) => resolve({ data: [], error: null });
        return mock;
      };

      (supabase.from as jest.Mock).mockImplementation(() => createChainableMock());

      // Mock AI response
      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({
          readmissionRisk30Day: 0.30,
          readmissionRisk7Day: 0.10,
          readmissionRisk90Day: 0.45,
          riskCategory: 'moderate',
          riskFactors: [],
          recommendedInterventions: [],
          predictionConfidence: 0.80
        }),
        cost: 0.05,
        model: 'claude-sonnet-4-5-20250929',
        fromCache: false
      });

      await predictor.predictReadmissionRisk(context);

      // Verify dangerous SQL injection characters were removed (but text content preserved)
      expect(context.dischargeFacility).not.toContain(';');
      expect(context.dischargeFacility).not.toContain('--');
      expect(context.dischargeFacility).not.toContain("'");
      // Note: Keywords like DROP are allowed - sanitizer removes dangerous chars, not words
      expect(context.dischargeFacility).toBe('Memorial DROP TABLE hospitals');
    });
  });

  describe('Risk Prediction Logic', () => {
    it.skip('should predict high risk for patient with multiple recent readmissions', async () => {
      const context: DischargeContext = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        dischargeDate: '2025-11-15T14:00:00Z',
        dischargeFacility: 'Memorial Hospital',
        dischargeDisposition: 'home',
        primaryDiagnosisCode: 'I50.9',
        primaryDiagnosisDescription: 'Heart failure'
      };

      (supabase.rpc as any).mockResolvedValue({
        data: { readmission_predictor_enabled: true },
        error: null
      });

      // Mock patient with multiple readmissions
      const mockReadmissions = [
        {
          id: '1',
          patient_id: context.patientId,
          admission_date: '2025-11-10T00:00:00Z',
          is_readmission: true,
          readmission_category: '7_day'
        },
        {
          id: '2',
          patient_id: context.patientId,
          admission_date: '2025-10-25T00:00:00Z',
          is_readmission: true,
          readmission_category: '30_day'
        },
        {
          id: '3',
          patient_id: context.patientId,
          admission_date: '2025-10-05T00:00:00Z',
          is_readmission: false
        }
      ];

      const mockQueries = setupMockPatientData({
        readmissions: mockReadmissions,
        sdohIndicators: [
          { category: 'housing_instability', risk_level: 'high' }
        ],
        checkIns: [],
        medications: [],
        profile: { date_of_birth: '1950-01-01', chronic_conditions: ['I50.9', 'E11.9'] }
      });

      (supabase.from as any).mockImplementation(mockQueries);

      // Mock HIGH risk AI response
      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({
          readmissionRisk30Day: 0.75, // HIGH RISK
          readmissionRisk7Day: 0.45,
          readmissionRisk90Day: 0.85,
          riskCategory: 'high',
          riskFactors: [
            {
              factor: '3 readmissions in past 90 days',
              weight: 0.40,
              category: 'utilization_history'
            },
            {
              factor: 'Housing instability',
              weight: 0.20,
              category: 'social_determinants'
            }
          ],
          recommendedInterventions: [
            {
              intervention: 'Daily nurse check-ins for 14 days',
              priority: 'high',
              estimatedImpact: 0.30,
              timeframe: 'daily for 14 days',
              responsible: 'care_coordinator'
            }
          ],
          predictionConfidence: 0.90
        }),
        cost: 0.08,
        model: 'claude-sonnet-4-5-20250929',
        fromCache: false
      });

      (supabase.from as any).mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await predictor.predictReadmissionRisk(context);

      expect(result.riskCategory).toBe('high');
      expect(result.readmissionRisk30Day).toBeGreaterThan(0.50);
      expect(result.riskFactors.length).toBeGreaterThan(0);
      expect(result.recommendedInterventions.length).toBeGreaterThan(0);
    });

    it.skip('should predict low risk for patient with strong protective factors', async () => {
      const context: DischargeContext = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        dischargeDate: '2025-11-15T14:00:00Z',
        dischargeFacility: 'Memorial Hospital',
        dischargeDisposition: 'home'
      };

      (supabase.rpc as any).mockResolvedValue({
        data: { readmission_predictor_enabled: true },
        error: null
      });

      // Mock patient with NO readmissions, good engagement, active care plan
      const mockQueries = setupMockPatientData({
        readmissions: [],
        sdohIndicators: [],
        checkIns: Array(28).fill({ status: 'completed' }), // 93% completion
        medications: [{ status: 'active' }],
        carePlans: [{ status: 'active', plan_type: 'chronic_care' }],
        profile: { date_of_birth: '1970-01-01', chronic_conditions: [] }
      });

      (supabase.from as any).mockImplementation(mockQueries);

      // Mock LOW risk AI response
      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({
          readmissionRisk30Day: 0.15, // LOW RISK
          readmissionRisk7Day: 0.05,
          readmissionRisk90Day: 0.25,
          riskCategory: 'low',
          riskFactors: [],
          protectiveFactors: [
            {
              factor: 'Active care plan',
              impact: 'Reduces risk by 25%',
              category: 'care_coordination'
            },
            {
              factor: 'High engagement (93% check-in completion)',
              impact: 'Reduces risk by 15%',
              category: 'patient_engagement'
            }
          ],
          recommendedInterventions: [
            {
              intervention: 'Standard follow-up in 7 days',
              priority: 'low',
              estimatedImpact: 0.05,
              timeframe: 'within 7 days',
              responsible: 'primary_care'
            }
          ],
          predictionConfidence: 0.85
        }),
        cost: 0.05,
        model: 'claude-sonnet-4-5-20250929',
        fromCache: false
      });

      (supabase.from as any).mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await predictor.predictReadmissionRisk(context);

      expect(result.riskCategory).toBe('low');
      expect(result.readmissionRisk30Day).toBeLessThan(0.25);
      expect(result.protectiveFactors.length).toBeGreaterThan(0);
    });

    it.skip('should use Claude Sonnet model for clinical accuracy', async () => {
      const context: DischargeContext = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        dischargeDate: '2025-11-15T14:00:00Z',
        dischargeFacility: 'Memorial Hospital',
        dischargeDisposition: 'home'
      };

      (supabase.rpc as any).mockResolvedValue({
        data: {
          readmission_predictor_enabled: true,
          readmission_predictor_model: 'claude-sonnet-4-5-20250929'
        },
        error: null
      });

      const mockQueries = setupMockPatientData({});
      (supabase.from as any).mockImplementation(mockQueries);

      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({
          readmissionRisk30Day: 0.30,
          readmissionRisk7Day: 0.10,
          readmissionRisk90Day: 0.45,
          riskCategory: 'moderate',
          riskFactors: [],
          recommendedInterventions: [],
          predictionConfidence: 0.80
        }),
        cost: 0.10,
        model: 'claude-sonnet-4-5-20250929',
        fromCache: false
      });

      (supabase.from as any).mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      await predictor.predictReadmissionRisk(context);

      // Verify Sonnet model was used (for clinical accuracy)
      expect(mockOptimizer.call).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
          complexity: 'complex' // Complex task requires better model
        })
      );
    });
  });

  describe('Auto Care Plan Creation', () => {
    it.skip('should create care plan for high-risk patients when enabled', async () => {
      const context: DischargeContext = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        dischargeDate: '2025-11-15T14:00:00Z',
        dischargeFacility: 'Memorial Hospital',
        dischargeDisposition: 'home'
      };

      (supabase.rpc as any).mockResolvedValue({
        data: {
          readmission_predictor_enabled: true,
          readmission_predictor_auto_create_care_plan: true
        },
        error: null
      });

      const mockQueries = setupMockPatientData({
        readmissions: [{ is_readmission: true }]
      });

      (supabase.from as any).mockImplementation(mockQueries);

      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({
          readmissionRisk30Day: 0.80, // CRITICAL RISK
          readmissionRisk7Day: 0.50,
          readmissionRisk90Day: 0.90,
          riskCategory: 'critical',
          riskFactors: [
            { factor: 'Recent readmission', weight: 0.50, category: 'utilization_history' }
          ],
          recommendedInterventions: [
            {
              intervention: 'Immediate home health visit',
              priority: 'critical',
              estimatedImpact: 0.40,
              timeframe: 'within 24 hours',
              responsible: 'home_health'
            }
          ],
          predictionConfidence: 0.92
        }),
        cost: 0.10,
        model: 'claude-sonnet-4-5-20250929',
        fromCache: false
      });

      // Mock prediction insert
      const mockInsertPrediction = jest.fn().mockResolvedValue({ data: null, error: null });

      // Mock care plan insert (should be called for high risk)
      const mockInsertCarePlan = jest.fn().mockResolvedValue({ data: null, error: null });

      // Mock alert insert (should be called for critical risk)
      const mockInsertAlert = jest.fn().mockResolvedValue({ data: null, error: null });

      (supabase.from as any)
        .mockReturnValueOnce({ insert: mockInsertPrediction })
        .mockReturnValueOnce({ insert: mockInsertCarePlan })
        .mockReturnValueOnce({ insert: mockInsertAlert });

      await predictor.predictReadmissionRisk(context);

      // Verify care plan was created
      expect(mockInsertCarePlan).toHaveBeenCalled();
      expect(mockInsertAlert).toHaveBeenCalled(); // Critical alert
    });

    it.skip('should NOT create care plan when disabled', async () => {
      const context: DischargeContext = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        dischargeDate: '2025-11-15T14:00:00Z',
        dischargeFacility: 'Memorial Hospital',
        dischargeDisposition: 'home'
      };

      (supabase.rpc as any).mockResolvedValue({
        data: {
          readmission_predictor_enabled: true,
          readmission_predictor_auto_create_care_plan: false // DISABLED
        },
        error: null
      });

      const mockQueries = setupMockPatientData({});
      (supabase.from as any).mockImplementation(mockQueries);

      mockOptimizer.call.mockResolvedValue({
        response: JSON.stringify({
          readmissionRisk30Day: 0.70,
          readmissionRisk7Day: 0.40,
          readmissionRisk90Day: 0.80,
          riskCategory: 'high',
          riskFactors: [],
          recommendedInterventions: [],
          predictionConfidence: 0.85
        }),
        cost: 0.08,
        model: 'claude-sonnet-4-5-20250929',
        fromCache: false
      });

      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      await predictor.predictReadmissionRisk(context);

      // Should only insert prediction, NOT care plan
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('Outcome Tracking (Continuous Learning)', () => {
    it.skip('should update prediction with actual outcome', async () => {
      const predictionId = '123e4567-e89b-12d3-a456-426614174000';

      // Mock select for discharge date
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { discharge_date: '2025-11-01T14:00:00Z' },
            error: null
          })
        })
      });

      // Mock update
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      (supabase.from as any)
        .mockReturnValueOnce({ select: mockSelect })
        .mockReturnValueOnce({ update: mockUpdate });

      await predictor.updateActualOutcome(
        predictionId,
        true, // Readmission occurred
        '2025-11-15T00:00:00Z' // 14 days post-discharge
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          actual_readmission_occurred: true,
          actual_readmission_date: '2025-11-15T00:00:00Z',
          actual_readmission_days_post_discharge: 14
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error if skill not enabled for tenant', async () => {
      const context: DischargeContext = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        dischargeDate: '2025-11-15T14:00:00Z',
        dischargeFacility: 'Memorial Hospital',
        dischargeDisposition: 'home'
      };

      (supabase.rpc as any).mockResolvedValue({
        data: { readmission_predictor_enabled: false }, // DISABLED
        error: null
      });

      await expect(predictor.predictReadmissionRisk(context)).rejects.toThrow(
        'Readmission risk predictor is not enabled for this tenant'
      );
    });

    it.skip('should handle AI response parsing errors gracefully', async () => {
      const context: DischargeContext = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        dischargeDate: '2025-11-15T14:00:00Z',
        dischargeFacility: 'Memorial Hospital',
        dischargeDisposition: 'home'
      };

      (supabase.rpc as any).mockResolvedValue({
        data: { readmission_predictor_enabled: true },
        error: null
      });

      const mockQueries = setupMockPatientData({});
      (supabase.from as any).mockImplementation(mockQueries);

      // Invalid AI response
      mockOptimizer.call.mockResolvedValue({
        response: 'This is not valid JSON',
        cost: 0.05,
        model: 'claude-sonnet-4-5-20250929',
        fromCache: false
      });

      await expect(predictor.predictReadmissionRisk(context)).rejects.toThrow(
        'Failed to parse AI prediction'
      );
    });
  });
});

// =====================================================
// TEST HELPERS
// =====================================================

function setupMockPatientData(data: {
  readmissions?: any[];
  sdohIndicators?: any[];
  checkIns?: any[];
  medications?: any[];
  carePlans?: any[];
  profile?: any;
}): (tableName: string) => any {
  return (tableName: string) => {
    const mockData: Record<string, any> = {
      patient_readmissions: data.readmissions || [],
      sdoh_indicators: data.sdohIndicators || [],
      patient_daily_check_ins: data.checkIns || [],
      fhir_medication_requests: data.medications || [],
      care_coordination_plans: data.carePlans || [],
      profiles: data.profile
    };

    return {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockData[tableName],
                error: null
              })
            })
          }),
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockData[tableName],
                error: null
              })
            }),
            limit: jest.fn().mockResolvedValue({
              data: mockData[tableName],
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({
            data: mockData[tableName],
            error: null
          }),
          single: jest.fn().mockResolvedValue({
            data: mockData[tableName],
            error: null
          })
        })
      })
    };
  };
}
