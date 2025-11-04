/**
 * FHIR DocumentReference Service
 * Manages clinical document references and attachments (FHIR R4)
 *
 * @see https://hl7.org/fhir/R4/documentreference.html
 */

import { supabase } from '../../lib/supabaseClient';

export const DocumentReferenceService = {
  // Get all documents for a patient
  async getAll(patientId: string, options: { type_code?: string; status?: string } = {}) {
    let query = supabase
      .from('document_references')
      .select('*')
      .eq('patient_id', patientId)
      .order('date', { ascending: false });

    if (options.type_code) {
      query = query.eq('type_code', options.type_code);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get by document type (clinical notes, discharge summaries, lab reports, etc.)
  async getByType(patientId: string, typeCode: string) {
    const { data, error } = await supabase
      .from('document_references')
      .select('*')
      .eq('patient_id', patientId)
      .eq('type_code', typeCode)
      .eq('status', 'current')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get clinical notes (LOINC codes: 11506-3, 34133-9, etc.)
  async getClinicalNotes(patientId: string) {
    const clinicalNoteCodes = [
      '11506-3', // Progress note
      '34133-9', // Summary of episode note
      '18842-5', // Discharge summary
      '28570-0', // Procedure note
      '11488-4', // Consultation note
    ];

    const { data, error } = await supabase
      .from('document_references')
      .select('*')
      .eq('patient_id', patientId)
      .in('type_code', clinicalNoteCodes)
      .eq('status', 'current')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get discharge summaries
  async getDischargeSummaries(patientId: string) {
    const { data, error } = await supabase
      .from('document_references')
      .select('*')
      .eq('patient_id', patientId)
      .eq('type_code', '18842-5') // LOINC code for discharge summary
      .eq('status', 'current')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get by encounter (documents associated with a specific encounter)
  async getByEncounter(encounterId: string) {
    const { data, error } = await supabase
      .from('document_references')
      .select('*')
      .contains('context', { encounter_id: encounterId })
      .eq('status', 'current')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Create document reference
  async create(document: any) {
    const { data, error } = await supabase
      .from('document_references')
      .insert([document])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update document reference
  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('document_references')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Supersede document (mark as superseded and create new version)
  async supersede(id: string, newDocument: any) {
    // Mark old document as superseded
    await supabase
      .from('document_references')
      .update({ status: 'superseded' })
      .eq('id', id);

    // Create new version
    const { data, error } = await supabase
      .from('document_references')
      .insert([{
        ...newDocument,
        related_to: [{ reference: id, display: 'Supersedes previous version' }]
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
