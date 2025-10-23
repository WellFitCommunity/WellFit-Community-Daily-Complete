// Encounter management service for WellFit Community
// Handles patient encounters and clinical data for billing

import { supabase } from '../lib/supabaseClient';
import { logPhiAccess, extractPatientId } from './phiAccessLogger';
import type {
  Encounter,
  EncounterProcedure,
  EncounterDiagnosis,
  Patient,
  CreateEncounter,
} from '../types/billing';

export class EncounterService {
  // Core Encounter Management
  static async createEncounter(encounter: CreateEncounter): Promise<Encounter> {
    const { data, error } = await supabase
      .from('encounters')
      .insert(encounter)
      .select()
      .single();

    if (error) throw new Error(`Failed to create encounter: ${error.message}`);

    // HIPAA §164.312(b): Log PHI access
    await logPhiAccess({
      phiType: 'encounter',
      phiResourceId: data.id,
      patientId: encounter.patient_id,
      accessType: 'create',
      accessMethod: 'API',
      purpose: 'treatment',
    });

    return data;
  }

  static async getEncounter(id: string): Promise<Encounter> {
    const { data, error } = await supabase
      .from('encounters')
      .select(`
        *,
        patient:patients(*),
        provider:billing_providers(*),
        procedures:encounter_procedures(*),
        diagnoses:encounter_diagnoses(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to get encounter: ${error.message}`);

    // HIPAA §164.312(b): Log PHI access
    const patientId = extractPatientId(data);
    if (patientId) {
      await logPhiAccess({
        phiType: 'encounter',
        phiResourceId: id,
        patientId,
        accessType: 'view',
        accessMethod: 'API',
        purpose: 'treatment',
      });
    }

    return this.transformEncounterData(data);
  }

  static async getEncountersByPatient(patientId: string): Promise<Encounter[]> {
    const { data, error } = await supabase
      .from('encounters')
      .select(`
        *,
        patient:patients(*),
        provider:billing_providers(*),
        procedures:encounter_procedures(*),
        diagnoses:encounter_diagnoses(*)
      `)
      .eq('patient_id', patientId)
      .order('date_of_service', { ascending: false });

    if (error) throw new Error(`Failed to get encounters: ${error.message}`);

    // HIPAA §164.312(b): Log bulk PHI access
    if (data && data.length > 0) {
      await logPhiAccess({
        phiType: 'encounter',
        phiResourceId: `patient_${patientId}_encounters`,
        patientId,
        accessType: 'view',
        accessMethod: 'API',
        purpose: 'treatment',
      });
    }

    return (data || []).map(this.transformEncounterData);
  }

