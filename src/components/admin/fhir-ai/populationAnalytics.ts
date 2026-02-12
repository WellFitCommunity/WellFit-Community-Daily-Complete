// FHIR AI Service — Population Analytics Module
// Population-level health analysis, trending concerns, and resource recommendations

import type {
  PatientData,
  HealthRiskAssessment,
  PopulationInsights,
  PopulationRecommendation,
  PopulationPrediction,
  RiskDistribution,
  AiConfiguration,
  CheckInEntry,
} from './types';

import { assessPatientRisk, calculateAdherenceScore } from './riskAssessment';

/** Calculate population-wide health score */
export function calculatePopulationHealthScore(populationData: PatientData[]): number {
  if (populationData.length === 0) return 0;

  // Calculate average health score across population
  const healthScores = populationData.map(patient => {
    // Simplified health score calculation for population view
    const latestVitals = patient.vitals?.[0];
    let score = 70; // Base score

    if (latestVitals) {
      const bpSystolic = latestVitals.bp_systolic ?? 0;
      const heartRate = latestVitals.heart_rate ?? 80;
      const glucose = latestVitals.glucose_mg_dl ?? 0;
      const pulseOx = latestVitals.pulse_oximeter ?? 100;

      if (bpSystolic > 140) score -= 10;
      if (heartRate > 100 || heartRate < 60) score -= 8;
      if (glucose > 180) score -= 12;
      if (pulseOx < 95) score -= 15;
    }

    // Adherence bonus
    const checkInCount = patient.checkIns?.length || 0;
    if (checkInCount > 20) score += 10;
    else if (checkInCount > 10) score += 5;

    return Math.max(0, Math.min(100, score));
  });

  return Math.round(healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length);
}

/** Identify top trending health concerns from risk assessments */
export function identifyTrendingConcerns(riskAssessments: HealthRiskAssessment[]): string[] {
  const concerns: Record<string, number> = {};

  riskAssessments.forEach(assessment => {
    assessment.riskFactors.forEach(factor => {
      concerns[factor] = (concerns[factor] || 0) + 1;
    });
  });

  // Return top 5 most common concerns
  return Object.entries(concerns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([concern]) => concern);
}

/** Analyze common conditions from population vitals */
export function analyzeCommonConditions(populationData: PatientData[]): Array<{ condition: string; prevalence: number }> {
  const conditionCounts: Record<string, number> = {};
  const totalPatients = populationData.length;

  populationData.forEach(patient => {
    const vitals = patient.vitals?.[0];
    if (vitals) {
      const bpSystolic = vitals.bp_systolic ?? 0;
      const glucose = vitals.glucose_mg_dl ?? 0;
      const heartRate = vitals.heart_rate ?? 0;

      if (bpSystolic > 140) conditionCounts['Hypertension'] = (conditionCounts['Hypertension'] || 0) + 1;
      if (glucose > 126) conditionCounts['Diabetes'] = (conditionCounts['Diabetes'] || 0) + 1;
      if (heartRate > 100) conditionCounts['Tachycardia'] = (conditionCounts['Tachycardia'] || 0) + 1;
    }
  });

  return Object.entries(conditionCounts).map(([condition, count]) => ({
    condition,
    prevalence: Math.round((count / totalPatients) * 100)
  }));
}

/** Calculate population-wide adherence rate */
export function calculatePopulationAdherence(populationData: PatientData[]): number {
  if (populationData.length === 0) return 0;

  const adherenceScores = populationData.map(patient => calculateAdherenceScore(patient.checkIns || []));
  return Math.round(adherenceScores.reduce((sum, score) => sum + score, 0) / adherenceScores.length);
}

/** Calculate average age of the population */
export function calculateAverageAge(populationData: PatientData[]): number {
  const patientsWithAge = populationData.filter(p => p.profile?.dob);
  if (patientsWithAge.length === 0) return 0;

  const ages = patientsWithAge.map(p => {
    const dob = p.profile?.dob;
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    return today.getFullYear() - birthDate.getFullYear();
  });

  return Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
}

