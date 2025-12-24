/**
 * Missed Check-In Escalation Service
 *
 * Client-side service for AI-powered missed check-in escalation.
 * Analyzes patient patterns and determines appropriate caregiver notifications.
 *
 * Part of AI Skills Roadmap - Phase 4: Patient Engagement (#28)
 *
 * @module missedCheckInEscalationService
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { ServiceResult, success, failure } from '../_base';

// ============================================================================
// Types
// ============================================================================

export type EscalationLevel = 'none' | 'low' | 'medium' | 'high' | 'emergency';
export type TriggerType = 'single_missed' | 'consecutive_missed' | 'scheduled_check';

export interface EscalationRequest {
  patientId: string;
  checkInId?: string;
  triggerType: TriggerType;
  consecutiveMissedCount?: number;
}

export interface EscalationMessage {
  subject: string;
  body: string;
  urgency: 'none' | 'routine' | 'important' | 'urgent' | 'emergency';
}

export interface EscalationResult {
  escalationLevel: EscalationLevel;
  reasoning: string;
  recommendedActions: string[];
  /** Step 1: Notify the WellFit tenant organization first */
  notifyTenant: boolean;
  /** Step 2: Then notify caregiver */
  notifyCaregiver: boolean;
  /** Step 3: Notify emergency contact */
  notifyEmergencyContact: boolean;
  /** Step 4 (Last resort): Request welfare check - only for WellFit/law enforcement tenants */
  callForWelfareCheck: boolean;
  message: EscalationMessage;
  riskFactors: string[];
  protectiveFactors: string[];
}

export interface EscalationResponse {
  escalation: EscalationResult;
  context: {
    riskLevel: string;
    consecutiveMissed: number;
    hasCaregiver: boolean;
    /** Whether this tenant type allows welfare checks (WellFit only, not clinical) */
    welfareCheckEligible?: boolean;
    /** Tenant license type: 0=Both, 8=Clinical Only, 9=WellFit Only */
    tenantLicenseType?: '0' | '8' | '9' | null;
  };
  metadata: {
    processed_at: string;
    trigger_type: string;
    response_time_ms: number;
  };
}

// ============================================================================
// Service
// ============================================================================

