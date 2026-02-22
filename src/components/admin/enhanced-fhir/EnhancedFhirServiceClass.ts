/**
 * Enhanced FHIR Service — Orchestrator Class
 *
 * Combines FHIR R4 compliance with AI-powered analytics.
 * Delegates to focused modules for data fetching, clinical decision support,
 * population analytics, quality assessment, reporting, and SMART sync.
 */

import { supabase } from '../../../lib/supabaseClient';
import { SupabaseClient } from '@supabase/supabase-js';
import FHIRIntegrationService from '../FhirIntegrationService';
import FhirAiService from '../FhirAiService';
import type { AiConfiguration } from '../FhirAiService';

import type {
  EnhancedPatientData,
  PopulationDashboard,
  ClinicalDecisionSupport,
  QualityMetrics,
  SmartSession,
  ComprehensivePatientData,
  VitalsEntry,
  WeeklyReport,
  MonthlyReport,
  EmergencyReport,
  EmergencyAlert
} from './types';

import { DataCache, fetchComprehensivePatientData, fetchPopulationData, fetchRecentCheckIns } from './data-fetching';
import { determinePrimaryCondition, getEvidenceBasedRecommendations, checkDrugInteractions, getApplicableClinicalGuidelines } from './clinical-decision-support';
import { generateRiskMatrix, generateInterventionQueue, generateResourceRecommendations, generatePredictiveAlerts } from './population-analytics';
import { assessFhirCompliance, assessDataQuality, assessClinicalQuality, cleanVitalSigns } from './quality-assessment';
import { generateClinicalSummary, generateRecommendedActions, calculateNextReviewDate, generateWeeklyReport, generateMonthlyReport, generateEmergencyReport } from './reporting';
import { syncWithSmartSession } from './smart-sync';

export class EnhancedFhirService {
  private fhirService: FHIRIntegrationService;
  private aiService: FhirAiService;
  private supabase: SupabaseClient;
  private dataCache: DataCache;

  constructor() {
    this.fhirService = new FHIRIntegrationService();
    this.aiService = new FhirAiService();
    this.supabase = supabase;
    this.dataCache = new DataCache();
  }

