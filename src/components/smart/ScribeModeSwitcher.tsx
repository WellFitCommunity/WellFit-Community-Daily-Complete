/**
 * ScribeModeSwitcher - Toggle between SmartScribe, Compass Riley, and Consultation modes
 *
 * Purpose: Allow users to switch between nurse mode (transcription only),
 *          physician scribe mode (AI analysis with billing), and
 *          consultation mode (clinical reasoning partner)
 * Used by: RealTimeSmartScribe
 */

import React from 'react';
import { ScribeMode } from './RealTimeSmartScribe';

interface ScribeModeSwitcherProps {
  mode: ScribeMode;
  onModeChange: (mode: ScribeMode) => void;
  disabled?: boolean;
}

interface ModeOption {
  key: ScribeMode;
  label: string;
  sublabel: string;
  activeColor: string;
  ariaLabel: string;
  icon: React.ReactNode;
}

const MODES: ModeOption[] = [
  {
    key: 'smartscribe',
    label: 'SmartScribe',
    sublabel: '(Nurses)',
    activeColor: 'bg-blue-600',
    ariaLabel: 'Switch to SmartScribe mode for nurses',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: 'compass-riley',
    label: 'Compass Riley',
    sublabel: '(Scribe)',
    activeColor: 'bg-[#00857a]',
    ariaLabel: 'Switch to Compass Riley scribe mode for physicians',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: 'consultation',
    label: 'Consultation',
    sublabel: '(Reasoning)',
    activeColor: 'bg-purple-600',
    ariaLabel: 'Switch to Consultation mode for clinical reasoning',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

export const ScribeModeSwitcher: React.FC<ScribeModeSwitcherProps> = React.memo(({
  mode,
  onModeChange,
  disabled = false,
}) => {
  return (
    <div className="flex items-center justify-center gap-1.5 p-2 bg-slate-800/50 rounded-lg" role="radiogroup" aria-label="Scribe mode selector">
      {MODES.map(({ key, label, sublabel, activeColor, ariaLabel, icon }) => {
        const isActive = mode === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            onClick={() => onModeChange(key)}
            disabled={disabled}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
              min-h-[44px] min-w-[44px]
              ${isActive
                ? `${activeColor} text-white shadow-lg`
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            aria-checked={isActive}
            aria-label={ariaLabel}
          >
            {icon}
            <span>{label}</span>
            <span className="text-xs opacity-75 hidden sm:inline">{sublabel}</span>
          </button>
        );
      })}
    </div>
  );
});

ScribeModeSwitcher.displayName = 'ScribeModeSwitcher';

export default ScribeModeSwitcher;
