/**
 * Feature Rollout Service
 *
 * Purpose: Manage percentage-based feature rollouts
 * Features: Gradual rollout, targeting, evaluation
 * Integration: Feature flags, admin panel
 *
 * @module services/rolloutService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export interface FeatureRollout {
  id: string;
  tenantId: string | null;
  featureKey: string;
  featureName: string;
  description: string | null;
  rolloutPercentage: number;
  isEnabled: boolean;
  targetRoles: string[];
  targetUserIds: string[];
  excludedUserIds: string[];
  environments: string[];
  startDate: string | null;
  endDate: string | null;
  rolloutSchedule: Array<{ date: string; percentage: number }>;
  impressionCount: number;
  enabledCount: number;
  disabledCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RolloutEvaluation {
  enabled: boolean;
  reason: string;
  cached: boolean;
}

export interface CreateRolloutInput {
  featureKey: string;
  featureName: string;
  description?: string;
  rolloutPercentage?: number;
  isEnabled?: boolean;
  tenantId?: string;
  targetRoles?: string[];
  startDate?: string;
  endDate?: string;
}

export interface UpdateRolloutInput {
  featureName?: string;
  description?: string;
  rolloutPercentage?: number;
  isEnabled?: boolean;
  targetRoles?: string[];
  targetUserIds?: string[];
  excludedUserIds?: string[];
  startDate?: string;
  endDate?: string;
}

export interface RolloutHistory {
  id: string;
  featureRolloutId: string;
  changeType: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string | null;
  changedAt: string;
  reason: string | null;
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Evaluate a feature flag for a user
 */
async function evaluateFeature(
  userId: string,
  featureKey: string,
  tenantId?: string
): Promise<ServiceResult<RolloutEvaluation>> {
  try {
    const { data, error } = await supabase.rpc('evaluate_feature_flag', {
      p_user_id: userId,
      p_feature_key: featureKey,
      p_tenant_id: tenantId || null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to evaluate feature flag', error);
    }

    return success({
      enabled: data?.enabled || false,
      reason: data?.reason || 'unknown',
      cached: data?.cached || false,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('FEATURE_EVALUATION_FAILED', error, { userId, featureKey });
    return failure('OPERATION_FAILED', 'Failed to evaluate feature flag', err);
  }
}

/**
 * Get all feature flags for a user
 */
async function getUserFeatures(
  userId: string,
  tenantId?: string
): Promise<ServiceResult<Record<string, boolean>>> {
  try {
    const { data, error } = await supabase.rpc('get_user_feature_flags', {
      p_user_id: userId,
      p_tenant_id: tenantId || null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get user features', error);
    }

    const features: Record<string, boolean> = {};
    for (const row of data || []) {
      features[row.feature_key] = row.is_enabled;
    }

    return success(features);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('USER_FEATURES_FAILED', error, { userId });
    return failure('OPERATION_FAILED', 'Failed to get user features', err);
  }
}

/**
 * Create a new feature rollout
 */
async function createRollout(
  input: CreateRolloutInput
): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase.rpc('upsert_feature_rollout', {
      p_feature_key: input.featureKey,
      p_feature_name: input.featureName,
      p_rollout_percentage: input.rolloutPercentage || 0,
      p_is_enabled: input.isEnabled || false,
      p_tenant_id: input.tenantId || null,
      p_description: input.description || null,
      p_target_roles: input.targetRoles || [],
      p_start_date: input.startDate || null,
      p_end_date: input.endDate || null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to create rollout', error);
    }

    await auditLogger.info('FEATURE_ROLLOUT_CREATED', {
      featureKey: input.featureKey,
      rolloutId: data,
    });

    return success(data as string);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ROLLOUT_CREATE_FAILED', error, { featureKey: input.featureKey });
    return failure('OPERATION_FAILED', 'Failed to create rollout', err);
  }
}

/**
 * Get a rollout by ID
 */
async function getRollout(
  rolloutId: string
): Promise<ServiceResult<FeatureRollout>> {
  try {
    const { data, error } = await supabase
      .from('feature_rollouts')
      .select('*')
      .eq('id', rolloutId)
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get rollout', error);
    }

    if (!data) {
      return failure('NOT_FOUND', 'Rollout not found');
    }

    return success(mapRollout(data));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get rollout', err);
  }
}

/**
 * Get rollout by feature key
 */
async function getRolloutByKey(
  featureKey: string,
  tenantId?: string
): Promise<ServiceResult<FeatureRollout | null>> {
  try {
    let query = supabase
      .from('feature_rollouts')
      .select('*')
      .eq('feature_key', featureKey);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    } else {
      query = query.is('tenant_id', null);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', 'Failed to get rollout', error);
    }

    return success(data ? mapRollout(data) : null);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get rollout', err);
  }
}

/**
 * List all rollouts
 */
async function listRollouts(
  tenantId?: string,
  includeGlobal: boolean = true
): Promise<ServiceResult<FeatureRollout[]>> {
  try {
    let query = supabase
      .from('feature_rollouts')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantId) {
      if (includeGlobal) {
        query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
      } else {
        query = query.eq('tenant_id', tenantId);
      }
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to list rollouts', error);
    }

    return success((data || []).map(mapRollout));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to list rollouts', err);
  }
}