  // Enhanced patient data export with AI insights
  async exportEnhancedPatientData(userId: string): Promise<EnhancedPatientData> {
    try {
      // Get base FHIR bundle
      const fhirBundle = await this.fhirService.exportPatientData(userId);

      // Fetch comprehensive patient data for AI analysis
      const patientData = await fetchComprehensivePatientData(this.supabase, this.dataCache, userId);

      // Generate AI insights
      const aiInsights = await this.aiService.generatePatientInsights(userId, patientData);

      // Monitor for emergency conditions
      const emergencyAlerts = await this.aiService.monitorPatientInRealTime(patientData);

      // PRODUCTION FIX: Compute daily logs and weekly averages
      const allHealthData = [
        ...(patientData.checkIns || []),
        ...(patientData.healthEntries || [])
      ];
      const healthStatistics = await this.aiService.computeHealthStatistics(allHealthData);

      // Generate clinical summary
      const clinicalSummary = generateClinicalSummary(aiInsights, fhirBundle);

      // Determine recommended actions
      const recommendedActions = generateRecommendedActions(aiInsights, emergencyAlerts);

      // Calculate next review date
      const nextReviewDate = calculateNextReviewDate(aiInsights);

      return {
        fhirBundle,
        aiInsights,
        emergencyAlerts,
        recommendedActions,
        nextReviewDate,
        clinicalSummary,
        healthStatistics
      };

    } catch (error: unknown) {

      throw new Error(`Failed to export enhanced patient data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Population-level dashboard with AI analytics
  async generatePopulationDashboard(): Promise<PopulationDashboard> {
    try {
      // Fetch all patient data
      const populationData = await fetchPopulationData(this.supabase, this.dataCache);

      // Generate AI-powered population insights
      const overview = await this.aiService.generatePopulationInsights(populationData);

      // Create risk matrix
      const riskMatrix = generateRiskMatrix(this.aiService, populationData);

      // Generate intervention queue
      const interventionQueue = await generateInterventionQueue(this.aiService, populationData);

      // Resource allocation recommendations
      const resourceAllocation = generateResourceRecommendations(overview, riskMatrix);

      // Predictive alerts
      const predictiveAlerts = generatePredictiveAlerts(populationData, overview);

      return {
        overview,
        riskMatrix,
        interventionQueue,
        resourceAllocation,
        predictiveAlerts
      };

    } catch (error: unknown) {

      throw new Error(`Failed to generate population dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Clinical decision support system
  async getClinicalDecisionSupport(patientId: string, condition?: string): Promise<ClinicalDecisionSupport> {
    try {
      const patientData = await fetchComprehensivePatientData(this.supabase, this.dataCache, patientId);
      const aiInsights = await this.aiService.generatePatientInsights(patientId, patientData);

      // Determine primary condition if not provided
      const primaryCondition = condition || determinePrimaryCondition(aiInsights);

      return {
        patientId,
        condition: primaryCondition,
        evidenceBasedRecommendations: getEvidenceBasedRecommendations(primaryCondition, aiInsights),
        drugInteractionAlerts: checkDrugInteractions(patientData),
        clinicalGuidelines: getApplicableClinicalGuidelines(primaryCondition, patientData)
      };

    } catch (error: unknown) {

      throw new Error(`Failed to generate clinical decision support: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Quality metrics and compliance monitoring
  async assessQualityMetrics(): Promise<QualityMetrics> {
    try {
      const populationData = await fetchPopulationData(this.supabase, this.dataCache);

      return {
        fhirCompliance: await assessFhirCompliance(this.fhirService, populationData),
        dataQuality: await assessDataQuality(populationData),
        clinicalQuality: await assessClinicalQuality(populationData)
      };

    } catch (error: unknown) {

      throw new Error(`Failed to assess quality metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Real-time monitoring with automated alerts
  async startRealTimeMonitoring(): Promise<void> {
    setInterval(async () => {
      try {
        const recentCheckIns = await fetchRecentCheckIns(this.supabase);

        for (const checkIn of recentCheckIns) {
          const patientData = await fetchComprehensivePatientData(this.supabase, this.dataCache, checkIn.user_id);
          const alerts = await this.aiService.monitorPatientInRealTime(patientData);

          if (alerts.length > 0) {
            await this.processEmergencyAlerts(alerts, checkIn.user_id);
          }
        }
      } catch {
        // Silently handle monitoring errors to avoid disrupting the interval
      }
    }, 60000); // Check every minute
  }

  // Intelligent data validation and cleaning
  async validateAndCleanData(userId?: string): Promise<{ cleaned: number; issues: string[] }> {
    try {
      const data = userId ?
        [await fetchComprehensivePatientData(this.supabase, this.dataCache, userId)] :
        await fetchPopulationData(this.supabase, this.dataCache);

      let cleanedCount = 0;
      const issues: string[] = [];

      for (const patientData of data) {
        // Validate vital signs ranges
        if (patientData.vitals) {
          for (const vital of patientData.vitals) {
            const cleaned = cleanVitalSigns(vital);
            if (cleaned.modified) {
              cleanedCount++;
              issues.push(`Cleaned invalid vital signs for patient ${patientData.profile?.id}`);
            }
          }
        }

        // Validate FHIR compliance
        const patientUserId = patientData.profile?.user_id;
        if (patientUserId) {
          const fhirBundle = await this.fhirService.exportPatientData(patientUserId);
          if (!this.fhirService.validateBundle(fhirBundle)) {
            issues.push(`FHIR bundle validation failed for patient ${patientData.profile?.id}`);
          }
        }
      }

      return { cleaned: cleanedCount, issues };

    } catch (error: unknown) {

      throw new Error(`Failed to validate and clean data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Automated reporting and insights generation
  async generateAutomatedReports(): Promise<{
    weeklyReport: WeeklyReport;
    monthlyReport: MonthlyReport;
    emergencyReport: EmergencyReport;
    qualityReport: QualityMetrics;
  }> {
    try {
      const populationData = await fetchPopulationData(this.supabase, this.dataCache);
      const dashboard = await this.generatePopulationDashboard();
      const qualityMetrics = await this.assessQualityMetrics();

      return {
        weeklyReport: generateWeeklyReport(populationData, dashboard),
        monthlyReport: generateMonthlyReport(populationData, dashboard, qualityMetrics),
        emergencyReport: generateEmergencyReport(dashboard.predictiveAlerts),
        qualityReport: qualityMetrics
      };

    } catch (error: unknown) {

      throw new Error(`Failed to generate automated reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Public configuration methods
  updateAiConfiguration(config: AiConfiguration): void {
    this.aiService.updateConfiguration(config);
  }

  getAiConfiguration(): AiConfiguration {
    return this.aiService.getConfiguration();
  }

  // SMART on FHIR data synchronization
  async syncWithSmartSession(smartSession: SmartSession): Promise<{
    patientData: ComprehensivePatientData;
    observations: VitalsEntry[];
    synchronized: boolean;
  }> {
    return syncWithSmartSession(this.supabase, this.dataCache, smartSession);
  }

  // Private helper: process emergency alerts
  private async processEmergencyAlerts(alerts: EmergencyAlert[], patientId: string): Promise<void> {
    for (const alert of alerts) {
      if (alert.severity === 'CRITICAL') {
        // In production, this would trigger actual emergency protocols

        // Store alert in database
        await this.supabase.from('emergency_alerts').insert({
          patient_id: patientId,
          alert_type: alert.type,
          severity: alert.severity,
          message: alert.message,
          suggested_actions: alert.suggestedActions,
          created_at: new Date().toISOString()
        });
      }
    }
  }
}

export default EnhancedFhirService;
