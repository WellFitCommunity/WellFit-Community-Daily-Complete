/**
 * Guardian Flow Engine Types
 *
 * Types for ED crowding prediction, ambulance arrival estimation,
 * and capacity management recommendations.
 *
 * Part of the P1 AI/ML Scale Optimization initiative.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

// Crowding level enum - matches clinical standards (NEDOCS-inspired)
export type CrowdingLevel = 'green' | 'yellow' | 'orange' | 'red';

// Diversion recommendation levels
export type DiversionRecommendation = 'accept' | 'soft_divert' | 'hard_divert';

// EMS unit status
export type EMSUnitStatus = 'en_route' | 'on_scene' | 'transporting' | 'at_hospital' | 'available';

// Surge protocol levels
export type SurgeLevel = 'normal' | 'level_1' | 'level_2' | 'level_3';

/**
 * ED Crowding Prediction - Core prediction output
 */
export interface CrowdingPrediction {
  /** Predicted patient census at end of horizon */
  predictedCensus: number;
  /** Predicted boarding hours (patients waiting for beds) */
  predictedBoardingHours: number;
  /** Overall crowding level */
  crowdingLevel: CrowdingLevel;
  /** Prediction confidence (0-1) */
  confidence: number;
  /** Prediction timestamp */
  predictedAt: Date;
  /** Time horizon this prediction covers */
  horizonHours: 1 | 4 | 8;
  /** Factors that influenced this prediction */
  factors: CrowdingFactors;
}

/**
 * Factors that influence crowding prediction - for transparency
 */
export interface CrowdingFactors {
  /** Current ED census */
  currentCensus: number;
  /** Current patients boarding (waiting for inpatient bed) */
  currentBoarding: number;
  /** Expected arrivals based on historical patterns */
  expectedArrivals: number;
  /** Expected discharges/dispositions */
  expectedDispositions: number;
  /** Day of week factor (0=Sun, 6=Sat) */
  dayOfWeek: number;
  /** Hour of day (0-23) */
  hourOfDay: number;
  /** Historical average for this day/hour */
  historicalAverage: number;
  /** Weather impact factor (-1 to 1) */
  weatherFactor?: number;
  /** Special event impact (sports, concerts) */
  eventFactor?: number;
  /** Inpatient bed availability */
  inpatientBedsAvailable: number;
}

/**
 * Capacity action recommendations
 */
export interface CapacityRecommendations {
  /** Patients who could be expedited for discharge */
  expediteDischarges: PatientDischargeCandidate[];
  /** Patients to hold in ED longer if needed */
  delayAdmissions: string[]; // patient IDs
  /** Should surge protocol be activated? */
  activateSurge: boolean;
  /** Recommended surge level if activating */
  surgeLevel?: SurgeLevel;
  /** Overall diversion recommendation */
  diversionRecommendation: DiversionRecommendation;
  /** Plain language summary for charge nurse */
  summaryText: string;
  /** Recommended actions in priority order */
  prioritizedActions: RecommendedAction[];
}

/**
 * A single recommended action
 */
export interface RecommendedAction {
  /** Action type */
  type: 'expedite_discharge' | 'delay_admission' | 'activate_surge' | 'call_housekeeping' |
        'open_overflow' | 'staff_callback' | 'divert_ems' | 'notify_admin';
  /** Priority (1 = highest) */
  priority: number;
  /** Human-readable description */
  description: string;
  /** Estimated impact on census */
  estimatedImpact: number;
  /** Time sensitivity (minutes until action loses effectiveness) */
  timeSensitivityMinutes: number;
  /** Related patient or resource IDs */
  relatedIds?: string[];
}

/**
 * Patient candidate for expedited discharge
 */
export interface PatientDischargeCandidate {
  patientId: string;
  patientName?: string;
  currentLocation: string;
  bedLabel?: string;
  hoursInED: number;
  disposition: string;
  /** Why this patient is a good discharge candidate */
  reason: string;
  /** Barriers to discharge if any */
  barriers?: string[];
  /** Estimated time to discharge (minutes) */
  estimatedTimeToDischarge: number;
}

/**
 * Inbound EMS unit information
 */
export interface InboundEMSUnit {
  unitId: string;
  unitCallSign: string;
  status: EMSUnitStatus;
  /** Estimated time of arrival (minutes) */
  eta: number;
  /** Chief complaint from radio report */
  chiefComplaint?: string;
  /** Patient acuity (1-5, ESI scale) */
  estimatedAcuity?: number;
  /** Age bracket for resource planning */
  patientAgeBracket?: 'pediatric' | 'adult' | 'geriatric';
  /** Special resources needed */
  resourcesNeeded?: string[];
  /** Trauma activation required? */
  traumaActivation?: boolean;
  /** Stroke alert? */
  strokeAlert?: boolean;
  /** STEMI alert? */
  stemiAlert?: boolean;
}

/**
 * EMS capacity impact scoring result
 */
export interface EMSCapacityScore {
  /** Unit being scored */
  unitId: string;
  /** Overall capacity impact score (0-100, higher = more impact) */
  capacityImpact: number;
  /** Estimated time to get patient into bed (minutes) */
  timeToBed: number;
  /** Likely length of stay (hours) */
  likelyLOS: number;
  /** Probability patient needs ICU (0-1) */
  icuProbability: number;
  /** Recommendation for this specific unit */
  recommendation: DiversionRecommendation;
  /** Factors that influenced scoring */
  factors: EMSScoringFactors;
  /** Plain language explanation */
  explanation: string;
}

