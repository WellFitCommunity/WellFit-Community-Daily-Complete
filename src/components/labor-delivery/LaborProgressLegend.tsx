/**
 * LaborProgressLegend - Below-avatar readout panel for labor progress
 *
 * Purpose: Displays dilation, station, and contraction status as readable
 *   text badges below the avatar. Shows "No active labor" empty state.
 * Used by: LaborAvatarPanel
 */

import React from 'react';
import type { LDLaborEvent } from '../../types/laborDelivery';

interface LaborProgressLegendProps {
  laborEvents: LDLaborEvent[];
}

function getDilationPhase(cm: number): { label: string; color: string; bg: string } {
  if (cm < 4) return { label: 'Latent', color: 'text-green-700', bg: 'bg-green-100' };
  if (cm < 8) return { label: 'Active', color: 'text-yellow-700', bg: 'bg-yellow-100' };
  if (cm < 10) return { label: 'Transition', color: 'text-red-700', bg: 'bg-red-100' };
  return { label: 'Complete', color: 'text-red-700', bg: 'bg-red-200' };
}

function getContractionLabel(
  intensity: 'mild' | 'moderate' | 'strong' | null,
  freq: number | null,
  dur: number | null
): string | null {
  if (!intensity) return null;
  let label = intensity.charAt(0).toUpperCase() + intensity.slice(1);
  if (freq) label += ` ${freq}/10min`;
  if (dur) label += ` x ${dur}s`;
  return label;
}

export const LaborProgressLegend: React.FC<LaborProgressLegendProps> = ({
  laborEvents,
}) => {
  if (laborEvents.length === 0) {
    return (
      <div className="text-center py-2" data-testid="labor-legend-empty">
        <p className="text-xs text-gray-400">No active labor data</p>
      </div>
    );
  }

  const latest = laborEvents.reduce((l, e) =>
    new Date(e.event_time) > new Date(l.event_time) ? e : l
  );

  const phase = getDilationPhase(latest.dilation_cm);
  const contractionLabel = getContractionLabel(
    latest.contraction_intensity,
    latest.contraction_frequency_per_10min,
    latest.contraction_duration_seconds,
  );

  return (
    <div className="space-y-1 px-3 pb-3" data-testid="labor-progress-legend">
      {/* Dilation */}
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${phase.bg}`} />
        <span className="text-xs text-gray-500">Dilation:</span>
        <span className={`text-xs font-bold ${phase.color}`}>
          {latest.dilation_cm}cm ({phase.label})
        </span>
      </div>

      {/* Station */}
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-purple-100" />
        <span className="text-xs text-gray-500">Station:</span>
        <span className="text-xs font-bold text-purple-700">
          {latest.station > 0 ? '+' : ''}{latest.station}
        </span>
      </div>

      {/* Contractions */}
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${contractionLabel ? 'bg-red-100' : 'bg-gray-100'}`} />
        <span className="text-xs text-gray-500">Contractions:</span>
        {contractionLabel ? (
          <span className="text-xs font-bold text-red-700">{contractionLabel}</span>
        ) : (
          <span className="text-xs text-gray-400">None recorded</span>
        )}
      </div>
    </div>
  );
};

LaborProgressLegend.displayName = 'LaborProgressLegend';

export default LaborProgressLegend;
