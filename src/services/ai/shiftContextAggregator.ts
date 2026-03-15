/**
 * Shift Context Aggregator
 *
 * P4-2: Pulls shift-relevant data for a unit/floor within a shift window
 * (8 or 12 hours) and formats it for the Claude-in-Claude
 * synthesize-handoff-narrative MCP tool.
 *
 * Aggregates:
 * - shift_handoff_events (clinical events during the shift)
 * - care_team_alerts (active alerts for patients on the unit)
 * - care_coordination_plans (care plan changes during the shift)
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md (P4-2)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type { ServiceResult } from '../_base';
import { success, failure } from '../_base';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

/** Shift type as used in shift_handoff_risk_scores */
export type ShiftType = 'day' | 'evening' | 'night';

/** Escalation event formatted for the MCP tool */
interface ShiftEscalationEvent {
  timestamp: string;
  event_type: string;
  severity: string;
  description: string;
  status: 'active' | 'resolved' | 'monitoring';
  resolution?: string;
}

/** Care plan change formatted for the MCP tool */
interface CarePlanChange {
  change_description: string;
  changed_by_role: string;
  timestamp: string;
  reason: string;
}

/** Pending action formatted for the MCP tool */
interface PendingAction {
  action: string;
  priority: string;
  due_by: string;
  assigned_role: string;
  context: string;
}

/** Full shift context ready for the synthesize-handoff-narrative MCP tool */
export interface ShiftContext {
  unit_id: string;
  tenant_id: string;
  shift_start: string;
  shift_end: string;
  patient_ids: string[];
  escalation_events: ShiftEscalationEvent[];
  care_plan_changes: CarePlanChange[];
  pending_actions: PendingAction[];
}

/** Result from the MCP handoff narrative tool */
export interface HandoffNarrativeResult {
  narrative: string;
  critical_items: Array<{
    patient_id: string;
    description: string;
    reasoning: string;
    urgency: string;
    recommended_action: string;
  }>;
  resolved_since_last_shift: string[];
  watch_items: string[];
  shift_summary_stats: {
    total_events: number;
    critical_events: number;
    patients_with_changes: number;
    pending_actions_count: number;
  };
}

// ============================================================================
// Shift Window Calculation
// ============================================================================

/** Calculate shift start/end based on shift type and date */
function getShiftWindow(shiftType: ShiftType, shiftDate: Date): { start: string; end: string } {
  const date = new Date(shiftDate);
  date.setHours(0, 0, 0, 0);

  switch (shiftType) {
    case 'day':
      date.setHours(7, 0, 0, 0);
      return {
        start: date.toISOString(),
        end: new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      };
    case 'evening':
      date.setHours(15, 0, 0, 0);
      return {
        start: date.toISOString(),
        end: new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      };
    case 'night':
      date.setHours(23, 0, 0, 0);
      return {
        start: date.toISOString(),
        end: new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      };
  }
}

// ============================================================================
// Severity Mapping
// ============================================================================

function mapEventSeverity(severity: string): string {
  switch (severity) {
    case 'critical': return 'emergency';
    case 'major': return 'escalate';
    case 'moderate': return 'notify';
    case 'minor': return 'monitor';
    default: return 'none';
  }
}

function mapAlertPriority(priority: string): string {
  switch (priority) {
    case 'emergency': return 'immediate';
    case 'urgent': return 'urgent';
    case 'routine': return 'routine';
    default: return 'routine';
  }
}

// ============================================================================
// Service
// ============================================================================

