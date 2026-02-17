/**
 * LayerPanel - UI controls for toggling anatomy system layers
 *
 * Provides toggle buttons for each body system with color indicators,
 * opacity sliders, and a reset button. Designed for clinical use with
 * accessible touch targets (44px minimum).
 */

import React from 'react';
import type { AnatomySystem, LayerState } from './types';
import { getSortedLayers } from './anatomyLayers';

interface LayerPanelProps {
  /** Current state of all layers */
  layers: readonly LayerState[];
  /** Toggle a layer on/off */
  onToggle: (system: AnatomySystem) => void;
  /** Set a layer's opacity */
  onOpacityChange: (system: AnatomySystem, opacity: number) => void;
  /** Solo a layer (hide all others) */
  onSolo: (system: AnatomySystem) => void;
  /** Reset all layers to defaults */
  onReset: () => void;
  /** Compact mode (fewer controls) */
  compact?: boolean;
  /** Currently selected/highlighted system */
  selectedSystem?: AnatomySystem | null;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  onToggle,
  onOpacityChange,
  onSolo,
  onReset,
  compact = false,
  selectedSystem,
}) => {
  const sortedConfigs = getSortedLayers();

  const getLayerState = (system: AnatomySystem): LayerState | undefined =>
    layers.find(l => l.system === system);

  return (
    <div className="flex flex-col gap-1 p-2 bg-slate-900/90 rounded-lg backdrop-blur-sm border border-slate-700">
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Layers
        </h3>
        <button
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-white transition-colors min-h-[32px] px-2"
          title="Reset all layers to defaults"
        >
          Reset
        </button>
      </div>

      {sortedConfigs.map(config => {
        const state = getLayerState(config.system);
        if (!state) return null;

        const isSelected = selectedSystem === config.system;

        return (
          <div
            key={config.system}
            className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${
              isSelected ? 'bg-slate-700/60' : 'hover:bg-slate-800/60'
            }`}
          >
            {/* Color indicator + toggle */}
            <button
              onClick={() => onToggle(config.system)}
              className="flex items-center gap-2 min-h-[44px] min-w-[44px] flex-1"
              title={`${state.visible ? 'Hide' : 'Show'} ${config.label}`}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
                style={{
                  backgroundColor: state.visible ? config.color : 'transparent',
                  borderColor: config.color,
                }}
              />
              <span
                className={`text-sm ${
                  state.visible ? 'text-white' : 'text-slate-500'
                }`}
              >
                {config.label}
              </span>
            </button>

            {/* Solo button */}
            {!compact && (
              <button
                onClick={() => onSolo(config.system)}
                className="text-xs text-slate-500 hover:text-yellow-400 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                title={`Solo ${config.label}`}
              >
                S
              </button>
            )}

            {/* Opacity slider */}
            {!compact && state.visible && (
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(state.opacity * 100)}
                onChange={(e) =>
                  onOpacityChange(config.system, Number(e.target.value) / 100)
                }
                className="w-16 h-1 accent-slate-400"
                title={`Opacity: ${Math.round(state.opacity * 100)}%`}
              />
            )}
          </div>
        );
      })}

      {/* Attribution */}
      <div className="px-2 pt-1 border-t border-slate-700/50">
        <p className="text-[10px] text-slate-600">
          Model: Z-Anatomy (CC BY-SA 4.0)
        </p>
      </div>
    </div>
  );
};
