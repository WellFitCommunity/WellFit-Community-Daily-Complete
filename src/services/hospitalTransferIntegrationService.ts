// Hospital-to-Hospital Transfer Integration Service
// Integrates handoff packets into patient records, encounters, vitals, and billing.
// Rewritten 2026-07-22 against LIVE schema (tracker: ems-and-hospital-transfer-repair-tracker-2026-07-22.md).
// Every write shape here is pinned by __tests__/hospitalTransferWriterShape.test.ts.

import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/getErrorMessage';
import { auditLogger } from './auditLogger';
import type { HandoffPacket } from '../types/handoff';

export interface HospitalTransferIntegrationResult {
  success: boolean;
  patientId?: string;
  encounterId?: string;
  observationIds?: string[];
  billingCodes?: string[];
  error?: string;
}

interface SuggestedCode {
  code: string;
  code_type: string;
  description: string;
  reason: string;
}

/**
 * Main integration function - called when hospital receives and acknowledges a transfer packet.
 */
export async function integrateHospitalTransfer(
  packetId: string,
  packet: HandoffPacket
): Promise<HospitalTransferIntegrationResult> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Tenant comes from the integrating clinician's profile (profiles keys on user_id)
    const { data: callerProfile, error: callerError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();
    if (callerError || !callerProfile?.tenant_id) {
      throw new Error('Could not resolve caller tenant');
    }
    const tenantId = callerProfile.tenant_id;

    // Step 1: Find or create patient record
    const patientResult = await findOrCreatePatient(packetId, packet, tenantId);
    if (!patientResult.success || !patientResult.patientId) {
      return { success: false, error: `Failed to resolve patient: ${patientResult.error}` };
    }
    const patientId = patientResult.patientId;

    // Step 2: Create hospital transfer encounter
    const encounterResult = await createTransferEncounter(patientId, packet, user.id, tenantId);
    if (!encounterResult.success || !encounterResult.encounterId) {
      return {
        success: false,
        patientId,
        error: `Failed to create encounter: ${encounterResult.error}`
      };
    }
    const encounterId = encounterResult.encounterId;

    // Step 3: Document vitals from transfer packet (if available)
    const vitalResults = await documentTransferVitals(encounterId, patientId, packet, tenantId);

    // Step 4: Store ADVISORY billing suggestions (decision D2 — never auto-billed)
    const billingCodes = await storeBillingSuggestions(encounterId, patientId, packet, user.id, tenantId);

    // Step 5: Link handoff packet to patient and encounter
    await linkHandoffToPatient(packetId, patientId, encounterId);

    // HIPAA §164.312(b) - Log PHI access for hospital transfer integration
    await auditLogger.phi('HOSPITAL_TRANSFER_INTEGRATED', patientId, {
      resourceType: 'hospital_transfer',
      action: 'CREATE',
      packetId,
      encounterId,
      vitalsRecorded: vitalResults.length,
      billingCodesSuggested: billingCodes.length,
      sendingFacility: packet.sending_facility,
      receivingFacility: packet.receiving_facility
    });

    return {
      success: true,
      patientId,
      encounterId,
      observationIds: vitalResults,
      billingCodes,
    };
  } catch (error: unknown) {
    await auditLogger.error('HOSPITAL_TRANSFER_INTEGRATION_FAILED',
      error instanceof Error ? error : new Error(String(error)),
      { packetId }
    );
    return {
      success: false,
      error: getErrorMessage(error) || 'Unknown error during integration',
    };
  }
}

/**
 * Step 1: Find patient by MRN within the tenant, or create via the
 * register-transfer-patient edge function (service role — browsers cannot
 * create auth users). Decision D3.
 */
