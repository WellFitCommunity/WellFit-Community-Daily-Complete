/**
 * AI-Powered Readmission Risk Predictor
 *
 * Skill #3: Readmission Risk Predictor
 * - Uses Claude Sonnet 4.5 (accuracy matters for clinical decisions)
 * - Runs ONCE at discharge (95% token reduction vs continuous monitoring)
 * - Analyzes: discharge plans + SDOH + check-in patterns + readmission history
 * - Auto-generates care plans for high-risk patients
 *
 * Security: Input validation, SQL injection prevention, HIPAA compliance
 * Testing: Comprehensive Jest unit + integration tests
 */

import { supabase } from '../../lib/supabaseClient';
import { mcpOptimizer } from '../mcp/mcpCostOptimizer';
import type { MCPCostOptimizer } from '../mcp/mcpCostOptimizer';
import { ReadmissionTrackingService } from '../readmissionTrackingService';
import { featureExtractor } from './readmissionFeatureExtractor';
import type { ReadmissionRiskFeatures } from '../../types/readmissionRiskFeatures';
import { EVIDENCE_BASED_WEIGHTS, ENGAGEMENT_FEATURE_WEIGHTS } from '../../types/readmissionRiskFeatures';

// =====================================================
// TYPES
// =====================================================

export interface DischargeContext {
  patientId: string;
  tenantId: string;
  dischargeDate: string; // ISO timestamp
  dischargeFacility: string;
  dischargeDisposition: 'home' | 'home_health' | 'snf' | 'ltac' | 'rehab' | 'hospice';
  primaryDiagnosisCode?: string;
  primaryDiagnosisDescription?: string;
  secondaryDiagnoses?: string[];
  lengthOfStay?: number; // days
}

export interface RiskFactor {
  factor: string;
  weight: number; // 0.00 to 1.00 contribution to overall risk
  category: 'utilization_history' | 'social_determinants' | 'medication' | 'clinical' | 'adherence';
  evidence?: string;
}

export interface ProtectiveFactor {
  factor: string;
  impact: string; // Description of how it reduces risk
  category: string;
}

export interface RecommendedIntervention {
  intervention: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: number; // 0.00 to 1.00 reduction in readmission risk
  timeframe: string; // e.g., "within 48 hours", "daily for 14 days"
  responsible: string; // Role responsible
}

export interface ReadmissionPrediction {
  patientId: string;
  dischargeDate: string;
  readmissionRisk30Day: number; // 0.00 to 1.00
  readmissionRisk7Day: number;
  readmissionRisk90Day: number;
  riskCategory: 'low' | 'moderate' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  protectiveFactors: ProtectiveFactor[];
  recommendedInterventions: RecommendedIntervention[];
  predictedReadmissionDate?: string; // ISO date
  predictionConfidence: number; // 0.00 to 1.00
  dataSourcesAnalyzed: {
    readmissionHistory: boolean;
    sdohIndicators: boolean;
    checkinPatterns: boolean;
    medicationAdherence: boolean;
    carePlanAdherence: boolean;
  };
  aiModel: string;
  aiCost: number;
}

// =====================================================
// INPUT VALIDATION (Security)
// =====================================================

