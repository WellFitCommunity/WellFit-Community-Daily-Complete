/**
 * Live Transcript Component
 *
 * Displays real-time transcript with correction capabilities.
 * Split from RealTimeSmartScribe for better performance.
 */

import React from 'react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';

interface LiveTranscriptProps {
  transcript: string;
  isRecording: boolean;
  correctionsAppliedCount: number;
  onOpenCorrectionModal: () => void;
}

export const LiveTranscript: React.FC<LiveTranscriptProps> = React.memo(({
  transcript,
  isRecording,
  correctionsAppliedCount,
  onOpenCorrectionModal,
}) => {
  if (!transcript && !isRecording) return null;

  return (
    <EACard>
      <EACardHeader
        icon={
          <svg className={`w-5 h-5 ${isRecording ? 'text-red-400 animate-pulse' : 'text-[#33bfb7]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        action={
          <div className="flex items-center gap-3">
            {correctionsAppliedCount > 0 && (
              <EABadge variant="normal" size="sm">{correctionsAppliedCount} corrections</EABadge>
            )}
            {transcript && (
              <span className="text-xs text-slate-400">{transcript.split(' ').length} words</span>
            )}
            <EAButton
              variant="ghost"
              size="sm"
              onClick={onOpenCorrectionModal}
            >
              Teach Correction
            </EAButton>
          </div>
        }
      >
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          Live Transcript
          {isRecording && <EABadge variant="critical" pulse size="sm">CAPTURING</EABadge>}
        </h3>
      </EACardHeader>
      <EACardContent>
        {transcript ? (
          <p className="text-slate-200 leading-relaxed">{transcript}</p>
        ) : (
          <div className="flex items-center justify-center gap-3 py-6 text-slate-400">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-[#00857a] rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
              <span className="w-2 h-2 bg-[#00857a] rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
              <span className="w-2 h-2 bg-[#00857a] rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
            </div>
            <span className="text-sm">Listening for speech...</span>
          </div>
        )}
      </EACardContent>
    </EACard>
  );
});

LiveTranscript.displayName = 'LiveTranscript';

export default LiveTranscript;
