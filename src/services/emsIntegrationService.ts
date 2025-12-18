// EMS Integration Service
// Connects EMS handoffs to the rest of the healthcare platform
// Creates patient records, encounters, observations, and billing integration

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { PrehospitalHandoff } from './emsService';

export interface EMSIntegrationResult {
  success: boolean;
  patientId?: string;
  encounterId?: string;
  observationIds?: string[];
  billingCodes?: any[];
  error?: string;
}

/**
 * Complete EMS handoff integration
 * Called when patient arrives or handoff is completed
 * Creates/updates patient record, encounter, vitals, and billing codes
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

    // Step 1: Create or find patient record
    const patientResult = await createOrFindPatient(handoffData, user.id);
    if (!patientResult.success || !patientResult.patientId) {
      return { success: false, error: patientResult.error || 'Failed to create patient' };
    }

    const patientId = patientResult.patientId;

    // Step 2: Create ER encounter
    const encounterResult = await createEREncounter(handoffId, patientId, handoffData, user.id);
    if (!encounterResult.success || !encounterResult.encounterId) {
      return { success: false, error: encounterResult.error || 'Failed to create encounter' };
    }

    const encounterId = encounterResult.encounterId;

    // Step 3: Document vitals from EMS
    const vitalResults = await documentEMSVitals(encounterId, patientId, handoffData, user.id);

    // Step 4: Generate billing codes based on severity
    const billingCodes = await generateBillingCodesFromHandoff(encounterId, handoffData, user.id);

    // Step 5: Update handoff with patient/encounter linkage
    await linkHandoffToPatient(handoffId, patientId, encounterId);

    auditLogger.clinical('EMS_HANDOFF_INTEGRATED', true, {
      handoffId,
      patientId,
      encounterId,
      vitalsRecorded: vitalResults.length,
      billingCodesGenerated: billingCodes.length,
    });

    return {
      success: true,
      patientId,
      encounterId,
      observationIds: vitalResults,
      billingCodes,
    };
  } catch (err: any) {
    auditLogger.error('EMS_INTEGRATION_FAILED', err, { handoffId });
    return { success: false, error: err.message };
  }
}

/**
 * Create or find patient record
 * Uses patient demographics from EMS handoff
 */
