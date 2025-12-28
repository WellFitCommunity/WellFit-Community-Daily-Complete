/**
 * Readmission Risk Feature Extractor
 *
 * Extracts comprehensive evidence-based features for readmission risk prediction
 * Implements clinical guidelines and CMS quality measures
 *
 * HIPAA Compliance: Server-side only, uses patient IDs not PHI
 *
 * REFACTORED: Now delegates to domain modules in ./readmission/ directory
 * All behavior is preserved - domain modules contain exact same logic
 */

import type {
  ReadmissionRiskFeatures,
  ClinicalFactors,
  MedicationFactors,
  PostDischargeFactors,
  SocialDeterminants,
  FunctionalStatus,
  EngagementFactors,
  SelfReportedHealth
} from '../../types/readmissionRiskFeatures';
import type { DischargeContext } from './readmissionRiskPredictor';

// Import domain module functions
import { extractClinicalFactors } from './readmission/clinicalFactors';
import { extractMedicationFactors } from './readmission/medicationFactors';
import { extractPostDischargeFactors } from './readmission/postDischargeFactors';
import { extractSocialDeterminants } from './readmission/socialDeterminants';
import { extractFunctionalStatus } from './readmission/functionalStatus';
import { extractEngagementFactors } from './readmission/engagementFactors';
import { extractSelfReportedHealth } from './readmission/selfReportedHealth';

// Import utilities
import { getNestedValue } from './readmission/utils';
import { DATA_COMPLETENESS_WEIGHTS } from './readmissionModelConfig';

export class ReadmissionFeatureExtractor {
  /**
   * Extract all comprehensive features for a patient at discharge
   */
  async extractFeatures(context: DischargeContext): Promise<ReadmissionRiskFeatures> {
    const [
      clinical,
      medication,
      postDischarge,
      socialDeterminants,
      functionalStatus,
      engagement,
      selfReported
    ] = await Promise.all([
      extractClinicalFactors(context),
      extractMedicationFactors(context),
      extractPostDischargeFactors(context),
      extractSocialDeterminants(context),
      extractFunctionalStatus(context),
      extractEngagementFactors(context),
      extractSelfReportedHealth(context)
    ]);

    // Calculate data completeness
    const { completeness, missingCritical } = this.calculateDataCompleteness({
      clinical,
      medication,
      postDischarge,
      socialDeterminants,
      functionalStatus,
      engagement,
      selfReported
    });

    return {
      patientId: context.patientId,
      tenantId: context.tenantId,
      dischargeDate: context.dischargeDate,
      assessmentTimestamp: new Date().toISOString(),
      clinical,
      medication,
      postDischarge,
      socialDeterminants,
      functionalStatus,
      engagement,
      selfReported,
      dataCompletenessScore: completeness,
      missingCriticalData: missingCritical
    };
  }

  // =====================================================
  // LEGACY METHOD ALIASES (for backwards compatibility)
  // These delegate to the new domain modules
  // =====================================================

  /**
   * Extract clinical factors - delegates to domain module
   * @deprecated Use extractClinicalFactors from './readmission/clinicalFactors' directly
   */
  private async extractClinicalFactors(context: DischargeContext): Promise<ClinicalFactors> {
    return extractClinicalFactors(context);
  }

  /**
   * Extract medication factors - delegates to domain module
   * @deprecated Use extractMedicationFactors from './readmission/medicationFactors' directly
   */
  private async extractMedicationFactors(context: DischargeContext): Promise<MedicationFactors> {
    return extractMedicationFactors(context);
  }

  /**
   * Extract post-discharge factors - delegates to domain module
   * @deprecated Use extractPostDischargeFactors from './readmission/postDischargeFactors' directly
   */
  private async extractPostDischargeFactors(context: DischargeContext): Promise<PostDischargeFactors> {
    return extractPostDischargeFactors(context);
  }

  /**
   * Extract social determinants - delegates to domain module
   * @deprecated Use extractSocialDeterminants from './readmission/socialDeterminants' directly
   */
  private async extractSocialDeterminants(context: DischargeContext): Promise<SocialDeterminants> {
    return extractSocialDeterminants(context);
  }

  /**
   * Extract functional status - delegates to domain module
   * @deprecated Use extractFunctionalStatus from './readmission/functionalStatus' directly
   */
  private async extractFunctionalStatus(context: DischargeContext): Promise<FunctionalStatus> {
    return extractFunctionalStatus(context);
  }

  /**
   * Extract engagement factors - delegates to domain module
   * @deprecated Use extractEngagementFactors from './readmission/engagementFactors' directly
   */
  private async extractEngagementFactors(context: DischargeContext): Promise<EngagementFactors> {
    return extractEngagementFactors(context);
  }

  /**
   * Extract self-reported health - delegates to domain module
   * @deprecated Use extractSelfReportedHealth from './readmission/selfReportedHealth' directly
   */
  private async extractSelfReportedHealth(context: DischargeContext): Promise<SelfReportedHealth> {
    return extractSelfReportedHealth(context);
  }

  /**
   * Calculate data completeness score
   * Critical for prediction confidence
   *
   * NOTE: This method uses the centralized DATA_COMPLETENESS_WEIGHTS config
   */
  private calculateDataCompleteness(features: unknown): { completeness: number; missingCritical: string[] } {
    let totalWeight = 0;
    let presentWeight = 0;
    const missing: string[] = [];

    DATA_COMPLETENESS_WEIGHTS.forEach(item => {
      totalWeight += item.weight;
      const value = getNestedValue(features, item.key);
      if (value !== undefined && value !== null) {
        presentWeight += item.weight;
      } else {
        missing.push(item.key);
      }
    });

    const completeness = Math.round((presentWeight / totalWeight) * 100);

    return { completeness, missingCritical: missing };
  }
}

export const featureExtractor = new ReadmissionFeatureExtractor();
