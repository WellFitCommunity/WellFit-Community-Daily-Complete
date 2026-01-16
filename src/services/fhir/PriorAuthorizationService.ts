/**
 * FHIR Prior Authorization Service
 * CMS-0057-F Compliant Prior Authorization API
 *
 * FHIR R4 Resource: Claim (for Prior Authorization Request)
 * Da Vinci PAS Implementation Guide compliant
 *
 * Purpose: Automates end-to-end prior authorization workflow
 * - Submit prior authorization requests
 * - Track authorization status
 * - Handle approvals/denials
 * - Manage appeals
 *
 * CMS Response Time Requirements:
 * - Expedited (urgent): 72 hours
 * - Standard (routine): 7 calendar days
 *
 * @see https://hl7.org/fhir/us/davinci-pas/
 * @see https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f
 */

import { supabase } from '../../lib/supabaseClient';
import { getErrorMessage } from '../../lib/getErrorMessage';
import { auditLogger } from '../auditLogger';

// =====================================================
// Types
// =====================================================

export type PriorAuthStatus =
  | 'draft'
  | 'pending_submission'
  | 'submitted'
  | 'pending_review'
  | 'approved'
  | 'denied'
  | 'partial_approval'
  | 'pending_additional_info'
  | 'cancelled'
  | 'expired'
  | 'appealed';

export type PriorAuthUrgency = 'stat' | 'urgent' | 'routine';

export type PriorAuthDecisionType = 'approved' | 'denied' | 'partial_approval' | 'pended' | 'cancelled';

export type AppealStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'peer_to_peer_scheduled'
  | 'peer_to_peer_completed'
  | 'approved'
  | 'denied'
  | 'withdrawn';

export interface PriorAuthServiceLine {
  line_number: number;
  cpt_code: string;
  cpt_description?: string;
  modifier_codes?: string[];
  diagnosis_pointers?: number[];
  requested_units: number;
  approved_units?: number;
  unit_type?: string;
  service_date?: string;
  service_start_date?: string;
  service_end_date?: string;
  line_status?: string;
  denial_reason?: string;
}

export interface PriorAuthorization {
  id: string;
  patient_id: string;
  encounter_id?: string;
  claim_id?: string;
  ordering_provider_npi?: string;
  rendering_provider_npi?: string;
  facility_npi?: string;
  payer_id: string;
  payer_name?: string;
  member_id?: string;
  group_number?: string;
  auth_number?: string;
  reference_number?: string;
  trace_number?: string;
  service_type_code?: string;
  service_type_description?: string;
  service_codes: string[];
  diagnosis_codes: string[];
  date_of_service?: string;
  service_start_date?: string;
  service_end_date?: string;
  submitted_at?: string;
  decision_due_at?: string;
  approved_at?: string;
  expires_at?: string;
  status: PriorAuthStatus;
  urgency: PriorAuthUrgency;
  clinical_notes?: string;
  clinical_summary?: string;
  documentation_submitted?: string[];
  requested_units?: number;
  approved_units?: number;
  unit_type?: string;
  fhir_resource_id?: string;
  fhir_resource_version?: number;
  lcd_references?: string[];
  ncd_references?: string[];
  response_time_hours?: number;
  sla_met?: boolean;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  service_lines?: PriorAuthServiceLine[];
}

export interface PriorAuthDecision {
  id: string;
  prior_auth_id: string;
  decision_type: PriorAuthDecisionType;
  decision_date: string;
  decision_reason?: string;
  decision_code?: string;
  auth_number?: string;
  approved_units?: number;
  approved_start_date?: string;
  approved_end_date?: string;
  denial_reason_code?: string;
  denial_reason_description?: string;
  appeal_deadline?: string;
  response_payload?: Record<string, unknown>;
  x12_278_response?: string;
  reviewer_name?: string;
  reviewer_npi?: string;
  created_at: string;
  tenant_id: string;
}

