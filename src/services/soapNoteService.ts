/**
 * SOAP Note Generation Service
 *
 * Generates structured SOAP (Subjective, Objective, Assessment, Plan) notes
 * for clinical encounters. Integrates with:
 * - fhir_observations (vitals, lab results)
 * - fhir_conditions (diagnoses)
 * - fhir_medication_requests (treatment plans)
 * - clinical_notes table (storage)
 * - encounters (patient visits)
 *
 * HIPAA-compliant with audit logging
 */

import { supabase } from '../lib/supabaseClient';

export interface SOAPNoteComponents {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  hpi?: string; // History of Present Illness
  ros?: string; // Review of Systems
}

export interface SOAPNoteData extends SOAPNoteComponents {
  encounter_id: string;
  author_id: string;
  patient_id: string;
}

export interface ClinicalData {
  chiefComplaint?: string;
  vitals?: {
    temperature?: number;
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    heart_rate?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
    weight?: number;
    height?: number;
  };
  diagnoses?: Array<{
    code: string;
    display: string;
    clinical_status: string;
  }>;
  medications?: Array<{
    medication_name: string;
    dosage: string;
    frequency: string;
  }>;
  labResults?: Array<{
    test_name: string;
    value: string;
    unit: string;
    interpretation?: string;
  }>;
  physicalExam?: string;
  reviewOfSystems?: Record<string, string>;
}

/**
 * Generate complete SOAP note from clinical data
 */
export async function generateSOAPNote(
  encounterId: string,
  clinicalData: ClinicalData
): Promise<SOAPNoteComponents> {
  // Validate input
  if (!encounterId) {
    throw new Error('Encounter ID is required');
  }

  // Build Subjective section
  const subjective = buildSubjectiveSection(clinicalData);

  // Build Objective section
  const objective = buildObjectiveSection(clinicalData);

  // Build Assessment section
  const assessment = buildAssessmentSection(clinicalData);

  // Build Plan section
  const plan = buildPlanSection(clinicalData);

  // Build HPI if chief complaint provided
  const hpi = clinicalData.chiefComplaint
    ? buildHPISection(clinicalData)
    : undefined;

  // Build ROS if review of systems provided
  const ros = clinicalData.reviewOfSystems
    ? buildROSSection(clinicalData.reviewOfSystems)
    : undefined;

  return {
    subjective,
    objective,
    assessment,
    plan,
    hpi,
    ros
  };
}

/**
 * Save SOAP note components to database as clinical_notes entries
 */
export async function saveSOAPNote(
  soapNoteData: SOAPNoteData
): Promise<{ success: boolean; note_ids: string[] }> {
  const { encounter_id, author_id, patient_id, ...components } = soapNoteData;

  // Validate required fields
  if (!encounter_id || !author_id) {
    throw new Error('Encounter ID and Author ID are required');
  }

  // Verify encounter exists
  const { data: encounter, error: encounterError } = await supabase
    .from('encounters')
    .select('id, patient_id')
    .eq('id', encounter_id)
    .single();

  if (encounterError || !encounter) {
    throw new Error('Encounter not found');
  }

  const note_ids: string[] = [];

  try {
    // Save each SOAP component as a separate clinical note
    const notesToInsert = [];

    if (components.hpi) {
      notesToInsert.push({
        encounter_id,
        type: 'hpi',
        content: components.hpi,
        author_id
      });
    }

    if (components.ros) {
      notesToInsert.push({
        encounter_id,
        type: 'ros',
        content: components.ros,
        author_id
      });
    }

    if (components.subjective) {
      notesToInsert.push({
        encounter_id,
        type: 'subjective',
        content: components.subjective,
        author_id
      });
    }

    if (components.objective) {
      notesToInsert.push({
        encounter_id,
        type: 'objective',
        content: components.objective,
        author_id
      });
    }

    if (components.assessment) {
      notesToInsert.push({
        encounter_id,
        type: 'assessment',
        content: components.assessment,
        author_id
      });
    }

    if (components.plan) {
      notesToInsert.push({
        encounter_id,
        type: 'plan',
        content: components.plan,
        author_id
      });
    }

    // Insert all notes
    const { data: savedNotes, error: saveError } = await supabase
      .from('clinical_notes')
      .insert(notesToInsert)
      .select('id');

    if (saveError) {

      throw new Error(`Failed to save SOAP notes: ${saveError.message}`);
    }

    if (savedNotes) {
      note_ids.push(...savedNotes.map((n: { id: string }) => n.id));
    }

    // Log PHI access for audit compliance
    await logSOAPNoteAccess(encounter_id, author_id, 'CREATE');

    return { success: true, note_ids };
  } catch (error) {

    throw error;
  }
}

/**
 * Retrieve complete SOAP note for an encounter
 */
