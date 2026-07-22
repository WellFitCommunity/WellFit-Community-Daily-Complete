// EMS Integration Service
// Connects EMS handoffs to the rest of the healthcare platform.
// Rewritten 2026-07-22 against LIVE schema (tracker: ems-and-hospital-transfer-repair-tracker-2026-07-22.md).
// Patient creation goes through the register-transfer-patient edge function
// (decision D3) — browsers can never call auth.admin.createUser.
// Every write shape here is pinned by __tests__/emsWriterShape.test.ts.

import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/getErrorMessage';
import { auditLogger } from './auditLogger';
import type { PrehospitalHandoff } from './emsService';

export interface EMSIntegrationResult {
  success: boolean;
  patientId?: string;
  encounterId?: string;
  observationIds?: string[];
  billingCodes?: Array<{ code: string; code_type?: string; description: string; suggested_by?: string }>;
  error?: string;
}

/**
 * Complete EMS handoff integration.
 * Called when the ER transfers the arrived patient into the chart.
 */
export async function integrateEMSHandoff(
  handoffId: string,
  handoffData: PrehospitalHandoff
): Promise<EMSIntegrationResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'No authenticated user' };
    }

    const { data: callerProfile, error: callerError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();
    if (callerError || !callerProfile?.tenant_id) {
      return { success: false, error: 'Could not resolve caller tenant' };
    }
    const tenantId = callerProfile.tenant_id;

    // Step 1: Register a temp patient record via the service-role edge function
    const patientResult = await registerEMSPatient(handoffId, handoffData);
    if (!patientResult.success || !patientResult.patientId) {
      return { success: false, error: patientResult.error || 'Failed to create patient' };
    }
    const patientId = patientResult.patientId;

    // Step 2: Create ER encounter (LIVE encounters shape)
    const encounterResult = await createEREncounter(patientId, handoffData, user.id, tenantId);
    if (!encounterResult.success || !encounterResult.encounterId) {
      return { success: false, error: encounterResult.error || 'Failed to create encounter' };
    }
    const encounterId = encounterResult.encounterId;

    // Step 3: Document EMS vitals as FHIR observations
    const vitalResults = await documentEMSVitals(encounterId, patientId, handoffData, tenantId);

    // Step 4: Store ADVISORY billing suggestions (decision D2)
    const billingCodes = await storeBillingSuggestions(encounterId, patientId, handoffData, user.id, tenantId);

    // Step 5: Link handoff to patient/encounter
    await linkHandoffToPatient(handoffId, patientId, encounterId);

    auditLogger.clinical('EMS_HANDOFF_INTEGRATED', true, {
      handoffId,
      patientId,
      encounterId,
      vitalsRecorded: vitalResults.length,
      billingCodesSuggested: billingCodes.length,
    });

    // HIPAA §164.312(b) - Log PHI access for EMS handoff integration
    await auditLogger.phi('EMS_HANDOFF_PHI_ACCESS', patientId, {
      resourceType: 'ems_handoff',
      action: 'CREATE',
      handoffId,
      encounterId,
      vitalsRecorded: vitalResults.length,
      billingCodesSuggested: billingCodes.length,
      emsUnit: handoffData.unit_number,
      emsAgency: handoffData.ems_agency
    });

    return {
      success: true,
      patientId,
      encounterId,
      observationIds: vitalResults,
      billingCodes,
    };
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    auditLogger.error('EMS_INTEGRATION_FAILED', new Error(errorMessage), { handoffId });
    return { success: false, error: errorMessage };
  }
}

/**
 * Step 1: Register a temp patient for the EMS arrival (identity usually unknown
 * at the door). The record is flagged is_temp_record for later MPI merge.
 */
