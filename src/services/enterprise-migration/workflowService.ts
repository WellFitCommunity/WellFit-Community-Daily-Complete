/**
 * Enterprise Migration Engine — Workflow Orchestration Service
 *
 * Table dependency management and execution ordering.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { WorkflowStep } from './types';

export class WorkflowOrchestrationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /** Get workflow template by ID or name */
  async getTemplate(templateIdOrName: string): Promise<WorkflowStep[] | null> {
    const { data } = await this.supabase
      .from('migration_workflow_templates')
      .select('workflow_steps')
      .or(`template_id.eq.${templateIdOrName},template_name.eq.${templateIdOrName}`)
      .eq('is_active', true)
      .single();

    if (!data) return null;
    return data.workflow_steps as WorkflowStep[];
  }

  /** Create workflow execution */
  async createExecution(
    batchId: string,
    templateId: string,
    steps: WorkflowStep[]
  ): Promise<string> {
    const executionId = crypto.randomUUID();

    const stepStatuses: Record<string, string> = {};
    steps.forEach(step => {
      stepStatuses[step.table] = 'pending';
    });

    await this.supabase.from('migration_workflow_executions').insert({
      execution_id: executionId,
      migration_batch_id: batchId,
      template_id: templateId,
      status: 'pending',
      step_statuses: stepStatuses,
      current_step: 0,
      total_steps: steps.length
    });

    return executionId;
  }

  /** Get next executable step (all dependencies completed) */
  async getNextStep(executionId: string): Promise<WorkflowStep | null> {
    const { data: execution } = await this.supabase
      .from('migration_workflow_executions')
      .select('execution_id, template_id, step_statuses, status')
      .eq('execution_id', executionId)
      .single();

    if (!execution) return null;

    const { data: template } = await this.supabase
      .from('migration_workflow_templates')
      .select('workflow_steps')
      .eq('template_id', execution.template_id)
      .single();

    if (!template) return null;

    const steps = template.workflow_steps as WorkflowStep[];
    const statuses = execution.step_statuses as Record<string, string>;

    for (const step of steps) {
      // Skip if already completed or in progress
      if (statuses[step.table] !== 'pending') continue;

      // Check if all dependencies are completed
      const depsCompleted = step.dependsOn.every(
        dep => statuses[dep] === 'completed'
      );

      if (depsCompleted) {
        return step;
      }
    }

    return null;
  }

  /** Mark step as completed */
  async completeStep(executionId: string, table: string): Promise<void> {
    const { data: execution } = await this.supabase
      .from('migration_workflow_executions')
      .select('step_statuses, current_step')
      .eq('execution_id', executionId)
      .single();

    if (!execution) return;

    const statuses = execution.step_statuses as Record<string, string>;
    statuses[table] = 'completed';

    const allCompleted = Object.values(statuses).every(s => s === 'completed');

    await this.supabase
      .from('migration_workflow_executions')
      .update({
        step_statuses: statuses,
        current_step: execution.current_step + 1,
        status: allCompleted ? 'completed' : 'running',
        completed_at: allCompleted ? new Date().toISOString() : null
      })
      .eq('execution_id', executionId);
  }
}
