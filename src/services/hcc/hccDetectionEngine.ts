/**
 * HCC Detection Engine
 *
 * Purpose: Detection logic for expiring, documented, and suspected HCC
 * opportunities. Separated from the service orchestrator for 600-line compliance.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  HCCOpportunity,
  HCCCategoryRow,
  EncounterRow,
  EncounterDiagnosisRow,
  MedicationRow,
} from './hccOpportunityTypes';
import { MA_BASE_PAYMENT, MEDICATION_HCC_SUSPECTS } from './hccOpportunityTypes';

// =============================================================================
// HELPERS
// =============================================================================

function getYearBoundaries(): {
  currentYearStart: string;
  currentYearEnd: string;
  priorYearStart: string;
  priorYearEnd: string;
} {
  const now = new Date();
  const currentYear = now.getFullYear();
  return {
    currentYearStart: `${currentYear}-01-01`,
    currentYearEnd: `${currentYear}-12-31`,
    priorYearStart: `${currentYear - 1}-01-01`,
    priorYearEnd: `${currentYear - 1}-12-31`,
  };
}

/**
 * Build a per-patient map of currently-documented HCC codes from this year's encounters.
 */
async function buildCurrentYearPatientHCCs(
  icd10ToHCC: Map<string, string>
): Promise<{ patientHCCs: Map<string, Set<string>>; encounters: EncounterRow[] }> {
  const { currentYearStart, currentYearEnd } = getYearBoundaries();

  const { data: encounters } = await supabase
    .from('encounters')
    .select('id, patient_id, date_of_service')
    .gte('date_of_service', currentYearStart)
    .lte('date_of_service', currentYearEnd)
    .limit(500);

  const typedEnc = (encounters || []) as unknown as EncounterRow[];
  const encIds = typedEnc.map(e => e.id);
  const patientHCCs = new Map<string, Set<string>>();

  if (encIds.length > 0) {
    const { data: diagnoses } = await supabase
      .from('encounter_diagnoses')
      .select('encounter_id, code')
      .in('encounter_id', encIds);

    if (diagnoses) {
      const encToPatient = new Map<string, string>();
      for (const enc of typedEnc) {
        encToPatient.set(enc.id, enc.patient_id);
      }
      for (const dx of diagnoses as unknown as Array<{ encounter_id: string; code: string }>) {
        const patientId = encToPatient.get(dx.encounter_id);
        if (patientId) {
          const hccCode = icd10ToHCC.get(dx.code);
          if (hccCode) {
            const existing = patientHCCs.get(patientId) || new Set();
            existing.add(hccCode);
            patientHCCs.set(patientId, existing);
          }
        }
      }
    }
  }

  return { patientHCCs, encounters: typedEnc };
}

// =============================================================================
// DETECTION FUNCTIONS
// =============================================================================

/**
 * Detect expiring HCCs: Diagnoses captured last year but NOT recaptured this year.
 */
