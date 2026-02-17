/**
 * MarkerOverlay - Clinical marker dots overlaid on the 3D anatomy viewer
 *
 * Renders PICC lines, ulcers, wounds, devices, and other clinical markers
 * as positioned dots on top of the Three.js canvas. Markers use their
 * position_x/position_y (0-100%) coordinates from the patient_markers table.
 *
 * Category color coding matches the existing marker system:
 * - critical (red): Central lines, chest tubes, drains
 * - moderate (amber): PICC lines, IVs, catheters
 * - informational (blue): Surgical sites, healed wounds
 * - monitoring (purple): CGMs, cardiac monitors
 * - chronic (green): CHF, COPD markers
 * - neurological (orange): Neuro markers
 */

import React, { useState } from 'react';
import { cn } from '../../../lib/utils';
import type { AnatomyMarkerOverlay } from './types';

/** Category-to-color mapping (matches CATEGORY_COLORS in patientAvatar types) */
const MARKER_COLORS: Record<string, { bg: string; ring: string; text: string }> = {
  critical:      { bg: 'bg-red-500',    ring: 'ring-red-400',    text: 'text-red-200' },
  moderate:      { bg: 'bg-amber-500',  ring: 'ring-amber-400',  text: 'text-amber-200' },
  informational: { bg: 'bg-blue-500',   ring: 'ring-blue-400',   text: 'text-blue-200' },
  monitoring:    { bg: 'bg-purple-500',  ring: 'ring-purple-400', text: 'text-purple-200' },
  chronic:       { bg: 'bg-green-500',   ring: 'ring-green-400',  text: 'text-green-200' },
  neurological:  { bg: 'bg-orange-500',  ring: 'ring-orange-400', text: 'text-orange-200' },
  obstetric:     { bg: 'bg-pink-500',    ring: 'ring-pink-400',   text: 'text-pink-200' },
};

const DEFAULT_COLOR = { bg: 'bg-slate-500', ring: 'ring-slate-400', text: 'text-slate-200' };

interface MarkerOverlayProps {
  markers: AnatomyMarkerOverlay[];
  onMarkerClick?: (markerId: string) => void;
}

/**
 * Single marker dot with tooltip
 */
const MarkerDot: React.FC<{
  marker: AnatomyMarkerOverlay;
  onClick?: () => void;
}> = ({ marker, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const colors = MARKER_COLORS[marker.category] ?? DEFAULT_COLOR;

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
      style={{
        left: `${marker.position_x}%`,
        top: `${marker.position_y}%`,
      }}
    >
      {/* Pulse ring for attention markers */}
      {marker.requires_attention && (
        <span
          className={cn(
            'absolute inset-0 rounded-full animate-ping opacity-40',
            colors.bg,
          )}
          style={{ width: '20px', height: '20px', margin: '-4px' }}
        />
      )}

      {/* Marker dot */}
      <button
        className={cn(
          'w-3 h-3 rounded-full ring-2 ring-offset-1 ring-offset-slate-950 cursor-pointer',
          'hover:scale-150 transition-transform',
          colors.bg,
          colors.ring,
          marker.status === 'pending_confirmation' && 'animate-pulse',
        )}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={marker.display_name}
        title={marker.display_name}
      />

      {/* Tooltip */}
      {showTooltip && (
        <div
          className={cn(
            'absolute z-50 left-4 top-0',
            'bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2',
            'shadow-xl min-w-[140px] pointer-events-none',
          )}
        >
          <p className="text-xs font-medium text-white">{marker.display_name}</p>
          <p className={cn('text-[10px] capitalize', colors.text)}>
            {marker.category} — {marker.body_region.replace(/_/g, ' ')}
          </p>
          {marker.status === 'pending_confirmation' && (
            <p className="text-[10px] text-amber-400 mt-0.5">Pending confirmation</p>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * MarkerOverlay Component
 *
 * Positioned absolutely over the 3D canvas. Marker coordinates
 * (position_x, position_y) map to percentage positions within
 * this overlay div.
 */
export const MarkerOverlay: React.FC<MarkerOverlayProps> = ({
  markers,
  onMarkerClick,
}) => {
  // Only show active, non-rejected, front-view markers
  const visibleMarkers = markers.filter(
    m => m.is_active && m.status !== 'rejected' && m.body_view === 'front'
  );

  if (visibleMarkers.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Inner area roughly aligned to where the body renders in the canvas */}
      <div className="absolute left-1/2 top-[5%] -translate-x-1/2 w-[40%] h-[90%] pointer-events-auto">
        {visibleMarkers.map((marker) => (
          <MarkerDot
            key={marker.id}
            marker={marker}
            onClick={() => onMarkerClick?.(marker.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default MarkerOverlay;
