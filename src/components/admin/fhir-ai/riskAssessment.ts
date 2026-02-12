// FHIR AI Service — Risk Assessment Module
// Vital sign risk evaluation, adherence analysis, and trend detection

import type {
  VitalsReading,
  CheckInEntry,
  PatientData,
  HealthRiskAssessment,
  VitalsTrend,
  AiConfiguration,
  VitalRiskResult,
  EmergencyAlert,
} from './types';

/** Assess blood pressure risk from systolic/diastolic readings */
export function assessBloodPressureRisk(systolic?: number, diastolic?: number): VitalRiskResult {
  if (!systolic || !diastolic) return { score: 0, factors: [], recommendations: [] };

  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 0;

  if (systolic >= 180 || diastolic >= 120) {
    score += 30;
    factors.push('Hypertensive crisis - critical blood pressure');
    recommendations.push('Immediate emergency medical attention required');
  } else if (systolic >= 140 || diastolic >= 90) {
    score += 20;
    factors.push('Stage 2 hypertension detected');
    recommendations.push('Medication review and lifestyle modifications needed');
  } else if (systolic >= 130 || diastolic >= 80) {
    score += 10;
    factors.push('Stage 1 hypertension detected');
    recommendations.push('Lifestyle modifications and possible medication initiation');
  }

  return { score, factors, recommendations };
}

/** Assess heart rate risk */
export function assessHeartRateRisk(heartRate?: number): VitalRiskResult {
  if (!heartRate) return { score: 0, factors: [], recommendations: [] };

  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 0;

  if (heartRate > 120 || heartRate < 50) {
    score += 25;
    factors.push(`${heartRate > 120 ? 'Severe tachycardia' : 'Severe bradycardia'} detected`);
    recommendations.push('Immediate cardiac evaluation required');
  } else if (heartRate > 100 || heartRate < 60) {
    score += 10;
    factors.push(`${heartRate > 100 ? 'Mild tachycardia' : 'Mild bradycardia'} detected`);
    recommendations.push('Monitor heart rate trends and consider cardiology consultation');
  }

  return { score, factors, recommendations };
}

/** Assess glucose risk */
export function assessGlucoseRisk(glucose?: number): VitalRiskResult {
  if (!glucose) return { score: 0, factors: [], recommendations: [] };

  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 0;

  if (glucose > 400 || glucose < 50) {
    score += 30;
    factors.push(`${glucose > 400 ? 'Severe hyperglycemia' : 'Severe hypoglycemia'} detected`);
    recommendations.push('Immediate medical intervention required');
  } else if (glucose > 250 || glucose < 70) {
    score += 15;
    factors.push(`${glucose > 250 ? 'Significant hyperglycemia' : 'Hypoglycemia'} detected`);
    recommendations.push('Diabetes management review and medication adjustment needed');
  } else if (glucose > 180) {
    score += 8;
    factors.push('Elevated blood glucose levels');
    recommendations.push('Dietary review and possible medication adjustment');
  }

  return { score, factors, recommendations };
}

/** Assess oxygen saturation risk */
export function assessOxygenSaturationRisk(oxygen?: number): VitalRiskResult {
  if (!oxygen) return { score: 0, factors: [], recommendations: [] };

  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 0;

  if (oxygen < 88) {
    score += 30;
    factors.push('Critical oxygen saturation level');
    recommendations.push('Immediate oxygen therapy and emergency care required');
  } else if (oxygen < 92) {
    score += 15;
    factors.push('Low oxygen saturation');
    recommendations.push('Respiratory assessment and possible oxygen supplementation needed');
  } else if (oxygen < 95) {
    score += 8;
    factors.push('Borderline low oxygen saturation');
    recommendations.push('Monitor respiratory status closely');
  }

  return { score, factors, recommendations };
}

