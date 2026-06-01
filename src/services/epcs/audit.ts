/**
 * EPCS — DEA-required audit logging
 *
 * Extracted from epcsService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import type { AuditLogEntry } from './types';

/**
 * Log an EPCS audit event (DEA requirement)
 */
export async function logAuditEvent(
  tenantId: string,
  event: {
    eventType: string;
    userId: string;
    userRole: string;
    prescriptionId?: string;
    patientId?: string;
    eventDetails: Record<string, unknown>;
    signatureMethod?: string;
    tfaTokenSerial?: string;
    success: boolean;
    failureReason?: string;
    ipAddress?: string;
    deviceInfo?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from('epcs_audit_log').insert({
      tenant_id: tenantId,
      event_type: event.eventType,
      event_timestamp: new Date().toISOString(),
      user_id: event.userId,
      user_role: event.userRole,
      prescription_id: event.prescriptionId,
      patient_id: event.patientId,
      event_details: event.eventDetails,
      signature_method: event.signatureMethod,
      tfa_token_serial: event.tfaTokenSerial,
      success: event.success,
      failure_reason: event.failureReason,
      user_ip_address: event.ipAddress,
      user_device_info: event.deviceInfo,
    });
  } catch (err: unknown) {
    // Don't fail the main operation if audit logging fails
    // but do log it for investigation
    await auditLogger.error(
      'EPCS_AUDIT_LOG_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, eventType: event.eventType }
    );
  }
}

/**
 * Get audit log for a prescription
 */
export async function getPrescriptionAuditLog(
  tenantId: string,
  prescriptionId: string
): Promise<ServiceResult<AuditLogEntry[]>> {
  try {
    const { data, error } = await supabase
      .from('epcs_audit_log')
      .select('id, tenant_id, event_type, event_timestamp, user_id, user_role, prescription_id, patient_id, event_details, success, failure_reason')
      .eq('tenant_id', tenantId)
      .eq('prescription_id', prescriptionId)
      .order('event_timestamp', { ascending: true });

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const entries: AuditLogEntry[] = (data || []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      eventTimestamp: new Date(row.event_timestamp),
      userId: row.user_id,
      userRole: row.user_role,
      prescriptionId: row.prescription_id,
      patientId: row.patient_id,
      eventDetails: row.event_details,
      success: row.success,
      failureReason: row.failure_reason,
    }));

    return success(entries);
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_AUDIT_LOG_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, prescriptionId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch audit log');
  }
}