export interface PriorAuthAppeal {
  id: string;
  prior_auth_id: string;
  decision_id?: string;
  appeal_level: number;
  status: AppealStatus;
  appeal_reason: string;
  appeal_type?: string;
  submitted_at?: string;
  deadline_at?: string;
  resolved_at?: string;
  peer_to_peer_scheduled_at?: string;
  peer_to_peer_completed_at?: string;
  peer_to_peer_outcome?: string;
  additional_documentation?: string[];
  clinical_rationale?: string;
  outcome?: PriorAuthDecisionType;
  outcome_notes?: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

export interface PriorAuthDocument {
  id: string;
  prior_auth_id: string;
  document_type: string;
  document_name: string;
  document_description?: string;
  file_path?: string;
  file_size_bytes?: number;
  mime_type?: string;
  uploaded_at: string;
  submitted_to_payer: boolean;
  submitted_at?: string;
  tenant_id: string;
}

export interface PriorAuthStatusHistory {
  id: string;
  prior_auth_id: string;
  old_status?: PriorAuthStatus;
  new_status: PriorAuthStatus;
  status_reason?: string;
  changed_by?: string;
  changed_at: string;
  tenant_id: string;
}

export interface PriorAuthStatistics {
  total_submitted: number;
  total_approved: number;
  total_denied: number;
  total_pending: number;
  approval_rate: number;
  avg_response_hours: number;
  sla_compliance_rate: number;
  by_urgency: Record<string, { total: number; approved: number; denied: number }>;
}

export interface PriorAuthClaimCheck {
  requires_prior_auth: boolean;
  existing_auth_id?: string;
  existing_auth_number?: string;
  auth_status?: PriorAuthStatus;
  auth_expires_at?: string;
  missing_codes: string[];
}

export interface FHIRApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreatePriorAuthInput {
  patient_id: string;
  payer_id: string;
  service_codes: string[];
  diagnosis_codes: string[];
  urgency?: PriorAuthUrgency;
  ordering_provider_npi?: string;
  rendering_provider_npi?: string;
  facility_npi?: string;
  payer_name?: string;
  member_id?: string;
  group_number?: string;
  date_of_service?: string;
  service_start_date?: string;
  service_end_date?: string;
  clinical_notes?: string;
  clinical_summary?: string;
  requested_units?: number;
  unit_type?: string;
  encounter_id?: string;
  claim_id?: string;
  tenant_id: string;
  created_by?: string;
}

export interface SubmitPriorAuthInput {
  id: string;
  updated_by?: string;
}

export interface RecordDecisionInput {
  prior_auth_id: string;
  decision_type: PriorAuthDecisionType;
  decision_reason?: string;
  decision_code?: string;
  auth_number?: string;
  approved_units?: number;
  approved_start_date?: string;
  approved_end_date?: string;
  denial_reason_code?: string;
  denial_reason_description?: string;
  appeal_deadline?: string;
  response_payload?: Record<string, unknown>;
  x12_278_response?: string;
  reviewer_name?: string;
  reviewer_npi?: string;
  tenant_id: string;
  created_by?: string;
}

export interface CreateAppealInput {
  prior_auth_id: string;
  decision_id?: string;
  appeal_reason: string;
  appeal_type?: string;
  additional_documentation?: string[];
  clinical_rationale?: string;
  tenant_id: string;
  created_by?: string;
}

// =====================================================
// FHIR Prior Authorization Service
// =====================================================

export class PriorAuthorizationService {
  // =====================================================
  // CRUD Operations
  // =====================================================

