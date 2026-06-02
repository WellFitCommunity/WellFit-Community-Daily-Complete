/**
 * Note Locking Service - Clinical Note Immutability Management
 *
 * Purpose: Lock clinical notes to prevent modifications and manage the amendment workflow
 * Features: Note locking, signature generation, concurrent edit detection
 * Compliance: 21 CFR Part 11, HIPAA § 164.312(c)(1)
 *
 * @module services/noteLockingService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES — extracted to noteLockingService.types.ts (CLAUDE.md #12); re-exported
// here so existing consumers keep importing them from noteLockingService.
// =============================================================================

export type {
  NoteType,
  ClinicalNote,
  AIProgressNote,
  LockResult,
  NoteWithAmendments,
  Amendment,
  AmendmentType,
  AmendmentStatus,
  LockOptions,
} from './noteLockingService.types';

import type {
  NoteType,
  ClinicalNote,
  AIProgressNote,
  LockResult,
  NoteWithAmendments,
  LockOptions,
} from './noteLockingService.types';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a SHA-256 hash of note content for non-repudiation
 */
async function generateSignatureHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the content string for a note (handles both note types)
 */
function getNoteContentString(
  note: ClinicalNote | AIProgressNote,
  noteType: NoteType
): string {
  if (noteType === 'clinical_note') {
    return (note as ClinicalNote).content;
  } else {
    const aiNote = note as AIProgressNote;
    return JSON.stringify({
      summary: aiNote.summary,
      key_findings: aiNote.key_findings,
      recommendations: aiNote.recommendations,
    });
  }
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Lock a clinical note to prevent direct modifications
 */
async function lockNote(
  noteId: string,
  noteType: NoteType,
  lockedBy: string,
  options: LockOptions = {}
): Promise<ServiceResult<LockResult>> {
  try {
    // Get the note to generate signature
    let note: ClinicalNote | AIProgressNote | null = null;
    let signatureHash: string | null = null;

    if (noteType === 'clinical_note') {
      // clinical_notes is immutable and has no lock columns — read only the real columns
      // needed to compute the signature.
      const { data, error } = await supabase
        .from('clinical_notes')
        .select('id, content')
        .eq('id', noteId)
        .single();

      if (error || !data) {
        return failure('NOT_FOUND', 'Clinical note not found');
      }
      note = data as unknown as ClinicalNote;
    } else {
      const { data, error } = await supabase
        .from('ai_progress_notes')
        .select('id, summary, key_findings, recommendations')
        .eq('id', noteId)
        .single();

      if (error || !data) {
        return failure('NOT_FOUND', 'AI progress note not found');
      }
      note = data as unknown as AIProgressNote;
    }

    // "Already locked" is enforced server-side by lock_clinical_note (derived from the
    // append-only clinical_note_lock_audit table); the note itself carries no lock column.

    // Generate signature hash if requested
    if (options.generateSignature) {
      const contentString = getNoteContentString(note, noteType);
      signatureHash = await generateSignatureHash(contentString);
    }

    // Call the database function to lock the note
    const { data: result, error } = await supabase.rpc('lock_clinical_note', {
      p_note_id: noteId,
      p_note_type: noteType,
      p_locked_by: lockedBy,
      p_signature_hash: signatureHash,
    });

    if (error) {
      const errorMessage = typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error);
      await auditLogger.error('NOTE_LOCK_FAILED', new Error(errorMessage), {
        noteId,
        noteType,
        lockedBy,
      });
      return failure('DATABASE_ERROR', 'Failed to lock note', error);
    }

    const lockResult = result as LockResult;
    if (!lockResult.success) {
      return failure('OPERATION_FAILED', 'error' in lockResult ? String(lockResult) : 'Lock operation failed');
    }

    await auditLogger.info('NOTE_LOCKED', {
      noteId,
      noteType,
      lockedBy,
      signatureGenerated: !!signatureHash,
    });

    return success({
      success: true,
      locked_at: lockResult.locked_at,
      locked_by: lockResult.locked_by,
      signature_hash: signatureHash || undefined,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NOTE_LOCK_FAILED', error, { noteId, noteType, lockedBy });
    return failure('OPERATION_FAILED', 'Failed to lock note', err);
  }
}

/**
 * Check if a note is locked
 */
async function isNoteLocked(
  noteId: string,
  noteType: NoteType
): Promise<ServiceResult<boolean>> {
  try {
    const table = noteType === 'clinical_note' ? 'clinical_notes' : 'ai_progress_notes';
    const { data, error } = await supabase
      .from(table)
      .select('is_locked')
      .eq('id', noteId)
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to check note lock status', error);
    }

    return success(data?.is_locked ?? false);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NOTE_LOCK_CHECK_FAILED', error, { noteId, noteType });
    return failure('OPERATION_FAILED', 'Failed to check note lock status', err);
  }
}

/**
 * Get note with all amendments
 */
async function getNoteWithAmendments(
  noteId: string,
  noteType: NoteType
): Promise<ServiceResult<NoteWithAmendments | null>> {
  try {
    const { data, error } = await supabase.rpc('get_note_with_amendments', {
      p_note_id: noteId,
      p_note_type: noteType,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get note with amendments', error);
    }

    if (!data) {
      return success(null);
    }

    return success(data as NoteWithAmendments);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NOTE_GET_WITH_AMENDMENTS_FAILED', error, { noteId, noteType });
    return failure('OPERATION_FAILED', 'Failed to get note with amendments', err);
  }
}

/**
 * Get lock status details for a note
 */
async function getLockDetails(
  noteId: string,
  noteType: NoteType
): Promise<
  ServiceResult<{
    is_locked: boolean;
    locked_at: string | null;
    locked_by: string | null;
    signature_hash: string | null;
    version: number;
    locked_by_name?: string;
  } | null>
> {
  try {
    const table = noteType === 'clinical_note' ? 'clinical_notes' : 'ai_progress_notes';
    const { data, error } = await supabase
      .from(table)
      .select('is_locked, locked_at, locked_by, signature_hash, version')
      .eq('id', noteId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', 'Failed to get lock details', error);
    }

    if (!data) {
      return success(null);
    }

    // Get locked_by user name if locked
    let lockedByName: string | undefined;
    if (data.locked_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', data.locked_by)
        .single();

      if (profile) {
        lockedByName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      }
    }

    return success({
      is_locked: data.is_locked ?? false,
      locked_at: data.locked_at,
      locked_by: data.locked_by,
      signature_hash: data.signature_hash,
      version: data.version ?? 1,
      locked_by_name: lockedByName,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NOTE_LOCK_DETAILS_FAILED', error, { noteId, noteType });
    return failure('OPERATION_FAILED', 'Failed to get lock details', err);
  }
}

/**
 * Verify signature hash matches current content (integrity check)
 */
async function verifySignature(
  noteId: string,
  noteType: NoteType
): Promise<
  ServiceResult<{
    valid: boolean;
    stored_hash: string | null;
    computed_hash: string;
  }>
> {
  try {
    // Explicit columns per note type (§9 no SELECT *); only the real content fields needed
    // to recompute the signature. clinical_notes is immutable and has no lock columns.
    let note: ClinicalNote | AIProgressNote;
    if (noteType === 'clinical_note') {
      const { data, error } = await supabase
        .from('clinical_notes')
        .select('id, content')
        .eq('id', noteId)
        .single();
      if (error || !data) {
        return failure('NOT_FOUND', 'Note not found');
      }
      note = data as unknown as ClinicalNote;
    } else {
      const { data, error } = await supabase
        .from('ai_progress_notes')
        .select('id, summary, key_findings, recommendations')
        .eq('id', noteId)
        .single();
      if (error || !data) {
        return failure('NOT_FOUND', 'Note not found');
      }
      note = data as unknown as AIProgressNote;
    }

    // The signature lives in the append-only lock-audit table (the note is immutable and
    // has no signature_hash column). Read the latest lock signature for this note.
    const lockColumn = noteType === 'clinical_note' ? 'clinical_note_id' : 'ai_progress_note_id';
    const { data: lockRow } = await supabase
      .from('clinical_note_lock_audit')
      .select('signature_hash')
      .eq(lockColumn, noteId)
      .eq('action', 'lock')
      .order('performed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const storedHash = (lockRow as { signature_hash: string | null } | null)?.signature_hash ?? null;
    if (!storedHash) {
      return failure('OPERATION_FAILED', 'Note does not have a signature hash');
    }

    const contentString = getNoteContentString(note, noteType);
    const computedHash = await generateSignatureHash(contentString);

    const valid = computedHash === storedHash;

    if (!valid) {
      await auditLogger.error('NOTE_SIGNATURE_MISMATCH', new Error('Signature verification failed'), {
        noteId,
        noteType,
        stored: storedHash.substring(0, 16),
        computed: computedHash.substring(0, 16),
      });
    }

    return success({
      valid,
      stored_hash: storedHash,
      computed_hash: computedHash,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NOTE_SIGNATURE_VERIFY_FAILED', error, { noteId, noteType });
    return failure('OPERATION_FAILED', 'Failed to verify signature', err);
  }
}

/**
 * Admin unlock (with audit trail)
 */
async function adminUnlock(
  noteId: string,
  noteType: NoteType,
  adminId: string,
  reason: string
): Promise<ServiceResult<boolean>> {
  try {
    // Verify user is admin
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role_code')
      .eq('user_id', adminId)
      .single();

    if (!adminProfile || (adminProfile.role_code !== 1 && adminProfile.role_code !== 2)) {
      return failure('UNAUTHORIZED', 'Only administrators can unlock notes');
    }

    const table = noteType === 'clinical_note' ? 'clinical_notes' : 'ai_progress_notes';

    // Unlock the note
    const { error } = await supabase
      .from(table)
      .update({
        is_locked: false,
        locked_at: null,
        locked_by: null,
        // Keep signature_hash for historical reference
      })
      .eq('id', noteId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to unlock note', error);
    }

    // Log the unlock action
    await supabase.from('clinical_note_lock_audit').insert({
      note_type: noteType,
      clinical_note_id: noteType === 'clinical_note' ? noteId : null,
      ai_progress_note_id: noteType === 'ai_progress_note' ? noteId : null,
      action: 'unlock_admin',
      performed_by: adminId,
      reason,
      success: true,
    });

    await auditLogger.info('NOTE_UNLOCKED_ADMIN', {
      noteId,
      noteType,
      adminId,
      reason,
    });

    return success(true);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NOTE_ADMIN_UNLOCK_FAILED', error, { noteId, noteType, adminId });
    return failure('OPERATION_FAILED', 'Failed to unlock note', err);
  }
}

/**
 * Get lock audit history for a note
 */
async function getLockAuditHistory(
  noteId: string,
  noteType: NoteType,
  options: { limit?: number } = {}
): Promise<
  ServiceResult<
    Array<{
      id: string;
      action: string;
      performed_by: string;
      performed_at: string;
      reason: string | null;
      success: boolean;
      failure_reason: string | null;
    }>
  >
> {
  try {
    const column = noteType === 'clinical_note' ? 'clinical_note_id' : 'ai_progress_note_id';

    let query = supabase
      .from('clinical_note_lock_audit')
      .select('id, action, performed_by, performed_at, reason, success, failure_reason')
      .eq(column, noteId)
      .order('performed_at', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get lock audit history', error);
    }

    return success(
      (data || []).map((row) => ({
        id: row.id,
        action: row.action,
        performed_by: row.performed_by,
        performed_at: row.performed_at,
        reason: row.reason,
        success: row.success,
        failure_reason: row.failure_reason,
      }))
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NOTE_AUDIT_HISTORY_FAILED', error, { noteId, noteType });
    return failure('OPERATION_FAILED', 'Failed to get lock audit history', err);
  }
}

/**
 * Bulk lock multiple notes
 */
async function bulkLockNotes(
  notes: Array<{ noteId: string; noteType: NoteType }>,
  lockedBy: string,
  options: LockOptions = {}
): Promise<ServiceResult<{ successful: string[]; failed: Array<{ noteId: string; error: string }> }>> {
  const successful: string[] = [];
  const failed: Array<{ noteId: string; error: string }> = [];

  for (const { noteId, noteType } of notes) {
    const result = await lockNote(noteId, noteType, lockedBy, options);
    if (result.success) {
      successful.push(noteId);
    } else {
      failed.push({ noteId, error: result.error.message });
    }
  }

  await auditLogger.info('BULK_NOTE_LOCK', {
    lockedBy,
    successCount: successful.length,
    failedCount: failed.length,
  });

  return success({ successful, failed });
}

// =============================================================================
// EXPORT
// =============================================================================

export const noteLockingService = {
  // Core locking
  lockNote,
  isNoteLocked,
  getLockDetails,
  adminUnlock,

  // Amendments
  getNoteWithAmendments,

  // Verification
  verifySignature,

  // Audit
  getLockAuditHistory,

  // Bulk operations
  bulkLockNotes,
};

export default noteLockingService;
