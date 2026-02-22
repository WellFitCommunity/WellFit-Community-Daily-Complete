/**
 * Medication Alert Override Service
 *
 * Records and manages provider overrides of medication safety alerts
 * (contraindications, drug interactions, allergies). Supports weekly
 * count escalation tracking and manager review workflows.
 *
 * Immutable INSERT-only audit — no deletions permitted.
 *
 * @module medicationOverrideService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AlertType = 'contraindication' | 'drug_interaction' | 'allergy';

/** Medication-specific severity — distinct from ClinicalAlertSeverity (uses 'contraindicated' level) */
export type MedicationAlertSeverity = 'contraindicated' | 'high' | 'moderate' | 'low';
/** @deprecated Use MedicationAlertSeverity — kept for backward compatibility */
export type AlertSeverity = MedicationAlertSeverity;

export type OverrideReason =
  | 'clinical_judgment'
  | 'patient_specific_exception'
  | 'documented_tolerance'
  | 'informed_consent'
  | 'palliative_care'
  | 'monitoring_plan'
  | 'other';

export type ReviewDecision = 'acknowledged' | 'flagged' | 'resolved';

export interface MedicationAlertOverride {
  id: string;
  alert_type: AlertType;
  alert_severity: MedicationAlertSeverity;
  alert_description: string;
  alert_recommendations: string[];
  check_id: string | null;
  medication_name: string;
  medication_rxcui: string | null;
  provider_id: string;
  provider_signature: string;
  patient_id: string;
  override_reason: OverrideReason;
  override_explanation: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_decision: ReviewDecision | null;
  review_notes: string | null;
  tenant_id: string | null;
  created_at: string;
}

export interface RecordOverrideRequest {
  alert_type: AlertType;
  alert_severity: MedicationAlertSeverity;
  alert_description: string;
  alert_recommendations: string[];
  check_id?: string;
  medication_name: string;
  medication_rxcui?: string;
  provider_id: string;
  provider_signature: string;
  patient_id: string;
  override_reason: OverrideReason;
  override_explanation: string;
  tenant_id?: string;
}

export interface ManagerReviewRequest {
  reviewed_by: string;
  review_decision: ReviewDecision;
  review_notes?: string;
}

export interface FlaggedProvider {
  provider_id: string;
  override_count: number;
  latest_override: string;
  severities: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export const medicationOverrideService = {
  /**
   * Record a medication alert override with full audit trail
   */
  async recordOverride(
    request: RecordOverrideRequest
  ): Promise<ServiceResult<MedicationAlertOverride>> {
    try {
      // Validate explanation length
      if (!request.override_explanation || request.override_explanation.trim().length < 20) {
        return failure('OVERRIDE_VALIDATION_FAILED', 'Override explanation must be at least 20 characters');
      }

      // Validate signature
      if (!request.provider_signature || !request.provider_signature.trim()) {
        return failure('OVERRIDE_VALIDATION_FAILED', 'Provider signature is required');
      }

      // Get weekly count for escalation tracking
      const countResult = await this.getProviderWeeklyCount(request.provider_id);
      const weeklyCount = countResult.success ? countResult.data : 0;

      // Insert override record
      const { data, error } = await supabase
        .from('medication_alert_overrides')
        .insert({
          alert_type: request.alert_type,
          alert_severity: request.alert_severity,
          alert_description: request.alert_description,
          alert_recommendations: request.alert_recommendations,
          check_id: request.check_id || null,
          medication_name: request.medication_name,
          medication_rxcui: request.medication_rxcui || null,
          provider_id: request.provider_id,
          provider_signature: request.provider_signature,
          patient_id: request.patient_id,
          override_reason: request.override_reason,
          override_explanation: request.override_explanation.trim(),
          tenant_id: request.tenant_id || null,
        })
        .select()
        .single();

      if (error) {
        return failure('MEDICATION_OVERRIDE_FAILED', error.message, error);
      }

      // Audit log the override
      await auditLogger.clinical('MEDICATION_ALERT_OVERRIDDEN', false, {
        override_id: data.id,
        alert_type: request.alert_type,
        alert_severity: request.alert_severity,
        medication_name: request.medication_name,
        override_reason: request.override_reason,
        provider_id: request.provider_id,
        patient_id: request.patient_id,
        weekly_override_count: weeklyCount + 1,
        escalation_threshold_reached: weeklyCount + 1 >= 3,
      });

      return success(data as MedicationAlertOverride);
    } catch (err: unknown) {
      await auditLogger.error(
        'MEDICATION_OVERRIDE_RECORD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patient_id: request.patient_id, provider_id: request.provider_id }
      );
      return failure('MEDICATION_OVERRIDE_FAILED', 'Failed to record medication alert override');
    }
  },

  /**
   * Get override history for a patient
   */
  async getOverridesForPatient(
    patientId: string
  ): Promise<ServiceResult<MedicationAlertOverride[]>> {
    try {
      const { data, error } = await supabase
        .from('medication_alert_overrides')
        .select('id, alert_type, alert_severity, alert_description, alert_recommendations, check_id, medication_name, medication_rxcui, provider_id, provider_signature, patient_id, override_reason, override_explanation, reviewed_by, reviewed_at, review_decision, review_notes, tenant_id, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as MedicationAlertOverride[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'MEDICATION_OVERRIDE_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patient_id: patientId }
      );
      return failure('FETCH_FAILED', 'Failed to fetch patient override history');
    }
  },

  /**
   * Get provider's override count in the last 7 days
   */
  async getProviderWeeklyCount(
    providerId: string
  ): Promise<ServiceResult<number>> {
    try {
      const { data, error } = await supabase
        .rpc('get_provider_override_count_last_7_days', { p_provider_id: providerId });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(typeof data === 'number' ? data : 0);
    } catch (err: unknown) {
      await auditLogger.error(
        'MEDICATION_OVERRIDE_COUNT_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { provider_id: providerId }
      );
      return failure('FETCH_FAILED', 'Failed to fetch provider weekly override count');
    }
  },

  /**
   * Get providers flagged for 3+ overrides in 7 days
   */
  async getFlaggedProviders(): Promise<ServiceResult<FlaggedProvider[]>> {
    try {
      const { data, error } = await supabase.rpc('get_flagged_override_providers');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as FlaggedProvider[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'FLAGGED_PROVIDERS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        {}
      );
      return failure('FETCH_FAILED', 'Failed to fetch flagged providers');
    }
  },

  /**
   * Record a manager review of a flagged override
   */
  async recordManagerReview(
    overrideId: string,
    review: ManagerReviewRequest
  ): Promise<ServiceResult<MedicationAlertOverride>> {
    try {
      const { data, error } = await supabase
        .from('medication_alert_overrides')
        .update({
          reviewed_by: review.reviewed_by,
          reviewed_at: new Date().toISOString(),
          review_decision: review.review_decision,
          review_notes: review.review_notes || null,
        })
        .eq('id', overrideId)
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.clinical('MEDICATION_OVERRIDE_REVIEWED', false, {
        override_id: overrideId,
        review_decision: review.review_decision,
        reviewed_by: review.reviewed_by,
      });

      return success(data as MedicationAlertOverride);
    } catch (err: unknown) {
      await auditLogger.error(
        'MEDICATION_OVERRIDE_REVIEW_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { override_id: overrideId }
      );
      return failure('OPERATION_FAILED', 'Failed to record manager review');
    }
  },
};

export default medicationOverrideService;
