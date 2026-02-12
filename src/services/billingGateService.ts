/**
 * Billing Gate Service
 *
 * Validates clinical prerequisites before encounters can advance to
 * billing-related states. This is the TypeScript-side enforcement that
 * mirrors the database-level gate in validate_encounter_notes_signed().
 *
 * Gates:
 *   - signed: requires locked+signed clinical notes
 *   - ready_for_billing: re-validates signed notes (safety net)
 *   - billed: same check (defense in depth)
 *
 * Used by: encounterStateMachine, billing workflow, superbill sign-off
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';
import type { EncounterStatus } from '../types/encounterStatus';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface NoteSignatureStatus {
  encounter_id: string;
  total_notes: number;
  signed_notes: number;
  unsigned_notes: number;
  all_signed: boolean;
  notes: NoteDetail[];
}

interface NoteDetail {
  id: string;
  type: string;
  is_locked: boolean;
  signature_hash: string | null;
  locked_by: string | null;
  locked_at: string | null;
}

interface BillingReadiness {
  encounter_id: string;
  ready: boolean;
  blockers: string[];
  notes_status: NoteSignatureStatus;
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

/** States that require signed notes */
const STATES_REQUIRING_SIGNED_NOTES: readonly EncounterStatus[] = [
  'signed',
  'ready_for_billing',
  'billed',
] as const;

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const billingGateService = {
  /**
   * Check the signature status of all clinical notes for an encounter.
   */
  async getNoteSignatureStatus(
    encounterId: string
  ): Promise<ServiceResult<NoteSignatureStatus>> {
    try {
      if (!encounterId) {
        return failure('INVALID_INPUT', 'Encounter ID is required');
      }

      const { data, error } = await supabase
        .from('clinical_notes')
        .select('id, type, is_locked, signature_hash, locked_by, locked_at')
        .eq('encounter_id', encounterId);

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      const notes = (data ?? []) as NoteDetail[];
      const signedNotes = notes.filter(n => n.is_locked && n.signature_hash);
      const unsignedNotes = notes.filter(n => !n.is_locked || !n.signature_hash);

      return success({
        encounter_id: encounterId,
        total_notes: notes.length,
        signed_notes: signedNotes.length,
        unsigned_notes: unsignedNotes.length,
        all_signed: notes.length > 0 && unsignedNotes.length === 0,
        notes,
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'NOTE_SIGNATURE_STATUS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to check note signature status');
    }
  },

  /**
   * Validate that an encounter meets billing prerequisites.
   * Returns blockers if the encounter is not ready.
   */
  async validateBillingReadiness(
    encounterId: string
  ): Promise<ServiceResult<BillingReadiness>> {
    try {
      if (!encounterId) {
        return failure('INVALID_INPUT', 'Encounter ID is required');
      }

      const blockers: string[] = [];

      // Check note signatures
      const noteResult = await this.getNoteSignatureStatus(encounterId);
      if (!noteResult.success) {
        return failure(noteResult.error.code, noteResult.error.message);
      }

      const notesStatus = noteResult.data;

      if (notesStatus.total_notes === 0) {
        blockers.push('No clinical notes exist for this encounter');
      } else if (!notesStatus.all_signed) {
        blockers.push(
          `${notesStatus.unsigned_notes} of ${notesStatus.total_notes} clinical note(s) are not signed`
        );
      }

      // Check encounter has provider (from Task #2)
      const { data: encounter } = await supabase
        .from('encounters')
        .select('provider_id, status')
        .eq('id', encounterId)
        .single();

      if (!encounter) {
        blockers.push('Encounter not found');
      } else if (!encounter.provider_id) {
        blockers.push('No attending provider assigned');
      }

      return success({
        encounter_id: encounterId,
        ready: blockers.length === 0,
        blockers,
        notes_status: notesStatus,
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'BILLING_READINESS_CHECK_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to validate billing readiness');
    }
  },

  /**
   * Check if a specific state transition requires signed notes
   * and whether the requirement is met.
   */
  async canAdvanceToState(
    encounterId: string,
    targetStatus: EncounterStatus
  ): Promise<ServiceResult<{ allowed: boolean; reason?: string }>> {
    try {
      if (!encounterId) {
        return failure('INVALID_INPUT', 'Encounter ID is required');
      }

      // States that don't require note validation
      if (!STATES_REQUIRING_SIGNED_NOTES.includes(targetStatus)) {
        return success({ allowed: true });
      }

      const noteResult = await this.getNoteSignatureStatus(encounterId);
      if (!noteResult.success) {
        return failure(noteResult.error.code, noteResult.error.message);
      }

      const status = noteResult.data;

      if (status.total_notes === 0) {
        await auditLogger.clinical('BILLING_GATE_BLOCKED', false, {
          encounter_id: encounterId,
          target_status: targetStatus,
          reason: 'no_clinical_notes',
        });
        return success({
          allowed: false,
          reason: 'At least one clinical note is required before signing',
        });
      }

      if (!status.all_signed) {
        await auditLogger.clinical('BILLING_GATE_BLOCKED', false, {
          encounter_id: encounterId,
          target_status: targetStatus,
          reason: 'unsigned_notes',
          unsigned_count: status.unsigned_notes,
        });
        return success({
          allowed: false,
          reason: `${status.unsigned_notes} clinical note(s) must be signed before advancing to ${targetStatus}`,
        });
      }

      return success({ allowed: true });
    } catch (err: unknown) {
      await auditLogger.error(
        'BILLING_GATE_CHECK_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounter_id: encounterId, target_status: targetStatus }
      );
      return failure('UNKNOWN_ERROR', 'Failed to check billing gate');
    }
  },
};

export default billingGateService;
