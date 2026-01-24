// Bed Optimizer Service - Main Orchestrator
// AI-powered bed capacity optimization for hospital operations

import { supabase } from '../../../lib/supabaseClient';
import { mcpOptimizer } from '../../mcp/mcpCostOptimizer';
import type { MCPCostOptimizer } from '../../mcp/mcpCostOptimizer';
import { createAccuracyTrackingService, type AccuracyTrackingService } from '../accuracyTrackingService';
import { ServiceResult, success, failure } from '../../_base';

// Import domain modules
import { generateCapacityForecasts } from './capacityForecaster';
import { generateDischargeRecommendations } from './dischargePlanner';
import { recommendBedAssignment } from './bedAssignmentMatcher';
import {
  generateCapacityInsights,
  calculateEfficiencyScore,
  calculateUnitEfficiency,
  identifyUnitBottlenecks,
  identifyUnitOpportunities
} from './capacityAnalyzer';
import { trackOptimizationReport } from './accuracyTracking';
import {
  getBedBoard,
  getUnitCapacity,
  getHistoricalCensusData,
  getScheduledArrivals,
  getLOSBenchmarks
} from './dataAccess';
import { BedOptimizerValidator } from './validator';

// Re-export all public types
export type {
  CapacityForecast,
  DischargeRecommendation,
  BedAssignmentRecommendation,
  CapacityInsight,
  OptimizationReport,
  IncomingPatient,
  HistoricalCensusSnapshot,
  ScheduledArrival,
  LOSBenchmark,
  AvailableBedWithUnit
} from './types';

// Re-export individual modules for direct access
export { generateCapacityForecasts } from './capacityForecaster';
export { generateDischargeRecommendations } from './dischargePlanner';
export { recommendBedAssignment } from './bedAssignmentMatcher';
export {
  generateCapacityInsights,
  calculateEfficiencyScore,
  calculateUnitEfficiency,
  identifyUnitBottlenecks,
  identifyUnitOpportunities
} from './capacityAnalyzer';
export { BedOptimizerValidator } from './validator';

// Import types for internal use
import type { OptimizationReport, IncomingPatient, BedAssignmentRecommendation } from './types';

/**
 * BedOptimizerService - Main orchestrator for bed optimization
 *
 * Provides AI-powered hospital bed management:
 * - Multi-factor capacity forecasting with confidence intervals
 * - Discharge timing recommendations
 * - Smart bed matching for incoming patients
 * - Bottleneck identification and insights
 */
export class BedOptimizerService {
  private optimizer: MCPCostOptimizer;
  private accuracyTracker: AccuracyTrackingService;

  constructor(optimizer?: MCPCostOptimizer) {
    this.optimizer = optimizer || mcpOptimizer;
    this.accuracyTracker = createAccuracyTrackingService(supabase);
  }

  /**
   * Generate comprehensive capacity optimization report
   * Main entry point for bed optimization
   */
  async generateOptimizationReport(tenantId: string): Promise<ServiceResult<OptimizationReport>> {
    BedOptimizerValidator.validateUUID(tenantId, 'tenantId');

    try {
      // Gather all required data in parallel
      const [
        bedBoard,
        unitCapacity,
        historicalData,
        scheduledArrivals,
        losBenchmarks
      ] = await Promise.all([
        getBedBoard(tenantId),
        getUnitCapacity(tenantId),
        getHistoricalCensusData(tenantId, 30),
        getScheduledArrivals(tenantId, 3),
        getLOSBenchmarks(tenantId)
      ]);

      // Generate AI-powered forecasts for next 3 shifts
      const forecasts = await generateCapacityForecasts(
        this.optimizer,
        this.accuracyTracker,
        tenantId,
        bedBoard,
        unitCapacity,
        historicalData,
        scheduledArrivals
      );

      // Generate discharge recommendations
      const dischargeRecs = await generateDischargeRecommendations(
        this.optimizer,
        tenantId,
        bedBoard,
        losBenchmarks
      );

      // Generate capacity insights
      const insights = await generateCapacityInsights(
        tenantId,
        bedBoard,
        unitCapacity,
        historicalData
      );

      // Calculate overall scores
      const totalBeds = unitCapacity.reduce((sum, u) => sum + u.total_beds, 0);
      const occupiedBeds = unitCapacity.reduce((sum, u) => sum + u.occupied, 0);
      const occupancyRate = totalBeds > 0 ? occupiedBeds / totalBeds : 0;
      const targetOccupancy = 0.85; // Industry standard

      const capacityScore = Math.max(0, Math.min(100,
        100 - Math.abs(occupancyRate - targetOccupancy) * 200
      ));

      const efficiencyScore = calculateEfficiencyScore(unitCapacity, historicalData);

      const totalAiCost = forecasts.reduce((sum, f) => sum + f.aiCost, 0);

      const report: OptimizationReport = {
        generatedAt: new Date().toISOString(),
        overallCapacityScore: Math.round(capacityScore),
        overallEfficiencyScore: Math.round(efficiencyScore),
        currentOccupancyRate: Math.round(occupancyRate * 100) / 100,
        targetOccupancyRate: targetOccupancy,
        forecasts,
        dischargeRecommendations: dischargeRecs,
        insights,
        unitBreakdown: unitCapacity.map(u => ({
          unitId: u.unit_id,
          unitName: u.unit_name,
          occupancy: u.total_beds > 0 ? u.occupied / u.total_beds : 0,
          efficiency: calculateUnitEfficiency(u),
          bottlenecks: identifyUnitBottlenecks(u),
          opportunities: identifyUnitOpportunities(u)
        })),
        aiModel: 'claude-sonnet-4-5-20250929',
        totalAiCost
      };

      // Track the optimization report for accuracy monitoring
      await trackOptimizationReport(this.accuracyTracker, tenantId, report);

      return success(report);
    } catch (err: unknown) {
      return failure('OPERATION_FAILED', `Failed to generate optimization report: ${err instanceof Error ? err.message : 'Unknown error'}`, err);
    }
  }

  /**
   * Recommend optimal bed for incoming patient
   */
  async recommendBedAssignment(
    tenantId: string,
    patient: IncomingPatient
  ): Promise<ServiceResult<BedAssignmentRecommendation>> {
    return recommendBedAssignment(
      this.optimizer,
      this.accuracyTracker,
      tenantId,
      patient
    );
  }
}

// Export singleton instance
export const bedOptimizer = new BedOptimizerService();
