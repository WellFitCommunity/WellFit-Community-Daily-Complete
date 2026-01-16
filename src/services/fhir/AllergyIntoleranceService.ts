/**
 * FHIR AllergyIntolerance Service
 * Manages patient allergy and intolerance records (FHIR R4)
 *
 * HIPAA §164.312(b): PHI access logging enabled
 *
 * @see https://hl7.org/fhir/R4/allergyintolerance.html
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

export const AllergyIntoleranceService = {
  // Get all allergies for a patient
  async getAll(patientId: string) {
    // HIPAA §164.312(b): Log PHI access
    await auditLogger.phi('ALLERGY_LIST_READ', patientId, {
      resourceType: 'AllergyIntolerance',
      operation: 'getAll',
    });

    const { data, error } = await supabase
      .from('allergy_intolerances')
      .select('*')
      .eq('patient_id', patientId)
      .order('criticality', { ascending: false, nullsFirst: false })
      .order('allergen_name');

    if (error) throw error;
    return data || [];
  },

  // Get active allergies only (clinical_status = 'active')
  async getActive(patientId: string) {
    // HIPAA §164.312(b): Log PHI access
    await auditLogger.phi('ALLERGY_ACTIVE_READ', patientId, {
      resourceType: 'AllergyIntolerance',
      operation: 'getActive',
    });

    const { data, error } = await supabase
      .rpc('get_active_allergies', { user_id_param: patientId });

    if (error) throw error;
    return data || [];
  },

  // Get by allergen type
  async getByType(
    patientId: string,
    allergenType: 'medication' | 'food' | 'environment' | 'biologic'
  ) {
    // HIPAA §164.312(b): Log PHI access
    await auditLogger.phi('ALLERGY_BY_TYPE_READ', patientId, {
      resourceType: 'AllergyIntolerance',
      operation: 'getByType',
      allergenType,
    });

    const { data, error } = await supabase
      .from('allergy_intolerances')
      .select('*')
      .eq('patient_id', patientId)
      .eq('allergen_type', allergenType)
      .eq('clinical_status', 'active')
      .order('criticality', { ascending: false, nullsFirst: false });

    if (error) throw error;
    return data || [];
  },

  // Get high-risk allergies (criticality = 'high')
  async getHighRisk(patientId: string) {
    // HIPAA §164.312(b): Log PHI access
    await auditLogger.phi('ALLERGY_HIGH_RISK_READ', patientId, {
      resourceType: 'AllergyIntolerance',
      operation: 'getHighRisk',
    });

    const { data, error } = await supabase
      .from('allergy_intolerances')
      .select('*')
      .eq('patient_id', patientId)
      .eq('clinical_status', 'active')
      .eq('criticality', 'high')
      .order('allergen_name');

    if (error) throw error;
    return data || [];
  },

  // CRITICAL: Check if medication causes allergy
  async checkMedicationAllergy(patientId: string, medicationName: string) {
    // HIPAA §164.312(b): Log PHI access (critical safety check)
    await auditLogger.phi('ALLERGY_MEDICATION_CHECK', patientId, {
      resourceType: 'AllergyIntolerance',
      operation: 'checkMedicationAllergy',
      medicationName,
    });

    const { data, error } = await supabase
      .rpc('check_medication_allergy', {
        user_id_param: patientId,
        medication_name_param: medicationName
      });

    if (error) throw error;
    return data || [];
  },

  // Create new allergy
  async create(allergy: Record<string, unknown>) {
    // HIPAA §164.312(b): Log PHI write
    const patientId = allergy.patient_id as string | undefined;
    if (patientId) {
      await auditLogger.phi('ALLERGY_CREATE', patientId, {
        resourceType: 'AllergyIntolerance',
        operation: 'create',
        allergenName: allergy.allergen_name as string | undefined,
      });
    }

    const { data, error } = await supabase
      .from('allergy_intolerances')
      .insert([allergy])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update allergy
  async update(id: string, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete allergy (soft delete - set to 'entered-in-error')
  async delete(id: string) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .update({
        verification_status: 'entered-in-error',
        clinical_status: 'inactive'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
