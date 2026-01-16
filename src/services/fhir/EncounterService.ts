/**
 * FHIR Encounter Service
 * Manages patient encounter records (visits, admissions, etc.) (FHIR R4)
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

export const EncounterService = {
  // Get encounters for a patient
  async getAll(
    patientId: string,
    options: { status?: string; class_code?: string } = {}
  ): Promise<EncounterRow[]> {
    // HIPAA §164.312(b): Log PHI access
    await auditLogger.phi('ENCOUNTER_LIST_READ', patientId, {
      resourceType: 'Encounter',
      operation: 'getAll',
      filters: options,
    });

    let query = supabase
      .from('encounters')
      .select('*')
      .eq('patient_id', patientId)
      .order('period_start', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.class_code) {
      query = query.eq('class_code', options.class_code);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as EncounterRow[]) || [];
  },

  // Get active encounters (status = 'in-progress')
  async getActive(patientId: string): Promise<EncounterRow[]> {
    // HIPAA §164.312(b): Log PHI access
    await auditLogger.phi('ENCOUNTER_ACTIVE_READ', patientId, {
      resourceType: 'Encounter',
      operation: 'getActive',
    });

    const { data, error } = await supabase
      .from('encounters')
      .select('*')
      .eq('patient_id', patientId)
      .in('status', ['arrived', 'triaged', 'in-progress', 'onleave'])
      .order('period_start', { ascending: false });

    if (error) throw error;
    return (data as EncounterRow[]) || [];
  },

  // Get by encounter class (inpatient, outpatient, emergency)
  async getByClass(patientId: string, classCode: string): Promise<EncounterRow[]> {
    // HIPAA §164.312(b): Log PHI access
    await auditLogger.phi('ENCOUNTER_BY_CLASS_READ', patientId, {
      resourceType: 'Encounter',
      operation: 'getByClass',
      classCode,
    });

    const { data, error } = await supabase
      .from('encounters')
      .select('*')
      .eq('patient_id', patientId)
      .eq('class_code', classCode)
      .order('period_start', { ascending: false });

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
      .select('*')
      .eq('patient_id', patientId)
      .gte('period_start', since.toISOString())
      .order('period_start', { ascending: false });

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
        classCode: encounter.class_code as string | undefined,
      });
    }

    const { data, error } = await supabase
      .from('encounters')
      .insert([encounter])
      .select()
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
      .select()
      .single();

    if (error) throw error;
    return data as EncounterRow;
  },

  // Complete encounter (set status to 'finished' and period_end)
  async complete(id: string): Promise<EncounterRow> {
    const { data, error } = await supabase
      .from('encounters')
      .update({
        status: 'finished',
        period_end: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as EncounterRow;
  },
};
