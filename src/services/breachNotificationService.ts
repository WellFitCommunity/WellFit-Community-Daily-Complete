/**
 * Breach Notification Service
 *
 * Purpose: Manage HIPAA breach incidents and notifications
 * Regulation: 45 CFR 164.400-414 (Breach Notification Rule)
 * Features: Incident reporting, 4-factor risk assessment, notification planning
 *
 * @module services/breachNotificationService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type BreachStatus =
  | 'reported'
  | 'investigating'
  | 'risk_assessment'
  | 'notification_required'
  | 'notification_in_progress'
  | 'resolved'
  | 'closed_no_notification';

export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical';

export type BreachType =
  | 'unauthorized_access'
  | 'unauthorized_disclosure'
  | 'loss'
  | 'theft'
  | 'improper_disposal'
  | 'hacking'
  | 'other';

export type RiskAssessmentResult = 'low_probability' | 'notification_required';

export interface BreachIncident {
  id: string;
  tenant_id: string;
  incident_number: string;
  title: string;
  description: string;
  discovered_date: string;
  occurred_date: string | null;
  reported_by: string | null;
  status: BreachStatus;
  severity: BreachSeverity;
  phi_types_involved: string[];
  individuals_affected: number;
  breach_type: BreachType;
  risk_assessment_result: RiskAssessmentResult | null;
  risk_assessed_at: string | null;
  notification_plan_created: boolean;
  hhs_notification_required: boolean;
  hhs_notified_at: string | null;
  media_notification_required: boolean;
  media_notified_at: string | null;
  individual_notification_deadline: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBreachRequest {
  title: string;
  description: string;
  breach_type: BreachType;
  severity: BreachSeverity;
  phi_types_involved: string[];
  individuals_affected: number;
  occurred_date?: string;
}

export interface RiskAssessmentInput {
  breach_incident_id: string;
  factor_1_nature_of_phi: Record<string, unknown>;
  factor_2_unauthorized_person: Record<string, unknown>;
  factor_3_acquired_or_viewed: Record<string, unknown>;
  factor_4_mitigation: Record<string, unknown>;
  overall_risk_level: RiskAssessmentResult;
  rationale: string;
}

export interface BreachNotification {
  id: string;
  breach_incident_id: string;
  notification_type: 'individual' | 'hhs' | 'media' | 'state_attorney_general';
  recipient_description: string | null;
  channel: string;
  sent_at: string | null;
  delivery_status: string;
  content_summary: string | null;
  created_at: string;
}

export interface NotificationPlan {
  individual_notifications_needed: boolean;
  hhs_notification_needed: boolean;
  media_notification_needed: boolean;
  deadline: string;
  individuals_affected: number;
}

// =============================================================================
// SERVICE
// =============================================================================

async function getTenantId(): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single();
  return data?.tenant_id ?? null;
}

/**
 * Report a new breach incident
 */
export async function reportBreach(
  request: CreateBreachRequest
): Promise<ServiceResult<BreachIncident>> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return failure('UNAUTHORIZED', 'No tenant context');

    const user = (await supabase.auth.getUser()).data.user;

    const { data, error } = await supabase
      .from('breach_incidents')
      .insert({
        tenant_id: tenantId,
        incident_number: '',
        title: request.title,
        description: request.description,
        breach_type: request.breach_type,
        severity: request.severity,
        phi_types_involved: request.phi_types_involved,
        individuals_affected: request.individuals_affected,
        occurred_date: request.occurred_date ?? null,
        reported_by: user?.id,
        status: 'reported',
      })
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.security('BREACH_INCIDENT_REPORTED', 'critical', {
      incidentId: data.id,
      severity: request.severity,
      affectedCount: request.individuals_affected,
    });

    return success(data as BreachIncident);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BREACH_REPORT_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to report breach incident');
  }
}

/**
 * Get all breach incidents for the current tenant
 */
