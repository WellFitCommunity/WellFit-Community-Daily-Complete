/**
 * Scribe Header Component
 *
 * Header section for SmartScribe (nurses) or Compass Riley (physicians).
 * Split from RealTimeSmartScribe for better performance.
 *
 * SmartScribe: Simpler branding, no billing indicators
 * Compass Riley: Full branding with billing code counts
 */

import React from 'react';
import { EACard, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';
import type { ScribeMode } from './RealTimeSmartScribe';

interface ScribeHeaderProps {
  isDemoMode: boolean;
  isRecording: boolean;
  status: string;
  elapsedSeconds: number;
  suggestedCodesCount: number;
  onEnableDemo: () => void;
  onDisableDemo: () => void;
  mode?: ScribeMode;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ScribeHeader: React.FC<ScribeHeaderProps> = React.memo(({
  isDemoMode,
  isRecording,
  status,
  elapsedSeconds,
  suggestedCodesCount,
  onEnableDemo,
  onDisableDemo,
  mode = 'compass-riley',
}) => {
  const isSmartScribe = mode === 'smartscribe';

  return (
    <EACard variant="elevated">
      <EACardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isSmartScribe
                ? 'bg-linear-to-br from-blue-500 to-blue-600'
                : 'bg-linear-to-br from-[#00857a] to-[#006d64]'
            }`}>
              {isSmartScribe ? (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                {isSmartScribe ? 'SmartScribe' : 'Compass Riley'}
                {isDemoMode && (
                  <EABadge variant="elevated" size="sm">DEMO</EABadge>
                )}
                {isRecording && (
                  <EABadge variant="critical" pulse size="sm">LIVE</EABadge>
                )}
              </h2>
              <p className="text-sm text-slate-400">
                {isSmartScribe ? 'Voice-to-text for nursing documentation' : status}
              </p>
            </div>
          </div>

          {/* Timer & CCM Indicator (CCM only for Compass Riley) */}
          {isRecording && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-mono font-bold text-white">{formatTime(elapsedSeconds)}</div>
                <div className="text-xs text-slate-400">Duration</div>
              </div>
              {!isSmartScribe && elapsedSeconds >= 1200 && (
                <EABadge variant="normal" size="lg">
                  CCM Eligible
                </EABadge>
              )}
            </div>
          )}

          {/* Documentation Quality - Only for Compass Riley (physicians) */}
          {!isSmartScribe && suggestedCodesCount > 0 && !isRecording && (
            <div className="flex items-center gap-2">
              <EABadge variant="info" size="lg">
                {suggestedCodesCount} codes captured
              </EABadge>
            </div>
          )}

          {/* Demo Toggle Button */}
          <div className="flex items-center gap-2">
            {isDemoMode ? (
              <EAButton
                variant="secondary"
                size="sm"
                onClick={onDisableDemo}
                disabled={isRecording}
              >
                Exit Demo
              </EAButton>
            ) : (
              <EAButton
                variant="ghost"
                size="sm"
                onClick={onEnableDemo}
                disabled={isRecording}
                title="Enter Demo Mode - simulates a patient visit"
              >
                Demo Mode
              </EAButton>
            )}
          </div>
        </div>
      </EACardContent>
    </EACard>
  );
});

ScribeHeader.displayName = 'ScribeHeader';

export default ScribeHeader;
