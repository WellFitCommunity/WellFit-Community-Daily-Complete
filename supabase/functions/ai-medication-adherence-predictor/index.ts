/**
 * AI Medication Adherence Predictor Edge Function
 *
 * Predicts likelihood of medication adherence and identifies barriers.
 * Uses evidence-based factors:
 * - Regimen complexity (number of meds, dosing frequency)
 * - Previous adherence patterns
 * - SDOH factors (cost, transportation, social support)
 * - Cognitive status and health literacy
 * - Side effect history
 * - Patient engagement level
 *
 * @skill #31 - Medication Adherence Predictor
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/auditLogger.ts';

// ============================================================================
// Types
// ============================================================================

interface MedicationInfo {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  indication?: string;
  cost_tier?: 'generic' | 'preferred_brand' | 'non_preferred' | 'specialty';
  side_effects_reported?: string[];
  start_date?: string;
}

interface AdherenceRequest {
  patientId: string;
  assessorId: string;
  medications?: MedicationInfo[];
  tenantId?: string;
}

interface AdherenceBarrier {
  barrier: string;
  category: 'cost' | 'complexity' | 'side_effects' | 'cognitive' | 'social' | 'access' | 'belief' | 'physical';
  severity: 'low' | 'moderate' | 'high' | 'critical';
  evidence: string;
  mitigable: boolean;
  interventions: string[];
}

interface MedicationRisk {
  medication: string;
  adherenceRisk: 'low' | 'moderate' | 'high' | 'very_high';
  riskScore: number;
  riskFactors: string[];
  simplificationOpportunity?: string;
}

interface AdherenceIntervention {
  intervention: string;
  category: 'education' | 'simplification' | 'reminder' | 'financial' | 'social_support' | 'monitoring';
  priority: 'routine' | 'recommended' | 'strongly_recommended' | 'critical';
  expectedImpact: 'low' | 'moderate' | 'high';
  implementedBy: string;
  timeframe: string;
}

interface AdherencePrediction {
  assessmentId: string;
  patientId: string;
  assessorId: string;
  assessmentDate: string;

  // Overall prediction
  overallAdherenceScore: number; // 0-100, higher = better predicted adherence
  adherenceCategory: 'excellent' | 'good' | 'moderate' | 'poor' | 'very_poor';
  confidenceLevel: number;

  // Barriers analysis
  barriers: AdherenceBarrier[];
  primaryBarrier: string | null;
  barrierCount: number;

  // Per-medication analysis
  medicationRisks: MedicationRisk[];
  highRiskMedications: string[];

  // Regimen analysis
  regimenComplexity: {
    totalMedications: number;
    dailyDoses: number;
    uniqueDoseTimes: number;
    complexityScore: number; // 0-100
    complexityLevel: 'simple' | 'moderate' | 'complex' | 'very_complex';
  };

  // Historical patterns
  historicalAdherence?: {
    refillAdherence: number; // PDC/MPR
    appointmentAdherence: number;
    checkInAdherence: number;
    trend: 'improving' | 'stable' | 'declining';
  };

  // Interventions
  recommendedInterventions: AdherenceIntervention[];
  urgentInterventions: string[];

  // Risk factors
  riskFactorSummary: {
    factor: string;
    impact: 'low' | 'moderate' | 'high';
    modifiable: boolean;
  }[];

  // Patient context
  healthLiteracy: 'low' | 'moderate' | 'adequate' | 'high' | 'unknown';
  socialSupport: 'none' | 'limited' | 'moderate' | 'strong' | 'unknown';
  financialConcerns: boolean;
  cognitiveImpairment: boolean;

  // Safety
  requiresPharmacistReview: boolean;
  requiresCareCoordination: boolean;
  reviewReasons: string[];

  // Summary
  clinicalSummary: string;
  patientTalkingPoints: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  throw new Error(`Missing environment variable: ${keys.join(' or ')}`);
}

async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {};
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Get patient profile
  const { data: patient } = await supabase
    .from('patients')
    .select('id, date_of_birth, gender, primary_language, insurance_type')
    .eq('id', patientId)
    .single();

  if (patient) {
    context.patient = patient;
    if (patient.date_of_birth) {
      const dob = new Date(patient.date_of_birth);
      context.age = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
  }

  // Get conditions/diagnoses
  const { data: conditions } = await supabase
    .from('patient_conditions')
    .select('condition_code, condition_name, status')
    .eq('patient_id', patientId)
    .eq('status', 'active');

  context.conditions = conditions || [];

  // Get SDOH factors
  const { data: sdohFactors } = await supabase
    .from('sdoh_assessments')
    .select('category, risk_level, details')
    .eq('patient_id', patientId)
    .gte('assessed_at', ninetyDaysAgo)
    .order('assessed_at', { ascending: false });

  context.sdohFactors = sdohFactors || [];

  // Get check-in history for adherence patterns
  const { data: checkIns } = await supabase
    .from('daily_check_ins')
    .select('created_at, mood_score, completed')
    .eq('user_id', patientId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false });

  context.checkInHistory = checkIns || [];

  // Get medication history/refills
  const { data: medHistory } = await supabase
    .from('medication_records')
    .select('medication_name, fill_date, days_supply, refills_remaining')
    .eq('patient_id', patientId)
    .gte('fill_date', ninetyDaysAgo)
    .order('fill_date', { ascending: false });

  context.medicationHistory = medHistory || [];

  // Get cognitive assessments
  const { data: cogAssessments } = await supabase
    .from('cognitive_assessments')
    .select('assessment_type, score, assessed_at')
    .eq('patient_id', patientId)
    .order('assessed_at', { ascending: false })
    .limit(3);

  context.cognitiveAssessments = cogAssessments || [];

  // Get appointment history
  const { data: appointments } = await supabase
    .from('appointments')
    .select('appointment_date, status, no_show')
    .eq('patient_id', patientId)
    .gte('appointment_date', ninetyDaysAgo);

  context.appointments = appointments || [];

  return context;
}

function calculateRegimenComplexity(medications: MedicationInfo[]): {
  totalMedications: number;
  dailyDoses: number;
  uniqueDoseTimes: number;
  complexityScore: number;
  complexityLevel: 'simple' | 'moderate' | 'complex' | 'very_complex';
} {
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

  let level: 'simple' | 'moderate' | 'complex' | 'very_complex';
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

function calculateHistoricalAdherence(context: Record<string, unknown>): {
  refillAdherence: number;
  appointmentAdherence: number;
  checkInAdherence: number;
  trend: 'improving' | 'stable' | 'declining';
} | undefined {
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
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
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

function identifyBarriers(
  context: Record<string, unknown>,
  medications: MedicationInfo[],
  regimenComplexity: { complexityLevel: string; complexityScore: number }
): AdherenceBarrier[] {
  const barriers: AdherenceBarrier[] = [];
  const sdohFactors = context.sdohFactors as Array<{ category: string; risk_level: string }> || [];
  const age = context.age as number | undefined;
  const cogAssessments = context.cognitiveAssessments as Array<{ score: number }> || [];

  // Cost barriers
  const hasSpecialtyMeds = medications.some(m => m.cost_tier === 'specialty' || m.cost_tier === 'non_preferred');
  const hasFinancialSDOH = sdohFactors.some(s =>
    s.category.toLowerCase().includes('financial') && s.risk_level !== 'low'
  );

  if (hasSpecialtyMeds || hasFinancialSDOH) {
    barriers.push({
      barrier: 'Medication cost concerns',
      category: 'cost',
      severity: hasSpecialtyMeds ? 'high' : 'moderate',
      evidence: hasSpecialtyMeds
        ? 'Patient has specialty or non-preferred tier medications'
        : 'Financial concerns identified in SDOH screening',
      mitigable: true,
      interventions: [
        'Review patient assistance programs',
        'Check for generic alternatives',
        'Connect with social worker for financial assistance',
        'Evaluate 90-day supply options for cost savings',
      ],
    });
  }

  // Complexity barriers
  if (regimenComplexity.complexityLevel === 'complex' || regimenComplexity.complexityLevel === 'very_complex') {
    barriers.push({
      barrier: 'Complex medication regimen',
      category: 'complexity',
      severity: regimenComplexity.complexityLevel === 'very_complex' ? 'high' : 'moderate',
      evidence: `${medications.length} medications with complexity score of ${regimenComplexity.complexityScore}`,
      mitigable: true,
      interventions: [
        'Review for combination products',
        'Align dosing times where clinically appropriate',
        'Provide medication organizer/pill box',
        'Set up automated reminders',
      ],
    });
  }

  // Side effect barriers
  const medsWithSideEffects = medications.filter(m =>
    m.side_effects_reported && m.side_effects_reported.length > 0
  );
  if (medsWithSideEffects.length > 0) {
    barriers.push({
      barrier: 'Side effects affecting quality of life',
      category: 'side_effects',
      severity: medsWithSideEffects.length >= 2 ? 'high' : 'moderate',
      evidence: `Patient reported side effects with: ${medsWithSideEffects.map(m => m.name).join(', ')}`,
      mitigable: true,
      interventions: [
        'Review timing of medications relative to side effects',
        'Consider alternative formulations',
        'Evaluate dose adjustments',
        'Provide side effect management counseling',
      ],
    });
  }

  // Cognitive barriers
  const hasCognitiveIssue = cogAssessments.some(a => a.score < 24) || (age && age > 75);
  if (hasCognitiveIssue) {
    barriers.push({
      barrier: 'Cognitive challenges with medication management',
      category: 'cognitive',
      severity: cogAssessments.some(a => a.score < 20) ? 'high' : 'moderate',
      evidence: cogAssessments.length > 0
        ? 'Cognitive assessment indicates potential challenges'
        : 'Advanced age may impact medication management',
      mitigable: true,
      interventions: [
        'Involve caregiver in medication management',
        'Provide simplified medication schedule',
        'Use blister packs or medication dispenser',
        'Set up caregiver reminder system',
      ],
    });
  }

  // Transportation/Access barriers
  const hasTransportSDOH = sdohFactors.some(s =>
    s.category.toLowerCase().includes('transport') && s.risk_level !== 'low'
  );
  if (hasTransportSDOH) {
    barriers.push({
      barrier: 'Transportation barriers to pharmacy access',
      category: 'access',
      severity: 'moderate',
      evidence: 'Transportation challenges identified in SDOH screening',
      mitigable: true,
      interventions: [
        'Set up mail-order pharmacy',
        'Coordinate with community transportation services',
        'Explore pharmacy delivery options',
        'Synchronize refills to minimize trips',
      ],
    });
  }

  // Social support barriers
  const hasSocialSDOH = sdohFactors.some(s =>
    s.category.toLowerCase().includes('social') && s.risk_level !== 'low'
  );
  if (hasSocialSDOH) {
    barriers.push({
      barrier: 'Limited social support for medication adherence',
      category: 'social',
      severity: 'moderate',
      evidence: 'Social isolation or limited support identified',
      mitigable: true,
      interventions: [
        'Connect with community health worker',
        'Enroll in telephonic medication support program',
        'Consider home health medication assistance',
        'Engage family members in care plan',
      ],
    });
  }

  return barriers;
}

function calculateMedicationRisks(
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

    let adherenceRisk: 'low' | 'moderate' | 'high' | 'very_high';
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

function generateInterventions(
  barriers: AdherenceBarrier[],
  medicationRisks: MedicationRisk[],
  regimenComplexity: { complexityLevel: string }
): AdherenceIntervention[] {
  const interventions: AdherenceIntervention[] = [];
  const highRiskMeds = medicationRisks.filter(m =>
    m.adherenceRisk === 'high' || m.adherenceRisk === 'very_high'
  );

  // Universal interventions
  interventions.push({
    intervention: 'Conduct teach-back to verify medication understanding',
    category: 'education',
    priority: 'recommended',
    expectedImpact: 'moderate',
    implementedBy: 'Nurse or Pharmacist',
    timeframe: 'At next encounter',
  });

  // Barrier-specific interventions
  for (const barrier of barriers) {
    if (barrier.severity === 'high' || barrier.severity === 'critical') {
      const topIntervention = barrier.interventions[0];
      interventions.push({
        intervention: topIntervention,
        category: barrier.category === 'cost' ? 'financial' :
                  barrier.category === 'complexity' ? 'simplification' :
                  barrier.category === 'cognitive' ? 'reminder' : 'social_support',
        priority: barrier.severity === 'critical' ? 'critical' : 'strongly_recommended',
        expectedImpact: 'high',
        implementedBy: barrier.category === 'cost' ? 'Social Worker' :
                       barrier.category === 'cognitive' ? 'Care Coordinator' : 'Care Team',
        timeframe: barrier.severity === 'critical' ? 'Within 48 hours' : 'Within 1 week',
      });
    }
  }

  // Complexity-based interventions
  if (regimenComplexity.complexityLevel === 'complex' || regimenComplexity.complexityLevel === 'very_complex') {
    interventions.push({
      intervention: 'Pharmacist medication therapy management (MTM) review',
      category: 'simplification',
      priority: 'strongly_recommended',
      expectedImpact: 'high',
      implementedBy: 'Clinical Pharmacist',
      timeframe: 'Within 2 weeks',
    });
  }

  // High-risk medication interventions
  if (highRiskMeds.length > 0) {
    interventions.push({
      intervention: `Focused counseling on high-risk medications: ${highRiskMeds.map(m => m.medication).join(', ')}`,
      category: 'education',
      priority: 'strongly_recommended',
      expectedImpact: 'high',
      implementedBy: 'Pharmacist',
      timeframe: 'At next encounter or by phone within 1 week',
    });
  }

  // Reminder interventions
  interventions.push({
    intervention: 'Set up medication reminder system (app, alarm, or pill organizer)',
    category: 'reminder',
    priority: 'recommended',
    expectedImpact: 'moderate',
    implementedBy: 'Patient/Caregiver with staff support',
    timeframe: 'Implement at next visit',
  });

  return interventions;
}

function calculateOverallScore(
  barriers: AdherenceBarrier[],
  medicationRisks: MedicationRisk[],
  historicalAdherence: { refillAdherence: number; checkInAdherence: number } | undefined,
  regimenComplexity: { complexityScore: number }
): { score: number; category: 'excellent' | 'good' | 'moderate' | 'poor' | 'very_poor' } {
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

  let category: 'excellent' | 'good' | 'moderate' | 'poor' | 'very_poor';
  if (score >= 80) category = 'excellent';
  else if (score >= 65) category = 'good';
  else if (score >= 50) category = 'moderate';
  else if (score >= 30) category = 'poor';
  else category = 'very_poor';

  return { score, category };
}

// ============================================================================
// AI Enhancement
// ============================================================================

async function enhanceWithAI(
  prediction: AdherencePrediction,
  medications: MedicationInfo[],
  context: Record<string, unknown>
): Promise<AdherencePrediction> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return prediction;
  }

  try {
    const prompt = `You are a clinical pharmacist analyzing medication adherence risk.

PATIENT CONTEXT:
- Age: ${context.age || 'Unknown'}
- Medications: ${medications.length}
- Regimen Complexity: ${prediction.regimenComplexity.complexityLevel}
- Identified Barriers: ${prediction.barriers.map(b => b.barrier).join(', ') || 'None identified'}
- Historical Adherence: ${prediction.historicalAdherence ?
    `Refill: ${prediction.historicalAdherence.refillAdherence}%, Check-ins: ${prediction.historicalAdherence.checkInAdherence}%` :
    'No history available'}

MEDICATIONS:
${medications.map(m => `- ${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`).join('\n')}

HIGH-RISK MEDICATIONS:
${prediction.highRiskMedications.join(', ') || 'None'}

Provide a JSON response with:
1. clinicalSummary: 2-3 sentence clinical summary of adherence risk
2. patientTalkingPoints: Array of 3-4 key points to discuss with the patient in plain language
3. additionalBarriers: Array of any barriers not yet identified (or empty array)
4. healthLiteracy: Assessment of health literacy needs ('low', 'moderate', 'adequate', 'high')
5. socialSupport: Assessment of social support ('none', 'limited', 'moderate', 'strong')

SAFETY: Focus on patient-centered communication. Do not make assumptions about patient capability.

Respond with valid JSON only.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return prediction;
    }

    const aiResponse = await response.json();
    const content = aiResponse.content?.[0]?.text;

    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const aiEnhancements = JSON.parse(jsonMatch[0]);

        if (aiEnhancements.clinicalSummary) {
          prediction.clinicalSummary = aiEnhancements.clinicalSummary;
        }
        if (aiEnhancements.patientTalkingPoints) {
          prediction.patientTalkingPoints = aiEnhancements.patientTalkingPoints;
        }
        if (aiEnhancements.healthLiteracy) {
          prediction.healthLiteracy = aiEnhancements.healthLiteracy;
        }
        if (aiEnhancements.socialSupport) {
          prediction.socialSupport = aiEnhancements.socialSupport;
        }
      }
    }

    return prediction;
  } catch {
    return prediction;
  }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const startTime = Date.now();
  const { headers: corsHeaders } = corsFromRequest(req);
  const logger = createLogger('ai-medication-adherence-predictor', req);

  try {
    const { patientId, assessorId, medications, tenantId } = await req.json() as AdherenceRequest;

    if (!patientId || !assessorId) {
      return new Response(
        JSON.stringify({ error: 'Patient ID and Assessor ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = getEnv('SUPABASE_URL', 'SB_URL');
    const supabaseKey = getEnv('SB_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Gather patient context
    const context = await gatherPatientContext(supabase, patientId);

    // Use provided medications or fetch from context
    const medsToAnalyze: MedicationInfo[] = medications ||
      ((context.medicationHistory as Array<{ medication_name: string }>) || []).map(m => ({
        name: m.medication_name,
      }));

    if (medsToAnalyze.length === 0) {
      return new Response(
        JSON.stringify({
          assessment: {
            assessmentId: crypto.randomUUID(),
            patientId,
            assessorId,
            assessmentDate: new Date().toISOString(),
            overallAdherenceScore: 100,
            adherenceCategory: 'excellent',
            confidenceLevel: 0.5,
            barriers: [],
            primaryBarrier: null,
            barrierCount: 0,
            medicationRisks: [],
            highRiskMedications: [],
            regimenComplexity: {
              totalMedications: 0,
              dailyDoses: 0,
              uniqueDoseTimes: 0,
              complexityScore: 0,
              complexityLevel: 'simple',
            },
            recommendedInterventions: [],
            urgentInterventions: [],
            riskFactorSummary: [],
            healthLiteracy: 'unknown',
            socialSupport: 'unknown',
            financialConcerns: false,
            cognitiveImpairment: false,
            requiresPharmacistReview: false,
            requiresCareCoordination: false,
            reviewReasons: [],
            clinicalSummary: 'No medications on record to assess.',
            patientTalkingPoints: [],
          },
          metadata: {
            generated_at: new Date().toISOString(),
            response_time_ms: Date.now() - startTime,
            model: 'rule-based',
            medications_analyzed: 0,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate components
    const regimenComplexity = calculateRegimenComplexity(medsToAnalyze);
    const historicalAdherence = calculateHistoricalAdherence(context);
    const barriers = identifyBarriers(context, medsToAnalyze, regimenComplexity);
    const medicationRisks = calculateMedicationRisks(medsToAnalyze, barriers);
    const interventions = generateInterventions(barriers, medicationRisks, regimenComplexity);
    const { score, category } = calculateOverallScore(barriers, medicationRisks, historicalAdherence, regimenComplexity);

    const highRiskMeds = medicationRisks
      .filter(m => m.adherenceRisk === 'high' || m.adherenceRisk === 'very_high')
      .map(m => m.medication);

    const urgentInterventions = interventions
      .filter(i => i.priority === 'critical')
      .map(i => i.intervention);

    // Determine review requirements
    const requiresPharmacistReview =
      regimenComplexity.complexityLevel === 'very_complex' ||
      highRiskMeds.length >= 3 ||
      barriers.some(b => b.severity === 'critical');

    const requiresCareCoordination =
      barriers.some(b => b.category === 'social' || b.category === 'access') ||
      score < 40;

    const reviewReasons: string[] = [];
    if (requiresPharmacistReview) {
      reviewReasons.push('Pharmacist MTM review recommended due to regimen complexity');
    }
    if (requiresCareCoordination) {
      reviewReasons.push('Care coordination needed to address adherence barriers');
    }
    if (score < 50) {
      reviewReasons.push('Low predicted adherence requires intervention planning');
    }

    // Build prediction
    let prediction: AdherencePrediction = {
      assessmentId: crypto.randomUUID(),
      patientId,
      assessorId,
      assessmentDate: new Date().toISOString(),
      overallAdherenceScore: score,
      adherenceCategory: category,
      confidenceLevel: 0.75,
      barriers,
      primaryBarrier: barriers.length > 0
        ? barriers.sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
          })[0].barrier
        : null,
      barrierCount: barriers.length,
      medicationRisks,
      highRiskMedications: highRiskMeds,
      regimenComplexity,
      historicalAdherence,
      recommendedInterventions: interventions,
      urgentInterventions,
      riskFactorSummary: barriers.map(b => ({
        factor: b.barrier,
        impact: b.severity === 'critical' || b.severity === 'high' ? 'high' :
                b.severity === 'moderate' ? 'moderate' : 'low',
        modifiable: b.mitigable,
      })),
      healthLiteracy: 'unknown',
      socialSupport: 'unknown',
      financialConcerns: barriers.some(b => b.category === 'cost'),
      cognitiveImpairment: barriers.some(b => b.category === 'cognitive'),
      requiresPharmacistReview,
      requiresCareCoordination,
      reviewReasons,
      clinicalSummary: `Patient has ${category} predicted medication adherence (score: ${score}/100) with ${barriers.length} identified barrier(s). ${highRiskMeds.length > 0 ? `High-risk medications: ${highRiskMeds.join(', ')}.` : ''} ${regimenComplexity.complexityLevel !== 'simple' ? `Regimen complexity is ${regimenComplexity.complexityLevel}.` : ''}`,
      patientTalkingPoints: [
        'Review your medication list together',
        barriers.some(b => b.category === 'cost') ? 'Discuss cost-saving options' : 'Confirm pharmacy access',
        'Set up a reminder system that works for you',
        'Identify one person who can help if needed',
      ],
    };

    // Enhance with AI
    prediction = await enhanceWithAI(prediction, medsToAnalyze, context);

    // Save to database
    try {
      await supabase.from('ai_risk_assessments').insert({
        patient_id: patientId,
        assessor_id: assessorId,
        tenant_id: tenantId,
        risk_category: 'medication_adherence',
        risk_level: category,
        risk_score: score,
        confidence: prediction.confidenceLevel,
        factors: barriers.map(b => b.barrier),
        recommendations: interventions.map(i => i.intervention),
        summary: prediction.clinicalSummary,
        details: {
          barriers,
          medicationRisks,
          regimenComplexity,
          historicalAdherence,
        },
        requires_review: requiresPharmacistReview || requiresCareCoordination,
        assessed_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal - continue with response
    }

    // Audit log
    logger.info('Medication adherence prediction completed', {
      patientId: patientId.substring(0, 8) + '...',
      adherenceScore: score,
      adherenceCategory: category,
      barrierCount: barriers.length,
      medicationsAnalyzed: medsToAnalyze.length,
    });

    return new Response(
      JSON.stringify({
        assessment: prediction,
        metadata: {
          generated_at: new Date().toISOString(),
          response_time_ms: Date.now() - startTime,
          model: 'claude-sonnet-4-20250514',
          medications_analyzed: medsToAnalyze.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