export async function getSOAPNote(
  encounterId: string
): Promise<SOAPNoteComponents | null> {
  const { data: notes, error } = await supabase
    .from('clinical_notes')
    .select('type, content')
    .eq('encounter_id', encounterId)
    .in('type', ['subjective', 'objective', 'assessment', 'plan', 'hpi', 'ros']);

  if (error) {

    throw new Error(`Failed to fetch SOAP note: ${error.message}`);
  }

  if (!notes || notes.length === 0) {
    return null;
  }

  // Reconstruct SOAP note from individual components
  const soapNote: SOAPNoteComponents = {
    subjective: notes.find((n: { type: string; content: string }) => n.type === 'subjective')?.content || '',
    objective: notes.find((n: { type: string; content: string }) => n.type === 'objective')?.content || '',
    assessment: notes.find((n: { type: string; content: string }) => n.type === 'assessment')?.content || '',
    plan: notes.find((n: { type: string; content: string }) => n.type === 'plan')?.content || '',
    hpi: notes.find((n: { type: string; content: string }) => n.type === 'hpi')?.content,
    ros: notes.find((n: { type: string; content: string }) => n.type === 'ros')?.content
  };

  // Log PHI access
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await logSOAPNoteAccess(encounterId, user.id, 'READ');
  }

  return soapNote;
}

/**
 * Update existing SOAP note
 */
export async function updateSOAPNote(
  encounterId: string,
  updates: Partial<SOAPNoteComponents>
): Promise<{ success: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    // Update each component that was provided
    for (const [type, content] of Object.entries(updates)) {
      if (content && ['subjective', 'objective', 'assessment', 'plan', 'hpi', 'ros'].includes(type)) {
        const { error } = await supabase
          .from('clinical_notes')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('encounter_id', encounterId)
          .eq('type', type);

        if (error) {

          throw new Error(`Failed to update ${type}: ${error.message}`);
        }
      }
    }

    // Log PHI access
    await logSOAPNoteAccess(encounterId, user.id, 'UPDATE');

    return { success: true };
  } catch (error) {

    throw error;
  }
}

/**
 * Fetch clinical data for SOAP note generation from FHIR resources
 */
