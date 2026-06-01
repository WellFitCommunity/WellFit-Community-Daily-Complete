/**
 * Claude prompt-context formatters + risk-analysis parser
 *
 * Extracted from claudeService.ts (CLAUDE.md Commandment #12). These were
 * private (pure) methods on ClaudeService; moved verbatim as free functions.
 */

import { HealthDataContext } from '../../types/claude';

export function formatHealthContextForSeniors(context: HealthDataContext): string {
  const { demographics, currentConditions, medications, recentVitals } = context;

  return `PATIENT INFORMATION:
Age: ${demographics.age}
Current Health Conditions: ${currentConditions.map(c => c.condition).join(', ') || 'None listed'}
Current Medications: ${medications.map(m => `${m.name} (${m.purpose})`).join(', ') || 'None listed'}
Recent Health Measurements: Blood pressure: ${recentVitals.bloodPressure || 'Not recorded'}
Weight: ${recentVitals.weight ? `${recentVitals.weight} lbs` : 'Not recorded'}`;
}

export function aggregateHealthData(healthData: HealthDataContext[]): string {
  const totalPatients = healthData.length;
  const avgAge = healthData.reduce((sum, p) => sum + p.demographics.age, 0) / totalPatients;

  const conditionCounts = new Map<string, number>();
  healthData.forEach(patient => {
    patient.currentConditions.forEach(condition => {
      conditionCounts.set(condition.condition, (conditionCounts.get(condition.condition) || 0) + 1);
    });
  });

  return `POPULATION SUMMARY:
Total Patients: ${totalPatients}
Average Age: ${avgAge.toFixed(1)} years
Most Common Conditions: ${Array.from(conditionCounts.entries())
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([condition, count]) => `${condition} (${count} patients)`)
  .join(', ')}`;
}

export function convertLegacyHealthData(healthData: Record<string, unknown>): HealthDataContext | undefined {
  if (!healthData) return undefined;

  const bpSystolic = healthData.bp_systolic as number | undefined;
  const bpDiastolic = healthData.bp_diastolic as number | undefined;

  return {
    patientId: 'legacy-patient',
    demographics: {
      age: 75,
      gender: 'unknown'
    },
    currentConditions: [],
    medications: [],
    recentVitals: {
      bloodPressure: bpSystolic && bpDiastolic ?
        `${bpSystolic}/${bpDiastolic}` : undefined,
      heartRate: healthData.heart_rate as number | undefined,
      weight: healthData.weight as number | undefined,
      bloodSugar: (healthData.blood_sugar || healthData.glucose_mg_dl) as number | undefined,
      lastUpdated: new Date().toISOString()
    }
  };
}

