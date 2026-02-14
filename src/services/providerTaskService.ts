/**
 * Provider Task Service — inbox routing, SLA deadlines, escalation
 *
 * Purpose: Manages provider task queue (inbox). Creates tasks with auto-calculated
 * due_at from escalation config, supports acknowledge/complete/escalate lifecycle.
 *
 * Used by: ProviderTaskQueueDashboard, encounter workflows, order lifecycle
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type TaskType =
  | 'result_review'
  | 'order_followup'
  | 'documentation'
  | 'referral_response'
  | 'general';

export type TaskPriority = 'routine' | 'urgent' | 'stat';

export type TaskStatus =
  | 'pending'
  | 'acknowledged'
  | 'in_progress'
  | 'completed'
  | 'escalated'
  | 'cancelled';

export type TaskSourceType = 'system' | 'manual' | 'sla_breach';

export interface ProviderTask {
  id: string;
  encounter_id: string | null;
  patient_id: string | null;
  task_type: TaskType;
  priority: TaskPriority;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  status: TaskStatus;
  due_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completion_notes: string | null;
  escalation_level: number;
  escalated_at: string | null;
  escalated_to: string | null;
  source_type: TaskSourceType;
  source_id: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderTaskQueueRow extends ProviderTask {
  patient_first_name: string | null;
  patient_last_name: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  is_overdue: boolean;
  minutes_past_due: number;
}

export interface EscalationConfig {
  id: string;
  task_type: TaskType;
  priority: TaskPriority;
  target_minutes: number;
  warning_minutes: number | null;
  escalation_1_minutes: number | null;
  escalation_2_minutes: number | null;
  notify_on_warning: boolean;
  notify_on_escalation: boolean;
  is_active: boolean;
  tenant_id: string;
}

export interface CreateTaskInput {
  encounter_id?: string;
  patient_id?: string;
  task_type: TaskType;
  priority: TaskPriority;
  title: string;
  description?: string;
  assigned_to?: string;
  assigned_by?: string;
  due_at?: string;
  source_type?: TaskSourceType;
  source_id?: string;
}

export interface TaskMetrics {
  total_active: number;
  overdue: number;
  escalated: number;
  completed_today: number;
}

export interface TaskQueueFilters {
  assigned_to?: string;
  priority?: TaskPriority;
  task_type?: TaskType;
  status?: TaskStatus;
  overdue_only?: boolean;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const VALID_TASK_TYPES: ReadonlySet<string> = new Set([
  'result_review', 'order_followup', 'documentation', 'referral_response', 'general',
]);

const VALID_PRIORITIES: ReadonlySet<string> = new Set(['routine', 'urgent', 'stat']);

function isTaskType(value: string): value is TaskType {
  return VALID_TASK_TYPES.has(value);
}

function isTaskPriority(value: string): value is TaskPriority {
  return VALID_PRIORITIES.has(value);
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const providerTaskService = {
  /**
   * Create a task. Auto-calculates due_at from escalation config if not provided.
   */
  async createTask(input: CreateTaskInput): Promise<ServiceResult<ProviderTask>> {
    try {
      if (!input.title || !input.task_type) {
        return failure('INVALID_INPUT', 'Title and task_type are required');
      }

      if (!isTaskType(input.task_type)) {
        return failure('VALIDATION_ERROR', `Invalid task_type: ${input.task_type}`);
      }

      if (!isTaskPriority(input.priority)) {
        return failure('VALIDATION_ERROR', `Invalid priority: ${input.priority}`);
      }

      let dueAt = input.due_at ?? null;

      // Auto-calculate due_at from escalation config
      if (!dueAt) {
        const { data: config } = await supabase
          .from('provider_task_escalation_config')
          .select('target_minutes')
          .eq('task_type', input.task_type)
          .eq('priority', input.priority)
          .eq('is_active', true)
          .order('tenant_id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (config) {
          const configRow = config as unknown as { target_minutes: number };
          const dueDate = new Date(Date.now() + configRow.target_minutes * 60 * 1000);
          dueAt = dueDate.toISOString();
        }
      }

      const insertData: Record<string, unknown> = {
        task_type: input.task_type,
        priority: input.priority,
        title: input.title,
        description: input.description ?? null,
        due_at: dueAt,
        source_type: input.source_type ?? 'manual',
        source_id: input.source_id ?? null,
      };

      if (input.encounter_id) insertData.encounter_id = input.encounter_id;
      if (input.patient_id) insertData.patient_id = input.patient_id;
      if (input.assigned_to) {
        insertData.assigned_to = input.assigned_to;
        insertData.assigned_at = new Date().toISOString();
        insertData.assigned_by = input.assigned_by ?? null;
      }

      const { data, error } = await supabase
        .from('provider_tasks')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        await auditLogger.error(
          'PROVIDER_TASK_CREATE_ERROR',
          new Error(error.message),
          { task_type: input.task_type, priority: input.priority }
        );
        return failure('DATABASE_ERROR', error.message);
      }

      await auditLogger.clinical('PROVIDER_TASK_CREATED', true, {
        task_id: (data as ProviderTask).id,
        task_type: input.task_type,
        priority: input.priority,
        assigned_to: input.assigned_to ?? null,
      });

      return success(data as ProviderTask);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_TASK_CREATE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { task_type: input.task_type }
      );
      return failure('UNKNOWN_ERROR', 'Failed to create task');
    }
  },

  /**
   * Assign a task to a provider.
   */
  async assignTask(
    taskId: string,
    assignedTo: string,
    assignedBy: string
  ): Promise<ServiceResult<ProviderTask>> {
    try {
      if (!taskId || !assignedTo || !assignedBy) {
        return failure('INVALID_INPUT', 'Task ID, assignee, and assigner are required');
      }

      const { data, error } = await supabase
        .from('provider_tasks')
        .update({
          assigned_to: assignedTo,
          assigned_at: new Date().toISOString(),
          assigned_by: assignedBy,
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      await auditLogger.clinical('PROVIDER_TASK_ASSIGNED', true, {
        task_id: taskId,
        assigned_to: assignedTo,
        assigned_by: assignedBy,
      });

      return success(data as ProviderTask);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_TASK_ASSIGN_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { task_id: taskId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to assign task');
    }
  },

  /**
   * Acknowledge a task (provider has seen it).
   */
  async acknowledgeTask(
    taskId: string,
    userId: string
  ): Promise<ServiceResult<ProviderTask>> {
    try {
      if (!taskId || !userId) {
        return failure('INVALID_INPUT', 'Task ID and user ID are required');
      }

      const { data, error } = await supabase
        .from('provider_tasks')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userId,
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      await auditLogger.clinical('PROVIDER_TASK_ACKNOWLEDGED', true, {
        task_id: taskId,
        acknowledged_by: userId,
      });

      return success(data as ProviderTask);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_TASK_ACKNOWLEDGE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { task_id: taskId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to acknowledge task');
    }
  },

  /**
   * Complete a task with optional notes.
   */
  async completeTask(
    taskId: string,
    userId: string,
    notes?: string
  ): Promise<ServiceResult<ProviderTask>> {
    try {
      if (!taskId || !userId) {
        return failure('INVALID_INPUT', 'Task ID and user ID are required');
      }

      const { data, error } = await supabase
        .from('provider_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: userId,
          completion_notes: notes ?? null,
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      await auditLogger.clinical('PROVIDER_TASK_COMPLETED', true, {
        task_id: taskId,
        completed_by: userId,
        has_notes: Boolean(notes),
      });

      return success(data as ProviderTask);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_TASK_COMPLETE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { task_id: taskId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to complete task');
    }
  },

  /**
   * Escalate a task to a higher-level provider.
   */
  async escalateTask(
    taskId: string,
    escalatedTo: string,
    level: number
  ): Promise<ServiceResult<ProviderTask>> {
    try {
      if (!taskId || !escalatedTo) {
        return failure('INVALID_INPUT', 'Task ID and escalation target are required');
      }

      const { data, error } = await supabase
        .from('provider_tasks')
        .update({
          status: 'escalated',
          escalation_level: level,
          escalated_at: new Date().toISOString(),
          escalated_to: escalatedTo,
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      await auditLogger.clinical('PROVIDER_TASK_ESCALATED', true, {
        task_id: taskId,
        escalated_to: escalatedTo,
        escalation_level: level,
      });

      return success(data as ProviderTask);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_TASK_ESCALATE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { task_id: taskId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to escalate task');
    }
  },

  /**
   * Get filtered task queue from the enriched view.
   */
  async getTaskQueue(
    filters?: TaskQueueFilters
  ): Promise<ServiceResult<ProviderTaskQueueRow[]>> {
    try {
      let query = supabase
        .from('v_provider_task_queue')
        .select('*')
        .order('due_at', { ascending: true, nullsFirst: false });

      if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.task_type) {
        query = query.eq('task_type', filters.task_type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      } else {
        // Default: exclude completed/cancelled
        query = query.not('status', 'in', '("completed","cancelled")');
      }

      const { data, error } = await query;

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      let rows = (data ?? []) as unknown as ProviderTaskQueueRow[];

      if (filters?.overdue_only) {
        rows = rows.filter(r => r.is_overdue);
      }

      return success(rows);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_TASK_QUEUE_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        {}
      );
      return failure('UNKNOWN_ERROR', 'Failed to fetch task queue');
    }
  },

  /**
   * Get aggregate metrics for the dashboard.
   */
  async getTaskMetrics(): Promise<ServiceResult<TaskMetrics>> {
    try {
      // Active tasks (not completed/cancelled)
      const { count: totalActive, error: activeErr } = await supabase
        .from('provider_tasks')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("completed","cancelled")');

      if (activeErr) {
        return failure('DATABASE_ERROR', activeErr.message);
      }

      // Overdue tasks
      const { count: overdue, error: overdueErr } = await supabase
        .from('provider_tasks')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("completed","cancelled")')
        .not('due_at', 'is', null)
        .lt('due_at', new Date().toISOString());

      if (overdueErr) {
        return failure('DATABASE_ERROR', overdueErr.message);
      }

      // Escalated tasks
      const { count: escalated, error: escErr } = await supabase
        .from('provider_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'escalated');

      if (escErr) {
        return failure('DATABASE_ERROR', escErr.message);
      }

      // Completed today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: completedToday, error: compErr } = await supabase
        .from('provider_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', todayStart.toISOString());

      if (compErr) {
        return failure('DATABASE_ERROR', compErr.message);
      }

      return success({
        total_active: totalActive ?? 0,
        overdue: overdue ?? 0,
        escalated: escalated ?? 0,
        completed_today: completedToday ?? 0,
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_TASK_METRICS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        {}
      );
      return failure('UNKNOWN_ERROR', 'Failed to fetch task metrics');
    }
  },

  /**
   * Get overdue tasks (convenience method).
   */
  async getOverdueTasks(): Promise<ServiceResult<ProviderTaskQueueRow[]>> {
    return this.getTaskQueue({ overdue_only: true });
  },
};

export default providerTaskService;
