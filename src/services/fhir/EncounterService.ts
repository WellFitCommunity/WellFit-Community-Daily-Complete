/**
 * FHIR Encounter Service
 * Manages patient encounter records (visits, admissions, etc.) (FHIR R4)
 *
 * Backing store: the operational `encounters` table. This is a thin data-access
 * layer that returns the operational column shape; the FHIR-resource transform
 * lives in the MCP FHIR server's bundle builder, not here. (Rewritten 2026-07-10
 * to end column drift — the prior FHIR-shaped column list — class_code,
 * period_start, reason_code, participant, hospitalization, … — existed in neither
 * `encounters` nor `fhir_encounters` and 42703'd on every call.)
 *
 * HIPAA §164.312(b): PHI access logging enabled
 *
 * @see https://hl7.org/fhir/R4/encounter.html
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

type EncounterRow = Record<string, unknown>;
type EncounterCreateInput = Record<string, unknown>;
type EncounterUpdateInput = Record<string, unknown>;

// Real column set on the operational `encounters` table (verified vs
// information_schema 2026-07-10). Keep in sync with the live schema.
const ENCOUNTER_COLUMNS =
  'id, patient_id, status, encounter_type, visit_mode, place_of_service, date_of_service, chief_complaint, provider_id, created_at, updated_at';

// "Active" = not yet closed out. Values drawn from the live status CHECK
// constraint (draft, scheduled, arrived, triaged, in_progress, ready_for_sign,
// signed, ready_for_billing, billed, completed, cancelled, no_show).
const ACTIVE_STATUSES = ['arrived', 'triaged', 'in_progress'];

export const EncounterService = {
  // Get encounters for a patient
  async getAll(
    patientId: string,
    options: { status?: string; encounter_type?: string } = {}
  ): Promise<EncounterRow[]> {
    // HIPAA §164.312(b): Log PHI access
    await auditLogger.phi('ENCOUNTER_LIST_READ', patientId, {
      resourceType: 'Encounter',
      operation: 'getAll',
      filters: options,
    });

    let query = supabase
      .from('encounters')
      .select(ENCOUNTER_COLUMNS)
      .eq('patient_id', patientId)
      .order('date_of_service', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.encounter_type) {
      query = query.eq('encounter_type', options.encounter_type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as EncounterRow[]) || [];
  },

  // Get active encounters (not yet closed out)
  async getActive(patientId: string): Promise<EncounterRow[]> {
    // HIPAA §164.312(b): Log PHI access
    await auditLogger.phi('ENCOUNTER_ACTIVE_READ', patientId, {
      resourceType: 'Encounter',
      operation: 'getActive',
    });

    const { data, error } = await supabase
      .from('encounters')
      .select(ENCOUNTER_COLUMNS)
      .eq('patient_id', patientId)
      .in('status', ACTIVE_STATUSES)
      .order('date_of_service', { ascending: false });

    if (error) throw error;
    return (data as EncounterRow[]) || [];
  },

  // Get by encounter type (e.g. follow_up, new_patient)
  async getByType(patientId: string, encounterType: string): Promise<EncounterRow[]> {
    // HIPAA §164.312(b): Log PHI access
    await auditLogger.phi('ENCOUNTER_BY_TYPE_READ', patientId, {
      resourceType: 'Encounter',
      operation: 'getByType',
      encounterType,
    });

    const { data, error } = await supabase
      .from('encounters')
      .select(ENCOUNTER_COLUMNS)
      .eq('patient_id', patientId)
      .eq('encounter_type', encounterType)
      .order('date_of_service', { ascending: false });

    if (error) throw error;
    return (data as EncounterRow[]) || [];
  },

  // Get recent encounters (last N days)
  async getRecent(patientId: string, days = 30): Promise<EncounterRow[]> {
    // HIPAA §164.312(b): Log PHI access
    await auditLogger.phi('ENCOUNTER_RECENT_READ', patientId, {
      resourceType: 'Encounter',
      operation: 'getRecent',
      daysBack: days,
    });

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('encounters')
      .select(ENCOUNTER_COLUMNS)
      .eq('patient_id', patientId)
      .gte('date_of_service', since.toISOString())
      .order('date_of_service', { ascending: false });

    if (error) throw error;
    return (data as EncounterRow[]) || [];
  },

  // Create encounter
  async create(encounter: EncounterCreateInput): Promise<EncounterRow> {
    // HIPAA §164.312(b): Log PHI write
    const patientId = encounter.patient_id as string | undefined;
    if (patientId) {
      await auditLogger.phi('ENCOUNTER_CREATE', patientId, {
        resourceType: 'Encounter',
        operation: 'create',
        encounterType: encounter.encounter_type as string | undefined,
      });
    }

    const { data, error } = await supabase
      .from('encounters')
      .insert([encounter])
      .select(ENCOUNTER_COLUMNS)
      .single();

    if (error) throw error;
    return data as EncounterRow;
  },

  // Update encounter
  async update(id: string, updates: EncounterUpdateInput): Promise<EncounterRow> {
    const { data, error } = await supabase
      .from('encounters')
      .update(updates)
      .eq('id', id)
      .select(ENCOUNTER_COLUMNS)
      .single();

    if (error) throw error;
    return data as EncounterRow;
  },

  // Complete encounter (set status to 'completed' and stamp visit end)
  async complete(id: string): Promise<EncounterRow> {
    const { data, error } = await supabase
      .from('encounters')
      .update({
        status: 'completed',
        visit_ended_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(ENCOUNTER_COLUMNS)
      .single();

    if (error) throw error;
    return data as EncounterRow;
  },
};