/** Generate population-level recommendations */
export function generatePopulationRecommendations(
  riskDistribution: RiskDistribution,
  adherenceRate: number,
  trendingConcerns: string[]
): PopulationRecommendation[] {
  const recommendations: PopulationRecommendation[] = [];

  // High-risk patient management
  if (riskDistribution.high + riskDistribution.critical > riskDistribution.low) {
    recommendations.push({
      type: 'RESOURCE_ALLOCATION',
      recommendation: 'Increase clinical staff allocation for high-risk patient management',
      expectedImpact: 'Reduced emergency incidents and improved patient outcomes',
      implementationEffort: 'HIGH',
      priority: 5
    });
  }

  // Adherence improvement
  if (adherenceRate < 70) {
    recommendations.push({
      type: 'INTERVENTION_PROGRAM',
      recommendation: 'Implement patient engagement and adherence improvement program',
      expectedImpact: 'Increased check-in compliance and better health monitoring',
      implementationEffort: 'MEDIUM',
      priority: 4
    });
  }

  // Address trending concerns
  if (trendingConcerns.some(concern => concern.includes('blood pressure'))) {
    recommendations.push({
      type: 'POLICY_CHANGE',
      recommendation: 'Develop population-wide hypertension management protocol',
      expectedImpact: 'Reduced cardiovascular events across patient population',
      implementationEffort: 'MEDIUM',
      priority: 4
    });
  }

  return recommendations;
}

/** Generate population-level predictions */
export function generatePopulationPredictions(populationData: PatientData[], riskAssessments: HealthRiskAssessment[]): PopulationPrediction[] {
  const predictions: PopulationPrediction[] = [];

  const highRiskPercentage = (riskAssessments.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length / riskAssessments.length) * 100;

  predictions.push({
    metric: 'High-risk patient percentage',
    prediction: `Expected to ${highRiskPercentage > 25 ? 'increase' : 'remain stable'} at ${Math.round(highRiskPercentage)}%`,
    timeframe: '3 months',
    confidence: 75,
    factorsInfluencing: ['Current trend patterns', 'Seasonal variations', 'Intervention effectiveness']
  });

  const averageAge = calculateAverageAge(populationData);
  if (averageAge > 65) {
    predictions.push({
      metric: 'Emergency incidents',
      prediction: 'Likely to increase by 15-20% due to aging population',
      timeframe: '6 months',
      confidence: 70,
      factorsInfluencing: ['Population age demographics', 'Chronic condition prevalence', 'Seasonal factors']
    });
  }

  return predictions;
}

/** Generate comprehensive population insights */
export async function generatePopulationInsights(
  populationData: PatientData[],
  config: AiConfiguration
): Promise<PopulationInsights> {
  const totalPatients = populationData.length;
  const activePatients = populationData.filter(p =>
    (p.checkIns?.length ?? 0) > 0 &&
    p.checkIns?.[0]?.created_at &&
    new Date(p.checkIns[0].created_at as string) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  const riskAssessments = await Promise.all(
    populationData.map(p => assessPatientRisk(p, config))
  );

  const highRiskPatients = riskAssessments.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;
  const averageHealthScore = calculatePopulationHealthScore(populationData);

  const riskDistribution = {
    low: riskAssessments.filter(r => r.riskLevel === 'LOW').length,
    moderate: riskAssessments.filter(r => r.riskLevel === 'MODERATE').length,
    high: riskAssessments.filter(r => r.riskLevel === 'HIGH').length,
    critical: riskAssessments.filter(r => r.riskLevel === 'CRITICAL').length
  };

  const trendingConcerns = identifyTrendingConcerns(riskAssessments);
  const commonConditions = analyzeCommonConditions(populationData);
  const adherenceRate = calculatePopulationAdherence(populationData);

  return {
    totalPatients,
    activePatients,
    highRiskPatients,
    averageHealthScore,
    trendingConcerns,
    populationMetrics: {
      averageAge: calculateAverageAge(populationData),
      riskDistribution,
      commonConditions,
      adherenceRate
    },
    recommendations: generatePopulationRecommendations(riskDistribution, adherenceRate, trendingConcerns),
    predictiveAnalytics: generatePopulationPredictions(populationData, riskAssessments)
  };
}
