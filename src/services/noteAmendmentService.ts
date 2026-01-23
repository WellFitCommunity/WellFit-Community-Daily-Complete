/**
 * Note Amendment Service - Clinical Note Amendment Management
 *
 * Purpose: Create and manage amendments for locked clinical notes
 * Features: Corrections, addendums, late entries, approval workflow
 * Compliance: 21 CFR Part 11, HIPAA § 164.312(c)(1)
 *
 * @module services/noteAmendmentService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type { NoteType, Amendment, AmendmentType, AmendmentStatus } from './noteLockingService';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateAmendmentRequest {
  noteId: string;
  noteType: NoteType;
  amendmentType: AmendmentType;
  amendmentContent: string;
  amendmentReason: string;
  originalContent?: string;
  fieldAmended?: string;
}

export interface AmendmentWithDetails extends Amendment {
  amended_by_name?: string;
  approved_by_name?: string;
  note_type: NoteType;
  clinical_note_id: string | null;
  ai_progress_note_id: string | null;
}

export interface ProvenanceRecord {
  id: string;
  note_type: NoteType;
  clinical_note_id: string | null;
  ai_progress_note_id: string | null;
  field_name: string;
  field_version: number;
  previous_value: string | null;
  new_value: string;
  change_type: string;
  changed_by: string;
  changed_at: string;
  change_reason: string | null;
  change_source: string;
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Create an amendment for a locked note
 */
async function createAmendment(
  request: CreateAmendmentRequest,
  amendedBy: string
): Promise<ServiceResult<string>> {
  try {
    // Call the database function
    const { data: amendmentId, error } = await supabase.rpc('create_note_amendment', {
      p_note_id: request.noteId,
      p_note_type: request.noteType,
      p_amendment_type: request.amendmentType,
      p_amendment_content: request.amendmentContent,
      p_amendment_reason: request.amendmentReason,
      p_amended_by: amendedBy,
      p_original_content: request.originalContent || null,
      p_field_amended: request.fieldAmended || null,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error);
      await auditLogger.error('AMENDMENT_CREATE_FAILED', new Error(errorMessage), {
        noteId: request.noteId,
        noteType: request.noteType,
        amendmentType: request.amendmentType,
      });
      return failure('DATABASE_ERROR', errorMessage, error);
    }

    await auditLogger.info('AMENDMENT_CREATED', {
      amendmentId,
      noteId: request.noteId,
      noteType: request.noteType,
      amendmentType: request.amendmentType,
      amendedBy,
    });

    return success(amendmentId as string);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AMENDMENT_CREATE_FAILED', error, {
      noteId: request.noteId,
      noteType: request.noteType,
    });
    return failure('OPERATION_FAILED', 'Failed to create amendment', err);
  }
}

/**
 * Get amendment by ID
 */
async function getAmendmentById(amendmentId: string): Promise<ServiceResult<AmendmentWithDetails | null>> {
  try {
    const { data, error } = await supabase
      .from('clinical_note_amendments')
      .select('*')
      .eq('id', amendmentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', 'Failed to get amendment', error);
    }

    if (!data) {
      return success(null);
    }

    // Get user names
    const userIds = [data.amended_by, data.approved_by].filter(Boolean);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.user_id, `${p.first_name || ''} ${p.last_name || ''}`.trim()])
    );

    return success({
      ...data,
      amended_by_name: profileMap.get(data.amended_by),
      approved_by_name: data.approved_by ? profileMap.get(data.approved_by) : undefined,
    } as AmendmentWithDetails);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AMENDMENT_GET_FAILED', error, { amendmentId });
    return failure('OPERATION_FAILED', 'Failed to get amendment', err);
  }
}

/**
 * Get all amendments for a note
 */
