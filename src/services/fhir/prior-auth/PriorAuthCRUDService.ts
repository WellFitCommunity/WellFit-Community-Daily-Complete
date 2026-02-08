/**
 * Prior Authorization CRUD Operations
 * Create, Read, Update operations for prior authorization requests
 */

import { supabase } from '../../../lib/supabaseClient';
import { getErrorMessage } from '../../../lib/getErrorMessage';
import { auditLogger } from '../../auditLogger';
import type {
  PriorAuthorization,
  PriorAuthServiceLine,
  PriorAuthDocument,
  PriorAuthStatusHistory,
  FHIRApiResponse,
  CreatePriorAuthInput,
} from './types';

/**
 * Create a new prior authorization request
 */
export async function create(input: CreatePriorAuthInput): Promise<FHIRApiResponse<PriorAuthorization>> {
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
export async function getById(id: string): Promise<FHIRApiResponse<PriorAuthorization | null>> {
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
export async function getByAuthNumber(authNumber: string): Promise<FHIRApiResponse<PriorAuthorization | null>> {
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
export async function getByPatient(patientId: string): Promise<FHIRApiResponse<PriorAuthorization[]>> {
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
export async function getPending(tenantId: string): Promise<FHIRApiResponse<PriorAuthorization[]>> {
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
export async function update(
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

/**
 * Add service lines to a prior authorization
 */
export async function addServiceLines(
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
export async function getServiceLines(priorAuthId: string): Promise<FHIRApiResponse<PriorAuthServiceLine[]>> {
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

/**
 * Add document to prior authorization
 */
export async function addDocument(
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
export async function getDocuments(priorAuthId: string): Promise<FHIRApiResponse<PriorAuthDocument[]>> {
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

/**
 * Get status history for a prior authorization
 */
export async function getStatusHistory(priorAuthId: string): Promise<FHIRApiResponse<PriorAuthStatusHistory[]>> {
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
