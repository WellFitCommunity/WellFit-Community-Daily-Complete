/**
 * AvatarFullBody - Expanded full-body avatar modal
 *
 * Large interactive view with:
 * - All markers visible with labels
 * - Front/back view toggle
 * - Click markers to see details
 * - Pending markers alert
 */

import React, { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { EACard, EACardHeader, EACardContent, EACardFooter } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';
import {
  PatientMarker,
  SkinTone,
  GenderPresentation,
  BodyView,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from '../../types/patientAvatar';
import { AvatarBody } from './AvatarBody';
import { AvatarMarker } from './AvatarMarker';
import { MarkerDetailPopover } from './MarkerDetailPopover';

interface AvatarFullBodyProps {
  patientId: string;
  patientName?: string;
  skinTone: SkinTone;
  genderPresentation: GenderPresentation;
  markers: PatientMarker[];
  pendingCount: number;
  attentionCount: number;
  onClose: () => void;
  onConfirmMarker?: (markerId: string) => Promise<boolean>;
  onRejectMarker?: (markerId: string) => Promise<boolean>;
  onDeactivateMarker?: (markerId: string) => Promise<boolean>;
  onConfirmAllPending?: () => Promise<number>;
  onEditMarker?: (marker: PatientMarker) => void;
  onAddMarker?: () => void;
  onMarkerClick?: (marker: PatientMarker) => void;
  editable?: boolean;
}

/**
 * Legend component for marker categories
 */
const MarkerLegend: React.FC = () => {
  const categories: Array<{ key: keyof typeof CATEGORY_LABELS; label: string }> = [
    { key: 'critical', label: 'Critical' },
    { key: 'neurological', label: 'Neurological' },
    { key: 'chronic', label: 'Chronic' },
    { key: 'moderate', label: 'Moderate' },
    { key: 'monitoring', label: 'Monitoring' },
    { key: 'informational', label: 'Info' },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {categories.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className={cn('w-2.5 h-2.5 rounded-full', CATEGORY_COLORS[key].bg)} />
          <span className="text-slate-400">{label}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * Pending markers alert banner
 */
const PendingMarkersAlert: React.FC<{
  count: number;
  onConfirmAll?: () => void;
}> = ({ count, onConfirmAll }) => {
  if (count === 0) return null;

  return (
    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-amber-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="text-sm text-amber-200">
          {count} marker{count !== 1 ? 's' : ''} detected from SmartScribe need confirmation
        </span>
      </div>
      {onConfirmAll && (
        <EAButton variant="secondary" size="sm" onClick={onConfirmAll}>
          Confirm All
        </EAButton>
      )}
    </div>
  );
};

/**
 * AvatarFullBody Component
 */
export const AvatarFullBody: React.FC<AvatarFullBodyProps> = ({
  patientId: _patientId,
  patientName,
  skinTone,
  genderPresentation,
  markers,
  pendingCount,
  attentionCount,
  onClose,
  onConfirmMarker,
  onRejectMarker,
  onDeactivateMarker,
  onConfirmAllPending,
  onEditMarker,
  onAddMarker,
  onMarkerClick,
  editable = true,
}) => {
  const [view, setView] = useState<BodyView>('front');
  const [selectedMarker, setSelectedMarker] = useState<PatientMarker | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);

  // Filter markers for current view
  const visibleMarkers = markers.filter(
    (m) => m.is_active && m.status !== 'rejected' && m.body_view === view
  );

  const handleMarkerClick = useCallback((marker: PatientMarker) => {
    setSelectedMarker(marker);
    // Also notify parent component of the click
    onMarkerClick?.(marker);
  }, [onMarkerClick]);

  const handleConfirm = useCallback(async () => {
    if (!selectedMarker || !onConfirmMarker) return;
    const success = await onConfirmMarker(selectedMarker.id);
    if (success) {
      setSelectedMarker(null);
    }
  }, [selectedMarker, onConfirmMarker]);

  const handleReject = useCallback(async () => {
    if (!selectedMarker || !onRejectMarker) return;
    const success = await onRejectMarker(selectedMarker.id);
    if (success) {
      setSelectedMarker(null);
    }
  }, [selectedMarker, onRejectMarker]);

  const handleDeactivate = useCallback(async () => {
    if (!selectedMarker || !onDeactivateMarker) return;
    const success = await onDeactivateMarker(selectedMarker.id);
    if (success) {
      setSelectedMarker(null);
    }
  }, [selectedMarker, onDeactivateMarker]);

  const handleConfirmAll = useCallback(async () => {
    if (!onConfirmAllPending) return;
    setConfirmingAll(true);
    await onConfirmAllPending();
    setConfirmingAll(false);
  }, [onConfirmAllPending]);

  const handleEdit = useCallback(() => {
    if (!selectedMarker || !onEditMarker) return;
    onEditMarker(selectedMarker);
    setSelectedMarker(null);
  }, [selectedMarker, onEditMarker]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4"
      onClick={onClose}
    >
      <EACard
        className="max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <EACardHeader
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          }
          action={
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          }
        >
          <h2 className="text-xl font-semibold text-white">
            {patientName || 'Patient'} - Body Map
          </h2>
          <p className="text-sm text-slate-400">
            {markers.filter((m) => m.is_active && m.status !== 'rejected').length} active markers
          </p>
        </EACardHeader>

        {/* Content */}
        <EACardContent className="flex-1 overflow-hidden flex flex-col">
          {/* Pending alert */}
          <PendingMarkersAlert
            count={pendingCount}
            onConfirmAll={confirmingAll ? undefined : handleConfirmAll}
          />

          {/* Main content area */}
          <div className="flex-1 flex gap-6 min-h-0">
            {/* Avatar area */}
            <div className="flex-1 flex flex-col items-center">
              {/* View toggle */}
              <div className="flex gap-2 mb-4">
                <EAButton
                  variant={view === 'front' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setView('front')}
                >
                  Front
                </EAButton>
                <EAButton
                  variant={view === 'back' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setView('back')}
                >
                  Back
                </EAButton>
              </div>

              {/* Avatar with markers */}
              <div className="flex-1 flex items-center justify-center w-full max-h-[500px]">
                <AvatarBody
                  skinTone={skinTone}
                  genderPresentation={genderPresentation}
                  view={view}
                  size="full"
                  className="max-h-full"
                >
                  {visibleMarkers.map((marker) => (
                    <AvatarMarker
                      key={marker.id}
                      marker={marker}
                      size="md"
                      isPending={marker.status === 'pending_confirmation'}
                      isHighlighted={selectedMarker?.id === marker.id}
                      onClick={handleMarkerClick}
                    />
                  ))}
                </AvatarBody>
              </div>

              {/* Legend */}
              <div className="mt-4">
                <MarkerLegend />
              </div>
            </div>

            {/* Marker list sidebar */}
            <div className="w-64 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-300">
                  {view === 'front' ? 'Front' : 'Back'} Markers
                </h3>
                <span className="text-xs text-slate-500">
                  {visibleMarkers.length} items
                </span>
              </div>

              {/* Scrollable marker list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {visibleMarkers.length === 0 ? (
                  <p className="text-sm text-slate-500 italic py-4 text-center">
                    No markers on {view} view
                  </p>
                ) : (
                  visibleMarkers.map((marker) => (
                    <button
                      key={marker.id}
                      className={cn(
                        'w-full text-left p-2 rounded-lg border transition-colors',
                        'hover:bg-slate-700/50',
                        selectedMarker?.id === marker.id
                          ? 'bg-slate-700 border-[#00857a]'
                          : 'bg-slate-800/50 border-slate-700',
                        marker.status === 'pending_confirmation' && 'border-dashed border-amber-500/50'
                      )}
                      onClick={() => handleMarkerClick(marker)}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'w-2.5 h-2.5 rounded-full shrink-0',
                            CATEGORY_COLORS[marker.category].bg
                          )}
                        />
                        <span className="text-sm text-white truncate">
                          {marker.display_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">
                          {marker.body_region.replace(/_/g, ' ')}
                        </span>
                        {marker.status === 'pending_confirmation' && (
                          <EABadge variant="high" className="text-[10px] px-1 py-0">
                            Pending
                          </EABadge>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Add marker button */}
              {editable && onAddMarker && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <EAButton
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={onAddMarker}
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    }
                  >
                    Add Marker
                  </EAButton>
                </div>
              )}
            </div>
          </div>
        </EACardContent>

        {/* Footer */}
        <EACardFooter className="justify-between">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {attentionCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {attentionCount} need attention
              </span>
            )}
            <span>Click markers for details</span>
          </div>
          <EAButton variant="primary" onClick={onClose}>
            Done
          </EAButton>
        </EACardFooter>
      </EACard>

      {/* Marker detail popover */}
      {selectedMarker && (
        <MarkerDetailPopover
          marker={selectedMarker}
          isOpen={true}
          onClose={() => setSelectedMarker(null)}
          onConfirm={onConfirmMarker ? handleConfirm : undefined}
          onReject={onRejectMarker ? handleReject : undefined}
          onDeactivate={onDeactivateMarker ? handleDeactivate : undefined}
          onEdit={onEditMarker ? handleEdit : undefined}
        />
      )}
    </div>
  );
};

AvatarFullBody.displayName = 'AvatarFullBody';

export default AvatarFullBody;
