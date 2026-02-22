/**
 * Score Calculation Functions for Medication Adherence Prediction
 *
 * Handles regimen complexity scoring, historical adherence calculation,
 * per-medication risk scoring, and overall adherence score computation.
 *
 * @skill #31 - Medication Adherence Predictor
 */

import type {
  MedicationInfo,
  RegimenComplexity,
  HistoricalAdherence,
  MedicationRisk,
  AdherenceBarrier,
  OverallScoreResult,
} from './types.ts';

// ============================================================================
// Regimen Complexity
// ============================================================================

export function calculateRegimenComplexity(medications: MedicationInfo[]): RegimenComplexity {
  const total = medications.length;
  let dailyDoses = 0;
  const doseTimes = new Set<string>();

  for (const med of medications) {
    const freq = (med.frequency || '').toLowerCase();
    if (freq.includes('once') || freq.includes('qd') || freq.includes('daily')) {
      dailyDoses += 1;
      doseTimes.add('morning');
    } else if (freq.includes('twice') || freq.includes('bid')) {
      dailyDoses += 2;
      doseTimes.add('morning');
      doseTimes.add('evening');
    } else if (freq.includes('three') || freq.includes('tid')) {
      dailyDoses += 3;
      doseTimes.add('morning');
      doseTimes.add('midday');
      doseTimes.add('evening');
    } else if (freq.includes('four') || freq.includes('qid')) {
      dailyDoses += 4;
      doseTimes.add('morning');
      doseTimes.add('midday');
      doseTimes.add('evening');
      doseTimes.add('bedtime');
    } else {
      dailyDoses += 1; // Default assumption
    }
  }

  // Complexity score: combination of med count, doses, and timing
  let score = 0;
  score += Math.min(total * 8, 40); // Up to 40 points for med count
  score += Math.min(dailyDoses * 5, 35); // Up to 35 points for dose count
  score += doseTimes.size * 6; // Points for timing complexity

  // Special medication factors
  const hasInsulin = medications.some(m => m.name.toLowerCase().includes('insulin'));
  const hasInjectable = medications.some(m => (m.route || '').toLowerCase().includes('inject'));
  const hasControlled = medications.some(m =>
    ['opioid', 'benzodiazepine', 'stimulant'].some(t =>
      (m.indication || m.name).toLowerCase().includes(t)
    )
  );

  if (hasInsulin) score += 15;
  if (hasInjectable) score += 10;
  if (hasControlled) score += 5;

  score = Math.min(score, 100);

  let level: RegimenComplexity['complexityLevel'];
  if (score < 25) level = 'simple';
  else if (score < 50) level = 'moderate';
  else if (score < 75) level = 'complex';
  else level = 'very_complex';

  return {
    totalMedications: total,
    dailyDoses,
    uniqueDoseTimes: doseTimes.size,
    complexityScore: score,
    complexityLevel: level,
  };
}

// ============================================================================
// Historical Adherence
// ============================================================================

export function calculateHistoricalAdherence(
  context: Record<string, unknown>
): HistoricalAdherence | undefined {
  const checkIns = context.checkInHistory as Array<{ completed: boolean }> || [];
  const appointments = context.appointments as Array<{ status: string; no_show: boolean }> || [];
  const medHistory = context.medicationHistory as Array<Record<string, unknown>> || [];

  if (checkIns.length === 0 && appointments.length === 0) {
    return undefined;
  }

  // Check-in adherence
  const completedCheckIns = checkIns.filter(c => c.completed).length;
  const checkInAdherence = checkIns.length > 0
    ? Math.round((completedCheckIns / checkIns.length) * 100)
    : 50;

  // Appointment adherence
  const keptAppointments = appointments.filter(a =>
    a.status === 'completed' && !a.no_show
  ).length;
  const appointmentAdherence = appointments.length > 0
    ? Math.round((keptAppointments / appointments.length) * 100)
    : 50;

  // Refill adherence (simplified PDC calculation)
  const refillAdherence = medHistory.length > 0 ? 70 : 50; // Simplified

  // Trend analysis
  let trend: HistoricalAdherence['trend'] = 'stable';
  if (checkIns.length >= 14) {
    const firstHalf = checkIns.slice(checkIns.length / 2);
    const secondHalf = checkIns.slice(0, checkIns.length / 2);
    const firstRate = firstHalf.filter(c => c.completed).length / firstHalf.length;
    const secondRate = secondHalf.filter(c => c.completed).length / secondHalf.length;

    if (secondRate - firstRate > 0.1) trend = 'improving';
    else if (firstRate - secondRate > 0.1) trend = 'declining';
  }

  return {
    refillAdherence,
    appointmentAdherence,
    checkInAdherence,
    trend,
  };
}

