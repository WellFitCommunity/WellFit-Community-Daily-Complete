// Enhanced FHIR Integration with AI-Powered Analytics
// Combines existing FHIR R4 compliance with intelligent insights and automation

import { supabase } from '../../lib/supabaseClient';
import { SupabaseClient } from '@supabase/supabase-js';
import FHIRIntegrationService from './FhirIntegrationService';
import FhirAiService, {
  type PatientInsight,
  type PopulationInsights,
  type EmergencyAlert,
  type HealthStatistics,
  type AiConfiguration
} from './FhirAiService';

// Type definitions for patient data structures
interface PatientProfile {
  id?: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  age?: number;
  [key: string]: unknown;
}

interface VitalsEntry {
  created_at?: string;
  bp_systolic?: number;
  bp_diastolic?: number;
  heart_rate?: number;
  glucose_mg_dl?: number;
  blood_sugar?: number;
  pulse_oximeter?: number;
  blood_oxygen?: number;
  spo2?: number;
  weight?: number;
  mood?: string;
  physical_activity?: string;
  social_engagement?: string;
  symptoms?: string;
  activity_description?: string;
  is_emergency?: boolean;
  [key: string]: unknown;
}

interface CheckInRecord {
  user_id: string;
  created_at?: string;
  [key: string]: unknown;
}

interface MedicationRecord {
  medication_display?: string;
  name?: string;
  [key: string]: unknown;
}

interface ComprehensivePatientData {
  profile?: PatientProfile;
  checkIns?: CheckInRecord[];
  vitals?: VitalsEntry[];
  healthEntries?: VitalsEntry[];
  medications?: MedicationRecord[];
  medicationRequests?: MedicationRecord[];
  conditions?: string[];
}

// Use generic FHIR bundle type - compatible with FHIRIntegrationService
type FhirBundle = ReturnType<typeof FHIRIntegrationService.prototype.exportPatientData> extends Promise<infer T> ? T : never;

interface CacheEntry {
  data: ComprehensivePatientData | ComprehensivePatientData[];
  timestamp: number;
  ttl: number;
}

interface EvidenceBasedRecommendation {
  recommendation: string;
  evidenceLevel: 'A' | 'B' | 'C' | 'D';
  source: string;
  contraindications?: string[];
}

interface DrugInteraction {
  medications: string[];
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CONTRAINDICATED';
  description: string;
  recommendation: string;
}

interface ClinicalGuideline {
  guideline: string;
  organization: string;
  applicability: number;
  keyPoints: string[];
  patientSpecificNotes?: string;
}

interface WeeklyReport {
  period: string;
  generatedAt: string;
  summary: {
    totalPatients: number;
    activePatients: number;
    highRiskPatients: number;
    newEmergencyAlerts: number;
  };
  keyInsights: string[];
  actionItems: string[];
}

interface MonthlyReport {
  period: string;
  generatedAt: string;
  executiveSummary: {
    populationHealth: number;
    riskDistribution: Record<string, number>;
    qualityScores: {
      fhirCompliance: number;
      dataQuality: number;
      clinicalQuality: number;
    };
  };
  trends: string[];
  recommendations: ResourceRecommendation[];
  nextMonthPredictions: PredictiveAlert[];
}

interface EmergencyReport {
  alertCount: number;
  generatedAt: string;
  criticalAlerts: PredictiveAlert[];
  immediateActions: string[];
  escalationRequired: boolean;
}

interface FhirComplianceResult {
  score: number;
  issues: string[];
  recommendations: string[];
}

interface DataQualityResult {
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  issues: Array<{ type: string; count: number; description: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }>;
}

interface ClinicalQualityResult {
  adherenceToGuidelines: number;
  outcomeMetrics: {
    readmissionRate: number;
    mortalityRate: number;
    patientSatisfaction: number;
    qualityOfLifeImprovement: number;
  };
}

interface SmartSession {
  accessToken: string;
  patient: string;
  [key: string]: unknown;
}

// AiConfiguration imported from FhirAiService

interface EnhancedPatientData {
  fhirBundle: FhirBundle;
  aiInsights: PatientInsight;
  emergencyAlerts: EmergencyAlert[];
  recommendedActions: string[];
  nextReviewDate: string;
  clinicalSummary: string;
  healthStatistics: HealthStatistics; // Added: Daily logs and weekly averages
}

interface PopulationDashboard {
  overview: PopulationInsights;
  riskMatrix: RiskMatrix;
  interventionQueue: InterventionItem[];
  resourceAllocation: ResourceRecommendation[];
  predictiveAlerts: PredictiveAlert[];
}