async function registerEMSPatient(
  handoffId: string,
  handoff: PrehospitalHandoff
): Promise<{ success: boolean; patientId?: string; error?: string }> {
  try {
    // Estimated DOB from EMS-reported age (clinically useful for dosing/protocols)
    let estimatedDob: string | null = null;
    if (handoff.patient_age) {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - handoff.patient_age);
      estimatedDob = dob.toISOString().slice(0, 10);
    }

    const { data: registration, error: registerError } = await supabase.functions.invoke(
      'register-transfer-patient',
      {
        body: {
          first_name: `EMS-${handoff.unit_number}`,
          last_name: 'Unidentified',
          dob: estimatedDob,
          gender: handoff.patient_gender || 'U',
          mrn: null,
          source: 'ems',
          source_reference: handoffId,
        },
      }
    );

    if (registerError || !registration?.patient_id) {
      throw new Error(registerError?.message || 'Patient registration failed');
    }

    // HIPAA §164.312(b) - Log temp patient creation from EMS
    await auditLogger.phi('EMS_TEMP_PATIENT_PHI_CREATED', registration.patient_id as string, {
      resourceType: 'patient_profile',
      action: 'CREATE',
      source: 'ems_handoff',
      handoffId,
      emsUnit: handoff.unit_number
    });

    return { success: true, patientId: registration.patient_id as string };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Step 2: Create ER encounter from EMS handoff (LIVE encounters shape:
 * NOT NULL tenant_id + date_of_service; EMS context goes into clinical_notes —
 * the structured detail already lives on prehospital_handoffs, linked in step 5).
 */
async function createEREncounter(
  patientId: string,
  handoff: PrehospitalHandoff,
  providerId: string,
  tenantId: string
): Promise<{ success: boolean; encounterId?: string; error?: string }> {
  try {
    const now = new Date();
    const alertSummary = [
      handoff.cardiac_arrest && 'CARDIAC ARREST',
      handoff.stroke_alert && 'STROKE ALERT',
      handoff.stemi_alert && 'STEMI ALERT',
      handoff.trauma_alert && 'TRAUMA ALERT',
      handoff.sepsis_alert && 'SEPSIS ALERT',
    ].filter(Boolean).join(', ');

    const emsNarrative = [
      `EMS arrival — unit ${handoff.unit_number}${handoff.ems_agency ? ` (${handoff.ems_agency})` : ''}, paramedic ${handoff.paramedic_name}.`,
      alertSummary ? `Active alerts: ${alertSummary}.` : null,
      handoff.mechanism_of_injury ? `Mechanism of injury: ${handoff.mechanism_of_injury}.` : null,
      handoff.scene_location ? `Scene: ${handoff.scene_location}.` : null,
      handoff.events_leading ? `Events: ${handoff.events_leading}.` : null,
    ].filter(Boolean).join(' ');

    const { data: encounter, error } = await supabase
      .from('encounters')
      .insert({
        patient_id: patientId,
        provider_id: providerId,
        encounter_type: 'emergency',
        status: 'arrived',
        chief_complaint: handoff.chief_complaint,
        clinical_notes: emsNarrative,
        date_of_service: now.toISOString().slice(0, 10),
        arrived_at: now.toISOString(),
        tenant_id: tenantId,
      })
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, encounterId: encounter.id };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
}

const EMS_VITAL_MAPPINGS = [
  { key: 'blood_pressure_systolic', code: '8480-6', display: 'Systolic Blood Pressure', unit: 'mmHg' },
  { key: 'blood_pressure_diastolic', code: '8462-4', display: 'Diastolic Blood Pressure', unit: 'mmHg' },
  { key: 'heart_rate', code: '8867-4', display: 'Heart Rate', unit: 'beats/min' },
  { key: 'respiratory_rate', code: '9279-1', display: 'Respiratory Rate', unit: 'breaths/min' },
  { key: 'oxygen_saturation', code: '59408-5', display: 'Oxygen Saturation', unit: '%' },
  { key: 'temperature', code: '8310-5', display: 'Body Temperature', unit: 'F' },
  { key: 'glucose', code: '2339-0', display: 'Glucose', unit: 'mg/dL' },
  { key: 'gcs_score', code: '9269-2', display: 'Glasgow Coma Score', unit: 'score' },
] as const;

/**
 * Step 3: Document EMS vitals as FHIR observations (LIVE table: fhir_observations).
 */
async function documentEMSVitals(
  encounterId: string,
  patientId: string,
  handoff: PrehospitalHandoff,
  tenantId: string
): Promise<string[]> {
  if (!handoff.vitals) return [];

  const nowISO = new Date().toISOString();
  const vitals = handoff.vitals as Record<string, unknown>;
  const observations = EMS_VITAL_MAPPINGS
    .filter((m) => vitals[m.key] !== undefined && vitals[m.key] !== null)
    .map((m) => ({
      patient_id: patientId,
      encounter_id: encounterId,
      tenant_id: tenantId,
      status: 'final',
      category: 'vital-signs',
      code: m.code,
      code_system: 'http://loinc.org',
      code_display: m.display,
      value_quantity_value: Number(vitals[m.key]),
      value_quantity_unit: m.unit,
      effective_datetime: nowISO,
      sync_source: 'ems_handoff',
      note: `EMS field vitals — unit ${handoff.unit_number}, paramedic ${handoff.paramedic_name}`,
    }));

  if (observations.length === 0) return [];

  const { data, error } = await supabase
    .from('fhir_observations')
    .insert(observations)
    .select('id');

  if (error) {
    await auditLogger.error('EMS_VITALS_WRITE_FAILED', new Error(error.message), {
      encounterId,
      attempted: observations.length,
    });
    return [];
  }

  // HIPAA §164.312(b) - Log PHI access for EMS vitals documentation
  await auditLogger.phi('EMS_VITALS_DOCUMENTED', patientId, {
    resourceType: 'fhir_observations',
    action: 'CREATE',
    encounterId,
    observationCount: data.length,
    source: 'ems_handoff',
    emsUnit: handoff.unit_number
  });

  return data.map((obs) => obs.id);
}

/**
 * Step 4: Store ADVISORY billing suggestions in encounter_billing_suggestions
 * (decision D2 — coder reviews before anything bills).
 */
async function storeBillingSuggestions(
  encounterId: string,
  patientId: string,
  handoff: PrehospitalHandoff,
  providerId: string,
  tenantId: string
): Promise<Array<{ code: string; code_type?: string; description: string; suggested_by?: string }>> {
  const suggestions: Array<{ code: string; code_type: string; description: string; reason: string }> = [];

  if (handoff.cardiac_arrest || handoff.trauma_alert) {
    suggestions.push({
      code: '99285', code_type: 'CPT',
      description: 'Emergency department visit, high severity',
      reason: handoff.cardiac_arrest ? 'Cardiac arrest alert' : 'Trauma alert',
    });
  } else if (handoff.stroke_alert || handoff.stemi_alert || handoff.sepsis_alert) {
    suggestions.push({
      code: '99284', code_type: 'CPT',
      description: 'Emergency department visit, moderate to high severity',
      reason: 'Time-critical EMS alert',
    });
  } else {
    suggestions.push({
      code: '99283', code_type: 'CPT',
      description: 'Emergency department visit, moderate severity',
      reason: 'EMS arrival',
    });
  }

  if (handoff.cardiac_arrest) {
    suggestions.push({
      code: '99291', code_type: 'CPT',
      description: 'Critical care, first 30-74 minutes',
      reason: 'Cardiac arrest — confirm critical care time documented',
    });
  }

  const { error } = await supabase
    .from('encounter_billing_suggestions')
    .insert({
      tenant_id: tenantId,
      encounter_id: encounterId,
      patient_id: patientId,
      encounter_start: new Date().toISOString(),
      encounter_type: 'ems_arrival',
      chief_complaint: handoff.chief_complaint,
      suggested_codes: suggestions,
      status: 'pending',
      requires_review: true,
      review_reason: 'Rule-based EMS arrival suggestion — coder review required',
      provider_id: providerId,
      ai_model_used: 'rule-based-ems-v1',
    });

  if (error) {
    await auditLogger.error('EMS_BILLING_SUGGESTION_FAILED', new Error(error.message), {
      encounterId,
    });
    return [];
  }

  return suggestions.map((s) => ({
    code: s.code,
    code_type: s.code_type,
    description: s.description,
    suggested_by: s.reason,
  }));
}

/**
 * Step 5: Link handoff back to patient and encounter (live-correct columns).
 */
async function linkHandoffToPatient(
  handoffId: string,
  patientId: string,
  encounterId: string
): Promise<void> {
  const { error } = await supabase
    .from('prehospital_handoffs')
    .update({
      patient_id: patientId,
      encounter_id: encounterId,
      integrated_at: new Date().toISOString(),
    })
    .eq('id', handoffId);

  if (error) {
    throw error;
  }
}

/**
 * Get integration status for a handoff.
 */
export async function getHandoffIntegrationStatus(
  handoffId: string
): Promise<{
  isIntegrated: boolean;
  patientId?: string;
  encounterId?: string;
  observationCount?: number;
}> {
  try {
    const { data: handoff, error } = await supabase
      .from('prehospital_handoffs')
      .select('patient_id, encounter_id, integrated_at')
      .eq('id', handoffId)
      .single();

    if (error || !handoff) {
      return { isIntegrated: false };
    }

    const isIntegrated = !!(handoff.patient_id && handoff.encounter_id);
    if (!isIntegrated) {
      return { isIntegrated: false };
    }

    const { count } = await supabase
      .from('fhir_observations')
      .select('id', { count: 'exact', head: true })
      .eq('encounter_id', handoff.encounter_id);

    return {
      isIntegrated: true,
      patientId: handoff.patient_id,
      encounterId: handoff.encounter_id,
      observationCount: count || 0,
    };
  } catch {
    return { isIntegrated: false };
  }
}

export default {
  integrateEMSHandoff,
  getHandoffIntegrationStatus,
};
