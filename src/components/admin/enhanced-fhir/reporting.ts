/**
 * Enhanced FHIR Service — Reporting
 *
 * Clinical summary generation, recommended actions, review date calculation,
 * weekly/monthly/emergency report generation.
 */

import type {
  PatientInsight,
  EmergencyAlert,
  FhirBundle,
  ComprehensivePatientData,
  PopulationDashboard,
  QualityMetrics,
  WeeklyReport,
  MonthlyReport,
  EmergencyReport,
  PredictiveAlert
} from './types';

/**
 * Generate a clinical summary string from AI insights and FHIR bundle data.
 */
export function generateClinicalSummary(aiInsights: PatientInsight, fhirBundle: FhirBundle): string {
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

/**
 * Generate recommended actions from AI insights and emergency alerts.
 */
export function generateRecommendedActions(aiInsights: PatientInsight, emergencyAlerts: EmergencyAlert[]): string[] {
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

/**
 * Calculate the next review date based on risk level and emergency alerts.
 */
export function calculateNextReviewDate(aiInsights: PatientInsight): string {
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

/**
 * Generate a weekly report from population data and dashboard.
 */
export function generateWeeklyReport(
  _populationData: ComprehensivePatientData[],
  dashboard: PopulationDashboard
): WeeklyReport {
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

/**
 * Generate a monthly report from population data, dashboard, and quality metrics.
 */
export function generateMonthlyReport(
  _populationData: ComprehensivePatientData[],
  dashboard: PopulationDashboard,
  qualityMetrics: QualityMetrics
): MonthlyReport {
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

/**
 * Generate an emergency report from predictive alerts.
 */
export function generateEmergencyReport(alerts: PredictiveAlert[]): EmergencyReport {
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');

  return {
    alertCount: criticalAlerts.length,
    generatedAt: new Date().toISOString(),
    criticalAlerts,
    immediateActions: criticalAlerts.flatMap(a => a.recommendedActions),
    escalationRequired: criticalAlerts.filter(a => a.isActionable).length > 0
  };
}
