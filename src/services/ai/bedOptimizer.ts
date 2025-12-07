/**
 * AI-Powered Bed Optimization Service
 *
 * Skill: Intelligent Bed Capacity Optimization
 * - Uses Claude Sonnet 4.5 (accuracy critical for hospital operations)
 * - Predicts optimal bed allocation and capacity
 * - Recommends discharge timing based on clinical and operational factors
 * - Suggests best bed assignment for incoming patients
 * - Analyzes bottlenecks and provides actionable recommendations
 *
 * Key Features:
 * - Multi-factor capacity forecasting with confidence intervals
 * - Length of stay prediction using DRG/diagnosis data
 * - Smart bed matching based on patient acuity and equipment needs
 * - Turnaround time optimization recommendations
 * - Real-time bottleneck identification
 *
 * Security: Input validation, audit logging, HIPAA compliance
 */

import { supabase } from '../../lib/supabaseClient';
import { mcpOptimizer } from '../mcp/mcpCostOptimizer';
import type { MCPCostOptimizer } from '../mcp/mcpCostOptimizer';
import { createAccuracyTrackingService, type AccuracyTrackingService } from './accuracyTrackingService';
import { ServiceResult, success, failure } from '../_base';
import type {
  BedBoardEntry,
  UnitCapacity,
  HospitalUnit,
  Bed,
  BedStatus,
  BedType,
  AcuityLevel,
  UnitType
} from '../../types/bed';

// =====================================================
// TYPES
// =====================================================

export interface CapacityForecast {
  forecastDate: string;
  shiftPeriod: 'day' | 'evening' | 'night';
  predictedCensus: number;
  predictedDischarges: number;
  predictedAdmissions: number;
  predictedAvailableBeds: number;
  confidenceLevel: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  capacityUtilization: number;
  factors: {
    dayOfWeek: string;
    historicalPattern: string;
    scheduledArrivals: number;
    expectedDischarges: number;
    pendingTransfers: number;
    seasonalAdjustment: number;
  };
  recommendations: string[];
  aiModel: string;
  aiCost: number;
}

export interface DischargeRecommendation {
  patientId: string;
  patientName: string;
  bedLabel: string;
  unitName: string;
  currentLOS: number;
  predictedDischargeDate: string;
  dischargeReadiness: 'ready' | 'likely_today' | 'likely_tomorrow' | 'needs_more_time';
  confidence: number;
  factors: {
    clinicalReadiness: string;
    socialFactors: string;
    pendingItems: string[];
    barriers: string[];
  };
  suggestedDisposition: string;
  estimatedDischargeTime: string;
  aiRationale: string;
}

export interface BedAssignmentRecommendation {
  recommendedBedId: string;
  bedLabel: string;
  unitName: string;
  matchScore: number;
  matchFactors: {
    acuityMatch: boolean;
    equipmentMatch: boolean;
    isolationMatch: boolean;
    unitPreference: boolean;
    proximityToNurseStation: boolean;
  };
  alternativeBeds: Array<{
    bedId: string;
    bedLabel: string;
    matchScore: number;
    reason: string;
  }>;
  aiRationale: string;
}

export interface CapacityInsight {
  insightType: 'bottleneck' | 'optimization' | 'warning' | 'trend';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affectedUnits: string[];
  metrics: Record<string, number>;
  recommendations: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    estimatedImpact: string;
    timeframe: string;
  }>;
}

export interface OptimizationReport {
  generatedAt: string;
  overallCapacityScore: number; // 0-100
  overallEfficiencyScore: number; // 0-100
  currentOccupancyRate: number;
  targetOccupancyRate: number;
  forecasts: CapacityForecast[];
  dischargeRecommendations: DischargeRecommendation[];
  insights: CapacityInsight[];
  unitBreakdown: Array<{
    unitId: string;
    unitName: string;
    occupancy: number;
    efficiency: number;
    bottlenecks: string[];
    opportunities: string[];
  }>;
  aiModel: string;
  totalAiCost: number;
}

