// Bed Optimizer - Capacity Forecaster
// AI-powered capacity forecasting for shifts

import type { MCPCostOptimizer } from '../../mcp/mcp-cost-optimizer';
import type { AccuracyTrackingService } from '../accuracyTrackingService';
import type { BedBoardEntry, UnitCapacity } from '../../../types/bed';
import type { CapacityForecast, HistoricalCensusSnapshot, ScheduledArrival } from './types';
import { parseJSON } from './utils';
import { trackForecast } from './accuracyTracking';

/**
 * Generate AI-powered capacity forecasts for next 3 shifts
 */
export async function generateCapacityForecasts(
  optimizer: MCPCostOptimizer,
  accuracyTracker: AccuracyTrackingService,
  tenantId: string,
  bedBoard: BedBoardEntry[],
  unitCapacity: UnitCapacity[],
  historicalData: HistoricalCensusSnapshot[],
  scheduledArrivals: ScheduledArrival[]
): Promise<CapacityForecast[]> {
  const now = new Date();
  const forecasts: CapacityForecast[] = [];

  // Generate forecasts for next 3 shifts
  const shifts = [
    { period: 'day' as const, hours: 0 },
    { period: 'evening' as const, hours: 8 },
    { period: 'night' as const, hours: 16 }
  ];

  for (const shift of shifts) {
    const forecastDate = new Date(now);
    forecastDate.setHours(7 + shift.hours, 0, 0, 0);
    if (forecastDate < now) {
      forecastDate.setDate(forecastDate.getDate() + 1);
    }

    const forecast = await generateSingleForecast(
      optimizer,
      accuracyTracker,
      tenantId,
      forecastDate,
      shift.period,
      bedBoard,
      unitCapacity,
      historicalData,
      scheduledArrivals
    );

    forecasts.push(forecast);
  }

  return forecasts;
}

/**
 * Generate a single shift forecast using AI
 */
async function generateSingleForecast(
  optimizer: MCPCostOptimizer,
  accuracyTracker: AccuracyTrackingService,
  tenantId: string,
  forecastDate: Date,
  shiftPeriod: 'day' | 'evening' | 'night',
  bedBoard: BedBoardEntry[],
  unitCapacity: UnitCapacity[],
  historicalData: HistoricalCensusSnapshot[],
  scheduledArrivals: ScheduledArrival[]
): Promise<CapacityForecast> {
  const totalBeds = unitCapacity.reduce((sum, u) => sum + u.total_beds, 0);
  const currentCensus = bedBoard.filter(b => b.status === 'occupied').length;
  const dayOfWeek = forecastDate.toLocaleDateString('en-US', { weekday: 'long' });

  // Calculate historical patterns
  const sameDayHistory = historicalData.filter(h => {
    const histDate = new Date(h.snapshot_date);
    return histDate.toLocaleDateString('en-US', { weekday: 'long' }) === dayOfWeek;
  });

  const avgDischarges = sameDayHistory.length > 0
    ? sameDayHistory.reduce((sum, h) => sum + (h.discharges_count || 0), 0) / sameDayHistory.length
    : 5;

  const avgAdmissions = sameDayHistory.length > 0
    ? sameDayHistory.reduce((sum, h) => sum + (h.admissions_count || 0), 0) / sameDayHistory.length
    : 6;

  // Get scheduled arrivals for this date
  const arrivalsForDate = scheduledArrivals.filter(a => {
    const arrivalDate = new Date(a.scheduled_date);
    return arrivalDate.toDateString() === forecastDate.toDateString();
  }).length;

  // Build AI prompt
  const prompt = buildForecastPrompt(
    forecastDate,
    shiftPeriod,
    currentCensus,
    totalBeds,
    unitCapacity,
    avgDischarges,
    avgAdmissions,
    arrivalsForDate,
    dayOfWeek,
    historicalData.slice(-7)
  );

  const systemPrompt = `You are an expert hospital capacity analyst specializing in bed management optimization.
Your role is to predict bed availability and census for the upcoming shift with high accuracy.

PREDICTION METHODOLOGY:
1. Start with current census as baseline
2. Subtract expected discharges (adjusted for day/shift patterns)
3. Add expected admissions (scheduled + unscheduled based on historical)
4. Apply seasonal and day-of-week adjustments
5. Consider pending transfers and observation conversions

SHIFT PATTERNS (typical):
- Day shift (7a-3p): 60-70% of daily discharges, 40% of admissions
- Evening shift (3p-11p): 25-30% of discharges, 35% of admissions
- Night shift (11p-7a): 5-10% of discharges, 25% of admissions (ED surges)

RISK THRESHOLDS:
- Occupancy < 70%: Low risk (underutilization concern)
- Occupancy 70-85%: Moderate risk (optimal range)
- Occupancy 85-95%: High risk (capacity strain)
- Occupancy > 95%: Critical risk (diversion may be needed)

Return response as strict JSON:
{
  "predictedCensus": 85,
  "predictedDischarges": 8,
  "predictedAdmissions": 10,
  "predictedAvailableBeds": 15,
  "confidenceLevel": 0.82,
  "riskLevel": "moderate",
  "capacityUtilization": 0.85,
  "recommendations": ["Consider early discharge rounds", "Monitor ED boarding"],
  "rationale": "Based on historical Tuesday patterns..."
}`;

  try {
    const aiResponse = await optimizer.call({
      prompt,
      systemPrompt,
      model: 'claude-sonnet-4-5-20250929',
      complexity: 'complex',
      userId: tenantId,
      context: {
        forecastType: 'capacity',
        shiftPeriod
      }
    });

    const parsed = parseJSON(aiResponse.response);

    // Safely extract and validate risk level
    const riskLevelValue = parsed.riskLevel as string | undefined;
    const validRiskLevels = ['low', 'moderate', 'high', 'critical'] as const;
    const riskLevel: 'low' | 'moderate' | 'high' | 'critical' =
      validRiskLevels.includes(riskLevelValue as typeof validRiskLevels[number])
        ? (riskLevelValue as 'low' | 'moderate' | 'high' | 'critical')
        : 'moderate';

    const forecast: CapacityForecast = {
      forecastDate: forecastDate.toISOString(),
      shiftPeriod,
      predictedCensus: Number(parsed.predictedCensus) || currentCensus,
      predictedDischarges: Number(parsed.predictedDischarges) || Math.round(avgDischarges),
      predictedAdmissions: Number(parsed.predictedAdmissions) || Math.round(avgAdmissions),
      predictedAvailableBeds: Number(parsed.predictedAvailableBeds) || (totalBeds - currentCensus),
      confidenceLevel: Number(parsed.confidenceLevel) || 0.75,
      riskLevel,
      capacityUtilization: Number(parsed.capacityUtilization) || (currentCensus / totalBeds),
      factors: {
        dayOfWeek,
        historicalPattern: `Avg ${Math.round(avgDischarges)} discharges, ${Math.round(avgAdmissions)} admissions`,
        scheduledArrivals: arrivalsForDate,
        expectedDischarges: Math.round(avgDischarges),
        pendingTransfers: 0,
        seasonalAdjustment: 1.0
      },
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations as string[] : [],
      aiModel: aiResponse.model,
      aiCost: aiResponse.cost
    };

    // Track prediction for accuracy monitoring
    await trackForecast(accuracyTracker, tenantId, forecast);

    return forecast;
  } catch {
    // Return fallback forecast if AI fails
    return {
      forecastDate: forecastDate.toISOString(),
      shiftPeriod,
      predictedCensus: currentCensus,
      predictedDischarges: Math.round(avgDischarges),
      predictedAdmissions: Math.round(avgAdmissions),
      predictedAvailableBeds: totalBeds - currentCensus,
      confidenceLevel: 0.5,
      riskLevel: 'moderate',
      capacityUtilization: currentCensus / totalBeds,
      factors: {
        dayOfWeek,
        historicalPattern: 'Fallback calculation',
        scheduledArrivals: arrivalsForDate,
        expectedDischarges: Math.round(avgDischarges),
        pendingTransfers: 0,
        seasonalAdjustment: 1.0
      },
      recommendations: ['AI prediction unavailable - using statistical fallback'],
      aiModel: 'fallback',
      aiCost: 0
    };
  }
}

