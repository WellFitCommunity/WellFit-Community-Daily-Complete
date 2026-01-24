// Bed Optimizer - Capacity Analyzer
// Insights, bottleneck detection, and efficiency calculations

import type { BedBoardEntry, UnitCapacity } from '../../../types/bed';
import type { CapacityInsight, HistoricalCensusSnapshot } from './types';

/**
 * Generate capacity insights and bottleneck analysis
 */
export async function generateCapacityInsights(
  _tenantId: string,
  bedBoard: BedBoardEntry[],
  unitCapacity: UnitCapacity[],
  _historicalData: HistoricalCensusSnapshot[]
): Promise<CapacityInsight[]> {
  const insights: CapacityInsight[] = [];

  // Check for high occupancy units
  unitCapacity.forEach(unit => {
    const occupancy = unit.total_beds > 0 ? unit.occupied / unit.total_beds : 0;

    if (occupancy > 0.95) {
      insights.push({
        insightType: 'warning',
        severity: 'critical',
        title: `${unit.unit_name} at critical capacity`,
        description: `${unit.unit_name} is at ${Math.round(occupancy * 100)}% occupancy with only ${unit.available} beds available.`,
        affectedUnits: [unit.unit_name],
        metrics: { occupancy, available: unit.available },
        recommendations: [
          { action: 'Expedite discharge rounds', priority: 'urgent', estimatedImpact: '1-2 beds freed', timeframe: '2 hours' },
          { action: 'Consider overflow to adjacent unit', priority: 'high', estimatedImpact: 'Prevent diversion', timeframe: 'Immediate' }
        ]
      });
    } else if (occupancy > 0.85) {
      insights.push({
        insightType: 'warning',
        severity: 'warning',
        title: `${unit.unit_name} approaching capacity`,
        description: `${unit.unit_name} is at ${Math.round(occupancy * 100)}% occupancy.`,
        affectedUnits: [unit.unit_name],
        metrics: { occupancy, available: unit.available },
        recommendations: [
          { action: 'Review discharge readiness', priority: 'medium', estimatedImpact: 'Proactive bed management', timeframe: '4 hours' }
        ]
      });
    }
  });

  // Check for dirty bed backlog
  const dirtyBeds = bedBoard.filter(b => b.status === 'dirty' || b.status === 'cleaning');
  if (dirtyBeds.length > 5) {
    insights.push({
      insightType: 'bottleneck',
      severity: 'warning',
      title: 'Bed turnaround backlog detected',
      description: `${dirtyBeds.length} beds waiting for cleaning. This delays admissions.`,
      affectedUnits: [...new Set(dirtyBeds.map(b => b.unit_name))],
      metrics: { dirtyCount: dirtyBeds.length },
      recommendations: [
        { action: 'Add EVS staff to high-priority units', priority: 'high', estimatedImpact: 'Reduce turnaround by 30min', timeframe: '1 hour' },
        { action: 'Prioritize ICU/ED beds for cleaning', priority: 'high', estimatedImpact: 'Critical capacity relief', timeframe: 'Immediate' }
      ]
    });
  }

  // Check for underutilization
  unitCapacity.forEach(unit => {
    const occupancy = unit.total_beds > 0 ? unit.occupied / unit.total_beds : 0;

    if (occupancy < 0.5 && unit.total_beds >= 10) {
      insights.push({
        insightType: 'optimization',
        severity: 'info',
        title: `${unit.unit_name} underutilized`,
        description: `${unit.unit_name} is at ${Math.round(occupancy * 100)}% occupancy. Consider accepting overflow.`,
        affectedUnits: [unit.unit_name],
        metrics: { occupancy, available: unit.available },
        recommendations: [
          { action: 'Accept overflow from high-census units', priority: 'low', estimatedImpact: 'Balance census', timeframe: 'As needed' }
        ]
      });
    }
  });

  return insights;
}

/**
 * Calculate overall efficiency score
 */
export function calculateEfficiencyScore(unitCapacity: UnitCapacity[], _historicalData: HistoricalCensusSnapshot[]): number {
  // Calculate based on turnaround time, discharge timing, and occupancy optimization
  let score = 80; // Base score

  // Adjust for overall occupancy
  const totalBeds = unitCapacity.reduce((sum, u) => sum + u.total_beds, 0);
  const occupiedCount = unitCapacity.reduce((sum, u) => sum + u.occupied, 0);
  const occupancy = totalBeds > 0 ? occupiedCount / totalBeds : 0;

  if (occupancy >= 0.75 && occupancy <= 0.90) {
    score += 10; // Optimal range bonus
  } else if (occupancy < 0.60 || occupancy > 0.95) {
    score -= 15; // Suboptimal penalty
  }

  // Adjust for dirty bed count
  const dirtyCount = unitCapacity.reduce((sum, u) => sum + (u.pending_clean || 0), 0);
  if (dirtyCount > 5) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate unit-level efficiency
 */
export function calculateUnitEfficiency(unit: UnitCapacity): number {
  const occupancy = unit.total_beds > 0 ? unit.occupied / unit.total_beds : 0;
  const targetOccupancy = 0.85;
  return Math.max(0, 100 - Math.abs(occupancy - targetOccupancy) * 100);
}

/**
 * Identify bottlenecks for a unit
 */
export function identifyUnitBottlenecks(unit: UnitCapacity): string[] {
  const bottlenecks: string[] = [];
  const occupancy = unit.total_beds > 0 ? unit.occupied / unit.total_beds : 0;

  if (occupancy > 0.95) bottlenecks.push('Critical occupancy');
  if ((unit.pending_clean || 0) > 2) bottlenecks.push('Bed turnaround delays');
  if (unit.available === 0) bottlenecks.push('No available beds');

  return bottlenecks;
}

/**
 * Identify opportunities for a unit
 */
export function identifyUnitOpportunities(unit: UnitCapacity): string[] {
  const opportunities: string[] = [];
  const occupancy = unit.total_beds > 0 ? unit.occupied / unit.total_beds : 0;

  if (occupancy < 0.70) opportunities.push('Accept overflow patients');
  if (unit.available > 5) opportunities.push('Elective admission capacity');

  return opportunities;
}