/**
 * Update a rollout
 */
async function updateRollout(
  rolloutId: string,
  input: UpdateRolloutInput
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('feature_rollouts')
      .update({
        feature_name: input.featureName,
        description: input.description,
        rollout_percentage: input.rolloutPercentage,
        is_enabled: input.isEnabled,
        target_roles: input.targetRoles,
        target_user_ids: input.targetUserIds,
        excluded_user_ids: input.excludedUserIds,
        start_date: input.startDate,
        end_date: input.endDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rolloutId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to update rollout', error);
    }

    await auditLogger.info('FEATURE_ROLLOUT_UPDATED', { rolloutId, changes: input });

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ROLLOUT_UPDATE_FAILED', error, { rolloutId });
    return failure('OPERATION_FAILED', 'Failed to update rollout', err);
  }
}

/**
 * Update rollout percentage (with history logging)
 */
async function updatePercentage(
  rolloutId: string,
  newPercentage: number,
  reason?: string
): Promise<ServiceResult<void>> {
  try {
    // Get current percentage
    const rolloutResult = await getRollout(rolloutId);
    if (!rolloutResult.success) {
      return failure(rolloutResult.error.code, rolloutResult.error.message);
    }

    const oldPercentage = rolloutResult.data.rolloutPercentage;

    // Update percentage
    const { error } = await supabase
      .from('feature_rollouts')
      .update({
        rollout_percentage: newPercentage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rolloutId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to update percentage', error);
    }

    // Log history
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('feature_rollout_history').insert({
      feature_rollout_id: rolloutId,
      change_type: 'percentage',
      old_value: oldPercentage,
      new_value: newPercentage,
      changed_by: user?.id,
      reason,
    });

    // Invalidate cache
    await supabase
      .from('user_feature_flags_cache')
      .delete()
      .eq('feature_key', rolloutResult.data.featureKey);

    await auditLogger.info('FEATURE_ROLLOUT_PERCENTAGE_CHANGED', {
      rolloutId,
      featureKey: rolloutResult.data.featureKey,
      oldPercentage,
      newPercentage,
      reason,
    });

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ROLLOUT_PERCENTAGE_FAILED', error, { rolloutId });
    return failure('OPERATION_FAILED', 'Failed to update percentage', err);
  }
}

/**
 * Enable or disable a rollout
 */
async function setEnabled(
  rolloutId: string,
  enabled: boolean
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('feature_rollouts')
      .update({
        is_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rolloutId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to update enabled status', error);
    }

    await auditLogger.info('FEATURE_ROLLOUT_TOGGLED', { rolloutId, enabled });

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to update enabled status', err);
  }
}

/**
 * Delete a rollout
 */
async function deleteRollout(
  rolloutId: string
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('feature_rollouts')
      .delete()
      .eq('id', rolloutId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to delete rollout', error);
    }

    await auditLogger.info('FEATURE_ROLLOUT_DELETED', { rolloutId });

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to delete rollout', err);
  }
}

/**
 * Get rollout history
 */