// ============================================================================
// Per-Medication Risk
// ============================================================================

export function calculateMedicationRisks(
  medications: MedicationInfo[],
  barriers: AdherenceBarrier[]
): MedicationRisk[] {
  return medications.map(med => {
    let riskScore = 20; // Base score
    const riskFactors: string[] = [];

    // Frequency complexity
    const freq = (med.frequency || '').toLowerCase();
    if (freq.includes('four') || freq.includes('qid')) {
      riskScore += 25;
      riskFactors.push('Four times daily dosing');
    } else if (freq.includes('three') || freq.includes('tid')) {
      riskScore += 15;
      riskFactors.push('Three times daily dosing');
    }

    // Route complexity
    const route = (med.route || '').toLowerCase();
    if (route.includes('inject') || route.includes('subcutaneous')) {
      riskScore += 20;
      riskFactors.push('Injectable administration');
    } else if (route.includes('inhal') || route.includes('nebul')) {
      riskScore += 15;
      riskFactors.push('Inhaled administration');
    }

    // Cost tier
    if (med.cost_tier === 'specialty') {
      riskScore += 20;
      riskFactors.push('Specialty tier medication (high cost)');
    } else if (med.cost_tier === 'non_preferred') {
      riskScore += 10;
      riskFactors.push('Non-preferred tier (higher cost)');
    }

    // Side effects reported
    if (med.side_effects_reported && med.side_effects_reported.length > 0) {
      riskScore += 15;
      riskFactors.push(`Side effects reported: ${med.side_effects_reported.join(', ')}`);
    }

    // Apply barrier modifiers
    if (barriers.some(b => b.category === 'cost')) riskScore += 5;
    if (barriers.some(b => b.category === 'cognitive')) riskScore += 10;

    riskScore = Math.min(riskScore, 100);

    let adherenceRisk: MedicationRisk['adherenceRisk'];
    if (riskScore < 30) adherenceRisk = 'low';
    else if (riskScore < 50) adherenceRisk = 'moderate';
    else if (riskScore < 70) adherenceRisk = 'high';
    else adherenceRisk = 'very_high';

    // Simplification opportunities
    let simplificationOpportunity: string | undefined;
    if (freq.includes('twice') || freq.includes('bid')) {
      simplificationOpportunity = 'Consider once-daily extended-release formulation if available';
    }

    return {
      medication: med.name,
      adherenceRisk,
      riskScore,
      riskFactors,
      simplificationOpportunity,
    };
  });
}

// ============================================================================
// Overall Score
// ============================================================================

export function calculateOverallScore(
  barriers: AdherenceBarrier[],
  medicationRisks: MedicationRisk[],
  historicalAdherence: HistoricalAdherence | undefined,
  regimenComplexity: RegimenComplexity
): OverallScoreResult {
  // Start with base score
  let score = 80;

  // Deduct for barriers
  for (const barrier of barriers) {
    if (barrier.severity === 'critical') score -= 20;
    else if (barrier.severity === 'high') score -= 12;
    else if (barrier.severity === 'moderate') score -= 6;
    else score -= 3;
  }

  // Deduct for medication risks
  const avgMedRisk = medicationRisks.reduce((sum, m) => sum + m.riskScore, 0) /
    Math.max(medicationRisks.length, 1);
  score -= avgMedRisk * 0.3;

  // Deduct for complexity
  score -= regimenComplexity.complexityScore * 0.15;

  // Adjust based on historical adherence
  if (historicalAdherence) {
    const historicalAvg = (historicalAdherence.refillAdherence + historicalAdherence.checkInAdherence) / 2;
    if (historicalAvg >= 80) score += 10;
    else if (historicalAvg < 50) score -= 15;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let category: OverallScoreResult['category'];
  if (score >= 80) category = 'excellent';
  else if (score >= 65) category = 'good';
  else if (score >= 50) category = 'moderate';
  else if (score >= 30) category = 'poor';
  else category = 'very_poor';

  return { score, category };
}
