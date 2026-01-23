/**
 * Beta Program Service
 *
 * Purpose: Manage beta program enrollment and participation
 * Features: Program management, enrollment, feedback collection
 * Integration: Feature rollouts, user management
 *
 * @module services/betaProgramService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export interface BetaProgram {
  id: string;
  tenantId: string | null;
  programName: string;
  programKey: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  maxParticipants: number | null;
  currentParticipants: number;
  startDate: string | null;
  endDate: string | null;
  featureKeys: string[];
  minAccountAgeDays: number;
  requiredRoles: string[];
  requiredModules: string[];
  termsAndConditions: string | null;
  requiresAgreement: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BetaEnrollment {
  id: string;
  betaProgramId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'removed' | 'completed';
  agreedToTerms: boolean;
  agreedAt: string | null;
  feedbackRating: number | null;
  feedbackText: string | null;
  feedbackSubmittedAt: string | null;
  enrolledAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateProgramInput {
  programName: string;
  programKey: string;
  description?: string;
  tenantId?: string;
  maxParticipants?: number;
  startDate?: string;
  endDate?: string;
  featureKeys?: string[];
  requiredRoles?: string[];
  termsAndConditions?: string;
  requiresAgreement?: boolean;
}

export interface UpdateProgramInput {
  programName?: string;
  description?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  maxParticipants?: number;
  startDate?: string;
  endDate?: string;
  featureKeys?: string[];
  requiredRoles?: string[];
  termsAndConditions?: string;
}

export interface BetaFeedback {
  rating: number;
  text: string;
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Create a new beta program
 */
async function createProgram(
  input: CreateProgramInput
): Promise<ServiceResult<string>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('beta_programs')
      .insert({
        tenant_id: input.tenantId || null,
        program_name: input.programName,
        program_key: input.programKey,
        description: input.description,
        max_participants: input.maxParticipants,
        start_date: input.startDate,
        end_date: input.endDate,
        feature_keys: input.featureKeys || [],
        required_roles: input.requiredRoles || [],
        terms_and_conditions: input.termsAndConditions,
        requires_agreement: input.requiresAgreement || false,
        created_by: user?.id,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to create beta program', error);
    }

    await auditLogger.info('BETA_PROGRAM_CREATED', {
      programId: data.id,
      programKey: input.programKey,
    });

    return success(data.id);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BETA_PROGRAM_CREATE_FAILED', error, { programKey: input.programKey });
    return failure('OPERATION_FAILED', 'Failed to create beta program', err);
  }
}

/**
 * Get a beta program by ID
 */
async function getProgram(
  programId: string
): Promise<ServiceResult<BetaProgram>> {
  try {
    const { data, error } = await supabase
      .from('beta_programs')
      .select('*')
      .eq('id', programId)
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get beta program', error);
    }

    if (!data) {
      return failure('NOT_FOUND', 'Beta program not found');
    }

    return success(mapProgram(data));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get beta program', err);
  }
}

/**
 * Get beta program by key
 */
async function getProgramByKey(
  programKey: string,
  tenantId?: string
): Promise<ServiceResult<BetaProgram | null>> {
  try {
    let query = supabase
      .from('beta_programs')
      .select('*')
      .eq('program_key', programKey);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    } else {
      query = query.is('tenant_id', null);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', 'Failed to get beta program', error);
    }

    return success(data ? mapProgram(data) : null);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get beta program', err);
  }
}

/**
 * List beta programs
 */
async function listPrograms(
  status?: string,
  tenantId?: string
): Promise<ServiceResult<BetaProgram[]>> {
  try {
    let query = supabase
      .from('beta_programs')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (tenantId) {
      query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to list beta programs', error);
    }

    return success((data || []).map(mapProgram));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to list beta programs', err);
  }
}

/**
 * List active programs available to join
 */
async function listAvailablePrograms(
  tenantId?: string
): Promise<ServiceResult<BetaProgram[]>> {
  try {
    let query = supabase
      .from('beta_programs')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to list available programs', error);
    }

    // Filter out full programs
    const available = (data || [])
      .filter((p) => !p.max_participants || p.current_participants < p.max_participants)
      .map(mapProgram);

    return success(available);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to list available programs', err);
  }
}

/**
 * Update a beta program
 */
