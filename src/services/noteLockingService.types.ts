/**
 * Types for noteLockingService — extracted to keep noteLockingService.ts under the
 * 600-line limit (CLAUDE.md #12). Pure type declarations, no runtime behavior.
 */

export type NoteType = 'clinical_note' | 'ai_progress_note';

export interface ClinicalNote {
  id: string;
  encounter_id: string;
  type: string;
  content: string;
  author_id: string | null;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  signature_hash: string | null;
  version: number;
  patient_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIProgressNote {
  id: string;
  note_id: string;
  patient_id: string;
  provider_id: string;
  period_start: string;
  period_end: string;
  note_type: string;
  summary: Record<string, unknown>;
  key_findings: string[];
  recommendations: string[];
  status: string;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  signature_hash: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface LockResult {
  success: boolean;
  locked_at: string;
  locked_by: string;
  signature_hash?: string;
}

export interface NoteWithAmendments {
  id: string;
  content?: string;
  summary?: Record<string, unknown>;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  version: number;
  amendments: Amendment[];
}

export interface Amendment {
  id: string;
  amendment_type: AmendmentType;
  original_content: string | null;
  amendment_content: string;
  amendment_reason: string;
  field_amended: string | null;
  amended_by: string;
  amended_at: string;
  status: AmendmentStatus;
  approved_by: string | null;
  approved_at: string | null;
}

export type AmendmentType = 'correction' | 'addendum' | 'late_entry' | 'clarification';
export type AmendmentStatus = 'pending' | 'approved' | 'rejected';

export interface LockOptions {
  generateSignature?: boolean;
  reason?: string;
}