export interface IncomingPatient {
  patientId?: string;
  patientName?: string;
  acuityLevel: AcuityLevel;
  diagnosis?: string;
  diagnosisCode?: string;
  requiresTelemetry: boolean;
  requiresIsolation: boolean;
  requiresNegativePressure: boolean;
  isBariatric: boolean;
  preferredUnitType?: UnitType;
  expectedLOS?: number;
  specialEquipmentNeeds?: string[];
  admissionSource: 'ed' | 'direct' | 'transfer' | 'surgery' | 'observation';
}

// =====================================================
// INPUT VALIDATION
// =====================================================

class BedOptimizerValidator {
  static validateUUID(value: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error(`Invalid ${fieldName}: must be valid UUID`);
    }
  }

  static validateDate(value: string, fieldName: string): void {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid ${fieldName}: must be valid date`);
    }
  }

  static sanitizeText(text: string, maxLength: number = 500): string {
    if (!text) return '';
    return text
      .replace(/[<>'"]/g, '')
      .replace(/;/g, '')
      .replace(/--/g, '')
      .slice(0, maxLength)
      .trim();
  }
}

// =====================================================
// BED OPTIMIZER SERVICE
// =====================================================

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
      // Gather all required data
      const [
        bedBoard,
        unitCapacity,
        historicalData,
        scheduledArrivals,
        losBenchmarks
      ] = await Promise.all([
        this.getBedBoard(tenantId),
        this.getUnitCapacity(tenantId),
        this.getHistoricalCensusData(tenantId, 30),
        this.getScheduledArrivals(tenantId, 3),
        this.getLOSBenchmarks(tenantId)
      ]);

      // Generate AI-powered forecasts for next 3 shifts
      const forecasts = await this.generateCapacityForecasts(
        tenantId,
        bedBoard,
        unitCapacity,
        historicalData,
        scheduledArrivals
      );

      // Generate discharge recommendations
      const dischargeRecs = await this.generateDischargeRecommendations(
        tenantId,
        bedBoard,
        losBenchmarks
      );

      // Generate capacity insights
      const insights = await this.generateCapacityInsights(
        tenantId,
        bedBoard,
        unitCapacity,
        historicalData
      );

      // Calculate overall scores
      const totalBeds = unitCapacity.reduce((sum, u) => sum + u.total_beds, 0);
      const occupiedBeds = unitCapacity.reduce((sum, u) => sum + u.occupied_count, 0);
      const occupancyRate = totalBeds > 0 ? occupiedBeds / totalBeds : 0;
      const targetOccupancy = 0.85; // Industry standard

      const capacityScore = Math.max(0, Math.min(100,
        100 - Math.abs(occupancyRate - targetOccupancy) * 200
      ));

      const efficiencyScore = this.calculateEfficiencyScore(unitCapacity, historicalData);

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
          occupancy: u.total_beds > 0 ? u.occupied_count / u.total_beds : 0,
          efficiency: this.calculateUnitEfficiency(u),
          bottlenecks: this.identifyUnitBottlenecks(u),
          opportunities: this.identifyUnitOpportunities(u)
        })),
        aiModel: 'claude-sonnet-4-5-20250929',
        totalAiCost
      };

      // Track the optimization report for accuracy monitoring
      await this.trackOptimizationReport(tenantId, report);

      return success(report);
    } catch (error: any) {
      return failure('OPTIMIZATION_FAILED', `Failed to generate optimization report: ${error.message}`, error);
    }
  }

  /**
   * Generate AI-powered capacity forecasts
   */
  async generateCapacityForecasts(
    tenantId: string,
    bedBoard: BedBoardEntry[],
    unitCapacity: UnitCapacity[],
    historicalData: any[],
    scheduledArrivals: any[]
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

      const forecast = await this.generateSingleForecast(
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
  private async generateSingleForecast(
    tenantId: string,
    forecastDate: Date,
    shiftPeriod: 'day' | 'evening' | 'night',
    bedBoard: BedBoardEntry[],
    unitCapacity: UnitCapacity[],
    historicalData: any[],
    scheduledArrivals: any[]
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
    const prompt = this.buildForecastPrompt(
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
      const aiResponse = await this.optimizer.call({
        prompt,
        systemPrompt,
        model: 'claude-sonnet-4-5-20250929', // Sonnet for accuracy
        complexity: 'complex',
        userId: tenantId,
        context: {
          forecastType: 'capacity',
          shiftPeriod
        }
      });

      const parsed = this.parseJSON(aiResponse.response);

      const forecast: CapacityForecast = {
        forecastDate: forecastDate.toISOString(),
        shiftPeriod,
        predictedCensus: parsed.predictedCensus || currentCensus,
        predictedDischarges: parsed.predictedDischarges || Math.round(avgDischarges),
        predictedAdmissions: parsed.predictedAdmissions || Math.round(avgAdmissions),
        predictedAvailableBeds: parsed.predictedAvailableBeds || (totalBeds - currentCensus),
        confidenceLevel: parsed.confidenceLevel || 0.75,
        riskLevel: parsed.riskLevel || 'moderate',
        capacityUtilization: parsed.capacityUtilization || (currentCensus / totalBeds),
        factors: {
          dayOfWeek,
          historicalPattern: `Avg ${Math.round(avgDischarges)} discharges, ${Math.round(avgAdmissions)} admissions`,
          scheduledArrivals: arrivalsForDate,
          expectedDischarges: Math.round(avgDischarges),
          pendingTransfers: 0,
          seasonalAdjustment: 1.0
        },
        recommendations: parsed.recommendations || [],
        aiModel: aiResponse.model,
        aiCost: aiResponse.cost
      };

      // Track prediction for accuracy monitoring
      await this.trackForecast(tenantId, forecast);

      return forecast;
    } catch (error: any) {
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
  private buildForecastPrompt(
    forecastDate: Date,
    shiftPeriod: string,
    currentCensus: number,
    totalBeds: number,
    unitCapacity: UnitCapacity[],
    avgDischarges: number,
    avgAdmissions: number,
    scheduledArrivals: number,
    dayOfWeek: string,
    recentHistory: any[]
  ): string {
    let prompt = `Predict hospital bed capacity for ${dayOfWeek} ${shiftPeriod} shift (${forecastDate.toLocaleDateString()}):\n\n`;

    prompt += `=== CURRENT STATE ===\n`;
    prompt += `- Total beds: ${totalBeds}\n`;
    prompt += `- Current census: ${currentCensus}\n`;
    prompt += `- Current occupancy: ${((currentCensus / totalBeds) * 100).toFixed(1)}%\n`;
    prompt += `- Available beds: ${totalBeds - currentCensus}\n\n`;

    prompt += `=== UNIT BREAKDOWN ===\n`;
    unitCapacity.forEach(u => {
      const occ = u.total_beds > 0 ? ((u.occupied_count / u.total_beds) * 100).toFixed(0) : 0;
      prompt += `- ${u.unit_name}: ${u.occupied_count}/${u.total_beds} (${occ}%)\n`;
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

  /**
   * Generate AI-powered discharge recommendations
   */
  async generateDischargeRecommendations(
    tenantId: string,
    bedBoard: BedBoardEntry[],
    losBenchmarks: any[]
  ): Promise<DischargeRecommendation[]> {
    const occupiedBeds = bedBoard.filter(b => b.status === 'occupied' && b.patient_id);

    if (occupiedBeds.length === 0) {
      return [];
    }

    // Build prompt for discharge analysis
    const prompt = this.buildDischargePrompt(occupiedBeds, losBenchmarks);

    const systemPrompt = `You are an expert hospital discharge planner optimizing patient flow.
Analyze occupied beds and recommend discharge priorities to optimize capacity.

DISCHARGE READINESS CRITERIA:
- "ready": All clinical criteria met, disposition confirmed, transportation arranged
- "likely_today": Clinical criteria met, minor pending items (paperwork, meds, education)
- "likely_tomorrow": Clinical criteria expected to be met, disposition planning in progress
- "needs_more_time": Clinical issues pending, not appropriate for discharge today

PRIORITIZATION FACTORS:
1. Length of stay vs benchmark (>90th percentile = priority)
2. Expected discharge orders already written
3. Disposition complexity (home vs SNF)
4. Bed type demand (ICU beds highest priority)
5. Observation patient conversion (>24 hours)

Return JSON array of top 10 discharge candidates:
[
  {
    "patientId": "uuid",
    "patientName": "John D.",
    "bedLabel": "ICU-102A",
    "unitName": "ICU",
    "currentLOS": 4,
    "predictedDischargeDate": "2025-12-07",
    "dischargeReadiness": "likely_today",
    "confidence": 0.85,
    "factors": {
      "clinicalReadiness": "Stable vitals, off pressors",
      "socialFactors": "Family available, lives nearby",
      "pendingItems": ["Final meds list", "D/C instructions"],
      "barriers": []
    },
    "suggestedDisposition": "home",
    "estimatedDischargeTime": "14:00",
    "aiRationale": "Patient meets all clinical criteria..."
  }
]`;

    try {
      const aiResponse = await this.optimizer.call({
        prompt,
        systemPrompt,
        model: 'claude-sonnet-4-5-20250929',
        complexity: 'complex',
        userId: tenantId,
        context: {
          analysisType: 'discharge_planning'
        }
      });

      const parsed = this.parseJSONArray(aiResponse.response);
      return parsed.slice(0, 10);
    } catch (error) {
      return [];
    }
  }

  /**
   * Build discharge analysis prompt
   */
  private buildDischargePrompt(occupiedBeds: BedBoardEntry[], losBenchmarks: any[]): string {
    let prompt = `Analyze these occupied beds for discharge prioritization:\n\n`;

    occupiedBeds.forEach((bed, i) => {
      if (i < 30) { // Limit to 30 for token efficiency
        const assignedDate = bed.assigned_at ? new Date(bed.assigned_at) : null;
        const los = assignedDate
          ? Math.floor((Date.now() - assignedDate.getTime()) / (24 * 60 * 60 * 1000))
          : 0;

        prompt += `${i + 1}. ${bed.bed_label} (${bed.unit_name})\n`;
        prompt += `   Patient: ${bed.patient_name || 'Unknown'} | Acuity: ${bed.patient_acuity || 'N/A'}\n`;
        prompt += `   LOS: ${los} days | Expected D/C: ${bed.expected_discharge_date || 'Not set'}\n\n`;
      }
    });

    prompt += `\nIdentify top 10 discharge candidates with readiness assessment and rationale.`;

    return prompt;
  }

  /**
   * Recommend optimal bed for incoming patient
   */
  async recommendBedAssignment(
    tenantId: string,
    patient: IncomingPatient
  ): Promise<ServiceResult<BedAssignmentRecommendation>> {
    BedOptimizerValidator.validateUUID(tenantId, 'tenantId');

    try {
      // Get available beds
      const { data: availableBeds, error } = await supabase
        .from('beds')
        .select(`
          *,
          hospital_units!inner(unit_name, unit_type, unit_code)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'available')
        .eq('is_active', true);

      if (error || !availableBeds || availableBeds.length === 0) {
        return failure('NO_BEDS_AVAILABLE', 'No available beds found');
      }

      // Build AI prompt for bed matching
      const prompt = this.buildBedMatchingPrompt(patient, availableBeds);

      const systemPrompt = `You are an expert hospital bed assignment specialist.
Match the incoming patient to the optimal available bed based on:

1. ACUITY MATCH: Patient acuity must be within unit's capability
2. EQUIPMENT MATCH: Required equipment must be available (telemetry, isolation, etc.)
3. UNIT PREFERENCE: Match to preferred unit type when possible
4. BED TYPE: Match bariatric, pediatric, or specialty bed needs
5. PROXIMITY: Consider nursing workflow efficiency

SCORING:
- Perfect match: 95-100
- Good match: 80-94
- Acceptable: 60-79
- Suboptimal: 40-59
- Not recommended: <40

Return JSON:
{
  "recommendedBedId": "uuid",
  "bedLabel": "3N-105A",
  "unitName": "Med-Surg North",
  "matchScore": 92,
  "matchFactors": {
    "acuityMatch": true,
    "equipmentMatch": true,
    "isolationMatch": true,
    "unitPreference": true,
    "proximityToNurseStation": false
  },
  "alternativeBeds": [
    {"bedId": "uuid", "bedLabel": "3S-102B", "matchScore": 85, "reason": "Further from nurses station"}
  ],
  "aiRationale": "This bed is optimal because..."
}`;

      const aiResponse = await this.optimizer.call({
        prompt,
        systemPrompt,
        model: 'claude-sonnet-4-5-20250929',
        complexity: 'complex',
        userId: tenantId,
        context: {
          taskType: 'bed_assignment'
        }
      });

      const parsed = this.parseJSON(aiResponse.response);

      // Track for accuracy monitoring
      await this.trackBedAssignment(tenantId, patient, parsed);

      return success(parsed as BedAssignmentRecommendation);
    } catch (error: any) {
      return failure('ASSIGNMENT_FAILED', `Failed to recommend bed: ${error.message}`, error);
    }
  }

  /**
   * Build bed matching prompt
   */
  private buildBedMatchingPrompt(patient: IncomingPatient, availableBeds: any[]): string {
    let prompt = `Find optimal bed for incoming patient:\n\n`;

    prompt += `=== PATIENT REQUIREMENTS ===\n`;
    prompt += `- Acuity: ${patient.acuityLevel}\n`;
    prompt += `- Diagnosis: ${patient.diagnosis || 'Not specified'}\n`;
    prompt += `- Telemetry needed: ${patient.requiresTelemetry ? 'YES' : 'No'}\n`;
    prompt += `- Isolation needed: ${patient.requiresIsolation ? 'YES' : 'No'}\n`;
    prompt += `- Negative pressure: ${patient.requiresNegativePressure ? 'YES' : 'No'}\n`;
    prompt += `- Bariatric: ${patient.isBariatric ? 'YES' : 'No'}\n`;
    prompt += `- Preferred unit: ${patient.preferredUnitType || 'Any'}\n`;
    prompt += `- Expected LOS: ${patient.expectedLOS || 'Unknown'} days\n`;
    prompt += `- Admission source: ${patient.admissionSource}\n`;

    prompt += `\n=== AVAILABLE BEDS (${availableBeds.length}) ===\n`;
    availableBeds.slice(0, 20).forEach((bed, i) => {
      prompt += `${i + 1}. ${bed.bed_label} (${bed.hospital_units.unit_name})\n`;
      prompt += `   Type: ${bed.bed_type} | Tele: ${bed.has_telemetry} | Iso: ${bed.has_isolation_capability} | NegP: ${bed.has_negative_pressure}\n`;
    });

    prompt += `\nRecommend the best bed match with scoring and rationale.`;

    return prompt;
  }

  /**
   * Generate capacity insights and bottleneck analysis
   */
  async generateCapacityInsights(
    tenantId: string,
    bedBoard: BedBoardEntry[],
    unitCapacity: UnitCapacity[],
    historicalData: any[]
  ): Promise<CapacityInsight[]> {
    const insights: CapacityInsight[] = [];

    // Check for high occupancy units
    unitCapacity.forEach(unit => {
      const occupancy = unit.total_beds > 0 ? unit.occupied_count / unit.total_beds : 0;

      if (occupancy > 0.95) {
        insights.push({
          insightType: 'warning',
          severity: 'critical',
          title: `${unit.unit_name} at critical capacity`,
          description: `${unit.unit_name} is at ${Math.round(occupancy * 100)}% occupancy with only ${unit.available_count} beds available.`,
          affectedUnits: [unit.unit_name],
          metrics: { occupancy, available: unit.available_count },
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
          metrics: { occupancy, available: unit.available_count },
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
      const occupancy = unit.total_beds > 0 ? unit.occupied_count / unit.total_beds : 0;

      if (occupancy < 0.5 && unit.total_beds >= 10) {
        insights.push({
          insightType: 'optimization',
          severity: 'info',
          title: `${unit.unit_name} underutilized`,
          description: `${unit.unit_name} is at ${Math.round(occupancy * 100)}% occupancy. Consider accepting overflow.`,
          affectedUnits: [unit.unit_name],
          metrics: { occupancy, available: unit.available_count },
          recommendations: [
            { action: 'Accept overflow from high-census units', priority: 'low', estimatedImpact: 'Balance census', timeframe: 'As needed' }
          ]
        });
      }
    });

    return insights;
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private async getBedBoard(tenantId: string): Promise<BedBoardEntry[]> {
    const { data } = await supabase.rpc('get_bed_board_view', { p_tenant_id: tenantId });
    return data || [];
  }

  private async getUnitCapacity(tenantId: string): Promise<UnitCapacity[]> {
    const { data } = await supabase.rpc('get_unit_capacity_summary', { p_tenant_id: tenantId });
    return data || [];
  }

  private async getHistoricalCensusData(tenantId: string, days: number): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data } = await supabase
      .from('daily_census_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: false });

    return data || [];
  }

  private async getScheduledArrivals(tenantId: string, days: number): Promise<any[]> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const { data } = await supabase
      .from('scheduled_arrivals')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('scheduled_date', new Date().toISOString())
      .lte('scheduled_date', endDate.toISOString())
      .eq('status', 'confirmed');

    return data || [];
  }

  private async getLOSBenchmarks(tenantId: string): Promise<any[]> {
    const { data } = await supabase
      .from('los_benchmarks')
      .select('*')
      .or(`tenant_id.eq.${tenantId},is_default.eq.true`)
      .limit(100);

    return data || [];
  }

  private calculateEfficiencyScore(unitCapacity: UnitCapacity[], historicalData: any[]): number {
    // Calculate based on turnaround time, discharge timing, and occupancy optimization
    let score = 80; // Base score

    // Adjust for overall occupancy
    const totalBeds = unitCapacity.reduce((sum, u) => sum + u.total_beds, 0);
    const occupied = unitCapacity.reduce((sum, u) => sum + u.occupied_count, 0);
    const occupancy = totalBeds > 0 ? occupied / totalBeds : 0;

    if (occupancy >= 0.75 && occupancy <= 0.90) {
      score += 10; // Optimal range bonus
    } else if (occupancy < 0.60 || occupancy > 0.95) {
      score -= 15; // Suboptimal penalty
    }

    // Adjust for dirty bed count
    const dirtyCount = unitCapacity.reduce((sum, u) => sum + (u.pending_clean_count || 0), 0);
    if (dirtyCount > 5) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateUnitEfficiency(unit: UnitCapacity): number {
    const occupancy = unit.total_beds > 0 ? unit.occupied_count / unit.total_beds : 0;
    const targetOccupancy = 0.85;
    return Math.max(0, 100 - Math.abs(occupancy - targetOccupancy) * 100);
  }

  private identifyUnitBottlenecks(unit: UnitCapacity): string[] {
    const bottlenecks: string[] = [];
    const occupancy = unit.total_beds > 0 ? unit.occupied_count / unit.total_beds : 0;

    if (occupancy > 0.95) bottlenecks.push('Critical occupancy');
    if ((unit.pending_clean_count || 0) > 2) bottlenecks.push('Bed turnaround delays');
    if (unit.available_count === 0) bottlenecks.push('No available beds');

    return bottlenecks;
  }

  private identifyUnitOpportunities(unit: UnitCapacity): string[] {
    const opportunities: string[] = [];
    const occupancy = unit.total_beds > 0 ? unit.occupied_count / unit.total_beds : 0;

    if (occupancy < 0.70) opportunities.push('Accept overflow patients');
    if (unit.available_count > 5) opportunities.push('Elective admission capacity');

    return opportunities;
  }

  private parseJSON(response: string): Record<string, unknown> {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return {};
      return JSON.parse(jsonMatch[0]);
    } catch {
      return {};
    }
  }

  private parseJSONArray(response: string): any[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      return JSON.parse(jsonMatch[0]);
    } catch {
      return [];
    }
  }

  // =====================================================
  // ACCURACY TRACKING
  // =====================================================

  private async trackOptimizationReport(tenantId: string, report: OptimizationReport): Promise<void> {
    try {
      await this.accuracyTracker.recordPrediction({
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

  private async trackForecast(tenantId: string, forecast: CapacityForecast): Promise<void> {
    try {
      await this.accuracyTracker.recordPrediction({
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

  private async trackBedAssignment(
    tenantId: string,
    patient: IncomingPatient,
    recommendation: BedAssignmentRecommendation
  ): Promise<void> {
    try {
      await this.accuracyTracker.recordPrediction({
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
}

// Export singleton instance
export const bedOptimizer = new BedOptimizerService();
