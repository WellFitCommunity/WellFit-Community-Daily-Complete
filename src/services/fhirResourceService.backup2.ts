/**
 * FHIR Resource Service
 * Enterprise-grade service for managing FHIR R4 resources
 *
 * REFACTORED 2025-11-03: Core services split into modular files
 * This file now imports from /services/fhir/ and re-exports for backwards compatibility
 *
 * @see /src/services/fhir/README.md for architecture details
 */

// ============================================================================
// IMPORTS
// ============================================================================

// Core FHIR R4 Resource Services (extracted to separate files)
import {
  MedicationRequestService,
  ConditionService,
  DiagnosticReportService,
  ProcedureService,
  ObservationService,
  ImmunizationService,
  CarePlanService,
  CareTeamService,
  normalizeCondition,
  toFHIRCondition,
} from './fhir';

// Supabase and types for remaining services
import { supabase } from '../lib/supabaseClient';
import type {
  FHIRPractitioner,
  FHIRPractitionerRole,
  FHIRApiResponse,
} from '../types/fhir';

// ============================================================================
// RE-EXPORTS (for backwards compatibility)
// ============================================================================

export {
  MedicationRequestService,
  ConditionService,
  DiagnosticReportService,
  ProcedureService,
  ObservationService,
  ImmunizationService,
  CarePlanService,
  CareTeamService,
  normalizeCondition,
  toFHIRCondition,
};

// ============================================================================
// REMAINING SERVICES (kept in this file)
// ============================================================================