export async function listBreachIncidents(): Promise<ServiceResult<BreachIncident[]>> {
  try {
    const { data, error } = await supabase
      .from('breach_incidents')
      .select('*')
      .order('discovered_date', { ascending: false });

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success((data ?? []) as BreachIncident[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BREACH_LIST_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to list breach incidents');
  }
}

/**
 * Get a single breach incident by ID
 */
export async function getBreachIncident(
  incidentId: string
): Promise<ServiceResult<BreachIncident>> {
  try {
    const { data, error } = await supabase
      .from('breach_incidents')
      .select('*')
      .eq('id', incidentId)
      .single();

    if (error) return failure('NOT_FOUND', 'Breach incident not found', error);
    return success(data as BreachIncident);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BREACH_GET_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to get breach incident');
  }
}

/**
 * Submit a 4-factor risk assessment for a breach incident
 * Per 45 CFR 164.402(2): Determines if notification is required
 */
export async function assessBreachRisk(
  input: RiskAssessmentInput
): Promise<ServiceResult<{ riskLevel: RiskAssessmentResult }>> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return failure('UNAUTHORIZED', 'No tenant context');

    const user = (await supabase.auth.getUser()).data.user;

    // Record the assessment
    const { error: assessError } = await supabase
      .from('breach_risk_assessments')
      .insert({
        breach_incident_id: input.breach_incident_id,
        tenant_id: tenantId,
        assessed_by: user?.id,
        factor_1_nature_of_phi: input.factor_1_nature_of_phi,
        factor_2_unauthorized_person: input.factor_2_unauthorized_person,
        factor_3_acquired_or_viewed: input.factor_3_acquired_or_viewed,
        factor_4_mitigation: input.factor_4_mitigation,
        overall_risk_level: input.overall_risk_level,
        rationale: input.rationale,
      });

    if (assessError) return failure('DATABASE_ERROR', assessError.message, assessError);

    // Update the incident with assessment results
    const newStatus: BreachStatus =
      input.overall_risk_level === 'notification_required'
        ? 'notification_required'
        : 'closed_no_notification';

    const { error: updateError } = await supabase
      .from('breach_incidents')
      .update({
        risk_assessment_result: input.overall_risk_level,
        risk_assessed_by: user?.id,
        risk_assessed_at: new Date().toISOString(),
        status: newStatus,
      })
      .eq('id', input.breach_incident_id);

    if (updateError) return failure('DATABASE_ERROR', updateError.message, updateError);

    await auditLogger.security('BREACH_RISK_ASSESSED', 'high', {
      incidentId: input.breach_incident_id,
      riskLevel: input.overall_risk_level,
    });

    return success({ riskLevel: input.overall_risk_level });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BREACH_RISK_ASSESSMENT_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to assess breach risk');
  }
}

/**
 * Generate a notification plan based on breach details
 * 45 CFR 164.404-408: Individual, HHS, and media notifications
 */
export async function generateNotificationPlan(
  incidentId: string
): Promise<ServiceResult<NotificationPlan>> {
  try {
    const incidentResult = await getBreachIncident(incidentId);
    if (!incidentResult.success) return incidentResult;

    const incident = incidentResult.data;
    const deadline = new Date(incident.discovered_date);
    deadline.setDate(deadline.getDate() + 60);

    const plan: NotificationPlan = {
      individual_notifications_needed: true,
      hhs_notification_needed: true,
      media_notification_needed: incident.individuals_affected >= 500,
      deadline: deadline.toISOString(),
      individuals_affected: incident.individuals_affected,
    };

    // Update the incident with notification plan
    const { error } = await supabase
      .from('breach_incidents')
      .update({
        notification_plan_created: true,
        hhs_notification_required: plan.hhs_notification_needed,
        media_notification_required: plan.media_notification_needed,
        individual_notification_deadline: plan.deadline,
      })
      .eq('id', incidentId);

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.info('BREACH_NOTIFICATION_PLAN_CREATED', {
      incidentId,
      mediaRequired: plan.media_notification_needed,
      affectedCount: plan.individuals_affected,
    });

    return success(plan);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BREACH_NOTIFICATION_PLAN_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to generate notification plan');
  }
}

/**
 * Get notifications for a breach incident
 */
export async function getBreachNotifications(
  incidentId: string
): Promise<ServiceResult<BreachNotification[]>> {
  try {
    const { data, error } = await supabase
      .from('breach_notifications')
      .select('*')
      .eq('breach_incident_id', incidentId)
      .order('created_at', { ascending: false });

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success((data ?? []) as BreachNotification[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BREACH_NOTIFICATIONS_FETCH_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to get breach notifications');
  }
}

/**
 * Update breach incident status
 */
export async function updateBreachStatus(
  incidentId: string,
  status: BreachStatus,
  notes?: string
): Promise<ServiceResult<BreachIncident>> {
  try {
    const updates: Record<string, unknown> = { status };
    if (status === 'resolved') {
      const user = (await supabase.auth.getUser()).data.user;
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = user?.id;
      updates.resolution_notes = notes ?? null;
    }

    const { data, error } = await supabase
      .from('breach_incidents')
      .update(updates)
      .eq('id', incidentId)
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.security('BREACH_STATUS_UPDATED', 'high', {
      incidentId,
      newStatus: status,
    });

    return success(data as BreachIncident);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BREACH_STATUS_UPDATE_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to update breach status');
  }
}

export const breachNotificationService = {
  reportBreach,
  listBreachIncidents,
  getBreachIncident,
  assessBreachRisk,
  generateNotificationPlan,
  getBreachNotifications,
  updateBreachStatus,
};
