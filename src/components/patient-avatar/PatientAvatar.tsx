/**
 * PatientAvatar - Main Container Component
 *
 * The primary entry point for the Patient Avatar Visualization System.
 * Manages compact/expanded mode and coordinates child components.
 */

import React, { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { PatientAvatarProps, PatientMarker } from '../../types/patientAvatar';
import { usePatientAvatar } from './hooks/usePatientAvatar';
import { usePatientMarkers } from './hooks/usePatientMarkers';
import { AvatarThumbnail } from './AvatarThumbnail';
import { AvatarFullBody } from './AvatarFullBody';
import { MarkerForm } from './MarkerForm';

interface PatientAvatarContainerProps extends PatientAvatarProps {
  /** Optional skin tone override (otherwise fetched from DB) */
  skinToneOverride?: 'light' | 'mediumLight' | 'medium' | 'mediumDark' | 'dark';
  /** Optional gender override (otherwise fetched from DB) */
  genderOverride?: 'male' | 'female' | 'neutral';
}

/**
 * PatientAvatar Component
 *
 * Main entry point for the avatar visualization system.
 * Can start in compact (thumbnail) or expanded (full-body) mode.
 */
export const PatientAvatar: React.FC<PatientAvatarContainerProps> = ({
  patientId,
  patientName,
  initialMode = 'compact',
  editable = true,
  onMarkerClick,
  onClose,
  skinToneOverride,
  genderOverride,
  className,
}) => {
  // State
  const [mode, setMode] = useState<'compact' | 'expanded'>(initialMode);
  const [showMarkerForm, setShowMarkerForm] = useState(false);
  const [editingMarker, setEditingMarker] = useState<PatientMarker | null>(null);

  // Hooks
  const {
    avatar,
    loading: avatarLoading,
    error: avatarError,
  } = usePatientAvatar(patientId);

  const {
    markers,
    pendingCount,
    attentionCount,
    loading: markersLoading,
    error: markersError,
    refresh: refreshMarkers,
    createMarker,
    updateMarker,
    confirmMarker,
    rejectMarker,
    deactivateMarker,
    confirmAllPending,
  } = usePatientMarkers(patientId);

  // Computed values
  const skinTone = skinToneOverride || avatar?.skin_tone || 'medium';
  const genderPresentation = genderOverride || avatar?.gender_presentation || 'neutral';
  const loading = avatarLoading || markersLoading;
  const error = avatarError || markersError;

  // Handlers
  const handleExpand = useCallback(() => {
    setMode('expanded');
  }, []);

  const handleCollapse = useCallback(() => {
    setMode('compact');
    onClose?.();
  }, [onClose]);

  const handleMarkerClick = useCallback(
    (marker: PatientMarker) => {
      onMarkerClick?.(marker);
    },
    [onMarkerClick]
  );

  const handleEditMarker = useCallback((marker: PatientMarker) => {
    setEditingMarker(marker);
    setShowMarkerForm(true);
  }, []);

  const handleAddMarker = useCallback(() => {
    setEditingMarker(null);
    setShowMarkerForm(true);
  }, []);

  const handleMarkerFormClose = useCallback(() => {
    setShowMarkerForm(false);
    setEditingMarker(null);
  }, []);

  const handleMarkerFormSave = useCallback(
    async (markerData: Omit<PatientMarker, 'id' | 'patient_id' | 'created_at' | 'updated_at'>) => {
      if (editingMarker) {
        // Update existing marker
        await updateMarker(editingMarker.id, {
          category: markerData.category,
          marker_type: markerData.marker_type,
          display_name: markerData.display_name,
          body_region: markerData.body_region,
          position_x: markerData.position_x,
          position_y: markerData.position_y,
          body_view: markerData.body_view,
          details: markerData.details,
          requires_attention: markerData.requires_attention,
        });
      } else {
        // Create new marker
        await createMarker({
          category: markerData.category,
          marker_type: markerData.marker_type,
          display_name: markerData.display_name,
          body_region: markerData.body_region,
          position_x: markerData.position_x,
          position_y: markerData.position_y,
          body_view: markerData.body_view,
          details: markerData.details,
          requires_attention: markerData.requires_attention,
        });
      }

      setShowMarkerForm(false);
      setEditingMarker(null);
    },
    [editingMarker, createMarker, updateMarker]
  );

  // Loading state
  if (loading && markers.length === 0) {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center',
          'w-[116px] h-[192px]',
          'bg-slate-800/50 border border-slate-700 rounded-lg',
          'animate-pulse',
          className
        )}
      >
        <svg
          className="w-8 h-8 text-slate-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </div>
    );
  }

  // Error state
  if (error && markers.length === 0) {
    return (
      <div
        className={cn(
          'inline-flex flex-col items-center justify-center gap-2 p-4',
          'w-[116px] h-[192px]',
          'bg-slate-800/50 border border-red-500/30 rounded-lg',
          className
        )}
      >
        <svg
          className="w-6 h-6 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-xs text-red-400 text-center">Load failed</span>
        <button
          className="text-xs text-[#00857a] hover:underline"
          onClick={refreshMarkers}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Compact (Thumbnail) Mode */}
      {mode === 'compact' && (
        <AvatarThumbnail
          patientId={patientId}
          patientName={patientName}
          skinTone={skinTone}
          genderPresentation={genderPresentation}
          markers={markers}
          pendingCount={pendingCount}
          onClick={handleExpand}
          className={className}
        />
      )}

      {/* Expanded (Full-Body) Mode */}
      {mode === 'expanded' && (
        <AvatarFullBody
          patientId={patientId}
          patientName={patientName}
          skinTone={skinTone}
          genderPresentation={genderPresentation}
          markers={markers}
          pendingCount={pendingCount}
          attentionCount={attentionCount}
          onClose={handleCollapse}
          onConfirmMarker={confirmMarker}
          onRejectMarker={rejectMarker}
          onDeactivateMarker={deactivateMarker}
          onConfirmAllPending={confirmAllPending}
          onEditMarker={editable ? handleEditMarker : undefined}
          onAddMarker={editable ? handleAddMarker : undefined}
          editable={editable}
        />
      )}

      {/* Marker Form Modal */}
      {showMarkerForm && (
        <MarkerForm
          patientId={patientId}
          existingMarker={editingMarker || undefined}
          skinTone={skinTone}
          genderPresentation={genderPresentation}
          onSave={handleMarkerFormSave}
          onClose={handleMarkerFormClose}
        />
      )}
    </>
  );
};

PatientAvatar.displayName = 'PatientAvatar';

export default PatientAvatar;
