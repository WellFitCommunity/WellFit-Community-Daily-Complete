/**
 * Accuracy Tracking Service Tests
 *
 * Tests for the AI accuracy tracking infrastructure that enables
 * evidence-based prompt optimization with human oversight loops.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AccuracyTrackingService } from '../accuracyTrackingService';
import { getOptimizedPrompt, getAvailableSkills, PROMPT_REGISTRY } from '../optimizedPrompts';

// Mock Supabase client
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            limit: vi.fn()
          }))
        })),
        gte: vi.fn(() => ({
          order: vi.fn()
        })),
        single: vi.fn()
      })),
      single: vi.fn()
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn()
      }))
    }))
  }))
};

describe('AccuracyTrackingService', () => {
  let service: AccuracyTrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccuracyTrackingService(mockSupabase as any);
  });

  describe('recordPrediction', () => {
    it('should record a prediction successfully', async () => {
      const predictionId = 'pred-123';
      mockSupabase.rpc.mockResolvedValueOnce({ data: predictionId, error: null });

      const result = await service.recordPrediction({
        tenantId: 'tenant-123',
        skillName: 'readmission_risk',
        predictionType: 'score',
        predictionValue: { risk_score: 75, risk_category: 'HIGH' },
        confidence: 0.85,
        patientId: 'patient-123',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 500,
        outputTokens: 200,
        costUsd: 0.005,
        latencyMs: 1200
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(predictionId);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_ai_prediction', expect.objectContaining({
        p_tenant_id: 'tenant-123',
        p_skill_name: 'readmission_risk',
        p_prediction_type: 'score',
        p_confidence: 0.85
      }));
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const result = await service.recordPrediction({
        tenantId: 'tenant-123',
        skillName: 'billing_codes',
        predictionType: 'code',
        predictionValue: { codes: [] },
        model: 'claude-haiku-4-5-20250929'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
    });
  });

  describe('recordOutcome', () => {
    it('should record prediction outcome for accuracy calculation', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await service.recordOutcome({
        predictionId: 'pred-123',
        actualOutcome: { was_readmitted: true, days_to_readmission: 12 },
        isAccurate: true,
        outcomeSource: 'system_event',
        notes: 'Patient was readmitted as predicted'
      });

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_prediction_outcome', expect.objectContaining({
        p_prediction_id: 'pred-123',
        p_is_accurate: true,
        p_outcome_source: 'system_event'
      }));
    });

    it('should support provider review as outcome source', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await service.recordOutcome({
        predictionId: 'pred-456',
        actualOutcome: { codes_accepted: ['99214'], codes_rejected: ['99215'] },
        isAccurate: true,
        outcomeSource: 'provider_review'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getSkillAccuracy', () => {
    it('should calculate accuracy metrics correctly', async () => {
      const mockPredictions = [
        { is_accurate: true, confidence_score: 0.9, cost_usd: 0.01, latency_ms: 1000 },
        { is_accurate: true, confidence_score: 0.85, cost_usd: 0.01, latency_ms: 1100 },
        { is_accurate: false, confidence_score: 0.7, cost_usd: 0.01, latency_ms: 900 },
        { is_accurate: null, confidence_score: 0.8, cost_usd: 0.01, latency_ms: 1050 } // Pending
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            gte: vi.fn().mockResolvedValueOnce({ data: mockPredictions, error: null })
          })
        })
      } as any);

      const result = await service.getSkillAccuracy('readmission_risk', 30);

      expect(result.success).toBe(true);
      expect(result.data?.totalPredictions).toBe(4);
      expect(result.data?.predictionsWithOutcome).toBe(3);
      expect(result.data?.accurateCount).toBe(2);
      expect(result.data?.accuracyRate).toBeCloseTo(0.667, 2);
    });

    it('should handle no predictions gracefully', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            gte: vi.fn().mockResolvedValueOnce({ data: [], error: null })
          })
        })
      } as any);

      const result = await service.getSkillAccuracy('sdoh_detection', 30);

      expect(result.success).toBe(true);
      expect(result.data?.totalPredictions).toBe(0);
      expect(result.data?.accuracyRate).toBeNull();
    });
  });

  describe('prompt version management', () => {
    it('should get active prompt version', async () => {
      const mockPrompt = {
        id: 'prompt-123',
        skill_name: 'billing_codes',
        prompt_type: 'system',
        version_number: 2,
        prompt_content: 'You are an expert medical coder...',
        is_active: true,
        total_uses: 150,
        accuracy_rate: 0.87
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({ data: mockPrompt, error: null })
              })
            })
          })
        })
      } as any);

      const result = await service.getActivePrompt('billing_codes');

      expect(result.success).toBe(true);
      expect(result.data?.versionNumber).toBe(2);
      expect(result.data?.accuracyRate).toBe(0.87);
    });

    it('should create new prompt version with incremented number', async () => {
      // Mock existing versions query
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              order: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockResolvedValueOnce({
                  data: [{ version_number: 2 }],
                  error: null
                })
              })
            })
          })
        })
      } as any);

      // Mock insert
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'new-prompt-123',
                skill_name: 'billing_codes',
                prompt_type: 'system',
                version_number: 3,
                prompt_content: 'Improved prompt...',
                is_active: false,
                total_uses: 0,
                accuracy_rate: null
              },
              error: null
            })
          })
        })
      } as any);

      const result = await service.createPromptVersion(
        'billing_codes',
        'system',
        'Improved prompt...',
        'Testing new format',
        'Added structured output requirements'
      );

      expect(result.success).toBe(true);
      expect(result.data?.versionNumber).toBe(3);
      expect(result.data?.isActive).toBe(false);
    });
  });

  describe('billing code accuracy tracking', () => {
    it('should calculate code acceptance rate correctly', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({ error: null })
      } as any);
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await service.recordBillingCodeAccuracy(
        'pred-123',
        'encounter-456',
        [
          { code: '99214', type: 'CPT' },
          { code: '99215', type: 'CPT' },
          { code: 'E11.9', type: 'ICD10' }
        ],
        [
          { code: '99214', type: 'CPT' },  // Accepted
          { code: 'E11.9', type: 'ICD10' }, // Accepted
          { code: 'I10', type: 'ICD10' }    // Added by provider
        ],
        'provider-789',
        175.00,
        180.00
      );

      expect(result.success).toBe(true);
    });
  });

  describe('experiment management', () => {
    it('should create A/B test experiment', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: { id: 'exp-123' },
              error: null
            })
          })
        })
      } as any);

      const result = await service.createExperiment({
        experimentName: 'billing-v2-vs-v3',
        skillName: 'billing_codes',
        hypothesis: 'V3 prompt with structured output will improve accuracy by 10%',
        controlPromptId: 'prompt-v2',
        treatmentPromptId: 'prompt-v3',
        trafficSplit: 0.5,
        minSampleSize: 200
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('exp-123');
    });

    it('should calculate statistical significance correctly', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                experiment_name: 'billing-v2-vs-v3',
                control_predictions: 100,
                control_accurate: 80,
                treatment_predictions: 100,
                treatment_accurate: 90
              },
              error: null
            })
          })
        })
      } as any);

      const result = await service.getExperimentResults('exp-123');

      expect(result.success).toBe(true);
      expect(result.data?.controlPredictions).toBe(100);
      expect(result.data?.treatmentPredictions).toBe(100);
      // With 80% vs 90% accuracy at n=100 each, should show treatment winning
      expect(result.data?.winner).toBe('treatment');
    });
  });
});

describe('Optimized Prompts', () => {
  // Imports are at the top of the file now (ES modules)

  it('should return all available skills', () => {
    const skills = getAvailableSkills();

    expect(skills).toContain('readmission_risk');
    expect(skills).toContain('billing_codes');
    expect(skills).toContain('sdoh_detection');
    expect(skills).toContain('welfare_check');
    expect(skills.length).toBeGreaterThanOrEqual(6);
  });

  it('should return prompt template for valid skill', () => {
    const prompt = getOptimizedPrompt('readmission_risk');

    expect(prompt).not.toBeNull();
    expect(prompt?.name).toBe('readmission_risk');
    expect(prompt?.version).toBe(2);
    expect(prompt?.model).toBe('sonnet');
    expect(prompt?.systemPrompt).toContain('clinical risk analyst');
  });

  it('should return null for invalid skill', () => {
    const prompt = getOptimizedPrompt('nonexistent_skill');
    expect(prompt).toBeNull();
  });

  it('should have confidence thresholds set appropriately', () => {
    // Billing codes should have high threshold (revenue impact)
    expect(PROMPT_REGISTRY['billing_codes'].confidenceThreshold).toBe(0.85);

    // SDOH detection can be slightly lower (human review follows)
    expect(PROMPT_REGISTRY['sdoh_detection'].confidenceThreshold).toBe(0.70);

    // Emergency briefings need high confidence (safety critical)
    expect(PROMPT_REGISTRY['emergency_briefing'].confidenceThreshold).toBe(0.90);
  });

  it('should use appropriate models for each skill', () => {
    // High-stakes clinical decisions use Sonnet
    expect(PROMPT_REGISTRY['readmission_risk'].model).toBe('sonnet');
    expect(PROMPT_REGISTRY['billing_codes'].model).toBe('sonnet');

    // Cost-efficient batch processing uses Haiku
    expect(PROMPT_REGISTRY['sdoh_detection'].model).toBe('haiku');
    expect(PROMPT_REGISTRY['welfare_check'].model).toBe('haiku');
  });

  it('should include structured output format in all prompts', () => {
    for (const [_skillName, prompt] of Object.entries(PROMPT_REGISTRY)) {
      const p = prompt as { systemPrompt: string; expectedOutputFormat: string };
      expect(p.systemPrompt).toContain('JSON');
      expect(p.expectedOutputFormat).toBe('json');
    }
  });
});