  /**
   * Create a new prior authorization request
   */
  static async create(input: CreatePriorAuthInput): Promise<FHIRApiResponse<PriorAuthorization>> {
    try {
      await auditLogger.phi('PRIOR_AUTH_CREATE_START', input.patient_id, {
        payer_id: input.payer_id,
        service_codes: input.service_codes,
        urgency: input.urgency || 'routine'
      });

      const { data, error } = await supabase
        .from('prior_authorizations')
        .insert({
          ...input,
          status: 'draft',
          urgency: input.urgency || 'routine'
        })
        .select()
        .single();

      if (error) throw error;

      await auditLogger.phi('PRIOR_AUTH_CREATED', input.patient_id, {
        prior_auth_id: data.id
      });

      return { success: true, data: data as PriorAuthorization };
    } catch (err: unknown) {
      await auditLogger.error('PRIOR_AUTH_CREATE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patient_id: input.patient_id }
      );
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to create prior authorization'
      };
    }
  }

  /**
   * Get prior authorization by ID
   */
  static async getById(id: string): Promise<FHIRApiResponse<PriorAuthorization | null>> {
    try {
      const { data, error } = await supabase
        .from('prior_authorizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: null };
        }
        throw error;
      }

      return { success: true, data: data as PriorAuthorization };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch prior authorization'
      };
    }
  }

  /**
   * Get prior authorization by auth number
   */
  static async getByAuthNumber(authNumber: string): Promise<FHIRApiResponse<PriorAuthorization | null>> {
    try {
      const { data, error } = await supabase
        .from('prior_authorizations')
        .select('*')
        .eq('auth_number', authNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: null };
        }
        throw error;
      }

      return { success: true, data: data as PriorAuthorization };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch prior authorization'
      };
    }
  }

  /**
   * Get all prior authorizations for a patient
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<PriorAuthorization[]>> {
    try {
      const { data, error } = await supabase
        .from('prior_authorizations')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: (data as PriorAuthorization[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch prior authorizations'
      };
    }
  }

  /**
   * Get pending prior authorizations
   */
  static async getPending(tenantId: string): Promise<FHIRApiResponse<PriorAuthorization[]>> {
    try {
      const { data, error } = await supabase
        .from('prior_authorizations')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['submitted', 'pending_review', 'pending_additional_info'])
        .order('decision_due_at', { ascending: true });

      if (error) throw error;
      return { success: true, data: (data as PriorAuthorization[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch pending prior authorizations'
      };
    }
  }

  /**
   * Update prior authorization
   */
  static async update(
    id: string,
    updates: Partial<PriorAuthorization>
  ): Promise<FHIRApiResponse<PriorAuthorization>> {
    try {
      const { data, error } = await supabase
        .from('prior_authorizations')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await auditLogger.phi('PRIOR_AUTH_UPDATED', id, {
        updates: Object.keys(updates)
      });

      return { success: true, data: data as PriorAuthorization };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to update prior authorization'
      };
    }
  }

  // =====================================================
  // Workflow Operations
  // =====================================================

  /**
   * Submit prior authorization to payer
   * Generates auth number and sets deadline based on urgency
   */
  static async submit(input: SubmitPriorAuthInput): Promise<FHIRApiResponse<PriorAuthorization>> {
    try {
      const now = new Date();
      const authNumber = `PA-${now.getTime()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const traceNumber = `TRN-${now.getTime()}`;

      await auditLogger.phi('PRIOR_AUTH_SUBMIT_START', input.id);

      const { data, error } = await supabase
        .from('prior_authorizations')
        .update({
          status: 'submitted',
          auth_number: authNumber,
          trace_number: traceNumber,
          submitted_at: now.toISOString(),
          updated_by: input.updated_by,
          updated_at: now.toISOString()
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;

      await auditLogger.phi('PRIOR_AUTH_SUBMITTED', input.id, {
        auth_number: authNumber,
        urgency: data.urgency,
        decision_due_at: data.decision_due_at
      });

      return { success: true, data: data as PriorAuthorization };
    } catch (err: unknown) {
      await auditLogger.error('PRIOR_AUTH_SUBMIT_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { prior_auth_id: input.id }
      );
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to submit prior authorization'
      };
    }
  }

  /**
   * Cancel prior authorization
   */
  static async cancel(id: string, reason?: string, updatedBy?: string): Promise<FHIRApiResponse<PriorAuthorization>> {
    try {
      const { data, error } = await supabase
        .from('prior_authorizations')
        .update({
          status: 'cancelled',
          clinical_notes: reason,
          updated_by: updatedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await auditLogger.phi('PRIOR_AUTH_CANCELLED', id, { reason });

      return { success: true, data: data as PriorAuthorization };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to cancel prior authorization'
      };
    }
  }

  // =====================================================
  // Decision Operations
  // =====================================================

  /**
   * Record payer decision on prior authorization
   */
  static async recordDecision(input: RecordDecisionInput): Promise<FHIRApiResponse<PriorAuthDecision>> {
    try {
      await auditLogger.phi('PRIOR_AUTH_DECISION_START', input.prior_auth_id, {
        decision_type: input.decision_type
      });

      // Insert decision record
      const { data: decision, error: decisionError } = await supabase
        .from('prior_auth_decisions')
        .insert({
          prior_auth_id: input.prior_auth_id,
          decision_type: input.decision_type,
          decision_date: new Date().toISOString(),
          decision_reason: input.decision_reason,
          decision_code: input.decision_code,
          auth_number: input.auth_number,
          approved_units: input.approved_units,
          approved_start_date: input.approved_start_date,
          approved_end_date: input.approved_end_date,
          denial_reason_code: input.denial_reason_code,
          denial_reason_description: input.denial_reason_description,
          appeal_deadline: input.appeal_deadline,
          response_payload: input.response_payload,
          x12_278_response: input.x12_278_response,
          reviewer_name: input.reviewer_name,
          reviewer_npi: input.reviewer_npi,
          tenant_id: input.tenant_id,
          created_by: input.created_by
        })
        .select()
        .single();

      if (decisionError) throw decisionError;

      // Update prior authorization status
      const newStatus: PriorAuthStatus =
        input.decision_type === 'approved' ? 'approved' :
        input.decision_type === 'denied' ? 'denied' :
        input.decision_type === 'partial_approval' ? 'partial_approval' :
        input.decision_type === 'pended' ? 'pending_additional_info' : 'cancelled';

      const { error: updateError } = await supabase
        .from('prior_authorizations')
        .update({
          status: newStatus,
          auth_number: input.auth_number || undefined,
          approved_units: input.approved_units,
          approved_at: input.decision_type === 'approved' ? new Date().toISOString() : undefined,
          expires_at: input.approved_end_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', input.prior_auth_id);

      if (updateError) throw updateError;

      await auditLogger.phi('PRIOR_AUTH_DECISION_RECORDED', input.prior_auth_id, {
        decision_id: decision.id,
        decision_type: input.decision_type
      });

      return { success: true, data: decision as PriorAuthDecision };
    } catch (err: unknown) {
      await auditLogger.error('PRIOR_AUTH_DECISION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { prior_auth_id: input.prior_auth_id }
      );
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to record decision'
      };
    }
  }

  /**
   * Get decisions for a prior authorization
   */
  static async getDecisions(priorAuthId: string): Promise<FHIRApiResponse<PriorAuthDecision[]>> {
    try {
      const { data, error } = await supabase
        .from('prior_auth_decisions')
        .select('*')
        .eq('prior_auth_id', priorAuthId)
        .order('decision_date', { ascending: false });

      if (error) throw error;
      return { success: true, data: (data as PriorAuthDecision[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch decisions'
      };
    }
  }

  // =====================================================
  // Appeal Operations
  // =====================================================

  /**
   * Create an appeal for a denied prior authorization
   */
  static async createAppeal(input: CreateAppealInput): Promise<FHIRApiResponse<PriorAuthAppeal>> {
    try {
      await auditLogger.phi('PRIOR_AUTH_APPEAL_START', input.prior_auth_id);

      // Get current appeal level
      const { data: existingAppeals } = await supabase
        .from('prior_auth_appeals')
        .select('appeal_level')
        .eq('prior_auth_id', input.prior_auth_id)
        .order('appeal_level', { ascending: false })
        .limit(1);

      const nextLevel = (existingAppeals?.[0]?.appeal_level || 0) + 1;

      const { data, error } = await supabase
        .from('prior_auth_appeals')
        .insert({
          prior_auth_id: input.prior_auth_id,
          decision_id: input.decision_id,
          appeal_level: nextLevel,
          status: 'draft',
          appeal_reason: input.appeal_reason,
          appeal_type: input.appeal_type,
          additional_documentation: input.additional_documentation || [],
          clinical_rationale: input.clinical_rationale,
          tenant_id: input.tenant_id,
          created_by: input.created_by
        })
        .select()
        .single();

      if (error) throw error;

      // Update prior auth status
      await supabase
        .from('prior_authorizations')
        .update({
          status: 'appealed',
          updated_at: new Date().toISOString()
        })
        .eq('id', input.prior_auth_id);

      await auditLogger.phi('PRIOR_AUTH_APPEAL_CREATED', input.prior_auth_id, {
        appeal_id: data.id,
        appeal_level: nextLevel
      });

      return { success: true, data: data as PriorAuthAppeal };
    } catch (err: unknown) {
      await auditLogger.error('PRIOR_AUTH_APPEAL_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { prior_auth_id: input.prior_auth_id }
      );
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to create appeal'
      };
    }
  }

  /**
   * Submit appeal to payer
   */
  static async submitAppeal(appealId: string): Promise<FHIRApiResponse<PriorAuthAppeal>> {
    try {
      const { data, error } = await supabase
        .from('prior_auth_appeals')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          deadline_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        })
        .eq('id', appealId)
        .select()
        .single();

      if (error) throw error;

      await auditLogger.phi('PRIOR_AUTH_APPEAL_SUBMITTED', appealId);

      return { success: true, data: data as PriorAuthAppeal };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to submit appeal'
      };
    }
  }

  /**
   * Get appeals for a prior authorization
   */
  static async getAppeals(priorAuthId: string): Promise<FHIRApiResponse<PriorAuthAppeal[]>> {
    try {
      const { data, error } = await supabase
        .from('prior_auth_appeals')
        .select('*')
        .eq('prior_auth_id', priorAuthId)
        .order('appeal_level', { ascending: true });

      if (error) throw error;
      return { success: true, data: (data as PriorAuthAppeal[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch appeals'
      };
    }
  }

  // =====================================================
  // Service Line Operations
  // =====================================================

  /**
   * Add service lines to a prior authorization
   */
  static async addServiceLines(
    priorAuthId: string,
    lines: Omit<PriorAuthServiceLine, 'line_number'>[],
    tenantId: string
  ): Promise<FHIRApiResponse<PriorAuthServiceLine[]>> {
    try {
      const linesToInsert = lines.map((line, index) => ({
        ...line,
        prior_auth_id: priorAuthId,
        line_number: index + 1,
        tenant_id: tenantId
      }));

      const { data, error } = await supabase
        .from('prior_auth_service_lines')
        .insert(linesToInsert)
        .select();

      if (error) throw error;
      return { success: true, data: (data as PriorAuthServiceLine[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to add service lines'
      };
    }
  }

  /**
   * Get service lines for a prior authorization
   */
  static async getServiceLines(priorAuthId: string): Promise<FHIRApiResponse<PriorAuthServiceLine[]>> {
    try {
      const { data, error } = await supabase
        .from('prior_auth_service_lines')
        .select('*')
        .eq('prior_auth_id', priorAuthId)
        .order('line_number', { ascending: true });

      if (error) throw error;
      return { success: true, data: (data as PriorAuthServiceLine[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch service lines'
      };
    }
  }

  // =====================================================
  // Document Operations
  // =====================================================

  /**
   * Add document to prior authorization
   */
  static async addDocument(
    priorAuthId: string,
    document: Omit<PriorAuthDocument, 'id' | 'prior_auth_id' | 'uploaded_at' | 'submitted_to_payer' | 'tenant_id'>,
    tenantId: string
  ): Promise<FHIRApiResponse<PriorAuthDocument>> {
    try {
      const { data, error } = await supabase
        .from('prior_auth_documents')
        .insert({
          ...document,
          prior_auth_id: priorAuthId,
          tenant_id: tenantId,
          submitted_to_payer: false
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as PriorAuthDocument };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to add document'
      };
    }
  }

  /**
   * Get documents for a prior authorization
   */
  static async getDocuments(priorAuthId: string): Promise<FHIRApiResponse<PriorAuthDocument[]>> {
    try {
      const { data, error } = await supabase
        .from('prior_auth_documents')
        .select('*')
        .eq('prior_auth_id', priorAuthId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: (data as PriorAuthDocument[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch documents'
      };
    }
  }

  // =====================================================
  // Status History
  // =====================================================

  /**
   * Get status history for a prior authorization
   */
  static async getStatusHistory(priorAuthId: string): Promise<FHIRApiResponse<PriorAuthStatusHistory[]>> {
    try {
      const { data, error } = await supabase
        .from('prior_auth_status_history')
        .select('*')
        .eq('prior_auth_id', priorAuthId)
        .order('changed_at', { ascending: true });

      if (error) throw error;
      return { success: true, data: (data as PriorAuthStatusHistory[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch status history'
      };
    }
  }

  // =====================================================
  // Analytics & Reporting
  // =====================================================

  /**
   * Get prior authorization statistics
   */
  static async getStatistics(
    tenantId: string,
    startDate?: string,
    endDate?: string
  ): Promise<FHIRApiResponse<PriorAuthStatistics>> {
    try {
      const { data, error } = await supabase.rpc('get_prior_auth_statistics', {
        p_tenant_id: tenantId,
        p_start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        p_end_date: endDate || new Date().toISOString().split('T')[0]
      });

      if (error) throw error;

      const stats = data?.[0] || {
        total_submitted: 0,
        total_approved: 0,
        total_denied: 0,
        total_pending: 0,
        approval_rate: 0,
        avg_response_hours: 0,
        sla_compliance_rate: 100,
        by_urgency: {}
      };

      return { success: true, data: stats as PriorAuthStatistics };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch statistics'
      };
    }
  }

  /**
   * Get prior authorizations approaching deadline
   */
  static async getApproachingDeadline(
    tenantId: string,
    hoursThreshold: number = 24
  ): Promise<FHIRApiResponse<PriorAuthorization[]>> {
    try {
      const { data, error } = await supabase.rpc('get_prior_auth_approaching_deadline', {
        p_tenant_id: tenantId,
        p_hours_threshold: hoursThreshold
      });

      if (error) throw error;
      return { success: true, data: (data as PriorAuthorization[]) || [] };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to fetch approaching deadline'
      };
    }
  }

  /**
   * Check if prior authorization is required for a claim
   */
  static async checkForClaim(
    tenantId: string,
    patientId: string,
    serviceCodes: string[],
    dateOfService: string
  ): Promise<FHIRApiResponse<PriorAuthClaimCheck>> {
    try {
      const { data, error } = await supabase.rpc('check_prior_auth_for_claim', {
        p_tenant_id: tenantId,
        p_patient_id: patientId,
        p_service_codes: serviceCodes,
        p_date_of_service: dateOfService
      });

      if (error) throw error;

      const result = data?.[0] || {
        requires_prior_auth: true,
        missing_codes: serviceCodes
      };

      return { success: true, data: result as PriorAuthClaimCheck };
    } catch (err: unknown) {
      return {
        success: false,
        error: getErrorMessage(err) || 'Failed to check prior authorization requirement'
      };
    }
  }

  // =====================================================
  // FHIR Resource Conversion
  // =====================================================

  /**
   * Convert prior authorization to FHIR Claim resource (for PA request)
   * Following Da Vinci PAS Implementation Guide
   */
  static toFHIRClaimResource(priorAuth: PriorAuthorization): Record<string, unknown> {
    return {
      resourceType: 'Claim',
      id: priorAuth.fhir_resource_id || priorAuth.id,
      meta: {
        profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim']
      },
      status: priorAuth.status === 'draft' ? 'draft' : 'active',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'professional'
        }]
      },
      use: 'preauthorization',
      patient: {
        reference: `Patient/${priorAuth.patient_id}`
      },
      created: priorAuth.created_at,
      insurer: {
        identifier: {
          value: priorAuth.payer_id
        },
        display: priorAuth.payer_name
      },
      provider: {
        identifier: {
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: priorAuth.ordering_provider_npi
        }
      },
      priority: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: priorAuth.urgency === 'stat' ? 'stat' :
                priorAuth.urgency === 'urgent' ? 'urgent' : 'normal'
        }]
      },
      diagnosis: priorAuth.diagnosis_codes.map((code, index) => ({
        sequence: index + 1,
        diagnosisCodeableConcept: {
          coding: [{
            system: 'http://hl7.org/fhir/sid/icd-10-cm',
            code: code
          }]
        }
      })),
      item: priorAuth.service_codes.map((code, index) => ({
        sequence: index + 1,
        productOrService: {
          coding: [{
            system: 'http://www.ama-assn.org/go/cpt',
            code: code
          }]
        },
        servicedDate: priorAuth.date_of_service,
        quantity: {
          value: priorAuth.requested_units || 1
        }
      })),
      supportingInfo: priorAuth.clinical_notes ? [{
        sequence: 1,
        category: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/claiminformationcategory',
            code: 'info'
          }]
        },
        valueString: priorAuth.clinical_notes
      }] : undefined
    };
  }

  /**
   * Convert prior authorization to FHIR ClaimResponse resource
   * Following Da Vinci PAS Implementation Guide
   */
  static toFHIRClaimResponseResource(
    priorAuth: PriorAuthorization,
    decision?: PriorAuthDecision
  ): Record<string, unknown> {
    const outcome = decision?.decision_type === 'approved' ? 'complete' :
                    decision?.decision_type === 'denied' ? 'error' :
                    decision?.decision_type === 'partial_approval' ? 'partial' : 'queued';

    return {
      resourceType: 'ClaimResponse',
      id: `${priorAuth.id}-response`,
      meta: {
        profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claimresponse']
      },
      status: 'active',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'professional'
        }]
      },
      use: 'preauthorization',
      patient: {
        reference: `Patient/${priorAuth.patient_id}`
      },
      created: decision?.decision_date || new Date().toISOString(),
      insurer: {
        identifier: {
          value: priorAuth.payer_id
        }
      },
      request: {
        reference: `Claim/${priorAuth.fhir_resource_id || priorAuth.id}`
      },
      outcome: outcome,
      preAuthRef: priorAuth.auth_number,
      preAuthPeriod: priorAuth.expires_at ? {
        start: priorAuth.approved_at,
        end: priorAuth.expires_at
      } : undefined,
      item: priorAuth.service_codes.map((_code, index) => ({
        itemSequence: index + 1,
        adjudication: [{
          category: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/adjudication',
              code: 'submitted'
            }]
          }
        }]
      })),
      error: decision?.decision_type === 'denied' ? [{
        code: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/adjudication-error',
            code: decision.denial_reason_code || 'other',
            display: decision.denial_reason_description
          }]
        }
      }] : undefined
    };
  }
}

export default PriorAuthorizationService;
