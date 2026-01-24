// Bed Optimizer - Accuracy Tracking
// ML outcome logging for prediction monitoring

import type { AccuracyTrackingService } from '../accuracyTrackingService';
import type {
  OptimizationReport,
  CapacityForecast,
  IncomingPatient,
  BedAssignmentRecommendation,
} from './types';

/**
 * Track optimization report generation for accuracy monitoring
 */
export async function trackOptimizationReport(
  accuracyTracker: AccuracyTrackingService,
  tenantId: string,
  report: OptimizationReport
): Promise<void> {
  try {
    await accuracyTracker.recordPrediction({
      tenantId,
      skillName: 'bed_optimization',
      predictionType: 'structured',
      predictionValue: {
        capacityScore: report.overallCapacityScore,
        efficiencyScore: report.overallEfficiencyScore,
        occupancyRate: report.currentOccupancyRate,
        forecastCount: report.forecasts.length,
        insightCount: report.insights.length
      },
      confidence: 0.85,
      model: report.aiModel,
      costUsd: report.totalAiCost
    });
  } catch {
    // Don't fail the report if tracking fails
  }
}

/**
 * Track capacity forecast prediction for accuracy monitoring
 */
export async function trackForecast(
  accuracyTracker: AccuracyTrackingService,
  tenantId: string,
  forecast: CapacityForecast
): Promise<void> {
  try {
    await accuracyTracker.recordPrediction({
      tenantId,
      skillName: 'bed_capacity_forecast',
      predictionType: 'score',
      predictionValue: {
        predictedCensus: forecast.predictedCensus,
        predictedDischarges: forecast.predictedDischarges,
        predictedAdmissions: forecast.predictedAdmissions,
        riskLevel: forecast.riskLevel,
        shiftPeriod: forecast.shiftPeriod
      },
      confidence: forecast.confidenceLevel,
      entityType: 'shift_forecast',
      entityId: `${forecast.forecastDate}_${forecast.shiftPeriod}`,
      model: forecast.aiModel,
      costUsd: forecast.aiCost
    });
  } catch {
    // Don't fail if tracking fails
  }
}

/**
 * Track bed assignment recommendation for accuracy monitoring
 */
export async function trackBedAssignment(
  accuracyTracker: AccuracyTrackingService,
  tenantId: string,
  patient: IncomingPatient,
  recommendation: BedAssignmentRecommendation
): Promise<void> {
  try {
    await accuracyTracker.recordPrediction({
      tenantId,
      skillName: 'bed_assignment',
      predictionType: 'classification',
      predictionValue: {
        recommendedBedId: recommendation.recommendedBedId,
        matchScore: recommendation.matchScore,
        patientAcuity: patient.acuityLevel,
        requiresTelemetry: patient.requiresTelemetry,
        requiresIsolation: patient.requiresIsolation
      },
      confidence: recommendation.matchScore / 100,
      patientId: patient.patientId,
      entityType: 'bed_assignment',
      entityId: recommendation.recommendedBedId,
      model: 'claude-sonnet-4-5-20250929'
    });
  } catch {
    // Don't fail if tracking fails
  }
}