/** Assess check-in adherence risk */
export function assessAdherenceRisk(checkIns: CheckInEntry[]): VitalRiskResult {
  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 0;

  if (checkIns.length === 0) {
    score += 20;
    factors.push('No check-in history available');
    recommendations.push('Establish regular check-in routine');
    return { score, factors, recommendations };
  }

  // Calculate check-in frequency over last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentCheckIns = checkIns.filter(c => c.created_at && new Date(c.created_at) > thirtyDaysAgo);
  const adherenceRate = (recentCheckIns.length / 30) * 100;

  if (adherenceRate < 30) {
    score += 15;
    factors.push('Very low check-in adherence');
    recommendations.push('Patient engagement program and adherence support needed');
  } else if (adherenceRate < 60) {
    score += 8;
    factors.push('Low check-in adherence');
    recommendations.push('Improve patient engagement and simplify check-in process');
  }

  // Check for recent gaps
  const lastCheckInDate = checkIns[0]?.created_at;
  if (lastCheckInDate) {
    const daysSinceLastCheckIn = (Date.now() - new Date(lastCheckInDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastCheckIn > 7) {
      score += 10;
      factors.push(`${Math.floor(daysSinceLastCheckIn)} days since last check-in`);
      recommendations.push('Contact patient to ensure continued engagement');
    }
  }

  return { score, factors, recommendations };
}

/** Calculate a single vital trend between current and previous reading */
export function calculateVitalTrend(vitals: VitalsReading[], metric: string): VitalsTrend {
  // FIX: Handle field name variations between self_reports and check_ins
  const getVitalValue = (vital: VitalsReading | undefined, metricName: string): number => {
    if (metricName === 'glucose_mg_dl') {
      return vital?.glucose_mg_dl || vital?.blood_sugar || 0;
    }
    if (metricName === 'pulse_oximeter') {
      return vital?.pulse_oximeter || vital?.spo2 || vital?.blood_oxygen || 0;
    }
    return (vital as Record<string, number | undefined>)?.[metricName] || 0;
  };

  const current = getVitalValue(vitals[0], metric);
  const previous = getVitalValue(vitals[1], metric) || current;

  const changePercent = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
  let trend: VitalsTrend['trend'] = 'STABLE';

  if (Math.abs(changePercent) > 5) {
    trend = changePercent > 0 ? 'RISING' : 'FALLING';
  }

  const normalRanges = {
    bp_systolic: { min: 90, max: 120 },
    bp_diastolic: { min: 60, max: 80 },
    heart_rate: { min: 60, max: 100 },
    glucose_mg_dl: { min: 70, max: 140 },
    pulse_oximeter: { min: 95, max: 100 }
  };

  const normalRange = normalRanges[metric as keyof typeof normalRanges] || { min: 0, max: 100 };
  const isAbnormal = current < normalRange.min || current > normalRange.max;

  return {
    metric: metric as VitalsTrend['metric'],
    current,
    previous,
    trend,
    changePercent: Math.abs(changePercent),
    isAbnormal,
    normalRange,
    recommendation: isAbnormal ? getVitalRecommendation(metric, current, normalRange) : undefined
  };
}

/** Get recommendation text for an abnormal vital sign */
function getVitalRecommendation(metric: string, value: number, normalRange: { min: number; max: number }): string {
  const recommendations: Record<string, Record<string, string>> = {
    bp_systolic: {
      high: 'Consider antihypertensive medication adjustment',
      low: 'Monitor for hypotension symptoms'
    },
    heart_rate: {
      high: 'Evaluate for tachycardia causes',
      low: 'Assess for bradycardia complications'
    },
    glucose_mg_dl: {
      high: 'Review diabetes management plan',
      low: 'Address hypoglycemia risk factors'
    }
  };

  const status = value > normalRange.max ? 'high' : 'low';
  return recommendations[metric]?.[status] || 'Consult healthcare provider';
}

/** Analyze trends across all standard vital metrics */
export function analyzeVitalsTrends(vitals: VitalsReading[]): VitalsTrend[] {
  const metrics: Array<VitalsTrend['metric']> = ['bp_systolic', 'bp_diastolic', 'heart_rate', 'glucose_mg_dl', 'pulse_oximeter'];
  return metrics.map(metric => calculateVitalTrend(vitals, metric));
}

/** Analyze overall vitals trend for risk scoring */
export function analyzeTrends(vitals: VitalsReading[]): VitalRiskResult {
  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 0;

  if (vitals.length < 2) return { score, factors, recommendations };

  // Analyze blood pressure trends
  const bpTrend = calculateVitalTrend(vitals, 'bp_systolic');
  if (bpTrend.changePercent > 20) {
    score += bpTrend.trend === 'RISING' ? 15 : 5;
    factors.push(`Blood pressure ${bpTrend.trend.toLowerCase()} by ${bpTrend.changePercent.toFixed(1)}%`);
    recommendations.push(bpTrend.trend === 'RISING' ? 'Blood pressure management intervention needed' : 'Monitor blood pressure improvements');
  }

  // Analyze heart rate trends
  const hrTrend = calculateVitalTrend(vitals, 'heart_rate');
  if (hrTrend.changePercent > 15) {
    score += 8;
    factors.push(`Heart rate ${hrTrend.trend.toLowerCase()} by ${hrTrend.changePercent.toFixed(1)}%`);
    recommendations.push('Cardiac monitoring and evaluation recommended');
  }

  return { score, factors, recommendations };
}

/** Calculate trend direction from recent vitals */
export function calculateTrendDirection(vitals: VitalsReading[]): HealthRiskAssessment['trendDirection'] {
  if (vitals.length < 3) return 'STABLE';

  // Simple trend analysis based on overall vital signs improvement/deterioration
  const recentVitals = vitals.slice(0, 3);
  let improvementScore = 0;

  for (let i = 0; i < recentVitals.length - 1; i++) {
    const current = recentVitals[i];
    const previous = recentVitals[i + 1];

    // Compare key vitals (simplified scoring)
    if (current.bp_systolic && previous.bp_systolic) {
      if (current.bp_systolic < previous.bp_systolic && current.bp_systolic <= 120) improvementScore++;
      else if (current.bp_systolic > previous.bp_systolic && current.bp_systolic > 140) improvementScore--;
    }

    if (current.heart_rate && previous.heart_rate) {
      const inNormalRange = current.heart_rate >= 60 && current.heart_rate <= 100;
      const wasInNormalRange = previous.heart_rate >= 60 && previous.heart_rate <= 100;
      if (inNormalRange && !wasInNormalRange) improvementScore++;
      else if (!inNormalRange && wasInNormalRange) improvementScore--;
    }
  }

  if (improvementScore > 0) return 'IMPROVING';
  if (improvementScore < 0) return 'DECLINING';
  return 'STABLE';
}

/** Calculate priority from risk level and factor count */
export function calculatePriority(riskLevel: HealthRiskAssessment['riskLevel'], riskFactorCount: number): number {
  const basePriority = {
    'CRITICAL': 5,
    'HIGH': 4,
    'MODERATE': 3,
    'LOW': 2
  }[riskLevel];

  // Increase priority for multiple risk factors
  const factorBonus = Math.min(1, Math.floor(riskFactorCount / 3));
  return Math.min(5, basePriority + factorBonus);
}

/** Calculate adherence score from check-in history */
export function calculateAdherenceScore(checkIns: CheckInEntry[]): number {
  if (checkIns.length === 0) return 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentCheckIns = checkIns.filter(c => c.created_at && new Date(c.created_at) > thirtyDaysAgo);

  // Expected check-ins (daily) vs actual
  const expectedCheckIns = 30;
  const actualCheckIns = recentCheckIns.length;

  const baseScore = Math.min(100, (actualCheckIns / expectedCheckIns) * 100);

  // Bonus for consistency (reduce score for large gaps)
  const gaps = calculateCheckInGaps(recentCheckIns);
  const gapPenalty = gaps.filter(gap => gap > 3).length * 5; // 5% penalty per gap > 3 days

  return Math.max(0, baseScore - gapPenalty);
}

/** Calculate gaps between consecutive check-ins (in days) */
function calculateCheckInGaps(checkIns: CheckInEntry[]): number[] {
  if (checkIns.length < 2) return [];

  const gaps: number[] = [];
  for (let i = 0; i < checkIns.length - 1; i++) {
    const currentDate = checkIns[i].created_at;
    const nextDate = checkIns[i + 1].created_at;
    if (!currentDate || !nextDate) continue;
    const gap = (new Date(currentDate).getTime() - new Date(nextDate).getTime()) / (1000 * 60 * 60 * 24);
    gaps.push(gap);
  }
  return gaps;
}

/** Detect emergency conditions from patient data */
export function detectEmergencyConditions(patientData: PatientData): EmergencyAlert[] {
  const alerts: EmergencyAlert[] = [];
  const latestVitals = patientData.vitals?.[0];

  if (latestVitals?.is_emergency) {
    alerts.push(createEmergencyAlert(
      'CRITICAL',
      'EMERGENCY_CONTACT',
      'Patient has indicated emergency status',
      ['Contact emergency services immediately', 'Notify emergency contact', 'Initiate emergency protocol']
    ));
  }

  return alerts;
}

/** Create a standardized emergency alert object */
export function createEmergencyAlert(
  severity: EmergencyAlert['severity'],
  type: EmergencyAlert['type'],
  message: string,
  suggestedActions: string[]
): EmergencyAlert {
  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    severity,
    type,
    message,
    timestamp: new Date().toISOString(),
    actionRequired: severity === 'CRITICAL' || severity === 'URGENT',
    suggestedActions
  };
}

