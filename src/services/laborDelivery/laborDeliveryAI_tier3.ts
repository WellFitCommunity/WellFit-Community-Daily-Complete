/**
 * L&D AI Integration Service — Tier 3 (Moonshot Features)
 *
 * Purpose: Birth plan generation, PPD early warning, contraindication checking,
 *   patient education — features no competitor has
 * Calls: ai-patient-education, ai-contraindication-detector,
 *   holisticRiskAssessment (local), ld_postpartum_assessments (DB)
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { calculateHolisticRiskAssessment } from '../holisticRiskAssessment';
import type { ServiceResult } from '../_base';
import { success, failure } from '../_base';
import type {
  LDBirthPlan,
  LDBirthPlanSection,
  LDPPDRiskResult,
  LDPPDContributingFactor,
  LDContraindicationResult,
  LDContraindicationAssessment,
  LDContraindicationFinding,
  LDPatientEducationContent,
} from '../../types/laborDeliveryAI';

// =====================================================
// CONSTANTS
// =====================================================

/** Preset education topics available in the L&D module */
export const LD_EDUCATION_TOPICS = {
  labor_preparation: {
    topic: 'labor_preparation',
    label: 'Labor & Delivery Preparation',
    condition: 'pregnancy labor preparation',
  },
  breastfeeding: {
    topic: 'breastfeeding',
    label: 'Breastfeeding Guidance',
    condition: 'breastfeeding lactation newborn feeding',
  },
  postpartum_warning_signs: {
    topic: 'postpartum_warning_signs',
    label: 'Postpartum Warning Signs',
    condition: 'postpartum complications warning signs maternal',
  },
  newborn_care: {
    topic: 'newborn_care',
    label: 'Newborn Care Basics',
    condition: 'newborn infant care bathing feeding sleep safety',
  },
} as const;

export type LDEducationTopicKey = keyof typeof LD_EDUCATION_TOPICS;

// =====================================================
// BIRTH PLAN SECTIONS
// =====================================================

const BIRTH_PLAN_SECTION_KEYS = [
  'labor_environment',
  'pain_management',
  'delivery_preferences',
  'newborn_care',
  'feeding_plan',
  'support_team',
  'emergency_preferences',
  'postpartum_wishes',
] as const;

const BIRTH_PLAN_SECTION_LABELS: Record<string, string> = {
  labor_environment: 'Labor Environment',
  pain_management: 'Pain Management',
  delivery_preferences: 'Delivery Preferences',
  newborn_care: 'Newborn Care',
  feeding_plan: 'Feeding Plan',
  support_team: 'Support Team',
  emergency_preferences: 'Emergency Preferences',
  postpartum_wishes: 'Postpartum Wishes',
};

function parseSection(raw: unknown, key: string): LDBirthPlanSection {
  const section = raw as Record<string, unknown> | undefined;
  return {
    title: (section?.title as string) ?? BIRTH_PLAN_SECTION_LABELS[key] ?? key,
    content: (section?.content as string) ?? '',
    preferences: (section?.preferences as string[]) ?? [],
  };
}

// =====================================================
// T3.1 — BIRTH PLAN GENERATION (ai-patient-education)
// =====================================================

export async function generateBirthPlan(
  patientId: string,
  providerId: string
): Promise<ServiceResult<LDBirthPlan>> {
  try {
    await auditLogger.info('LD_BIRTH_PLAN_START', {
      patientId,
      skillKey: 'patient_education',
    });

    // Fetch pregnancy data for context
    const { data: pregnancyData } = await supabase
      .from('ld_pregnancies')
      .select('gravida, para, edd, risk_level, risk_factors, blood_type, gbs_status')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const pregnancyContext = pregnancyData
      ? `G${pregnancyData.gravida}P${pregnancyData.para}, EDD: ${pregnancyData.edd}, Risk: ${pregnancyData.risk_level}, Blood type: ${pregnancyData.blood_type}, GBS: ${pregnancyData.gbs_status}, Factors: ${(pregnancyData.risk_factors as string[] ?? []).join(', ')}`
      : 'No pregnancy data available';

    const { data, error } = await supabase.functions.invoke('ai-patient-education', {
      body: {
        patientId,
        providerId,
        topic: `comprehensive birth plan generation — ${pregnancyContext}`,
        condition: 'pregnancy birth plan labor delivery preferences',
        format: 'structured',
        sections: BIRTH_PLAN_SECTION_KEYS,
      },
    });

    if (error) {
      await auditLogger.error('LD_BIRTH_PLAN_FAILED',
        new Error(error.message), { patientId });
      return failure('AI_SERVICE_ERROR', error.message);
    }

    const raw = data as Record<string, unknown> | undefined;
    const rawSections = (raw?.sections ?? raw?.content) as Record<string, unknown> | undefined;

    const sections = {} as LDBirthPlan['sections'];
    for (const key of BIRTH_PLAN_SECTION_KEYS) {
      sections[key] = parseSection(rawSections?.[key], key);
    }

    const result: LDBirthPlan = {
      patientId,
      generatedAt: new Date().toISOString(),
      sections,
      requiresReview: true,
      confidenceScore: (raw?.confidence as number) ?? 0.80,
    };

    await auditLogger.info('LD_BIRTH_PLAN_COMPLETE', { patientId });
    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LD_BIRTH_PLAN_ERROR', error, { patientId });
    return failure('AI_SERVICE_ERROR', error.message);
  }
}

