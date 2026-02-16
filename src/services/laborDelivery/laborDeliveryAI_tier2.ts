/**
 * L&D AI Integration Service — Tier 2
 *
 * Purpose: Wire existing AI services into L&D for higher-value integrations
 * Calls: ai-clinical-guideline-matcher, SDOHPassiveDetector, HandoffService
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type { ServiceResult } from '../_base';
import { success, failure } from '../_base';

// =====================================================
// TYPES — ACOG Guideline Compliance (T2.1)
// =====================================================

export interface LDGuidelineReference {
  guidelineId: string;
  guidelineName: string;
  organization: string;
  year: number;
  condition: string;
}

export interface LDGuidelineRecommendation {
  category: string;
  recommendation: string;
  rationale: string;
  evidenceLevel: string;
  urgency: string;
  gap?: string;
  actionItems: string[];
  guideline: LDGuidelineReference;
}

export interface LDAdherenceGap {
  gapType: string;
  description: string;
  expectedCare: string;
  currentState: string;
  recommendation: string;
  priority: string;
  guideline: LDGuidelineReference;
}

export interface LDPreventiveScreening {
  screeningName: string;
  guidelineSource: string;
  frequency: string;
  status: string;
  recommendation: string;
  nextDue?: string;
  lastPerformed?: string;
}

export interface LDGuidelineComplianceResult {
  recommendations: LDGuidelineRecommendation[];
  adherenceGaps: LDAdherenceGap[];
  preventiveScreenings: LDPreventiveScreening[];
  summary: {
    totalGuidelines: number;
    totalRecommendations: number;
    criticalGaps: number;
    highPriorityGaps: number;
    overdueScreenings: number;
  };
  confidence: number;
  requiresReview: boolean;
}

// =====================================================
// TYPES — SDOH Detection (T2.3)
// =====================================================

export interface LDSDOHDetection {
  category: string;
  confidenceScore: number;
  riskLevel: string;
  urgency: string;
  zCodeMapping?: string;
  aiSummary: string;
  recommendedActions: Array<{
    action: string;
    priority: string;
    timeframe: string;
  }>;
}

export interface LDSDOHResult {
  detections: LDSDOHDetection[];
  totalDetections: number;
  hasHighRiskFindings: boolean;
}

// =====================================================
// TYPES — Shift Handoff (T2.2)
// =====================================================

export interface LDHandoffSection {
  title: string;
  content: string;
  priority: 'routine' | 'notable' | 'critical';
}

export interface LDShiftHandoffResult {
  sections: LDHandoffSection[];
  urgencyLevel: string;
  generatedAt: string;
  patientSummary: string;
  activeAlerts: string[];
  pendingActions: string[];
}

// =====================================================
// ACOG GUIDELINE COMPLIANCE — ai-clinical-guideline-matcher
// =====================================================

/** L&D-specific focus conditions for ACOG guideline matching */
const LD_FOCUS_CONDITIONS = [
  'pregnancy',
  'gestational diabetes',
  'preeclampsia',
  'gestational hypertension',
  'group B streptococcus',
  'Rh incompatibility',
  'preterm labor',
  'fetal growth restriction',
];

const LD_GUIDELINE_CATEGORIES = [
  'obstetric',
  'prenatal_screening',
  'labor_management',
  'postpartum_care',
  'neonatal',
];

