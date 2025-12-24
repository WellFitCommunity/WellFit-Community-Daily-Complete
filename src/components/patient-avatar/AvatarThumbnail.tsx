/**
 * AvatarThumbnail - Compact avatar view for patient lists and dashboards
 *
 * Shows a small avatar with marker indicators.
 * Click to expand to full-body view.
 * Includes StatusBadgeRing for precautions, isolation, code status, and alerts.
 */

import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { PatientMarker, SkinTone, GenderPresentation, BodyView, MarkerCategory, CATEGORY_COLORS } from '../../types/patientAvatar';
import { AvatarBody } from './AvatarBody';
import { AvatarMarker } from './AvatarMarker';
import { StatusBadgeRing } from './StatusBadgeRing';
import { getMarkerTypeDefinition } from './constants/markerTypeLibrary';

interface AvatarThumbnailProps {
  patientId: string;
  patientName?: string;
  skinTone: SkinTone;
  genderPresentation: GenderPresentation;
  markers: PatientMarker[];
  pendingCount?: number;
  /** Number of allergies for the allergy badge count */
  allergyCount?: number;
  /** Highlight markers created/updated since this time (for shift handoff "What's New") */
  showChangesSince?: Date | string;
  /** Callback when a status badge is clicked */
  onBadgeClick?: (marker: PatientMarker) => void;
  onClick?: () => void;
  className?: string;
}

/**
 * Get marker counts by category
 */
function getMarkerCounts(markers: PatientMarker[]): Record<MarkerCategory, number> {
  const counts: Record<MarkerCategory, number> = {
    critical: 0,
    moderate: 0,
    informational: 0,
    monitoring: 0,
    chronic: 0,
    neurological: 0,
  };

  for (const marker of markers) {
    if (marker.is_active && marker.status !== 'rejected') {
      counts[marker.category]++;
    }
  }

  return counts;
}

/**
 * Category badge for tooltip
 */
const CategoryBadge: React.FC<{ category: MarkerCategory; count: number }> = ({
  category,
  count,
}) => {
  if (count === 0) return null;

  const colors = CATEGORY_COLORS[category];
  const labels: Record<MarkerCategory, string> = {
    critical: 'Critical',
    moderate: 'Moderate',
    informational: 'Info',
    monitoring: 'Monitoring',
    chronic: 'Chronic',
    neurological: 'Neuro',
  };

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={cn('w-2 h-2 rounded-full', colors.bg)} />
      <span className="text-slate-300">{labels[category]}</span>
      <span className="text-white font-medium">{count}</span>
    </div>
  );
};

/**
 * Check if a marker is "new" since the reference time
 */
function isMarkerNew(marker: PatientMarker, since: Date): boolean {
  const createdAt = new Date(marker.created_at);
  const updatedAt = new Date(marker.updated_at);
  return createdAt >= since || updatedAt >= since;
}

/**
 * AvatarThumbnail Component
 */