async function updateProgram(
  programId: string,
  input: UpdateProgramInput
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('beta_programs')
      .update({
        program_name: input.programName,
        description: input.description,
        status: input.status,
        max_participants: input.maxParticipants,
        start_date: input.startDate,
        end_date: input.endDate,
        feature_keys: input.featureKeys,
        required_roles: input.requiredRoles,
        terms_and_conditions: input.termsAndConditions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', programId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to update beta program', error);
    }

    await auditLogger.info('BETA_PROGRAM_UPDATED', { programId, changes: input });

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BETA_PROGRAM_UPDATE_FAILED', error, { programId });
    return failure('OPERATION_FAILED', 'Failed to update beta program', err);
  }
}

/**
 * Activate a beta program
 */
async function activateProgram(
  programId: string
): Promise<ServiceResult<void>> {
  return updateProgram(programId, { status: 'active' });
}

/**
 * Pause a beta program
 */
async function pauseProgram(
  programId: string
): Promise<ServiceResult<void>> {
  return updateProgram(programId, { status: 'paused' });
}

/**
 * Complete a beta program
 */
async function completeProgram(
  programId: string
): Promise<ServiceResult<void>> {
  try {
    // Mark all active enrollments as completed
    await supabase
      .from('beta_program_enrollments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('beta_program_id', programId)
      .eq('status', 'approved');

    return updateProgram(programId, { status: 'completed' });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to complete program', err);
  }
}

/**
 * Enroll current user in a beta program
 */
async function enroll(
  programId: string,
  agreedToTerms: boolean = false
): Promise<ServiceResult<string>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return failure('UNAUTHORIZED', 'Must be logged in to enroll');
    }

    const { data, error } = await supabase.rpc('enroll_in_beta_program', {
      p_program_id: programId,
      p_user_id: user.id,
      p_agreed_to_terms: agreedToTerms,
    });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    await auditLogger.info('BETA_PROGRAM_ENROLLMENT', {
      programId,
      userId: user.id,
      enrollmentId: data,
    });

    return success(data as string);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BETA_ENROLLMENT_FAILED', error, { programId });
    return failure('OPERATION_FAILED', 'Failed to enroll in beta program', err);
  }
}

/**
 * Get enrollment for current user in a program
 */
async function getMyEnrollment(
  programId: string
): Promise<ServiceResult<BetaEnrollment | null>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return failure('UNAUTHORIZED', 'Must be logged in');
    }

    const { data, error } = await supabase
      .from('beta_program_enrollments')
      .select('*')
      .eq('beta_program_id', programId)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', 'Failed to get enrollment', error);
    }

    return success(data ? mapEnrollment(data) : null);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get enrollment', err);
  }
}

/**
 * Get all enrollments for a program (admin)
 */
async function getProgramEnrollments(
  programId: string
): Promise<ServiceResult<BetaEnrollment[]>> {
  try {
    const { data, error } = await supabase
      .from('beta_program_enrollments')
      .select('*')
      .eq('beta_program_id', programId)
      .order('enrolled_at', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get enrollments', error);
    }

    return success((data || []).map(mapEnrollment));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get enrollments', err);
  }
}

/**
 * Get all programs current user is enrolled in
 */
async function getMyPrograms(): Promise<ServiceResult<BetaProgram[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return failure('UNAUTHORIZED', 'Must be logged in');
    }

    const { data, error } = await supabase
      .from('beta_program_enrollments')
      .select('beta_programs(*)')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved']);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get user programs', error);
    }

    const programs = (data || [])
      .map((row) => {
        const bp = row.beta_programs;
        if (bp && typeof bp === 'object' && !Array.isArray(bp)) {
          return bp as Record<string, unknown>;
        }
        return null;
      })
      .filter((p): p is Record<string, unknown> => p !== null)
      .map(mapProgram);

    return success(programs);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get user programs', err);
  }
}

/**
 * Approve an enrollment
 */
async function approveEnrollment(
  enrollmentId: string
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase.rpc('approve_beta_enrollment', {
      p_enrollment_id: enrollmentId,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to approve enrollment', error);
    }

    await auditLogger.info('BETA_ENROLLMENT_APPROVED', { enrollmentId });

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to approve enrollment', err);
  }
}

/**
 * Reject an enrollment
 */
async function rejectEnrollment(
  enrollmentId: string,
  reason?: string
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('beta_program_enrollments')
      .update({ status: 'rejected' })
      .eq('id', enrollmentId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to reject enrollment', error);
    }

    await auditLogger.info('BETA_ENROLLMENT_REJECTED', { enrollmentId, reason });

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to reject enrollment', err);
  }
}

/**
 * Remove a participant from a program
 */
