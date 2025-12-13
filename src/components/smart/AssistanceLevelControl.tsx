/**
 * Assistance Level Control Component
 *
 * Controls for Riley's assistance level (Concise, Balanced, Detailed).
 * Split from RealTimeSmartScribe for better performance.
 */

import React from 'react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';

interface AssistanceSettings {
  label: string;
  description: string;
}

interface AssistanceLevelControlProps {
  assistanceLevel: number;
  assistanceLevelLoaded: boolean;
  assistanceLevelSaved: boolean;
  assistanceSettings: AssistanceSettings;
  isRecording: boolean;
  onLevelChange: (level: number) => void;
}

export const AssistanceLevelControl: React.FC<AssistanceLevelControlProps> = React.memo(({
  assistanceLevel,
  assistanceLevelLoaded,
  assistanceLevelSaved,
  assistanceSettings,
  isRecording,
  onLevelChange,
}) => {
  return (
    <EACard>
      <EACardHeader
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        }
        action={
          assistanceLevelSaved && (
            <span className="text-xs text-green-400 flex items-center gap-1 animate-pulse">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Saved
            </span>
          )
        }
      >
        <h3 className="text-sm font-medium text-white">Riley Assistance Level</h3>
        <p className="text-xs text-slate-400">{assistanceSettings.label} - {assistanceSettings.description}</p>
      </EACardHeader>
      <EACardContent>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onLevelChange(3)}
            disabled={isRecording || !assistanceLevelLoaded}
            className={`p-4 rounded-lg border-2 transition-all ${
              assistanceLevel <= 4
                ? 'bg-slate-700/50 border-slate-500 ring-2 ring-slate-500/50'
                : 'bg-slate-800 border-slate-700 hover:border-slate-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-center">
              <svg className="w-6 h-6 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <div className="font-semibold text-white text-sm">Concise</div>
              <div className="text-xs text-slate-400 mt-1">Codes only</div>
            </div>
          </button>

          <button
            onClick={() => onLevelChange(5)}
            disabled={isRecording || !assistanceLevelLoaded}
            className={`p-4 rounded-lg border-2 transition-all ${
              assistanceLevel >= 5 && assistanceLevel <= 7
                ? 'bg-[#00857a]/20 border-[#00857a] ring-2 ring-[#00857a]/50'
                : 'bg-slate-800 border-slate-700 hover:border-[#00857a]/50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-center">
              <svg className="w-6 h-6 mx-auto mb-2 text-[#33bfb7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              <div className="font-semibold text-white text-sm">Balanced</div>
              <div className="text-xs text-slate-400 mt-1">With suggestions</div>
            </div>
          </button>

          <button
            onClick={() => onLevelChange(8)}
            disabled={isRecording || !assistanceLevelLoaded}
            className={`p-4 rounded-lg border-2 transition-all ${
              assistanceLevel >= 8
                ? 'bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/50'
                : 'bg-slate-800 border-slate-700 hover:border-blue-500/50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-center">
              <svg className="w-6 h-6 mx-auto mb-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <div className="font-semibold text-white text-sm">Detailed</div>
              <div className="text-xs text-slate-400 mt-1">Full coaching</div>
            </div>
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500 text-center">
          Assistance level affects coaching only. Billing code accuracy remains unchanged.
        </p>
      </EACardContent>
    </EACard>
  );
});

AssistanceLevelControl.displayName = 'AssistanceLevelControl';

export default AssistanceLevelControl;
