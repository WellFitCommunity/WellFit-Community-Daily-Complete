/**
 * ScribeModeSwitcher - Toggle between SmartScribe, Compass Riley, and Consultation modes
 * Session 2: Added reasoning mode selector (Auto/Chain/Tree) for CoT/ToT control
 *
 * Purpose: Allow users to switch between nurse mode (transcription only),
 *          physician scribe mode (AI analysis with billing), and
 *          consultation mode (clinical reasoning partner)
 * Used by: RealTimeSmartScribe
 */

import React from 'react';
import { ScribeMode } from './RealTimeSmartScribe';

/** Reasoning mode for CoT/ToT proportional reasoning */
export type ReasoningModeUI = 'auto' | 'chain' | 'tree';

interface ScribeModeSwitcherProps {
  mode: ScribeMode;
  onModeChange: (mode: ScribeMode) => void;
  /** Reasoning mode (Auto/Chain/Tree) — only shown in physician modes */
  reasoningMode?: ReasoningModeUI;
  onReasoningModeChange?: (mode: ReasoningModeUI) => void;
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

interface ReasoningOption {
  key: ReasoningModeUI;
  label: string;
  tooltip: string;
}

const REASONING_MODES: ReasoningOption[] = [
  { key: 'auto', label: 'Auto', tooltip: 'System decides — Chain for clear cases, Tree for complex' },
  { key: 'chain', label: 'Chain', tooltip: 'Force linear reasoning — concise, direct output' },
  { key: 'tree', label: 'Tree', tooltip: 'Force branching — explore differentials, then converge' },
];

export const ScribeModeSwitcher: React.FC<ScribeModeSwitcherProps> = React.memo(({
  mode,
  onModeChange,
  reasoningMode = 'auto',
  onReasoningModeChange,
  disabled = false,
}) => {
  const showReasoningSelector = mode !== 'smartscribe' && onReasoningModeChange;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Primary mode selector */}
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

      {/* Reasoning mode selector — only for physician modes */}
      {showReasoningSelector && (
        <div
          className="flex items-center gap-1 px-2 py-1 bg-slate-800/30 rounded-md"
          role="radiogroup"
          aria-label="Reasoning mode selector"
        >
          <span className="text-xs text-slate-400 mr-1">Reasoning:</span>
          {REASONING_MODES.map(({ key, label, tooltip }) => {
            const isActive = reasoningMode === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                onClick={() => onReasoningModeChange(key)}
                disabled={disabled}
                title={tooltip}
                className={`
                  px-2 py-1 rounded text-xs font-medium transition-all
                  min-h-[32px] min-w-[44px]
                  ${isActive
                    ? 'bg-amber-600/80 text-white'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-slate-200'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                aria-checked={isActive}
                aria-label={`${label} reasoning mode: ${tooltip}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

ScribeModeSwitcher.displayName = 'ScribeModeSwitcher';

export default ScribeModeSwitcher;