async function getAmendmentsForNote(
  noteId: string,
  noteType: NoteType,
  options: { status?: AmendmentStatus; limit?: number } = {}
): Promise<ServiceResult<AmendmentWithDetails[]>> {
  try {
    const column = noteType === 'clinical_note' ? 'clinical_note_id' : 'ai_progress_note_id';

    let query = supabase
      .from('clinical_note_amendments')
      .select('*')
      .eq(column, noteId)
      .order('amended_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get amendments', error);
    }

    if (!data || data.length === 0) {
      return success([]);
    }

    // Get user names
    const userIds = [...new Set(data.flatMap((a) => [a.amended_by, a.approved_by].filter(Boolean)))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.user_id, `${p.first_name || ''} ${p.last_name || ''}`.trim()])
    );

    return success(
      data.map((a) => ({
        ...a,
        amended_by_name: profileMap.get(a.amended_by),
        approved_by_name: a.approved_by ? profileMap.get(a.approved_by) : undefined,
      })) as AmendmentWithDetails[]
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AMENDMENTS_GET_FAILED', error, { noteId, noteType });
    return failure('OPERATION_FAILED', 'Failed to get amendments', err);
  }
}

/**
 * Approve an amendment
 */
async function approveAmendment(
  amendmentId: string,
  approvedBy: string
): Promise<ServiceResult<boolean>> {
  try {
    // Get the amendment first
    const { data: amendment, error: getError } = await supabase
      .from('clinical_note_amendments')
      .select('*')
      .eq('id', amendmentId)
      .single();

    if (getError || !amendment) {
      return failure('NOT_FOUND', 'Amendment not found');
    }

    if (amendment.status !== 'pending') {
      return failure('OPERATION_FAILED', 'Amendment is not in pending status');
    }

    // Cannot approve your own amendment
    if (amendment.amended_by === approvedBy) {
      return failure('OPERATION_FAILED', 'Cannot approve your own amendment');
    }

    // Update amendment status
    const { error } = await supabase
      .from('clinical_note_amendments')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', amendmentId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to approve amendment', error);
    }

    await auditLogger.info('AMENDMENT_APPROVED', {
      amendmentId,
      approvedBy,
    });

    return success(true);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AMENDMENT_APPROVE_FAILED', error, { amendmentId, approvedBy });
    return failure('OPERATION_FAILED', 'Failed to approve amendment', err);
  }
}

/**
 * Reject an amendment
 */