export async function checkGuidelineCompliance(
  patientId: string,
  tenantId: string
): Promise<ServiceResult<LDGuidelineComplianceResult>> {
  try {
    await auditLogger.info('LD_GUIDELINE_CHECK_START', {
      patientId,
      skillKey: 'clinical_guideline_matcher',
    });

    const { data, error } = await supabase.functions.invoke('ai-clinical-guideline-matcher', {
      body: {
        patientId,
        tenantId,
        focusConditions: LD_FOCUS_CONDITIONS,
        includePreventiveCare: true,
        guidelineCategories: LD_GUIDELINE_CATEGORIES,
      },
    });

    if (error) {
      await auditLogger.error('LD_GUIDELINE_CHECK_FAILED',
        new Error(error.message), { patientId });
      return failure('AI_SERVICE_ERROR', error.message);
    }

    const raw = data as Record<string, unknown> | undefined;
    if (!raw) {
      return failure('AI_SERVICE_ERROR', 'No guideline data returned');
    }

    const recommendations = (raw.recommendations as LDGuidelineRecommendation[]) ?? [];
    const adherenceGaps = (raw.adherenceGaps as LDAdherenceGap[]) ?? [];
    const preventiveScreenings = (raw.preventiveScreenings as LDPreventiveScreening[]) ?? [];
    const rawSummary = raw.summary as Record<string, unknown> | undefined;

    const result: LDGuidelineComplianceResult = {
      recommendations,
      adherenceGaps,
      preventiveScreenings,
      summary: {
        totalGuidelines: (rawSummary?.totalGuidelines as number) ?? 0,
        totalRecommendations: (rawSummary?.totalRecommendations as number) ?? recommendations.length,
        criticalGaps: (rawSummary?.criticalGaps as number) ?? adherenceGaps.filter(g => g.priority === 'critical').length,
        highPriorityGaps: (rawSummary?.highPriorityGaps as number) ?? adherenceGaps.filter(g => g.priority === 'high').length,
        overdueScreenings: (rawSummary?.overdueScreenings as number) ?? preventiveScreenings.filter(s => s.status === 'overdue').length,
      },
      confidence: (raw.confidence as number) ?? 0.85,
      requiresReview: true,
    };

    await auditLogger.info('LD_GUIDELINE_CHECK_COMPLETE', {
      patientId,
      gapCount: result.adherenceGaps.length,
      overdueCount: result.summary.overdueScreenings,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LD_GUIDELINE_CHECK_ERROR', error, { patientId });
    return failure('AI_SERVICE_ERROR', error.message);
  }
}

// =====================================================
// L&D SHIFT HANDOFF — Aggregate L&D data for handoff
// =====================================================

export async function generateLDShiftHandoff(
  patientId: string,
  tenantId: string,
  pregnancyId: string
): Promise<ServiceResult<LDShiftHandoffResult>> {
  try {
    await auditLogger.info('LD_SHIFT_HANDOFF_START', {
      patientId,
      pregnancyId,
    });

    // Gather L&D-specific data for the handoff
    const [laborRes, fetalRes, medsRes, alertsRes, pregnancyRes] = await Promise.all([
      supabase.from('ld_labor_events').select('stage, dilation_cm, effacement_percent, station, event_time, contraction_frequency_per_10min')
        .eq('pregnancy_id', pregnancyId).order('event_time', { ascending: false }).limit(5),
      supabase.from('ld_fetal_monitoring').select('fhr_baseline, fhr_category, variability, deceleration_type, assessment_time')
        .eq('pregnancy_id', pregnancyId).order('assessment_time', { ascending: false }).limit(3),
      supabase.from('ld_medication_administrations').select('medication_name, dose, route, administered_datetime, indication')
        .eq('pregnancy_id', pregnancyId).order('administered_datetime', { ascending: false }).limit(10),
      supabase.from('ld_alerts').select('alert_type, severity, message, status')
        .eq('patient_id', patientId).eq('tenant_id', tenantId).in('status', ['active', 'acknowledged']),
      supabase.from('ld_pregnancies').select('gravida, para, edd, blood_type, risk_factors, current_status')
        .eq('id', pregnancyId).single(),
    ]);

    const laborEvents = (laborRes.data ?? []) as Array<Record<string, unknown>>;
    const fetalData = (fetalRes.data ?? []) as Array<Record<string, unknown>>;
    const meds = (medsRes.data ?? []) as Array<Record<string, unknown>>;
    const alerts = (alertsRes.data ?? []) as Array<Record<string, unknown>>;
    const pregnancy = pregnancyRes.data as Record<string, unknown> | null;

    const sections: LDHandoffSection[] = [];

    // Patient summary
    if (pregnancy) {
      sections.push({
        title: 'Pregnancy Overview',
        content: `G${pregnancy.gravida}P${pregnancy.para}, EDD: ${pregnancy.edd ?? 'Unknown'}, Blood type: ${pregnancy.blood_type ?? 'Unknown'}, Status: ${String(pregnancy.current_status ?? 'active').replace(/_/g, ' ')}`,
        priority: 'routine',
      });
      const risks = pregnancy.risk_factors as string[] | null;
      if (risks && risks.length > 0) {
        sections.push({
          title: 'Risk Factors',
          content: risks.join(', '),
          priority: 'notable',
        });
      }
    }

    // Labor progress
    if (laborEvents.length > 0) {
      const latest = laborEvents[0];
      sections.push({
        title: 'Labor Progress',
        content: `Stage: ${String(latest.stage).replace(/_/g, ' ')}, Cervix: ${latest.dilation_cm}cm / ${latest.effacement_percent}% effaced, Station: ${Number(latest.station) > 0 ? '+' : ''}${latest.station}${latest.contraction_frequency_per_10min ? `, Contractions: ${latest.contraction_frequency_per_10min}/10min` : ''}`,
        priority: 'notable',
      });
    }

    // Fetal monitoring
    if (fetalData.length > 0) {
      const latest = fetalData[0];
      const category = String(latest.fhr_category);
      sections.push({
        title: 'Fetal Monitoring',
        content: `FHR Baseline: ${latest.fhr_baseline} bpm, Category: ${category}, Variability: ${latest.variability}, Decelerations: ${latest.deceleration_type}`,
        priority: category === 'III' ? 'critical' : category === 'II' ? 'notable' : 'routine',
      });
    }

    // Active medications
    if (meds.length > 0) {
      const medList = meds.map(m =>
        `${m.medication_name} ${m.dose} ${String(m.route).toUpperCase()} (${String(m.indication).replace(/_/g, ' ')})`
      ).join('\n');
      sections.push({
        title: 'Active Medications',
        content: medList,
        priority: 'notable',
      });
    }

    // Active alerts
    const activeAlerts = alerts
      .filter(a => a.status === 'active')
      .map(a => `[${String(a.severity).toUpperCase()}] ${a.message}`);

    if (activeAlerts.length > 0) {
      sections.push({
        title: 'Active Alerts',
        content: activeAlerts.join('\n'),
        priority: 'critical',
      });
    }

    // Determine urgency
    const hasCriticalAlerts = alerts.some(a => a.severity === 'critical');
    const hasHighAlerts = alerts.some(a => a.severity === 'high');
    const urgencyLevel = hasCriticalAlerts ? 'critical' : hasHighAlerts ? 'urgent' : 'routine';

    const result: LDShiftHandoffResult = {
      sections,
      urgencyLevel,
      generatedAt: new Date().toISOString(),
      patientSummary: pregnancy
        ? `G${pregnancy.gravida}P${pregnancy.para} — ${String(pregnancy.current_status ?? 'active').replace(/_/g, ' ')}`
        : 'No pregnancy data',
      activeAlerts: activeAlerts,
      pendingActions: alerts
        .filter(a => a.status === 'acknowledged')
        .map(a => String(a.message)),
    };

    await auditLogger.info('LD_SHIFT_HANDOFF_COMPLETE', {
      patientId,
      sectionCount: sections.length,
      urgencyLevel,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LD_SHIFT_HANDOFF_ERROR', error, { patientId });
    return failure('AI_SERVICE_ERROR', error.message);
  }
}

// =====================================================
// SDOH DETECTION — Scan prenatal notes
// =====================================================

export async function scanPrenatalNotesForSDOH(
  patientId: string,
  tenantId: string,
  noteText: string,
  sourceId: string
): Promise<ServiceResult<LDSDOHResult>> {
  try {
    await auditLogger.info('LD_SDOH_SCAN_START', {
      patientId,
      sourceType: 'prenatal_note',
    });

    const { data, error } = await supabase.functions.invoke('sdoh-passive-detect', {
      body: {
        patientId,
        tenantId,
        sourceType: 'self_report_note',
        sourceId,
        sourceText: noteText,
      },
    });

    if (error) {
      await auditLogger.error('LD_SDOH_SCAN_FAILED',
        new Error(error.message), { patientId });
      return failure('AI_SERVICE_ERROR', error.message);
    }

    const raw = data as Record<string, unknown> | undefined;
    const detections = (raw?.detections as LDSDOHDetection[]) ?? [];

    const result: LDSDOHResult = {
      detections,
      totalDetections: detections.length,
      hasHighRiskFindings: detections.some(
        d => d.riskLevel === 'high' || d.riskLevel === 'critical'
      ),
    };

    await auditLogger.info('LD_SDOH_SCAN_COMPLETE', {
      patientId,
      detectionsFound: result.totalDetections,
      hasHighRisk: result.hasHighRiskFindings,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LD_SDOH_SCAN_ERROR', error, { patientId });
    return failure('AI_SERVICE_ERROR', error.message);
  }
}
