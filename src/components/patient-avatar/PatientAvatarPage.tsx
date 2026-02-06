/**
 * PatientAvatarPage - Standalone full-page avatar view
 *
 * Purpose: Route-level page for /patient-avatar/:patientId
 * Used by: Clinical staff to view/manage patient body map
 *
 * Three-panel layout:
 * - Left: Marker list grouped by category
 * - Center: Large avatar with front/back toggle
 * - Right: Details, History, Settings tabs
 */

import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';
import { usePatientAvatar } from './hooks/usePatientAvatar';
import { usePatientMarkers } from './hooks/usePatientMarkers';
import { AvatarBody } from './AvatarBody';
import { AvatarMarker } from './AvatarMarker';
import { StatusBadgeRing } from './StatusBadgeRing';
import { MarkerForm } from './MarkerForm';
import { MarkerDetailPopover } from './MarkerDetailPopover';
import { AvatarSettingsForm } from './AvatarSettingsForm';
import { PatientAvatarService } from '../../services/patientAvatarService';
import { auditLogger } from '../../services/auditLogger';
import {
  PatientMarker,
  PatientMarkerHistory,
  BodyView,
  MarkerCategory,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from '../../types/patientAvatar';

// ============================================================================
// TYPES
// ============================================================================

interface PatientAvatarPageProps {
  patientId: string;
}

type RightPanelTab = 'details' | 'history' | 'settings';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Pending markers alert banner
 */
const PendingAlert: React.FC<{
  count: number;
  onConfirmAll?: () => void;
  confirming?: boolean;
}> = ({ count, onConfirmAll, confirming }) => {
  if (count === 0) return null;

  return (
    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-sm text-amber-200">
          {count} marker{count !== 1 ? 's' : ''} from SmartScribe need confirmation
        </span>
      </div>
      {onConfirmAll && (
        <EAButton variant="secondary" size="sm" onClick={onConfirmAll} disabled={confirming}>
          {confirming ? 'Confirming...' : 'Confirm All'}
        </EAButton>
      )}
    </div>
  );
};

/**
 * Category legend
 */
const MarkerLegend: React.FC = () => {
  const categories: Array<{ key: MarkerCategory; label: string }> = [
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
 * Marker history panel
 */
const MarkerHistoryPanel: React.FC<{
  markerId: string | null;
  markerName: string | null;
}> = ({ markerId, markerName }) => {
  const [history, setHistory] = useState<PatientMarkerHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  React.useEffect(() => {
    if (!markerId) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);

    PatientAvatarService.getMarkerHistory(markerId).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setHistory(result.data);
      }
      setHistoryLoading(false);
    }).catch(() => {
      if (!cancelled) setHistoryLoading(false);
    });

    return () => { cancelled = true; };
  }, [markerId]);

  if (!markerId) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-500">
        Select a marker to view history
      </div>
    );
  }

  if (historyLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        Loading history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-500">
        No history for {markerName}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-slate-400 uppercase">
        History: {markerName}
      </h4>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {history.map((entry) => (
          <div key={entry.id} className="p-2 bg-slate-800/50 rounded-lg border border-slate-700 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-slate-300 capitalize">
                {entry.action.replace(/_/g, ' ')}
              </span>
              <span className="text-slate-500">
                {new Date(entry.created_at).toLocaleDateString()}
              </span>
            </div>
            {entry.previous_values && (
              <p className="text-slate-500 truncate">
                Changed from: {JSON.stringify(entry.previous_values).slice(0, 60)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PatientAvatarPage: React.FC<PatientAvatarPageProps> = ({ patientId }) => {
  // Hooks
  const {
    avatar,
    loading: avatarLoading,
    error: avatarError,
    updateSkinTone,
    updateGenderPresentation,
  } = usePatientAvatar(patientId);

  const {
    markers,
    pendingCount,
    attentionCount,
    loading: markersLoading,
    error: markersError,
    createMarker,
    updateMarker,
    confirmMarker,
    rejectMarker,
    deactivateMarker,
    confirmAllPending,
  } = usePatientMarkers(patientId);

  // State
  const [view, setView] = useState<BodyView>('front');
  const [selectedMarker, setSelectedMarker] = useState<PatientMarker | null>(null);
  const [showMarkerForm, setShowMarkerForm] = useState(false);
  const [editingMarker, setEditingMarker] = useState<PatientMarker | undefined>(undefined);
  const [rightTab, setRightTab] = useState<RightPanelTab>('details');
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [showPopover, setShowPopover] = useState(false);

  // Derived
  const skinTone = avatar?.skin_tone ?? 'medium';
  const genderPresentation = avatar?.gender_presentation ?? 'neutral';

  const visibleMarkers = useMemo(() =>
    markers.filter((m) => m.is_active && m.status !== 'rejected' && m.body_view === view),
    [markers, view]
  );

  const markersByCategory = useMemo(() => {
    const grouped: Partial<Record<MarkerCategory, PatientMarker[]>> = {};
    const activeMarkers = markers.filter((m) => m.is_active && m.status !== 'rejected');
    for (const marker of activeMarkers) {
      const existing = grouped[marker.category];
      if (existing) {
        existing.push(marker);
      } else {
        grouped[marker.category] = [marker];
      }
    }
    return grouped;
  }, [markers]);

  // Handlers
  const handleMarkerClick = useCallback((marker: PatientMarker) => {
    setSelectedMarker(marker);
    setRightTab('details');
    setShowPopover(true);
  }, []);

  const handleConfirmAll = useCallback(async () => {
    setConfirmingAll(true);
    await confirmAllPending();
    setConfirmingAll(false);
  }, [confirmAllPending]);

  const handleAddMarker = useCallback(() => {
    setEditingMarker(undefined);
    setShowMarkerForm(true);
  }, []);

  const handleEditMarker = useCallback((marker: PatientMarker) => {
    setEditingMarker(marker);
    setShowMarkerForm(true);
    setShowPopover(false);
  }, []);

  const handleSaveMarker = useCallback(async (markerData: Omit<PatientMarker, 'id' | 'patient_id' | 'created_at' | 'updated_at'>) => {
    if (editingMarker) {
      await updateMarker(editingMarker.id, markerData);
    } else {
      await createMarker(markerData);
    }
    setShowMarkerForm(false);
    setEditingMarker(undefined);
  }, [editingMarker, createMarker, updateMarker]);

  const handleConfirm = useCallback(async () => {
    if (!selectedMarker) return;
    const success = await confirmMarker(selectedMarker.id);
    if (success) {
      setSelectedMarker(null);
      setShowPopover(false);
    }
  }, [selectedMarker, confirmMarker]);

  const handleReject = useCallback(async () => {
    if (!selectedMarker) return;
    const success = await rejectMarker(selectedMarker.id);
    if (success) {
      setSelectedMarker(null);
      setShowPopover(false);
    }
  }, [selectedMarker, rejectMarker]);

  const handleDeactivate = useCallback(async () => {
    if (!selectedMarker) return;
    const success = await deactivateMarker(selectedMarker.id);
    if (success) {
      setSelectedMarker(null);
      setShowPopover(false);
    }
  }, [selectedMarker, deactivateMarker]);

  const handlePrint = useCallback(() => {
    try {
      window.print();
    } catch (err: unknown) {
      auditLogger.error(
        'AVATAR_PRINT_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientId }
      );
    }
  }, [patientId]);

  // Loading state
  if (avatarLoading || markersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#00857a] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">Loading patient avatar...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (avatarError || markersError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load avatar</p>
          <p className="text-sm text-slate-500">{avatarError || markersError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6 print:p-2 print:bg-white">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6 print:mb-2">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-[#00857a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <div>
            <h1 className="text-xl font-semibold text-white print:text-black">
              Patient Body Map
            </h1>
            <p className="text-sm text-slate-400 print:text-gray-600">
              {markers.filter((m) => m.is_active && m.status !== 'rejected').length} active markers
              {attentionCount > 0 && ` · ${attentionCount} need attention`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <EAButton variant="secondary" size="sm" onClick={handlePrint}>
            Print
          </EAButton>
          <EAButton variant="primary" size="sm" onClick={handleAddMarker}>
            Add Marker
          </EAButton>
        </div>
      </div>

      {/* Pending Alert */}
      <div className="mb-4 print:hidden">
        <PendingAlert
          count={pendingCount}
          onConfirmAll={handleConfirmAll}
          confirming={confirmingAll}
        />
      </div>

      {/* Three-panel Layout */}
      <div className="grid grid-cols-12 gap-6 print:gap-2">
        {/* LEFT PANEL: Marker List */}
        <div className="col-span-3 print:col-span-4">
          <EACard className="h-full">
            <EACardHeader>
              <h3 className="text-sm font-medium text-white print:text-black">Markers</h3>
            </EACardHeader>
            <EACardContent className="max-h-[calc(100vh-16rem)] overflow-y-auto">
              {Object.keys(markersByCategory).length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-8">
                  No active markers
                </p>
              ) : (
                <div className="space-y-4">
                  {(Object.entries(markersByCategory) as Array<[MarkerCategory, PatientMarker[]]>).map(
                    ([category, catMarkers]) => (
                      <div key={category}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn('w-2 h-2 rounded-full', CATEGORY_COLORS[category].bg)} />
                          <span className="text-xs font-medium text-slate-400 uppercase">
                            {CATEGORY_LABELS[category]}
                          </span>
                          <span className="text-xs text-slate-600">({catMarkers.length})</span>
                        </div>
                        <div className="space-y-1">
                          {catMarkers.map((marker) => (
                            <button
                              key={marker.id}
                              className={cn(
                                'w-full text-left p-2 rounded-lg border transition-colors text-sm',
                                'hover:bg-slate-700/50',
                                selectedMarker?.id === marker.id
                                  ? 'bg-slate-700 border-[#00857a]'
                                  : 'bg-slate-800/50 border-slate-700',
                                marker.status === 'pending_confirmation' && 'border-dashed border-amber-500/50'
                              )}
                              onClick={() => handleMarkerClick(marker)}
                            >
                              <span className="text-white truncate block">{marker.display_name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
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
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </EACardContent>
          </EACard>
        </div>

        {/* CENTER PANEL: Avatar */}
        <div className="col-span-5 print:col-span-4">
          <EACard className="h-full">
            <EACardContent className="flex flex-col items-center py-4">
              {/* View toggle */}
              <div className="flex gap-2 mb-4 print:hidden">
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

              {/* Avatar with markers and status badges */}
              <div className="relative flex items-center justify-center w-full max-h-[500px]">
                <div className="relative">
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
                  <StatusBadgeRing markers={markers} size="lg" showLegend={false} />
                </div>
              </div>

              {/* Legend */}
              <div className="mt-4">
                <MarkerLegend />
              </div>
            </EACardContent>
          </EACard>
        </div>

        {/* RIGHT PANEL: Details / History / Settings */}
        <div className="col-span-4 print:col-span-4">
          <EACard className="h-full">
            {/* Tab bar */}
            <div className="flex border-b border-slate-700 print:hidden">
              {(['details', 'history', 'settings'] as RightPanelTab[]).map((tab) => (
                <button
                  key={tab}
                  className={cn(
                    'flex-1 py-3 px-4 text-sm font-medium transition-colors',
                    rightTab === tab
                      ? 'text-[#00857a] border-b-2 border-[#00857a]'
                      : 'text-slate-400 hover:text-slate-300'
                  )}
                  onClick={() => setRightTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <EACardContent className="max-h-[calc(100vh-16rem)] overflow-y-auto">
              {/* Details Tab */}
              {rightTab === 'details' && (
                <div>
                  {selectedMarker ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white">
                          {selectedMarker.display_name}
                        </h4>
                        <EABadge variant={selectedMarker.status === 'confirmed' ? 'normal' : 'high'}>
                          {selectedMarker.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </EABadge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Category</span>
                          <span className="text-white capitalize">{selectedMarker.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Region</span>
                          <span className="text-white">{selectedMarker.body_region.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Source</span>
                          <span className="text-white capitalize">{selectedMarker.source}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">View</span>
                          <span className="text-white capitalize">{selectedMarker.body_view}</span>
                        </div>
                        {selectedMarker.confidence_score !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Confidence</span>
                            <span className="text-white">{Math.round(selectedMarker.confidence_score * 100)}%</span>
                          </div>
                        )}
                        {selectedMarker.details?.insertion_date && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Inserted</span>
                            <span className="text-white">
                              {new Date(selectedMarker.details.insertion_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {selectedMarker.details?.care_instructions && (
                          <div className="mt-3">
                            <span className="text-slate-400 block mb-1">Care Instructions</span>
                            <p className="text-white text-xs bg-slate-800 rounded p-2">
                              {selectedMarker.details.care_instructions}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-3 border-t border-slate-700">
                        <EAButton variant="secondary" size="sm" onClick={() => handleEditMarker(selectedMarker)}>
                          Edit
                        </EAButton>
                        {selectedMarker.status === 'pending_confirmation' && (
                          <>
                            <EAButton variant="primary" size="sm" onClick={handleConfirm}>
                              Confirm
                            </EAButton>
                            <EAButton variant="danger" size="sm" onClick={handleReject}>
                              Reject
                            </EAButton>
                          </>
                        )}
                        {selectedMarker.status === 'confirmed' && (
                          <EAButton variant="danger" size="sm" onClick={handleDeactivate}>
                            Deactivate
                          </EAButton>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-sm text-slate-500">
                      Select a marker to view details
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {rightTab === 'history' && (
                <MarkerHistoryPanel
                  markerId={selectedMarker?.id ?? null}
                  markerName={selectedMarker?.display_name ?? null}
                />
              )}

              {/* Settings Tab */}
              {rightTab === 'settings' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-medium text-slate-400 uppercase">
                    Avatar Appearance
                  </h4>
                  <AvatarSettingsForm
                    currentSkinTone={skinTone}
                    currentGender={genderPresentation}
                    onSkinToneChange={updateSkinTone}
                    onGenderChange={updateGenderPresentation}
                    showPreview
                  />
                </div>
              )}
            </EACardContent>
          </EACard>
        </div>
      </div>

      {/* Marker Form Modal */}
      {showMarkerForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <MarkerForm
              patientId={patientId}
              existingMarker={editingMarker}
              skinTone={skinTone}
              genderPresentation={genderPresentation}
              onSave={handleSaveMarker}
              onClose={() => {
                setShowMarkerForm(false);
                setEditingMarker(undefined);
              }}
            />
          </div>
        </div>
      )}

      {/* Marker Detail Popover (accessible from marker list clicks) */}
      {selectedMarker && showPopover && (
        <MarkerDetailPopover
          marker={selectedMarker}
          isOpen={true}
          onClose={() => setShowPopover(false)}
          onConfirm={handleConfirm}
          onReject={handleReject}
          onDeactivate={handleDeactivate}
          onEdit={() => handleEditMarker(selectedMarker)}
        />
      )}
    </div>
  );
};

PatientAvatarPage.displayName = 'PatientAvatarPage';

export default PatientAvatarPage;