class DischargeValidator {
  static validateUUID(value: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error(`Invalid ${fieldName}: must be valid UUID`);
    }
  }

  static validateISODate(value: string, fieldName: string): void {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid ${fieldName}: must be valid ISO date`);
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

  static validateDischargeContext(context: DischargeContext): void {
    this.validateUUID(context.patientId, 'patientId');
    this.validateUUID(context.tenantId, 'tenantId');
    this.validateISODate(context.dischargeDate, 'dischargeDate');

    const validDispositions = ['home', 'home_health', 'snf', 'ltac', 'rehab', 'hospice'];
    if (!validDispositions.includes(context.dischargeDisposition)) {
      throw new Error(`Invalid dischargeDisposition: must be one of ${validDispositions.join(', ')}`);
    }

    if (context.dischargeFacility) {
      context.dischargeFacility = this.sanitizeText(context.dischargeFacility, 200);
    }

    if (context.primaryDiagnosisDescription) {
      context.primaryDiagnosisDescription = this.sanitizeText(context.primaryDiagnosisDescription, 300);
    }
  }
}

// =====================================================
// READMISSION RISK PREDICTOR SERVICE
// =====================================================

export class ReadmissionRiskPredictor {
  private optimizer: MCPCostOptimizer;

  constructor(optimizer?: MCPCostOptimizer) {
    this.optimizer = optimizer || mcpOptimizer;
  }

  /**
   * Predict readmission risk at discharge
   * Main entry point for the service
   */
  async predictReadmissionRisk(context: DischargeContext): Promise<ReadmissionPrediction> {
    // Security: Validate all inputs
    DischargeValidator.validateDischargeContext(context);

    // Check if skill is enabled for this tenant
    const config = await this.getTenantConfig(context.tenantId);
    if (!config.readmission_predictor_enabled) {
      throw new Error('Readmission risk predictor is not enabled for this tenant');
    }

    // Extract comprehensive evidence-based features
    const features = await featureExtractor.extractFeatures(context);

    // Generate risk prediction with AI (Sonnet for accuracy)
    const prediction = await this.generatePredictionWithAI(context, features, config);

    // Store prediction in database with comprehensive features
    await this.storePrediction(context, prediction, features);

    // Auto-create care plan if high risk and enabled
    if (
      config.readmission_predictor_auto_create_care_plan &&
      prediction.riskCategory in ['high', 'critical']
    ) {
      await this.autoCreateCarePlan(context, prediction);
    }

    // Create care team alert if critical risk
    if (prediction.riskCategory === 'critical') {
      await this.createCriticalRiskAlert(context, prediction);
    }

    return prediction;
  }

  /**
   * Gather comprehensive patient data for prediction
   */
  private async gatherPatientData(context: DischargeContext): Promise<any> {
    const patientId = context.patientId;
    const data: any = {
      sources: {
        readmissionHistory: false,
        sdohIndicators: false,
        checkinPatterns: false,
        medicationAdherence: false,
        carePlanAdherence: false
      }
    };

    try {
      // 1. Readmission history (last 90 days)
      const { data: readmissions } = await supabase
        .from('patient_readmissions')
        .select('*')
        .eq('patient_id', patientId)
        .gte('admission_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('admission_date', { ascending: false })
        .limit(10);

      if (readmissions && readmissions.length > 0) {
        data.readmissions = readmissions;
        data.readmissionCount = readmissions.length;
        data.recentReadmissions7d = readmissions.filter(r =>
          new Date(r.admission_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length;
        data.recentReadmissions30d = readmissions.filter(r =>
          new Date(r.admission_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length;
        data.sources.readmissionHistory = true;
      }

      // 2. SDOH indicators
      const { data: sdohIndicators } = await supabase
        .from('sdoh_indicators')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .limit(20);

      if (sdohIndicators && sdohIndicators.length > 0) {
        data.sdohIndicators = sdohIndicators;
        data.highRiskSDOH = sdohIndicators.filter((s: any) => s.risk_level in ['high', 'critical']);
        data.sources.sdohIndicators = true;
      }

      // 3. Check-in patterns (last 30 days)
      const { data: checkIns } = await supabase
        .from('patient_daily_check_ins')
        .select('*')
        .eq('patient_id', patientId)
        .gte('check_in_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('check_in_date', { ascending: false })
        .limit(30);

      if (checkIns && checkIns.length > 0) {
        data.checkIns = checkIns;
        data.checkInCompletionRate = checkIns.filter((c: any) => c.status === 'completed').length / 30;
        data.missedCheckIns = checkIns.filter((c: any) => c.status === 'missed').length;
        data.alertsTriggered = checkIns.filter((c: any) => c.alert_triggered).length;
        data.sources.checkinPatterns = true;
      }

      // 4. Medication data
      const { data: medications } = await supabase
        .from('fhir_medication_requests')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .limit(20);

      if (medications && medications.length > 0) {
        data.activeMedications = medications;
        data.medicationCount = medications.length;
        data.sources.medicationAdherence = true;
      }

      // 5. Active care plan
      const { data: carePlans } = await supabase
        .from('care_coordination_plans')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .limit(1);

      if (carePlans && carePlans.length > 0) {
        data.hasActiveCarePlan = true;
        data.carePlan = carePlans[0];
        data.sources.carePlanAdherence = true;
      } else {
        data.hasActiveCarePlan = false;
      }

      // 6. Patient profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('date_of_birth, chronic_conditions')
        .eq('id', patientId)
        .single();

      if (profile) {
        data.profile = profile;
        if (profile.date_of_birth) {
          const age = Math.floor(
            (Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
          );
          data.age = age;
        }
        if (profile.chronic_conditions) {
          data.chronicConditionsCount = Array.isArray(profile.chronic_conditions)
            ? profile.chronic_conditions.length
            : 0;
        }
      }

      return data;
    } catch (error: any) {
      throw new Error(`Failed to gather patient data: ${error.message}`);
    }
  }

  /**
   * Generate prediction using AI (Claude Sonnet for clinical accuracy)
   */
  private async generatePredictionWithAI(
    context: DischargeContext,
    features: ReadmissionRiskFeatures,
    config: any
  ): Promise<ReadmissionPrediction> {
    // Build comprehensive prompt with evidence-based features
    const prompt = this.buildComprehensivePredictionPrompt(context, features);

    // System prompt with comprehensive evidence-based guidelines
    const systemPrompt = `You are an expert clinical analyst specializing in readmission risk prediction for a rural community healthcare program.

EVIDENCE-BASED FEATURE WEIGHTING:
Use these validated predictive weights when assessing risk:

CLINICAL FACTORS (Highest Weight):
- Prior admissions in 30 days: 0.25 (STRONGEST predictor)
- Prior admissions in 90 days: 0.20
- ED visits in 6 months: 0.15
- Comorbidity count: 0.18
- High-risk diagnosis (CHF, COPD, diabetes, renal failure): 0.15

POST-DISCHARGE SETUP (Critical):
- No follow-up scheduled: 0.18 (HIGH RISK)
- Follow-up within 7 days: -0.12 (PROTECTIVE)
- No PCP assigned: risk factor
- Pending test results at discharge: risk factor

SOCIAL DETERMINANTS (Rural Population Focus):
- Transportation barriers: 0.16
- Lives alone with no caregiver: 0.14
- Rural isolation: 0.15
- Low health literacy: 0.12
- Financial barriers to medications: significant risk

MEDICATIONS:
- Polypharmacy (5+ meds): 0.13
- High-risk medications (anticoagulants, insulin, opioids): 0.14
- No prescription filled within 3 days: 0.16
- Significant medication changes during admission: risk factor

FUNCTIONAL STATUS:
- ADL dependencies: 0.12
- Recent falls (90 days): 0.11
- Cognitive impairment: 0.13

ENGAGEMENT & BEHAVIORAL (WellFit's UNIQUE Early Warning System):
- Consecutive missed check-ins (≥3): 0.16
- Sudden engagement drop: 0.18
- Game participation declining: 0.14
- Days with zero activity: 0.15
- Red flag symptoms (chest pain, SOB): 0.20
- Negative mood trend: 0.13
- Complete disengagement: 0.19
- Stopped responding: 0.22 (CRITICAL)

CRITICAL: WellFit's engagement data provides EARLY WARNING signals 7-14 days before clinical deterioration.
A sudden drop in check-in compliance, game participation, or social engagement is a powerful predictor.

Your predictions directly impact patient care. Be thorough, evidence-based, and accurate.

Return response as strict JSON with this structure:
{
  "readmissionRisk30Day": 0.65,
  "readmissionRisk7Day": 0.35,
  "readmissionRisk90Day": 0.75,
  "riskCategory": "high",
  "riskFactors": [
    {"factor": "3 readmissions in past 90 days", "weight": 0.35, "category": "utilization_history", "evidence": "..."},
    {"factor": "Housing instability", "weight": 0.20, "category": "social_determinants", "evidence": "..."}
  ],
  "protectiveFactors": [
    {"factor": "Strong family support", "impact": "Reduces risk by 15%", "category": "social_support"}
  ],
  "recommendedInterventions": [
    {"intervention": "Daily nurse check-ins for 14 days", "priority": "high", "estimatedImpact": 0.25, "timeframe": "daily for 14 days", "responsible": "care_coordinator"}
  ],
  "predictedReadmissionDate": "2025-12-01",
  "predictionConfidence": 0.85
}`;

    try {
      const aiResponse = await this.optimizer.call({
        prompt,
        systemPrompt,
        model: config.readmission_predictor_model || 'claude-sonnet-4-5-20250929',
        complexity: 'complex',
        userId: context.patientId,
        context: {
          dischargeDate: context.dischargeDate,
          dataCompleteness: features.dataCompletenessScore
        }
      });

      // Parse AI response
      const parsed = this.parseAIPrediction(aiResponse.response);

      return {
        patientId: context.patientId,
        dischargeDate: context.dischargeDate,
        readmissionRisk30Day: parsed.readmissionRisk30Day,
        readmissionRisk7Day: parsed.readmissionRisk7Day,
        readmissionRisk90Day: parsed.readmissionRisk90Day,
        riskCategory: parsed.riskCategory,
        riskFactors: parsed.riskFactors,
        protectiveFactors: parsed.protectiveFactors || [],
        recommendedInterventions: parsed.recommendedInterventions,
        predictedReadmissionDate: parsed.predictedReadmissionDate,
        predictionConfidence: parsed.predictionConfidence * (features.dataCompletenessScore / 100),
        dataSourcesAnalyzed: {
          readmissionHistory: features.clinical.priorAdmissions30Day !== undefined,
          sdohIndicators: features.socialDeterminants.livesAlone !== undefined,
          checkinPatterns: features.engagement.checkInCompletionRate30Day !== undefined,
          medicationAdherence: features.medication.activeMedicationCount > 0,
          carePlanAdherence: features.postDischarge.followUpScheduled !== undefined
        },
        aiModel: aiResponse.model,
        aiCost: aiResponse.cost
      };
    } catch (error: any) {
      throw new Error(`AI prediction generation failed: ${error.message}`);
    }
  }

  /**
   * Build comprehensive prediction prompt using evidence-based features
   */
  private buildComprehensivePredictionPrompt(context: DischargeContext, features: ReadmissionRiskFeatures): string {
    let prompt = `Predict 30-day readmission risk for patient discharged on ${context.dischargeDate}:\n\n`;

    // Discharge Information
    prompt += `=== DISCHARGE INFORMATION ===\n`;
    prompt += `- Facility: ${context.dischargeFacility}\n`;
    prompt += `- Disposition: ${context.dischargeDisposition}\n`;
    if (context.primaryDiagnosisDescription) {
      prompt += `- Primary Diagnosis: ${context.primaryDiagnosisDescription} (${context.primaryDiagnosisCode})\n`;
      prompt += `- High-Risk Diagnosis: ${features.clinical.isHighRiskDiagnosis ? 'YES (CHF/COPD/Diabetes/Renal)' : 'No'}\n`;
    }
    if (context.lengthOfStay) {
      prompt += `- Length of Stay: ${context.lengthOfStay} days (${features.clinical.lengthOfStayCategory})\n`;
    }

    // CLINICAL FACTORS (Highest Weight)
    prompt += `\n=== CLINICAL FACTORS (Highest Predictive Weight) ===\n`;
    prompt += `UTILIZATION HISTORY (STRONGEST predictors):\n`;
    prompt += `- Prior admissions (30 days): ${features.clinical.priorAdmissions30Day} [Weight: 0.25]\n`;
    prompt += `- Prior admissions (90 days): ${features.clinical.priorAdmissions90Day} [Weight: 0.20]\n`;
    prompt += `- ED visits (6 months): ${features.clinical.edVisits6Month} [Weight: 0.15]\n`;

    prompt += `\nCOMORBIDITIES:\n`;
    prompt += `- Total comorbidities: ${features.clinical.comorbidityCount} [Weight: 0.18]\n`;
    prompt += `- CHF: ${features.clinical.hasChf ? 'YES' : 'No'}\n`;
    prompt += `- COPD: ${features.clinical.hasCopd ? 'YES' : 'No'}\n`;
    prompt += `- Diabetes: ${features.clinical.hasDiabetes ? 'YES' : 'No'}\n`;
    prompt += `- Renal Failure: ${features.clinical.hasRenalFailure ? 'YES' : 'No'}\n`;

    if (features.clinical.systolicBpAtDischarge || features.clinical.labsWithinNormalLimits !== undefined) {
      prompt += `\nVITALS & LABS AT DISCHARGE:\n`;
      prompt += `- Vitals stable: ${features.clinical.vitalSignsStableAtDischarge ? 'YES (protective)' : 'NO (risk factor)'}\n`;
      if (features.clinical.systolicBpAtDischarge) {
        prompt += `- BP: ${features.clinical.systolicBpAtDischarge}/${features.clinical.diastolicBpAtDischarge}\n`;
      }
      if (features.clinical.oxygenSaturationAtDischarge) {
        prompt += `- O2 Sat: ${features.clinical.oxygenSaturationAtDischarge}%\n`;
      }
      prompt += `- Labs within normal limits: ${features.clinical.labsWithinNormalLimits ? 'Yes' : 'No'}\n`;
      prompt += `- Lab trends concerning: ${features.clinical.labTrendsConcerning ? 'YES (risk)' : 'No'} [Weight: 0.11]\n`;
    }

    // MEDICATIONS
    prompt += `\n=== MEDICATION FACTORS ===\n`;
    prompt += `- Active medications: ${features.medication.activeMedicationCount}\n`;
    prompt += `- Polypharmacy (5+ meds): ${features.medication.isPolypharmacy ? 'YES [Weight: 0.13]' : 'No'}\n`;
    prompt += `- High-risk medications: ${features.medication.hasHighRiskMedications ? 'YES [Weight: 0.14]' : 'No'}\n`;
    if (features.medication.highRiskMedicationList.length > 0) {
      prompt += `  Classes: ${features.medication.highRiskMedicationList.join(', ')}\n`;
    }
    if (features.medication.significantMedicationChanges) {
      prompt += `- Significant medication changes during admission: YES (risk factor)\n`;
    }
    prompt += `- Prescription filled within 3 days: ${features.medication.prescriptionFilledWithin3Days ?? 'Unknown'}\n`;
    if (features.medication.noPrescriptionFilled) {
      prompt += `  ⚠️ NO prescription filled [Weight: 0.16 - HIGH RISK]\n`;
    }

    // POST-DISCHARGE SETUP (Critical)
    prompt += `\n=== POST-DISCHARGE SETUP (Critical for Success) ===\n`;
    if (features.postDischarge.noFollowUpScheduled) {
      prompt += `⚠️ NO FOLLOW-UP SCHEDULED [Weight: 0.18 - HIGH RISK]\n`;
    } else {
      prompt += `- Follow-up scheduled: YES\n`;
      prompt += `- Days until follow-up: ${features.postDischarge.daysUntilFollowUp}\n`;
      prompt += `- Within 7 days: ${features.postDischarge.followUpWithin7Days ? 'YES [Weight: -0.12 PROTECTIVE]' : 'NO (risk)'}\n`;
    }
    prompt += `- PCP assigned: ${features.postDischarge.hasPcpAssigned ? 'Yes' : 'NO (risk factor)'}\n`;
    prompt += `- Discharge destination: ${features.postDischarge.dischargeDestination}\n`;
    if (features.postDischarge.dischargeToHomeAlone) {
      prompt += `  ⚠️ Discharging home ALONE (risk factor)\n`;
    }
    if (features.postDischarge.hasPendingTestResults) {
      prompt += `- Pending test results: YES (risk factor)\n`;
      prompt += `  Tests: ${features.postDischarge.pendingTestResultsList.join(', ')}\n`;
    }

    // SOCIAL DETERMINANTS (Rural Focus)
    prompt += `\n=== SOCIAL DETERMINANTS (Rural Population Focus) ===\n`;
    prompt += `- Lives alone: ${features.socialDeterminants.livesAlone ? 'YES [Weight: 0.14]' : 'No'}\n`;
    prompt += `- Has caregiver: ${features.socialDeterminants.hasCaregiver ? 'Yes (protective)' : 'NO (risk)'}\n`;
    if (features.socialDeterminants.hasTransportationBarrier) {
      prompt += `⚠️ TRANSPORTATION BARRIER [Weight: 0.16]\n`;
      if (features.socialDeterminants.distanceToNearestHospitalMiles) {
        prompt += `  Distance to hospital: ${features.socialDeterminants.distanceToNearestHospitalMiles} miles\n`;
      }
    }
    if (features.socialDeterminants.isRuralLocation) {
      prompt += `⚠️ RURAL LOCATION [Weight: 0.15]\n`;
      prompt += `  Rural isolation score: ${features.socialDeterminants.ruralIsolationScore}/10\n`;
    }
    prompt += `- Insurance: ${features.socialDeterminants.insuranceType}\n`;
    if (features.socialDeterminants.hasMedicaid || features.socialDeterminants.hasInsuranceGaps) {
      prompt += `  Financial barriers: ${features.socialDeterminants.financialBarriersToMedications ? 'Medications' : ''} ${features.socialDeterminants.financialBarriersToFollowUp ? 'Follow-up' : ''}\n`;
    }
    if (features.socialDeterminants.lowHealthLiteracy) {
      prompt += `- Low health literacy [Weight: 0.12]\n`;
    }
    prompt += `- Socially isolated: ${features.socialDeterminants.sociallyIsolated ? 'YES (risk)' : 'No'}\n`;

    // FUNCTIONAL STATUS
    prompt += `\n=== FUNCTIONAL STATUS ===\n`;
    if (features.functionalStatus.adlDependencies > 0) {
      prompt += `- ADL dependencies: ${features.functionalStatus.adlDependencies} [Weight: 0.12]\n`;
    }
    if (features.functionalStatus.hasCognitiveImpairment) {
      prompt += `- Cognitive impairment: ${features.functionalStatus.cognitiveImpairmentSeverity} [Weight: 0.13]\n`;
    }
    if (features.functionalStatus.hasRecentFalls) {
      prompt += `- Recent falls: ${features.functionalStatus.fallsInPast90Days} in 90 days [Weight: 0.11]\n`;
      prompt += `  Fall risk score: ${features.functionalStatus.fallRiskScore}/10\n`;
    }
    prompt += `- Mobility: ${features.functionalStatus.mobilityLevel}\n`;

    // ENGAGEMENT & BEHAVIORAL (WellFit's Unique Advantage)
    prompt += `\n=== ENGAGEMENT & BEHAVIORAL (WellFit's EARLY WARNING System) ===\n`;
    prompt += `CHECK-IN COMPLIANCE:\n`;
    prompt += `- 30-day completion rate: ${(features.engagement.checkInCompletionRate30Day * 100).toFixed(0)}%\n`;
    prompt += `- 7-day completion rate: ${(features.engagement.checkInCompletionRate7Day * 100).toFixed(0)}%\n`;
    if (features.engagement.consecutiveMissedCheckIns >= 3) {
      prompt += `⚠️ CONSECUTIVE MISSED CHECK-INS: ${features.engagement.consecutiveMissedCheckIns} [Weight: 0.16]\n`;
    }
    if (features.engagement.hasEngagementDrop) {
      prompt += `⚠️ SUDDEN ENGAGEMENT DROP (30% decline) [Weight: 0.18 - CRITICAL]\n`;
    }
    if (features.engagement.stoppedResponding) {
      prompt += `🚨 PATIENT STOPPED RESPONDING [Weight: 0.22 - HIGHEST BEHAVIORAL RISK]\n`;
    }

    prompt += `\nGAME PARTICIPATION (Cognitive Engagement):\n`;
    prompt += `- Trivia participation: ${(features.engagement.triviaParticipationRate30Day * 100).toFixed(0)}%\n`;
    prompt += `- Word find participation: ${(features.engagement.wordFindParticipationRate30Day * 100).toFixed(0)}%\n`;
    prompt += `- Overall game engagement: ${features.engagement.gameEngagementScore}/100\n`;
    if (features.engagement.gameEngagementDeclining) {
      prompt += `⚠️ GAME ENGAGEMENT DECLINING [Weight: 0.14]\n`;
    }

    prompt += `\nSOCIAL & COMMUNITY ENGAGEMENT:\n`;
    prompt += `- Community interaction score: ${features.engagement.communityInteractionScore}/100\n`;
    if (features.engagement.daysWithZeroActivity > 7) {
      prompt += `⚠️ DAYS WITH ZERO ACTIVITY: ${features.engagement.daysWithZeroActivity} [Weight: 0.15]\n`;
    }
    if (features.engagement.socialEngagementDeclining) {
      prompt += `- Social engagement: DECLINING (risk factor)\n`;
    }

    prompt += `\nHEALTH ALERTS:\n`;
    prompt += `- Alerts triggered (30 days): ${features.engagement.healthAlertsTriggered30Day}\n`;
    if (features.engagement.criticalAlertsTriggered > 0) {
      prompt += `⚠️ CRITICAL ALERTS: ${features.engagement.criticalAlertsTriggered}\n`;
    }

    prompt += `\nOVERALL ENGAGEMENT:\n`;
    prompt += `- Overall engagement score: ${features.engagement.overallEngagementScore}/100\n`;
    prompt += `- Engagement change: ${features.engagement.engagementChangePercent.toFixed(0)}%\n`;
    if (features.engagement.isDisengaging) {
      prompt += `🚨 PATIENT IS DISENGAGING [Weight: 0.19 - CRITICAL EARLY WARNING]\n`;
    }
    if (features.engagement.concerningPatterns.length > 0) {
      prompt += `- Concerning patterns: ${features.engagement.concerningPatterns.join(', ')}\n`;
    }

    // SELF-REPORTED HEALTH
    if (features.selfReported.hasRedFlagSymptoms) {
      prompt += `\n=== SELF-REPORTED HEALTH (Patient Perspective) ===\n`;
      prompt += `🚨 RED FLAG SYMPTOMS REPORTED [Weight: 0.20]:\n`;
      features.selfReported.redFlagSymptomsList.forEach(symptom => {
        prompt += `  - ${symptom}\n`;
      });
    }
    if (features.selfReported.symptomCount30Day > 0) {
      prompt += `\nRECENT SYMPTOMS (30 days): ${features.selfReported.symptomCount30Day}\n`;
    }
    if (features.selfReported.negativeModeTrend) {
      prompt += `⚠️ NEGATIVE MOOD TREND [Weight: 0.13]\n`;
    }
    if (features.selfReported.selfReportedBpTrendConcerning || features.selfReported.selfReportedBloodSugarUnstable) {
      prompt += `- Concerning vital trends: BP ${features.selfReported.selfReportedBpTrendConcerning ? 'YES' : 'No'}, Blood sugar ${features.selfReported.selfReportedBloodSugarUnstable ? 'YES' : 'No'}\n`;
    }
    if (features.selfReported.missedMedicationsDays30Day > 0) {
      prompt += `- Missed medications: ${features.selfReported.missedMedicationsDays30Day} days [Weight: 0.14]\n`;
    }
    if (features.selfReported.daysHomeAlone30Day > 15) {
      prompt += `- Days home alone: ${features.selfReported.daysHomeAlone30Day}/30 [Weight: 0.12]\n`;
    }

    // DATA COMPLETENESS
    prompt += `\n=== DATA QUALITY ===\n`;
    prompt += `- Data completeness: ${features.dataCompletenessScore}%\n`;
    if (features.missingCriticalData.length > 0) {
      prompt += `- Missing critical data: ${features.missingCriticalData.join(', ')}\n`;
      prompt += `  (Note: Lower confidence when critical data missing)\n`;
    }

    prompt += `\n=== TASK ===\n`;
    prompt += `Analyze ALL factors above using the evidence-based weights provided.\n`;
    prompt += `Pay special attention to:\n`;
    prompt += `1. Prior admissions (strongest predictor)\n`;
    prompt += `2. WellFit engagement patterns (unique early warning)\n`;
    prompt += `3. Post-discharge setup (follow-up timing is critical)\n`;
    prompt += `4. Rural/social barriers\n\n`;
    prompt += `Provide comprehensive 30-day readmission risk prediction with:\n`;
    prompt += `- Risk scores (7-day, 30-day, 90-day)\n`;
    prompt += `- Risk category (low/moderate/high/critical)\n`;
    prompt += `- Specific risk factors with weights\n`;
    prompt += `- Protective factors\n`;
    prompt += `- Prioritized interventions\n`;
    prompt += `- Prediction confidence`;

    return prompt;
  }

  /**
   * Parse AI prediction response
   */
  private parseAIPrediction(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate risk scores
      if (parsed.readmissionRisk30Day < 0 || parsed.readmissionRisk30Day > 1) {
        throw new Error('Invalid risk score: must be between 0 and 1');
      }

      return parsed;
    } catch (error: any) {
      throw new Error(`Failed to parse AI prediction: ${error.message}`);
    }
  }

  /**
   * Store prediction in database with comprehensive features
   */
  private async storePrediction(
    context: DischargeContext,
    prediction: ReadmissionPrediction,
    features: ReadmissionRiskFeatures
  ): Promise<void> {
    await supabase
      .from('readmission_risk_predictions')
      .insert({
        tenant_id: context.tenantId,
        patient_id: context.patientId,
        discharge_date: context.dischargeDate,
        discharge_facility: context.dischargeFacility,
        discharge_disposition: context.dischargeDisposition,
        primary_diagnosis_code: context.primaryDiagnosisCode,
        primary_diagnosis_description: context.primaryDiagnosisDescription,
        readmission_risk_30_day: prediction.readmissionRisk30Day,
        readmission_risk_7_day: prediction.readmissionRisk7Day,
        readmission_risk_90_day: prediction.readmissionRisk90Day,
        risk_category: prediction.riskCategory,
        risk_factors: prediction.riskFactors,
        protective_factors: prediction.protectiveFactors,
        recommended_interventions: prediction.recommendedInterventions,
        predicted_readmission_date: prediction.predictedReadmissionDate,
        prediction_confidence: prediction.predictionConfidence,
        data_sources_analyzed: prediction.dataSourcesAnalyzed,
        ai_model_used: prediction.aiModel,
        ai_cost: prediction.aiCost,
        // Store comprehensive features for analysis and reporting
        clinical_features: features.clinical,
        medication_features: features.medication,
        post_discharge_features: features.postDischarge,
        social_determinants_features: features.socialDeterminants,
        functional_status_features: features.functionalStatus,
        engagement_features: features.engagement,
        self_reported_features: features.selfReported,
        data_completeness_score: features.dataCompletenessScore,
        missing_critical_data: features.missingCriticalData
      });
  }

  /**
   * Auto-create care plan for high-risk patients
   */
  private async autoCreateCarePlan(
    context: DischargeContext,
    prediction: ReadmissionPrediction
  ): Promise<void> {
    try {
      // Convert recommended interventions to care plan format
      const goals = [
        {
          goal: 'Prevent 30-day readmission',
          target: 'Zero hospital readmissions',
          timeframe: '30 days',
          current_status: 'in_progress'
        }
      ];

      const interventions = prediction.recommendedInterventions.map(rec => ({
        intervention: rec.intervention,
        frequency: rec.timeframe,
        responsible: rec.responsible,
        priority: rec.priority,
        status: 'pending'
      }));

      const barriers = prediction.riskFactors
        .filter(rf => rf.category === 'social_determinants')
        .map(rf => ({
          barrier: rf.factor,
          solution: `Address via ${rf.category} intervention`,
          priority: 'high',
          status: 'identified'
        }));

      await supabase.from('care_coordination_plans').insert({
        patient_id: context.patientId,
        plan_type: 'readmission_prevention',
        status: 'active',
        priority: prediction.riskCategory === 'critical' ? 'critical' : 'high',
        title: `AI-Generated Readmission Prevention Plan (${prediction.riskCategory} risk)`,
        goals,
        interventions,
        barriers,
        start_date: new Date().toISOString().split('T')[0],
        next_review_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        success_metrics: {
          readmission_avoided: true,
          intervention_adherence: '>90%',
          patient_satisfaction: '>4/5'
        },
        clinical_notes: `Automatically generated based on AI readmission risk prediction. Risk: ${(prediction.readmissionRisk30Day * 100).toFixed(0)}% 30-day readmission probability. Model: ${prediction.aiModel}. Confidence: ${(prediction.predictionConfidence * 100).toFixed(0)}%.`
      });
    } catch (error) {
      // Don't fail prediction if care plan creation fails
    }
  }

  /**
   * Create critical risk alert
   */
  private async createCriticalRiskAlert(
    context: DischargeContext,
    prediction: ReadmissionPrediction
  ): Promise<void> {
    try {
      await supabase.from('care_team_alerts').insert({
        patient_id: context.patientId,
        alert_type: 'readmission_risk_high',
        severity: 'critical',
        priority: 'emergency',
        title: `CRITICAL: High Readmission Risk (${(prediction.readmissionRisk30Day * 100).toFixed(0)}%)`,
        description: `Patient discharged with ${(prediction.readmissionRisk30Day * 100).toFixed(0)}% 30-day readmission risk. Immediate intervention required.`,
        alert_data: {
          discharge_date: context.dischargeDate,
          risk_score: prediction.readmissionRisk30Day,
          risk_category: prediction.riskCategory,
          top_risk_factors: prediction.riskFactors.slice(0, 3),
          urgent_interventions: prediction.recommendedInterventions.filter(i => i.priority in ['high', 'critical'])
        },
        status: 'active'
      });
    } catch (error) {
      // Don't fail prediction if alert creation fails
    }
  }

  /**
   * Get tenant configuration
   */
  private async getTenantConfig(tenantId: string): Promise<any> {
    const { data, error } = await supabase
      .rpc('get_ai_skill_config', { p_tenant_id: tenantId });

    if (error) {
      throw new Error(`Failed to get tenant config: ${error.message}`);
    }

    return data || {
      readmission_predictor_enabled: false,
      readmission_predictor_auto_create_care_plan: false,
      readmission_predictor_high_risk_threshold: 0.50,
      readmission_predictor_model: 'claude-sonnet-4-5-20250929'
    };
  }

  /**
   * Update prediction with actual outcome (for continuous learning)
   */
  async updateActualOutcome(
    predictionId: string,
    actualReadmission: boolean,
    actualReadmissionDate?: string
  ): Promise<void> {
    DischargeValidator.validateUUID(predictionId, 'predictionId');

    const updates: any = {
      actual_readmission_occurred: actualReadmission
    };

    if (actualReadmission && actualReadmissionDate) {
      updates.actual_readmission_date = actualReadmissionDate;

      // Calculate days post-discharge
      const { data: prediction } = await supabase
        .from('readmission_risk_predictions')
        .select('discharge_date')
        .eq('id', predictionId)
        .single();

      if (prediction) {
        const daysDiff = Math.floor(
          (new Date(actualReadmissionDate).getTime() - new Date(prediction.discharge_date).getTime()) /
          (24 * 60 * 60 * 1000)
        );
        updates.actual_readmission_days_post_discharge = daysDiff;
      }
    }

    await supabase
      .from('readmission_risk_predictions')
      .update(updates)
      .eq('id', predictionId);

    // Note: Accuracy score is calculated automatically by database trigger
  }
}

// Export singleton instance
export const readmissionRiskPredictor = new ReadmissionRiskPredictor();
