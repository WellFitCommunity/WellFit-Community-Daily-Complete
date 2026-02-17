/**
 * AvatarThumbnail - Compact avatar view for patient lists and dashboards
 *
 * Shows a small avatar with marker indicators.
 * Click to expand to full-body view.
 * Includes StatusBadgeRing for precautions, isolation, code status, and alerts.
 */

import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { PatientMarker, SkinTone, GenderPresentation, MarkerCategory, CATEGORY_COLORS } from '../../types/patientAvatar';
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
    obstetric: 0,
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
    obstetric: 'OB',
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
  patientId: _patientId,
  patientName,
  skinTone: _skinTone,
  genderPresentation: _genderPresentation,
  markers,
  pendingCount = 0,
  allergyCount,
  showChangesSince,
  onBadgeClick,
  onClick,
  className,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Compute patient initials from name
  const initials = useMemo(() => {
    if (!patientName) return '?';
    const parts = patientName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }, [patientName]);

  // Parse showChangesSince into a Date
  const changeSinceDate = useMemo(() => {
    if (!showChangesSince) return null;
    return typeof showChangesSince === 'string'
      ? new Date(showChangesSince)
      : showChangesSince;
  }, [showChangesSince]);

  // Separate status badges for ring display, count new markers
  const { statusBadgeMarkers, newMarkersCount } = useMemo(() => {
    const badges: PatientMarker[] = [];
    let newCount = 0;

    for (const marker of markers) {
      if (!marker.is_active || marker.status === 'rejected') continue;

      if (changeSinceDate && isMarkerNew(marker, changeSinceDate)) {
        newCount++;
      }

      const typeDef = getMarkerTypeDefinition(marker.marker_type);
      if (typeDef?.is_status_badge) {
        badges.push(marker);
      }
    }

    return {
      statusBadgeMarkers: badges,
      newMarkersCount: newCount,
    };
  }, [markers, changeSinceDate]);

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
      {/* Clinical Initials Avatar */}
      <div className="relative w-[64px] h-[64px]">
        <div
          className={cn(
            'w-[64px] h-[64px] rounded-full flex items-center justify-center',
            'bg-gradient-to-br from-teal-600 to-teal-800 border-2 border-teal-500/40',
            'shadow-lg shadow-teal-900/30',
            totalMarkers > 0 && counts.critical > 0 && 'ring-2 ring-red-500/60 ring-offset-2 ring-offset-slate-800',
          )}
        >
          <span className="text-lg font-bold text-white leading-none select-none">
            {initials}
          </span>
        </div>

        {/* Status badges around the circle */}
        {statusBadgeMarkers.length > 0 && (
          <StatusBadgeRing
            markers={statusBadgeMarkers}
            size="sm"
            allergyCount={allergyCount}
            onBadgeClick={onBadgeClick}
          />
        )}

        {/* Marker count indicator (bottom-right corner) */}
        {totalMarkers > 0 && (
          <div className={cn(
            'absolute -bottom-1 -right-1 min-w-[20px] h-[20px]',
            'flex items-center justify-center rounded-full text-xs font-bold',
            'border-2 border-slate-800',
            counts.critical > 0
              ? 'bg-red-500 text-white'
              : counts.moderate > 0
                ? 'bg-amber-500 text-white'
                : 'bg-slate-600 text-slate-200',
          )}>
            {totalMarkers}
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
