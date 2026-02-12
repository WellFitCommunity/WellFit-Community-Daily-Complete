// FHIR AI Service — Patient Insights Module
// Generates patient-level insights, predictions, care recommendations, and real-time monitoring alerts

import type {
  PatientData,
  HealthRiskAssessment,
  VitalsTrend,
  PatientInsight,
  EmergencyAlert,
  PredictedOutcome,
  CareRecommendation,
  AiConfiguration,
  VitalsReading,
} from './types';

import {
  assessPatientRisk,
  analyzeVitalsTrends,
  calculateAdherenceScore,
  detectEmergencyConditions,
  calculateOverallHealthScore,
  createEmergencyAlert,
} from './riskAssessment';

// ---- Predictive Modeling ----

/** Calculate simplified cardiovascular risk */
function calculateCardiovascularRisk(vitals: VitalsReading[], riskScore: number): number {
  // Simplified cardiovascular risk model
  let cvRisk = riskScore * 0.6; // Base on overall risk

  // Add specific cardiovascular factors
  const latestVitals = vitals[0];
  if ((latestVitals?.bp_systolic ?? 0) > 140) cvRisk += 15;
  if ((latestVitals?.heart_rate ?? 0) > 100) cvRisk += 10;

  return Math.min(95, cvRisk);
}

/** Calculate simplified diabetes complications risk */
function calculateDiabetesRisk(vitals: VitalsReading[], riskScore: number): number {
  let diabetesRisk = riskScore * 0.7;

  const latestVitals = vitals[0];
  const glucose = latestVitals?.glucose_mg_dl ?? 0;
  if (glucose > 250) diabetesRisk += 20;
  else if (glucose > 180) diabetesRisk += 10;

  return Math.min(90, diabetesRisk);
}

/** Generate predicted outcomes based on patient data and risk assessment */
export function generatePredictedOutcomes(patientData: PatientData, riskAssessment: HealthRiskAssessment): PredictedOutcome[] {
  const outcomes: PredictedOutcome[] = [];
  const vitals = patientData.vitals || [];
  const riskFactors = riskAssessment.riskFactors;

  // Cardiovascular risk prediction
  if (riskFactors.some(f => f.includes('blood pressure') || f.includes('heart rate'))) {
    outcomes.push({
      condition: 'Cardiovascular Event',
      probability: calculateCardiovascularRisk(vitals, riskAssessment.riskScore),
      timeframe: '6 months',
      confidenceLevel: 'MEDIUM',
      basedOn: ['Blood pressure trends', 'Heart rate patterns', 'Risk score']
    });
  }

  // Diabetes complications
  if (riskFactors.some(f => f.includes('glucose'))) {
    outcomes.push({
      condition: 'Diabetes Complications',
      probability: calculateDiabetesRisk(vitals, riskAssessment.riskScore),
      timeframe: '3 months',
      confidenceLevel: 'HIGH',
      basedOn: ['Glucose level trends', 'Overall health score']
    });
  }

  // Hospital readmission risk
  if (riskAssessment.riskLevel === 'HIGH' || riskAssessment.riskLevel === 'CRITICAL') {
    outcomes.push({
      condition: 'Hospital Readmission',
      probability: Math.min(85, riskAssessment.riskScore + 15),
      timeframe: '30 days',
      confidenceLevel: 'HIGH',
      basedOn: ['High risk score', 'Multiple risk factors', 'Recent vital trends']
    });
  }

  return outcomes;
}

// ---- Care Recommendations Engine ----

/** Generate care recommendations from risk assessment and vitals trends */
export function generateCareRecommendations(riskAssessment: HealthRiskAssessment, vitalsTrends: VitalsTrend[]): CareRecommendation[] {
  const recommendations: CareRecommendation[] = [];

  // High-priority interventions for critical patients
  if (riskAssessment.riskLevel === 'CRITICAL') {
    recommendations.push({
      category: 'INTERVENTION',
      priority: 'URGENT',
      recommendation: 'Immediate clinical assessment and intervention required',
      reasoning: 'Critical risk level detected with multiple concerning factors',
      estimatedImpact: 'Potentially life-saving',
      timeline: 'Within 24 hours'
    });
  }

  // Medication adjustments based on vitals
  const bpTrend = vitalsTrends.find(t => t.metric === 'bp_systolic');
  if (bpTrend?.isAbnormal) {
    recommendations.push({
      category: 'MEDICATION',
      priority: bpTrend.current > 180 ? 'URGENT' : 'HIGH',
      recommendation: 'Review and adjust antihypertensive medications',
      reasoning: `Blood pressure ${bpTrend.trend.toLowerCase()} with current reading of ${bpTrend.current}`,
      estimatedImpact: 'Reduced cardiovascular risk',
      timeline: bpTrend.current > 180 ? 'Within 48 hours' : 'Within 1 week'
    });
  }

  // Lifestyle recommendations
  if (riskAssessment.riskFactors.some(f => f.includes('sedentary') || f.includes('activity'))) {
    recommendations.push({
      category: 'LIFESTYLE',
      priority: 'MEDIUM',
      recommendation: 'Implement structured physical activity program',
      reasoning: 'Low activity levels contributing to overall risk',
      estimatedImpact: 'Improved cardiovascular health and overall well-being',
      timeline: 'Start within 2 weeks'
    });
  }

  // Enhanced monitoring
  if (riskAssessment.riskLevel === 'HIGH') {
    recommendations.push({
      category: 'MONITORING',
      priority: 'HIGH',
      recommendation: 'Increase monitoring frequency to daily check-ins',
      reasoning: 'High risk status requires closer observation',
      estimatedImpact: 'Early detection of health changes',
      timeline: 'Implement immediately'
    });
  }

  return recommendations;
}

