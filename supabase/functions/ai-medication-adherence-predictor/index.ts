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
import { SONNET_MODEL } from '../_shared/models.ts';

import type { AdherenceRequest, AdherencePrediction, MedicationInfo } from './types.ts';
import { gatherPatientContext } from './patientContext.ts';
import {
  calculateRegimenComplexity,
  calculateHistoricalAdherence,
  calculateMedicationRisks,
  calculateOverallScore,
} from './calculations.ts';
import { identifyBarriers } from './barriers.ts';
import { generateInterventions } from './interventions.ts';
import { enhanceWithAI } from './aiEnhancement.ts';
import { requireUser } from "../_shared/auth.ts";

// ============================================================================
// Helpers
// ============================================================================

function getEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  throw new Error(`Missing environment variable: ${keys.join(' or ')}`);
}

/**
 * Build the empty-medication response for patients with no medications to assess.
 */
function buildEmptyMedicationResponse(
  patientId: string,
  assessorId: string,
  startTime: number,
  corsHeaders: Record<string, string>
): Response {
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

/**
 * Determine the primary barrier (highest severity).
 */
function findPrimaryBarrier(barriers: AdherencePrediction['barriers']): string | null {
  if (barriers.length === 0) return null;
  const severityOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
  const sorted = [...barriers].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  );
  return sorted[0].barrier;
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
    // Auth gate — require valid JWT
    let user;
    try {
      user = await requireUser(req);
    } catch (authResponse: unknown) {
      if (authResponse instanceof Response) return authResponse;
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { patientId, assessorId, medications, tenantId } = await req.json() as AdherenceRequest;

    if (!patientId || !assessorId) {
      return new Response(
        JSON.stringify({ error: 'Patient ID and Assessor ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = getEnv('SUPABASE_URL', 'SB_URL');
    const supabaseKey = getEnv('SB_SECRET_KEY', 'SB_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Gather patient context
    const context = await gatherPatientContext(supabase, patientId);

    // Use provided medications or fetch from context
    const medsToAnalyze: MedicationInfo[] = medications ||
      ((context.medicationHistory as Array<{ medication_name: string }>) || []).map(m => ({
        name: m.medication_name,
      }));

    if (medsToAnalyze.length === 0) {
      return buildEmptyMedicationResponse(patientId, assessorId, startTime, corsHeaders);
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
      primaryBarrier: findPrimaryBarrier(barriers),
      barrierCount: barriers.length,
      medicationRisks,
      highRiskMedications: highRiskMeds,
      regimenComplexity,
      historicalAdherence,
      recommendedInterventions: interventions,
      urgentInterventions,
      riskFactorSummary: barriers.map(b => ({
        factor: b.barrier,
        impact: b.severity === 'critical' || b.severity === 'high' ? 'high' as const :
                b.severity === 'moderate' ? 'moderate' as const : 'low' as const,
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
    } catch (_dbErr: unknown) {
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
          model: SONNET_MODEL,
          medications_analyzed: medsToAnalyze.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
