/**
 * Disclosure Accounting Service
 *
 * Purpose: Track all PHI disclosures per HIPAA Accounting of Disclosures
 * Regulation: 45 CFR 164.528
 * Features: Record disclosures, patient right to accounting, compliance reporting
 *
 * @module services/disclosureAccountingService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type RecipientType =
  | 'healthcare_provider'
  | 'health_plan'
  | 'public_health'
  | 'law_enforcement'
  | 'research'
  | 'judicial'
  | 'organ_procurement'
  | 'coroner'
  | 'workers_comp'
  | 'government_program'
  | 'abuse_report'
  | 'other';

export type DisclosureMethod =
  | 'electronic'
  | 'fax'
  | 'mail'
  | 'verbal'
  | 'in_person'
  | 'portal';

export interface Disclosure {
  id: string;
  tenant_id: string;
  patient_id: string;
  disclosed_by: string | null;
  disclosure_date: string;
  recipient_name: string;
  recipient_type: RecipientType;
  purpose: string;
  phi_types_disclosed: string[];
  disclosure_method: DisclosureMethod;
  data_classes_disclosed: string[];
  legal_authority: string | null;
  patient_authorization_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateDisclosureRequest {
  patient_id: string;
  recipient_name: string;
  recipient_type: RecipientType;
  purpose: string;
  phi_types_disclosed: string[];
  disclosure_method: DisclosureMethod;
  data_classes_disclosed?: string[];
  legal_authority?: string;
  patient_authorization_id?: string;
  disclosure_date?: string;
  notes?: string;
}

// =============================================================================
// SERVICE
// =============================================================================

async function getTenantId(): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single();
  return data?.tenant_id ?? null;
}

/**
 * Record a new PHI disclosure
 */
export async function recordDisclosure(
  request: CreateDisclosureRequest
): Promise<ServiceResult<Disclosure>> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return failure('UNAUTHORIZED', 'No tenant context');

    const user = (await supabase.auth.getUser()).data.user;

    const { data, error } = await supabase
      .from('disclosure_accounting')
      .insert({
        tenant_id: tenantId,
        patient_id: request.patient_id,
        disclosed_by: user?.id ?? null,
        disclosure_date: request.disclosure_date ?? new Date().toISOString(),
        recipient_name: request.recipient_name,
        recipient_type: request.recipient_type,
        purpose: request.purpose,
        phi_types_disclosed: request.phi_types_disclosed,
        disclosure_method: request.disclosure_method,
        data_classes_disclosed: request.data_classes_disclosed ?? [],
        legal_authority: request.legal_authority ?? null,
        patient_authorization_id: request.patient_authorization_id ?? null,
        notes: request.notes ?? null,
      })
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.info('DISCLOSURE_RECORDED', {
      disclosureId: data.id,
      patientId: request.patient_id,
      recipientName: request.recipient_name,
      recipientType: request.recipient_type,
      purpose: request.purpose,
    });

    return success(data as Disclosure);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('DISCLOSURE_RECORD_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to record disclosure');
  }
}

/**
 * Get disclosures for a specific patient (patient right to accounting)
 * Per 45 CFR 164.528, patients may request an accounting going back 6 years
 */
export async function getPatientDisclosures(
  patientId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<ServiceResult<Disclosure[]>> {
  try {
    let query = supabase
      .from('disclosure_accounting')
      .select('*')
      .eq('patient_id', patientId)
      .order('disclosure_date', { ascending: false });

    if (dateFrom) {
      query = query.gte('disclosure_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('disclosure_date', dateTo);
    }

    const { data, error } = await query;

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.info('DISCLOSURE_PATIENT_ACCOUNTING_ACCESSED', {
      patientId,
      disclosureCount: (data ?? []).length,
      dateFrom: dateFrom ?? 'all',
      dateTo: dateTo ?? 'all',
    });

    return success((data ?? []) as Disclosure[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('DISCLOSURE_PATIENT_FETCH_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to get patient disclosures');
  }
}

/**
 * Get tenant-wide disclosure report for compliance auditing
 */
export async function getDisclosureReport(
  dateFrom: string,
  dateTo: string
): Promise<ServiceResult<Disclosure[]>> {
  try {
    const { data, error } = await supabase
      .from('disclosure_accounting')
      .select('*')
      .gte('disclosure_date', dateFrom)
      .lte('disclosure_date', dateTo)
      .order('disclosure_date', { ascending: false });

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.info('DISCLOSURE_REPORT_GENERATED', {
      dateFrom,
      dateTo,
      totalDisclosures: (data ?? []).length,
    });

    return success((data ?? []) as Disclosure[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('DISCLOSURE_REPORT_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to generate disclosure report');
  }
}

/**
 * Count disclosures for a specific patient
 */
export async function getDisclosureCount(
  patientId: string
): Promise<ServiceResult<number>> {
  try {
    const { count, error } = await supabase
      .from('disclosure_accounting')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId);

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success(count ?? 0);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('DISCLOSURE_COUNT_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to count disclosures');
  }
}

export const disclosureAccountingService = {
  recordDisclosure,
  getPatientDisclosures,
  getDisclosureReport,
  getDisclosureCount,
};
