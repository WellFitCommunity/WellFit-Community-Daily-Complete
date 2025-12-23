/**
 * Progress Note Synthesizer Service
 *
 * Frontend service for AI-powered progress note synthesis from check-in data.
 * Aggregates patient check-ins over time and generates clinical progress notes.
 *
 * @module progressNoteSynthesizerService
 * @skill #21 - Progress Note Synthesizer
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

export interface VitalsTrend {
  parameter: string;
  unit: string;
  readings: { date: string; value: number }[];
  average: number | null;
  min: number | null;
  max: number | null;
  trend: 'stable' | 'improving' | 'declining' | 'variable' | 'insufficient_data';
  concernLevel: 'normal' | 'monitor' | 'concerning' | 'critical';
}

export interface MoodSummary {
  dominantMood: string | null;
  moodDistribution: Record<string, number>;
  trend: 'stable' | 'improving' | 'declining' | 'variable';
  concernLevel: 'normal' | 'monitor' | 'concerning';
}

export interface ActivitySummary {
  physicalActivityDays: number;
  socialEngagementDays: number;
  totalCheckIns: number;
  completedCheckIns: number;
  missedCheckIns: number;
  adherenceRate: number;
}

export interface ConcernFlag {
  type: 'vital' | 'mood' | 'adherence' | 'symptom' | 'pattern';
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
}

export interface ProgressNoteSummary {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface GeneratedProgressNote {
  noteId: string;
  patientId: string;
  providerId: string;
  periodStart: string;
  periodEnd: string;
  noteType: string;
  vitalsTrends: VitalsTrend[];
  moodSummary: MoodSummary;
  activitySummary: ActivitySummary;
  concernFlags: ConcernFlag[];
  summary: ProgressNoteSummary;
  keyFindings: string[];
  recommendations: string[];
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  generatedAt: string;
}

export interface ProgressNoteGenerationRequest {
  patientId: string;
  providerId: string;
  periodDays?: 7 | 14 | 30 | 60 | 90;
  noteType?: 'routine' | 'focused' | 'comprehensive';
  focusAreas?: string[];
  includeVitals?: boolean;
  includeMood?: boolean;
  includeActivities?: boolean;
}

export interface ProgressNoteGenerationResponse {
  progressNote: GeneratedProgressNote;
  metadata: {
    generated_at: string;
    response_time_ms: number;
    model: string;
  };
}

export interface SavedProgressNote extends GeneratedProgressNote {
  id: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'finalized';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Safety Thresholds
// ============================================================================

const SAFETY_THRESHOLDS = {
  MIN_CONFIDENCE: 0.5,
  SENIOR_REVIEW_THRESHOLD: 0.6,
  MIN_CHECK_INS: 2,
  MAX_PERIOD_DAYS: 90,
};

// ============================================================================
// Service Class
// ============================================================================

export class ProgressNoteSynthesizerService {
  /**
   * Generate a progress note from patient check-ins
   */
  async synthesize(
    request: ProgressNoteGenerationRequest
  ): Promise<ServiceResult<ProgressNoteGenerationResponse>> {
    try {
      // Validate inputs
      if (!request.patientId || !request.providerId) {
        return failure(
          'INVALID_INPUT',
          'Patient ID and Provider ID are required'
        );
      }

      // Validate period
      const validPeriods = [7, 14, 30, 60, 90];
      const periodDays = request.periodDays || 7;
      if (!validPeriods.includes(periodDays)) {
        return failure(
          'INVALID_INPUT',
          `Invalid period. Must be one of: ${validPeriods.join(', ')} days`
        );
      }

      // Get auth token
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        return failure('UNAUTHORIZED', 'Authentication required');
      }

      auditLogger.info('progress_note_synthesis_started', {
        patientId: request.patientId.substring(0, 8) + '...',
        periodDays,
        noteType: request.noteType || 'routine',
      });

      // Call edge function
      const { data, error } = await supabase.functions.invoke(
        'ai-progress-note-synthesizer',
        {
          body: {
            patientId: request.patientId,
            providerId: request.providerId,
            periodDays,
            noteType: request.noteType || 'routine',
            focusAreas: request.focusAreas || [],
            includeVitals: request.includeVitals ?? true,
            includeMood: request.includeMood ?? true,
            includeActivities: request.includeActivities ?? true,
          },
        }
      );

      if (error) {
        auditLogger.error('progress_note_synthesis_failed', error.message);
        return failure(
          'PROGRESS_NOTE_SYNTHESIS_FAILED',
          `Failed to synthesize progress note: ${error.message}`,
          error
        );
      }

      // Validate response
      if (!data?.progressNote) {
        return failure(
          'PROGRESS_NOTE_SYNTHESIS_FAILED',
          'Invalid response from synthesis service'
        );
      }

      // Apply safety guardrails
      const progressNote = data.progressNote as GeneratedProgressNote;

      // ALWAYS require review for clinical notes
      progressNote.requiresReview = true;

      if (progressNote.confidence < SAFETY_THRESHOLDS.MIN_CONFIDENCE) {
        progressNote.reviewReasons = progressNote.reviewReasons || [];
        progressNote.reviewReasons.push('Low confidence - requires careful review');
      }

      if (progressNote.concernFlags.some((c) => c.severity === 'high')) {
        progressNote.reviewReasons = progressNote.reviewReasons || [];
        if (!progressNote.reviewReasons.includes('High severity concerns identified')) {
          progressNote.reviewReasons.push('High severity concerns identified');
        }
      }

      auditLogger.info('progress_note_synthesis_completed', {
        noteId: progressNote.noteId,
        confidence: progressNote.confidence,
        dataQuality: progressNote.dataQuality,
        concernCount: progressNote.concernFlags.length,
      });

      return success({
        progressNote,
        metadata: data.metadata,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      auditLogger.error('progress_note_synthesis_error', error.message);
      return failure(
        'PROGRESS_NOTE_SYNTHESIS_FAILED',
        `Unexpected error during synthesis: ${error.message}`,
        err
      );
    }
  }

  /**
   * Synthesize with default 7-day period
   */
  async synthesizeWeekly(
    patientId: string,
    providerId: string
  ): Promise<ServiceResult<ProgressNoteGenerationResponse>> {
    return this.synthesize({
      patientId,
      providerId,
      periodDays: 7,
      noteType: 'routine',
    });
  }

  /**
   * Synthesize with 30-day period for monthly reviews
   */
  async synthesizeMonthly(
    patientId: string,
    providerId: string
  ): Promise<ServiceResult<ProgressNoteGenerationResponse>> {
    return this.synthesize({
      patientId,
      providerId,
      periodDays: 30,
      noteType: 'comprehensive',
    });
  }

  /**
   * Synthesize with focus on specific areas
   */
  async synthesizeFocused(
    patientId: string,
    providerId: string,
    focusAreas: string[],
    periodDays: 7 | 14 | 30 = 7
  ): Promise<ServiceResult<ProgressNoteGenerationResponse>> {
    return this.synthesize({
      patientId,
      providerId,
      periodDays,
      noteType: 'focused',
      focusAreas,
    });
  }

  /**
   * Save a generated progress note to the database
   */
  async saveNote(
    progressNote: GeneratedProgressNote,
    status: 'draft' | 'pending_review' = 'pending_review'
  ): Promise<ServiceResult<SavedProgressNote>> {
    try {
      const { data, error } = await supabase
        .from('ai_progress_notes')
        .insert({
          note_id: progressNote.noteId,
          patient_id: progressNote.patientId,
          provider_id: progressNote.providerId,
          period_start: progressNote.periodStart,
          period_end: progressNote.periodEnd,
          note_type: progressNote.noteType,
          vitals_trends: progressNote.vitalsTrends,
          mood_summary: progressNote.moodSummary,
          activity_summary: progressNote.activitySummary,
          concern_flags: progressNote.concernFlags,
          summary: progressNote.summary,
          key_findings: progressNote.keyFindings,
          recommendations: progressNote.recommendations,
          confidence: progressNote.confidence,
          requires_review: progressNote.requiresReview,
          review_reasons: progressNote.reviewReasons,
          data_quality: progressNote.dataQuality,
          status,
        })
        .select()
        .single();

      if (error) {
        return failure(
          'PROGRESS_NOTE_SAVE_FAILED',
          `Failed to save progress note: ${error.message}`,
          error
        );
      }

      auditLogger.info('progress_note_saved', {
        noteId: progressNote.noteId,
        status,
      });

      return success(this.mapToSavedNote(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure(
        'PROGRESS_NOTE_SAVE_FAILED',
        `Unexpected error saving note: ${error.message}`,
        err
      );
    }
  }

  /**
   * Approve a progress note after review
   */
  async approveNote(
    noteId: string,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<ServiceResult<SavedProgressNote>> {
    try {
      const { data, error } = await supabase
        .from('ai_progress_notes')
        .update({
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq('note_id', noteId)
        .eq('status', 'pending_review')
        .select()
        .single();

      if (error) {
        return failure(
          'PROGRESS_NOTE_APPROVAL_FAILED',
          `Failed to approve progress note: ${error.message}`,
          error
        );
      }

      if (!data) {
        return failure(
          'NOT_FOUND',
          'Progress note not found or not in pending review status'
        );
      }

      auditLogger.info('progress_note_approved', {
        noteId,
        reviewerId: reviewerId.substring(0, 8) + '...',
      });

      return success(this.mapToSavedNote(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure(
        'PROGRESS_NOTE_APPROVAL_FAILED',
        `Unexpected error: ${error.message}`,
        err
      );
    }
  }

  /**
   * Reject a progress note with feedback
   */
  async rejectNote(
    noteId: string,
    reviewerId: string,
    rejectionReason: string
  ): Promise<ServiceResult<SavedProgressNote>> {
    try {
      const { data, error } = await supabase
        .from('ai_progress_notes')
        .update({
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_notes: rejectionReason,
        })
        .eq('note_id', noteId)
        .eq('status', 'pending_review')
        .select()
        .single();

      if (error) {
        return failure(
          'PROGRESS_NOTE_REJECTION_FAILED',
          `Failed to reject progress note: ${error.message}`,
          error
        );
      }

      if (!data) {
        return failure(
          'NOT_FOUND',
          'Progress note not found or not in pending review status'
        );
      }

      auditLogger.info('progress_note_rejected', {
        noteId,
        reviewerId: reviewerId.substring(0, 8) + '...',
        reason: rejectionReason.substring(0, 50),
      });

      return success(this.mapToSavedNote(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure(
        'PROGRESS_NOTE_REJECTION_FAILED',
        `Unexpected error: ${error.message}`,
        err
      );
    }
  }

  /**
   * Finalize an approved progress note (makes it part of official record)
   */
  async finalizeNote(
    noteId: string,
    providerId: string
  ): Promise<ServiceResult<SavedProgressNote>> {
    try {
      const { data, error } = await supabase
        .from('ai_progress_notes')
        .update({
          status: 'finalized',
          finalized_at: new Date().toISOString(),
        })
        .eq('note_id', noteId)
        .eq('status', 'approved')
        .eq('provider_id', providerId)
        .select()
        .single();

      if (error) {
        return failure(
          'PROGRESS_NOTE_FINALIZE_FAILED',
          `Failed to finalize progress note: ${error.message}`,
          error
        );
      }

      if (!data) {
        return failure(
          'NOT_FOUND',
          'Progress note not found, not approved, or unauthorized'
        );
      }

      auditLogger.info('progress_note_finalized', { noteId });

      return success(this.mapToSavedNote(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure(
        'PROGRESS_NOTE_FINALIZE_FAILED',
        `Unexpected error: ${error.message}`,
        err
      );
    }
  }

  /**
   * Get progress notes for a patient
   */
  async getPatientNotes(
    patientId: string,
    options?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ServiceResult<SavedProgressNote[]>> {
    try {
      let query = supabase
        .from('ai_progress_notes')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        return failure(
          'DATABASE_ERROR',
          `Failed to fetch progress notes: ${error.message}`,
          error
        );
      }

      return success((data || []).map(this.mapToSavedNote));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure(
        'DATABASE_ERROR',
        `Unexpected error: ${error.message}`,
        err
      );
    }
  }

  /**
   * Get a specific progress note by ID
   */
  async getNoteById(noteId: string): Promise<ServiceResult<SavedProgressNote>> {
    try {
      const { data, error } = await supabase
        .from('ai_progress_notes')
        .select('*')
        .eq('note_id', noteId)
        .single();

      if (error) {
        return failure(
          'NOT_FOUND',
          `Progress note not found: ${error.message}`,
          error
        );
      }

      return success(this.mapToSavedNote(data));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure(
        'DATABASE_ERROR',
        `Unexpected error: ${error.message}`,
        err
      );
    }
  }

  /**
   * Format progress note for clinical documentation
   */
  formatForClinicalRecord(note: GeneratedProgressNote): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('PROGRESS NOTE');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Period: ${note.periodStart.split('T')[0]} to ${note.periodEnd.split('T')[0]}`);
    lines.push(`Note Type: ${note.noteType.charAt(0).toUpperCase() + note.noteType.slice(1)}`);
    lines.push(`Data Quality: ${note.dataQuality}`);
    lines.push('');

    lines.push('-'.repeat(40));
    lines.push('SUBJECTIVE');
    lines.push('-'.repeat(40));
    lines.push(note.summary.subjective);
    lines.push('');

    lines.push('-'.repeat(40));
    lines.push('OBJECTIVE');
    lines.push('-'.repeat(40));
    lines.push(note.summary.objective);
    lines.push('');

    if (note.vitalsTrends.length > 0) {
      lines.push('Vital Signs Trends:');
      for (const trend of note.vitalsTrends) {
        lines.push(`  - ${trend.parameter}: avg ${trend.average} ${trend.unit} (${trend.trend})`);
      }
      lines.push('');
    }

    lines.push('-'.repeat(40));
    lines.push('ASSESSMENT');
    lines.push('-'.repeat(40));
    lines.push(note.summary.assessment);
    lines.push('');

    if (note.concernFlags.length > 0) {
      lines.push('Concerns Identified:');
      for (const concern of note.concernFlags) {
        lines.push(`  [${concern.severity.toUpperCase()}] ${concern.description}`);
      }
      lines.push('');
    }

    lines.push('-'.repeat(40));
    lines.push('PLAN');
    lines.push('-'.repeat(40));
    lines.push(note.summary.plan);
    lines.push('');

    if (note.recommendations.length > 0) {
      lines.push('Recommendations:');
      for (const rec of note.recommendations) {
        lines.push(`  - ${rec}`);
      }
      lines.push('');
    }

    lines.push('='.repeat(60));
    lines.push(`Generated: ${new Date(note.generatedAt).toLocaleString()}`);
    lines.push(`Confidence: ${(note.confidence * 100).toFixed(0)}%`);
    lines.push('AI-GENERATED - REQUIRES CLINICAL REVIEW');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  /**
   * Map database record to SavedProgressNote
   */
  private mapToSavedNote(data: Record<string, unknown>): SavedProgressNote {
    return {
      id: data.id as string,
      noteId: data.note_id as string,
      patientId: data.patient_id as string,
      providerId: data.provider_id as string,
      periodStart: data.period_start as string,
      periodEnd: data.period_end as string,
      noteType: data.note_type as string,
      vitalsTrends: (data.vitals_trends as VitalsTrend[]) || [],
      moodSummary: (data.mood_summary as MoodSummary) || {
        dominantMood: null,
        moodDistribution: {},
        trend: 'stable',
        concernLevel: 'normal',
      },
      activitySummary: (data.activity_summary as ActivitySummary) || {
        physicalActivityDays: 0,
        socialEngagementDays: 0,
        totalCheckIns: 0,
        completedCheckIns: 0,
        missedCheckIns: 0,
        adherenceRate: 0,
      },
      concernFlags: (data.concern_flags as ConcernFlag[]) || [],
      summary: (data.summary as ProgressNoteSummary) || {
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
      },
      keyFindings: (data.key_findings as string[]) || [],
      recommendations: (data.recommendations as string[]) || [],
      confidence: data.confidence as number,
      requiresReview: data.requires_review as boolean,
      reviewReasons: (data.review_reasons as string[]) || [],
      dataQuality: data.data_quality as 'excellent' | 'good' | 'fair' | 'poor',
      generatedAt: data.created_at as string,
      status: data.status as SavedProgressNote['status'],
      reviewedBy: data.reviewed_by as string | undefined,
      reviewedAt: data.reviewed_at as string | undefined,
      reviewNotes: data.review_notes as string | undefined,
      finalizedAt: data.finalized_at as string | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}

// Export singleton instance
export const progressNoteSynthesizerService = new ProgressNoteSynthesizerService();
