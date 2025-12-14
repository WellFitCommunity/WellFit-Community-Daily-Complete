/**
 * AvatarMarker - Individual marker component for the patient avatar
 *
 * Displays a colored marker at a specific position on the body.
 * Supports different categories, pending states, and attention indicators.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import {
  AvatarMarkerProps,
  PatientMarker,
  MarkerCategory,
  CATEGORY_COLORS,
} from '../../types/patientAvatar';

/**
 * Get the CSS classes for a marker category
 */
function getMarkerStyles(
  category: MarkerCategory,
  isPending: boolean,
  requiresAttention: boolean
): {
  bgClass: string;
  borderClass: string;
  pulseClass: string;
} {
  const colors = CATEGORY_COLORS[category];

  return {
    bgClass: colors.bg,
    borderClass: isPending
      ? 'border-dashed border-2 border-white/60'
      : `border border-white/30`,
    pulseClass: requiresAttention || isPending ? 'animate-pulse' : '',
  };
}

/**
 * Get marker size in SVG units based on size prop
 */
function getMarkerSize(size: 'sm' | 'md' | 'lg'): number {
  switch (size) {
    case 'sm':
      return 2.5;
    case 'lg':
      return 5;
    case 'md':
    default:
      return 3.5;
  }
}

/**
 * AvatarMarker Component
 *
 * Renders a single marker on the avatar body SVG.
 * This is designed to be rendered inside the AvatarBody SVG element.
 */
export const AvatarMarker: React.FC<AvatarMarkerProps> = React.memo(({
  marker,
  isPending = false,
  isHighlighted = false,
  onClick,
  size = 'md',
}) => {
  const { bgClass, borderClass, pulseClass } = getMarkerStyles(
    marker.category,
    isPending || marker.status === 'pending_confirmation',
    marker.requires_attention
  );

  const markerSize = getMarkerSize(size);
  const halfSize = markerSize / 2;

  // Convert percentage position to SVG coordinates (viewBox is 0-100 x 0-160)
  const cx = marker.position_x;
  const cy = marker.position_y * 1.6; // Scale Y for the 160 height viewBox

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(marker);
  };

  // Get the fill color from Tailwind class (simplified mapping)
  const getCategoryColor = (category: MarkerCategory): string => {
    switch (category) {
      case 'critical':
        return '#ef4444'; // red-500
      case 'moderate':
        return '#eab308'; // yellow-500
      case 'informational':
        return '#3b82f6'; // blue-500
      case 'monitoring':
        return '#a855f7'; // purple-500
      case 'chronic':
        return '#22c55e'; // green-500
      case 'neurological':
        return '#f97316'; // orange-500
      default:
        return '#64748b'; // slate-500
    }
  };

  const fillColor = getCategoryColor(marker.category);
  const showPulse = marker.requires_attention || marker.status === 'pending_confirmation';
  const showDashed = marker.status === 'pending_confirmation';

  return (
    <g
      className={cn(
        'cursor-pointer transition-transform hover:scale-125',
        isHighlighted && 'scale-125'
      )}
      onClick={handleClick}
      role="button"
      aria-label={`${marker.display_name} - ${marker.category}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(marker);
        }
      }}
    >
      {/* Pulse ring for attention items */}
      {showPulse && (
        <circle
          cx={cx}
          cy={cy}
          r={markerSize + 1}
          fill="none"
          stroke={fillColor}
          strokeWidth="0.5"
          opacity="0.6"
          className="animate-ping"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      )}

      {/* Outer glow/shadow */}
      <circle
        cx={cx}
        cy={cy}
        r={markerSize + 0.5}
        fill="rgba(0,0,0,0.3)"
      />

      {/* Main marker circle */}
      <circle
        cx={cx}
        cy={cy}
        r={markerSize}
        fill={fillColor}
        stroke={showDashed ? '#ffffff' : 'rgba(255,255,255,0.4)'}
        strokeWidth={showDashed ? 0.6 : 0.4}
        strokeDasharray={showDashed ? '1,1' : 'none'}
      />

      {/* Inner highlight */}
      <circle
        cx={cx - halfSize * 0.3}
        cy={cy - halfSize * 0.3}
        r={markerSize * 0.3}
        fill="rgba(255,255,255,0.4)"
      />

      {/* SmartScribe indicator for pending markers */}
      {marker.source === 'smartscribe' && marker.status === 'pending_confirmation' && (
        <text
          x={cx}
          y={cy + 0.8}
          textAnchor="middle"
          fontSize="3"
          fill="white"
          fontWeight="bold"
        >
          ?
        </text>
      )}
    </g>
  );
});

AvatarMarker.displayName = 'AvatarMarker';

/**
 * MarkerTooltip - Simple tooltip for marker hover
 * Used in compact view
 */
export const MarkerTooltip: React.FC<{
  marker: PatientMarker;
  x: number;
  y: number;
}> = ({ marker, x, y }) => {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x="-20"
        y="-10"
        width="40"
        height="8"
        rx="1"
        fill="rgba(15, 23, 42, 0.9)"
      />
      <text
        x="0"
        y="-4"
        textAnchor="middle"
        fontSize="2.5"
        fill="white"
        fontFamily="system-ui, sans-serif"
      >
        {marker.display_name.slice(0, 20)}
        {marker.display_name.length > 20 && '...'}
      </text>
    </g>
  );
};

export default AvatarMarker;