async function removeParticipant(
  enrollmentId: string
): Promise<ServiceResult<void>> {
  try {
    const { data: enrollment, error: getError } = await supabase
      .from('beta_program_enrollments')
      .select('beta_program_id')
      .eq('id', enrollmentId)
      .single();

    if (getError) {
      return failure('DATABASE_ERROR', 'Failed to get enrollment', getError);
    }

    const { error } = await supabase
      .from('beta_program_enrollments')
      .update({ status: 'removed' })
      .eq('id', enrollmentId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to remove participant', error);
    }

    // Decrement participant count
    await supabase
      .from('beta_programs')
      .update({
        current_participants: supabase.rpc('decrement', { x: 1 }),
      })
      .eq('id', enrollment.beta_program_id);

    await auditLogger.info('BETA_PARTICIPANT_REMOVED', { enrollmentId });

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to remove participant', err);
  }
}

/**
 * Submit feedback for a beta program
 */
async function submitFeedback(
  programId: string,
  feedback: BetaFeedback
): Promise<ServiceResult<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return failure('UNAUTHORIZED', 'Must be logged in');
    }

    const { error } = await supabase
      .from('beta_program_enrollments')
      .update({
        feedback_rating: feedback.rating,
        feedback_text: feedback.text,
        feedback_submitted_at: new Date().toISOString(),
      })
      .eq('beta_program_id', programId)
      .eq('user_id', user.id);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to submit feedback', error);
    }

    await auditLogger.info('BETA_FEEDBACK_SUBMITTED', {
      programId,
      userId: user.id,
      rating: feedback.rating,
    });

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to submit feedback', err);
  }
}

/**
 * Get feedback summary for a program
 */
async function getFeedbackSummary(
  programId: string
): Promise<ServiceResult<{
  totalFeedback: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
}>> {
  try {
    const { data, error } = await supabase
      .from('beta_program_enrollments')
      .select('feedback_rating')
      .eq('beta_program_id', programId)
      .not('feedback_rating', 'is', null);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get feedback', error);
    }

    const ratings = (data || []).map((r) => r.feedback_rating as number);
    const totalFeedback = ratings.length;
    const averageRating = totalFeedback > 0
      ? ratings.reduce((a, b) => a + b, 0) / totalFeedback
      : 0;

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const rating of ratings) {
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    }

    return success({
      totalFeedback,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get feedback summary', err);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function mapProgram(row: Record<string, unknown>): BetaProgram {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string | null,
    programName: row.program_name as string,
    programKey: row.program_key as string,
    description: row.description as string | null,
    status: row.status as BetaProgram['status'],
    maxParticipants: row.max_participants as number | null,
    currentParticipants: row.current_participants as number,
    startDate: row.start_date as string | null,
    endDate: row.end_date as string | null,
    featureKeys: (row.feature_keys as string[]) || [],
    minAccountAgeDays: row.min_account_age_days as number,
    requiredRoles: (row.required_roles as string[]) || [],
    requiredModules: (row.required_modules as string[]) || [],
    termsAndConditions: row.terms_and_conditions as string | null,
    requiresAgreement: row.requires_agreement as boolean,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapEnrollment(row: Record<string, unknown>): BetaEnrollment {
  return {
    id: row.id as string,
    betaProgramId: row.beta_program_id as string,
    userId: row.user_id as string,
    status: row.status as BetaEnrollment['status'],
    agreedToTerms: row.agreed_to_terms as boolean,
    agreedAt: row.agreed_at as string | null,
    feedbackRating: row.feedback_rating as number | null,
    feedbackText: row.feedback_text as string | null,
    feedbackSubmittedAt: row.feedback_submitted_at as string | null,
    enrolledAt: row.enrolled_at as string,
    approvedAt: row.approved_at as string | null,
    approvedBy: row.approved_by as string | null,
    completedAt: row.completed_at as string | null,
    createdAt: row.created_at as string,
  };
}

// =============================================================================
// EXPORT
// =============================================================================

export const betaProgramService = {
  // Programs
  createProgram,
  getProgram,
  getProgramByKey,
  listPrograms,
  listAvailablePrograms,
  updateProgram,
  activateProgram,
  pauseProgram,
  completeProgram,

  // Enrollments
  enroll,
  getMyEnrollment,
  getMyPrograms,
  getProgramEnrollments,
  approveEnrollment,
  rejectEnrollment,
  removeParticipant,

  // Feedback
  submitFeedback,
  getFeedbackSummary,
};

export default betaProgramService;