/** Calculate overall health score from risk, adherence, and vitals */
export function calculateOverallHealthScore(
  riskAssessment: HealthRiskAssessment,
  adherenceScore: number,
  vitalsTrends: VitalsTrend[]
): number {
  // Invert risk score (high risk = low health score)
  const healthFromRisk = 100 - riskAssessment.riskScore;

  // Weight: 50% risk assessment, 30% adherence, 20% vital trends
  const vitalsScore = calculateVitalsHealthScore(vitalsTrends);

  return Math.round(
    (healthFromRisk * 0.5) +
    (adherenceScore * 0.3) +
    (vitalsScore * 0.2)
  );
}

/** Calculate health score from vitals trend data */
function calculateVitalsHealthScore(vitalsTrends: VitalsTrend[]): number {
  const abnormalCount = vitalsTrends.filter(t => t.isAbnormal).length;
  const totalVitals = vitalsTrends.length;

  if (totalVitals === 0) return 50; // Neutral score if no vitals

  const normalPercentage = ((totalVitals - abnormalCount) / totalVitals) * 100;
  return normalPercentage;
}

/** Assess full patient risk from patient data and config */
export function assessPatientRisk(patientData: PatientData, config: AiConfiguration): HealthRiskAssessment {
  const vitals = patientData.vitals || [];
  const checkIns = patientData.checkIns || [];
  const _profile = patientData.profile; // Reserved for future use
  void _profile;

  let riskScore = 0;
  const riskFactors: string[] = [];
  const recommendations: string[] = [];

  // Analyze latest vitals
  const latestVitals = vitals[0];
  if (latestVitals) {
    const bpRisk = assessBloodPressureRisk(latestVitals.bp_systolic, latestVitals.bp_diastolic);
    const hrRisk = assessHeartRateRisk(latestVitals.heart_rate);
    // FIX: Handle both field names for glucose (blood_sugar from self_reports, glucose_mg_dl from check_ins)
    const glucoseRisk = assessGlucoseRisk(latestVitals.glucose_mg_dl || latestVitals.blood_sugar);
    // FIX: Handle multiple field names for oxygen (pulse_oximeter, spo2, blood_oxygen)
    const oxygenRisk = assessOxygenSaturationRisk(latestVitals.pulse_oximeter || latestVitals.spo2 || latestVitals.blood_oxygen);

    riskScore += bpRisk.score + hrRisk.score + glucoseRisk.score + oxygenRisk.score;
    riskFactors.push(...bpRisk.factors, ...hrRisk.factors, ...glucoseRisk.factors, ...oxygenRisk.factors);
    recommendations.push(...bpRisk.recommendations, ...hrRisk.recommendations, ...glucoseRisk.recommendations, ...oxygenRisk.recommendations);
  }

  // Analyze check-in patterns
  const adherenceRisk = assessAdherenceRisk(checkIns);
  riskScore += adherenceRisk.score;
  riskFactors.push(...adherenceRisk.factors);
  recommendations.push(...adherenceRisk.recommendations);

  // Analyze trends
  const trendRisk = analyzeTrends(vitals);
  riskScore += trendRisk.score;
  riskFactors.push(...trendRisk.factors);
  recommendations.push(...trendRisk.recommendations);

  // Calculate overall risk level
  let riskLevel: HealthRiskAssessment['riskLevel'];
  if (riskScore >= 80) riskLevel = 'CRITICAL';
  else if (riskScore >= 60) riskLevel = 'HIGH';
  else if (riskScore >= 40) riskLevel = 'MODERATE';
  else riskLevel = 'LOW';

  // Determine trend direction
  const trendDirection = calculateTrendDirection(vitals);

  return {
    riskLevel,
    riskScore: Math.min(100, riskScore),
    riskFactors: [...new Set(riskFactors)], // Remove duplicates
    recommendations: [...new Set(recommendations)],
    priority: calculatePriority(riskLevel, riskFactors.length),
    lastAssessed: new Date().toISOString(),
    trendDirection
  };
}