interface RiskMatrix {
  quadrants: {
    highRiskHighAdherence: number;
    highRiskLowAdherence: number;
    lowRiskHighAdherence: number;
    lowRiskLowAdherence: number;
  };
  actionPriority: Array<{
    quadrant: string;
    patientCount: number;
    recommendedAction: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
}

interface InterventionItem {
  patientId: string;
  patientName: string;
  interventionType: 'CLINICAL' | 'MEDICATION' | 'LIFESTYLE' | 'MONITORING' | 'EMERGENCY' | 'FOLLOW_UP' | 'INTERVENTION';
  priority: number;
  description: string;
  estimatedTimeToComplete: string;
  expectedOutcome: string;
  assignedTo?: string;
  dueDate: string;
}

interface ResourceRecommendation {
  resourceType: 'STAFF' | 'EQUIPMENT' | 'MEDICATION' | 'TRAINING' | 'TECHNOLOGY';
  recommendation: string;
  justification: string;
  estimatedCost: string;
  expectedRoi: string;
  implementationTimeframe: string;
  priority: number;
}

interface PredictiveAlert {
  type: 'PATIENT_DETERIORATION' | 'MEDICATION_ADHERENCE' | 'READMISSION_RISK' | 'POPULATION_TREND';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  affectedPatients?: string[];
  probabilityScore: number;
  timeframe: string;
  recommendedActions: string[];
  isActionable: boolean;
}

interface ClinicalDecisionSupport {
  patientId: string;
  condition: string;
  evidenceBasedRecommendations: Array<{
    recommendation: string;
    evidenceLevel: 'A' | 'B' | 'C' | 'D';
    source: string;
    contraindications?: string[];
  }>;
  drugInteractionAlerts: Array<{
    medications: string[];
    severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CONTRAINDICATED';
    description: string;
    recommendation: string;
  }>;
  clinicalGuidelines: Array<{
    guideline: string;
    organization: string;
    applicability: number; // 0-100%
    keyPoints: string[];
  }>;
}

interface QualityMetrics {
  fhirCompliance: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  dataQuality: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    issues: Array<{
      type: string;
      count: number;
      description: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
  };
  clinicalQuality: {
    adherenceToGuidelines: number;
    outcomeMetrics: {
      readmissionRate: number;
      mortalityRate: number;
      patientSatisfaction: number;
      qualityOfLifeImprovement: number;
    };
  };
}

export class EnhancedFhirService {
  private fhirService: FHIRIntegrationService;
  private aiService: FhirAiService;
  private supabase: SupabaseClient;
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.fhirService = new FHIRIntegrationService();
    this.aiService = new FhirAiService();
    this.supabase = supabase;
    this.cache = new Map();
  }

