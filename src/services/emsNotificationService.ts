// EMS Department Notification Service
// Handles automatic dispatch of departments when EMS handoff arrives
// (Separate from hospital-to-hospital transfer notifications)

import { supabase } from '../lib/supabaseClient';

export interface DepartmentDispatch {
  id: string;
  handoff_id: string;
  department_code: string;
  department_name: string;
  alert_type: string;
  alert_priority: number;
  dispatch_status: 'pending' | 'notified' | 'acknowledged' | 'mobilized' | 'ready' | 'completed' | 'cancelled';
  dispatched_at: string;
  acknowledged_at?: string;
  ready_at?: string;
  required_actions: string[];
  completed_actions: string[];
  acknowledged_by_name?: string;
  response_notes?: string;
}

export interface CoordinatedResponseStatus {
  department_code: string;
  department_name: string;
  alert_type: string;
  dispatch_status: string;
  dispatched_at: string;
  acknowledged_at?: string;
  ready_at?: string;
  response_time_seconds: number;
  acknowledged_by_name?: string;
  required_actions: any;
  completed_actions: any;
}

/**
 * Get coordinated response status for an EMS handoff
 * Shows which departments were dispatched and their readiness status
 */
export async function getCoordinatedResponseStatus(
  handoffId: string
): Promise<{ data: CoordinatedResponseStatus[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_coordinated_response_status', {
      p_handoff_id: handoffId,
    });

    if (error) throw error;

    return { data: data as CoordinatedResponseStatus[], error: null };
  } catch (err) {

    return { data: null, error: err as Error };
  }
}

/**
 * Acknowledge department dispatch
 * Called by department staff when they receive the alert
 */
export async function acknowledgeDepartmentDispatch(
  dispatchId: string,
  userName?: string,
  userRole?: string,
  notes?: string
): Promise<{ data: any; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc('acknowledge_department_dispatch', {
      p_dispatch_id: dispatchId,
      p_user_id: user?.id,
      p_user_name: userName,
      p_user_role: userRole,
      p_notes: notes,
    });

    if (error) throw error;

    return { data, error: null };
  } catch (err) {

    return { data: null, error: err as Error };
  }
}

/**
 * Mark department as ready
 * Called when department has completed all preparations
 */
export async function markDepartmentReady(
  dispatchId: string,
  completedActions: string[]
): Promise<{ data: any; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('mark_department_ready', {
      p_dispatch_id: dispatchId,
      p_completed_actions: JSON.stringify(completedActions),
    });

    if (error) throw error;

    return { data, error: null };
  } catch (err) {

    return { data: null, error: err as Error };
  }
}

/**
 * Subscribe to department dispatches (real-time updates)
 * Use this to show live updates of department readiness
 */
