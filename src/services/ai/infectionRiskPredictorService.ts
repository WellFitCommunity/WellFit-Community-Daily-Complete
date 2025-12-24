/**
 * Infection Risk Predictor (HAI) Service
 *
 * Frontend service for AI-powered Hospital-Acquired Infection risk prediction.
 * Covers major HAI categories:
 * - CLABSI (Central Line-Associated Bloodstream Infection)
 * - CAUTI (Catheter-Associated Urinary Tract Infection)
 * - SSI (Surgical Site Infection)
 * - VAP (Ventilator-Associated Pneumonia)
 * - C. difficile Infection
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * @module infectionRiskPredictorService
 * @skill #33 - Infection Risk Predictor (HAI)
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

export type HAIType = 'clabsi' | 'cauti' | 'ssi' | 'vap' | 'cdiff' | 'overall';
export type RiskCategory = 'low' | 'moderate' | 'high' | 'very_high';

export interface RiskFactor {
  factor: string;
  category: 'device' | 'procedure' | 'medication' | 'comorbidity' | 'lab' | 'environmental' | 'behavioral';
  severity: 'low' | 'moderate' | 'high' | 'critical';
  evidence: string;
  weight: number;
  mitigable: boolean;
  mitigation?: string;
}

export interface ProtectiveFactor {
  factor: string;
  impact: string;
  category: string;
}

export interface PreventionIntervention {
  intervention: string;
  category: 'bundle_element' | 'monitoring' | 'environmental' | 'medication' | 'education';
  priority: 'routine' | 'recommended' | 'strongly_recommended' | 'mandatory';
  frequency: string;
  responsible: string;
  evidenceLevel: 'A' | 'B' | 'C';
  estimatedRiskReduction: number;
}

export interface HAIRiskScore {
  haiType: HAIType;
  riskScore: number;
  riskCategory: RiskCategory;
  riskFactors: RiskFactor[];
  protectiveFactors: ProtectiveFactor[];
  preventionInterventions: PreventionIntervention[];
  daysAtRisk: number;
  deviceDays?: number;
}

export interface InfectionRiskAssessment {
  assessmentId: string;
  patientId: string;
  assessorId: string;
  assessmentDate: string;

  // Overall risk
  overallRiskScore: number;
  overallRiskCategory: RiskCategory;
  primaryConcern: HAIType | null;

  // Individual HAI risks
  haiRisks: HAIRiskScore[];

  // Patient context
  lengthOfStay: number;
  hasInvasiveDevices: boolean;
  deviceList: string[];
  recentSurgeries: string[];
  immunocompromised: boolean;
  antibioticExposure: boolean;
  recentLabAbnormalities: string[];

  // Prevention
  bundleComplianceScore: number;
  recommendedBundles: string[];
  criticalInterventions: PreventionIntervention[];

  // Confidence and review
  confidence: number;
  requiresInfectionControlReview: boolean;
  reviewReasons: string[];

  // Summary
  clinicalSummary: string;
  patientEducationPoints: string[];
}

export interface InfectionRiskRequest {
  patientId: string;
  assessorId: string;
  haiTypes?: HAIType[];
  includePreventionBundle?: boolean;
}

export interface InfectionRiskResponse {
  assessment: InfectionRiskAssessment;
  metadata: {
    generated_at: string;
    response_time_ms: number;
    model: string;
    hai_types_assessed: HAIType[];
  };
}

// ============================================================================
// Service
// ============================================================================

export const InfectionRiskPredictorService = {
  /**
   * Predict infection risk for a patient
   */
  async predictRisk(
    request: InfectionRiskRequest
  ): Promise<ServiceResult<InfectionRiskResponse>> {
    try {
      const { patientId, assessorId, haiTypes, includePreventionBundle } = request;

      if (!patientId || !assessorId) {
        return failure('VALIDATION_ERROR', 'Patient ID and Assessor ID are required');
      }

      await auditLogger.info('INFECTION_RISK_PREDICTION_STARTED', {
        patientId: patientId.substring(0, 8) + '...',
        haiTypes: haiTypes?.join(',') || 'auto',
        category: 'CLINICAL',
      });

      const { data, error } = await supabase.functions.invoke('ai-infection-risk-predictor', {
        body: {
          patientId,
          assessorId,
          haiTypes,
          includePreventionBundle: includePreventionBundle ?? true,
        },
      });

      if (error) {
        await auditLogger.error('INFECTION_RISK_PREDICTION_FAILED', error as Error, {
          patientId: patientId.substring(0, 8) + '...',
          category: 'CLINICAL',
        });
        return failure('AI_SERVICE_ERROR', error.message || 'Infection risk prediction failed');
      }

      await auditLogger.info('INFECTION_RISK_PREDICTION_COMPLETED', {
        patientId: patientId.substring(0, 8) + '...',
        overallRisk: data.assessment?.overallRiskCategory,
        primaryConcern: data.assessment?.primaryConcern,
        category: 'CLINICAL',
      });

      return success(data as InfectionRiskResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('INFECTION_RISK_PREDICTION_ERROR', error, {
        category: 'CLINICAL',
      });
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Predict CLABSI risk specifically
   */
  async predictCLABSIRisk(
    patientId: string,
    assessorId: string
  ): Promise<ServiceResult<InfectionRiskResponse>> {
    return this.predictRisk({
      patientId,
      assessorId,
      haiTypes: ['clabsi'],
      includePreventionBundle: true,
    });
  },

  /**
   * Predict CAUTI risk specifically
   */
  async predictCAUTIRisk(
    patientId: string,
    assessorId: string
  ): Promise<ServiceResult<InfectionRiskResponse>> {
    return this.predictRisk({
      patientId,
      assessorId,
      haiTypes: ['cauti'],
      includePreventionBundle: true,
    });
  },

  /**
   * Predict VAP risk specifically
   */
  async predictVAPRisk(
    patientId: string,
    assessorId: string
  ): Promise<ServiceResult<InfectionRiskResponse>> {
    return this.predictRisk({
      patientId,
      assessorId,
      haiTypes: ['vap'],
      includePreventionBundle: true,
    });
  },

  /**
   * Predict SSI risk specifically
   */
  async predictSSIRisk(
    patientId: string,
    assessorId: string
  ): Promise<ServiceResult<InfectionRiskResponse>> {
    return this.predictRisk({
      patientId,
      assessorId,
      haiTypes: ['ssi'],
      includePreventionBundle: true,
    });
  },

  /**
   * Predict C. difficile risk specifically
   */
  async predictCDiffRisk(
    patientId: string,
    assessorId: string
  ): Promise<ServiceResult<InfectionRiskResponse>> {
    return this.predictRisk({
      patientId,
      assessorId,
      haiTypes: ['cdiff'],
      includePreventionBundle: true,
    });
  },

  /**
   * Comprehensive assessment (all relevant HAI types)
   */
  async comprehensiveAssessment(
    patientId: string,
    assessorId: string
  ): Promise<ServiceResult<InfectionRiskResponse>> {
    return this.predictRisk({
      patientId,
      assessorId,
      // Let the service determine relevant types based on patient context
      includePreventionBundle: true,
    });
  },

  /**
   * Get infection risk history for a patient
   */
  async getInfectionRiskHistory(
    patientId: string,
    days: number = 30
  ): Promise<ServiceResult<Array<{
    id: string;
    risk_level: string;
    risk_score: number;
    confidence: number;
    summary: string;
    assessed_at: string;
  }>>> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('ai_risk_assessments')
        .select('id, risk_level, risk_score, confidence, summary, assessed_at')
        .eq('patient_id', patientId)
        .eq('risk_category', 'infection_hai')
        .gte('assessed_at', startDate)
        .order('assessed_at', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success(data || []);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Get high-risk patients for infection
   */
  async getHighRiskPatients(
    options?: {
      minScore?: number;
      haiType?: HAIType;
      limit?: number;
    }
  ): Promise<ServiceResult<Array<{
    patient_id: string;
    risk_level: string;
    risk_score: number;
    summary: string;
    assessed_at: string;
  }>>> {
    try {
      const minScore = options?.minScore || 50;

      const { data, error } = await supabase
        .from('ai_risk_assessments')
        .select('patient_id, risk_level, risk_score, summary, assessed_at')
        .eq('risk_category', 'infection_hai')
        .gte('risk_score', minScore)
        .order('risk_score', { ascending: false })
        .limit(options?.limit || 50);

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success(data || []);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Get color styling for risk category
   */
  getRiskCategoryStyle(category: RiskCategory): {
    bg: string;
    text: string;
    border: string;
  } {
    switch (category) {
      case 'very_high':
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' };
      case 'high':
        return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-500' };
      case 'moderate':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500' };
      case 'low':
      default:
        return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500' };
    }
  },

  /**
   * Get HAI type display name
   */
  getHAITypeLabel(haiType: HAIType): string {
    switch (haiType) {
      case 'clabsi':
        return 'Central Line-Associated Bloodstream Infection (CLABSI)';
      case 'cauti':
        return 'Catheter-Associated Urinary Tract Infection (CAUTI)';
      case 'ssi':
        return 'Surgical Site Infection (SSI)';
      case 'vap':
        return 'Ventilator-Associated Pneumonia (VAP)';
      case 'cdiff':
        return 'Clostridioides difficile Infection (CDI)';
      case 'overall':
      default:
        return 'Overall Infection Risk';
    }
  },

  /**
   * Get HAI type short label
   */
  getHAITypeShortLabel(haiType: HAIType): string {
    switch (haiType) {
      case 'clabsi':
        return 'CLABSI';
      case 'cauti':
        return 'CAUTI';
      case 'ssi':
        return 'SSI';
      case 'vap':
        return 'VAP';
      case 'cdiff':
        return 'C. diff';
      case 'overall':
      default:
        return 'Overall';
    }
  },

  /**
   * Format prevention bundle for display
   */
  formatPreventionBundle(interventions: PreventionIntervention[]): string[] {
    return interventions
      .sort((a, b) => {
        const priorityOrder = { mandatory: 0, strongly_recommended: 1, recommended: 2, routine: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .map((i) => {
        const priorityTag = i.priority === 'mandatory' ? '[MANDATORY]' :
                           i.priority === 'strongly_recommended' ? '[STRONGLY REC]' : '';
        return `${priorityTag} ${i.intervention} (${i.frequency} - ${i.responsible})`.trim();
      });
  },
};

export default InfectionRiskPredictorService;
