/**
 * Specialist Workflow Engine - Core Engine
 * Executes specialist workflows with offline support and real-time alerting
 */

import {
  SpecialistWorkflow,
  WorkflowContext,
  WorkflowStep,
  FieldVisit,
  SpecialistAlert,
  ConditionEvaluation,
  AlertRule,
  SeverityLevel
} from './types';
import { supabase } from '../../lib/supabaseClient';
import { logPhiAccess } from '../phiAccessLogger';

export class SpecialistWorkflowEngine {
  private workflow: SpecialistWorkflow;
  private context: WorkflowContext | null = null;

  constructor(workflow: SpecialistWorkflow) {
    this.workflow = workflow;
  }

  /**
   * Starts a new field visit
   */
  async startVisit(
    specialistId: string,
    patientId: string,
    visitType: string
  ): Promise<FieldVisit> {
    // HIPAA logging for PHI access
    await logPhiAccess({
      phiType: 'patient_record',
      phiResourceId: patientId,
      patientId,
      accessType: 'view',
      accessMethod: 'UI',
      purpose: 'treatment'
    });

    const visit: Partial<FieldVisit> = {
      specialist_id: specialistId,
      patient_id: patientId,
      visit_type: visitType,
      workflow_template_id: this.workflow.id,
      current_step: 1,
      completed_steps: [],
      data: {},
      photos: [],
      voice_notes: [],
      offline_captured: !navigator.onLine,
      status: 'in_progress',
      created_at: new Date(),
      updated_at: new Date()
    };

    const { data, error } = await supabase
      .from('field_visits')
      .insert(visit)
      .select()
      .single();

    if (error) throw new Error(`Failed to start visit: ${error.message}`);

    return data as FieldVisit;
  }

  /**
   * Records check-in with GPS location
   */
  async checkIn(visitId: string, location?: GeolocationCoordinates): Promise<void> {
    const checkInData: Partial<FieldVisit> = {
      check_in_time: new Date(),
      updated_at: new Date()
    };

    if (location) {
      checkInData.check_in_location = {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      };
    }

    const { error } = await supabase
      .from('field_visits')
      .update(checkInData)
      .eq('id', visitId);

    if (error) throw new Error(`Failed to check in: ${error.message}`);
  }

  /**
   * Records check-out with GPS location
   */
  async checkOut(visitId: string, location?: GeolocationCoordinates): Promise<void> {
    const checkOutData: Partial<FieldVisit> = {
      check_out_time: new Date(),
      status: 'completed',
      updated_at: new Date()
    };

    if (location) {
      checkOutData.check_out_location = {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      };
    }

    const { error } = await supabase
      .from('field_visits')
      .update(checkOutData)
      .eq('id', visitId);

    if (error) throw new Error(`Failed to check out: ${error.message}`);
  }

  /**
   * Captures data for a workflow step
   */
  async captureStepData(
    visitId: string,
    stepNumber: number,
    data: Record<string, any>
  ): Promise<void> {
    // Get current visit
    const { data: visit, error: fetchError } = await supabase
      .from('field_visits')
      .select('*')
      .eq('id', visitId)
      .single();

    if (fetchError) throw new Error(`Failed to fetch visit: ${fetchError.message}`);

    // Merge new data
    const updatedData = {
      ...visit.data,
      [`step_${stepNumber}`]: data
    };

    // Update completed steps
    const completedSteps = [...new Set([...visit.completed_steps, stepNumber])];

    // Calculate next step
    const nextStep = stepNumber + 1;
    const hasMoreSteps = nextStep <= this.workflow.visitWorkflow.length;

    const { error: updateError } = await supabase
      .from('field_visits')
      .update({
        data: updatedData,
        completed_steps: completedSteps,
        current_step: hasMoreSteps ? nextStep : stepNumber,
        updated_at: new Date()
      })
      .eq('id', visitId);

    if (updateError) throw new Error(`Failed to capture data: ${updateError.message}`);

    // Evaluate alert rules with the new data
    await this.evaluateAlertRules(visitId, updatedData);

    // Log PHI access for data capture
    await logPhiAccess({
      phiType: 'patient_record',
      phiResourceId: visitId,
      patientId: visit.patient_id,
      accessType: 'create',
      accessMethod: 'UI',
      purpose: 'treatment'
    });
  }

  /**
   * Evaluates alert rules against collected data
   */
  private async evaluateAlertRules(
    visitId: string,
    data: Record<string, any>
  ): Promise<void> {
    for (const rule of this.workflow.alertRules) {
      const evaluation = this.evaluateCondition(rule.condition, data);

      if (evaluation.result) {
        await this.triggerAlert(visitId, rule, evaluation);
      }
    }
  }

