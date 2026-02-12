// FHIR AI Service — Type Definitions
// All interfaces and type aliases used across FHIR AI modules

// Type definitions for patient data structures
export interface VitalsReading {
  created_at?: string;
  bp_systolic?: number;
  bp_diastolic?: number;
  heart_rate?: number;
  glucose_mg_dl?: number;
  blood_sugar?: number; // Alternative field name from self_reports
  pulse_oximeter?: number;
  spo2?: number; // Alternative field name
  blood_oxygen?: number; // Alternative field name
  weight?: number;
  mood?: string;
  physical_activity?: string;
  social_engagement?: string;
  symptoms?: string;
  activity_description?: string;
  is_emergency?: boolean;
}

export interface CheckInEntry {
  created_at?: string;
  [key: string]: unknown;
}

export interface PatientProfile {
  first_name?: string;
  last_name?: string;
  dob?: string;
  [key: string]: unknown;
}

export interface PatientData {
  profile?: PatientProfile;
  vitals?: VitalsReading[];
  checkIns?: CheckInEntry[];
}

export interface RiskDistribution {
  low: number;
  moderate: number;
  high: number;
  critical: number;
}

export interface HealthRiskAssessment {
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  riskScore: number; // 0-100
  riskFactors: string[];
  recommendations: string[];
  priority: number; // 1-5, where 5 is highest priority
  lastAssessed: string;
  trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

export interface VitalsTrend {
  metric: 'bp_systolic' | 'bp_diastolic' | 'heart_rate' | 'glucose_mg_dl' | 'pulse_oximeter';
  current: number;
  previous: number;
  trend: 'RISING' | 'FALLING' | 'STABLE';
  changePercent: number;
  isAbnormal: boolean;
  normalRange: { min: number; max: number };
  recommendation?: string;
}

export interface PatientInsight {
  patientId: string;
  patientName: string;
  overallHealthScore: number; // 0-100
  riskAssessment: HealthRiskAssessment;
  vitalsTrends: VitalsTrend[];
  adherenceScore: number; // 0-100, based on check-in frequency
  lastCheckIn: string;
  emergencyAlerts: EmergencyAlert[];
  predictedOutcomes: PredictedOutcome[];
  careRecommendations: CareRecommendation[];
}

export interface EmergencyAlert {
  id: string;
  severity: 'WARNING' | 'URGENT' | 'CRITICAL';
  type: 'VITAL_ANOMALY' | 'MISSED_CHECKINS' | 'RISK_ESCALATION' | 'EMERGENCY_CONTACT';
  message: string;
  timestamp: string;
  actionRequired: boolean;
  suggestedActions: string[];
}

export interface PredictedOutcome {
  condition: string;
  probability: number; // 0-100
  timeframe: string; // e.g., "30 days", "3 months"
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  basedOn: string[];
}

export interface CareRecommendation {
  category: 'MEDICATION' | 'LIFESTYLE' | 'MONITORING' | 'FOLLOW_UP' | 'INTERVENTION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  recommendation: string;
  reasoning: string;
  estimatedImpact: string;
  timeline: string;
}

export interface PopulationInsights {
  totalPatients: number;
  activePatients: number;
  highRiskPatients: number;
  averageHealthScore: number;
  trendingConcerns: string[];
  populationMetrics: {
    averageAge: number;
    riskDistribution: { low: number; moderate: number; high: number; critical: number };
    commonConditions: Array<{ condition: string; prevalence: number }>;
    adherenceRate: number;
  };
  recommendations: PopulationRecommendation[];
  predictiveAnalytics: PopulationPrediction[];
}

export interface PopulationRecommendation {
  type: 'RESOURCE_ALLOCATION' | 'INTERVENTION_PROGRAM' | 'POLICY_CHANGE' | 'TRAINING';
  recommendation: string;
  expectedImpact: string;
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: number;
}

export interface PopulationPrediction {
  metric: string;
  prediction: string;
  timeframe: string;
  confidence: number;
  factorsInfluencing: string[];
}

export interface AiConfiguration {
  riskThresholds: {
    bloodPressure: { systolic: { high: number; critical: number }; diastolic: { high: number; critical: number } };
    heartRate: { low: number; high: number; critical: number };
    glucose: { low: number; high: number; critical: number };
    oxygenSaturation: { low: number; critical: number };
  };
  adherenceSettings: {
    missedCheckInThreshold: number; // days
    lowAdherenceThreshold: number; // percentage
  };
  alertSettings: {
    enablePredictiveAlerts: boolean;
    alertCooldownPeriod: number; // hours
    emergencyContactThreshold: number; // hours for critical alerts
  };
}

// Type definitions for aggregation
export interface DailyHealthLog {
  date: string;
  readings: VitalsReading[];
  aggregates: DailyAggregates;
}

export interface DailyAggregates {
  bloodPressure: { systolic: number | null; diastolic: number | null; count: number };
  heartRate: { avg: number | null; min: number | null; max: number | null; count: number };
  bloodSugar: { avg: number | null; min: number | null; max: number | null; count: number };
  bloodOxygen: { avg: number | null; min: number | null; max: number | null; count: number };
  weight: { avg: number | null; count: number };
  mood: { predominant: string | null; entries: string[] };
  physicalActivity: { entries: string[] };
  socialEngagement: { entries: string[] };
  symptoms: { entries: string[] };
}

export interface WeeklyHealthSummary {
  weekStart: string;
  weekEnd: string;
  daysWithData: number;
  totalReadings: number;
  aggregates: DailyAggregates;
  trends: WeeklyTrends;
}

export interface WeeklyTrends {
  bloodPressure: 'RISING' | 'FALLING' | 'STABLE';
  heartRate: 'RISING' | 'FALLING' | 'STABLE';
  bloodSugar: 'RISING' | 'FALLING' | 'STABLE';
  bloodOxygen: 'RISING' | 'FALLING' | 'STABLE';
  weight: 'RISING' | 'FALLING' | 'STABLE';
  mood: 'RISING' | 'FALLING' | 'STABLE';
}

export interface HealthStatistics {
  dailyLogs: DailyHealthLog[];
  weeklyAverages: WeeklyHealthSummary[];
  overallStats: OverallStatistics;
  lastUpdated: string;
  dataPoints: number;
}

export interface OverallStatistics {
  totalReadings: number;
  dateRange: { start: string | null; end: string | null };
  averages: DailyAggregates;
  complianceRate: number;
}

/** Internal result type for individual vital risk assessments */
export interface VitalRiskResult {
  score: number;
  factors: string[];
  recommendations: string[];
}
