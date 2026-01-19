/**
 * ED Boarding Service
 *
 * Manages ED patients waiting for inpatient beds with automatic
 * escalation tracking at time thresholds.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  EDBoarder,
  EDBoaringMetrics,
  EDBoaringByUnit,
  CreateEDBoarderInput,
  EscalationLevel,
} from '../types/edBoarding';

// ============================================================================
// ED BOARDING SERVICE
// ============================================================================

export const EDBooardingService = {
  /**
   * Create a new ED boarder (patient admitted from ED awaiting bed)
   */
  async createBoarder(
    input: CreateEDBoarderInput
  ): Promise<ServiceResult<EDBoarder>> {
    try {
      const { data, error } = await supabase
        .from('ed_boarders')
        .insert({
          patient_id: input.patient_id,
          patient_name: input.patient_name,
          patient_mrn: input.patient_mrn,
          ed_bed_id: input.ed_bed_id,
          ed_bed_label: input.ed_bed_label,
          ed_zone: input.ed_zone,
          admitting_physician: input.admitting_physician,
          admitting_service: input.admitting_service,
          admission_diagnosis: input.admission_diagnosis,
          target_unit_type: input.target_unit_type,
          target_unit_id: input.target_unit_id,
          required_bed_type: input.required_bed_type,
          requires_telemetry: input.requires_telemetry ?? false,
          requires_isolation: input.requires_isolation ?? false,
          requires_negative_pressure: input.requires_negative_pressure ?? false,
          special_requirements: input.special_requirements ?? [],
          acuity_level: input.acuity_level,
          is_critical: input.is_critical ?? false,
          notes: input.notes,
          status: 'awaiting_bed',
          escalation_level: 'green',
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('ED_BOARDER_CREATE_FAILED', new Error(error.message), {
          ...input,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('ED_BOARDER_CREATED', {
        boarderId: data.id,
        patientId: input.patient_id,
        acuityLevel: input.acuity_level,
        targetUnitType: input.target_unit_type,
      });

      return success(data as EDBoarder);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_BOARDER_CREATE_FAILED', error, { ...input });
      return failure('OPERATION_FAILED', 'Failed to create ED boarder', err);
    }
  },

  /**
   * Get all active ED boarders for a tenant
   * Uses the ed_boarders_with_metrics view to include calculated boarding_minutes
   */
  async getActiveBoarders(options?: {
    status?: string;
    escalationLevel?: EscalationLevel;
    targetUnitId?: string;
    isCritical?: boolean;
  }): Promise<ServiceResult<EDBoarder[]>> {
    try {
      let query = supabase
        .from('ed_boarders_with_metrics')
        .select('*')
        .in('status', ['awaiting_bed', 'bed_assigned', 'in_transport'])
        .order('escalation_level', { ascending: false })
        .order('boarding_start_at', { ascending: true });

      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.escalationLevel) {
        query = query.eq('escalation_level', options.escalationLevel);
      }
      if (options?.targetUnitId) {
        query = query.eq('target_unit_id', options.targetUnitId);
      }
      if (options?.isCritical !== undefined) {
        query = query.eq('is_critical', options.isCritical);
      }

      const { data, error } = await query;

      if (error) {
        await auditLogger.error('ED_BOARDERS_FETCH_FAILED', new Error(error.message), {
          options: options ?? {},
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as EDBoarder[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_BOARDERS_FETCH_FAILED', error, {
        options: options ?? {},
      });
      return failure('OPERATION_FAILED', 'Failed to fetch ED boarders', err);
    }
  },

  /**
   * Get a single ED boarder by ID
   * Uses the ed_boarders_with_metrics view to include calculated boarding_minutes
   */
  async getBoarder(boarderId: string): Promise<ServiceResult<EDBoarder>> {
    try {
      const { data, error } = await supabase
        .from('ed_boarders_with_metrics')
        .select('*')
        .eq('id', boarderId)
        .single();

      if (error) {
        await auditLogger.error('ED_BOARDER_FETCH_FAILED', new Error(error.message), {
          boarderId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as EDBoarder);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_BOARDER_FETCH_FAILED', error, { boarderId });
      return failure('OPERATION_FAILED', 'Failed to fetch ED boarder', err);
    }
  },

  /**
   * Assign a bed to an ED boarder (calls database function)
   */
  async assignBed(
    boarderId: string,
    bedId: string,
    bedLabel?: string
  ): Promise<ServiceResult<{ boarder_id: string; bed_id: string; bed_label: string }>> {
    try {
      const { data, error } = await supabase.rpc('assign_bed_to_ed_boarder', {
        p_boarder_id: boarderId,
        p_bed_id: bedId,
        p_bed_label: bedLabel ?? null,
      });

      if (error) {
        await auditLogger.error('ED_BOARDER_BED_ASSIGN_FAILED', new Error(error.message), {
          boarderId,
          bedId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data as { success: boolean; error?: string; boarder_id?: string; bed_id?: string; bed_label?: string };

      if (!result.success) {
        return failure('OPERATION_FAILED', result.error || 'Failed to assign bed');
      }

      await auditLogger.info('ED_BOARDER_BED_ASSIGNED', {
        boarderId,
        bedId,
        bedLabel: result.bed_label,
      });

      return success({
        boarder_id: result.boarder_id || boarderId,
        bed_id: result.bed_id || bedId,
        bed_label: result.bed_label || '',
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_BOARDER_BED_ASSIGN_FAILED', error, {
        boarderId,
        bedId,
      });
      return failure('OPERATION_FAILED', 'Failed to assign bed to ED boarder', err);
    }
  },

  /**
   * Mark boarder as in transport
   */
  async startTransport(boarderId: string): Promise<ServiceResult<EDBoarder>> {
    try {
      const { data, error } = await supabase
        .from('ed_boarders')
        .update({
          status: 'in_transport',
          updated_at: new Date().toISOString(),
        })
        .eq('id', boarderId)
        .eq('status', 'bed_assigned')
        .select()
        .single();

      if (error) {
        await auditLogger.error('ED_BOARDER_TRANSPORT_START_FAILED', new Error(error.message), {
          boarderId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('ED_BOARDER_TRANSPORT_STARTED', { boarderId });

      return success(data as EDBoarder);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_BOARDER_TRANSPORT_START_FAILED', error, { boarderId });
      return failure('OPERATION_FAILED', 'Failed to start transport', err);
    }
  },

  /**
   * Place boarder in assigned bed (calls database function)
   */
  async placeBoarder(
    boarderId: string
  ): Promise<ServiceResult<{ boarder_id: string; boarding_minutes: number }>> {
    try {
      const { data, error } = await supabase.rpc('place_ed_boarder', {
        p_boarder_id: boarderId,
      });

      if (error) {
        await auditLogger.error('ED_BOARDER_PLACE_FAILED', new Error(error.message), {
          boarderId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = data as { success: boolean; error?: string; boarder_id?: string; boarding_minutes?: number };

      if (!result.success) {
        return failure('OPERATION_FAILED', result.error || 'Failed to place boarder');
      }

      await auditLogger.info('ED_BOARDER_PLACED', {
        boarderId,
        boardingMinutes: result.boarding_minutes,
      });

      return success({
        boarder_id: result.boarder_id || boarderId,
        boarding_minutes: result.boarding_minutes || 0,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_BOARDER_PLACE_FAILED', error, { boarderId });
      return failure('OPERATION_FAILED', 'Failed to place ED boarder', err);
    }
  },

  /**
   * Cancel boarding (patient no longer needs admission)
   */
  async cancelBoarder(
    boarderId: string,
    reason: string
  ): Promise<ServiceResult<EDBoarder>> {
    try {
      const { data, error } = await supabase
        .from('ed_boarders')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', boarderId)
        .in('status', ['awaiting_bed', 'bed_assigned'])
        .select()
        .single();

      if (error) {
        await auditLogger.error('ED_BOARDER_CANCEL_FAILED', new Error(error.message), {
          boarderId,
          reason,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('ED_BOARDER_CANCELLED', {
        boarderId,
        reason,
      });

      return success(data as EDBoarder);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_BOARDER_CANCEL_FAILED', error, { boarderId, reason });
      return failure('OPERATION_FAILED', 'Failed to cancel ED boarder', err);
    }
  },

  /**
   * Acknowledge an escalation
   */
  async acknowledgeEscalation(
    boarderId: string,
    acknowledgedBy: string
  ): Promise<ServiceResult<EDBoarder>> {
    try {
      const { data, error } = await supabase
        .from('ed_boarders')
        .update({
          escalation_acknowledged: true,
          escalation_acknowledged_by: acknowledgedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', boarderId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('ED_ESCALATION_ACK_FAILED', new Error(error.message), {
          boarderId,
          acknowledgedBy,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('ED_ESCALATION_ACKNOWLEDGED', {
        boarderId,
        acknowledgedBy,
        escalationLevel: data.escalation_level,
      });

      return success(data as EDBoarder);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_ESCALATION_ACK_FAILED', error, {
        boarderId,
        acknowledgedBy,
      });
      return failure('OPERATION_FAILED', 'Failed to acknowledge escalation', err);
    }
  },

  /**
   * Update barriers to placement
   */
  async updateBarriers(
    boarderId: string,
    barriers: string[]
  ): Promise<ServiceResult<EDBoarder>> {
    try {
      const { data, error } = await supabase
        .from('ed_boarders')
        .update({
          barriers_to_placement: barriers,
          updated_at: new Date().toISOString(),
        })
        .eq('id', boarderId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('ED_BARRIERS_UPDATE_FAILED', new Error(error.message), {
          boarderId,
          barriers,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('ED_BARRIERS_UPDATED', {
        boarderId,
        barrierCount: barriers.length,
      });

      return success(data as EDBoarder);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_BARRIERS_UPDATE_FAILED', error, { boarderId, barriers });
      return failure('OPERATION_FAILED', 'Failed to update barriers', err);
    }
  },

  /**
   * Get ED boarding metrics (calls database function)
   */
  async getMetrics(tenantId: string): Promise<ServiceResult<EDBoaringMetrics>> {
    try {
      const { data, error } = await supabase.rpc('get_ed_boarding_metrics', {
        p_tenant_id: tenantId,
      });

      if (error) {
        await auditLogger.error('ED_METRICS_FETCH_FAILED', new Error(error.message), {
          tenantId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      const metrics = data as EDBoaringMetrics;

      return success(metrics);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_METRICS_FETCH_FAILED', error, { tenantId });
      return failure('OPERATION_FAILED', 'Failed to fetch ED boarding metrics', err);
    }
  },

  /**
   * Get boarding summary by target unit
   */
  async getBoardingByUnit(): Promise<ServiceResult<EDBoaringByUnit[]>> {
    try {
      const { data, error } = await supabase
        .from('ed_boarders')
        .select(`
          target_unit_type,
          target_unit_id,
          boarding_minutes,
          is_critical
        `)
        .eq('status', 'awaiting_bed');

      if (error) {
        await auditLogger.error('ED_BOARDING_BY_UNIT_FAILED', new Error(error.message), {});
        return failure('DATABASE_ERROR', error.message, error);
      }

      // Aggregate by unit type
      const unitMap = new Map<string, {
        target_unit_type: string;
        boarder_count: number;
        total_wait_minutes: number;
        critical_count: number;
      }>();

      for (const row of data || []) {
        const key = row.target_unit_type || 'Unknown';
        const existing = unitMap.get(key);
        if (existing) {
          existing.boarder_count++;
          existing.total_wait_minutes += row.boarding_minutes || 0;
          if (row.is_critical) existing.critical_count++;
        } else {
          unitMap.set(key, {
            target_unit_type: key,
            boarder_count: 1,
            total_wait_minutes: row.boarding_minutes || 0,
            critical_count: row.is_critical ? 1 : 0,
          });
        }
      }

      const result: EDBoaringByUnit[] = Array.from(unitMap.values()).map((unit) => ({
        target_unit_type: unit.target_unit_type as EDBoaringByUnit['target_unit_type'],
        boarder_count: unit.boarder_count,
        avg_wait_minutes: unit.boarder_count > 0
          ? Math.round(unit.total_wait_minutes / unit.boarder_count)
          : 0,
        critical_count: unit.critical_count,
        available_beds: 0, // Would need to join with beds table
      }));

      return success(result);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_BOARDING_BY_UNIT_FAILED', error, {});
      return failure('OPERATION_FAILED', 'Failed to fetch boarding by unit', err);
    }
  },

  /**
   * Get boarders needing escalation (unacknowledged at higher levels)
   * Uses the ed_boarders_with_metrics view to include calculated boarding_minutes
   */
  async getUnacknowledgedEscalations(): Promise<ServiceResult<EDBoarder[]>> {
    try {
      const { data, error } = await supabase
        .from('ed_boarders_with_metrics')
        .select('*')
        .eq('status', 'awaiting_bed')
        .eq('escalation_acknowledged', false)
        .in('escalation_level', ['yellow', 'orange', 'red', 'critical'])
        .order('escalation_level', { ascending: false })
        .order('boarding_start_at', { ascending: true });

      if (error) {
        await auditLogger.error('ED_ESCALATIONS_FETCH_FAILED', new Error(error.message), {});
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as EDBoarder[]);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_ESCALATIONS_FETCH_FAILED', error, {});
      return failure('OPERATION_FAILED', 'Failed to fetch unacknowledged escalations', err);
    }
  },

  /**
   * Update boarder notes
   */
  async updateNotes(boarderId: string, notes: string): Promise<ServiceResult<EDBoarder>> {
    try {
      const { data, error } = await supabase
        .from('ed_boarders')
        .update({
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', boarderId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('ED_NOTES_UPDATE_FAILED', new Error(error.message), {
          boarderId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as EDBoarder);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ED_NOTES_UPDATE_FAILED', error, { boarderId });
      return failure('OPERATION_FAILED', 'Failed to update notes', err);
    }
  },
};

export default EDBooardingService;