export const MissedCheckInEscalationService = {
  /**
   * Analyze a missed check-in and determine escalation level
   *
   * @param request - The escalation request with patient info
   * @returns ServiceResult with escalation analysis
   */
  async analyzeAndEscalate(
    request: EscalationRequest
  ): Promise<ServiceResult<EscalationResponse>> {
    try {
      const { patientId, checkInId, triggerType, consecutiveMissedCount } = request;

      if (!patientId) {
        return failure('VALIDATION_ERROR', 'Patient ID is required');
      }

      const { data, error } = await supabase.functions.invoke('ai-missed-checkin-escalation', {
        body: {
          patientId,
          checkInId,
          triggerType,
          consecutiveMissedCount: consecutiveMissedCount ?? 1,
        },
      });

      if (error) {
        await auditLogger.error('MISSED_CHECKIN_ESCALATION_FAILED', error as Error, {
          patientId,
          triggerType,
          category: 'CLINICAL',
        });
        return failure('AI_SERVICE_ERROR', error.message || 'Escalation analysis failed');
      }

      await auditLogger.info('MISSED_CHECKIN_ESCALATION_ANALYZED', {
        patientId,
        triggerType,
        escalationLevel: data.escalation?.escalationLevel,
        category: 'CLINICAL',
      });

      return success(data as EscalationResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('MISSED_CHECKIN_ESCALATION_ERROR', error, {
        category: 'CLINICAL',
      });
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Check for patients with pending check-ins that should be escalated
   * Typically called by a scheduled job
   *
   * @param cutoffHours - Hours after check-in sent to consider it missed
   * @returns ServiceResult with list of escalated patient IDs
   */
  async processOverdueCheckIns(
    cutoffHours: number = 12
  ): Promise<ServiceResult<string[]>> {
    try {
      const cutoffTime = new Date(Date.now() - cutoffHours * 60 * 60 * 1000).toISOString();

      // Find pending check-ins older than cutoff
      const { data: overdueCheckIns, error: fetchError } = await supabase
        .from('patient_daily_check_ins')
        .select('id, patient_id')
        .eq('status', 'pending')
        .lt('created_at', cutoffTime)
        .limit(50);

      if (fetchError) {
        return failure('DATABASE_ERROR', fetchError.message);
      }

      if (!overdueCheckIns || overdueCheckIns.length === 0) {
        return success([]);
      }

      const escalatedPatients: string[] = [];

      for (const checkIn of overdueCheckIns) {
        // Count consecutive missed
        const { data: history } = await supabase
          .from('patient_daily_check_ins')
          .select('status')
          .eq('patient_id', checkIn.patient_id)
          .order('check_in_date', { ascending: false })
          .limit(7);

        let consecutiveMissed = 0;
        for (const h of history || []) {
          if (h.status === 'missed' || h.status === 'pending') {
            consecutiveMissed++;
          } else {
            break;
          }
        }

        // Mark as missed
        await supabase
          .from('patient_daily_check_ins')
          .update({ status: 'missed' })
          .eq('id', checkIn.id);

        // Trigger escalation analysis
        const result = await this.analyzeAndEscalate({
          patientId: checkIn.patient_id,
          checkInId: checkIn.id,
          triggerType: consecutiveMissed > 1 ? 'consecutive_missed' : 'single_missed',
          consecutiveMissedCount: consecutiveMissed,
        });

        if (result.success && result.data.escalation.escalationLevel !== 'none') {
          escalatedPatients.push(checkIn.patient_id);
        }
      }

      await auditLogger.info('OVERDUE_CHECKINS_PROCESSED', {
        total: overdueCheckIns.length,
        escalated: escalatedPatients.length,
        category: 'CLINICAL',
      });

      return success(escalatedPatients);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('PROCESS_OVERDUE_CHECKINS_FAILED', error, {
        category: 'CLINICAL',
      });
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Get escalation history for a patient
   *
   * @param patientId - The patient ID
   * @param days - Number of days of history to fetch
   * @returns ServiceResult with escalation history
   */
  async getEscalationHistory(
    patientId: string,
    days: number = 30
  ): Promise<
    ServiceResult<
      Array<{
        id: string;
        check_in_date: string;
        status: string;
        escalation_level: string | null;
        escalation_reasoning: string | null;
        escalated_at: string | null;
      }>
    >
  > {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data, error } = await supabase
        .from('patient_daily_check_ins')
        .select('id, check_in_date, status, escalation_level, escalation_reasoning, escalated_at')
        .eq('patient_id', patientId)
        .gte('check_in_date', startDate)
        .order('check_in_date', { ascending: false });

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
   * Manually trigger an escalation for a patient
   * Used by care coordinators when they identify a concern
   *
   * @param patientId - The patient ID
   * @param reason - Manual escalation reason
   * @returns ServiceResult with escalation result
   */
  async manualEscalation(
    patientId: string,
    reason: string
  ): Promise<ServiceResult<EscalationResponse>> {
    try {
      // Get most recent check-in
      const { data: recentCheckIn } = await supabase
        .from('patient_daily_check_ins')
        .select('id')
        .eq('patient_id', patientId)
        .order('check_in_date', { ascending: false })
        .limit(1)
        .single();

      const result = await this.analyzeAndEscalate({
        patientId,
        checkInId: recentCheckIn?.id,
        triggerType: 'scheduled_check',
        consecutiveMissedCount: 1,
      });

      if (result.success) {
        // Log manual escalation
        await auditLogger.warn('MANUAL_ESCALATION_TRIGGERED', {
          patientId,
          reason,
          escalationLevel: result.data.escalation.escalationLevel,
          category: 'CLINICAL',
        });
      }

      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('UNKNOWN_ERROR', error.message);
    }
  },
};

export default MissedCheckInEscalationService;
