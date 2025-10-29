// Hospital-to-Hospital Transfer Integration Service
// Integrates handoff packets into patient records, encounters, vitals, and billing
// Mirrors emsIntegrationService.ts for consistency

import { supabase } from '../lib/supabaseClient';
import type { HandoffPacket } from '../types/handoff';

export interface HospitalTransferIntegrationResult {
  success: boolean;
  patientId?: string;
  encounterId?: string;
  observationIds?: string[];
  billingCodes?: string[];
  error?: string;
}

/**
 * Main integration function - called when hospital receives and acknowledges a transfer packet
 * Mirrors integrateEMSHandoff from emsIntegrationService.ts
 */
export async function integrateHospitalTransfer(
  packetId: string,
  packet: HandoffPacket
): Promise<HospitalTransferIntegrationResult> {
  try {


    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Step 1: Create or find patient record

    const patientResult = await createOrFindPatient(packet, user.id);
    if (!patientResult.success || !patientResult.patientId) {
      return { success: false, error: `Failed to create patient: ${patientResult.error}` };
    }
    const patientId = patientResult.patientId;

    // Step 2: Create hospital transfer encounter

    const encounterResult = await createTransferEncounter(packetId, patientId, packet, user.id);
    if (!encounterResult.success || !encounterResult.encounterId) {
      return {
        success: false,
        patientId,
        error: `Failed to create encounter: ${encounterResult.error}`
      };
    }
    const encounterId = encounterResult.encounterId;

    // Step 3: Document vitals from transfer packet (if available)

    const vitalResults = await documentTransferVitals(encounterId, patientId, packet, user.id);

    // Step 4: Generate billing codes based on transfer urgency and clinical data

    const billingCodes = await generateBillingCodesFromTransfer(encounterId, packet, user.id);

    // Step 5: Link handoff packet to patient and encounter

    await linkHandoffToPatient(packetId, patientId, encounterId);


    return {
      success: true,
      patientId,
      encounterId,
      observationIds: vitalResults,
      billingCodes,
    };
  } catch (error: any) {

    return {
      success: false,
      error: error.message || 'Unknown error during integration',
    };
  }
}

/**
 * Step 1: Create or find patient record
 */
async function createOrFindPatient(
  packet: HandoffPacket,
  userId: string
): Promise<{ success: boolean; patientId?: string; error?: string }> {
  try {
    // Decrypt patient name and DOB
    const { data: decryptedName, error: nameError } = await supabase.rpc('decrypt_phi_text', {
      encrypted_data: packet.patient_name_encrypted || '',
      encryption_key: null,
    });

    const { data: decryptedDOB, error: dobError } = await supabase.rpc('decrypt_phi_text', {
      encrypted_data: packet.patient_dob_encrypted || '',
      encryption_key: null,
    });

    if (nameError || dobError) {
      throw new Error('Failed to decrypt patient information');
    }

    // Try to find existing patient by MRN
    if (packet.patient_mrn) {
      const { data: existingPatients, error: searchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('mrn', packet.patient_mrn)
        .eq('role_code', 'patient')
        .limit(1);

      if (existingPatients && existingPatients.length > 0) {

        return { success: true, patientId: existingPatients[0].id };
      }
    }

    // Create new patient profile

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        full_name: decryptedName,
        date_of_birth: decryptedDOB,
        mrn: packet.patient_mrn,
        gender: packet.patient_gender,
        role_code: 'patient',
        created_by: userId,
      })
      .select('id')
      .single();

    if (profileError) throw profileError;


    return { success: true, patientId: profile.id };
  } catch (error: any) {

    return { success: false, error: error.message };
  }
}

/**
 * Step 2: Create hospital transfer encounter
 */
async function createTransferEncounter(
  packetId: string,
  patientId: string,
  packet: HandoffPacket,
  userId: string
): Promise<{ success: boolean; encounterId?: string; error?: string }> {
  try {
    // Map urgency level to encounter type
    let encounterType = 'inpatient';
    if (packet.urgency_level === 'critical' || packet.urgency_level === 'emergent') {
      encounterType = 'emergency';
    }

    const { data: encounter, error: encounterError } = await supabase
      .from('encounters')
      .insert({
        patient_id: patientId,
        encounter_type: encounterType,
        status: 'arrived', // Patient arrived via transfer
        chief_complaint: `Transfer from ${packet.sending_facility}: ${packet.reason_for_transfer}`,
        provider_id: userId,
        start_time: new Date().toISOString(),
        location: packet.receiving_facility,
        notes: packet.sender_notes || '',
      })
      .select('id')
      .single();

    if (encounterError) throw encounterError;


    return { success: true, encounterId: encounter.id };
  } catch (error: any) {

    return { success: false, error: error.message };
  }
}

/**
 * Step 3: Document vitals from transfer packet
 */
