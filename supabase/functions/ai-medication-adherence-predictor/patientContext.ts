/**
 * Patient Context Gathering for Medication Adherence Prediction
 *
 * Queries database for patient demographics, conditions, SDOH factors,
 * check-in history, medication history, cognitive assessments, and appointments.
 *
 * @skill #31 - Medication Adherence Predictor
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/**
 * Gather patient context from database for adherence analysis.
 * Returns a generic record since different modules consume different fields.
 */
export async function gatherPatientContext(
  supabase: ReturnType<typeof createClient>,
  patientId: string
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {};
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Get patient profile
  const { data: patient } = await supabase
    .from('patients')
    .select('id, date_of_birth, gender, primary_language, insurance_type')
    .eq('id', patientId)
    .single();

  if (patient) {
    context.patient = patient;
    if (patient.date_of_birth) {
      const dob = new Date(patient.date_of_birth);
      context.age = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
  }

  // Get conditions/diagnoses
  const { data: conditions } = await supabase
    .from('patient_conditions')
    .select('condition_code, condition_name, status')
    .eq('patient_id', patientId)
    .eq('status', 'active');

  context.conditions = conditions || [];

  // Get SDOH factors
  const { data: sdohFactors } = await supabase
    .from('sdoh_assessments')
    .select('category, risk_level, details')
    .eq('patient_id', patientId)
    .gte('assessed_at', ninetyDaysAgo)
    .order('assessed_at', { ascending: false });

  context.sdohFactors = sdohFactors || [];

  // Get check-in history for adherence patterns
  const { data: checkIns } = await supabase
    .from('daily_check_ins')
    .select('created_at, mood_score, completed')
    .eq('user_id', patientId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false });

  context.checkInHistory = checkIns || [];

  // Get medication history/refills
  const { data: medHistory } = await supabase
    .from('medication_records')
    .select('medication_name, fill_date, days_supply, refills_remaining')
    .eq('patient_id', patientId)
    .gte('fill_date', ninetyDaysAgo)
    .order('fill_date', { ascending: false });

  context.medicationHistory = medHistory || [];

  // Get cognitive assessments
  const { data: cogAssessments } = await supabase
    .from('cognitive_assessments')
    .select('assessment_type, score, assessed_at')
    .eq('patient_id', patientId)
    .order('assessed_at', { ascending: false })
    .limit(3);

  context.cognitiveAssessments = cogAssessments || [];

  // Get appointment history
  const { data: appointments } = await supabase
    .from('appointments')
    .select('appointment_date, status, no_show')
    .eq('patient_id', patientId)
    .gte('appointment_date', ninetyDaysAgo);

  context.appointments = appointments || [];

  return context;
}
