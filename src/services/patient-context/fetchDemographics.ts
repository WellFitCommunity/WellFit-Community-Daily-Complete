/**
 * Fetch patient demographics from profiles table
 *
 * @module patient-context/fetchDemographics
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type { PatientId, PatientDemographics } from '../../types/patientContext';
import type { ProfileRow, FetchResult } from './types';

/**
 * Fetch core demographics from profiles table
 */
export async function fetchDemographics(
  patientId: PatientId
): Promise<FetchResult<PatientDemographics>> {
  const fetchedAt = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        user_id,
        first_name,
        last_name,
        dob,
        gender,
        phone,
        preferred_language,
        enrollment_type,
        tenant_id,
        mrn
      `)
      .eq('user_id', patientId)
      .single();

    if (error) {
      return {
        success: false,
        data: null,
        source: {
          source: 'profiles',
          fetched_at: fetchedAt,
          success: false,
          record_count: 0,
          note: error.message,
        },
      };
    }

    const row = data as ProfileRow;

    const demographics: PatientDemographics = {
      patient_id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      dob: row.dob,
      gender: row.gender,
      phone: row.phone,
      preferred_language: row.preferred_language,
      enrollment_type: row.enrollment_type,
      tenant_id: row.tenant_id,
      mrn: row.mrn,
    };

    return {
      success: true,
      data: demographics,
      source: {
        source: 'profiles',
        fetched_at: fetchedAt,
        success: true,
        record_count: 1,
        note: null,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      data: null,
      source: {
        source: 'profiles',
        fetched_at: fetchedAt,
        success: false,
        record_count: 0,
        note: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}