export const ShiftContextAggregator = {
  /**
   * Fetch patients assigned to a unit for the current shift.
   */
  async fetchUnitPatients(
    unitId: string
  ): Promise<ServiceResult<string[]>> {
    try {
      const { data, error } = await supabase
        .from('bed_assignments')
        .select('patient_id')
        .eq('unit_id', unitId)
        .eq('is_active', true);

      if (error) {
        return failure('DATABASE_ERROR', `Failed to fetch unit patients: ${error.message}`, error);
      }

      const patientIds = ((data ?? []) as Array<{ patient_id: string }>)
        .map(d => d.patient_id)
        .filter(Boolean);

      return success(patientIds);
    } catch (err: unknown) {
      await auditLogger.error(
        'SHIFT_UNIT_PATIENTS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { unitId }
      );
      return failure('FETCH_FAILED', 'Failed to fetch unit patients');
    }
  },

  /**
   * Fetch shift events within the shift window for given patients.
   */
  async fetchShiftEvents(
    patientIds: string[],
    shiftStart: string,
    shiftEnd: string
  ): Promise<ServiceResult<ShiftEscalationEvent[]>> {
    try {
      if (patientIds.length === 0) return success([]);

      const { data, error } = await supabase
        .from('shift_handoff_events')
        .select('event_time, event_type, event_severity, event_description, action_taken')
        .in('patient_id', patientIds)
        .gte('event_time', shiftStart)
        .lte('event_time', shiftEnd)
        .order('event_time', { ascending: true })
        .limit(100);

      if (error) {
        return failure('DATABASE_ERROR', `Failed to fetch shift events: ${error.message}`, error);
      }

      const events = ((data ?? []) as Array<{
        event_time: string;
        event_type: string;
        event_severity: string;
        event_description: string;
        action_taken: string | null;
      }>).map(e => ({
        timestamp: e.event_time,
        event_type: e.event_type,
        severity: mapEventSeverity(e.event_severity),
        description: e.event_description,
        status: (e.action_taken ? 'resolved' : 'active') as 'active' | 'resolved' | 'monitoring',
        resolution: e.action_taken ?? undefined,
      }));

      return success(events);
    } catch (err: unknown) {
      await auditLogger.error(
        'SHIFT_EVENTS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientCount: patientIds.length }
      );
      return failure('FETCH_FAILED', 'Failed to fetch shift events');
    }
  },

  /**
   * Fetch active care team alerts for the shift's patients.
   * Maps alerts to pending actions for the next shift.
   */
  async fetchPendingActions(
    patientIds: string[]
  ): Promise<ServiceResult<PendingAction[]>> {
    try {
      if (patientIds.length === 0) return success([]);

      const { data, error } = await supabase
        .from('care_team_alerts')
        .select('alert_type, title, priority, severity, created_at')
        .in('patient_id', patientIds)
        .in('status', ['active', 'in_progress'])
        .order('severity', { ascending: false })
        .limit(50);

      if (error) {
        return failure('DATABASE_ERROR', `Failed to fetch pending actions: ${error.message}`, error);
      }

      const actions = ((data ?? []) as Array<{
        alert_type: string;
        title: string;
        priority: string;
        severity: string;
        created_at: string;
      }>).map(a => ({
        action: `Address ${a.alert_type}: ${a.title}`,
        priority: mapAlertPriority(a.priority),
        due_by: 'next_shift',
        assigned_role: 'charge_nurse',
        context: `Severity: ${a.severity}, Created: ${a.created_at}`,
      }));

      return success(actions);
    } catch (err: unknown) {
      await auditLogger.error(
        'SHIFT_PENDING_ACTIONS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientCount: patientIds.length }
      );
      return failure('FETCH_FAILED', 'Failed to fetch pending actions');
    }
  },

  /**
   * Fetch care plan changes made during the shift window.
   */
  async fetchCarePlanChanges(
    patientIds: string[],
    shiftStart: string,
    shiftEnd: string
  ): Promise<ServiceResult<CarePlanChange[]>> {
    try {
      if (patientIds.length === 0) return success([]);

      const { data, error } = await supabase
        .from('care_coordination_plans')
        .select('title, status, updated_at')
        .in('patient_id', patientIds)
        .gte('updated_at', shiftStart)
        .lte('updated_at', shiftEnd)
        .order('updated_at', { ascending: true })
        .limit(50);

      if (error) {
        return failure('DATABASE_ERROR', `Failed to fetch care plan changes: ${error.message}`, error);
      }

      const changes = ((data ?? []) as Array<{
        title: string;
        status: string;
        updated_at: string;
      }>).map(c => ({
        change_description: `Care plan "${c.title}" updated to status: ${c.status}`,
        changed_by_role: 'care_coordinator',
        timestamp: c.updated_at,
        reason: `Status changed to ${c.status}`,
      }));

      return success(changes);
    } catch (err: unknown) {
      await auditLogger.error(
        'SHIFT_CARE_PLAN_CHANGES_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientCount: patientIds.length }
      );
      return failure('FETCH_FAILED', 'Failed to fetch care plan changes');
    }
  },

  /**
   * Aggregate all shift context and call the MCP narrative tool.
   *
   * Full pipeline:
   * 1. Fetch patients on the unit
   * 2. Fetch events, alerts, and care plan changes in parallel
   * 3. Call synthesize-handoff-narrative MCP tool
   */
  async aggregateAndSynthesize(
    unitId: string,
    tenantId: string,
    shiftType: ShiftType,
    shiftDate?: Date
  ): Promise<ServiceResult<HandoffNarrativeResult>> {
    try {
      const { start, end } = getShiftWindow(shiftType, shiftDate ?? new Date());

      await auditLogger.info('SHIFT_CONTEXT_AGGREGATION_START', {
        unitId,
        shiftType,
        shiftStart: start,
        shiftEnd: end,
      });

      // Step 1: Get patients on the unit
      const patientsResult = await this.fetchUnitPatients(unitId);
      if (!patientsResult.success) {
        return failure(
          patientsResult.error?.code ?? 'FETCH_FAILED',
          patientsResult.error?.message ?? 'Failed to fetch unit patients'
        );
      }

      const patientIds = patientsResult.data;
      if (patientIds.length === 0) {
        return success({
          narrative: 'No patients currently assigned to this unit.',
          critical_items: [],
          resolved_since_last_shift: [],
          watch_items: [],
          shift_summary_stats: {
            total_events: 0,
            critical_events: 0,
            patients_with_changes: 0,
            pending_actions_count: 0,
          },
        });
      }

      // Step 2: Fetch all context in parallel
      const [eventsResult, actionsResult, changesResult] = await Promise.allSettled([
        this.fetchShiftEvents(patientIds, start, end),
        this.fetchPendingActions(patientIds),
        this.fetchCarePlanChanges(patientIds, start, end),
      ]);

      const events = eventsResult.status === 'fulfilled' && eventsResult.value.success
        ? eventsResult.value.data : [];
      const actions = actionsResult.status === 'fulfilled' && actionsResult.value.success
        ? actionsResult.value.data : [];
      const changes = changesResult.status === 'fulfilled' && changesResult.value.success
        ? changesResult.value.data : [];

      // Step 3: Call the MCP narrative tool
      const { data, error } = await supabase.functions.invoke('mcp-claude-server', {
        body: {
          method: 'tools/call',
          params: {
            name: 'synthesize-handoff-narrative',
            arguments: {
              unit_id: unitId,
              tenant_id: tenantId,
              shift_start: start,
              shift_end: end,
              patient_ids: patientIds,
              escalation_events: events,
              care_plan_changes: changes,
              pending_actions: actions,
            },
          },
          id: crypto.randomUUID(),
        },
      });

      if (error) {
        return failure('META_TRIAGE_FAILED', `Handoff narrative call failed: ${error.message}`);
      }

      const mcpResponse = data as { result?: { content?: Array<{ text?: string }> } };
      const resultText = mcpResponse?.result?.content?.[0]?.text;
      if (!resultText) {
        return failure('META_TRIAGE_EMPTY', 'Handoff narrative returned empty result');
      }

      const narrative = JSON.parse(resultText) as HandoffNarrativeResult;

      await auditLogger.info('SHIFT_CONTEXT_AGGREGATION_COMPLETE', {
        unitId,
        shiftType,
        totalEvents: events.length,
        pendingActions: actions.length,
        carePlanChanges: changes.length,
        criticalItems: narrative.critical_items.length,
      });

      return success(narrative);
    } catch (err: unknown) {
      await auditLogger.error(
        'SHIFT_CONTEXT_AGGREGATION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { unitId, shiftType }
      );
      return failure('AGGREGATION_FAILED', 'Failed to aggregate shift context');
    }
  },
};