// ---- Patient Insights Generation ----

/** Generate comprehensive patient insights */
export function generatePatientInsights(
  patientId: string,
  patientData: PatientData,
  config: AiConfiguration
): PatientInsight {
  const riskAssessment = assessPatientRisk(patientData, config);
  const vitalsTrends = analyzeVitalsTrends(patientData.vitals || []);
  const adherenceScore = calculateAdherenceScore(patientData.checkIns || []);
  const emergencyAlerts = detectEmergencyConditions(patientData);
  const predictedOutcomes = generatePredictedOutcomes(patientData, riskAssessment);
  const careRecommendations = generateCareRecommendations(riskAssessment, vitalsTrends);

  return {
    patientId,
    patientName: `${patientData.profile?.first_name || ''} ${patientData.profile?.last_name || ''}`.trim(),
    overallHealthScore: calculateOverallHealthScore(riskAssessment, adherenceScore, vitalsTrends),
    riskAssessment,
    vitalsTrends,
    adherenceScore,
    lastCheckIn: patientData.checkIns?.[0]?.created_at || 'Never',
    emergencyAlerts,
    predictedOutcomes,
    careRecommendations
  };
}

// ---- Real-time Monitoring ----

/** Monitor patient vitals in real-time and generate emergency alerts */
export function monitorPatientInRealTime(patientData: PatientData, config: AiConfiguration): EmergencyAlert[] {
  const alerts: EmergencyAlert[] = [];
  const latestVitals = patientData.vitals?.[0];
  const checkIns = patientData.checkIns || [];

  // Critical vital signs
  if (latestVitals) {
    const bpSystolic = latestVitals.bp_systolic ?? 0;
    const bpDiastolic = latestVitals.bp_diastolic ?? 0;
    const heartRate = latestVitals.heart_rate ?? 0;
    const pulseOx = latestVitals.pulse_oximeter ?? 100;

    if (bpSystolic > config.riskThresholds.bloodPressure.systolic.critical ||
        bpDiastolic > config.riskThresholds.bloodPressure.diastolic.critical) {
      alerts.push(createEmergencyAlert(
        'CRITICAL',
        'VITAL_ANOMALY',
        'Critical blood pressure reading detected',
        ['Contact emergency services', 'Notify primary physician', 'Alert emergency contact']
      ));
    }

    if (heartRate > config.riskThresholds.heartRate.critical ||
        heartRate < config.riskThresholds.heartRate.low) {
      alerts.push(createEmergencyAlert(
        'CRITICAL',
        'VITAL_ANOMALY',
        'Critical heart rate detected',
        ['Immediate medical attention required', 'Contact emergency services']
      ));
    }

    if (pulseOx < config.riskThresholds.oxygenSaturation.critical) {
      alerts.push(createEmergencyAlert(
        'CRITICAL',
        'VITAL_ANOMALY',
        'Critical oxygen saturation level',
        ['Immediate oxygen therapy may be needed', 'Contact emergency services']
      ));
    }
  }

  // Missed check-ins
  const lastCheckInDate = checkIns[0]?.created_at;
  const daysSinceLastCheckIn = checkIns.length > 0 && lastCheckInDate ?
    (Date.now() - new Date(lastCheckInDate).getTime()) / (1000 * 60 * 60 * 24) : 999;

  if (daysSinceLastCheckIn > config.adherenceSettings.missedCheckInThreshold) {
    alerts.push(createEmergencyAlert(
      'WARNING',
      'MISSED_CHECKINS',
      `No check-in for ${Math.floor(daysSinceLastCheckIn)} days`,
      ['Contact patient', 'Check on patient welfare', 'Review care plan']
    ));
  }

  return alerts;
}
