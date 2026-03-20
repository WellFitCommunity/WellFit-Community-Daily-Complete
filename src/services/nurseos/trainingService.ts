// ============================================================================
// NurseOS Training Service — ServiceResult Pattern
// ============================================================================

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { success, failure } from '../_base';
import type { ServiceResult } from '../_base';
import type {
  ResilienceTrainingModule,
  ProviderTrainingCompletion,
} from '../../types/nurseos';

/**
 * Get active training modules, optionally filtered by category
 */
export async function getActiveModules(
  category?: string
): Promise<ServiceResult<ResilienceTrainingModule[]>> {
  try {
    let query = supabase
      .from('resilience_training_modules')
      .select('id, title, description, category, content_type, content_url, estimated_duration_minutes, difficulty_level, evidence_based, citation, is_active, display_order, created_at, updated_at, created_by')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      await auditLogger.error('RESILIENCE_MODULES_FETCH_FAILED', error.message, {
        category,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to fetch modules: ${error.message}`, error);
    }

    return success((data || []) as ResilienceTrainingModule[]);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_MODULES_FETCH_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'getActiveModules' }
    );
    return failure('OPERATION_FAILED', 'Failed to fetch modules', err);
  }
}

/**
 * Track when user starts a module
 */
export async function trackModuleStart(moduleId: string): Promise<ServiceResult<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failure('UNAUTHORIZED', 'User not authenticated');

    const { data: practitioner } = await supabase
      .from('fhir_practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!practitioner) return failure('NOT_FOUND', 'Practitioner record not found');

    const { error } = await supabase.from('provider_training_completions').upsert(
      {
        user_id: user.id,
        practitioner_id: practitioner.id,
        module_id: moduleId,
        started_at: new Date().toISOString(),
        completion_percentage: 0,
      },
      {
        onConflict: 'user_id,module_id',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      await auditLogger.error('RESILIENCE_MODULE_START_FAILED', error.message, {
        userId: user.id,
        moduleId,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to track module start: ${error.message}`, error);
    }

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_MODULE_START_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'trackModuleStart' }
    );
    return failure('OPERATION_FAILED', 'Failed to track module start', err);
  }
}

/**
 * Track module completion
 */
export async function trackModuleCompletion(
  moduleId: string,
  timeSpent: number,
  helpful: boolean
): Promise<ServiceResult<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failure('UNAUTHORIZED', 'User not authenticated');

    const { error } = await supabase
      .from('provider_training_completions')
      .update({
        completed_at: new Date().toISOString(),
        completion_percentage: 100,
        time_spent_minutes: timeSpent,
        found_helpful: helpful,
      })
      .eq('user_id', user.id)
      .eq('module_id', moduleId);

    if (error) {
      await auditLogger.error('RESILIENCE_MODULE_COMPLETION_FAILED', error.message, {
        userId: user.id,
        moduleId,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to track completion: ${error.message}`, error);
    }

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_MODULE_COMPLETION_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'trackModuleCompletion' }
    );
    return failure('OPERATION_FAILED', 'Failed to track completion', err);
  }
}

/**
 * Get current user's module completions
 */
export async function getMyCompletions(): Promise<ServiceResult<ProviderTrainingCompletion[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failure('UNAUTHORIZED', 'User not authenticated');

    const { data, error } = await supabase
      .from('provider_training_completions')
      .select('id, practitioner_id, user_id, module_id, started_at, completed_at, completion_percentage, time_spent_minutes, found_helpful, notes, will_practice')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false });

    if (error) {
      await auditLogger.error('RESILIENCE_COMPLETIONS_FETCH_FAILED', error.message, {
        userId: user.id,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to fetch completions: ${error.message}`, error);
    }

    return success((data || []) as ProviderTrainingCompletion[]);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_COMPLETIONS_FETCH_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'getMyCompletions' }
    );
    return failure('OPERATION_FAILED', 'Failed to fetch completions', err);
  }
}
