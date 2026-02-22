/**
 * =====================================================
 * LABOR & DELIVERY — ALERT PERSISTENCE SERVICE
 * =====================================================
 * Purpose: CRUD for persisted L&D alerts (ld_alerts table)
 * Handles create, acknowledge, resolve, and query operations
 * =====================================================
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type { LDAlert } from '../../types/laborDelivery';
import type { LDApiResponse } from './laborDeliveryService';

/** Persisted alert record from ld_alerts table */
export interface LDPersistedAlert {
  id: string;
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  alert_type: string;
  severity: string;
  message: string;
  source_record_id: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface CreateAlertRequest {
  patient_id: string;
  tenant_id: string;
  pregnancy_id: string;
  alert_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  source_record_id?: string;
}

export class LDAlertService {
  /** Persist a new alert to the database */
  static async createAlert(
    request: CreateAlertRequest
  ): Promise<LDApiResponse<LDPersistedAlert>> {
    try {
      const { data, error } = await supabase
        .from('ld_alerts')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          pregnancy_id: request.pregnancy_id,
          alert_type: request.alert_type,
          severity: request.severity,
          message: request.message,
          source_record_id: request.source_record_id ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_ALERT_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }
      return { success: true, data: data as unknown as LDPersistedAlert };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_ALERT_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  /** Acknowledge an alert (mark as seen by a provider) */
  static async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<LDApiResponse<LDPersistedAlert>> {
    try {
      const { data, error } = await supabase
        .from('ld_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: acknowledgedBy,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_ALERT_ACK_FAILED',
          new Error(error.message), { alertId });
        return { success: false, error: error.message };
      }
      return { success: true, data: data as unknown as LDPersistedAlert };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_ALERT_ACK_ERROR', error, { alertId });
      return { success: false, error: error.message };
    }
  }

  /** Resolve an alert (clinical action taken) */
  static async resolveAlert(
    alertId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<LDApiResponse<LDPersistedAlert>> {
    try {
      const { data, error } = await supabase
        .from('ld_alerts')
        .update({
          resolved: true,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
          resolution_notes: notes ?? null,
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_ALERT_RESOLVE_FAILED',
          new Error(error.message), { alertId });
        return { success: false, error: error.message };
      }
      return { success: true, data: data as unknown as LDPersistedAlert };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_ALERT_RESOLVE_ERROR', error, { alertId });
      return { success: false, error: error.message };
    }
  }

  /** Get active (unresolved) alerts for a patient */
  static async getActiveAlerts(
    patientId: string,
    tenantId: string
  ): Promise<LDApiResponse<LDPersistedAlert[]>> {
    try {
      const { data, error } = await supabase
        .from('ld_alerts')
        .select('id, patient_id, tenant_id, pregnancy_id, alert_type, severity, message, source_record_id, acknowledged, acknowledged_by, acknowledged_at, resolved, resolved_by, resolved_at, resolution_notes, created_at')
        .eq('patient_id', patientId)
        .eq('tenant_id', tenantId)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        await auditLogger.error('LD_ALERTS_GET_FAILED',
          new Error(error.message), { patientId });
        return { success: false, error: error.message };
      }
      return { success: true, data: (data || []) as unknown as LDPersistedAlert[] };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_ALERTS_GET_ERROR', error, { patientId });
      return { success: false, error: error.message };
    }
  }

  /** Sync computed alerts to the database — upsert based on source_record_id + type */
  static async syncAlerts(
    alerts: LDAlert[],
    patientId: string,
    tenantId: string,
    pregnancyId: string
  ): Promise<LDApiResponse<number>> {
    try {
      let synced = 0;
      for (const alert of alerts) {
        // Check if alert already exists for this source record
        const { data: existing } = await supabase
          .from('ld_alerts')
          .select('id')
          .eq('patient_id', patientId)
          .eq('tenant_id', tenantId)
          .eq('alert_type', alert.type)
          .eq('source_record_id', alert.source_record_id ?? '')
          .eq('resolved', false)
          .limit(1);

        if (!existing || existing.length === 0) {
          await LDAlertService.createAlert({
            patient_id: patientId,
            tenant_id: tenantId,
            pregnancy_id: pregnancyId,
            alert_type: alert.type,
            severity: alert.severity,
            message: alert.message,
            source_record_id: alert.source_record_id ?? undefined,
          });
          synced++;
        }
      }
      return { success: true, data: synced };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_ALERT_SYNC_ERROR', error, { patientId });
      return { success: false, error: error.message };
    }
  }
}
