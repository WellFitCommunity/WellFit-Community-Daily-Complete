/**
 * LaborProgressOverlay - SVG overlay for PregnancyAvatarBody
 *
 * Purpose: Renders live labor progress (dilation ring, fetal station indicator,
 *   contraction overlay) as SVG children inside the pregnancy avatar.
 * Used by: LaborAvatarPanel (passed as children to PregnancyAvatarBody)
 */

import React from 'react';
import type { LDLaborEvent } from '../../types/laborDelivery';

interface LaborProgressOverlayProps {
  laborEvents: LDLaborEvent[];
  className?: string;
}

/** Color by dilation phase: latent (<4), active (4-7), transition (8-10) */
function getDilationColor(cm: number): { stroke: string; fill: string } {
  if (cm < 4) return { stroke: '#22c55e', fill: 'rgba(34,197,94,0.2)' };
  if (cm < 8) return { stroke: '#eab308', fill: 'rgba(234,179,8,0.2)' };
  return { stroke: '#ef4444', fill: 'rgba(239,68,68,0.25)' };
}

/** Map fetal station (-5 to +5) to SVG y-coordinate on the avatar body
 *  Station -5 (high) -> y=75 (upper pelvis, higher on SVG)
 *  Station  0 (ischial spines) -> y=87.5
 *  Station +5 (crowning) -> y=100 (cervix region, lower on SVG)
 */
function stationToY(station: number): number {
  const clamped = Math.max(-5, Math.min(5, station));
  return 75 + (clamped + 5) * 2.5;
}

/** Color by station zone */
function getStationColor(station: number): string {
  if (station <= -3) return '#3b82f6'; // High - blue
  if (station <= 0) return '#8b5cf6';  // Mid - purple
  if (station <= 2) return '#f59e0b';  // Low - amber
  return '#ef4444';                     // Crowning - red
}

/** Contraction intensity to overlay opacity */
function getContractionOpacity(intensity: 'mild' | 'moderate' | 'strong' | null): number {
  switch (intensity) {
    case 'mild': return 0.15;
    case 'moderate': return 0.25;
    case 'strong': return 0.4;
    default: return 0;
  }
}

/**
 * Get the latest labor event from the array, sorted by event_time descending.
 * Returns null if array is empty.
 */
function getLatestEvent(events: LDLaborEvent[]): LDLaborEvent | null {
  if (events.length === 0) return null;
  return events.reduce((latest, e) =>
    new Date(e.event_time) > new Date(latest.event_time) ? e : latest
  );
}

export const LaborProgressOverlay: React.FC<LaborProgressOverlayProps> = ({
  laborEvents,
}) => {
  const latest = getLatestEvent(laborEvents);
  if (!latest) return null;

  const { dilation_cm, station, contraction_intensity } = latest;
  const dilationColors = getDilationColor(dilation_cm);
  const dilationRadius = Math.round(dilation_cm * 0.6 * 10) / 10;
  const stationY = stationToY(station);
  const stationColor = getStationColor(station);
  const contractionOpacity = getContractionOpacity(contraction_intensity);
  const hasContraction = contraction_intensity !== null;

  return (
    <g data-testid="labor-progress-overlay">
      {/* Contraction overlay - pulsing belly ellipse */}
      {hasContraction && (
        <ellipse
          cx={50}
          cy={82}
          rx={14}
          ry={10}
          fill="#ef4444"
          opacity={contractionOpacity}
          data-testid="contraction-overlay"
        >
          <animate
            attributeName="opacity"
            values={`${contractionOpacity};${contractionOpacity * 0.4};${contractionOpacity}`}
            dur="2s"
            repeatCount="indefinite"
          />
        </ellipse>
      )}

      {/* Dilation ring at cervix region */}
      {dilation_cm > 0 && (
        <circle
          cx={50}
          cy={100}
          r={dilationRadius}
          fill={dilationColors.fill}
          stroke={dilationColors.stroke}
          strokeWidth={0.6}
          data-testid="dilation-ring"
        >
          {/* Subtle pulse when approaching complete */}
          {dilation_cm >= 8 && (
            <animate
              attributeName="r"
              values={`${dilationRadius};${dilationRadius + 0.4};${dilationRadius}`}
              dur="1.5s"
              repeatCount="indefinite"
            />
          )}
        </circle>
      )}

      {/* Dilation label */}
      {dilation_cm > 0 && (
        <text
          x={50}
          y={100 + dilationRadius + 3}
          textAnchor="middle"
          fontSize={3}
          fill={dilationColors.stroke}
          fontFamily="system-ui, sans-serif"
          fontWeight="bold"
        >
          {dilation_cm}cm
        </text>
      )}

      {/* Station indicator - diamond marker */}
      <g data-testid="station-indicator" transform={`translate(50, ${stationY})`}>
        <polygon
          points="0,-2 1.5,0 0,2 -1.5,0"
          fill={stationColor}
          stroke="#fff"
          strokeWidth={0.3}
        />
        <text
          x={3.5}
          y={1}
          fontSize={2.5}
          fill={stationColor}
          fontFamily="system-ui, sans-serif"
          fontWeight="bold"
        >
          {station > 0 ? '+' : ''}{station}
        </text>
      </g>

      {/* Station track line (dashed vertical guide from y=75 to y=100) */}
      <line
        x1={50}
        y1={75}
        x2={50}
        y2={100}
        stroke="#94a3b8"
        strokeWidth={0.3}
        strokeDasharray="1 1"
        opacity={0.4}
      />
    </g>
  );
};

LaborProgressOverlay.displayName = 'LaborProgressOverlay';

export default LaborProgressOverlay;
