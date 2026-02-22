/**
 * Fetch hospital-specific patient details
 *
 * @module patient-context/fetchHospitalDetails
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type { PatientId, HospitalPatientDetails } from '../../types/patientContext';
import type { ProfileRow, AdmissionRow, FetchResult } from './types';

/**
 * Fetch hospital-specific details (admission, room, bed, acuity)
 */
export async function fetchHospitalDetails(
  patientId: PatientId
): Promise<FetchResult<HospitalPatientDetails>> {
  const fetchedAt = new Date().toISOString();

  try {
    // First get active admission
    const { data: admissionData, error: admissionError } = await supabase
      .from('patient_admissions')
      .select('facility_unit, room_number, admission_date, attending_physician_id, admission_diagnosis, is_active')
      .eq('patient_id', patientId)
      .eq('is_active', true)
      .single();

    // Also get profile hospital fields as fallback
    const { data: profileData } = await supabase
      .from('profiles')
      .select(`
        hospital_unit,
        room_number,
        bed_number,
        acuity_level,
        code_status,
        admission_date,
        attending_physician_id
      `)
      .eq('user_id', patientId)
      .single();

    const profile = profileData as ProfileRow | null;
    const admission = admissionData as AdmissionRow | null;

    // Use admission data if active, otherwise use profile
    const details: HospitalPatientDetails = {
      hospital_unit: admission?.facility_unit ?? profile?.hospital_unit ?? null,
      room_number: admission?.room_number ?? profile?.room_number ?? null,
      bed_number: profile?.bed_number ?? null,
      acuity_level: profile?.acuity_level ?? null,
      code_status: profile?.code_status ?? null,
      admission_date: admission?.admission_date ?? profile?.admission_date ?? null,
      attending_physician_id:
        admission?.attending_physician_id ?? profile?.attending_physician_id ?? null,
      primary_diagnosis: admission?.admission_diagnosis ?? null,
      is_admitted: !admissionError && !!admission,
    };

    return {
      success: true,
      data: details,
      source: {
        source: 'patient_admissions + profiles',
        fetched_at: fetchedAt,
        success: true,
        record_count: admission ? 1 : 0,
        note: admission ? 'Active admission found' : 'No active admission',
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      data: null,
      source: {
        source: 'patient_admissions',
        fetched_at: fetchedAt,
        success: false,
        record_count: 0,
        note: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}