export function subscribeToDepartmentDispatches(
  handoffId: string,
  callback: (payload: any) => void
) {
  const subscription = supabase
    .channel(`department_dispatches_${handoffId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ems_department_dispatches',
        filter: `handoff_id=eq.${handoffId}`,
      },
      callback
    )
    .subscribe();

  return subscription;
}

/**
 * Provider sign-off on EMS handoff
 * Role-agnostic: supports MD, DO, PA, NP, etc.
 */
export async function createProviderSignoff(signoff: {
  handoffId: string;
  providerName: string;
  providerRole?: string; // 'physician', 'pa', 'np', 'resident'
  providerCredentials?: string; // 'MD', 'DO', 'PA-C', 'NP-C'
  signoffType: 'acceptance' | 'acknowledgement' | 'treatment_plan' | 'final_signoff';
  patientConditionOnArrival?: string;
  initialInterventions?: string[];
  treatmentPlanNotes?: string;
  disposition?: string;
  admittedToService?: string;
  electronicSignature: string; // Provider's typed full name
}): Promise<{ data: any; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('ems_provider_signoffs')
      .insert({
        handoff_id: signoff.handoffId,
        provider_id: user?.id,
        provider_name: signoff.providerName,
        provider_role: signoff.providerRole,
        provider_credentials: signoff.providerCredentials,
        signoff_type: signoff.signoffType,
        patient_condition_on_arrival: signoff.patientConditionOnArrival,
        initial_interventions: signoff.initialInterventions,
        treatment_plan_notes: signoff.treatmentPlanNotes,
        disposition: signoff.disposition,
        admitted_to_service: signoff.admittedToService,
        electronic_signature: signoff.electronicSignature,
        signoff_timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (err) {

    return { data: null, error: err as Error };
  }
}

/**
 * Get provider signoffs for a handoff
 */
export async function getProviderSignoffs(
  handoffId: string
): Promise<{ data: any[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('ems_provider_signoffs')
      .select('*')
      .eq('handoff_id', handoffId)
      .order('signoff_timestamp', { ascending: false });

    if (error) throw error;

    return { data, error: null };
  } catch (err) {

    return { data: null, error: err as Error };
  }
}

/**
 * Send real-time notification to department
 * This would integrate with hospital paging/messaging systems
 */
export async function sendDepartmentNotification(
  departmentCode: string,
  message: string,
  priority: 'routine' | 'urgent' | 'critical'
): Promise<{ data: any; error: Error | null }> {
  try {
    // This would call a Supabase Edge Function that sends:
    // - SMS to department pager
    // - Email to department inbox
    // - Push notification to department app
    // - Integration with hospital paging system (Spok, OnPage, etc.)

    const { data, error } = await supabase.functions.invoke('send-department-alert', {
      body: {
        department_code: departmentCode,
        message,
        priority,
        timestamp: new Date().toISOString(),
      }
    });

    if (error) {

      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {

    return { data: null, error: err as Error };
  }
}

/**
 * Generate notification message based on alert type
 */
export function generateAlertMessage(
  alertType: string,
  eta: string,
  chiefComplaint: string,
  vitals?: any
): string {
  const etaMinutes = Math.round((new Date(eta).getTime() - Date.now()) / 1000 / 60);

  const alertMessages: Record<string, string> = {
    stroke: `🧠 STROKE ALERT - ETA ${etaMinutes} min\n${chiefComplaint}\nActivate stroke team immediately`,
    stemi: `❤️ STEMI ALERT - ETA ${etaMinutes} min\n${chiefComplaint}\nActivate cath lab immediately`,
    trauma: `🏥 TRAUMA ALERT - ETA ${etaMinutes} min\n${chiefComplaint}\nActivate trauma team`,
    sepsis: `🦠 SEPSIS ALERT - ETA ${etaMinutes} min\n${chiefComplaint}\nPrepare broad-spectrum antibiotics`,
    cardiac_arrest: `🚨 CARDIAC ARREST - ETA ${etaMinutes} min\n${chiefComplaint}\nCode team standby`,
    general: `📡 EMS Incoming - ETA ${etaMinutes} min\n${chiefComplaint}`,
  };

  return alertMessages[alertType] || alertMessages.general;
}

/**
 * Get department readiness summary
 */
export function getDepartmentReadinessSummary(
  dispatches: CoordinatedResponseStatus[]
): {
  totalDispatched: number;
  acknowledged: number;
  ready: number;
  pending: number;
  averageResponseTime: number;
} {
  const totalDispatched = dispatches.length;
  const acknowledged = dispatches.filter(d => d.acknowledged_at).length;
  const ready = dispatches.filter(d => d.ready_at).length;
  const pending = dispatches.filter(d => !d.acknowledged_at).length;

  const responseTimes = dispatches
    .filter(d => d.response_time_seconds)
    .map(d => d.response_time_seconds);

  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  return {
    totalDispatched,
    acknowledged,
    ready,
    pending,
    averageResponseTime,
  };
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  getCoordinatedResponseStatus,
  acknowledgeDepartmentDispatch,
  markDepartmentReady,
  subscribeToDepartmentDispatches,
  createProviderSignoff,
  getProviderSignoffs,
  sendDepartmentNotification,
  generateAlertMessage,
  getDepartmentReadinessSummary,
};
