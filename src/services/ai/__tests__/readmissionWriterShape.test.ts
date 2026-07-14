/**
 * Readmission writer column-shape guard
 *
 * Both readmission writers previously inserted columns that do not exist on
 * the live readmission_risk_predictions table (readmission_risk_30_day,
 * risk_factors, prediction_confidence before its 20260714 restore, ...) and
 * wrote 'moderate' against a CHECK constraint that only accepts 'medium' —
 * every write failed and no test caught it because none asserted the column
 * set. These tests pin the insert payloads to the live schema.
 */

import { ReadmissionRiskPredictor } from '../readmissionRiskPredictor';
import type { DischargeContext, ReadmissionPrediction } from '../readmissionRiskPredictor';
import type { ReadmissionRiskFeatures } from '../../../types/readmissionRiskFeatures';
import { calculatePatientReadmissionRisk } from '../../readmissionRiskPredictionService';
import { toDbRiskCategory, fromDbRiskCategory } from '../readmission-predictor/riskCategoryMap';

// Live column set of readmission_risk_predictions (verified against
// information_schema 2026-07-14, incl. the 20260714100000 restored columns).
const LIVE_COLUMNS = new Set([
  'id', 'tenant_id', 'patient_id',
  'discharge_date', 'discharge_facility', 'discharge_diagnosis_codes', 'discharge_disposition',
  'readmission_risk_score', 'risk_category', 'predicted_readmission_window_days',
  'primary_risk_factors', 'secondary_risk_factors', 'protective_factors',
  'recommended_interventions', 'recommended_follow_up_timeframe', 'recommended_care_intensity',
  'patient_age', 'patient_comorbidities', 'recent_hospitalizations_count', 'recent_er_visits_count',
  'has_active_care_plan', 'follow_up_scheduled', 'follow_up_appointment_date',
  'care_plan_created', 'care_plan_id',
  'actual_readmission_occurred', 'actual_readmission_date', 'actual_readmission_days_post_discharge',
  'prediction_accuracy_score', 'ai_model_used', 'ai_cost', 'prediction_generated_at',
  'created_at', 'updated_at', 'prompt_version_id', 'accuracy_calculated', 'accuracy_score',
  'predicted_readmission_date',
  'clinical_features', 'medication_features', 'post_discharge_features',
  'social_determinants_features', 'functional_status_features', 'engagement_features',
  'self_reported_features', 'data_completeness_score', 'missing_critical_data',
  'readmission_risk_7_day', 'readmission_risk_90_day', 'prediction_confidence',
  'data_sources_analyzed', 'plain_language_explanation',
]);

const capturedInserts: Record<string, unknown>[] = [];

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      insert: vi.fn(async (payload: Record<string, unknown>) => {
        if (table === 'readmission_risk_predictions') {
          capturedInserts.push(payload);
        }
        return { error: null };
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: {
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
    ai: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../phiAccessLogger', () => ({
  logPhiAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../communicationSilenceWindowService', () => ({
  fetchPatientCommunicationMetrics: vi.fn().mockResolvedValue({}),
  calculateSilenceWindowScore: vi.fn(() => ({
    score: 12,
    riskLevel: 'low',
    alertTriggered: false,
    dataConfidence: 80,
  })),
  calculateReadmissionRiskContribution: vi.fn(() => ({
    contribution: 4.2,
    weight: 0.35,
  })),
}));

function buildPrediction(overrides?: Partial<ReadmissionPrediction>): ReadmissionPrediction {
  return {
    patientId: '00000000-0000-4000-8000-000000000001',
    dischargeDate: '2026-07-01',
    readmissionRisk30Day: 0.42,
    readmissionRisk7Day: 0.15,
    readmissionRisk90Day: 0.6,
    riskCategory: 'moderate',
    riskFactors: [{ factor: 'Prior admission', weight: 0.25, category: 'utilization_history' }],
    protectiveFactors: [{ factor: 'Strong social support', impact: 'reduces risk' }],
    recommendedInterventions: [
      { intervention: 'Daily check-in calls', priority: 'high', timeframe: '48 hours', responsible: 'Care Coordinator' },
    ],
    predictedReadmissionDate: '2026-07-20',
    predictionConfidence: 0.8,
    plainLanguageExplanation: 'Synthetic explanation for Test Patient Alpha.',
    dataSourcesAnalyzed: {
      readmissionHistory: true,
      sdohIndicators: true,
      checkinPatterns: false,
      medicationAdherence: true,
      carePlanAdherence: false,
    },
    aiModel: 'claude-sonnet-5',
    aiCost: 0.01,
    ...overrides,
  } as ReadmissionPrediction;
}

