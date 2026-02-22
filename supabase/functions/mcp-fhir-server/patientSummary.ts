// =====================================================
// MCP FHIR Server - Patient Summary Builder
// Purpose: CCD-style clinical summary aggregation from FHIR resources
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { PatientSummary } from "./types.ts";

const ALL_SECTIONS = [
  'demographics', 'conditions', 'medications', 'allergies',
  'immunizations', 'vitals', 'procedures', 'goals', 'careplans'
];

/**
 * Builds a CCD-style patient clinical summary by querying
 * multiple FHIR resource tables and aggregating results.
 *
 * @param sb - The Supabase client (service role)
 * @param patientId - The patient UUID
 * @param sections - Which sections to include (defaults to all)
 * @returns A PatientSummary with populated sections
 */
export async function getPatientSummary(
  sb: SupabaseClient,
  patientId: string,
  sections: string[] = ALL_SECTIONS
): Promise<PatientSummary> {
  const summary: PatientSummary = {
    patient_id: patientId,
    generated_at: new Date().toISOString(),
    sections: {}
  };

  // Demographics
  if (sections.includes('demographics')) {
    const { data: patient } = await sb
      .from('profiles')
      .select('first_name, last_name, date_of_birth, gender, phone, address_line1, city, state, zip_code')
      .eq('id', patientId)
      .single();
    if (patient) {
      summary.sections.demographics = {
        name: `${patient.first_name} ${patient.last_name}`,
        date_of_birth: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone,
        address: [patient.address_line1, patient.city, patient.state, patient.zip_code]
          .filter(Boolean)
          .join(', ')
      };
    }
  }

  // Active Conditions
  if (sections.includes('conditions')) {
    const { data } = await sb
      .from('fhir_conditions')
      .select('code, code_display, onset_date, clinical_status')
      .eq('patient_id', patientId)
      .eq('clinical_status', 'active')
      .limit(20);
    summary.sections.conditions = (data || []).map(c => ({
      code: c.code,
      display: c.code_display,
      onset: c.onset_date,
      status: c.clinical_status
    }));
  }

  // Active Medications
  if (sections.includes('medications')) {
    const { data } = await sb
      .from('fhir_medication_requests')
      .select('medication_name, dosage_instructions, status, requester_display')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .limit(30);
    summary.sections.medications = (data || []).map(m => ({
      name: m.medication_name,
      dosage: m.dosage_instructions,
      status: m.status,
      prescriber: m.requester_display
    }));
  }

  // Allergies
  if (sections.includes('allergies')) {
    const { data } = await sb
      .from('fhir_allergies')
      .select('code_display, substance, reaction_description, criticality')
      .eq('patient_id', patientId)
      .limit(20);
    summary.sections.allergies = (data || []).map(a => ({
      allergen: a.code_display || a.substance,
      reaction: a.reaction_description,
      severity: a.criticality
    }));
  }

  // Immunizations
  if (sections.includes('immunizations')) {
    const { data } = await sb
      .from('fhir_immunizations')
      .select('vaccine_display, vaccine_code, occurrence_date, status')
      .eq('patient_id', patientId)
      .order('occurrence_date', { ascending: false })
      .limit(20);
    summary.sections.immunizations = (data || []).map(i => ({
      vaccine: i.vaccine_display || i.vaccine_code,
      date: i.occurrence_date,
      status: i.status
    }));
  }

  // Recent Vitals
  if (sections.includes('vitals')) {
    const { data } = await sb
      .from('fhir_observations')
      .select('code_display, code, value_quantity, effective_date')
      .eq('patient_id', patientId)
      .eq('category', 'vital-signs')
      .order('effective_date', { ascending: false })
      .limit(20);
    summary.sections.vitals = (data || []).map(v => ({
      type: v.code_display || v.code,
      value: v.value_quantity?.value,
      unit: v.value_quantity?.unit,
      date: v.effective_date
    }));
  }

  // Recent Procedures
  if (sections.includes('procedures')) {
    const { data } = await sb
      .from('fhir_procedures')
      .select('code_display, performed_date, status')
      .eq('patient_id', patientId)
      .order('performed_date', { ascending: false })
      .limit(10);
    summary.sections.procedures = (data || []).map(p => ({
      name: p.code_display,
      date: p.performed_date,
      status: p.status
    }));
  }

  // Goals
  if (sections.includes('goals')) {
    const { data } = await sb
      .from('fhir_goals')
      .select('description, lifecycle_status, target_date')
      .eq('patient_id', patientId)
      .neq('lifecycle_status', 'cancelled')
      .limit(10);
    summary.sections.goals = (data || []).map(g => ({
      description: g.description,
      status: g.lifecycle_status,
      target_date: g.target_date
    }));
  }

  // Care Plans
  if (sections.includes('careplans')) {
    const { data } = await sb
      .from('fhir_care_plans')
      .select('title, category, status, period')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .limit(5);
    summary.sections.careplans = (data || []).map(cp => ({
      title: cp.title,
      category: cp.category,
      status: cp.status,
      period: cp.period
    }));
  }

  return summary;
}