export async function detectExpiringHCCs(
  categoryMap: Map<string, HCCCategoryRow>,
  icd10ToHCC: Map<string, string>
): Promise<HCCOpportunity[]> {
  const { priorYearStart, priorYearEnd } = getYearBoundaries();

  // Prior year encounters
  const { data: priorEncounters } = await supabase
    .from('encounters')
    .select('id, patient_id, date_of_service')
    .gte('date_of_service', priorYearStart)
    .lte('date_of_service', priorYearEnd)
    .limit(500);

  if (!priorEncounters || priorEncounters.length === 0) return [];

  const typedPriorEnc = priorEncounters as unknown as EncounterRow[];
  const priorEncIds = typedPriorEnc.map(e => e.id);

  const { data: priorDiagnoses } = await supabase
    .from('encounter_diagnoses')
    .select('id, encounter_id, code, description')
    .in('encounter_id', priorEncIds);

  if (!priorDiagnoses || priorDiagnoses.length === 0) return [];

  const typedPriorDx = priorDiagnoses as unknown as EncounterDiagnosisRow[];

  // Build current year patient HCCs
  const { patientHCCs: currentPatientHCCs } = await buildCurrentYearPatientHCCs(icd10ToHCC);

  // Build encounter-to-patient lookup
  const encToPatient = new Map<string, string>();
  for (const enc of typedPriorEnc) {
    encToPatient.set(enc.id, enc.patient_id);
  }

  // Find prior year HCCs not recaptured
  const opportunities: HCCOpportunity[] = [];
  const seen = new Set<string>();

  for (const dx of typedPriorDx) {
    const hccCode = icd10ToHCC.get(dx.code);
    if (!hccCode) continue;

    const category = categoryMap.get(hccCode);
    if (!category) continue;

    const patientId = encToPatient.get(dx.encounter_id);
    if (!patientId) continue;

    const key = `${patientId}-${hccCode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const patientCurrentHCCs = currentPatientHCCs.get(patientId);
    if (patientCurrentHCCs && patientCurrentHCCs.has(hccCode)) continue;

    opportunities.push({
      id: `expiring-${patientId}-${hccCode}`,
      patient_id: patientId,
      encounter_id: dx.encounter_id,
      date_of_service: '',
      opportunity_type: 'expiring_hcc',
      icd10_code: dx.code,
      icd10_description: dx.description,
      hcc_code: hccCode,
      hcc_description: category.description,
      hcc_coefficient: category.coefficient,
      raf_score_impact: category.coefficient,
      annual_payment_impact: category.coefficient * MA_BASE_PAYMENT,
      confidence: 0.95,
      evidence_source: 'Prior Year Diagnosis',
      evidence_detail: `${dx.code} (${dx.description ?? hccCode}) was documented in prior year but has not been recaptured in the current year.`,
      status: 'open',
    });
  }

  return opportunities;
}

/**
 * Detect documented HCCs: Current year diagnoses that carry HCC weight (awareness).
 */
export async function detectDocumentedHCCs(
  categoryMap: Map<string, HCCCategoryRow>,
  icd10ToHCC: Map<string, string>
): Promise<HCCOpportunity[]> {
  const { currentYearStart, currentYearEnd } = getYearBoundaries();

  const { data: encounters } = await supabase
    .from('encounters')
    .select('id, patient_id, date_of_service')
    .gte('date_of_service', currentYearStart)
    .lte('date_of_service', currentYearEnd)
    .order('date_of_service', { ascending: false })
    .limit(200);

  if (!encounters || encounters.length === 0) return [];

  const typedEnc = encounters as unknown as EncounterRow[];
  const encIds = typedEnc.map(e => e.id);
  const encMap = new Map<string, EncounterRow>();
  for (const enc of typedEnc) {
    encMap.set(enc.id, enc);
  }

  const { data: diagnoses } = await supabase
    .from('encounter_diagnoses')
    .select('id, encounter_id, code, description')
    .in('encounter_id', encIds);

  if (!diagnoses || diagnoses.length === 0) return [];

  const typedDx = diagnoses as unknown as EncounterDiagnosisRow[];
  const opportunities: HCCOpportunity[] = [];
  const seen = new Set<string>();

  for (const dx of typedDx) {
    const hccCode = icd10ToHCC.get(dx.code);
    if (!hccCode) continue;

    const category = categoryMap.get(hccCode);
    if (!category) continue;

    const enc = encMap.get(dx.encounter_id);
    if (!enc) continue;

    const key = `${enc.patient_id}-${hccCode}-doc`;
    if (seen.has(key)) continue;
    seen.add(key);

    opportunities.push({
      id: `documented-${enc.patient_id}-${hccCode}`,
      patient_id: enc.patient_id,
      encounter_id: dx.encounter_id,
      date_of_service: enc.date_of_service,
      opportunity_type: 'documented_hcc',
      icd10_code: dx.code,
      icd10_description: dx.description,
      hcc_code: hccCode,
      hcc_description: category.description,
      hcc_coefficient: category.coefficient,
      raf_score_impact: category.coefficient,
      annual_payment_impact: category.coefficient * MA_BASE_PAYMENT,
      confidence: 1.0,
      evidence_source: 'Current Encounter',
      evidence_detail: `${dx.code} (${dx.description ?? hccCode}) documented in encounter on ${enc.date_of_service}. This diagnosis maps to ${hccCode} and contributes to risk adjustment.`,
      status: 'open',
    });
  }

  return opportunities;
}

/**
 * Detect suspected HCCs: Active medications suggest conditions not yet documented.
 */
export async function detectSuspectedHCCs(
  categoryMap: Map<string, HCCCategoryRow>,
  icd10ToHCC: Map<string, string>
): Promise<HCCOpportunity[]> {
  const { data: medications } = await supabase
    .from('medications')
    .select('id, user_id, medication_name, generic_name, status')
    .eq('status', 'active')
    .limit(500);

  if (!medications || medications.length === 0) return [];

  const typedMeds = medications as unknown as MedicationRow[];

  // Build current year patient HCCs
  const { patientHCCs: currentPatientHCCs } = await buildCurrentYearPatientHCCs(icd10ToHCC);

  const opportunities: HCCOpportunity[] = [];
  const seen = new Set<string>();

  for (const med of typedMeds) {
    const medNameLower = (med.medication_name + ' ' + (med.generic_name ?? '')).toLowerCase();

    for (const suspect of MEDICATION_HCC_SUSPECTS) {
      const matched = suspect.keywords.some(kw => medNameLower.includes(kw));
      if (!matched) continue;

      const category = categoryMap.get(suspect.expected_hcc);
      if (!category) continue;

      const patientId = med.user_id;
      const key = `${patientId}-${suspect.expected_hcc}-suspect`;
      if (seen.has(key)) continue;
      seen.add(key);

      const patientCurrent = currentPatientHCCs.get(patientId);
      if (patientCurrent && patientCurrent.has(suspect.expected_hcc)) continue;

      opportunities.push({
        id: `suspected-${patientId}-${suspect.expected_hcc}`,
        patient_id: patientId,
        encounter_id: null,
        date_of_service: new Date().toISOString().split('T')[0],
        opportunity_type: 'suspected_hcc',
        icd10_code: suspect.expected_icd10,
        icd10_description: suspect.condition,
        hcc_code: suspect.expected_hcc,
        hcc_description: category.description,
        hcc_coefficient: category.coefficient,
        raf_score_impact: category.coefficient,
        annual_payment_impact: category.coefficient * MA_BASE_PAYMENT,
        confidence: suspect.confidence,
        evidence_source: 'Medication Analysis',
        evidence_detail: `Patient is on ${med.medication_name} which suggests ${suspect.condition}, but no corresponding HCC diagnosis (${suspect.expected_hcc}) has been documented this year.`,
        status: 'open',
      });
    }
  }

  return opportunities;
}