export const AvatarThumbnail: React.FC<AvatarThumbnailProps> = React.memo(({
  patientId,
  patientName,
  skinTone,
  genderPresentation,
  markers,
  pendingCount = 0,
  allergyCount,
  showChangesSince,
  onBadgeClick,
  onClick,
  className,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Parse showChangesSince into a Date
  const changeSinceDate = useMemo(() => {
    if (!showChangesSince) return null;
    return typeof showChangesSince === 'string'
      ? new Date(showChangesSince)
      : showChangesSince;
  }, [showChangesSince]);

  // Separate anatomical markers (on body) from status badges (around body)
  const { anatomicalMarkers, statusBadgeMarkers, newMarkersCount, newMarkerIds } = useMemo(() => {
    const anatomical: PatientMarker[] = [];
    const badges: PatientMarker[] = [];
    const newIds = new Set<string>();
    let newCount = 0;

    for (const marker of markers) {
      if (!marker.is_active || marker.status === 'rejected') continue;

      // Track new markers
      if (changeSinceDate && isMarkerNew(marker, changeSinceDate)) {
        newCount++;
        newIds.add(marker.id);
      }

      const typeDef = getMarkerTypeDefinition(marker.marker_type);
      if (typeDef?.is_status_badge) {
        badges.push(marker);
      } else {
        anatomical.push(marker);
      }
    }

    return {
      anatomicalMarkers: anatomical,
      statusBadgeMarkers: badges,
      newMarkersCount: newCount,
      newMarkerIds: newIds,
    };
  }, [markers, changeSinceDate]);

  // Filter to front view anatomical markers
  const frontMarkers = anatomicalMarkers.filter((m) => m.body_view === 'front');

  const counts = getMarkerCounts(markers);
  const totalMarkers = markers.filter((m) => m.is_active && m.status !== 'rejected').length;

  return (
    <div
      className={cn(
        'relative inline-block cursor-pointer',
        'transition-transform hover:scale-105',
        'rounded-lg p-2 bg-slate-800/50 border border-slate-700',
        'hover:border-[#00857a]/50 hover:bg-slate-800',
        className
      )}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`View ${patientName || 'patient'} avatar - ${totalMarkers} markers`}
    >
      {/* Avatar Body with Markers */}
      <div className="relative w-[100px] h-[160px]">
        <AvatarBody
          skinTone={skinTone}
          genderPresentation={genderPresentation}
          view="front"
          size="thumbnail"
        >
          {/* Render anatomical markers on the body */}
          {frontMarkers.slice(0, 10).map((marker) => (
            <AvatarMarker
              key={marker.id}
              marker={marker}
              size="sm"
              isPending={marker.status === 'pending_confirmation'}
              isHighlighted={newMarkerIds.has(marker.id)}
            />
          ))}
        </AvatarBody>

        {/* Status badges around the body */}
        {statusBadgeMarkers.length > 0 && (
          <StatusBadgeRing
            markers={statusBadgeMarkers}
            size="sm"
            allergyCount={allergyCount}
            onBadgeClick={onBadgeClick}
          />
        )}

        {/* More markers indicator */}
        {frontMarkers.length > 10 && (
          <div className="absolute bottom-2 right-2 text-xs bg-slate-900/80 text-slate-300 px-1.5 py-0.5 rounded-sm">
            +{frontMarkers.length - 10}
          </div>
        )}
      </div>

      {/* Pending badge */}
      {pendingCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {pendingCount}
        </div>
      )}

      {/* "What's New" badge for recent changes (shift handoff) */}
      {newMarkersCount > 0 && !pendingCount && (
        <div className="absolute -top-2 -right-2 bg-cyan-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center animate-pulse">
          {newMarkersCount}
        </div>
      )}

      {/* Marker count summary */}
      <div className="mt-1 text-center">
        <span className="text-xs text-slate-400">
          {totalMarkers} marker{totalMarkers !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tooltip on hover */}
      {showTooltip && totalMarkers > 0 && (
        <div
          className={cn(
            'absolute z-50 left-full ml-2 top-0',
            'bg-slate-900 border border-slate-700 rounded-lg p-3',
            'shadow-xl min-w-[150px]',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
        >
          <div className="text-sm font-medium text-white mb-2">
            {patientName || 'Patient'} Markers
          </div>
          <div className="space-y-1">
            <CategoryBadge category="critical" count={counts.critical} />
            <CategoryBadge category="neurological" count={counts.neurological} />
            <CategoryBadge category="chronic" count={counts.chronic} />
            <CategoryBadge category="moderate" count={counts.moderate} />
            <CategoryBadge category="monitoring" count={counts.monitoring} />
            <CategoryBadge category="informational" count={counts.informational} />
          </div>
          {pendingCount > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <span className="text-xs text-amber-400">
                {pendingCount} pending confirmation
              </span>
            </div>
          )}
          {newMarkersCount > 0 && (
            <div className={cn(
              "mt-2 pt-2 border-t border-slate-700",
              pendingCount > 0 && "mt-1 pt-1"
            )}>
              <span className="text-xs text-cyan-400">
                {newMarkersCount} new/updated since handoff
              </span>
            </div>
          )}
          <div className="mt-2 text-xs text-slate-500">
            Click to expand
          </div>
        </div>
      )}
    </div>
  );
});

AvatarThumbnail.displayName = 'AvatarThumbnail';

export default AvatarThumbnail;