async function findOrCreatePatient(
  packetId: string,
  packet: HandoffPacket,
  tenantId: string
): Promise<{ success: boolean; patientId?: string; error?: string }> {
  try {
    // Try to find existing patient by MRN first (no decryption needed)
    if (packet.patient_mrn) {
      const { data: existingPatients, error: searchError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('mrn', packet.patient_mrn)
        .eq('tenant_id', tenantId)
        .limit(1);

      if (searchError) {
        throw searchError;
      }
      if (existingPatients && existingPatients.length > 0) {
        return { success: true, patientId: existingPatients[0].user_id };
      }
    }

    // Decrypt patient name and DOB — Envision Atlus clinical Vault key (§17).
    const { data: decryptedName, error: nameError } = await supabase.rpc('decrypt_phi_text', {
      encrypted_data: packet.patient_name_encrypted || '',
      use_clinical_key: true,
    });
    const { data: decryptedDOB, error: dobError } = await supabase.rpc('decrypt_phi_text', {
      encrypted_data: packet.patient_dob_encrypted || '',
      use_clinical_key: true,
    });
    if (nameError || dobError) {
      throw new Error('Failed to decrypt patient information');
    }

    // HIPAA §164.312(b) - Log PHI decryption for hospital transfer
    await auditLogger.phi('PATIENT_PHI_DECRYPTED', 'TRANSFER_PATIENT', {
      resourceType: 'encrypted_patient_data',
      action: 'DECRYPT',
      purpose: 'hospital_transfer_integration',
      mrn: packet.patient_mrn || 'unknown'
    });

    const fullName = String(decryptedName ?? '').trim();
    const spaceIdx = fullName.indexOf(' ');
    const firstName = spaceIdx > 0 ? fullName.slice(0, spaceIdx) : fullName || 'Transfer';
    const lastName = spaceIdx > 0 ? fullName.slice(spaceIdx + 1) : 'Patient';

    const { data: registration, error: registerError } = await supabase.functions.invoke(
      'register-transfer-patient',
      {
        body: {
          first_name: firstName,
          last_name: lastName,
          dob: decryptedDOB || null,
          gender: packet.patient_gender || null,
          mrn: packet.patient_mrn || null,
          source: 'hospital_transfer',
          source_reference: packetId,
        },
      }
    );

    if (registerError || !registration?.patient_id) {
      throw new Error(registerError?.message || 'Patient registration failed');
    }

    return { success: true, patientId: registration.patient_id as string };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Step 2: Create hospital transfer encounter (LIVE encounters shape:
 * NOT NULL tenant_id + date_of_service; no start_time/location/notes columns).
 */
async function createTransferEncounter(
  patientId: string,
  packet: HandoffPacket,
  userId: string,
  tenantId: string
): Promise<{ success: boolean; encounterId?: string; error?: string }> {
  try {
    const encounterType =
      packet.urgency_level === 'critical' || packet.urgency_level === 'emergent'
        ? 'emergency'
        : 'inpatient';
    const now = new Date();

    const { data: encounter, error: encounterError } = await supabase
      .from('encounters')
      .insert({
        patient_id: patientId,
        provider_id: userId,
        encounter_type: encounterType,
        status: 'arrived',
        chief_complaint: `Transfer from ${packet.sending_facility}: ${packet.reason_for_transfer}`,
        clinical_notes: packet.sender_notes || null,
        date_of_service: now.toISOString().slice(0, 10),
        arrived_at: now.toISOString(),
        tenant_id: tenantId,
      })
      .select('id')
      .single();

    if (encounterError) throw encounterError;

    await auditLogger.phi('TRANSFER_ENCOUNTER_CREATED', patientId, {
      resourceType: 'encounter',
      action: 'CREATE',
      encounterId: encounter.id,
      encounterType,
      urgencyLevel: packet.urgency_level,
      sendingFacility: packet.sending_facility
    });

    return { success: true, encounterId: encounter.id };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

const VITAL_MAPPINGS: Array<{
  key: keyof NonNullable<NonNullable<HandoffPacket['clinical_data']>['vitals']>;
  code: string;
  display: string;
  unit: string;
}> = [
  { key: 'blood_pressure_systolic', code: '8480-6', display: 'Systolic Blood Pressure', unit: 'mmHg' },
  { key: 'blood_pressure_diastolic', code: '8462-4', display: 'Diastolic Blood Pressure', unit: 'mmHg' },
  { key: 'heart_rate', code: '8867-4', display: 'Heart Rate', unit: 'beats/min' },
  { key: 'temperature', code: '8310-5', display: 'Body Temperature', unit: 'F' },
  { key: 'oxygen_saturation', code: '2708-6', display: 'Oxygen Saturation', unit: '%' },
  { key: 'respiratory_rate', code: '9279-1', display: 'Respiratory Rate', unit: 'breaths/min' },
];

/**
 * Step 3: Document vitals as FHIR observations (LIVE table: fhir_observations,
 * NOT the 7-column ehr_observations jsonb cache).
 */
async function documentTransferVitals(
  encounterId: string,
  patientId: string,
  packet: HandoffPacket,
  tenantId: string
): Promise<string[]> {
  const vitals = packet.clinical_data?.vitals;
  if (!vitals) return [];

  const nowISO = new Date().toISOString();
  const observations = VITAL_MAPPINGS
    .filter((m) => vitals[m.key] !== undefined && vitals[m.key] !== null)
    .map((m) => ({
      patient_id: patientId,
      encounter_id: encounterId,
      tenant_id: tenantId,
      status: 'final',
      category: ['vital-signs'], // live column is text[] (FHIR CodeableConcept array)
      code: m.code,
      code_system: 'http://loinc.org',
      code_display: m.display,
      value_quantity_value: Number(vitals[m.key]),
      value_quantity_unit: m.key === 'temperature' ? (vitals.temperature_unit || m.unit) : m.unit,
      effective_datetime: nowISO,
      sync_source: 'hospital_transfer',
      note: `From transfer: ${packet.sending_facility}`,
    }));

  if (observations.length === 0) return [];

  const { data, error } = await supabase
    .from('fhir_observations')
    .insert(observations)
    .select('id');

  if (error) {
    // Vitals are supplementary — log loudly but do not abort the integration
    await auditLogger.error('TRANSFER_VITALS_WRITE_FAILED', new Error(error.message), {
      encounterId,
      attempted: observations.length,
    });
    return [];
  }

  await auditLogger.phi('TRANSFER_VITALS_CREATED', patientId, {
    resourceType: 'fhir_observations',
    action: 'CREATE',
    encounterId,
    observationCount: data.length,
    source: packet.sending_facility
  });

  return data.map((obs) => obs.id);
}

/**
 * Step 4: Store ADVISORY billing suggestions in encounter_billing_suggestions
 * (decision D2). Urgency-based E/M only; a coder reviews before anything bills.
 * The old unconditional G0390 "trauma activation" was removed as clinically wrong.
 */
async function storeBillingSuggestions(
  encounterId: string,
  patientId: string,
  packet: HandoffPacket,
  userId: string,
  tenantId: string
): Promise<string[]> {
  const suggestions: SuggestedCode[] = [];

  if (packet.urgency_level === 'critical') {
    suggestions.push({
      code: '99223', code_type: 'CPT',
      description: 'Initial hospital care, high complexity',
      reason: 'Critical interfacility transfer',
    });
    suggestions.push({
      code: '99291', code_type: 'CPT',
      description: 'Critical care, first 30-74 minutes',
      reason: 'Critical transfer — confirm critical care time documented',
    });
  } else if (packet.urgency_level === 'emergent' || packet.urgency_level === 'urgent') {
    suggestions.push({
      code: '99222', code_type: 'CPT',
      description: 'Initial hospital care, moderate complexity',
      reason: `${packet.urgency_level} interfacility transfer`,
    });
  } else {
    suggestions.push({
      code: '99221', code_type: 'CPT',
      description: 'Initial hospital care, low complexity',
      reason: 'Routine interfacility transfer',
    });
  }

  const { error } = await supabase
    .from('encounter_billing_suggestions')
    .insert({
      tenant_id: tenantId,
      encounter_id: encounterId,
      patient_id: patientId,
      encounter_start: new Date().toISOString(),
      encounter_type: 'hospital_transfer',
      chief_complaint: `Transfer from ${packet.sending_facility}: ${packet.reason_for_transfer}`,
      suggested_codes: suggestions,
      status: 'pending',
      requires_review: true,
      review_reason: 'Rule-based transfer admission suggestion — coder review required',
      provider_id: userId,
      ai_model_used: 'rule-based-transfer-v1',
    });

  if (error) {
    // Advisory only — log loudly, never block the clinical integration
    await auditLogger.error('TRANSFER_BILLING_SUGGESTION_FAILED', new Error(error.message), {
      encounterId,
    });
    return [];
  }

  return suggestions.map((s) => s.code);
}

/**
 * Step 5: Link handoff packet to patient and encounter (live-correct columns).
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