/**
 * Build forecast prompt for AI
 */
function buildForecastPrompt(
  forecastDate: Date,
  shiftPeriod: string,
  currentCensus: number,
  totalBeds: number,
  unitCapacity: UnitCapacity[],
  avgDischarges: number,
  avgAdmissions: number,
  scheduledArrivals: number,
  dayOfWeek: string,
  recentHistory: HistoricalCensusSnapshot[]
): string {
  let prompt = `Predict hospital bed capacity for ${dayOfWeek} ${shiftPeriod} shift (${forecastDate.toLocaleDateString()}):\n\n`;

  prompt += `=== CURRENT STATE ===\n`;
  prompt += `- Total beds: ${totalBeds}\n`;
  prompt += `- Current census: ${currentCensus}\n`;
  prompt += `- Current occupancy: ${((currentCensus / totalBeds) * 100).toFixed(1)}%\n`;
  prompt += `- Available beds: ${totalBeds - currentCensus}\n\n`;

  prompt += `=== UNIT BREAKDOWN ===\n`;
  unitCapacity.forEach(u => {
    const occ = u.total_beds > 0 ? ((u.occupied / u.total_beds) * 100).toFixed(0) : 0;
    prompt += `- ${u.unit_name}: ${u.occupied}/${u.total_beds} (${occ}%)\n`;
  });

  prompt += `\n=== HISTORICAL PATTERNS (${dayOfWeek}s) ===\n`;
  prompt += `- Average discharges: ${avgDischarges.toFixed(1)}\n`;
  prompt += `- Average admissions: ${avgAdmissions.toFixed(1)}\n`;
  prompt += `- Scheduled arrivals for this date: ${scheduledArrivals}\n`;

  prompt += `\n=== RECENT 7-DAY TREND ===\n`;
  recentHistory.forEach(h => {
    const date = new Date(h.snapshot_date).toLocaleDateString();
    prompt += `- ${date}: Census=${h.midnight_census || h.eod_census}, D/C=${h.discharges_count || 0}, Adm=${h.admissions_count || 0}\n`;
  });

  prompt += `\n=== TASK ===\n`;
  prompt += `Predict census, discharges, and admissions for the ${shiftPeriod} shift.\n`;
  prompt += `Assess capacity risk level and provide actionable recommendations.\n`;
  prompt += `Consider ${dayOfWeek} patterns and the ${shiftPeriod} shift characteristics.\n`;

  return prompt;
}
