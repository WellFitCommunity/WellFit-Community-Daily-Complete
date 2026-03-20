// ============================================================================
// NurseOS Support Circle Service — ServiceResult Pattern
// ============================================================================

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { success, failure } from '../_base';
import type { ServiceResult } from '../_base';
import type {
  ProviderSupportCircle,
  ProviderSupportReflection,
} from '../../types/nurseos';

/**
 * Get current user's support circles
 */
export async function getMyCircles(): Promise<ServiceResult<ProviderSupportCircle[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failure('UNAUTHORIZED', 'User not authenticated');

    const { data, error } = await supabase
      .from('provider_support_circles')
      .select(`
        id, name, description, meeting_frequency, max_members, is_active, facilitator_id, created_at, updated_at,
        provider_support_circle_members!inner(user_id, is_active)
      `)
      .eq('provider_support_circle_members.user_id', user.id)
      .eq('provider_support_circle_members.is_active', true)
      .eq('is_active', true);

    if (error) {
      await auditLogger.error('RESILIENCE_CIRCLES_FETCH_FAILED', error.message, {
        userId: user.id,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to fetch circles: ${error.message}`, error);
    }

    return success((data || []) as ProviderSupportCircle[]);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_CIRCLES_FETCH_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'getMyCircles' }
    );
    return failure('OPERATION_FAILED', 'Failed to fetch circles', err);
  }
}

/**
 * Get reflections from a support circle
 */
export async function getCircleReflections(
  circleId: string,
  limit: number = 20
): Promise<ServiceResult<ProviderSupportReflection[]>> {
  try {
    const { data, error } = await supabase
      .from('provider_support_reflections')
      .select('id, circle_id, author_id, reflection_text, is_anonymous, tags, helpful_count, created_at, updated_at')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      await auditLogger.error('RESILIENCE_REFLECTIONS_FETCH_FAILED', error.message, {
        circleId,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to fetch reflections: ${error.message}`, error);
    }

    return success((data || []) as ProviderSupportReflection[]);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_REFLECTIONS_FETCH_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'getCircleReflections' }
    );
    return failure('OPERATION_FAILED', 'Failed to fetch reflections', err);
  }
}

/**
 * Post a reflection to a support circle
 */
export async function postReflection(
  circleId: string,
  text: string,
  isAnonymous: boolean,
  tags?: string[]
): Promise<ServiceResult<ProviderSupportReflection>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failure('UNAUTHORIZED', 'User not authenticated');

    const { data, error } = await supabase
      .from('provider_support_reflections')
      .insert({
        circle_id: circleId,
        author_id: isAnonymous ? null : user.id,
        reflection_text: text,
        is_anonymous: isAnonymous,
        tags: tags || null,
      })
      .select()
      .single();

    if (error) {
      await auditLogger.error('RESILIENCE_REFLECTION_POST_FAILED', error.message, {
        userId: user.id,
        circleId,
        isAnonymous,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to post reflection: ${error.message}`, error);
    }

    return success(data as ProviderSupportReflection);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_REFLECTION_POST_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'postReflection' }
    );
    return failure('OPERATION_FAILED', 'Failed to post reflection', err);
  }
}

/**
 * Mark a reflection as helpful (increment helpful_count)
 */
export async function markReflectionHelpful(reflectionId: string): Promise<ServiceResult<void>> {
  try {
    const { data: reflection } = await supabase
      .from('provider_support_reflections')
      .select('helpful_count')
      .eq('id', reflectionId)
      .single();

    if (!reflection) {
      return failure('NOT_FOUND', 'Reflection not found');
    }

    const { error } = await supabase
      .from('provider_support_reflections')
      .update({ helpful_count: (reflection.helpful_count || 0) + 1 })
      .eq('id', reflectionId);

    if (error) {
      await auditLogger.error('RESILIENCE_HELPFUL_MARK_FAILED', error.message, {
        reflectionId,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to mark helpful: ${error.message}`, error);
    }

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_HELPFUL_MARK_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'markReflectionHelpful' }
    );
    return failure('OPERATION_FAILED', 'Failed to mark helpful', err);
  }
}