export const PractitionerService = {
  /**
   * Get all active practitioners
   */
  async getAll(): Promise<FHIRPractitioner[]> {
    const { data, error } = await supabase.rpc('get_active_practitioners');
    if (error) throw error;
    return data || [];
  },

  /**
   * Get practitioner by ID
   */
  async getById(id: string): Promise<FHIRPractitioner | null> {
    const { data, error } = await supabase
      .from('fhir_practitioners')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get practitioner by user ID
   */
  async getByUserId(userId: string): Promise<FHIRPractitioner | null> {
    const { data, error } = await supabase
      .from('fhir_practitioners')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" error
    return data;
  },

  /**
   * Get practitioner by NPI
   */
  async getByNPI(npi: string): Promise<FHIRPractitioner | null> {
    const { data, error } = await supabase.rpc('get_practitioner_by_npi', { p_npi: npi });
    if (error) throw error;
    return data?.[0] || null;
  },

  /**
   * Search practitioners by name, specialty, or NPI
   */
  async search(searchTerm: string): Promise<FHIRPractitioner[]> {
    const { data, error } = await supabase.rpc('search_practitioners', {
      p_search_term: searchTerm,
    });
    if (error) throw error;
    return data || [];
  },

  /**
   * Get practitioners by specialty
   */
  async getBySpecialty(specialty: string): Promise<FHIRPractitioner[]> {
    const { data, error } = await supabase.rpc('get_practitioners_by_specialty', {
      p_specialty: specialty,
    });
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new practitioner
   */
  async create(practitioner: Partial<FHIRPractitioner>): Promise<FHIRPractitioner> {
    const { data, error } = await supabase
      .from('fhir_practitioners')
      .insert({
        ...practitioner,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update practitioner
   */
  async update(id: string, updates: Partial<FHIRPractitioner>): Promise<FHIRPractitioner> {
    const { data, error } = await supabase
      .from('fhir_practitioners')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete practitioner (soft delete by setting active = false)
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('fhir_practitioners')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Hard delete practitioner (only for super admins)
   */
  async hardDelete(id: string): Promise<void> {
    const { error } = await supabase.from('fhir_practitioners').delete().eq('id', id);

    if (error) throw error;
  },

  /**
   * Validate NPI format (10 digits)
   */
  validateNPI(npi: string): boolean {
    return /^\d{10}$/.test(npi);
  },

  /**
   * Generate full name from name parts
   */
  getFullName(practitioner: FHIRPractitioner): string {
    const parts: string[] = [];

    if (practitioner.prefix?.length) {
      parts.push(practitioner.prefix.join(' '));
    }
    if (practitioner.given_names?.length) {
      parts.push(practitioner.given_names.join(' '));
    }
    if (practitioner.family_name) {
      parts.push(practitioner.family_name);
    }
    if (practitioner.suffix?.length) {
      parts.push(practitioner.suffix.join(', '));
    }

    return parts.join(' ').trim();
  },
};

// ============================================================================
// PRACTITIONER ROLE SERVICE
// ============================================================================

export const PractitionerRoleService = {
  /**
   * Get all roles for a practitioner
   */
  async getByPractitioner(practitionerId: string): Promise<FHIRPractitionerRole[]> {
    const { data, error } = await supabase.rpc('get_practitioner_roles', {
      p_practitioner_id: practitionerId,
    });
    if (error) throw error;
    return data || [];
  },

  /**
   * Get active roles for a practitioner
   */
  async getActiveByPractitioner(practitionerId: string): Promise<FHIRPractitionerRole[]> {
    const { data, error } = await supabase
      .from('fhir_practitioner_roles')
      .select('*')
      .eq('practitioner_id', practitionerId)
      .eq('active', true)
      .is('period_end', null)
      .or(`period_end.gte.${new Date().toISOString()}`);

    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new practitioner role
   */
  async create(role: Partial<FHIRPractitionerRole>): Promise<FHIRPractitionerRole> {
    const { data, error } = await supabase
      .from('fhir_practitioner_roles')
      .insert({
        ...role,
        period_start: role.period_start || new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update practitioner role
   */
  async update(id: string, updates: Partial<FHIRPractitionerRole>): Promise<FHIRPractitionerRole> {
    const { data, error } = await supabase
      .from('fhir_practitioner_roles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * End a practitioner role (set period_end to now)
   */
  async end(id: string): Promise<void> {
    const { error } = await supabase
      .from('fhir_practitioner_roles')
      .update({
        period_end: new Date().toISOString(),
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Delete practitioner role
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('fhir_practitioner_roles').delete().eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// ALLERGY INTOLERANCE SERVICE
// ============================================================================

export const AllergyIntoleranceService = {
  // Get all allergies for a patient
  async getAll(patientId: string) {
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
    const { data, error } = await supabase
      .rpc('get_active_allergies', { user_id_param: patientId });

    if (error) throw error;
    return data || [];
  },

  // Get by allergen type
  async getByType(patientId: string, allergenType: 'medication' | 'food' | 'environment' | 'biologic') {
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
    const { data, error } = await supabase
      .rpc('check_medication_allergy', {
        user_id_param: patientId,
        medication_name_param: medicationName
      });

    if (error) throw error;
    return data || [];
  },

  // Create new allergy
  async create(allergy: any) {
    const { data, error } = await supabase
      .from('allergy_intolerances')
      .insert([allergy])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update allergy
  async update(id: string, updates: any) {
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

// ============================================================================
// ENCOUNTER SERVICE
// ============================================================================

export const EncounterService = {
  // Get encounters for a patient
  async getAll(patientId: string, options: { status?: string; class_code?: string } = {}) {
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
    return data || [];
  },

  // Get active encounters (status = 'in-progress')
  async getActive(patientId: string) {
    const { data, error } = await supabase
      .from('encounters')
      .select('*')
      .eq('patient_id', patientId)
      .in('status', ['arrived', 'triaged', 'in-progress', 'onleave'])
      .order('period_start', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get by encounter class (inpatient, outpatient, emergency)
  async getByClass(patientId: string, classCode: string) {
    const { data, error } = await supabase
      .from('encounters')
      .select('*')
      .eq('patient_id', patientId)
      .eq('class_code', classCode)
      .order('period_start', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get recent encounters (last 30 days)
  async getRecent(patientId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('encounters')
      .select('*')
      .eq('patient_id', patientId)
      .gte('period_start', since.toISOString())
      .order('period_start', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Create encounter
  async create(encounter: any) {
    const { data, error } = await supabase
      .from('encounters')
      .insert([encounter])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update encounter
  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('encounters')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Complete encounter (set status to 'finished' and period_end)
  async complete(id: string) {
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
    return data;
  },
};

// ============================================================================
// DOCUMENT REFERENCE SERVICE
// ============================================================================

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

// ============================================================================
// INNOVATIVE: SDOH (SOCIAL DETERMINANTS OF HEALTH) SERVICE
// WellFit Differentiator: Built-in health equity screening
// ============================================================================

export const SDOHService = {
  // Screen patient for social determinants of health
  async screenPatient(patientId: string, screeningResponses: any[]) {
    const results = await Promise.all(
      screeningResponses.map((response) =>
        supabase.from('sdoh_observations').insert([{
          patient_id: patientId,
          ...response,
        }]).select().single()
      )
    );

    return results.map(r => r.data);
  },

  // Get all SDOH data for patient
  async getAll(patientId: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('*')
      .eq('patient_id', patientId)
      .order('effective_datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get SDOH by category (food, housing, transportation, etc.)
  async getByCategory(patientId: string, category: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('*')
      .eq('patient_id', patientId)
      .eq('category', category)
      .order('effective_datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get high-risk SDOH issues
  async getHighRisk(patientId: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('*')
      .eq('patient_id', patientId)
      .in('risk_level', ['high', 'critical'])
      .eq('status', 'final')
      .order('effective_datetime', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get SDOH issues needing intervention
  async getNeedingIntervention(patientId: string) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .select('*')
      .eq('patient_id', patientId)
      .eq('intervention_provided', false)
      .in('risk_level', ['moderate', 'high', 'critical'])
      .order('risk_level', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Record intervention/referral
  async recordIntervention(id: string, intervention: {
    intervention_provided: boolean;
    referral_made: boolean;
    referral_to?: string;
    follow_up_needed?: boolean;
    follow_up_date?: string;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .from('sdoh_observations')
      .update(intervention)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Calculate SDOH composite risk score
  async calculateRiskScore(patientId: string) {
    const { data, error } = await supabase
      .rpc('calculate_sdoh_risk_score', { p_patient_id: patientId });

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// INNOVATIVE: MEDICATION AFFORDABILITY SERVICE
// WellFit Differentiator: Real-time cost comparison + alternatives
// ============================================================================

export const MedicationAffordabilityService = {
  // Check medication affordability (integrates with pricing APIs)
  async checkAffordability(input: {
    patient_id: string;
    medication_name: string;
    rxnorm_code?: string;
    quantity: number;
    days_supply: number;
  }) {
    // This would integrate with GoodRx API, Cost Plus Drugs API, etc.
    // For now, we'll store the check and return mock data
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .insert([{
        ...input,
        checked_date: new Date().toISOString(),
        is_affordable: true, // Would be calculated based on patient income + price
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get affordability checks for patient
  async getChecks(patientId: string) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .select('*')
      .eq('patient_id', patientId)
      .order('checked_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Find unaffordable medications
  async getUnaffordable(patientId: string) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .select('*')
      .eq('patient_id', patientId)
      .eq('is_affordable', false)
      .order('checked_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get medications with patient assistance available
  async getWithAssistance(patientId: string) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .select('*')
      .eq('patient_id', patientId)
      .eq('patient_assistance_available', true)
      .order('checked_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Add therapeutic alternatives
  async addAlternatives(checkId: string, alternatives: any[]) {
    const { data, error } = await supabase
      .from('medication_affordability_checks')
      .update({ alternatives })
      .eq('id', checkId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// INNOVATIVE: CARE COORDINATION HUB SERVICE
// WellFit Differentiator: Real-time patient journey tracking
// ============================================================================

export const CareCoordinationService = {
  // Log care coordination event
  async logEvent(event: any) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .insert([event])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get patient's care journey (all events)
  async getPatientJourney(patientId: string, days: number = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .gte('event_timestamp', since.toISOString())
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get active care coordination issues
  async getActiveIssues(patientId: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .in('event_status', ['scheduled', 'in-progress'])
      .order('event_timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Get care gaps
  async getCareGaps(patientId: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .eq('care_gap_identified', true)
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get incomplete handoffs
  async getIncompleteHandoffs(patientId: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .eq('handoff_occurred', true)
      .in('handoff_quality', ['incomplete', 'missing-info'])
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get no-show appointments
  async getNoShows(patientId: string, days: number = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('care_coordination_events')
      .select('*')
      .eq('patient_id', patientId)
      .eq('event_type', 'appointment')
      .eq('event_status', 'no-show')
      .gte('event_timestamp', since.toISOString())
      .order('event_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Update event status
  async updateEventStatus(eventId: string, status: string, notes?: string) {
    const { data, error } = await supabase
      .from('care_coordination_events')
      .update({
        event_status: status,
        notes: notes || undefined,
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// INNOVATIVE: HEALTH EQUITY ANALYTICS SERVICE
// WellFit Differentiator: Bias detection & disparities tracking
// ============================================================================

export const HealthEquityService = {
  // Calculate health equity metrics for patient
  async calculateMetrics(patientId: string) {
    const { data, error } = await supabase
      .rpc('calculate_health_equity_metrics', { p_patient_id: patientId });

    if (error) throw error;
    return data;
  },

  // Get patients with disparities
  async getPatientsWithDisparities(options: {
    disparity_type?: 'access' | 'outcome' | 'utilization';
    insurance_type?: string;
  } = {}) {
    let query = supabase
      .from('health_equity_metrics')
      .select('*');

    if (options.disparity_type === 'access') {
      query = query.eq('has_access_disparity', true);
    } else if (options.disparity_type === 'outcome') {
      query = query.eq('has_outcome_disparity', true);
    } else if (options.disparity_type === 'utilization') {
      query = query.eq('has_utilization_disparity', true);
    }

    if (options.insurance_type) {
      query = query.eq('insurance_type', options.insurance_type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get equity interventions for patient
  async getInterventions(patientId: string) {
    const { data, error } = await supabase
      .from('health_equity_metrics')
      .select('equity_interventions')
      .eq('patient_id', patientId)
      .single();

    if (error) throw error;
    return data?.equity_interventions || [];
  },

  // Record equity intervention
  async recordIntervention(patientId: string, intervention: {
    intervention_type: string;
    intervention_date: string;
    outcome?: string;
  }) {
    // Append to existing interventions array
    const { data: current } = await supabase
      .from('health_equity_metrics')
      .select('equity_interventions')
      .eq('patient_id', patientId)
      .single();

    const interventions = current?.equity_interventions || [];
    interventions.push(intervention);

    const { data, error } = await supabase
      .from('health_equity_metrics')
      .update({ equity_interventions: interventions })
      .eq('patient_id', patientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Aggregate disparities by demographic
  async getDisparitiesByDemographic(demographic: 'age_group' | 'insurance_type' | 'preferred_language') {
    const { data, error } = await supabase
      .rpc('aggregate_disparities_by_demographic', { p_demographic: demographic });

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// GOAL SERVICE
// ============================================================================

export const GoalService = {
  /**
   * Get all goals for a patient
   */
  async getAll(patientId: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_goals')
        .select('*')
        .eq('patient_id', patientId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch goals',
      };
    }
  },

  /**
   * Get active goals
   */
  async getActive(patientId: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_goals')
        .select('*')
        .eq('patient_id', patientId)
        .in('lifecycle_status', ['proposed', 'planned', 'accepted', 'active'])
        .order('priority_code', { ascending: true, nullsFirst: false })
        .order('start_date', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch active goals',
      };
    }
  },

  /**
   * Get goals by category
   */
  async getByCategory(patientId: string, category: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_goals')
        .select('*')
        .eq('patient_id', patientId)
        .contains('category', [category])
        .order('start_date', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch goals by category',
      };
    }
  },

  /**
   * Create a new goal
   */
  async create(goal: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_goals')
        .insert([goal])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create goal',
      };
    }
  },

  /**
   * Update goal
   */
  async update(id: string, updates: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_goals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update goal',
      };
    }
  },

  /**
   * Complete goal
   */
  async complete(id: string): Promise<FHIRApiResponse<any>> {
    return this.update(id, {
      lifecycle_status: 'completed',
      status_date: new Date().toISOString(),
    });
  },
};

// ============================================================================
// LOCATION SERVICE
// ============================================================================

export const LocationService = {
  /**
   * Get all active locations
   */
  async getAll(): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch locations',
      };
    }
  },

  /**
   * Get location by ID
   */
  async getById(id: string): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch location',
      };
    }
  },

  /**
   * Get locations by type
   */
  async getByType(typeCode: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .select('*')
        .contains('type', [typeCode])
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch locations by type',
      };
    }
  },

  /**
   * Create location
   */
  async create(location: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .insert([location])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create location',
      };
    }
  },

  /**
   * Update location
   */
  async update(id: string, updates: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_locations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update location',
      };
    }
  },
};

// ============================================================================
// ORGANIZATION SERVICE
// ============================================================================

export const OrganizationService = {
  /**
   * Get all active organizations
   */
  async getAll(): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organizations',
      };
    }
  },

  /**
   * Get organization by ID
   */
  async getById(id: string): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organization',
      };
    }
  },

  /**
   * Get organization by NPI
   */
  async getByNPI(npi: string): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .eq('npi', npi)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organization by NPI',
      };
    }
  },

  /**
   * Search organizations by name
   */
  async search(searchTerm: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .select('*')
        .ilike('name', `%${searchTerm}%`)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search organizations',
      };
    }
  },

  /**
   * Create organization
   */
  async create(organization: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .insert([organization])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create organization',
      };
    }
  },

  /**
   * Update organization
   */
  async update(id: string, updates: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update organization',
      };
    }
  },
};

// ============================================================================
// MEDICATION SERVICE
// ============================================================================

export const MedicationService = {
  /**
   * Get medication by ID
   */
  async getById(id: string): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medications')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch medication',
      };
    }
  },

  /**
   * Get medication by RxNorm code
   */
  async getByRxNorm(rxnormCode: string): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medications')
        .select('*')
        .eq('code', rxnormCode)
        .eq('code_system', 'http://www.nlm.nih.gov/research/umls/rxnorm')
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch medication by RxNorm',
      };
    }
  },

  /**
   * Search medications by name
   */
  async search(searchTerm: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medications')
        .select('*')
        .ilike('code_display', `%${searchTerm}%`)
        .order('code_display');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search medications',
      };
    }
  },

  /**
   * Create medication
   */
  async create(medication: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medications')
        .insert([medication])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create medication',
      };
    }
  },

  /**
   * Update medication
   */
  async update(id: string, updates: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_medications')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update medication',
      };
    }
  },
};

// ============================================================================
// PROVENANCE SERVICE
// ============================================================================

export const ProvenanceService = {
  /**
   * Get provenance for a resource
   */
  async getForResource(resourceId: string, resourceType?: string): Promise<FHIRApiResponse<any[]>> {
    try {
      let query = supabase
        .from('fhir_provenance')
        .select('*')
        .contains('target_references', [resourceId])
        .order('recorded', { ascending: false });

      if (resourceType) {
        query = query.contains('target_types', [resourceType]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch provenance',
      };
    }
  },

  /**
   * Get provenance by agent (who did it)
   */
  async getByAgent(agentId: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_provenance')
        .select('*')
        .contains('agent', [{ who_id: agentId }])
        .order('recorded', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch provenance by agent',
      };
    }
  },

  /**
   * Get audit trail for patient
   */
  async getAuditTrail(patientId: string, days: number = 90): Promise<FHIRApiResponse<any[]>> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('fhir_provenance')
        .select('*')
        .contains('target_references', [patientId])
        .gte('recorded', since.toISOString())
        .order('recorded', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audit trail',
      };
    }
  },

  /**
   * Create provenance record
   */
  async create(provenance: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_provenance')
        .insert([{
          ...provenance,
          recorded: provenance.recorded || new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create provenance',
      };
    }
  },

  /**
   * Record audit event (helper method)
   */
  async recordAudit(params: {
    targetReferences: string[];
    targetTypes?: string[];
    activity: string;
    agentId: string;
    agentType?: string;
    agentRole?: string;
    onBehalfOfId?: string;
    reason?: string;
  }): Promise<FHIRApiResponse<any>> {
    const provenance = {
      target_references: params.targetReferences,
      target_types: params.targetTypes,
      recorded: new Date().toISOString(),
      activity: {
        code: params.activity,
        system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
      },
      agent: [{
        who_id: params.agentId,
        type: params.agentType ? {
          code: params.agentType,
          system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
        } : undefined,
        role: params.agentRole ? [{
          code: params.agentRole,
          system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
        }] : undefined,
        on_behalf_of_id: params.onBehalfOfId,
      }],
      reason: params.reason ? [{
        code: params.reason,
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
      }] : undefined,
    };

    return this.create(provenance);
  },
};

// ============================================================================
// UNIFIED FHIR SERVICE (Single Entry Point)
// ============================================================================

export const FHIRService = {
  // Core FHIR Resources (US Core - 13/13 COMPLETE)
  MedicationRequest: MedicationRequestService,
  Condition: ConditionService,
  DiagnosticReport: DiagnosticReportService,
  Procedure: ProcedureService,
  Observation: ObservationService,
  Immunization: ImmunizationService,
  CarePlan: CarePlanService,
  CareTeam: CareTeamService,
  Practitioner: PractitionerService,
  PractitionerRole: PractitionerRoleService,
  AllergyIntolerance: AllergyIntoleranceService,
  Encounter: EncounterService,
  DocumentReference: DocumentReferenceService,
  Goal: GoalService,
  Location: LocationService,
  Organization: OrganizationService,
  Medication: MedicationService,
  Provenance: ProvenanceService,

  // WellFit Innovative Services (Differentiators)
  SDOH: SDOHService,
  MedicationAffordability: MedicationAffordabilityService,
  CareCoordination: CareCoordinationService,
  HealthEquity: HealthEquityService,
};

export default FHIRService;