export function formatUserContextForClaude(userProfile: Record<string, unknown>, recentActivity: Record<string, unknown>): string {
  const parts: string[] = [];

  const profileAge = userProfile?.age as number | undefined;
  const profileDob = userProfile?.dob as string | undefined;
  if (profileAge || profileDob) {
    const age = profileAge || (profileDob ? new Date().getFullYear() - new Date(profileDob).getFullYear() : null);
    if (age) parts.push(`Age: ${age}`);
  }

  const checkInCount = recentActivity?.checkInCount as number | undefined;
  if (checkInCount) {
    parts.push(`Recent check-ins: ${checkInCount}`);
  }

  const lastActivity = recentActivity?.lastActivity as string | undefined;
  if (lastActivity) {
    parts.push(`Last activity: ${lastActivity}`);
  }

  const mood = recentActivity?.mood as string | undefined;
  if (mood) {
    parts.push(`Recent mood: ${mood}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Limited user information available';
}

export function formatAssessmentForClaude(assessmentData: Record<string, unknown>): string {
  const parts: string[] = [];

  if (assessmentData.walking_ability) parts.push(`Walking: ${assessmentData.walking_ability}`);
  if (assessmentData.stair_climbing) parts.push(`Stairs: ${assessmentData.stair_climbing}`);
  if (assessmentData.sitting_ability) parts.push(`Sitting: ${assessmentData.sitting_ability}`);
  if (assessmentData.standing_ability) parts.push(`Standing: ${assessmentData.standing_ability}`);
  if (assessmentData.toilet_transfer) parts.push(`Toilet transfer: ${assessmentData.toilet_transfer}`);
  if (assessmentData.bathing_ability) parts.push(`Bathing: ${assessmentData.bathing_ability}`);
  if (assessmentData.meal_preparation) parts.push(`Meals: ${assessmentData.meal_preparation}`);
  if (assessmentData.medication_management) parts.push(`Medications: ${assessmentData.medication_management}`);

  const fallRiskFactors = assessmentData.fall_risk_factors as string[] | undefined;
  if (fallRiskFactors?.length && fallRiskFactors.length > 0) {
    parts.push(`Fall risks: ${fallRiskFactors.join(', ')}`);
  }

  if (assessmentData.medical_risk_score) parts.push(`Medical risk: ${assessmentData.medical_risk_score}/10`);
  if (assessmentData.mobility_risk_score) parts.push(`Mobility risk: ${assessmentData.mobility_risk_score}/10`);
  if (assessmentData.cognitive_risk_score) parts.push(`Cognitive risk: ${assessmentData.cognitive_risk_score}/10`);
  if (assessmentData.social_risk_score) parts.push(`Social risk: ${assessmentData.social_risk_score}/10`);

  return parts.length > 0 ? parts.join('; ') : 'Limited assessment data available';
}

export function formatClinicalContextForClaude(patientData: Record<string, unknown>, assessmentData: Record<string, unknown>): string {
  const parts: string[] = [];

  const firstName = patientData?.first_name as string | undefined;
  const lastName = patientData?.last_name as string | undefined;
  if (firstName && lastName) {
    parts.push(`Patient: ${firstName} ${lastName}`);
  }

  const patientAge = patientData?.age as number | undefined;
  const patientDob = patientData?.dob as string | undefined;
  if (patientAge || patientDob) {
    const age = patientAge || (patientDob ? new Date().getFullYear() - new Date(patientDob).getFullYear() : null);
    if (age) parts.push(`Age: ${age}`);
  }

  const assessmentSummary = formatAssessmentForClaude(assessmentData);
  if (assessmentSummary) parts.push(`Assessment: ${assessmentSummary}`);

  return parts.length > 0 ? parts.join('. ') : 'Limited patient context available';
}

export function parseRiskAnalysis(analysis: string): {
  suggestedRiskLevel: string;
  riskFactors: string[];
  recommendations: string[];
  clinicalNotes: string;
} {
  const lines = analysis.split('\n').filter(line => line.trim());

  let suggestedRiskLevel = 'MODERATE';
  const riskFactors: string[] = [];
  const recommendations: string[] = [];
  const clinicalNotes = analysis;

  // Extract risk level
  const riskMatch = analysis.match(/(LOW|MODERATE|HIGH|CRITICAL)/i);
  if (riskMatch) {
    suggestedRiskLevel = riskMatch[1].toUpperCase();
  }

  // Extract bullet points as risk factors and recommendations
  lines.forEach(line => {
    const cleanLine = line.trim();
    if (cleanLine.match(/^[-*•]\s*.{5,}/)) {
      const content = cleanLine.replace(/^[-*•]\s*/, '');
      if (content.toLowerCase().includes('risk') || content.toLowerCase().includes('concern')) {
        riskFactors.push(content);
      } else if (content.toLowerCase().includes('recommend') || content.toLowerCase().includes('suggest')) {
        recommendations.push(content);
      }
    }
  });

  // Fallbacks
  if (riskFactors.length === 0) {
    riskFactors.push('Assessment requires clinical review');
  }
  if (recommendations.length === 0) {
    recommendations.push('Continue regular monitoring and follow-up');
  }

  return {
    suggestedRiskLevel,
    riskFactors: riskFactors.slice(0, 5),
    recommendations: recommendations.slice(0, 5),
    clinicalNotes: clinicalNotes.substring(0, 500)
  };
}