  static async updateEncounter(id: string, updates: Partial<CreateEncounter>): Promise<Encounter> {
    const { data, error } = await supabase
      .from('encounters')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update encounter: ${error.message}`);

    // HIPAA §164.312(b): Log PHI access
    const patientId = extractPatientId(data);
    if (patientId) {
      await logPhiAccess({
        phiType: 'encounter',
        phiResourceId: id,
        patientId,
        accessType: 'update',
        accessMethod: 'API',
        purpose: 'treatment',
      });
    }

    return data;
  }

  // Encounter Procedures
  static async addProcedure(
    encounterId: string,
    procedure: Omit<EncounterProcedure, 'id' | 'encounter_id'>
  ): Promise<EncounterProcedure> {
    const { data, error } = await supabase
      .from('encounter_procedures')
      .insert({
        encounter_id: encounterId,
        ...procedure,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add procedure: ${error.message}`);
    return data;
  }

  static async updateProcedure(
    procedureId: string,
    updates: Partial<EncounterProcedure>
  ): Promise<EncounterProcedure> {
    const { data, error } = await supabase
      .from('encounter_procedures')
      .update(updates)
      .eq('id', procedureId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update procedure: ${error.message}`);
    return data;
  }

  static async removeProcedure(procedureId: string): Promise<void> {
    const { error } = await supabase
      .from('encounter_procedures')
      .delete()
      .eq('id', procedureId);

    if (error) throw new Error(`Failed to remove procedure: ${error.message}`);
  }

  static async getProcedures(encounterId: string): Promise<EncounterProcedure[]> {
    const { data, error } = await supabase
      .from('encounter_procedures')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('service_date');

    if (error) throw new Error(`Failed to get procedures: ${error.message}`);
    return data || [];
  }

  // Encounter Diagnoses
  static async addDiagnosis(
    encounterId: string,
    diagnosis: Omit<EncounterDiagnosis, 'id' | 'encounter_id'>
  ): Promise<EncounterDiagnosis> {
    const { data, error } = await supabase
      .from('encounter_diagnoses')
      .insert({
        encounter_id: encounterId,
        ...diagnosis,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add diagnosis: ${error.message}`);
    return data;
  }

  static async updateDiagnosis(
    diagnosisId: string,
    updates: Partial<EncounterDiagnosis>
  ): Promise<EncounterDiagnosis> {
    const { data, error } = await supabase
      .from('encounter_diagnoses')
      .update(updates)
      .eq('id', diagnosisId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update diagnosis: ${error.message}`);
    return data;
  }

  static async removeDiagnosis(diagnosisId: string): Promise<void> {
    const { error } = await supabase
      .from('encounter_diagnoses')
      .delete()
      .eq('id', diagnosisId);

    if (error) throw new Error(`Failed to remove diagnosis: ${error.message}`);
  }

  static async getDiagnoses(encounterId: string): Promise<EncounterDiagnosis[]> {
    const { data, error } = await supabase
      .from('encounter_diagnoses')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('sequence');

    if (error) throw new Error(`Failed to get diagnoses: ${error.message}`);
    return data || [];
  }

  // Patient Management
  static async createPatient(
    patient: Omit<Patient, 'id'>
  ): Promise<Patient> {
    const { data, error } = await supabase
      .from('patients')
      .insert(patient)
      .select()
      .single();

    if (error) throw new Error(`Failed to create patient: ${error.message}`);
    return data;
  }

  static async getPatient(id: string): Promise<Patient> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to get patient: ${error.message}`);
    return data;
  }

  static async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient> {
    const { data, error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update patient: ${error.message}`);
    return data;
  }

  static async searchPatients(query: string): Promise<Patient[]> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,member_id.ilike.%${query}%`)
      .limit(20);

    if (error) throw new Error(`Failed to search patients: ${error.message}`);
    return data || [];
  }

  // Clinical Documentation
  static async addClinicalNote(
    encounterId: string,
    note: {
      type: 'assessment' | 'plan' | 'subjective' | 'objective' | 'general';
      content: string;
      author_id?: string;
    }
  ): Promise<any> {
    const { data, error } = await supabase
      .from('clinical_notes')
      .insert({
        encounter_id: encounterId,
        ...note,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add clinical note: ${error.message}`);
    return data;
  }

  static async getClinicalNotes(encounterId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('clinical_notes')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('created_at');

    if (error) throw new Error(`Failed to get clinical notes: ${error.message}`);
    return data || [];
  }

  // Billing Integration Helper
  static async getEncounterForBilling(encounterId: string): Promise<{
    encounter: Encounter;
    procedures: EncounterProcedure[];
    diagnoses: EncounterDiagnosis[];
    patient: Patient;
    totalCharges: number;
  }> {
    const encounter = await this.getEncounter(encounterId);
    const procedures = await this.getProcedures(encounterId);
    const diagnoses = await this.getDiagnoses(encounterId);

    if (!encounter.patient) {
      throw new Error('Patient data not found for encounter');
    }

    const totalCharges = procedures.reduce(
      (sum, proc) => sum + (Number(proc.charge_amount) || 0),
      0
    );

    return {
      encounter,
      procedures,
      diagnoses,
      patient: encounter.patient,
      totalCharges,
    };
  }

  // Validation Helpers
  static validateEncounterForBilling(encounter: Encounter): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!encounter.patient_id) errors.push('Patient ID is required');
    if (!encounter.date_of_service) errors.push('Date of service is required');
    if (!encounter.payer_id) errors.push('Payer is required');

    if (!encounter.procedures || encounter.procedures.length === 0) {
      errors.push('At least one procedure is required');
    }

    if (!encounter.diagnoses || encounter.diagnoses.length === 0) {
      errors.push('At least one diagnosis is required');
    }

    // Validate procedure codes and charges
    encounter.procedures?.forEach((proc, index) => {
      if (!proc.code) errors.push(`Procedure ${index + 1}: Code is required`);
      if (!proc.charge_amount || proc.charge_amount <= 0) {
        errors.push(`Procedure ${index + 1}: Valid charge amount is required`);
      }
    });

    // Validate diagnosis codes
    encounter.diagnoses?.forEach((diag, index) => {
      if (!diag.code) errors.push(`Diagnosis ${index + 1}: Code is required`);
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Utility Methods
  static calculateEncounterTotal(procedures: EncounterProcedure[]): number {
    return procedures.reduce((sum, proc) => {
      const amount = Number(proc.charge_amount) || 0;
      const units = Number(proc.units) || 1;
      return sum + (amount * units);
    }, 0);
  }

  static generateEncounterSummary(encounter: Encounter): string {
    const patientName = encounter.patient
      ? `${encounter.patient.first_name || ''} ${encounter.patient.last_name || ''}`.trim()
      : 'Unknown Patient';

    const serviceDate = new Date(encounter.date_of_service).toLocaleDateString();
    const procedureCount = encounter.procedures?.length || 0;
    const diagnosisCount = encounter.diagnoses?.length || 0;

    return `${patientName} - ${serviceDate} (${procedureCount} procedures, ${diagnosisCount} diagnoses)`;
  }

  // Private helper methods
  private static transformEncounterData(rawData: any): Encounter {
    return {
      ...rawData,
      patient: rawData.patient || null,
      provider: rawData.provider || null,
      procedures: rawData.procedures || [],
      diagnoses: rawData.diagnoses || [],
    };
  }

  // Advanced Search and Filtering
  static async searchEncounters(filters: {
    patientId?: string;
    providerId?: string;
    payerId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    limit?: number;
  }): Promise<Encounter[]> {
    let query = supabase
      .from('encounters')
      .select(`
        *,
        patient:patients(*),
        provider:billing_providers(*),
        procedures:encounter_procedures(*),
        diagnoses:encounter_diagnoses(*)
      `);

    if (filters.patientId) query = query.eq('patient_id', filters.patientId);
    if (filters.providerId) query = query.eq('provider_id', filters.providerId);
    if (filters.payerId) query = query.eq('payer_id', filters.payerId);
    if (filters.dateFrom) query = query.gte('date_of_service', filters.dateFrom);
    if (filters.dateTo) query = query.lte('date_of_service', filters.dateTo);

    if (filters.limit) query = query.limit(filters.limit);

    query = query.order('date_of_service', { ascending: false });

    const { data, error } = await query;

    if (error) throw new Error(`Failed to search encounters: ${error.message}`);
    return (data || []).map(this.transformEncounterData);
  }
}

export default EncounterService;