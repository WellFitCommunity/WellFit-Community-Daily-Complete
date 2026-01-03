/**
 * Guardian Flow Engine Service
 *
 * AI-powered ED crowding prediction, ambulance arrival estimation,
 * and capacity management recommendations.
 *
 * Part of the P1 AI/ML Scale Optimization initiative.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  CrowdingPrediction,
  CrowdingFactors,
  CapacityRecommendations,
  RecommendedAction,
  PatientDischargeCandidate,
  InboundEMSUnit,
  EMSCapacityScore,
  EMSScoringFactors,
  GuardianFlowConfig,
  PredictionAccuracyMetrics,
  CrowdingLevel,
  DiversionRecommendation,
} from '../types/guardianFlow';

// Default config if none set for facility
const DEFAULT_CONFIG: GuardianFlowConfig = {
  yellowThreshold: 70,
  orangeThreshold: 85,
  redThreshold: 95,
  boardingHoursThreshold: 4,
  autoSurgeEnabled: false,
  defaultDiversionPolicy: 'moderate',
  historicalWindowHours: 168, // 7 days
};

// Historical patterns by day of week and hour (0-23)
// Based on typical ED patterns - would be replaced by ML model in production
const ARRIVAL_PATTERNS: Record<number, number[]> = {
  // Sunday
  0: [3, 2, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 9, 8, 8, 9, 10, 9, 8, 7, 6, 5, 4],
  // Monday
  1: [4, 3, 2, 2, 3, 4, 5, 7, 9, 11, 12, 12, 11, 10, 10, 11, 11, 10, 9, 8, 7, 6, 5, 4],
  // Tuesday
  2: [4, 3, 2, 2, 3, 4, 5, 7, 9, 11, 12, 12, 11, 10, 10, 11, 11, 10, 9, 8, 7, 6, 5, 4],
  // Wednesday
  3: [4, 3, 2, 2, 3, 4, 5, 7, 9, 11, 12, 12, 11, 10, 10, 11, 11, 10, 9, 8, 7, 6, 5, 4],
  // Thursday
  4: [4, 3, 2, 2, 3, 4, 5, 7, 9, 11, 12, 12, 11, 10, 10, 11, 11, 10, 9, 8, 7, 6, 5, 4],
  // Friday
  5: [5, 4, 3, 2, 3, 4, 5, 7, 9, 10, 11, 11, 11, 11, 12, 13, 12, 11, 10, 9, 8, 7, 6, 5],
  // Saturday
  6: [5, 5, 4, 3, 3, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 11, 11, 10, 9, 8, 8, 7, 6, 5],
};

/**
 * Get facility configuration or default
 */