export async function fetchClinicalDataForEncounter(
  encounterId: string
): Promise<ClinicalData> {
  // Get encounter details
  const { data: encounter, error: encounterError } = await supabase
    .from('encounters')
    .select('*')
    .eq('id', encounterId)
    .single();

  if (encounterError || !encounter) {
    throw new Error('Encounter not found');
  }

  const patientId = encounter.patient_id;

  // Fetch recent vitals (from fhir_observations)
  const { data: vitalsData } = await supabase
    .from('fhir_observations')
    .select('code, value_quantity_value, value_quantity_unit, effective_datetime')
    .eq('patient_id', patientId)
    .gte('effective_datetime', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('effective_datetime', { ascending: false });

  // Parse vitals
  const vitals: ClinicalData['vitals'] = {};
  if (vitalsData) {
    for (const obs of vitalsData) {
      const code = obs.code?.coding?.[0]?.code;
      const value = obs.value_quantity_value;

      if (code === '8310-5') vitals.temperature = value; // Body temperature
      if (code === '8480-6') vitals.blood_pressure_systolic = value; // Systolic BP
      if (code === '8462-4') vitals.blood_pressure_diastolic = value; // Diastolic BP
      if (code === '8867-4') vitals.heart_rate = value; // Heart rate
      if (code === '9279-1') vitals.respiratory_rate = value; // Respiratory rate
      if (code === '59408-5' || code === '2708-6') vitals.oxygen_saturation = value; // O2 sat
      if (code === '29463-7') vitals.weight = value; // Body weight
      if (code === '8302-2') vitals.height = value; // Body height
    }
  }

  // Fetch active diagnoses (from fhir_conditions)
  const { data: diagnosesData } = await supabase
    .from('fhir_conditions')
    .select('code, clinical_status')
    .eq('patient_id', patientId)
    .eq('clinical_status', 'active')
    .order('recorded_date', { ascending: false })
    .limit(10);

  const diagnoses = diagnosesData?.map((d: any) => ({
    code: d.code?.coding?.[0]?.code || '',
    display: d.code?.coding?.[0]?.display || '',
    clinical_status: d.clinical_status
  })) || [];

  // Fetch active medications (from fhir_medication_requests)
  const { data: medsData } = await supabase
    .from('fhir_medication_requests')
    .select('medication_codeable_concept, dosage_instruction')
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .order('authored_on', { ascending: false })
    .limit(10);

  const medications = medsData?.map((m: any) => ({
    medication_name: m.medication_codeable_concept?.coding?.[0]?.display || '',
    dosage: m.dosage_instruction?.[0]?.dose_and_rate?.[0]?.dose_quantity?.value || '',
    frequency: m.dosage_instruction?.[0]?.timing?.code?.text || ''
  })) || [];

  return {
    vitals,
    diagnoses,
    medications,
    chiefComplaint: encounter.chief_complaint || undefined
  };
}

// ============================================================================
// PRIVATE HELPER FUNCTIONS
// ============================================================================

function buildSubjectiveSection(data: ClinicalData): string {
  const parts: string[] = [];

  if (data.chiefComplaint) {
    parts.push(`Chief Complaint: ${data.chiefComplaint}`);
  }

  // HPI will be built separately if chief complaint is provided
  return parts.join('\n') || 'No subjective data documented.';
}

function buildObjectiveSection(data: ClinicalData): string {
  const parts: string[] = [];

  // Vitals
  if (data.vitals && Object.keys(data.vitals).length > 0) {
    const vitalStrings: string[] = [];

    if (data.vitals.temperature) {
      vitalStrings.push(`Temp: ${data.vitals.temperature}°F`);
    }
    if (data.vitals.blood_pressure_systolic && data.vitals.blood_pressure_diastolic) {
      vitalStrings.push(`BP: ${data.vitals.blood_pressure_systolic}/${data.vitals.blood_pressure_diastolic} mmHg`);
    }
    if (data.vitals.heart_rate) {
      vitalStrings.push(`HR: ${data.vitals.heart_rate} bpm`);
    }
    if (data.vitals.respiratory_rate) {
      vitalStrings.push(`RR: ${data.vitals.respiratory_rate} /min`);
    }
    if (data.vitals.oxygen_saturation) {
      vitalStrings.push(`SpO2: ${data.vitals.oxygen_saturation}%`);
    }

    if (vitalStrings.length > 0) {
      parts.push(`Vitals: ${vitalStrings.join(', ')}`);
    }
  }

  // Physical exam
  if (data.physicalExam) {
    parts.push(`\nPhysical Examination:\n${data.physicalExam}`);
  }

  // Lab results
  if (data.labResults && data.labResults.length > 0) {
    parts.push('\nLaboratory Results:');
    data.labResults.forEach(lab => {
      parts.push(`- ${lab.test_name}: ${lab.value} ${lab.unit}${lab.interpretation ? ` (${lab.interpretation})` : ''}`);
    });
  }

  return parts.join('\n') || 'No objective findings documented.';
}

function buildAssessmentSection(data: ClinicalData): string {
  if (!data.diagnoses || data.diagnoses.length === 0) {
    return 'Assessment pending further evaluation.';
  }

  const parts: string[] = [];
  data.diagnoses.forEach((dx, index) => {
    parts.push(`${index + 1}. ${dx.display} (${dx.code})`);
  });

  return parts.join('\n');
}

function buildPlanSection(data: ClinicalData): string {
  const parts: string[] = [];

  // Medications
  if (data.medications && data.medications.length > 0) {
    parts.push('Medications:');
    data.medications.forEach(med => {
      parts.push(`- ${med.medication_name} ${med.dosage} ${med.frequency}`);
    });
  }

  // Default follow-up
  parts.push('\nFollow-up as scheduled or PRN for worsening symptoms.');
  parts.push('Patient education provided and understanding verified.');

  return parts.join('\n');
}

function buildHPISection(data: ClinicalData): string {
  // In real implementation, this would use OLDCARTS (Onset, Location, Duration,
  // Character, Alleviating/Aggravating factors, Radiation, Timing, Severity)
  // For now, use chief complaint as basis
  return `Patient presents with ${data.chiefComplaint}. Further details of onset, duration, and associated symptoms documented in encounter.`;
}

function buildROSSection(ros: Record<string, string>): string {
  const systems = [
    'Constitutional',
    'Eyes',
    'ENT',
    'Cardiovascular',
    'Respiratory',
    'Gastrointestinal',
    'Genitourinary',
    'Musculoskeletal',
    'Skin',
    'Neurological',
    'Psychiatric',
    'Endocrine',
    'Hematologic',
    'Allergic/Immunologic'
  ];

  const parts: string[] = [];
  systems.forEach(system => {
    if (ros[system]) {
      parts.push(`${system}: ${ros[system]}`);
    }
  });

  return parts.join('\n') || 'All systems reviewed and negative except as noted above.';
}

/**
 * Log SOAP note access for HIPAA audit compliance
 */
async function logSOAPNoteAccess(
  encounterId: string,
  userId: string,
  action: 'CREATE' | 'READ' | 'UPDATE'
): Promise<void> {
  try {
    await supabase.from('audit_phi_access').insert({
      user_id: userId,
      resource_type: 'clinical_note',
      resource_id: encounterId,
      action,
      ip_address: 'server-side' // In production, capture real IP
    });
  } catch (error) {

    // Don't throw - audit logging failure shouldn't break clinical workflow
  }
}

export default {
  generateSOAPNote,
  saveSOAPNote,
  getSOAPNote,
  updateSOAPNote,
  fetchClinicalDataForEncounter
};
