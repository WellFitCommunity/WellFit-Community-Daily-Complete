/**
 * Healthcare Integrations Service
 *
 * Unified service for external healthcare system integrations:
 * - Lab Systems (LabCorp, Quest Diagnostics)
 * - Pharmacy (Surescripts, PillPack)
 * - Imaging/PACS (DICOM)
 * - Insurance Verification (X12 270/271)
 *
 * Uses ServiceResult<T> pattern for consistent error handling.
 *
 * Decomposed 2026-06-01 (CLAUDE.md Commandment #12, 600-line limit). This file
 * is now the unified facade; each integration domain lives in its own module
 * under ./healthcare-integrations/* (service class + its DB mappers):
 *   - labIntegration.ts        LabIntegrationService + lab mappers
 *   - pharmacyIntegration.ts   PharmacyIntegrationService + pharmacy mappers
 *   - imagingIntegration.ts    ImagingIntegrationService + imaging mappers
 *   - insuranceVerification.ts InsuranceVerificationService + insurance mappers
 * Existing import paths are preserved via the re-exports below — behavior unchanged.
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import type { HealthcareIntegrationStats } from '../types/healthcareIntegrations';

import { LabIntegrationService } from './healthcare-integrations/labIntegration';
import { PharmacyIntegrationService } from './healthcare-integrations/pharmacyIntegration';
import { ImagingIntegrationService } from './healthcare-integrations/imagingIntegration';
import { InsuranceVerificationService } from './healthcare-integrations/insuranceVerification';

// Re-export the per-domain service classes so existing import paths keep working.
export { LabIntegrationService } from './healthcare-integrations/labIntegration';
export { PharmacyIntegrationService } from './healthcare-integrations/pharmacyIntegration';
export { ImagingIntegrationService } from './healthcare-integrations/imagingIntegration';
export { InsuranceVerificationService } from './healthcare-integrations/insuranceVerification';

// ============================================================================
// UNIFIED HEALTHCARE INTEGRATIONS SERVICE
// ============================================================================

export class HealthcareIntegrationsService {
  static Lab = LabIntegrationService;
  static Pharmacy = PharmacyIntegrationService;
  static Imaging = ImagingIntegrationService;
  static Insurance = InsuranceVerificationService;

  /**
   * Get overall healthcare integration statistics
   */
  static async getStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<ServiceResult<HealthcareIntegrationStats>> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .single();

      if (!profile?.tenant_id) {
        return failure('NOT_FOUND', 'Tenant not found');
      }

      const { data, error } = await supabase.rpc('get_healthcare_integration_stats', {
        p_tenant_id: profile.tenant_id,
        p_start_date: startDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_end_date: endDate?.toISOString() || new Date().toISOString(),
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      const stats = data?.[0] || {};
      return success({
        labOrdersTotal: Number(stats.lab_orders_total) || 0,
        labResultsReceived: Number(stats.lab_results_received) || 0,
        labCriticalValues: Number(stats.lab_critical_values) || 0,
        prescriptionsSent: Number(stats.prescriptions_sent) || 0,
        refillRequestsPending: Number(stats.refill_requests_pending) || 0,
        imagingStudiesTotal: Number(stats.imaging_studies_total) || 0,
        imagingReportsFinal: Number(stats.imaging_reports_final) || 0,
        eligibilityChecks: Number(stats.eligibility_checks) || 0,
        eligibilityVerified: Number(stats.eligibility_verified) || 0,
      });
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get integration stats', err);
    }
  }
}

// Export singleton
export default HealthcareIntegrationsService;