async function documentTransferVitals(
  encounterId: string,
  patientId: string,
  packet: HandoffPacket,
  userId: string
): Promise<string[]> {
  const observationIds: string[] = [];

  if (!packet.clinical_data?.vitals) {

    return observationIds;
  }

  const vitals = packet.clinical_data.vitals;
  const observations = [];

  // Blood Pressure Systolic (LOINC: 8480-6)
  if (vitals.blood_pressure_systolic) {
    observations.push({
      patient_id: patientId,
      encounter_id: encounterId,
      observation_type: 'vital_sign',
      loinc_code: '8480-6',
      display_name: 'Systolic Blood Pressure',
      value_quantity: vitals.blood_pressure_systolic,
      unit: 'mmHg',
      status: 'final',
      effective_datetime: new Date().toISOString(),
      recorded_by: userId,
      notes: `From transfer: ${packet.sending_facility}`,
    });
  }

  // Blood Pressure Diastolic (LOINC: 8462-4)
  if (vitals.blood_pressure_diastolic) {
    observations.push({
      patient_id: patientId,
      encounter_id: encounterId,
      observation_type: 'vital_sign',
      loinc_code: '8462-4',
      display_name: 'Diastolic Blood Pressure',
      value_quantity: vitals.blood_pressure_diastolic,
      unit: 'mmHg',
      status: 'final',
      effective_datetime: new Date().toISOString(),
      recorded_by: userId,
      notes: `From transfer: ${packet.sending_facility}`,
    });
  }

  // Heart Rate (LOINC: 8867-4)
  if (vitals.heart_rate) {
    observations.push({
      patient_id: patientId,
      encounter_id: encounterId,
      observation_type: 'vital_sign',
      loinc_code: '8867-4',
      display_name: 'Heart Rate',
      value_quantity: vitals.heart_rate,
      unit: 'beats/min',
      status: 'final',
      effective_datetime: new Date().toISOString(),
      recorded_by: userId,
      notes: `From transfer: ${packet.sending_facility}`,
    });
  }

  // Temperature (LOINC: 8310-5)
  if (vitals.temperature) {
    observations.push({
      patient_id: patientId,
      encounter_id: encounterId,
      observation_type: 'vital_sign',
      loinc_code: '8310-5',
      display_name: 'Body Temperature',
      value_quantity: vitals.temperature,
      unit: vitals.temperature_unit || 'F',
      status: 'final',
      effective_datetime: new Date().toISOString(),
      recorded_by: userId,
      notes: `From transfer: ${packet.sending_facility}`,
    });
  }

  // Oxygen Saturation (LOINC: 2708-6)
  if (vitals.oxygen_saturation) {
    observations.push({
      patient_id: patientId,
      encounter_id: encounterId,
      observation_type: 'vital_sign',
      loinc_code: '2708-6',
      display_name: 'Oxygen Saturation',
      value_quantity: vitals.oxygen_saturation,
      unit: '%',
      status: 'final',
      effective_datetime: new Date().toISOString(),
      recorded_by: userId,
      notes: `From transfer: ${packet.sending_facility}`,
    });
  }

  // Respiratory Rate (LOINC: 9279-1)
  if (vitals.respiratory_rate) {
    observations.push({
      patient_id: patientId,
      encounter_id: encounterId,
      observation_type: 'vital_sign',
      loinc_code: '9279-1',
      display_name: 'Respiratory Rate',
      value_quantity: vitals.respiratory_rate,
      unit: 'breaths/min',
      status: 'final',
      effective_datetime: new Date().toISOString(),
      recorded_by: userId,
      notes: `From transfer: ${packet.sending_facility}`,
    });
  }

  // Insert all observations
  if (observations.length > 0) {
    const { data, error } = await supabase
      .from('ehr_observations')
      .insert(observations)
      .select('id');

    if (error) {

    } else if (data) {
      observationIds.push(...data.map((obs) => obs.id));

    }
  }

  return observationIds;
}

/**
 * Step 4: Generate billing codes based on transfer urgency and clinical data
 */
async function generateBillingCodesFromTransfer(
  encounterId: string,
  packet: HandoffPacket,
  userId: string
): Promise<string[]> {
  const billingCodes: Array<{
    encounter_id: string;
    code_type: string;
    code: string;
    description: string;
    created_by: string;
  }> = [];

  // Base hospital admission E/M code based on urgency
  let admissionCode = '99221'; // Initial hospital care, low complexity
  let admissionDesc = 'Initial hospital care, problem focused';

  if (packet.urgency_level === 'critical') {
    admissionCode = '99223'; // Initial hospital care, high complexity
    admissionDesc = 'Initial hospital care, high complexity - critical transfer';
  } else if (packet.urgency_level === 'emergent') {
    admissionCode = '99222'; // Initial hospital care, moderate complexity
    admissionDesc = 'Initial hospital care, moderate complexity - emergent transfer';
  } else if (packet.urgency_level === 'urgent') {
    admissionCode = '99222'; // Initial hospital care, moderate complexity
    admissionDesc = 'Initial hospital care, moderate complexity - urgent transfer';
  }

  billingCodes.push({
    encounter_id: encounterId,
    code_type: 'CPT',
    code: admissionCode,
    description: admissionDesc,
    created_by: userId,
  });

  // Interfacility transfer modifier (if applicable - this would be G0390 for Medicare)
  billingCodes.push({
    encounter_id: encounterId,
    code_type: 'CPT',
    code: 'G0390',
    description: 'Trauma activation - interfacility transfer',
    created_by: userId,
  });

  // Critical care time if critical transfer (99291)
  if (packet.urgency_level === 'critical') {
    billingCodes.push({
      encounter_id: encounterId,
      code_type: 'CPT',
      code: '99291',
      description: 'Critical care, first 30-74 minutes',
      created_by: userId,
    });
  }

  // Insert billing codes
  const { data, error } = await supabase
    .from('billing_codes')
    .insert(billingCodes)
    .select('code');

  if (error) {

    return [];
  }

  const codes = data?.map((bc) => bc.code) || [];

  return codes;
}

/**
 * Step 5: Link handoff packet to patient and encounter
 */
async function linkHandoffToPatient(
  packetId: string,
  patientId: string,
  encounterId: string
): Promise<void> {
  const { error } = await supabase
    .from('handoff_packets')
    .update({
      patient_id: patientId,
      encounter_id: encounterId,
      integrated_at: new Date().toISOString(),
    })
    .eq('id', packetId);

  if (error) {

    throw error;
  }


}

export default {
  integrateHospitalTransfer,
};
