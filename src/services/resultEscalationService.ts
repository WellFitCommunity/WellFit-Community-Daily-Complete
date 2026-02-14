/**
 * Result Escalation Service — auto-route abnormal lab values to specialists
 *
 * Purpose: Evaluates lab/diagnostic results against configurable rules, creates
 * escalation log entries, and optionally auto-creates provider tasks with SLA
 * deadlines for specialist review.
 *
 * Used by: ResultEscalationDashboard (admin panel, patient-care category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';
import { providerTaskService } from './providerTaskService';

// =============================================================================
// TYPES
// =============================================================================

export type EscalationSeverity = 'critical' | 'high' | 'moderate' | 'low';
export type EscalationStatus = 'pending' | 'routed' | 'acknowledged' | 'resolved' | 'expired';
export type RuleCondition = 'above' | 'below' | 'outside_range';

export interface EscalationRule {
  id: string;
  test_name: string;
  display_name: string;
  condition: RuleCondition;
  threshold_high: number | null;
  threshold_low: number | null;
  severity: EscalationSeverity;
  route_to_specialty: string;
  target_minutes: number;
  escalation_1_minutes: number | null;
  escalation_2_minutes: number | null;
  auto_create_task: boolean;
  notification_channels: string[];
  clinical_guidance: string | null;
  is_active: boolean;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscalationLogEntry {
  id: string;
  rule_id: string;
  result_id: string;
  result_source: string;
  patient_id: string;
  test_name: string;
  test_value: number;
  test_unit: string | null;
  severity: string;
  route_to_specialty: string;
  routed_to_provider_id: string | null;
  task_id: string | null;
  escalation_status: EscalationStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  tenant_id: string;
  created_at: string;
}

export interface EscalationMetrics {
  total_active: number;
  critical_count: number;
  high_count: number;
  routed_count: number;
  resolved_today: number;
  rules_active: number;
}

export interface EscalationFilters {
  severity?: EscalationSeverity;
  status?: EscalationStatus;
  patient_id?: string;
}

export interface CreateRuleInput {
  test_name: string;
  display_name: string;
  condition: RuleCondition;
  threshold_high?: number | null;
  threshold_low?: number | null;
  severity: EscalationSeverity;
  route_to_specialty: string;
  target_minutes: number;
  escalation_1_minutes?: number | null;
  escalation_2_minutes?: number | null;
  auto_create_task?: boolean;
  notification_channels?: string[];
  clinical_guidance?: string;
  tenant_id?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const SEVERITY_PRIORITY_MAP: Record<EscalationSeverity, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
};

function severityToTaskPriority(severity: EscalationSeverity): 'stat' | 'urgent' | 'routine' {
  if (severity === 'critical') return 'stat';
  if (severity === 'high') return 'urgent';
  return 'routine';
}

function doesValueTriggerRule(value: number, rule: EscalationRule): boolean {
  switch (rule.condition) {
    case 'above':
      return rule.threshold_high !== null && value > rule.threshold_high;
    case 'below':
      return rule.threshold_low !== null && value < rule.threshold_low;
    case 'outside_range':
      return (
        (rule.threshold_high !== null && value > rule.threshold_high) ||
        (rule.threshold_low !== null && value < rule.threshold_low)
      );
    default:
      return false;
  }
}

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Fetch active escalation rules (global defaults + tenant-specific).
 */
