/**
 * Patient Admission Service
 * Handles admission, discharge, and tracking of hospital patients
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { createAutoRiskScore } from './shiftHandoffService';
import type { ShiftType } from '../types/shiftHandoff';

/**
 * Get current shift type based on time of day
 */
function getCurrentShiftType(): ShiftType {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return 'day';
  if (hour >= 15 && hour < 23) return 'evening';
  return 'night';
}

export interface PatientAdmission {
  patient_id: string;
  room_number: string;
  facility_unit?: string;
  attending_physician_id?: string;
  admission_diagnosis?: string;
}

export interface AdmittedPatient {
  patient_id: string;
  patient_name: string;
  room_number: string | null;
  facility_unit: string | null;
  admission_date: string;
  days_admitted: number;
  attending_physician_id: string | null;
}

/**
 * Admit a patient to the hospital unit
 */
export async function admitPatient(admission: PatientAdmission): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('admit_patient', {
      p_patient_id: admission.patient_id,
      p_room_number: admission.room_number,
      p_facility_unit: admission.facility_unit || null,
      p_attending_physician_id: admission.attending_physician_id || null,
      p_admission_diagnosis: admission.admission_diagnosis || null,
    });

    if (error) {
      await auditLogger.error('PATIENT_ADMISSION_FAILED', error, {
        patientId: admission.patient_id,
        roomNumber: admission.room_number,
        errorCode: error.code
      });
      throw new Error(`Failed to admit patient: ${error.message}`);
    }

    // Generate initial auto-score for newly admitted patient
    try {
      const currentShiftType = getCurrentShiftType();
      await createAutoRiskScore(admission.patient_id, currentShiftType);
      await auditLogger.info('PATIENT_ADMITTED', {
        patientId: admission.patient_id,
        roomNumber: admission.room_number,
        admissionId: data
      });
    } catch (scoreError) {
      // Log but don't fail admission if score generation fails
      await auditLogger.warn('AUTO_SCORE_GENERATION_FAILED_ON_ADMISSION', {
        patientId: admission.patient_id,
        error: (scoreError as Error).message
      });
    }

    return data as string;
  } catch (err) {
    await auditLogger.error('PATIENT_ADMISSION_ERROR', err as Error, {
      patientId: admission.patient_id
    });
    throw err;
  }
}

/**
 * Discharge a patient from the hospital
 */
export async function dischargePatient(
  patientId: string,
  dischargeNotes?: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('discharge_patient', {
      p_patient_id: patientId,
      p_discharge_notes: dischargeNotes || null,
    });

    if (error) {
      await auditLogger.error('PATIENT_DISCHARGE_FAILED', error, {
        patientId,
        errorCode: error.code
      });
      throw new Error(`Failed to discharge patient: ${error.message}`);
    }

    await auditLogger.info('PATIENT_DISCHARGED', {
      patientId,
      hasNotes: !!dischargeNotes
    });

    return data as boolean;
  } catch (err) {
    await auditLogger.error('PATIENT_DISCHARGE_ERROR', err as Error, { patientId });
    throw err;
  }
}

/**
 * Get all currently admitted patients
 */
export async function getAdmittedPatients(): Promise<AdmittedPatient[]> {
  try {
    const { data, error } = await supabase.rpc('get_admitted_patients');

    if (error) {
      await auditLogger.error('GET_ADMITTED_PATIENTS_FAILED', error, {
        errorCode: error.code
      });
      throw new Error(`Failed to get admitted patients: ${error.message}`);
    }

    return (data || []) as AdmittedPatient[];
  } catch (err) {
    await auditLogger.error('GET_ADMITTED_PATIENTS_ERROR', err as Error, {});
    throw err;
  }
}

/**
 * Check if a patient is currently admitted
 */
export async function isPatientAdmitted(patientId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('patient_admissions')
      .select('id')
      .eq('patient_id', patientId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      await auditLogger.error('CHECK_ADMISSION_STATUS_FAILED', error, {
        patientId,
        errorCode: error.code
      });
      return false;
    }

    return !!data;
  } catch (err) {
    await auditLogger.warn('CHECK_ADMISSION_STATUS_ERROR', {
      patientId,
      error: (err as Error).message
    });
    return false;
  }
}

/**
 * Update patient room number
 */
export async function updatePatientRoom(
  patientId: string,
  newRoomNumber: string
): Promise<boolean> {
  try {
    // Update admission record
    const { error: admissionError } = await supabase
      .from('patient_admissions')
      .update({ room_number: newRoomNumber })
      .eq('patient_id', patientId)
      .eq('is_active', true);

    if (admissionError) {
      throw admissionError;
    }

    // Update profile for backward compatibility
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ room_number: newRoomNumber })
      .eq('user_id', patientId);

    if (profileError) {
      throw profileError;
    }

    await auditLogger.info('PATIENT_ROOM_UPDATED', {
      patientId,
      newRoomNumber
    });

    return true;
  } catch (err) {
    await auditLogger.error('UPDATE_PATIENT_ROOM_FAILED', err as Error, {
      patientId,
      newRoomNumber
    });
    throw new Error(`Failed to update room number: ${(err as Error).message}`);
  }
}
