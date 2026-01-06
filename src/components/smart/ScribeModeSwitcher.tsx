/**
 * ScribeModeSwitcher - Toggle between SmartScribe and Compass Riley modes
 *
 * Purpose: Allow users to switch between nurse mode (transcription only) and
 *          physician mode (full AI analysis with billing codes)
 * Used by: RealTimeSmartScribe
 */

import React from 'react';
import { ScribeMode } from './RealTimeSmartScribe';

interface ScribeModeSwitcherProps {
  mode: ScribeMode;
  onModeChange: (mode: ScribeMode) => void;
  disabled?: boolean;
}

export const ScribeModeSwitcher: React.FC<ScribeModeSwitcherProps> = React.memo(({
  mode,
  onModeChange,
  disabled = false,
}) => {
  const isSmartScribe = mode === 'smartscribe';

  return (
    <div className="flex items-center justify-center gap-2 p-2 bg-slate-800/50 rounded-lg">
      {/* SmartScribe (Nurse) Option */}
      <button
        type="button"
        onClick={() => onModeChange('smartscribe')}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
          min-h-[44px] min-w-[44px]
          ${isSmartScribe
            ? 'bg-blue-600 text-white shadow-lg'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-pressed={isSmartScribe}
        aria-label="Switch to SmartScribe mode for nurses"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>SmartScribe</span>
        <span className="text-xs opacity-75">(Nurses)</span>
      </button>

      {/* Compass Riley (Physician) Option */}
      <button
        type="button"
        onClick={() => onModeChange('compass-riley')}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
          min-h-[44px] min-w-[44px]
          ${!isSmartScribe
            ? 'bg-[#00857a] text-white shadow-lg'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-pressed={!isSmartScribe}
        aria-label="Switch to Compass Riley mode for physicians"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <span>Compass Riley</span>
        <span className="text-xs opacity-75">(Physicians)</span>
      </button>
    </div>
  );
});

ScribeModeSwitcher.displayName = 'ScribeModeSwitcher';

export default ScribeModeSwitcher;