const context: DischargeContext = {
  patientId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-0000000000aa',
  dischargeDate: '2026-07-01',
  dischargeFacility: 'Test Hospital',
  dischargeDisposition: 'home',
  primaryDiagnosisCode: 'I50.9',
  primaryDiagnosisDescription: 'Heart failure, unspecified',
} as DischargeContext;

const features = {
  clinical: { priorAdmissions1Year: 2 },
  medication: { activeMedicationCount: 4 },
  postDischarge: { followUpScheduled: true },
  socialDeterminants: { livesAlone: false },
  functionalStatus: {},
  engagement: {},
  selfReported: {},
  dataCompletenessScore: 85,
  missingCriticalData: [],
} as unknown as ReadmissionRiskFeatures;

describe('readmission writer column shape', () => {
  beforeEach(() => {
    capturedInserts.length = 0;
  });

  it('AI writer inserts only live columns and maps moderate to medium', async () => {
    const predictor = new ReadmissionRiskPredictor();
    await predictor['storePrediction'](context, buildPrediction(), features);

    expect(capturedInserts).toHaveLength(1);
    const payload = capturedInserts[0];

    const unknownColumns = Object.keys(payload).filter(k => !LIVE_COLUMNS.has(k));
    expect(unknownColumns).toEqual([]);

    expect(payload.readmission_risk_score).toBe(0.42);
    expect(payload.readmission_risk_7_day).toBe(0.15);
    expect(payload.readmission_risk_90_day).toBe(0.6);
    expect(payload.risk_category).toBe('medium');
    expect(payload.primary_risk_factors).toEqual([
      { factor: 'Prior admission', weight: 0.25, category: 'utilization_history' },
    ]);
    expect(payload.discharge_diagnosis_codes).toEqual(['I50.9']);
    expect(payload.plain_language_explanation).toBe('Synthetic explanation for Test Patient Alpha.');
    expect(payload.ai_model_used).toBe('claude-sonnet-5');
  });

  it('AI writer throws when the insert fails instead of swallowing the error', async () => {
    const { supabase } = await import('../../../lib/supabaseClient');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      insert: vi.fn(async () => ({ error: { message: 'column does not exist' } })),
    });

    const predictor = new ReadmissionRiskPredictor();
    await expect(
      predictor['storePrediction'](context, buildPrediction(), features)
    ).rejects.toThrow('Failed to store readmission prediction');
  });

  it('deterministic writer inserts only live columns with required NOT NULLs', async () => {
    const deterministicInserts: Record<string, unknown>[] = [];
    const stubClient = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { dob: '1950-05-15' }, error: null }),
            order: () => ({
              limit: () => ({
                single: async () => ({
                  data: {
                    discharge_date: '2026-06-20',
                    clinical_features: { priorAdmissions1Year: 1, comorbidityCount: 2 },
                    medication_features: { compliancePercent: 90 },
                    social_determinants_features: { socialSupportLevel: 'medium', dischargeDestination: 'home' },
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
        insert: async (payload: Record<string, unknown>) => {
          if (table === 'readmission_risk_predictions') deterministicInserts.push(payload);
          return { error: null };
        },
      }),
    };

    await calculatePatientReadmissionRisk(
      stubClient as unknown as Parameters<typeof calculatePatientReadmissionRisk>[0],
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-0000000000aa'
    );

    expect(deterministicInserts).toHaveLength(1);
    const payload = deterministicInserts[0];

    const unknownColumns = Object.keys(payload).filter(k => !LIVE_COLUMNS.has(k));
    expect(unknownColumns).toEqual([]);

    expect(payload.discharge_date).toBe('2026-06-20');
    expect(typeof payload.ai_model_used).toBe('string');
    expect((payload.ai_model_used as string).startsWith('deterministic-')).toBe(true);
    expect(['low', 'medium', 'high', 'critical']).toContain(payload.risk_category);
    expect(typeof payload.readmission_risk_score).toBe('number');
    expect(payload.readmission_risk_score as number).toBeLessThanOrEqual(1);
  });
});

describe('riskCategoryMap', () => {
  it('maps app moderate to db medium and back', () => {
    expect(toDbRiskCategory('moderate')).toBe('medium');
    expect(toDbRiskCategory('Moderate')).toBe('medium');
    expect(fromDbRiskCategory('medium')).toBe('moderate');
  });

  it('passes the shared categories through unchanged', () => {
    for (const c of ['low', 'high', 'critical'] as const) {
      expect(toDbRiskCategory(c)).toBe(c);
      expect(fromDbRiskCategory(c)).toBe(c);
    }
  });

  it('fails safe to low on unknown or missing input', () => {
    expect(toDbRiskCategory('bogus')).toBe('low');
    expect(fromDbRiskCategory(null)).toBe('low');
    expect(fromDbRiskCategory(undefined)).toBe('low');
  });
});