async function getRules(tenantId?: string): Promise<ServiceResult<EscalationRule[]>> {
  try {
    let query = supabase
      .from('result_escalation_rules')
      .select('*')
      .eq('is_active', true)
      .order('test_name', { ascending: true });

    if (tenantId) {
      query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    }

    const { data, error } = await query;

    if (error) {
      await auditLogger.error('ESCALATION_RULES_FETCH_FAILED', new Error(error.message));
      return failure('DATABASE_ERROR', 'Failed to load escalation rules');
    }

    return success((data ?? []) as unknown as EscalationRule[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ESCALATION_RULES_FETCH_FAILED', error);
    return failure('UNKNOWN_ERROR', 'Failed to load escalation rules');
  }
}

/**
 * Evaluate a lab result against all active rules.
 * Returns matched rules sorted by severity (critical first).
 */
async function evaluateResult(
  testName: string,
  value: number,
  unit: string | null,
  patientId: string,
  resultId: string,
  resultSource: 'lab_results' | 'fhir_diagnostic_reports',
  tenantId: string
): Promise<ServiceResult<EscalationRule[]>> {
  try {
    const rulesResult = await getRules(tenantId);
    if (!rulesResult.success) {
      return failure(rulesResult.error.code, rulesResult.error.message);
    }

    const matchedRules = rulesResult.data
      .filter(rule => rule.test_name === testName && doesValueTriggerRule(value, rule))
      .sort((a, b) => SEVERITY_PRIORITY_MAP[a.severity] - SEVERITY_PRIORITY_MAP[b.severity]);

    // Create escalation entries for each matched rule
    for (const rule of matchedRules) {
      await createEscalation(
        rule.id,
        resultId,
        resultSource,
        patientId,
        testName,
        value,
        unit,
        rule.severity,
        rule.route_to_specialty,
        tenantId,
        rule.auto_create_task,
        rule.display_name
      );
    }

    return success(matchedRules);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('RESULT_EVALUATION_FAILED', error, {
      testName, value, patientId,
    });
    return failure('UNKNOWN_ERROR', 'Failed to evaluate result');
  }
}

/**
 * Create an escalation log entry and optionally a provider task.
 */
async function createEscalation(
  ruleId: string,
  resultId: string,
  resultSource: string,
  patientId: string,
  testName: string,
  value: number,
  unit: string | null,
  severity: string,
  specialty: string,
  tenantId: string,
  autoCreateTask: boolean = true,
  displayName?: string
): Promise<ServiceResult<EscalationLogEntry>> {
  try {
    const insertData: Record<string, unknown> = {
      rule_id: ruleId,
      result_id: resultId,
      result_source: resultSource,
      patient_id: patientId,
      test_name: testName,
      test_value: value,
      test_unit: unit,
      severity,
      route_to_specialty: specialty,
      escalation_status: 'pending',
      tenant_id: tenantId,
    };

    const { data, error } = await supabase
      .from('result_escalation_log')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      await auditLogger.error('ESCALATION_CREATE_FAILED', new Error(error.message), {
        ruleId, testName, value,
      });
      return failure('DATABASE_ERROR', 'Failed to create escalation entry');
    }

    const logEntry = data as unknown as EscalationLogEntry;

    // Auto-create provider task if enabled
    if (autoCreateTask) {
      const taskResult = await providerTaskService.createTask({
        patient_id: patientId,
        task_type: 'result_review',
        priority: severityToTaskPriority(severity as EscalationSeverity),
        title: `Abnormal ${displayName ?? testName}: ${value}${unit ? ' ' + unit : ''} — Route to ${specialty}`,
        description: `Auto-escalated: ${testName} = ${value}. Severity: ${severity}. Review required.`,
        source_type: 'system',
        source_id: logEntry.id,
      });

      if (taskResult.success) {
        // Update log entry with task reference
        await supabase
          .from('result_escalation_log')
          .update({ task_id: taskResult.data.id, escalation_status: 'routed' })
          .eq('id', logEntry.id);

        logEntry.task_id = taskResult.data.id;
        logEntry.escalation_status = 'routed';
      }
    }

    await auditLogger.clinical('RESULT_ESCALATION_CREATED', true, {
      escalation_id: logEntry.id,
      rule_id: ruleId,
      test_name: testName,
      test_value: value,
      severity,
      specialty,
      patient_id: patientId,
      auto_task_created: autoCreateTask,
    });

    return success(logEntry);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ESCALATION_CREATE_FAILED', error, { ruleId, testName });
    return failure('UNKNOWN_ERROR', 'Failed to create escalation');
  }
}

/**
 * Get active escalation log entries with optional filters.
 */
async function getActiveEscalations(
  filters?: EscalationFilters
): Promise<ServiceResult<EscalationLogEntry[]>> {
  try {
    let query = supabase
      .from('result_escalation_log')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.severity) {
      query = query.eq('severity', filters.severity);
    }
    if (filters?.status) {
      query = query.eq('escalation_status', filters.status);
    } else {
      query = query.not('escalation_status', 'in', '("resolved","expired")');
    }
    if (filters?.patient_id) {
      query = query.eq('patient_id', filters.patient_id);
    }

    const { data, error } = await query;

    if (error) {
      await auditLogger.error('ESCALATION_LOG_FETCH_FAILED', new Error(error.message));
      return failure('DATABASE_ERROR', 'Failed to load escalations');
    }

    return success((data ?? []) as unknown as EscalationLogEntry[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ESCALATION_LOG_FETCH_FAILED', error);
    return failure('UNKNOWN_ERROR', 'Failed to load escalations');
  }
}

/**
 * Resolve an escalation with notes.
 */
async function resolveEscalation(
  escalationId: string,
  userId: string,
  notes: string
): Promise<ServiceResult<EscalationLogEntry>> {
  try {
    if (!escalationId || !userId) {
      return failure('INVALID_INPUT', 'Escalation ID and user ID are required');
    }

    const { data, error } = await supabase
      .from('result_escalation_log')
      .update({
        escalation_status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_notes: notes,
      })
      .eq('id', escalationId)
      .select()
      .single();

    if (error) {
      await auditLogger.error('ESCALATION_RESOLVE_FAILED', new Error(error.message), {
        escalationId,
      });
      return failure('DATABASE_ERROR', 'Failed to resolve escalation');
    }

    await auditLogger.clinical('RESULT_ESCALATION_RESOLVED', true, {
      escalation_id: escalationId,
      resolved_by: userId,
    });

    return success(data as unknown as EscalationLogEntry);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ESCALATION_RESOLVE_FAILED', error, { escalationId });
    return failure('UNKNOWN_ERROR', 'Failed to resolve escalation');
  }
}

/**
 * Get aggregate metrics for the escalation dashboard.
 */
async function getEscalationMetrics(): Promise<ServiceResult<EscalationMetrics>> {
  try {
    // Active escalations (not resolved/expired)
    const { data: activeData, error: activeErr } = await supabase
      .from('result_escalation_log')
      .select('severity, escalation_status')
      .not('escalation_status', 'in', '("resolved","expired")');

    if (activeErr) {
      return failure('DATABASE_ERROR', activeErr.message);
    }

    const activeRows = (activeData ?? []) as unknown as { severity: string; escalation_status: string }[];

    const critical_count = activeRows.filter(r => r.severity === 'critical').length;
    const high_count = activeRows.filter(r => r.severity === 'high').length;
    const routed_count = activeRows.filter(r => r.escalation_status === 'routed').length;

    // Resolved today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: resolvedToday, error: resolvedErr } = await supabase
      .from('result_escalation_log')
      .select('*', { count: 'exact', head: true })
      .eq('escalation_status', 'resolved')
      .gte('resolved_at', todayStart.toISOString());

    if (resolvedErr) {
      return failure('DATABASE_ERROR', resolvedErr.message);
    }

    // Active rules count
    const { count: rulesActive, error: rulesErr } = await supabase
      .from('result_escalation_rules')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (rulesErr) {
      return failure('DATABASE_ERROR', rulesErr.message);
    }

    return success({
      total_active: activeRows.length,
      critical_count,
      high_count,
      routed_count,
      resolved_today: resolvedToday ?? 0,
      rules_active: rulesActive ?? 0,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ESCALATION_METRICS_FAILED', error);
    return failure('UNKNOWN_ERROR', 'Failed to load escalation metrics');
  }
}

/**
 * Create a new escalation rule.
 */
async function createRule(input: CreateRuleInput): Promise<ServiceResult<EscalationRule>> {
  try {
    if (!input.test_name || !input.display_name || !input.route_to_specialty) {
      return failure('INVALID_INPUT', 'Test name, display name, and specialty are required');
    }

    const { data, error } = await supabase
      .from('result_escalation_rules')
      .insert({
        test_name: input.test_name,
        display_name: input.display_name,
        condition: input.condition,
        threshold_high: input.threshold_high ?? null,
        threshold_low: input.threshold_low ?? null,
        severity: input.severity,
        route_to_specialty: input.route_to_specialty,
        target_minutes: input.target_minutes,
        escalation_1_minutes: input.escalation_1_minutes ?? null,
        escalation_2_minutes: input.escalation_2_minutes ?? null,
        auto_create_task: input.auto_create_task ?? true,
        notification_channels: input.notification_channels ?? ['inbox'],
        clinical_guidance: input.clinical_guidance ?? null,
        tenant_id: input.tenant_id ?? null,
      })
      .select()
      .single();

    if (error) {
      await auditLogger.error('ESCALATION_RULE_CREATE_FAILED', new Error(error.message));
      return failure('DATABASE_ERROR', 'Failed to create escalation rule');
    }

    await auditLogger.clinical('ESCALATION_RULE_CREATED', true, {
      rule_id: (data as unknown as EscalationRule).id,
      test_name: input.test_name,
      severity: input.severity,
    });

    return success(data as unknown as EscalationRule);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ESCALATION_RULE_CREATE_FAILED', error);
    return failure('UNKNOWN_ERROR', 'Failed to create escalation rule');
  }
}

/**
 * Update an existing escalation rule.
 */
async function updateRule(
  ruleId: string,
  updates: Partial<CreateRuleInput>
): Promise<ServiceResult<EscalationRule>> {
  try {
    if (!ruleId) {
      return failure('INVALID_INPUT', 'Rule ID is required');
    }

    const { data, error } = await supabase
      .from('result_escalation_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      await auditLogger.error('ESCALATION_RULE_UPDATE_FAILED', new Error(error.message), {
        ruleId,
      });
      return failure('DATABASE_ERROR', 'Failed to update escalation rule');
    }

    await auditLogger.clinical('ESCALATION_RULE_UPDATED', true, { rule_id: ruleId });

    return success(data as unknown as EscalationRule);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ESCALATION_RULE_UPDATE_FAILED', error, { ruleId });
    return failure('UNKNOWN_ERROR', 'Failed to update escalation rule');
  }
}

/**
 * Toggle a rule active/inactive.
 */
async function toggleRule(
  ruleId: string,
  isActive: boolean
): Promise<ServiceResult<EscalationRule>> {
  try {
    if (!ruleId) {
      return failure('INVALID_INPUT', 'Rule ID is required');
    }

    const { data, error } = await supabase
      .from('result_escalation_rules')
      .update({ is_active: isActive })
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to toggle rule');
    }

    await auditLogger.clinical('ESCALATION_RULE_TOGGLED', true, {
      rule_id: ruleId,
      is_active: isActive,
    });

    return success(data as unknown as EscalationRule);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ESCALATION_RULE_TOGGLE_FAILED', error, { ruleId });
    return failure('UNKNOWN_ERROR', 'Failed to toggle rule');
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const resultEscalationService = {
  getRules,
  evaluateResult,
  createEscalation,
  getActiveEscalations,
  resolveEscalation,
  getEscalationMetrics,
  createRule,
  updateRule,
  toggleRule,
};
