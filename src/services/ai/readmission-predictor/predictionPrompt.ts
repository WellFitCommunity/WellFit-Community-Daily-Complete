/**
 * Readmission Prediction Prompt Builder & AI Response Parser
 *
 * Extracted verbatim from readmissionRiskPredictor.ts during god-file
 * decomposition (CLAUDE.md Commandment #12). Behavior-preserving move only.
 *
 * NOTE: The system prompt and prompt-builder output are verified byte-identical
 * by readmissionRiskPredictor.golden.test.ts — do NOT alter the text.
 */

import type { ReadmissionRiskFeatures } from '../../../types/readmissionRiskFeatures';
import { isRecord, type DischargeContext, type ParsedAIPrediction } from './types';

/**
 * System prompt with comprehensive evidence-based guidelines.
 * Uses Claude Sonnet for clinical accuracy.
 */
export const READMISSION_SYSTEM_PROMPT = `You are an expert clinical analyst specializing in readmission risk prediction for a rural community healthcare program.

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

/**
 * Build comprehensive prediction prompt using evidence-based features
 */
export function buildComprehensivePredictionPrompt(context: DischargeContext, features: ReadmissionRiskFeatures): string {
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

  // SOCIAL DETERMINANTS (Rural Focus with Enhanced RUCA-based Classification)
  prompt += `\n=== SOCIAL DETERMINANTS (Rural Population Focus) ===\n`;
  prompt += `- Lives alone: ${features.socialDeterminants.livesAlone ? 'YES [Weight: 0.14]' : 'No'}\n`;
  prompt += `- Has caregiver: ${features.socialDeterminants.hasCaregiver ? 'Yes (protective)' : 'NO (risk)'}\n`;

  // Enhanced Rural Classification (RUCA-based)
  prompt += `\nGEOGRAPHIC ACCESS TO CARE:\n`;
  if (features.socialDeterminants.rucaCategory) {
    const rucaWeights: Record<string, string> = {
      'urban': '0.00 (baseline)',
      'large_rural': '0.08',
      'small_rural': '0.12',
      'isolated_rural': '0.18'
    };
    prompt += `- RUCA Classification: ${features.socialDeterminants.rucaCategory.toUpperCase()} [Weight: ${rucaWeights[features.socialDeterminants.rucaCategory] || 'N/A'}]\n`;
  }
  if (features.socialDeterminants.patientRurality) {
    prompt += `- Rurality Category: ${features.socialDeterminants.patientRurality}\n`;
  }
  if (features.socialDeterminants.distanceToCareRiskWeight && features.socialDeterminants.distanceToCareRiskWeight > 0) {
    prompt += `⚠️ DISTANCE-TO-CARE RISK WEIGHT: ${(features.socialDeterminants.distanceToCareRiskWeight * 100).toFixed(0)}% contribution\n`;
  }
  if (features.socialDeterminants.minutesToNearestED) {
    prompt += `  - Minutes to nearest ED: ${features.socialDeterminants.minutesToNearestED}\n`;
  }
  if (features.socialDeterminants.isInHealthcareShortageArea) {
    prompt += `⚠️ HEALTHCARE PROFESSIONAL SHORTAGE AREA (HPSA) [Weight: +0.10]\n`;
  }

  if (features.socialDeterminants.hasTransportationBarrier) {
    prompt += `⚠️ TRANSPORTATION BARRIER [Weight: 0.16]\n`;
    if (features.socialDeterminants.distanceToNearestHospitalMiles) {
      prompt += `  Distance to hospital: ${features.socialDeterminants.distanceToNearestHospitalMiles} miles\n`;
    }
    if (features.socialDeterminants.distanceToPcpMiles) {
      prompt += `  Distance to PCP: ${features.socialDeterminants.distanceToPcpMiles} miles\n`;
    }
  }
  if (features.socialDeterminants.isRuralLocation) {
    prompt += `⚠️ RURAL LOCATION [Weight: 0.15]\n`;
    prompt += `  Rural isolation score: ${features.socialDeterminants.ruralIsolationScore}/10\n`;
  }

  prompt += `\nSOCIOECONOMIC FACTORS:\n`;
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
  if (features.engagement.negativeModeTrend) {
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
  prompt += `4. Rural/geographic access barriers (RUCA category, distance-to-care, HPSA status)\n`;
  prompt += `5. Social determinants (transportation, caregiver, health literacy)\n\n`;
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
export function parseAIPrediction(response: string): ParsedAIPrediction {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const raw: unknown = JSON.parse(jsonMatch[0]);
    if (!isRecord(raw)) {
      throw new Error('AI prediction is not a valid JSON object');
    }

    const risk30 = raw.readmissionRisk30Day;
    const risk7 = raw.readmissionRisk7Day;
    const risk90 = raw.readmissionRisk90Day;
    const _category = raw.riskCategory;

    if (typeof risk30 !== 'number' || typeof risk7 !== 'number' || typeof risk90 !== 'number') {
      throw new Error('Invalid risk scores: expected numeric values');
    }
    if (risk30 < 0 || risk30 > 1) {
      throw new Error('Invalid risk score: must be between 0 and 1');
    }

    // NOTE: We keep parsing permissive to avoid behavior changes; downstream uses existing shapes.
    return raw as unknown as ParsedAIPrediction;
  } catch (err: unknown) {
    throw new Error(`Failed to parse AI prediction: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}
