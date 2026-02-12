/**
 * Enhanced FHIR Service — Population Analytics
 *
 * Risk matrix generation, intervention queue, resource recommendations,
 * and predictive alerts for population-level analysis.
 */

import FhirAiService from '../FhirAiService';
import type {
  PopulationInsights,
  ComprehensivePatientData,
  RiskMatrix,
  InterventionItem,
  ResourceRecommendation,
  PredictiveAlert
} from './types';

/**
 * Map priority string to numeric value.
 */
export function mapPriorityToNumber(priority: string): number {
  const mapping: Record<string, number> = {
    'URGENT': 5,
    'HIGH': 4,
    'MEDIUM': 3,
    'LOW': 2
  };
  return mapping[priority] || 1;
}

/**
 * Calculate a due date based on priority and timeline.
 */
export function calculateDueDate(priority: string, timeline: string): string {
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

/**
 * Generate a risk matrix from population data using AI insights.
 */
export function generateRiskMatrix(
  aiService: FhirAiService,
  populationData: ComprehensivePatientData[]
): RiskMatrix {
  let highRiskHighAdherence = 0;
  let highRiskLowAdherence = 0;
  let lowRiskHighAdherence = 0;
  let lowRiskLowAdherence = 0;

  populationData.forEach(async (patient) => {
    const userId = patient.profile?.user_id ?? '';
    const aiInsights = await aiService.generatePatientInsights(userId, patient);
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

/**
 * Generate a prioritized intervention queue from population data.
 */
export async function generateInterventionQueue(
  aiService: FhirAiService,
  populationData: ComprehensivePatientData[]
): Promise<InterventionItem[]> {
  const interventions: InterventionItem[] = [];

  for (const patient of populationData) {
    const userId = patient.profile?.user_id ?? '';
    const aiInsights = await aiService.generatePatientInsights(userId, patient);

    // Generate interventions based on care recommendations
    aiInsights.careRecommendations.forEach((rec) => {
      interventions.push({
        patientId: userId,
        patientName: aiInsights.patientName,
        interventionType: rec.category,
        priority: mapPriorityToNumber(rec.priority),
        description: rec.recommendation,
        estimatedTimeToComplete: rec.timeline,
        expectedOutcome: rec.estimatedImpact,
        dueDate: calculateDueDate(rec.priority, rec.timeline)
      });
    });
  }

  // Sort by priority (highest first)
  return interventions.sort((a, b) => b.priority - a.priority).slice(0, 50); // Top 50 interventions
}

/**
 * Generate resource allocation recommendations based on population overview and risk matrix.
 */
export function generateResourceRecommendations(
  overview: PopulationInsights,
  riskMatrix: RiskMatrix
): ResourceRecommendation[] {
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

/**
 * Generate predictive alerts based on population data and overview.
 */
export function generatePredictiveAlerts(
  _populationData: ComprehensivePatientData[],
  overview: PopulationInsights
): PredictiveAlert[] {
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
