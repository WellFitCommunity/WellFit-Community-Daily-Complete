// Bed Optimizer - Type Definitions
// All types for the bed optimization service

import type { AcuityLevel, UnitType } from '../../../types/bed';

// =====================================================
// DATABASE RESULT TYPES (Internal)
// =====================================================

/** Row from daily_census_snapshots table */
export interface HistoricalCensusSnapshot {
  snapshot_date: string;
  discharges_count?: number;
  admissions_count?: number;
  midnight_census?: number;
  eod_census?: number;
}

/** Row from scheduled_arrivals table */
export interface ScheduledArrival {
  scheduled_date: string;
  status: string;
}

/** Row from los_benchmarks table */
export interface LOSBenchmark {
  tenant_id?: string;
  is_default?: boolean;
  drg_code?: string;
  expected_los?: number;
}

/** Available bed with joined hospital_units */
export interface AvailableBedWithUnit {
  bed_label: string;
  bed_type: string;
  has_telemetry: boolean;
  has_isolation_capability: boolean;
  has_negative_pressure: boolean;
  hospital_units: {
    unit_name: string;
  };
}

// =====================================================
// PUBLIC API TYPES
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
  overallCapacityScore: number;
  overallEfficiencyScore: number;
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