async function rejectAmendment(
  amendmentId: string,
  rejectedBy: string,
  rejectionReason: string
): Promise<ServiceResult<boolean>> {
  try {
    // Get the amendment first
    const { data: amendment, error: getError } = await supabase
      .from('clinical_note_amendments')
      .select('*')
      .eq('id', amendmentId)
      .single();

    if (getError || !amendment) {
      return failure('NOT_FOUND', 'Amendment not found');
    }

    if (amendment.status !== 'pending') {
      return failure('OPERATION_FAILED', 'Amendment is not in pending status');
    }

    // Update amendment status
    const { error } = await supabase
      .from('clinical_note_amendments')
      .update({
        status: 'rejected',
        approved_by: rejectedBy, // Using same column for reviewer
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq('id', amendmentId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to reject amendment', error);
    }

    await auditLogger.info('AMENDMENT_REJECTED', {
      amendmentId,
      rejectedBy,
      reason: rejectionReason,
    });

    return success(true);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AMENDMENT_REJECT_FAILED', error, { amendmentId, rejectedBy });
    return failure('OPERATION_FAILED', 'Failed to reject amendment', err);
  }
}

/**
 * Get pending amendments for review
 */
async function getPendingAmendments(
  options: { tenantId?: string; limit?: number; noteType?: NoteType } = {}
): Promise<ServiceResult<AmendmentWithDetails[]>> {
  try {
    let query = supabase
      .from('clinical_note_amendments')
      .select('*')
      .eq('status', 'pending')
      .order('amended_at', { ascending: true });

    if (options.noteType) {
      query = query.eq('note_type', options.noteType);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get pending amendments', error);
    }

    if (!data || data.length === 0) {
      return success([]);
    }

    // Get user names
    const userIds = [...new Set(data.map((a) => a.amended_by))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.user_id, `${p.first_name || ''} ${p.last_name || ''}`.trim()])
    );

    return success(
      data.map((a) => ({
        ...a,
        amended_by_name: profileMap.get(a.amended_by),
      })) as AmendmentWithDetails[]
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('PENDING_AMENDMENTS_GET_FAILED', error, options);
    return failure('OPERATION_FAILED', 'Failed to get pending amendments', err);
  }
}

/**
 * Get field provenance history for a note
 */
async function getFieldProvenance(
  noteId: string,
  noteType: NoteType,
  options: { fieldName?: string; limit?: number } = {}
): Promise<ServiceResult<ProvenanceRecord[]>> {
  try {
    const column = noteType === 'clinical_note' ? 'clinical_note_id' : 'ai_progress_note_id';

    let query = supabase
      .from('clinical_field_provenance')
      .select('*')
      .eq(column, noteId)
      .order('changed_at', { ascending: false });

    if (options.fieldName) {
      query = query.eq('field_name', options.fieldName);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get field provenance', error);
    }

    return success((data || []) as ProvenanceRecord[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('PROVENANCE_GET_FAILED', error, { noteId, noteType });
    return failure('OPERATION_FAILED', 'Failed to get field provenance', err);
  }
}

/**
 * Record field change provenance
 */
async function recordFieldChange(
  noteId: string,
  noteType: NoteType,
  fieldName: string,
  previousValue: string | null,
  newValue: string,
  changedBy: string,
  options: { changeReason?: string; changeSource?: string } = {}
): Promise<ServiceResult<string>> {
  try {
    // Get current field version
    const column = noteType === 'clinical_note' ? 'clinical_note_id' : 'ai_progress_note_id';
    const { data: existing } = await supabase
      .from('clinical_field_provenance')
      .select('field_version')
      .eq(column, noteId)
      .eq('field_name', fieldName)
      .order('field_version', { ascending: false })
      .limit(1);

    const nextVersion = existing && existing.length > 0 ? existing[0].field_version + 1 : 1;

    const { data, error } = await supabase
      .from('clinical_field_provenance')
      .insert({
        note_type: noteType,
        clinical_note_id: noteType === 'clinical_note' ? noteId : null,
        ai_progress_note_id: noteType === 'ai_progress_note' ? noteId : null,
        field_name: fieldName,
        field_version: nextVersion,
        previous_value: previousValue,
        new_value: newValue,
        change_type: previousValue === null ? 'create' : 'update',
        changed_by: changedBy,
        change_reason: options.changeReason,
        change_source: options.changeSource || 'manual',
      })
      .select('id')
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to record field change', error);
    }

    await auditLogger.info('FIELD_CHANGE_RECORDED', {
      noteId,
      noteType,
      fieldName,
      version: nextVersion,
      changedBy,
    });

    return success(data.id);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('FIELD_CHANGE_RECORD_FAILED', error, { noteId, noteType, fieldName });
    return failure('OPERATION_FAILED', 'Failed to record field change', err);
  }
}

/**
 * Get amendment statistics
 */
async function getAmendmentStats(
  options: { noteType?: NoteType; fromDate?: string; toDate?: string } = {}
): Promise<
  ServiceResult<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    byType: Record<AmendmentType, number>;
  }>
> {
  try {
    let query = supabase.from('clinical_note_amendments').select('status, amendment_type');

    if (options.noteType) {
      query = query.eq('note_type', options.noteType);
    }

    if (options.fromDate) {
      query = query.gte('amended_at', options.fromDate);
    }

    if (options.toDate) {
      query = query.lte('amended_at', options.toDate);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get amendment stats', error);
    }

    const amendments = data || [];

    const byType: Record<AmendmentType, number> = {
      correction: 0,
      addendum: 0,
      late_entry: 0,
      clarification: 0,
    };

    for (const a of amendments) {
      if (a.amendment_type in byType) {
        byType[a.amendment_type as AmendmentType]++;
      }
    }

    return success({
      total: amendments.length,
      pending: amendments.filter((a) => a.status === 'pending').length,
      approved: amendments.filter((a) => a.status === 'approved').length,
      rejected: amendments.filter((a) => a.status === 'rejected').length,
      byType,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AMENDMENT_STATS_FAILED', error, options);
    return failure('OPERATION_FAILED', 'Failed to get amendment stats', err);
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const noteAmendmentService = {
  // Amendment CRUD
  createAmendment,
  getAmendmentById,
  getAmendmentsForNote,

  // Approval workflow
  approveAmendment,
  rejectAmendment,
  getPendingAmendments,

  // Provenance
  getFieldProvenance,
  recordFieldChange,

  // Statistics
  getAmendmentStats,
};

export default noteAmendmentService;
