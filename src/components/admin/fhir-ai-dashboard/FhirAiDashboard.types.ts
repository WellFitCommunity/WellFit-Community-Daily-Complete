// Types for the AI-Enhanced FHIR Dashboard

export interface DashboardProps {
  supabaseUrl?: string;
  supabaseKey?: string;
}

// Population Dashboard Types
export interface PopulationOverview {
  totalPatients: number;
  activePatients: number;
  highRiskPatients: number;
  averageHealthScore: number;
  trendingConcerns?: string[];
}

export interface RiskMatrixQuadrants {
  highRiskLowAdherence: number;
  highRiskHighAdherence: number;
  lowRiskLowAdherence: number;
  lowRiskHighAdherence: number;
}

export interface RiskMatrixData {
  quadrants: RiskMatrixQuadrants;
}

export interface PredictiveAlert {
  message: string;
  probabilityScore: number;
  timeframe: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  recommendedActions?: string[];
}

export interface InterventionQueueItem {
  patientId: string;
  priority: number;
}

export interface ResourceAllocationItem {
  recommendation: string;
  priority: number;
  justification: string;
  estimatedCost: string;
  expectedRoi: string;
}

export interface PopulationDashboard {
  overview: PopulationOverview;
  riskMatrix: RiskMatrixData;
  predictiveAlerts: PredictiveAlert[];
  interventionQueue: InterventionQueueItem[];
  resourceAllocation: ResourceAllocationItem[];
}

// Quality Metrics Types
export interface FhirComplianceData {
  score: number;
  issues?: unknown[];
}

export interface DataQualityData {
  completeness: number;
  accuracy: number;
  consistency: number;
  issues?: DataQualityIssue[];
}

export interface DataQualityIssue {
  type: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  count: number;
}

export interface ClinicalQualityData {
  adherenceToGuidelines: number;
  outcomeMetrics?: {
    readmissionRate: number;
  };
}

export interface QualityMetricsData {
  fhirCompliance: FhirComplianceData;
  dataQuality: DataQualityData;
  clinicalQuality: ClinicalQualityData;
}

// Patient Types
export interface RiskAssessmentData {
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  priority: number;
}

export interface AIPatientData {
  patientId: string;
  patientName: string;
  overallHealthScore: number;
  adherenceScore: number;
  emergencyAlerts?: unknown[];
  riskAssessment?: RiskAssessmentData;
}

export interface EnhancedPatientData {
  aiInsights: AIPatientData;
}

// Automated Reports Types
export interface WeeklyReportSummary {
  totalPatients: number;
  activePatients: number;
  highRiskPatients: number;
  newEmergencyAlerts: number;
}

export interface WeeklyReport {
  summary?: WeeklyReportSummary;
  keyInsights?: string[];
}

export interface EmergencyReport {
  alertCount: number;
  escalationRequired: boolean;
}

export interface AutomatedReports {
  weeklyReport?: WeeklyReport;
  emergencyReport?: EmergencyReport;
}

export interface DashboardState {
  populationDashboard: PopulationDashboard | null;
  qualityMetrics: QualityMetricsData | null;
  enhancedPatients: EnhancedPatientData[];
  automatedReports: AutomatedReports | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface AlertConfig {
  enableRealTime: boolean;
  criticalThreshold: number;
  notificationMethods: string[];
}

export interface QuickActionContext {
  patientId?: string;
  ehrSystem?: string;
  source?: string;
}
