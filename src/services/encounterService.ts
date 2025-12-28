// Encounter management service for WellFit Community
// Handles patient encounters and clinical data for billing

import { supabase } from '../lib/supabaseClient';
import { logPhiAccess, extractPatientId } from './phiAccessLogger';
import { InputValidator } from './inputValidator';
import { auditLogger } from './auditLogger';
import { getErrorMessage as _getErrorMessage } from '../lib/getErrorMessage';
import type {
  Encounter,
  EncounterProcedure,
  EncounterDiagnosis,
  Patient,
  CreateEncounter,
} from '../types/billing';

type ClinicalNoteRecord = Record<string, unknown>;
type ClinicalNotesQueryResult = ClinicalNoteRecord[];

type EncounterRow = Record<string, unknown>;

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
      phiResourceId: (data as { id?: string }).id ?? '',
      patientId: encounter.patient_id,
      accessType: 'create',
      accessMethod: 'API',
      purpose: 'treatment',
    });

    return data as Encounter;
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
    const patientId = extractPatientId(data as EncounterRow);
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

    return this.transformEncounterData(data as EncounterRow);
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

    return (data || []).map((row) => this.transformEncounterData(row as EncounterRow));
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
    const patientId = extractPatientId(data as EncounterRow);
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

    return data as Encounter;
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
    return data as EncounterProcedure;
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
    return data as EncounterProcedure;
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
    return (data || []) as EncounterProcedure[];
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
    return data as EncounterDiagnosis;
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
    return data as EncounterDiagnosis;
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
    return (data || []) as EncounterDiagnosis[];
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
    return data as Patient;
  }

  static async getPatient(id: string): Promise<Patient> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to get patient: ${error.message}`);
    return data as Patient;
  }

  static async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient> {
    const { data, error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update patient: ${error.message}`);
    return data as Patient;
  }

  static async searchPatients(query: string): Promise<Patient[]> {
    // SECURITY: Sanitize input to prevent SQL injection (HIPAA §164.312(a)(1))
    // Remove special characters that could be used for injection: %, ,, ;, etc.
    const sanitized = InputValidator.sanitizeText(query, 100)
      .replace(/[%,;'"\\]/g, '')
      .trim();

    // Require minimum 2 characters to prevent full table scans
    if (sanitized.length < 2) {
      return [];
    }

    // HIPAA §164.312(b): Audit patient search operations
    await auditLogger.info('PATIENT_SEARCH', {
      event_category: 'PHI_ACCESS',
      operation: 'search',
      resource_type: 'patients',
      metadata: {
        search_length: sanitized.length,
        query_sanitized: true
      },
      success: true
    });

    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .or(`first_name.ilike.%${sanitized}%,last_name.ilike.%${sanitized}%,member_id.ilike.%${sanitized}%`)
      .limit(20);

    if (error) throw new Error(`Failed to search patients: ${error.message}`);
    return (data || []) as Patient[];
  }

  // Clinical Documentation
  static async addClinicalNote(
    encounterId: string,
    note: {
      type: 'assessment' | 'plan' | 'subjective' | 'objective' | 'general';
      content: string;
      author_id?: string;
    }
  ): Promise<ClinicalNoteRecord> {
    const { data, error } = await supabase
      .from('clinical_notes')
      .insert({
        encounter_id: encounterId,
        ...note,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add clinical note: ${error.message}`);
    return (data || {}) as ClinicalNoteRecord;
  }

  static async getClinicalNotes(encounterId: string): Promise<ClinicalNotesQueryResult> {
    const { data, error } = await supabase
      .from('clinical_notes')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('created_at');

    if (error) throw new Error(`Failed to get clinical notes: ${error.message}`);
    return (data || []) as ClinicalNotesQueryResult;
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
private static transformEncounterData(rawData: EncounterRow): Encounter {
  const patient = rawData.patient;
  const provider = rawData.provider;
  const procedures = rawData.procedures;
  const diagnoses = rawData.diagnoses;

  return {
    ...(rawData as unknown as Encounter),
    patient: patient as Encounter['patient'],
    provider: provider as Encounter['provider'],
    procedures: Array.isArray(procedures)
      ? (procedures as unknown as EncounterProcedure[])
      : [],
    diagnoses: Array.isArray(diagnoses)
      ? (diagnoses as unknown as EncounterDiagnosis[])
      : [],
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
    return (data || []).map((row) => this.transformEncounterData(row as EncounterRow));
  }
}

export default EncounterService;
