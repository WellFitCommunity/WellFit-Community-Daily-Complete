// FHIR AI Service — Orchestrator Class
// Thin wrapper that delegates to focused modules while preserving the original class API

import type {
  PatientData,
  HealthRiskAssessment,
  PatientInsight,
  PopulationInsights,
  EmergencyAlert,
  AiConfiguration,
  VitalsReading,
  DailyHealthLog,
  WeeklyHealthSummary,
  HealthStatistics,
} from './types';

import { assessPatientRisk } from './riskAssessment';
import { generatePatientInsights, monitorPatientInRealTime } from './patientInsights';
import { generatePopulationInsights } from './populationAnalytics';
import { computeDailyHealthLogs, computeWeeklyAverages, computeHealthStatistics } from './healthStatistics';

/** Default AI configuration values */
function getDefaultConfiguration(): AiConfiguration {
  return {
    riskThresholds: {
      bloodPressure: {
        systolic: { high: 140, critical: 180 },
        diastolic: { high: 90, critical: 120 }
      },
      heartRate: { low: 50, high: 100, critical: 120 },
      glucose: { low: 70, high: 180, critical: 250 },
      oxygenSaturation: { low: 95, critical: 88 }
    },
    adherenceSettings: {
      missedCheckInThreshold: 3,
      lowAdherenceThreshold: 60
    },
    alertSettings: {
      enablePredictiveAlerts: true,
      alertCooldownPeriod: 4,
      emergencyContactThreshold: 1
    }
  };
}

export class FhirAiService {
  private config: AiConfiguration;

  constructor() {
    this.config = getDefaultConfiguration();
  }

  // AI-powered patient risk assessment
  async assessPatientRisk(patientData: PatientData): Promise<HealthRiskAssessment> {
    return assessPatientRisk(patientData, this.config);
  }

  // Generate comprehensive patient insights
  async generatePatientInsights(patientId: string, patientData: PatientData): Promise<PatientInsight> {
    return generatePatientInsights(patientId, patientData, this.config);
  }

  // Population-level AI analytics
  async generatePopulationInsights(populationData: PatientData[]): Promise<PopulationInsights> {
    return generatePopulationInsights(populationData, this.config);
  }

  // Real-time monitoring and alerts
  async monitorPatientInRealTime(patientData: PatientData): Promise<EmergencyAlert[]> {
    return monitorPatientInRealTime(patientData, this.config);
  }

  // Configuration management
  updateConfiguration(newConfig: Partial<AiConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfiguration(): AiConfiguration {
    return { ...this.config };
  }

  // Production-grade daily and weekly aggregation methods

  /**
   * Compute daily health logs by aggregating all vitals from self_reports and check_ins for each day
   * @param healthData Array of health entries (self_reports, check_ins, etc.)
   * @returns Map of date strings to aggregated daily statistics
   */
  computeDailyHealthLogs(healthData: VitalsReading[]): Map<string, DailyHealthLog> {
    return computeDailyHealthLogs(healthData);
  }

  /**
   * Compute weekly averages from daily logs
   * @param dailyLogs Map of daily health logs
   * @returns Array of weekly statistics
   */
  computeWeeklyAverages(dailyLogs: Map<string, DailyHealthLog>): WeeklyHealthSummary[] {
    return computeWeeklyAverages(dailyLogs);
  }

  /**
   * Get comprehensive health statistics for a patient
   * @param healthData Array of all health entries
   * @returns Structured daily and weekly statistics
   */
  async computeHealthStatistics(healthData: VitalsReading[]): Promise<HealthStatistics> {
    return computeHealthStatistics(healthData);
  }
}