async function createOrFindPatient(
  handoff: PrehospitalHandoff,
  _userId: string
): Promise<{ success: boolean; patientId?: string; error?: string }> {
  try {
    // For EMS arrivals, we often don't have full patient identity
    // Create a temporary patient record that can be matched later
    const tempPatientName = `EMS-${handoff.unit_number}-${new Date().toISOString().split('T')[0]}`;

    const { data: existingPatient } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('first_name', tempPatientName)
      .eq('role', 'patient')
      .maybeSingle();

    if (existingPatient) {
      return { success: true, patientId: existingPatient.user_id };
    }

    // Create new temporary patient record
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email: `ems-${handoff.unit_number}-${Date.now()}@temp.wellfit.health`,
      email_confirm: true,
      user_metadata: {
        role: 'patient',
        is_ems_temp: true,
        ems_handoff_id: handoff.id,
      },
    });

    if (authError || !newUser.user) {
      throw new Error('Failed to create temporary patient user');
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: newUser.user.id,
        first_name: tempPatientName,
        last_name: 'EMS-Arrival',
        role: 'patient',
        date_of_birth: handoff.patient_age
          ? new Date(new Date().setFullYear(new Date().getFullYear() - handoff.patient_age)).toISOString().split('T')[0]
          : null,
        gender: handoff.patient_gender || 'U',
        created_at: new Date().toISOString(),
      })
      .select('user_id')
      .single();

    if (profileError) {
      throw profileError;
    }

    auditLogger.clinical('EMS_TEMP_PATIENT_CREATED', true, {
      patientId: newUser.user.id,
      handoffId: handoff.id,
      unitNumber: handoff.unit_number,
    });

    return { success: true, patientId: newUser.user.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Create ER encounter from EMS handoff
 */
async function createEREncounter(
  handoffId: string,
  patientId: string,
  handoff: PrehospitalHandoff,
  providerId: string
): Promise<{ success: boolean; encounterId?: string; error?: string }> {
  try {
    const { data: encounter, error } = await supabase
      .from('encounters')
      .insert({
        patient_id: patientId,
        provider_id: providerId,
        encounter_type: 'emergency',
        status: 'in-progress',
        chief_complaint: handoff.chief_complaint,
        started_at: new Date().toISOString(),
        location: 'Emergency Department',
        urgency: determineUrgency(handoff),
        metadata: {
          ems_handoff_id: handoffId,
          ems_unit: handoff.unit_number,
          ems_agency: handoff.ems_agency,
          paramedic_name: handoff.paramedic_name,
          scene_location: handoff.scene_location,
          mechanism_of_injury: handoff.mechanism_of_injury,
          treatments_given: handoff.treatments_given,
          critical_alerts: {
            stroke: handoff.stroke_alert,
            stemi: handoff.stemi_alert,
            trauma: handoff.trauma_alert,
            sepsis: handoff.sepsis_alert,
            cardiac_arrest: handoff.cardiac_arrest,
          },
        },
      })
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, encounterId: encounter.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Document EMS vitals as observations
 */
async function documentEMSVitals(
  encounterId: string,
  patientId: string,
  handoff: PrehospitalHandoff,
  recordedBy: string
): Promise<string[]> {
  const observationIds: string[] = [];

  if (!handoff.vitals) return observationIds;

  const vitalMappings = [
    { key: 'blood_pressure_systolic', code: 'LOINC:8480-6', display: 'Systolic BP', unit: 'mmHg' },
    { key: 'blood_pressure_diastolic', code: 'LOINC:8462-4', display: 'Diastolic BP', unit: 'mmHg' },
    { key: 'heart_rate', code: 'LOINC:8867-4', display: 'Heart Rate', unit: 'bpm' },
    { key: 'respiratory_rate', code: 'LOINC:9279-1', display: 'Respiratory Rate', unit: '/min' },
    { key: 'oxygen_saturation', code: 'LOINC:59408-5', display: 'Oxygen Saturation', unit: '%' },
    { key: 'temperature', code: 'LOINC:8310-5', display: 'Body Temperature', unit: 'degF' },
    { key: 'glucose', code: 'LOINC:2339-0', display: 'Glucose', unit: 'mg/dL' },
    { key: 'gcs_score', code: 'LOINC:9269-2', display: 'Glasgow Coma Score', unit: 'score' },
  ];

  for (const mapping of vitalMappings) {
    const value = (handoff.vitals as any)[mapping.key];
    if (value !== undefined && value !== null) {
      try {
        const { data, error } = await supabase
          .from('ehr_observations')
          .insert({
            patient_id: patientId,
            encounter_id: encounterId,
            observation_type: mapping.display,
            observation_code: mapping.code,
            value_quantity: value,
            unit: mapping.unit,
            status: 'final',
            effective_datetime: new Date().toISOString(),
            recorded_by: recordedBy,
            source: 'EMS Handoff',
            metadata: {
              ems_recorded: true,
              paramedic_name: handoff.paramedic_name,
              unit_number: handoff.unit_number,
            },
          })
          .select('id')
          .single();

        if (!error && data) {
          observationIds.push(data.id);
        }
      } catch {

      }
    }
  }

  return observationIds;
}

/**
 * Generate billing codes based on EMS handoff severity
 */
async function generateBillingCodesFromHandoff(
  encounterId: string,
  handoff: PrehospitalHandoff,
  _providerId: string
): Promise<any[]> {
  const billingCodes: any[] = [];

  // Determine ER visit level based on severity
  let erVisitCode = '99283'; // Default: moderate severity
  let erVisitDescription = 'Emergency department visit, moderate severity';

  if (handoff.cardiac_arrest || handoff.trauma_alert) {
    erVisitCode = '99285';
    erVisitDescription = 'Emergency department visit, high severity requiring urgent evaluation';
  } else if (handoff.stroke_alert || handoff.stemi_alert || handoff.sepsis_alert) {
    erVisitCode = '99284';
    erVisitDescription = 'Emergency department visit, moderate to high severity';
  }

  billingCodes.push({
    code: erVisitCode,
    code_type: 'CPT',
    description: erVisitDescription,
    suggested_by: 'EMS Handoff Severity',
  });

  // Add trauma activation fee if applicable
  if (handoff.trauma_alert) {
    billingCodes.push({
      code: '99288',
      code_type: 'CPT',
      description: 'Physician direction of emergency medical systems (EMS) emergency care, advanced life support',
      suggested_by: 'Trauma Alert',
    });
  }

  // Add critical care codes for cardiac arrest
  if (handoff.cardiac_arrest) {
    billingCodes.push({
      code: '99291',
      code_type: 'CPT',
      description: 'Critical care, evaluation and management of the critically ill or critically injured patient; first 30-74 minutes',
      suggested_by: 'Cardiac Arrest Alert',
    });
  }

  // Store suggested codes in encounter metadata
  try {
    await supabase
      .from('encounters')
      .update({
        metadata: {
          suggested_billing_codes: billingCodes,
          ems_severity_level: determineUrgency(handoff),
        },
      })
      .eq('id', encounterId);
  } catch {

  }

  return billingCodes;
}

/**
 * Link handoff back to patient and encounter
 */
async function linkHandoffToPatient(
  handoffId: string,
  patientId: string,
  encounterId: string
): Promise<void> {
  try {
    await supabase
      .from('prehospital_handoffs')
      .update({
        patient_id: patientId,
        encounter_id: encounterId,
        integrated_at: new Date().toISOString(),
      })
      .eq('id', handoffId);
  } catch {

  }
}

/**
 * Determine urgency level from handoff alerts
 */
function determineUrgency(handoff: PrehospitalHandoff): 'critical' | 'emergent' | 'urgent' | 'routine' {
  if (handoff.cardiac_arrest) return 'critical';
  if (handoff.stroke_alert || handoff.stemi_alert || handoff.trauma_alert) return 'emergent';
  if (handoff.sepsis_alert) return 'urgent';
  return 'routine';
}

/**
 * Get integration status for a handoff
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

    if (isIntegrated) {
      // Count observations
      const { count } = await supabase
        .from('ehr_observations')
        .select('id', { count: 'exact', head: true })
        .eq('encounter_id', handoff.encounter_id);

      return {
        isIntegrated: true,
        patientId: handoff.patient_id,
        encounterId: handoff.encounter_id,
        observationCount: count || 0,
      };
    }

    return { isIntegrated: false };
  } catch {
    return { isIntegrated: false };
  }
}

export default {
  integrateEMSHandoff,
  getHandoffIntegrationStatus,
};
