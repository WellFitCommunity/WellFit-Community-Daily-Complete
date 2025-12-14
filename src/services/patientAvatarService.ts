/**
 * Patient Avatar Service
 *
 * Service layer for patient avatar and marker management.
 * Follows the ServiceResult pattern for consistent error handling.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure, fromSupabaseError } from './_base/ServiceResult';
import {
  PatientAvatar,
  UpdatePatientAvatarRequest,
  PatientMarker,
  CreateMarkerRequest,
  UpdateMarkerRequest,
  PatientMarkersResponse,
  PatientMarkerHistory,
  SkinTone,
  GenderPresentation,
} from '../types/patientAvatar';

// ============================================================================
// PATIENT AVATAR PREFERENCES
// ============================================================================

/**
 * Get or create patient avatar preferences
 */
export async function getPatientAvatar(
  patientId: string
): Promise<ServiceResult<PatientAvatar>> {
  try {
    const { data, error } = await supabase.rpc('get_or_create_patient_avatar', {
      p_patient_id: patientId,
      p_skin_tone: 'medium',
      p_gender_presentation: 'neutral',
    });

    if (error) {
      auditLogger.error('PATIENT_AVATAR_GET_ERROR', error, { patientId });
      return failure('DATABASE_ERROR', 'Failed to get patient avatar', error);
    }

    return success(data as PatientAvatar);
  } catch (err) {
    auditLogger.error('PATIENT_AVATAR_GET_EXCEPTION', err as Error, { patientId });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

/**
 * Update patient avatar preferences
 */
export async function updatePatientAvatar(
  patientId: string,
  updates: UpdatePatientAvatarRequest
): Promise<ServiceResult<PatientAvatar>> {
  try {
    // First ensure the avatar exists
    const { data: existing, error: getError } = await supabase
      .from('patient_avatars')
      .select('*')
      .eq('patient_id', patientId)
      .single();

    if (getError && getError.code !== 'PGRST116') {
      auditLogger.error('PATIENT_AVATAR_UPDATE_ERROR', getError, { patientId });
      return failure('DATABASE_ERROR', 'Failed to get patient avatar', getError);
    }

    if (!existing) {
      // Create new avatar with updates
      const { data: created, error: createError } = await supabase
        .from('patient_avatars')
        .insert({
          patient_id: patientId,
          skin_tone: updates.skin_tone || 'medium',
          gender_presentation: updates.gender_presentation || 'neutral',
        })
        .select()
        .single();

      if (createError) {
        auditLogger.error('PATIENT_AVATAR_CREATE_ERROR', createError, { patientId });
        return failure('DATABASE_ERROR', 'Failed to create patient avatar', createError);
      }

      auditLogger.info('PATIENT_AVATAR_CREATED', { patientId });
      return success(created as PatientAvatar);
    }

    // Update existing
    const { data: updated, error: updateError } = await supabase
      .from('patient_avatars')
      .update({
        skin_tone: updates.skin_tone || existing.skin_tone,
        gender_presentation: updates.gender_presentation || existing.gender_presentation,
      })
      .eq('patient_id', patientId)
      .select()
      .single();

    if (updateError) {
      auditLogger.error('PATIENT_AVATAR_UPDATE_ERROR', updateError, { patientId });
      return failure('DATABASE_ERROR', 'Failed to update patient avatar', updateError);
    }

    auditLogger.info('PATIENT_AVATAR_UPDATED', { patientId, updates });
    return success(updated as PatientAvatar);
  } catch (err) {
    auditLogger.error('PATIENT_AVATAR_UPDATE_EXCEPTION', err as Error, { patientId });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

// ============================================================================
// PATIENT MARKERS
// ============================================================================

/**
 * Get all active markers for a patient with pending/attention counts
 */
export async function getPatientMarkers(
  patientId: string
): Promise<ServiceResult<PatientMarkersResponse>> {
  try {
    const { data, error } = await supabase.rpc('get_patient_markers_with_pending_count', {
      p_patient_id: patientId,
    });

    if (error) {
      auditLogger.error('PATIENT_MARKERS_GET_ERROR', error, { patientId });
      return failure('DATABASE_ERROR', 'Failed to get patient markers', error);
    }

    // The RPC returns a single row with markers array and counts
    const result = data?.[0] || { markers: [], pending_count: 0, attention_count: 0 };

    return success({
      markers: (result.markers || []) as PatientMarker[],
      pending_count: result.pending_count || 0,
      attention_count: result.attention_count || 0,
    });
  } catch (err) {
    auditLogger.error('PATIENT_MARKERS_GET_EXCEPTION', err as Error, { patientId });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

/**
 * Get a single marker by ID
 */
export async function getMarker(markerId: string): Promise<ServiceResult<PatientMarker>> {
  try {
    const { data, error } = await supabase
      .from('patient_markers')
      .select('*')
      .eq('id', markerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return failure('NOT_FOUND', 'Marker not found', error);
      }
      auditLogger.error('PATIENT_MARKER_GET_ERROR', error, { markerId });
      return failure('DATABASE_ERROR', 'Failed to get marker', error);
    }

    return success(data as PatientMarker);
  } catch (err) {
    auditLogger.error('PATIENT_MARKER_GET_EXCEPTION', err as Error, { markerId });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

/**
 * Create a new marker
 */
export async function createMarker(
  request: CreateMarkerRequest,
  userId?: string
): Promise<ServiceResult<PatientMarker>> {
  try {
    const { data, error } = await supabase
      .from('patient_markers')
      .insert({
        patient_id: request.patient_id,
        category: request.category,
        marker_type: request.marker_type,
        display_name: request.display_name,
        body_region: request.body_region,
        position_x: request.position_x,
        position_y: request.position_y,
        body_view: request.body_view,
        source: request.source || 'manual',
        source_transcription_id: request.source_transcription_id,
        status: request.status || 'confirmed',
        confidence_score: request.confidence_score,
        details: request.details || {},
        requires_attention: request.requires_attention || false,
        is_active: true,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      auditLogger.error('PATIENT_MARKER_CREATE_ERROR', error, { request });
      return failure('DATABASE_ERROR', 'Failed to create marker', error);
    }

    auditLogger.info('PATIENT_MARKER_CREATED', {
      markerId: data.id,
      patientId: request.patient_id,
      type: request.marker_type,
      source: request.source,
    });

    return success(data as PatientMarker);
  } catch (err) {
    auditLogger.error('PATIENT_MARKER_CREATE_EXCEPTION', err as Error, { request });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

/**
 * Update an existing marker
 */
export async function updateMarker(
  markerId: string,
  updates: UpdateMarkerRequest,
  userId?: string
): Promise<ServiceResult<PatientMarker>> {
  try {
    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.marker_type !== undefined) updateData.marker_type = updates.marker_type;
    if (updates.display_name !== undefined) updateData.display_name = updates.display_name;
    if (updates.body_region !== undefined) updateData.body_region = updates.body_region;
    if (updates.position_x !== undefined) updateData.position_x = updates.position_x;
    if (updates.position_y !== undefined) updateData.position_y = updates.position_y;
    if (updates.body_view !== undefined) updateData.body_view = updates.body_view;
    if (updates.requires_attention !== undefined) updateData.requires_attention = updates.requires_attention;

    // Handle details merge
    if (updates.details) {
      // Get current details to merge
      const { data: current } = await supabase
        .from('patient_markers')
        .select('details')
        .eq('id', markerId)
        .single();

      updateData.details = {
        ...(current?.details || {}),
        ...updates.details,
      };
    }

    if (userId) {
      updateData.created_by = userId;
    }

    const { data, error } = await supabase
      .from('patient_markers')
      .update(updateData)
      .eq('id', markerId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return failure('NOT_FOUND', 'Marker not found', error);
      }
      auditLogger.error('PATIENT_MARKER_UPDATE_ERROR', error, { markerId, updates });
      return failure('DATABASE_ERROR', 'Failed to update marker', error);
    }

    auditLogger.info('PATIENT_MARKER_UPDATED', { markerId, updates });
    return success(data as PatientMarker);
  } catch (err) {
    auditLogger.error('PATIENT_MARKER_UPDATE_EXCEPTION', err as Error, { markerId });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

/**
 * Confirm a pending marker (SmartScribe integration)
 */
export async function confirmMarker(
  markerId: string,
  userId?: string
): Promise<ServiceResult<boolean>> {
  try {
    const { data, error } = await supabase.rpc('confirm_patient_marker', {
      p_marker_id: markerId,
      p_user_id: userId,
    });

    if (error) {
      auditLogger.error('PATIENT_MARKER_CONFIRM_ERROR', error, { markerId });
      return failure('DATABASE_ERROR', 'Failed to confirm marker', error);
    }

    auditLogger.info('PATIENT_MARKER_CONFIRMED', { markerId, userId });
    return success(data as boolean);
  } catch (err) {
    auditLogger.error('PATIENT_MARKER_CONFIRM_EXCEPTION', err as Error, { markerId });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

/**
 * Reject a pending marker (SmartScribe integration)
 */
export async function rejectMarker(
  markerId: string,
  userId?: string
): Promise<ServiceResult<boolean>> {
  try {
    const { data, error } = await supabase.rpc('reject_patient_marker', {
      p_marker_id: markerId,
      p_user_id: userId,
    });

    if (error) {
      auditLogger.error('PATIENT_MARKER_REJECT_ERROR', error, { markerId });
      return failure('DATABASE_ERROR', 'Failed to reject marker', error);
    }

    auditLogger.info('PATIENT_MARKER_REJECTED', { markerId, userId });
    return success(data as boolean);
  } catch (err) {
    auditLogger.error('PATIENT_MARKER_REJECT_EXCEPTION', err as Error, { markerId });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

/**
 * Deactivate a marker (soft delete)
 */
export async function deactivateMarker(
  markerId: string,
  userId?: string
): Promise<ServiceResult<boolean>> {
  try {
    const { data, error } = await supabase.rpc('deactivate_patient_marker', {
      p_marker_id: markerId,
      p_user_id: userId,
    });

    if (error) {
      auditLogger.error('PATIENT_MARKER_DEACTIVATE_ERROR', error, { markerId });
      return failure('DATABASE_ERROR', 'Failed to deactivate marker', error);
    }

    auditLogger.info('PATIENT_MARKER_DEACTIVATED', { markerId, userId });
    return success(data as boolean);
  } catch (err) {
    auditLogger.error('PATIENT_MARKER_DEACTIVATE_EXCEPTION', err as Error, { markerId });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

/**
 * Reactivate a previously deactivated marker
 */
export async function reactivateMarker(
  markerId: string,
  userId?: string
): Promise<ServiceResult<PatientMarker>> {
  try {
    const { data, error } = await supabase
      .from('patient_markers')
      .update({
        is_active: true,
        created_by: userId,
      })
      .eq('id', markerId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return failure('NOT_FOUND', 'Marker not found', error);
      }
      auditLogger.error('PATIENT_MARKER_REACTIVATE_ERROR', error, { markerId });
      return failure('DATABASE_ERROR', 'Failed to reactivate marker', error);
    }

    auditLogger.info('PATIENT_MARKER_REACTIVATED', { markerId, userId });
    return success(data as PatientMarker);
  } catch (err) {
    auditLogger.error('PATIENT_MARKER_REACTIVATE_EXCEPTION', err as Error, { markerId });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

// ============================================================================
// MARKER HISTORY
// ============================================================================

/**
 * Get history for a specific marker
 */
export async function getMarkerHistory(
  markerId: string,
  limit: number = 50
): Promise<ServiceResult<PatientMarkerHistory[]>> {
  try {
    const { data, error } = await supabase
      .from('patient_marker_history')
      .select('*')
      .eq('marker_id', markerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      auditLogger.error('PATIENT_MARKER_HISTORY_ERROR', error, { markerId });
      return failure('DATABASE_ERROR', 'Failed to get marker history', error);
    }

    return success((data || []) as PatientMarkerHistory[]);
  } catch (err) {
    auditLogger.error('PATIENT_MARKER_HISTORY_EXCEPTION', err as Error, { markerId });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Confirm all pending markers for a patient
 */
export async function confirmAllPendingMarkers(
  patientId: string,
  userId?: string
): Promise<ServiceResult<number>> {
  try {
    const { data, error } = await supabase
      .from('patient_markers')
      .update({
        status: 'confirmed',
        requires_attention: false,
        created_by: userId,
      })
      .eq('patient_id', patientId)
      .eq('status', 'pending_confirmation')
      .eq('is_active', true)
      .select('id');

    if (error) {
      auditLogger.error('PATIENT_MARKERS_CONFIRM_ALL_ERROR', error, { patientId });
      return failure('DATABASE_ERROR', 'Failed to confirm markers', error);
    }

    const count = data?.length || 0;
    auditLogger.info('PATIENT_MARKERS_CONFIRMED_ALL', { patientId, count, userId });
    return success(count);
  } catch (err) {
    auditLogger.error('PATIENT_MARKERS_CONFIRM_ALL_EXCEPTION', err as Error, { patientId });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

/**
 * Deactivate markers matching a specific type (for device removal from SmartScribe)
 */
export async function deactivateMarkersByType(
  patientId: string,
  markerType: string,
  bodyRegion?: string,
  userId?: string
): Promise<ServiceResult<number>> {
  try {
    let query = supabase
      .from('patient_markers')
      .update({
        is_active: false,
        requires_attention: false,
        created_by: userId,
      })
      .eq('patient_id', patientId)
      .eq('marker_type', markerType)
      .eq('is_active', true);

    if (bodyRegion) {
      query = query.eq('body_region', bodyRegion);
    }

    const { data, error } = await query.select('id');

    if (error) {
      auditLogger.error('PATIENT_MARKERS_DEACTIVATE_BY_TYPE_ERROR', error, {
        patientId,
        markerType,
        bodyRegion,
      });
      return failure('DATABASE_ERROR', 'Failed to deactivate markers', error);
    }

    const count = data?.length || 0;
    auditLogger.info('PATIENT_MARKERS_DEACTIVATED_BY_TYPE', {
      patientId,
      markerType,
      bodyRegion,
      count,
      userId,
    });
    return success(count);
  } catch (err) {
    auditLogger.error('PATIENT_MARKERS_DEACTIVATE_BY_TYPE_EXCEPTION', err as Error, {
      patientId,
      markerType,
    });
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred', err);
  }
}

// ============================================================================
// EXPORT SERVICE OBJECT
// ============================================================================

export const PatientAvatarService = {
  // Avatar preferences
  getPatientAvatar,
  updatePatientAvatar,

  // Markers
  getPatientMarkers,
  getMarker,
  createMarker,
  updateMarker,
  confirmMarker,
  rejectMarker,
  deactivateMarker,
  reactivateMarker,

  // History
  getMarkerHistory,

  // Batch operations
  confirmAllPendingMarkers,
  deactivateMarkersByType,
};

export default PatientAvatarService;