/**
 * Factors used in EMS scoring
 */
export interface EMSScoringFactors {
  acuityWeight: number;
  resourceWeight: number;
  currentCapacityWeight: number;
  specialtyBedWeight: number;
  timeOfDayWeight: number;
}

/**
 * Database record for ED crowding predictions (for accuracy tracking)
 */
export interface EDCrowdingPredictionRecord {
  id: string;
  tenantId: string;
  facilityId?: string;
  predictedAt: string;
  predictionHorizonHours: number;
  predictedCensus: number;
  predictedBoardingHours: number;
  crowdingLevel: CrowdingLevel;
  confidence: number;
  factorsJson: CrowdingFactors;
  /** Filled in later for accuracy tracking */
  actualCensus?: number;
  actualBoardingHours?: number;
  actualCrowdingLevel?: CrowdingLevel;
  predictionAccuracy?: number;
  createdAt: string;
}

/**
 * Staff workload snapshot for load balancing
 */
export interface StaffWorkloadSnapshot {
  id: string;
  tenantId: string;
  staffId: string;
  staffName?: string;
  role: 'rn' | 'lpn' | 'tech' | 'provider' | 'charge';
  unitId?: string;
  snapshotTime: string;
  patientCount: number;
  totalAcuityScore: number;
  pendingTasks: number;
  estimatedWorkloadScore: number; // 0-100
  shiftHoursRemaining: number;
}

/**
 * Configuration for Guardian Flow Engine
 */
export interface GuardianFlowConfig {
  /** Census threshold for yellow warning */
  yellowThreshold: number;
  /** Census threshold for orange alert */
  orangeThreshold: number;
  /** Census threshold for red/critical */
  redThreshold: number;
  /** Boarding hours threshold for escalation */
  boardingHoursThreshold: number;
  /** Enable auto-surge recommendations */
  autoSurgeEnabled: boolean;
  /** Default diversion preference */
  defaultDiversionPolicy: 'conservative' | 'moderate' | 'aggressive';
  /** Hours of historical data to use */
  historicalWindowHours: number;
}

/**
 * Guardian Flow Engine service interface
 */
export interface IGuardianFlowEngine {
  /** Predict ED crowding for a given time horizon */
  predictCrowding(
    facilityId: string,
    horizonHours: 1 | 4 | 8
  ): Promise<CrowdingPrediction>;

  /** Get recommended actions based on current/predicted state */
  recommendActions(
    facilityId: string
  ): Promise<CapacityRecommendations>;

  /** Score an inbound EMS unit for capacity impact */
  scoreInboundEMS(
    facilityId: string,
    emsUnit: InboundEMSUnit
  ): Promise<EMSCapacityScore>;

  /** Record actual values for accuracy tracking */
  recordActuals(
    predictionId: string,
    actualCensus: number,
    actualBoardingHours: number
  ): Promise<void>;

  /** Get prediction accuracy metrics */
  getAccuracyMetrics(
    facilityId: string,
    days: number
  ): Promise<PredictionAccuracyMetrics>;
}

/**
 * Prediction accuracy metrics for learning dashboard
 */
export interface PredictionAccuracyMetrics {
  facilityId: string;
  periodDays: number;
  totalPredictions: number;
  meanAbsoluteError: number;
  meanAbsolutePercentageError: number;
  accuracyByHorizon: {
    '1h': number;
    '4h': number;
    '8h': number;
  };
  crowdingLevelAccuracy: number;
  improvingTrend: boolean;
}

// Helper functions

/**
 * Get crowding level from census percentage
 */
export function getCrowdingLevel(
  currentCensus: number,
  capacity: number,
  config: GuardianFlowConfig
): CrowdingLevel {
  // Handle zero or invalid capacity - return green (no crowding can be calculated)
  if (capacity <= 0) return 'green';

  const percentage = (currentCensus / capacity) * 100;
  if (percentage >= config.redThreshold) return 'red';
  if (percentage >= config.orangeThreshold) return 'orange';
  if (percentage >= config.yellowThreshold) return 'yellow';
  return 'green';
}

/**
 * Get crowding level color for UI
 */
export function getCrowdingLevelColor(level: CrowdingLevel): string {
  const colors: Record<CrowdingLevel, string> = {
    green: 'bg-green-100 text-green-700 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    orange: 'bg-orange-100 text-orange-700 border-orange-300',
    red: 'bg-red-100 text-red-700 border-red-300',
  };
  return colors[level];
}

/**
 * Get crowding level label
 */
export function getCrowdingLevelLabel(level: CrowdingLevel): string {
  const labels: Record<CrowdingLevel, string> = {
    green: 'Normal Operations',
    yellow: 'Elevated Volume',
    orange: 'High Volume - Action Needed',
    red: 'Critical - Surge Protocol',
  };
  return labels[level];
}

/**
 * Get diversion recommendation label
 */
export function getDiversionLabel(rec: DiversionRecommendation): string {
  const labels: Record<DiversionRecommendation, string> = {
    accept: 'Accept All',
    soft_divert: 'Soft Divert (Request Alt Destination)',
    hard_divert: 'Hard Divert (Cannot Accept)',
  };
  return labels[rec];
}