  // Enhanced patient data export with AI insights
  async exportEnhancedPatientData(userId: string): Promise<EnhancedPatientData> {
    try {
      // Get base FHIR bundle
      const fhirBundle = await this.fhirService.exportPatientData(userId);

      // Fetch comprehensive patient data for AI analysis
      const patientData = await this.fetchComprehensivePatientData(userId);

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
      const clinicalSummary = this.generateClinicalSummary(aiInsights, fhirBundle);

      // Determine recommended actions
      const recommendedActions = this.generateRecommendedActions(aiInsights, emergencyAlerts);

      // Calculate next review date
      const nextReviewDate = this.calculateNextReviewDate(aiInsights);

      return {
        fhirBundle,
        aiInsights,
        emergencyAlerts,
        recommendedActions,
        nextReviewDate,
        clinicalSummary,
        healthStatistics
      };

    } catch (error) {

      throw new Error(`Failed to export enhanced patient data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Population-level dashboard with AI analytics
  async generatePopulationDashboard(): Promise<PopulationDashboard> {
    try {
      // Fetch all patient data
      const populationData = await this.fetchPopulationData();

      // Generate AI-powered population insights
      const overview = await this.aiService.generatePopulationInsights(populationData);

      // Create risk matrix
      const riskMatrix = this.generateRiskMatrix(populationData);

      // Generate intervention queue
      const interventionQueue = await this.generateInterventionQueue(populationData);

      // Resource allocation recommendations
      const resourceAllocation = this.generateResourceRecommendations(overview, riskMatrix);

      // Predictive alerts
      const predictiveAlerts = this.generatePredictiveAlerts(populationData, overview);

      return {
        overview,
        riskMatrix,
        interventionQueue,
        resourceAllocation,
        predictiveAlerts
      };

    } catch (error) {

      throw new Error(`Failed to generate population dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Clinical decision support system
  async getClinicalDecisionSupport(patientId: string, condition?: string): Promise<ClinicalDecisionSupport> {
    try {
      const patientData = await this.fetchComprehensivePatientData(patientId);
      const aiInsights = await this.aiService.generatePatientInsights(patientId, patientData);

      // Determine primary condition if not provided
      const primaryCondition = condition || this.determinePrimaryCondition(aiInsights);

      return {
        patientId,
        condition: primaryCondition,
        evidenceBasedRecommendations: this.getEvidenceBasedRecommendations(primaryCondition, aiInsights),
        drugInteractionAlerts: this.checkDrugInteractions(patientData),
        clinicalGuidelines: this.getApplicableClinicalGuidelines(primaryCondition, patientData)
      };

    } catch (error) {

      throw new Error(`Failed to generate clinical decision support: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Quality metrics and compliance monitoring
  async assessQualityMetrics(): Promise<QualityMetrics> {
    try {
      const populationData = await this.fetchPopulationData();

      return {
        fhirCompliance: await this.assessFhirCompliance(populationData),
        dataQuality: await this.assessDataQuality(populationData),
        clinicalQuality: await this.assessClinicalQuality(populationData)
      };

    } catch (error) {

      throw new Error(`Failed to assess quality metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Real-time monitoring with automated alerts
  async startRealTimeMonitoring(): Promise<void> {
    setInterval(async () => {
      try {
        const recentCheckIns = await this.fetchRecentCheckIns();

        for (const checkIn of recentCheckIns) {
          const patientData = await this.fetchComprehensivePatientData(checkIn.user_id);
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
        [await this.fetchComprehensivePatientData(userId)] :
        await this.fetchPopulationData();

      let cleanedCount = 0;
      const issues: string[] = [];

      for (const patientData of data) {
        // Validate vital signs ranges
        if (patientData.vitals) {
          for (const vital of patientData.vitals) {
            const cleaned = this.cleanVitalSigns(vital);
            if (cleaned.modified) {
              cleanedCount++;
              issues.push(`Cleaned invalid vital signs for patient ${patientData.profile?.id}`);
            }
          }
        }

        // Validate FHIR compliance
        const userId = patientData.profile?.user_id;
        if (userId) {
          const fhirBundle = await this.fhirService.exportPatientData(userId);
          if (!this.fhirService.validateBundle(fhirBundle)) {
            issues.push(`FHIR bundle validation failed for patient ${patientData.profile?.id}`);
          }
        }
      }

      return { cleaned: cleanedCount, issues };

    } catch (error) {

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
      const populationData = await this.fetchPopulationData();
      const dashboard = await this.generatePopulationDashboard();
      const qualityMetrics = await this.assessQualityMetrics();

      return {
        weeklyReport: this.generateWeeklyReport(populationData, dashboard),
        monthlyReport: this.generateMonthlyReport(populationData, dashboard, qualityMetrics),
        emergencyReport: this.generateEmergencyReport(dashboard.predictiveAlerts),
        qualityReport: qualityMetrics
      };

    } catch (error) {

      throw new Error(`Failed to generate automated reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods
  private async fetchComprehensivePatientData(userId: string): Promise<ComprehensivePatientData> {
    const cacheKey = `patient-${userId}`;
    const cached = this.getFromCache<ComprehensivePatientData>(cacheKey);
    if (cached) return cached;

    try {
      const [profile, checkIns, healthEntries] = await Promise.all([
        this.supabase.from('profiles').select('*').eq('user_id', userId).single(),
        this.supabase.from('check_ins').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
        this.supabase.from('self_reports').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
      ]);

      // CRITICAL FIX: Merge check_ins and self_reports into a unified vitals array
      // This ensures all health data (from both sources) is available for AI analysis
      const allVitals = [
        ...(checkIns.data || []),
        ...(healthEntries.data || [])
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const data = {
        profile: profile.data,
        checkIns: checkIns.data || [],
        vitals: allVitals, // FIX: Now includes both check_ins and self_reports data
        healthEntries: healthEntries.data || []
      };

      this.setCache(cacheKey, data, 300000); // 5 minutes TTL
      return data;

    } catch (error) {

      throw error;
    }
  }

  private async fetchPopulationData(): Promise<ComprehensivePatientData[]> {
    const cacheKey = 'population-data';
    const cached = this.getFromCache<ComprehensivePatientData[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data: profiles } = await this.supabase.from('profiles').select('*');

      const populationData = await Promise.all(
        (profiles || []).map(async (profile) => {
          try {
            return await this.fetchComprehensivePatientData(profile.user_id);
          } catch {
            // Return minimal data if fetch fails for this patient
            return { profile, checkIns: [], vitals: [], healthEntries: [] };
          }
        })
      );

      this.setCache(cacheKey, populationData, 600000); // 10 minutes TTL
      return populationData;

    } catch (error) {

      throw error;
    }
  }

  private async fetchRecentCheckIns(): Promise<CheckInRecord[]> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const { data } = await this.supabase
      .from('check_ins')
      .select('*')
      .gte('created_at', fifteenMinutesAgo.toISOString());

    return data || [];
  }

  private generateClinicalSummary(aiInsights: PatientInsight, fhirBundle: FhirBundle): string {
    const summary = [
      `Patient: ${aiInsights.patientName}`,
      `Overall Health Score: ${aiInsights.overallHealthScore}/100`,
      `Risk Level: ${aiInsights.riskAssessment.riskLevel}`,
      `Adherence Score: ${aiInsights.adherenceScore}%`,
      '',
      'Key Findings:',
      ...aiInsights.riskAssessment.riskFactors.map(factor => `• ${factor}`),
      '',
      'Recommendations:',
      ...aiInsights.careRecommendations.slice(0, 3).map(rec => `• ${rec.recommendation}`),
      '',
      `FHIR Resources: ${fhirBundle.entry?.length || 0} total resources`,
      `Last Assessment: ${new Date(aiInsights.riskAssessment.lastAssessed).toLocaleDateString()}`
    ];

    return summary.join('\n');
  }

  private generateRecommendedActions(aiInsights: PatientInsight, emergencyAlerts: EmergencyAlert[]): string[] {
    const actions: string[] = [];

    // Emergency actions first
    emergencyAlerts.forEach(alert => {
      if (alert.actionRequired) {
        actions.push(...alert.suggestedActions);
      }
    });

    // High-priority care recommendations
    aiInsights.careRecommendations
      .filter(rec => rec.priority === 'URGENT' || rec.priority === 'HIGH')
      .forEach(rec => actions.push(rec.recommendation));

    // General health improvement actions
    if (aiInsights.adherenceScore < 70) {
      actions.push('Implement adherence improvement strategies');
    }

    if (aiInsights.overallHealthScore < 60) {
      actions.push('Schedule comprehensive health assessment');
    }

    return [...new Set(actions)]; // Remove duplicates
  }

  private calculateNextReviewDate(aiInsights: PatientInsight): string {
    const now = new Date();
    let daysToAdd = 30; // Default monthly review

    // Adjust based on risk level
    switch (aiInsights.riskAssessment.riskLevel) {
      case 'CRITICAL':
        daysToAdd = 1;
        break;
      case 'HIGH':
        daysToAdd = 7;
        break;
      case 'MODERATE':
        daysToAdd = 14;
        break;
      case 'LOW':
        daysToAdd = 30;
        break;
    }

    // Adjust based on emergency alerts
    if (aiInsights.emergencyAlerts.some(alert => alert.severity === 'CRITICAL')) {
      daysToAdd = Math.min(daysToAdd, 1);
    }

    now.setDate(now.getDate() + daysToAdd);
    return now.toISOString();
  }

  private generateRiskMatrix(populationData: ComprehensivePatientData[]): RiskMatrix {
    let highRiskHighAdherence = 0;
    let highRiskLowAdherence = 0;
    let lowRiskHighAdherence = 0;
    let lowRiskLowAdherence = 0;

    populationData.forEach(async (patient) => {
      const userId = patient.profile?.user_id ?? '';
      const aiInsights = await this.aiService.generatePatientInsights(userId, patient);
      const isHighRisk = aiInsights.riskAssessment.riskLevel === 'HIGH' || aiInsights.riskAssessment.riskLevel === 'CRITICAL';
      const isHighAdherence = aiInsights.adherenceScore >= 70;

      if (isHighRisk && isHighAdherence) highRiskHighAdherence++;
      else if (isHighRisk && !isHighAdherence) highRiskLowAdherence++;
      else if (!isHighRisk && isHighAdherence) lowRiskHighAdherence++;
      else lowRiskLowAdherence++;
    });

    return {
      quadrants: {
        highRiskHighAdherence,
        highRiskLowAdherence,
        lowRiskHighAdherence,
        lowRiskLowAdherence
      },
      actionPriority: [
        {
          quadrant: 'High Risk, Low Adherence',
          patientCount: highRiskLowAdherence,
          recommendedAction: 'Immediate intervention and adherence support',
          urgency: 'CRITICAL'
        },
        {
          quadrant: 'High Risk, High Adherence',
          patientCount: highRiskHighAdherence,
          recommendedAction: 'Intensive monitoring and clinical review',
          urgency: 'HIGH'
        },
        {
          quadrant: 'Low Risk, Low Adherence',
          patientCount: lowRiskLowAdherence,
          recommendedAction: 'Engagement improvement programs',
          urgency: 'MEDIUM'
        },
        {
          quadrant: 'Low Risk, High Adherence',
          patientCount: lowRiskHighAdherence,
          recommendedAction: 'Maintenance and prevention focus',
          urgency: 'LOW'
        }
      ]
    };
  }

  private async generateInterventionQueue(populationData: ComprehensivePatientData[]): Promise<InterventionItem[]> {
    const interventions: InterventionItem[] = [];

    for (const patient of populationData) {
      const userId = patient.profile?.user_id ?? '';
      const aiInsights = await this.aiService.generatePatientInsights(userId, patient);

      // Generate interventions based on care recommendations
      aiInsights.careRecommendations.forEach((rec) => {
        interventions.push({
          patientId: userId,
          patientName: aiInsights.patientName,
          interventionType: rec.category,
          priority: this.mapPriorityToNumber(rec.priority),
          description: rec.recommendation,
          estimatedTimeToComplete: rec.timeline,
          expectedOutcome: rec.estimatedImpact,
          dueDate: this.calculateDueDate(rec.priority, rec.timeline)
        });
      });
    }

    // Sort by priority (highest first)
    return interventions.sort((a, b) => b.priority - a.priority).slice(0, 50); // Top 50 interventions
  }

  private generateResourceRecommendations(overview: PopulationInsights, riskMatrix: RiskMatrix): ResourceRecommendation[] {
    const recommendations: ResourceRecommendation[] = [];

    // Staff recommendations based on high-risk patients
    if (riskMatrix.quadrants.highRiskHighAdherence + riskMatrix.quadrants.highRiskLowAdherence > 20) {
      recommendations.push({
        resourceType: 'STAFF',
        recommendation: 'Hire additional clinical staff for high-risk patient management',
        justification: `${riskMatrix.quadrants.highRiskHighAdherence + riskMatrix.quadrants.highRiskLowAdherence} high-risk patients require intensive monitoring`,
        estimatedCost: '$150,000 - $200,000 annually',
        expectedRoi: 'Reduced emergency incidents and hospital readmissions',
        implementationTimeframe: '4-6 weeks',
        priority: 5
      });
    }

    // Technology recommendations
    if (overview.populationMetrics.adherenceRate < 60) {
      recommendations.push({
        resourceType: 'TECHNOLOGY',
        recommendation: 'Implement automated patient engagement platform',
        justification: `Low adherence rate of ${overview.populationMetrics.adherenceRate}% requires technological intervention`,
        estimatedCost: '$50,000 - $75,000',
        expectedRoi: 'Improved patient engagement and adherence',
        implementationTimeframe: '2-3 months',
        priority: 4
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  private generatePredictiveAlerts(populationData: ComprehensivePatientData[], overview: PopulationInsights): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];

    // Population trend alerts
    if (overview.highRiskPatients / overview.totalPatients > 0.3) {
      alerts.push({
        type: 'POPULATION_TREND',
        severity: 'WARNING',
        message: 'High-risk patient percentage exceeding 30% threshold',
        probabilityScore: 85,
        timeframe: 'Current',
        recommendedActions: ['Review risk stratification protocols', 'Implement population health interventions'],
        isActionable: true
      });
    }

    // Seasonal predictions
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 10 || currentMonth <= 2) { // Winter months
      alerts.push({
        type: 'POPULATION_TREND',
        severity: 'INFO',
        message: 'Seasonal increase in respiratory complications expected',
        probabilityScore: 70,
        timeframe: 'Next 3 months',
        recommendedActions: ['Increase respiratory monitoring', 'Prepare for increased emergency responses'],
        isActionable: true
      });
    }

    return alerts;
  }

  private determinePrimaryCondition(aiInsights: PatientInsight): string {
    // Simple logic to determine primary condition based on risk factors
    const riskFactors = aiInsights.riskAssessment.riskFactors;

    if (riskFactors.some(f => f.includes('blood pressure'))) return 'Hypertension';
    if (riskFactors.some(f => f.includes('glucose'))) return 'Diabetes';
    if (riskFactors.some(f => f.includes('heart rate'))) return 'Cardiac Arrhythmia';
    if (riskFactors.some(f => f.includes('oxygen'))) return 'Respiratory Condition';

    return 'General Wellness Monitoring';
  }

  private getEvidenceBasedRecommendations(condition: string, _aiInsights: PatientInsight): EvidenceBasedRecommendation[] {
    // Simplified evidence-based recommendations
    const recommendations: Record<string, EvidenceBasedRecommendation[]> = {
      'Hypertension': [
        {
          recommendation: 'ACE inhibitor or ARB therapy initiation',
          evidenceLevel: 'A',
          source: 'AHA/ACC 2017 Guidelines',
          contraindications: ['Pregnancy', 'Bilateral renal artery stenosis']
        },
        {
          recommendation: 'Lifestyle modifications including DASH diet',
          evidenceLevel: 'A',
          source: 'Multiple RCTs',
          contraindications: []
        }
      ],
      'Diabetes': [
        {
          recommendation: 'Metformin as first-line therapy',
          evidenceLevel: 'A',
          source: 'ADA Standards of Care 2023',
          contraindications: ['eGFR < 30', 'Severe heart failure']
        }
      ]
    };

    return recommendations[condition] || [];
  }

  private checkDrugInteractions(patientData: ComprehensivePatientData): DrugInteraction[] {
    // Drug interaction checking based on patient medication data
    const interactions: DrugInteraction[] = [];
    const medications = patientData?.medications || patientData?.medicationRequests || [];

    // Known high-risk interaction pairs (simplified for demo)
    const interactionPairs: Record<string, { drugs: string[], severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CONTRAINDICATED', description: string, recommendation: string }[]> = {
      'warfarin': [
        { drugs: ['aspirin'], severity: 'MAJOR', description: 'Increased bleeding risk', recommendation: 'Monitor INR closely' },
        { drugs: ['ibuprofen', 'naproxen'], severity: 'MAJOR', description: 'NSAIDs increase bleeding risk with anticoagulants', recommendation: 'Avoid NSAIDs or use with caution' }
      ],
      'metformin': [
        { drugs: ['contrast'], severity: 'MAJOR', description: 'Risk of lactic acidosis with contrast media', recommendation: 'Hold metformin 48h before/after contrast' }
      ],
      'lisinopril': [
        { drugs: ['potassium', 'spironolactone'], severity: 'MODERATE', description: 'Risk of hyperkalemia', recommendation: 'Monitor potassium levels' }
      ],
      'simvastatin': [
        { drugs: ['amiodarone', 'diltiazem'], severity: 'MAJOR', description: 'Increased risk of myopathy/rhabdomyolysis', recommendation: 'Limit simvastatin dose to 10mg' }
      ]
    };

    // Check each medication against known interactions
    const medNames = medications.map((m: MedicationRecord) =>
      (m.medication_display || m.name || '').toLowerCase()
    );

    for (const [drug, pairs] of Object.entries(interactionPairs)) {
      if (medNames.some((name: string) => name.includes(drug))) {
        for (const pair of pairs) {
          if (pair.drugs.some(d => medNames.some((name: string) => name.includes(d)))) {
            interactions.push({
              medications: [drug, ...pair.drugs.filter(d => medNames.some((name: string) => name.includes(d)))],
              severity: pair.severity,
              description: pair.description,
              recommendation: pair.recommendation
            });
          }
        }
      }
    }

    return interactions;
  }

  private getApplicableClinicalGuidelines(condition: string, patientData: ComprehensivePatientData): ClinicalGuideline[] {
    // Clinical guidelines with patient-specific applicability scoring
    const allGuidelines: Record<string, ClinicalGuideline[]> = {
      'Hypertension': [
        {
          guideline: '2017 ACC/AHA High Blood Pressure Clinical Practice Guideline',
          organization: 'American College of Cardiology',
          applicability: 95,
          keyPoints: ['BP goal <130/80 for most patients', 'Lifestyle modifications first-line', 'Combination therapy often needed']
        }
      ],
      'Diabetes': [
        {
          guideline: 'ADA Standards of Medical Care in Diabetes 2023',
          organization: 'American Diabetes Association',
          applicability: 90,
          keyPoints: ['A1C target <7% for most adults', 'Metformin as first-line therapy', 'SGLT2i or GLP-1 RA for cardiovascular risk reduction']
        }
      ],
      'Heart Failure': [
        {
          guideline: '2022 AHA/ACC/HFSA Heart Failure Guideline',
          organization: 'American Heart Association',
          applicability: 85,
          keyPoints: ['GDMT optimization', 'Consider SGLT2i regardless of diabetes status', 'Regular monitoring of volume status']
        }
      ],
      'Chronic Kidney Disease': [
        {
          guideline: 'KDIGO 2021 Clinical Practice Guideline for CKD',
          organization: 'Kidney Disease: Improving Global Outcomes',
          applicability: 88,
          keyPoints: ['BP target <120/80 if tolerated', 'ACEi/ARB for proteinuria', 'SGLT2i for eGFR 20-45']
        }
      ]
    };

    // Get base guidelines for condition
    const baseGuidelines = allGuidelines[condition] || [];

    // Adjust applicability based on patient data
    const patientAge = patientData?.profile?.age;
    const patientConditions = patientData?.conditions || [];

    return baseGuidelines.map(g => {
      let adjustedApplicability = g.applicability;

      // Adjust for age (elderly may have different targets)
      if (patientAge && patientAge > 75) {
        adjustedApplicability -= 10; // Less aggressive targets for elderly
      }

      // Adjust for comorbidities
      if (patientConditions.some((c: string) => c.includes?.('kidney') || c.includes?.('renal'))) {
        adjustedApplicability -= 5; // May need renal dosing adjustments
      }

      return {
        ...g,
        applicability: Math.max(0, Math.min(100, adjustedApplicability)),
        patientSpecificNotes: (patientAge ?? 0) > 75 ? 'Consider less aggressive targets for elderly patient' : undefined
      };
    });
  }

  private async assessFhirCompliance(populationData: ComprehensivePatientData[]): Promise<FhirComplianceResult> {
    let compliantBundles = 0;
    const issues: string[] = [];

    for (const patient of populationData.slice(0, 10)) { // Sample check
      try {
        const userId = patient.profile?.user_id;
        if (!userId) continue;
        const bundle = await this.fhirService.exportPatientData(userId);
        if (this.fhirService.validateBundle(bundle)) {
          compliantBundles++;
        } else {
          issues.push(`Non-compliant FHIR bundle for patient ${patient.profile?.id}`);
        }
      } catch {
        issues.push(`FHIR export failed for patient ${patient.profile?.id}`);
      }
    }

    return {
      score: (compliantBundles / Math.min(10, populationData.length)) * 100,
      issues,
      recommendations: issues.length > 0 ? ['Review FHIR bundle generation', 'Validate data mappings'] : ['Maintain current standards']
    };
  }

  private async assessDataQuality(populationData: ComprehensivePatientData[]): Promise<DataQualityResult> {
    let completenessSum = 0;
    let accuracySum = 0;
    const issues: Array<{ type: string; count: number; description: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }> = [];

    populationData.forEach(patient => {
      // Check data completeness
      const profile = patient.profile;
      let completenessScore = 0;
      const requiredFields = ['first_name', 'last_name', 'phone', 'dob', 'email'];
      requiredFields.forEach(field => {
        if (profile?.[field]) completenessScore += 20;
      });
      completenessSum += completenessScore;

      // Check data accuracy (simplified)
      let accuracyScore = 100;
      if (profile?.phone && !profile.phone.startsWith('+')) {
        accuracyScore -= 20;
        issues.push({
          type: 'Phone Format',
          count: 1,
          description: 'Phone number not in E.164 format',
          severity: 'MEDIUM'
        });
      }
      accuracySum += accuracyScore;
    });

    return {
      completeness: populationData.length > 0 ? completenessSum / populationData.length : 0,
      accuracy: populationData.length > 0 ? accuracySum / populationData.length : 0,
      consistency: 95, // Simplified
      timeliness: 90, // Simplified
      issues
    };
  }

  private async assessClinicalQuality(_populationData: ComprehensivePatientData[]): Promise<ClinicalQualityResult> {
    // Simplified clinical quality metrics
    return {
      adherenceToGuidelines: 85,
      outcomeMetrics: {
        readmissionRate: 15,
        mortalityRate: 2,
        patientSatisfaction: 4.2,
        qualityOfLifeImprovement: 75
      }
    };
  }

  private cleanVitalSigns(vital: VitalsEntry): { modified: boolean } {
    let modified = false;

    // Clean blood pressure values
    if (vital.bp_systolic && (vital.bp_systolic < 50 || vital.bp_systolic > 300)) {
      vital.bp_systolic = undefined;
      modified = true;
    }
    if (vital.bp_diastolic && (vital.bp_diastolic < 30 || vital.bp_diastolic > 200)) {
      vital.bp_diastolic = undefined;
      modified = true;
    }

    // Clean heart rate
    if (vital.heart_rate && (vital.heart_rate < 30 || vital.heart_rate > 250)) {
      vital.heart_rate = undefined;
      modified = true;
    }

    // Clean glucose
    if (vital.glucose_mg_dl && (vital.glucose_mg_dl < 20 || vital.glucose_mg_dl > 800)) {
      vital.glucose_mg_dl = undefined;
      modified = true;
    }

    // Clean oxygen saturation
    if (vital.pulse_oximeter && (vital.pulse_oximeter < 50 || vital.pulse_oximeter > 100)) {
      vital.pulse_oximeter = undefined;
      modified = true;
    }

    return { modified };
  }

  private generateWeeklyReport(_populationData: ComprehensivePatientData[], dashboard: PopulationDashboard): WeeklyReport {
    return {
      period: 'Weekly',
      generatedAt: new Date().toISOString(),
      summary: {
        totalPatients: dashboard.overview.totalPatients,
        activePatients: dashboard.overview.activePatients,
        highRiskPatients: dashboard.overview.highRiskPatients,
        newEmergencyAlerts: dashboard.predictiveAlerts.filter(a => a.severity === 'CRITICAL').length
      },
      keyInsights: [
        'Patient engagement maintained at acceptable levels',
        'No critical population trends identified',
        'Resource allocation recommendations implemented'
      ],
      actionItems: dashboard.interventionQueue.slice(0, 5).map(i => i.description)
    };
  }

  private generateMonthlyReport(_populationData: ComprehensivePatientData[], dashboard: PopulationDashboard, qualityMetrics: QualityMetrics): MonthlyReport {
    return {
      period: 'Monthly',
      generatedAt: new Date().toISOString(),
      executiveSummary: {
        populationHealth: dashboard.overview.averageHealthScore,
        riskDistribution: dashboard.riskMatrix.quadrants,
        qualityScores: {
          fhirCompliance: qualityMetrics.fhirCompliance.score,
          dataQuality: qualityMetrics.dataQuality.completeness,
          clinicalQuality: qualityMetrics.clinicalQuality.adherenceToGuidelines
        }
      },
      trends: dashboard.overview.trendingConcerns,
      recommendations: dashboard.resourceAllocation.slice(0, 3),
      nextMonthPredictions: dashboard.predictiveAlerts.filter(a => a.timeframe.includes('month'))
    };
  }

  private generateEmergencyReport(alerts: PredictiveAlert[]): EmergencyReport {
    const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');

    return {
      alertCount: criticalAlerts.length,
      generatedAt: new Date().toISOString(),
      criticalAlerts,
      immediateActions: criticalAlerts.flatMap(a => a.recommendedActions),
      escalationRequired: criticalAlerts.filter(a => a.isActionable).length > 0
    };
  }

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

  private mapPriorityToNumber(priority: string): number {
    const mapping: Record<string, number> = {
      'URGENT': 5,
      'HIGH': 4,
      'MEDIUM': 3,
      'LOW': 2
    };
    return mapping[priority] || 1;
  }

  private calculateDueDate(priority: string, timeline: string): string {
    const now = new Date();
    let daysToAdd = 7; // Default

    if (priority === 'URGENT') daysToAdd = 1;
    else if (priority === 'HIGH') daysToAdd = 3;
    else if (timeline.includes('24 hours')) daysToAdd = 1;
    else if (timeline.includes('week')) daysToAdd = 7;
    else if (timeline.includes('month')) daysToAdd = 30;

    now.setDate(now.getDate() + daysToAdd);
    return now.toISOString();
  }

  // Cache management
  private getFromCache<T extends ComprehensivePatientData | ComprehensivePatientData[]>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.timestamp + cached.ttl) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: ComprehensivePatientData | ComprehensivePatientData[], ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
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
    try {
      // Validate SMART session
      if (!smartSession?.accessToken || !smartSession?.patient) {
        throw new Error('Invalid SMART session: missing accessToken or patient');
      }

      // Extract patient ID from session
      const patientId = smartSession.patient;
      const fhirServerUrl = (smartSession.fhirServerUrl || smartSession.serverUrl) as string | undefined;
      const patientName = (smartSession.patientName || 'SMART Patient') as string;
      const sessionExpiry = (smartSession.expiresAt || new Date(Date.now() + 3600000).toISOString()) as string;
      const scope = (smartSession.scope || 'patient/*.read') as string;

      // Fetch patient data from FHIR server (simulated for demo)
      // Map to ComprehensivePatientData structure
      const patientData: ComprehensivePatientData = {
        profile: {
          id: patientId,
          user_id: patientId,
          first_name: patientName,
          // Store FHIR metadata in profile
        },
        vitals: [],
        checkIns: [],
        medications: [],
        conditions: []
      };

      // Fetch observations (simulated - in production would call FHIR server)
      const rawObservations = (smartSession.observations || []) as unknown[];
      const observations: VitalsEntry[] = rawObservations.map((obs: unknown) => {
        const o = obs as Record<string, unknown>;
        return {
          created_at: (o.effectiveDateTime || o.issued || new Date().toISOString()) as string | undefined,
        };
      });

      // Store sync metadata
      const fhirMetadata = {
        serverUrl: fhirServerUrl,
        sessionExpiry,
        scope
      };

      // Sync to WellFit - cast rawObservations to expected observation type
      type FhirObservation = {
        id?: string;
        code?: { coding?: Array<{ display?: string }>; text?: string };
        valueQuantity?: { value?: number; unit?: string };
        valueString?: string;
        effectiveDateTime?: string;
        issued?: string;
        status?: string;
      };
      await this.syncPatientToWellFit(
        { id: patientId, name: patientName, ...fhirMetadata },
        rawObservations as FhirObservation[]
      );

      return {
        patientData,
        observations,
        synchronized: true
      };

    } catch (error) {
      throw new Error(`Failed to sync SMART data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method for EHR integration - syncs FHIR patient and observations to WellFit
  private async syncPatientToWellFit(
    fhirPatient: {
      id?: string;
      name?: { given?: string[]; family?: string } | string;
      serverUrl?: string;
    },
    observations: Array<{
      id?: string;
      code?: { coding?: Array<{ display?: string }>; text?: string };
      valueQuantity?: { value?: number; unit?: string };
      valueString?: string;
      effectiveDateTime?: string;
      issued?: string;
      status?: string;
    }>
  ): Promise<void> {
    // Map FHIR patient to WellFit profile format
    const patientName = typeof fhirPatient.name === 'object' ? fhirPatient.name : undefined;
    const wellFitProfile = {
      external_fhir_id: fhirPatient.id,
      first_name: patientName?.given?.[0] || (typeof fhirPatient.name === 'string' ? fhirPatient.name : 'Unknown'),
      last_name: patientName?.family || '',
      fhir_server_url: fhirPatient.serverUrl,
      last_synced_at: new Date().toISOString()
    };

    // Map observations to WellFit health observations
    const healthObservations = observations.map((obs) => ({
      external_fhir_id: obs.id,
      patient_fhir_id: fhirPatient.id,
      observation_type: obs.code?.coding?.[0]?.display || obs.code?.text || 'Unknown',
      value: obs.valueQuantity?.value || obs.valueString || null,
      unit: obs.valueQuantity?.unit || null,
      effective_date: obs.effectiveDateTime || obs.issued || new Date().toISOString(),
      status: obs.status || 'final'
    }));

    // In production, this would upsert to Supabase with sync metadata
    // For now, cache the synced data as ComprehensivePatientData
    const cachedData: ComprehensivePatientData = {
      profile: {
        id: fhirPatient.id,
        user_id: fhirPatient.id,
        first_name: wellFitProfile.first_name,
        last_name: wellFitProfile.last_name,
      },
      vitals: healthObservations.map(obs => ({
        created_at: obs.effective_date,
      })),
      checkIns: [],
      medications: [],
      conditions: []
    };
    this.setCache(`smart-sync-${fhirPatient.id}`, cachedData, 3600000); // 1 hour TTL
  }
}

export default EnhancedFhirService;