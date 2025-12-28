// src/services/emsService.ts
// EMS Prehospital Handoff Service
// Handles ambulance → ER communication

import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/getErrorMessage';

export interface PrehospitalHandoff {
  id?: string;
  patient_age?: number;
  patient_gender?: 'M' | 'F' | 'X' | 'U';
  chief_complaint: string;
  scene_location?: string;
  scene_type?: string;
  mechanism_of_injury?: string;
  time_dispatched?: string;
  time_arrived_scene?: string;
  time_left_scene?: string;
  eta_hospital: string;
  vitals?: {
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    heart_rate?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
    temperature?: number;
    glucose?: number;
    gcs_score?: number;
    pain_level?: number;
  };
  signs_symptoms?: string[];
  allergies?: string[];
  medications?: string[];
  past_medical_history?: string[];
  last_oral_intake?: string;
  events_leading?: string;
  treatments_given?: Array<{
    treatment: string;
    time: string;
  }>;
  stroke_alert?: boolean;
  stemi_alert?: boolean;
  trauma_alert?: boolean;
  sepsis_alert?: boolean;
  cardiac_arrest?: boolean;
  alert_notes?: string;
  paramedic_name: string;
  unit_number: string;
  ems_agency?: string;
  receiving_hospital_name: string;
  status?: 'dispatched' | 'on_scene' | 'en_route' | 'arrived' | 'transferred' | 'cancelled';
}

type VitalsPayload = Record<string, unknown>;

export interface IncomingPatient {
  id: string;
  patient_age?: number;
  patient_gender?: string;
  chief_complaint: string;
  eta_hospital: string;
  minutes_until_arrival: number;
  vitals: VitalsPayload;
  stroke_alert: boolean;
  stemi_alert: boolean;
  trauma_alert: boolean;
  sepsis_alert: boolean;
  cardiac_arrest: boolean;
  alert_notes?: string;
  paramedic_name: string;
  unit_number: string;
  receiving_hospital_name?: string;
  status: string;
  created_at: string;
}

type DbRow = Record<string, unknown>;

type DbResult<T> = { data: T | null; error: Error | null };

/**
 * Create a new prehospital handoff (paramedic submits from field)
 */
export async function createPrehospitalHandoff(
  handoff: PrehospitalHandoff
): Promise<DbResult<DbRow>> {
  try {
    const { data, error } = await supabase
      .from('prehospital_handoffs')
      .insert({
        ...handoff,
        status: handoff.status || 'en_route',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return { data: data as DbRow, error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Update existing handoff (update vitals, ETA, etc.)
 */
export async function updatePrehospitalHandoff(
  id: string,
  updates: Partial<PrehospitalHandoff>
): Promise<DbResult<DbRow>> {
  try {
    const { data, error } = await supabase
      .from('prehospital_handoffs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return { data: data as DbRow, error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Get all incoming patients for ER dashboard
 */
export async function getIncomingPatients(
  hospitalName?: string
): Promise<{ data: IncomingPatient[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_incoming_patients', {
      p_hospital_name: hospitalName || null,
    });

    if (error) throw error;

    return { data: data as IncomingPatient[], error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Acknowledge handoff (ER staff confirms receipt)
 */
export async function acknowledgeHandoff(
  handoffId: string,
  notes?: string
): Promise<DbResult<DbRow>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('prehospital_handoffs')
      .update({
        acknowledged_by: user?.id,
        acknowledged_at: new Date().toISOString(),
        acknowledged_notes: notes,
      })
      .eq('id', handoffId)
      .select()
      .single();

    if (error) throw error;

    return { data: data as DbRow, error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Mark patient as arrived at hospital
 */
export async function markPatientArrived(
  handoffId: string
): Promise<DbResult<DbRow>> {
  try {
    const { data, error } = await supabase
      .from('prehospital_handoffs')
      .update({
        status: 'arrived',
        time_arrived_hospital: new Date().toISOString(),
      })
      .eq('id', handoffId)
      .select()
      .single();

    if (error) throw error;

    return { data: data as DbRow, error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

/**
 * Transfer patient to ER (handoff complete)
 */
export async function transferPatientToER(
  handoffId: string,
  receivingNurseId?: string
): Promise<DbResult<DbRow>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('prehospital_handoffs')
      .update({
        status: 'transferred',
        transferred_at: new Date().toISOString(),
        transferred_to_er_by: user?.id,
        receiving_nurse_id: receivingNurseId,
      })
      .eq('id', handoffId)
      .select()
      .single();

    if (error) throw error;

    return { data: data as DbRow, error: null };
  } catch (err: unknown) {
    return { data: null, error: new Error(getErrorMessage(err)) };
  }
}

type RealtimePayload = Record<string, unknown>;

/**
 * Subscribe to incoming patients (real-time updates)
 */
export function subscribeToIncomingPatients(
  hospitalName: string,
  callback: (payload: RealtimePayload) => void
) {
  const subscription = supabase
    .channel('prehospital_handoffs_channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'prehospital_handoffs',
        filter: `receiving_hospital_name=eq.${hospitalName}`,
      },
      callback
    )
    .subscribe();

  return subscription;
}

/**
 * Format vital signs for display
 */
export function formatVitals(vitals: VitalsPayload): string {
  if (!vitals) {
    return 'No vitals recorded';
  }

  const parts: string[] = [];

  if (vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic) {
    parts.push(`BP: ${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}`);
  }

  if (vitals.heart_rate) {
    parts.push(`HR: ${vitals.heart_rate}`);
  }

  if (vitals.respiratory_rate) {
    parts.push(`RR: ${vitals.respiratory_rate}`);
  }

  if (vitals.oxygen_saturation) {
    parts.push(`O2: ${vitals.oxygen_saturation}%`);
  }

  if (vitals.gcs_score) {
    parts.push(`GCS: ${vitals.gcs_score}`);
  }

  return parts.join(' | ') || 'No vitals recorded';
}

/**
 * Determine alert severity
 */
export function getAlertSeverity(handoff: IncomingPatient): 'critical' | 'urgent' | 'routine' {
  if (handoff.cardiac_arrest || handoff.stemi_alert) {
    return 'critical';
  }

  if (handoff.stroke_alert || handoff.trauma_alert || handoff.sepsis_alert) {
    return 'urgent';
  }

  return 'routine';
}

/**
 * Get alert badge text
 */
export function getAlertBadges(handoff: IncomingPatient): string[] {
  const badges: string[] = [];

  if (handoff.cardiac_arrest) badges.push('🚨 CARDIAC ARREST');
  if (handoff.stemi_alert) badges.push('❤️ STEMI');
  if (handoff.stroke_alert) badges.push('🧠 STROKE');
  if (handoff.trauma_alert) badges.push('🏥 TRAUMA');
  if (handoff.sepsis_alert) badges.push('🦠 SEPSIS');

  return badges;
}