async function getConfig(facilityId?: string): Promise<GuardianFlowConfig> {
  try {
    const { data, error } = await supabase
      .from('guardian_flow_config')
      .select('*')
      .eq('is_active', true)
      .or(`facility_id.eq.${facilityId},facility_id.is.null`)
      .order('facility_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (error || !data) {
      return DEFAULT_CONFIG;
    }

    return {
      yellowThreshold: data.yellow_threshold,
      orangeThreshold: data.orange_threshold,
      redThreshold: data.red_threshold,
      boardingHoursThreshold: data.boarding_hours_threshold,
      autoSurgeEnabled: data.auto_surge_enabled,
      defaultDiversionPolicy: data.default_diversion_policy,
      historicalWindowHours: data.historical_window_hours,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Calculate crowding level from census and config
 */
function calculateCrowdingLevel(
  currentCensus: number,
  capacity: number,
  config: GuardianFlowConfig
): CrowdingLevel {
  const percentage = capacity > 0 ? (currentCensus / capacity) * 100 : 0;
  if (percentage >= config.redThreshold) return 'red';
  if (percentage >= config.orangeThreshold) return 'orange';
  if (percentage >= config.yellowThreshold) return 'yellow';
  return 'green';
}

/**
 * Get expected arrivals for the next N hours based on historical patterns
 */
function getExpectedArrivals(horizonHours: number, startHour?: number): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentHour = startHour ?? now.getHours();
  const pattern = ARRIVAL_PATTERNS[dayOfWeek];

  let total = 0;
  for (let i = 0; i < horizonHours; i++) {
    const hour = (currentHour + i) % 24;
    total += pattern[hour];
  }
  return total;
}

/**
 * Get expected dispositions (discharges) for the next N hours
 * Typically 60-70% of arrivals with a 4-hour lag
 */
function getExpectedDispositions(currentCensus: number, horizonHours: number): number {
  // Baseline: ~25% of census dispositioned per 8-hour shift
  const dispositionRate = 0.03125; // 25% / 8 hours = 3.125% per hour
  return Math.round(currentCensus * dispositionRate * horizonHours);
}

/**
 * Guardian Flow Engine Service
 */
export const GuardianFlowEngine = {
  /**
   * Predict ED crowding for a given time horizon
   */
  async predictCrowding(
    facilityId: string,
    horizonHours: 1 | 4 | 8
  ): Promise<ServiceResult<CrowdingPrediction>> {
    try {
      const config = await getConfig(facilityId);

      // Get current ED state
      const { data: censusData, error: censusError } = await supabase
        .rpc('get_ed_census', { p_facility_id: facilityId });

      if (censusError) {
        // Fall back to estimates if function doesn't exist yet
        await auditLogger.warn('GUARDIAN_FLOW_CENSUS_FALLBACK', {
          facilityId,
          error: censusError.message,
        });
      }

      // Extract current values (with fallbacks)
      const currentCensus = censusData?.[0]?.census ?? 25;
      const currentBoarding = censusData?.[0]?.boarding ?? 3;
      const capacity = censusData?.[0]?.capacity ?? 50;

      // Calculate factors
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hourOfDay = now.getHours();
      const expectedArrivals = getExpectedArrivals(horizonHours);
      const expectedDispositions = getExpectedDispositions(currentCensus, horizonHours);
      const historicalAverage = ARRIVAL_PATTERNS[dayOfWeek][hourOfDay] * horizonHours;

      // Get inpatient bed availability
      const { data: inpatientData } = await supabase
        .from('beds')
        .select('id')
        .eq('status', 'available')
        .not('unit_id', 'is', null);

      const inpatientBedsAvailable = inpatientData?.length ?? 10;

      // Build factors object
      const factors: CrowdingFactors = {
        currentCensus,
        currentBoarding,
        expectedArrivals,
        expectedDispositions,
        dayOfWeek,
        hourOfDay,
        historicalAverage,
        inpatientBedsAvailable,
      };

      // Predict census at end of horizon
      const predictedCensus = Math.round(
        currentCensus + expectedArrivals - expectedDispositions
      );

      // Predict boarding hours (increases if inpatient beds scarce)
      const boardingFactor = inpatientBedsAvailable < 5 ? 1.5 : 1.0;
      const predictedBoardingHours = Math.round(
        (currentBoarding * 2 + expectedArrivals * 0.3) * boardingFactor
      );

      // Calculate crowding level
      const crowdingLevel = calculateCrowdingLevel(predictedCensus, capacity, config);

      // Calculate confidence based on how far out we're predicting
      const confidenceByHorizon: Record<number, number> = { 1: 0.85, 4: 0.75, 8: 0.65 };
      const confidence = confidenceByHorizon[horizonHours] ?? 0.7;

      const prediction: CrowdingPrediction = {
        predictedCensus,
        predictedBoardingHours,
        crowdingLevel,
        confidence,
        predictedAt: now,
        horizonHours,
        factors,
      };

      // Store prediction for accuracy tracking
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user?.id ?? '')
        .single();

      if (profile?.tenant_id) {
        await supabase.from('ed_crowding_predictions').insert({
          tenant_id: profile.tenant_id,
          facility_id: facilityId || null,
          prediction_horizon_hours: horizonHours,
          predicted_census: predictedCensus,
          predicted_boarding_hours: predictedBoardingHours,
          crowding_level: crowdingLevel,
          confidence,
          factors_json: factors,
        });
      }

      await auditLogger.info('GUARDIAN_FLOW_PREDICTION_GENERATED', {
        facilityId,
        horizonHours,
        crowdingLevel,
        predictedCensus,
        category: 'CLINICAL',
      });

      return success(prediction);
    } catch (err) {
      await auditLogger.error('GUARDIAN_FLOW_PREDICTION_FAILED', err as Error, {
        facilityId,
        horizonHours,
        category: 'CLINICAL',
      });
      return failure('UNKNOWN_ERROR', 'Failed to generate crowding prediction', err);
    }
  },

  /**
   * Get recommended actions based on current/predicted state
   */
  async recommendActions(facilityId: string): Promise<ServiceResult<CapacityRecommendations>> {
    try {
      const config = await getConfig(facilityId);

      // Get 4-hour prediction for action planning
      const predictionResult = await this.predictCrowding(facilityId, 4);
      if (!predictionResult.success) {
        return failure(predictionResult.error.code, predictionResult.error.message);
      }
      const prediction = predictionResult.data;

      // Initialize recommendations
      const actions: RecommendedAction[] = [];
      const expediteDischarges: PatientDischargeCandidate[] = [];
      let activateSurge = false;
      let diversionRecommendation: DiversionRecommendation = 'accept';

      // Analyze crowding level and recommend actions
      if (prediction.crowdingLevel === 'red') {
        activateSurge = config.autoSurgeEnabled;
        diversionRecommendation = 'hard_divert';

        actions.push({
          type: 'activate_surge',
          priority: 1,
          description: 'Activate surge protocol - census critical',
          estimatedImpact: -10,
          timeSensitivityMinutes: 15,
        });

        actions.push({
          type: 'notify_admin',
          priority: 2,
          description: 'Notify hospital administration of capacity crisis',
          estimatedImpact: 0,
          timeSensitivityMinutes: 30,
        });

        actions.push({
          type: 'divert_ems',
          priority: 3,
          description: 'Request EMS diversion to alternate facilities',
          estimatedImpact: -5,
          timeSensitivityMinutes: 15,
        });
      } else if (prediction.crowdingLevel === 'orange') {
        diversionRecommendation = 'soft_divert';

        actions.push({
          type: 'expedite_discharge',
          priority: 1,
          description: 'Expedite pending discharges - high volume',
          estimatedImpact: -8,
          timeSensitivityMinutes: 60,
        });

        actions.push({
          type: 'call_housekeeping',
          priority: 2,
          description: 'Request additional EVS support for bed turnover',
          estimatedImpact: -3,
          timeSensitivityMinutes: 30,
        });

        if (prediction.predictedBoardingHours > config.boardingHoursThreshold) {
          actions.push({
            type: 'open_overflow',
            priority: 3,
            description: 'Consider opening overflow area for boarding patients',
            estimatedImpact: -5,
            timeSensitivityMinutes: 45,
          });
        }
      } else if (prediction.crowdingLevel === 'yellow') {
        actions.push({
          type: 'expedite_discharge',
          priority: 1,
          description: 'Review pending discharges for expedition opportunities',
          estimatedImpact: -4,
          timeSensitivityMinutes: 120,
        });
      }

      // Get discharge candidates
      const { data: candidates } = await supabase
        .from('bed_assignments')
        .select(`
          id,
          patient_id,
          bed_id,
          assigned_at,
          expected_discharge_date,
          discharge_disposition,
          beds!inner(bed_label, unit_id, hospital_units!inner(unit_type))
        `)
        .eq('is_active', true)
        .eq('beds.hospital_units.unit_type', 'ed')
        .not('discharge_disposition', 'is', null)
        .order('assigned_at', { ascending: true })
        .limit(10);

      if (candidates) {
        for (const c of candidates) {
          const hoursInED = (Date.now() - new Date(c.assigned_at).getTime()) / (1000 * 60 * 60);

          const bedsData = c.beds as unknown as Record<string, unknown> | undefined;
          expediteDischarges.push({
            patientId: c.patient_id,
            currentLocation: 'ED',
            bedLabel: bedsData?.bed_label as string | undefined,
            hoursInED: Math.round(hoursInED * 10) / 10,
            disposition: c.discharge_disposition || 'pending',
            reason: hoursInED > 4 ? 'Extended ED stay - ready for discharge' : 'Discharge pending',
            estimatedTimeToDischarge: 30,
          });
        }
      }

      // Build summary text
      let summaryText = '';
      switch (prediction.crowdingLevel) {
        case 'red':
          summaryText = `Critical capacity: ${prediction.predictedCensus} patients expected in 4 hours. Surge protocol recommended. Consider EMS diversion.`;
          break;
        case 'orange':
          summaryText = `High volume alert: ${prediction.predictedCensus} patients expected. Expedite discharges and prepare overflow capacity.`;
          break;
        case 'yellow':
          summaryText = `Elevated volume: ${prediction.predictedCensus} patients expected. Monitor discharge flow closely.`;
          break;
        default:
          summaryText = `Normal operations: ${prediction.predictedCensus} patients expected. No immediate action required.`;
      }

      const recommendations: CapacityRecommendations = {
        expediteDischarges,
        delayAdmissions: [],
        activateSurge,
        surgeLevel: activateSurge ? 'level_1' : undefined,
        diversionRecommendation,
        summaryText,
        prioritizedActions: actions,
      };

      await auditLogger.info('GUARDIAN_FLOW_RECOMMENDATIONS_GENERATED', {
        facilityId,
        crowdingLevel: prediction.crowdingLevel,
        actionCount: actions.length,
        diversionRecommendation,
        category: 'CLINICAL',
      });

      return success(recommendations);
    } catch (err) {
      await auditLogger.error('GUARDIAN_FLOW_RECOMMENDATIONS_FAILED', err as Error, {
        facilityId,
        category: 'CLINICAL',
      });
      return failure('UNKNOWN_ERROR', 'Failed to generate recommendations', err);
    }
  },

  /**
   * Score an inbound EMS unit for capacity impact
   */
  async scoreInboundEMS(
    facilityId: string,
    emsUnit: InboundEMSUnit
  ): Promise<ServiceResult<EMSCapacityScore>> {
    try {
      const config = await getConfig(facilityId);

      // Get current prediction to understand capacity situation
      const predictionResult = await this.predictCrowding(facilityId, 1);
      const currentCrowding = predictionResult.success
        ? predictionResult.data.crowdingLevel
        : 'yellow';

      // Calculate scoring factors
      const factors: EMSScoringFactors = {
        acuityWeight: (emsUnit.estimatedAcuity ?? 3) * 10,
        resourceWeight: emsUnit.traumaActivation || emsUnit.strokeAlert || emsUnit.stemiAlert ? 25 : 0,
        currentCapacityWeight: currentCrowding === 'red' ? 30 : currentCrowding === 'orange' ? 20 : 10,
        specialtyBedWeight: emsUnit.resourcesNeeded?.length ?? 0 * 5,
        timeOfDayWeight: new Date().getHours() >= 10 && new Date().getHours() <= 18 ? 10 : 5,
      };

      // Calculate total capacity impact score (0-100)
      const capacityImpact = Math.min(
        100,
        factors.acuityWeight +
          factors.resourceWeight +
          factors.currentCapacityWeight +
          factors.specialtyBedWeight +
          factors.timeOfDayWeight
      );

      // Estimate time to bed based on acuity and current state
      const baseTimeToBed = currentCrowding === 'red' ? 45 : currentCrowding === 'orange' ? 30 : 15;
      const acuityModifier = (emsUnit.estimatedAcuity ?? 3) <= 2 ? 0.8 : 1.2;
      const timeToBed = Math.round(baseTimeToBed * acuityModifier);

      // Estimate length of stay
      const likelyLOS = emsUnit.estimatedAcuity && emsUnit.estimatedAcuity <= 2 ? 8 : 4;

      // ICU probability based on acuity and alerts
      let icuProbability = 0;
      if (emsUnit.traumaActivation) icuProbability = 0.6;
      else if (emsUnit.strokeAlert || emsUnit.stemiAlert) icuProbability = 0.4;
      else if (emsUnit.estimatedAcuity === 1) icuProbability = 0.3;
      else if (emsUnit.estimatedAcuity === 2) icuProbability = 0.15;

      // Determine recommendation
      let recommendation: DiversionRecommendation = 'accept';
      if (currentCrowding === 'red' && capacityImpact > 60) {
        recommendation = config.defaultDiversionPolicy === 'aggressive' ? 'hard_divert' : 'soft_divert';
      } else if (currentCrowding === 'orange' && capacityImpact > 70) {
        recommendation = 'soft_divert';
      }

      // Build plain language explanation
      let explanation = '';
      if (recommendation === 'accept') {
        explanation = `Unit ${emsUnit.unitCallSign} can be accepted. ETA ${emsUnit.eta} minutes. Expected time to bed: ${timeToBed} minutes.`;
      } else if (recommendation === 'soft_divert') {
        explanation = `Consider routing ${emsUnit.unitCallSign} to alternate facility if possible. Current volume is elevated with ${capacityImpact}% capacity impact expected.`;
      } else {
        explanation = `Diversion recommended for ${emsUnit.unitCallSign}. ED at critical capacity. Patient would face significant delays.`;
      }

      const score: EMSCapacityScore = {
        unitId: emsUnit.unitId,
        capacityImpact,
        timeToBed,
        likelyLOS,
        icuProbability,
        recommendation,
        factors,
        explanation,
      };

      await auditLogger.info('GUARDIAN_FLOW_EMS_SCORED', {
        facilityId,
        unitId: emsUnit.unitId,
        capacityImpact,
        recommendation,
        category: 'CLINICAL',
      });

      return success(score);
    } catch (err) {
      await auditLogger.error('GUARDIAN_FLOW_EMS_SCORING_FAILED', err as Error, {
        facilityId,
        unitId: emsUnit.unitId,
        category: 'CLINICAL',
      });
      return failure('UNKNOWN_ERROR', 'Failed to score EMS unit', err);
    }
  },

  /**
   * Record actual values for accuracy tracking
   */
  async recordActuals(
    predictionId: string,
    actualCensus: number,
    actualBoardingHours: number
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc('record_prediction_actuals', {
        p_prediction_id: predictionId,
        p_actual_census: actualCensus,
        p_actual_boarding_hours: actualBoardingHours,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('GUARDIAN_FLOW_ACTUALS_RECORDED', {
        predictionId,
        actualCensus,
        actualBoardingHours,
        category: 'CLINICAL',
      });

      return success(undefined);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to record actuals', err);
    }
  },

  /**
   * Get prediction accuracy metrics for learning dashboard
   */
  async getAccuracyMetrics(
    facilityId: string,
    days: number = 30
  ): Promise<ServiceResult<PredictionAccuracyMetrics>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('ed_crowding_predictions')
        .select('prediction_horizon_hours, predicted_census, actual_census, crowding_level, actual_crowding_level, prediction_accuracy')
        .eq('facility_id', facilityId)
        .gte('predicted_at', startDate.toISOString())
        .not('actual_census', 'is', null);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      const predictions = data || [];

      if (predictions.length === 0) {
        return success({
          facilityId,
          periodDays: days,
          totalPredictions: 0,
          meanAbsoluteError: 0,
          meanAbsolutePercentageError: 0,
          accuracyByHorizon: { '1h': 0, '4h': 0, '8h': 0 },
          crowdingLevelAccuracy: 0,
          improvingTrend: false,
        });
      }

      // Calculate MAE
      const errors = predictions.map(p => Math.abs((p.actual_census ?? 0) - p.predicted_census));
      const mae = errors.reduce((a, b) => a + b, 0) / errors.length;

      // Calculate MAPE
      const percentageErrors = predictions
        .filter(p => p.actual_census && p.actual_census > 0)
        .map(p => {
          const actual = p.actual_census ?? 0;
          return Math.abs((actual - p.predicted_census) / actual) * 100;
        });
      const mape = percentageErrors.length > 0
        ? percentageErrors.reduce((a, b) => a + b, 0) / percentageErrors.length
        : 0;

      // Accuracy by horizon
      const accuracyByHorizon = {
        '1h': calculateAvgAccuracy(predictions.filter(p => p.prediction_horizon_hours === 1)),
        '4h': calculateAvgAccuracy(predictions.filter(p => p.prediction_horizon_hours === 4)),
        '8h': calculateAvgAccuracy(predictions.filter(p => p.prediction_horizon_hours === 8)),
      };

      // Crowding level accuracy
      const levelMatches = predictions.filter(
        p => p.crowding_level === p.actual_crowding_level
      ).length;
      const crowdingLevelAccuracy = (levelMatches / predictions.length) * 100;

      // Check if improving (compare first half vs second half)
      const mid = Math.floor(predictions.length / 2);
      const firstHalfErrors = errors.slice(0, mid);
      const secondHalfErrors = errors.slice(mid);
      const firstHalfMae = firstHalfErrors.length > 0
        ? firstHalfErrors.reduce((a, b) => a + b, 0) / firstHalfErrors.length
        : 0;
      const secondHalfMae = secondHalfErrors.length > 0
        ? secondHalfErrors.reduce((a, b) => a + b, 0) / secondHalfErrors.length
        : 0;
      const improvingTrend = secondHalfMae < firstHalfMae;

      return success({
        facilityId,
        periodDays: days,
        totalPredictions: predictions.length,
        meanAbsoluteError: Math.round(mae * 10) / 10,
        meanAbsolutePercentageError: Math.round(mape * 10) / 10,
        accuracyByHorizon,
        crowdingLevelAccuracy: Math.round(crowdingLevelAccuracy * 10) / 10,
        improvingTrend,
      });
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to calculate accuracy metrics', err);
    }
  },
};

/**
 * Calculate average accuracy for a set of predictions
 */
function calculateAvgAccuracy(
  predictions: Array<{ prediction_accuracy?: number | null }>
): number {
  const valid = predictions.filter(p => p.prediction_accuracy !== null && p.prediction_accuracy !== undefined);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((a, p) => a + (p.prediction_accuracy ?? 0), 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

export default GuardianFlowEngine;