  /**
   * Evaluates a condition string against data
   */
  private evaluateCondition(
    condition: string,
    data: Record<string, any>
  ): ConditionEvaluation {
    try {
      // Parse condition like "BP_SYSTOLIC > 180"
      const match = condition.match(/^(\w+)\s*(>|<|>=|<=|==|!=)\s*(.+)$/);

      if (!match) {
        return { condition, result: false, error: 'Invalid condition format' };
      }

      const [, field, operator, threshold] = match;
      const value = this.extractValue(field, data);

      if (value === undefined || value === null) {
        return { condition, result: false, value };
      }

      let result = false;
      const thresholdNum = parseFloat(threshold);

      switch (operator) {
        case '>':
          result = parseFloat(value) > thresholdNum;
          break;
        case '<':
          result = parseFloat(value) < thresholdNum;
          break;
        case '>=':
          result = parseFloat(value) >= thresholdNum;
          break;
        case '<=':
          result = parseFloat(value) <= thresholdNum;
          break;
        case '==':
          result = value === threshold.replace(/['"]/g, '');
          break;
        case '!=':
          result = value !== threshold.replace(/['"]/g, '');
          break;
      }

      return { condition, result, value };
    } catch (error) {
      return {
        condition,
        result: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extracts a value from nested data object
   */
  private extractValue(path: string, data: Record<string, any>): any {
    const keys = path.split('.');
    let value: any = data;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Triggers an alert
   */
  private async triggerAlert(
    visitId: string,
    rule: AlertRule,
    evaluation: ConditionEvaluation
  ): Promise<void> {
    const alert: Partial<SpecialistAlert> = {
      visit_id: visitId,
      alert_rule_id: rule.id,
      severity: rule.severity,
      triggered_by: { condition: evaluation.condition, value: evaluation.value },
      triggered_at: new Date(),
      notify_role: rule.notifyRole,
      notify_user_id: rule.notifySpecificUser,
      message: rule.message,
      acknowledged: false,
      escalated: false,
      resolved: false
    };

    const { error } = await supabase
      .from('specialist_alerts')
      .insert(alert);

    if (error) {

      return;
    }

    // Send real-time notification
    await this.sendNotification(alert as SpecialistAlert, rule);
  }

  /**
   * Sends real-time notification for alert
   */
  private async sendNotification(
    alert: SpecialistAlert,
    rule: AlertRule
  ): Promise<void> {
    // Get users to notify based on role
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', rule.notifyRole)
      .eq('is_active', true);

    if (error || !users || users.length === 0) {

      return;
    }

    // Send to all users with that role (or specific user if specified)
    const recipients = rule.notifySpecificUser
      ? users.filter(u => u.id === rule.notifySpecificUser)
      : users;

    for (const user of recipients) {
      // Use existing notification system
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: `${rule.severity.toUpperCase()}: ${rule.name}`,
        message: rule.message,
        type: 'specialist_alert',
        severity: rule.severity,
        metadata: {
          alert_id: alert.id,
          visit_id: alert.visit_id,
          triggered_by: alert.triggered_by
        },
        created_at: new Date()
      });
    }
  }

  /**
   * Gets the current workflow step
   */
  getCurrentStep(stepNumber: number): WorkflowStep | undefined {
    return this.workflow.visitWorkflow.find(s => s.step === stepNumber);
  }

  /**
   * Gets all workflow steps
   */
  getAllSteps(): WorkflowStep[] {
    return this.workflow.visitWorkflow;
  }

  /**
   * Validates if a step can be completed
   */
  canCompleteStep(stepNumber: number, data: Record<string, any>): {
    canComplete: boolean;
    missingFields: string[];
  } {
    const step = this.getCurrentStep(stepNumber);

    if (!step) {
      return { canComplete: false, missingFields: [] };
    }

    if (!step.required) {
      return { canComplete: true, missingFields: [] };
    }

    const missingFields: string[] = [];

    if (step.fields) {
      for (const fieldId of step.fields) {
        const field = this.workflow.assessmentFields.find(f => f.id === fieldId);

        if (field?.required && !data[fieldId]) {
          missingFields.push(field.label);
        }
      }
    }

    return {
      canComplete: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Gets workflow progress percentage
   */
  getProgress(completedSteps: number[]): number {
    const totalSteps = this.workflow.visitWorkflow.length;
    const completed = completedSteps.length;
    return Math.round((completed / totalSteps) * 100);
  }
}
