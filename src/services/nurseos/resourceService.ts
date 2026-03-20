// ============================================================================
// NurseOS Resource Service — ServiceResult Pattern
// ============================================================================

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { success, failure } from '../_base';
import type { ServiceResult } from '../_base';
import type { ResilienceResource } from '../../types/nurseos';

/**
 * Get active resilience resources
 */
export async function getResources(filters?: {
  category?: string;
  resource_type?: string;
  userRole?: string;
}): Promise<ServiceResult<ResilienceResource[]>> {
  try {
    let query = supabase
      .from('resilience_resources')
      .select('id, title, description, resource_type, url, thumbnail_url, categories, tags, target_audience, is_evidence_based, citation, reviewed_by, is_active, featured, view_count, average_rating, created_at, updated_at')
      .eq('is_active', true)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.category) {
      query = query.contains('categories', [filters.category]);
    }

    if (filters?.resource_type) {
      query = query.eq('resource_type', filters.resource_type);
    }

    const { data, error } = await query;

    if (error) {
      await auditLogger.error('RESILIENCE_RESOURCES_FETCH_FAILED', error.message, {
        filters,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to fetch resources: ${error.message}`, error);
    }

    let filteredData = data || [];
    if (filters?.userRole) {
      filteredData = filteredData.filter((resource) => {
        const targetAudience = (resource as ResilienceResource).target_audience || [];
        return targetAudience.includes('all') || targetAudience.includes(filters.userRole);
      });
    }

    return success(filteredData as ResilienceResource[]);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_RESOURCES_FETCH_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'getResources' }
    );
    return failure('OPERATION_FAILED', 'Failed to fetch resources', err);
  }
}

/**
 * Track resource view (increment view count)
 */
export async function trackResourceView(resourceId: string): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase.rpc('increment', {
      table_name: 'resilience_resources',
      row_id: resourceId,
      column_name: 'view_count',
    });

    if (error) {
      // Fallback: manual increment if RPC doesn't exist
      const { data: resource } = await supabase
        .from('resilience_resources')
        .select('view_count')
        .eq('id', resourceId)
        .single();

      if (resource) {
        await supabase
          .from('resilience_resources')
          .update({ view_count: ((resource as { view_count: number }).view_count || 0) + 1 })
          .eq('id', resourceId);
      }
    }

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_RESOURCE_VIEW_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'trackResourceView', resourceId }
    );
    return failure('OPERATION_FAILED', 'Failed to track resource view', err);
  }
}