// =====================================================
// T3.2 — PPD EARLY WARNING (local calculation)
// =====================================================

export async function calculatePPDRisk(
  patientId: string
): Promise<ServiceResult<LDPPDRiskResult>> {
  try {
    await auditLogger.info('LD_PPD_RISK_START', {
      patientId,
      skillKey: 'ppd_early_warning',
    });

    // Fetch latest EPDS score from postpartum assessments
    const { data: ppData } = await supabase
      .from('ld_postpartum_assessments')
      .select('epds_score, emotional_status, hours_postpartum')
      .eq('patient_id', patientId)
      .order('assessment_datetime', { ascending: false })
      .limit(1)
      .single();

    const epdsScore = (ppData?.epds_score as number | null) ?? null;

    // Fetch holistic risk scores for multi-dimensional PPD assessment
    const holisticScores = await calculateHolisticRiskAssessment(supabase, patientId);

    // Weighted composite: EPDS 40%, mental_health 25%, social_isolation 20%, engagement 15%
    const epdsNormalized = epdsScore !== null ? Math.min(epdsScore / 3, 10) : 5;
    const mentalHealth = holisticScores.mental_health_risk;
    const socialIsolation = holisticScores.social_isolation_risk;
    const engagement = holisticScores.engagement_risk;

    const compositeScore = Number((
      (epdsNormalized * 0.40) +
      (mentalHealth * 0.25) +
      (socialIsolation * 0.20) +
      (engagement * 0.15)
    ).toFixed(1));

    const riskLevel = compositeScore >= 7.5 ? 'critical'
      : compositeScore >= 5.5 ? 'high'
      : compositeScore >= 3.5 ? 'moderate'
      : 'low';

    const contributingFactors: LDPPDContributingFactor[] = [
      {
        dimension: 'EPDS Score',
        score: epdsNormalized,
        weight: 0.40,
        description: epdsScore !== null
          ? `EPDS: ${epdsScore}/30 (normalized: ${epdsNormalized.toFixed(1)}/10)`
          : 'EPDS not yet assessed',
      },
      {
        dimension: 'Mental Health Risk',
        score: mentalHealth,
        weight: 0.25,
        description: `Mood/stress/anxiety patterns: ${mentalHealth.toFixed(1)}/10`,
      },
      {
        dimension: 'Social Isolation Risk',
        score: socialIsolation,
        weight: 0.20,
        description: `Social engagement patterns: ${socialIsolation.toFixed(1)}/10`,
      },
      {
        dimension: 'Engagement Risk',
        score: engagement,
        weight: 0.15,
        description: `Platform activity level: ${engagement.toFixed(1)}/10`,
      },
    ];

    const recommendedActions: string[] = [];
    if (compositeScore >= 5.5) {
      recommendedActions.push('Schedule mental health follow-up within 48 hours');
    }
    if (epdsScore !== null && epdsScore >= 13) {
      recommendedActions.push('EPDS positive screen — clinical evaluation required');
    }
    if (socialIsolation >= 6) {
      recommendedActions.push('Assess social support network — consider peer support group referral');
    }
    if (compositeScore >= 7.5) {
      recommendedActions.push('Urgent psychiatric evaluation — consider safety assessment');
    }
    if (recommendedActions.length === 0) {
      recommendedActions.push('Continue routine postpartum follow-up');
    }

    const result: LDPPDRiskResult = {
      compositeScore,
      riskLevel,
      epdsScore,
      contributingFactors,
      recommendedActions,
      requiresIntervention: compositeScore >= 5.5,
      calculatedAt: new Date().toISOString(),
    };

    await auditLogger.info('LD_PPD_RISK_COMPLETE', {
      patientId,
      compositeScore,
      riskLevel,
      requiresIntervention: result.requiresIntervention,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LD_PPD_RISK_ERROR', error, { patientId });
    return failure('AI_SERVICE_ERROR', error.message);
  }
}

// =====================================================
// T3.3 — CONTRAINDICATION CHECKING (ai-contraindication-detector)
// =====================================================

export async function checkLDContraindication(
  patientId: string,
  providerId: string,
  medicationName: string,
  indication?: string,
  proposedDosage?: string
): Promise<ServiceResult<LDContraindicationResult>> {
  try {
    await auditLogger.info('LD_CONTRAINDICATION_CHECK_START', {
      patientId,
      medication: medicationName,
      skillKey: 'contraindication_detector',
    });

    const { data, error } = await supabase.functions.invoke('ai-contraindication-detector', {
      body: {
        patientId,
        providerId,
        medicationName,
        indication: indication ?? 'labor_and_delivery',
        proposedDosage,
        context: 'obstetric',
        additionalConditions: ['pregnancy'],
      },
    });

    if (error) {
      await auditLogger.error('LD_CONTRAINDICATION_CHECK_FAILED',
        new Error(error.message), { patientId, medicationName });
      return failure('AI_SERVICE_ERROR', error.message);
    }

    const raw = data as Record<string, unknown> | undefined;
    if (!raw) {
      return failure('AI_SERVICE_ERROR', 'No contraindication data returned');
    }

    const rawAssessment = (raw.assessment as string) ?? (raw.overallAssessment as string) ?? 'safe';
    const assessment: LDContraindicationAssessment =
      ['safe', 'caution', 'warning', 'contraindicated'].includes(rawAssessment)
        ? rawAssessment as LDContraindicationAssessment
        : 'caution';

    const findings = (raw.findings as LDContraindicationFinding[]) ?? [];

    const result: LDContraindicationResult = {
      assessment,
      findings,
      clinicalSummary: (raw.clinicalSummary as string) ?? (raw.summary as string) ?? '',
      requiresClinicalReview: assessment !== 'safe',
      checkedAt: new Date().toISOString(),
    };

    await auditLogger.info('LD_CONTRAINDICATION_CHECK_COMPLETE', {
      patientId,
      medicationName,
      assessment: result.assessment,
      findingsCount: result.findings.length,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LD_CONTRAINDICATION_CHECK_ERROR', error, { patientId });
    return failure('AI_SERVICE_ERROR', error.message);
  }
}

// =====================================================
// T3.4 — PATIENT EDUCATION (ai-patient-education)
// =====================================================

export async function generateLDPatientEducation(
  topic: string,
  condition?: string,
  patientId?: string,
  format?: 'text' | 'structured' | 'qa'
): Promise<ServiceResult<LDPatientEducationContent>> {
  try {
    await auditLogger.info('LD_PATIENT_EDUCATION_START', {
      topic,
      skillKey: 'patient_education',
    });

    const { data, error } = await supabase.functions.invoke('ai-patient-education', {
      body: {
        patientId,
        topic,
        condition: condition ?? topic,
        format: format ?? 'text',
      },
    });

    if (error) {
      await auditLogger.error('LD_PATIENT_EDUCATION_FAILED',
        new Error(error.message), { topic });
      return failure('AI_SERVICE_ERROR', error.message);
    }

    const raw = data as Record<string, unknown> | undefined;
    if (!raw) {
      return failure('AI_SERVICE_ERROR', 'No education content returned');
    }

    const result: LDPatientEducationContent = {
      topic,
      title: (raw.title as string) ?? topic,
      content: (raw.content as string) ?? (raw.text as string) ?? '',
      format: format ?? 'text',
      generatedAt: new Date().toISOString(),
      requiresReview: true,
    };

    await auditLogger.info('LD_PATIENT_EDUCATION_COMPLETE', { topic });
    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LD_PATIENT_EDUCATION_ERROR', error, { topic });
    return failure('AI_SERVICE_ERROR', error.message);
  }
}
