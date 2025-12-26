/**
 * Extended Readmission Predictor Service (1-Year)
 *
 * Extends readmission prediction to 1-year horizon with:
 * - Seasonal patterns (flu season, holidays, weather)
 * - Chronic disease progression modeling
 * - Social determinant factors
 * - Behavioral trend analysis
 *
 * @module extendedReadmissionPredictorService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PatientProfile {
  patientId: string;
  age: number;
  gender?: string;
  primaryDiagnoses: Array<{ code: string; display: string }>;
  comorbidities: Array<{ code: string; display: string }>;
  medications: Array<{ name: string; class?: string }>;
  recentAdmissions: Array<{
    admitDate: string;
    dischargeDate: string;
    primaryDiagnosis: string;
    lengthOfStay: number;
  }>;
  sdohFactors?: {
    housingInstability?: boolean;
    foodInsecurity?: boolean;
    transportationBarriers?: boolean;
    socialIsolation?: boolean;
    financialStrain?: boolean;
  };
  behavioralFactors?: {
    medicationAdherence?: 'high' | 'moderate' | 'low';
    appointmentCompliance?: 'high' | 'moderate' | 'low';
    substanceUse?: boolean;
    mentalHealthConditions?: string[];
  };
}

export interface SeasonalFactor {
  factor: string;
  period: string;
  riskMultiplier: number;
  description: string;
}

export interface ChronicDiseaseProgression {
  condition: string;
  currentStage: string;
  projectedProgression: string;
  timeToProgression?: string;
  riskContribution: number;
}

export interface ReadmissionPrediction {
  overallRiskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  confidenceInterval: { lower: number; upper: number };
  predictionHorizon: '30_day' | '90_day' | '180_day' | '1_year';
  baselineRisk: number;
  seasonalFactors: SeasonalFactor[];
  chronicDiseaseFactors: ChronicDiseaseProgression[];
  sdohRiskContribution: number;
  behavioralRiskContribution: number;
  topRiskFactors: Array<{
    factor: string;
    contribution: number;
    modifiable: boolean;
    intervention?: string;
  }>;
  recommendedInterventions: Array<{
    intervention: string;
    priority: 'high' | 'medium' | 'low';
    expectedRiskReduction: number;
    timeframe: string;
  }>;
  monthlyRiskProjection: Array<{
    month: string;
    riskScore: number;
    seasonalInfluence: string;
  }>;
}

export interface ExtendedReadmissionRequest {
  patientId: string;
  patientProfile: PatientProfile;
  predictionHorizon?: '30_day' | '90_day' | '180_day' | '1_year';
  includeMonthlyProjection?: boolean;
  tenantId?: string;
}

export interface ExtendedReadmissionResponse {
  result: ReadmissionPrediction;
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    dataCompleteness: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class ExtendedReadmissionPredictorService {
  /**
   * Generate extended readmission prediction
   */
  static async predictReadmission(
    request: ExtendedReadmissionRequest
  ): Promise<ServiceResult<ExtendedReadmissionResponse>> {
    try {
      if (!request.patientId?.trim()) {
        return failure('INVALID_INPUT', 'Patient ID is required');
      }

      if (!request.patientProfile) {
        return failure('INVALID_INPUT', 'Patient profile is required');
      }

      const { data, error } = await supabase.functions.invoke('ai-extended-readmission-predictor', {
        body: {
          patientId: request.patientId,
          patientProfile: request.patientProfile,
          predictionHorizon: request.predictionHorizon || '1_year',
          includeMonthlyProjection: request.includeMonthlyProjection ?? true,
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      return success(data as ExtendedReadmissionResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('PREDICTION_FAILED', error.message, error);
    }
  }

  /**
   * Save prediction to database
   */
  static async savePrediction(
    request: ExtendedReadmissionRequest,
    response: ExtendedReadmissionResponse
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const predictionId = crypto.randomUUID();

      const { data, error } = await supabase
        .from('ai_extended_readmission_predictions')
        .insert({
          prediction_id: predictionId,
          patient_id: request.patientId,
          prediction_horizon: request.predictionHorizon || '1_year',
          risk_score: response.result.overallRiskScore,
          risk_level: response.result.riskLevel,
          seasonal_factors: response.result.seasonalFactors,
          chronic_disease_factors: response.result.chronicDiseaseFactors,
          sdoh_factors: request.patientProfile.sdohFactors || {},
          interventions: response.result.recommendedInterventions,
          result: response.result,
          tenant_id: request.tenantId,
        })
        .select('id')
        .single();

      if (error) throw error;

      return success({ id: data.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Get prediction history for a patient
   */
  static async getPatientPredictions(
    patientId: string,
    limit: number = 10
  ): Promise<ServiceResult<ReadmissionPrediction[]>> {
    try {
      const { data, error } = await supabase
        .from('ai_extended_readmission_predictions')
        .select('result')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return success((data || []).map((d) => d.result as ReadmissionPrediction));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Get high-risk patients for a tenant
   */
  static async getHighRiskPatients(
    tenantId: string,
    threshold: number = 0.7
  ): Promise<ServiceResult<Array<{ patientId: string; riskScore: number; riskLevel: string }>>> {
    try {
      const { data, error } = await supabase
        .from('ai_extended_readmission_predictions')
        .select('patient_id, risk_score, risk_level')
        .eq('tenant_id', tenantId)
        .gte('risk_score', threshold)
        .order('risk_score', { ascending: false });

      if (error) throw error;

      return success(
        (data || []).map((d) => ({
          patientId: d.patient_id,
          riskScore: d.risk_score,
          riskLevel: d.risk_level,
        }))
      );
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }
}

export default ExtendedReadmissionPredictorService;