async function getRolloutHistory(
  rolloutId: string
): Promise<ServiceResult<RolloutHistory[]>> {
  try {
    const { data, error } = await supabase
      .from('feature_rollout_history')
      .select('*')
      .eq('feature_rollout_id', rolloutId)
      .order('changed_at', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get rollout history', error);
    }

    const history: RolloutHistory[] = (data || []).map((row) => ({
      id: row.id,
      featureRolloutId: row.feature_rollout_id,
      changeType: row.change_type,
      oldValue: row.old_value,
      newValue: row.new_value,
      changedBy: row.changed_by,
      changedAt: row.changed_at,
      reason: row.reason,
    }));

    return success(history);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get rollout history', err);
  }
}

/**
 * Add user to target list
 */
async function addTargetUser(
  rolloutId: string,
  userId: string
): Promise<ServiceResult<void>> {
  try {
    const { data, error: getError } = await supabase
      .from('feature_rollouts')
      .select('target_user_ids, feature_key')
      .eq('id', rolloutId)
      .single();

    if (getError) {
      return failure('DATABASE_ERROR', 'Failed to get rollout', getError);
    }

    const targetUserIds = data.target_user_ids || [];
    if (!targetUserIds.includes(userId)) {
      targetUserIds.push(userId);

      const { error: updateError } = await supabase
        .from('feature_rollouts')
        .update({ target_user_ids: targetUserIds })
        .eq('id', rolloutId);

      if (updateError) {
        return failure('DATABASE_ERROR', 'Failed to add target user', updateError);
      }

      // Invalidate user's cache
      await supabase
        .from('user_feature_flags_cache')
        .delete()
        .eq('user_id', userId)
        .eq('feature_key', data.feature_key);
    }

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to add target user', err);
  }
}

/**
 * Add user to exclude list
 */
async function excludeUser(
  rolloutId: string,
  userId: string
): Promise<ServiceResult<void>> {
  try {
    const { data, error: getError } = await supabase
      .from('feature_rollouts')
      .select('excluded_user_ids, feature_key')
      .eq('id', rolloutId)
      .single();

    if (getError) {
      return failure('DATABASE_ERROR', 'Failed to get rollout', getError);
    }

    const excludedUserIds = data.excluded_user_ids || [];
    if (!excludedUserIds.includes(userId)) {
      excludedUserIds.push(userId);

      const { error: updateError } = await supabase
        .from('feature_rollouts')
        .update({ excluded_user_ids: excludedUserIds })
        .eq('id', rolloutId);

      if (updateError) {
        return failure('DATABASE_ERROR', 'Failed to exclude user', updateError);
      }

      // Invalidate user's cache
      await supabase
        .from('user_feature_flags_cache')
        .delete()
        .eq('user_id', userId)
        .eq('feature_key', data.feature_key);
    }

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to exclude user', err);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function mapRollout(row: Record<string, unknown>): FeatureRollout {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string | null,
    featureKey: row.feature_key as string,
    featureName: row.feature_name as string,
    description: row.description as string | null,
    rolloutPercentage: row.rollout_percentage as number,
    isEnabled: row.is_enabled as boolean,
    targetRoles: (row.target_roles as string[]) || [],
    targetUserIds: (row.target_user_ids as string[]) || [],
    excludedUserIds: (row.excluded_user_ids as string[]) || [],
    environments: (row.environments as string[]) || [],
    startDate: row.start_date as string | null,
    endDate: row.end_date as string | null,
    rolloutSchedule: (row.rollout_schedule as Array<{ date: string; percentage: number }>) || [],
    impressionCount: row.impression_count as number,
    enabledCount: row.enabled_count as number,
    disabledCount: row.disabled_count as number,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// =============================================================================
// EXPORT
// =============================================================================

export const rolloutService = {
  // Evaluation
  evaluateFeature,
  getUserFeatures,

  // CRUD
  createRollout,
  getRollout,
  getRolloutByKey,
  listRollouts,
  updateRollout,
  deleteRollout,

  // Specific updates
  updatePercentage,
  setEnabled,

  // Targeting
  addTargetUser,
  excludeUser,

  // History
  getRolloutHistory,
};

export default rolloutService;
