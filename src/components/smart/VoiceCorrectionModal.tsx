/**
 * Voice Correction Modal Component
 *
 * Modal for teaching Riley voice corrections.
 * Split from RealTimeSmartScribe for better performance.
 */

import React from 'react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';

interface VoiceProfile {
  corrections: Array<{ heard: string; correct: string }>;
  totalSessions: number;
  accuracyCurrent: number;
  accuracyBaseline: number;
}

interface VoiceCorrectionModalProps {
  isOpen: boolean;
  correctionHeard: string;
  correctionCorrect: string;
  voiceProfile: VoiceProfile | null;
  onHeardChange: (value: string) => void;
  onCorrectChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const VoiceCorrectionModal: React.FC<VoiceCorrectionModalProps> = React.memo(({
  isOpen,
  correctionHeard,
  correctionCorrect,
  voiceProfile,
  onHeardChange,
  onCorrectChange,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <EACard className="max-w-md w-full mx-4">
        <EACardHeader
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        >
          <h3 className="text-sm font-medium text-white">Teach Voice Correction</h3>
          <p className="text-xs text-slate-400">Help Riley learn your voice patterns</p>
        </EACardHeader>
        <EACardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                What did the AI hear? (incorrect)
              </label>
              <input
                type="text"
                value={correctionHeard}
                onChange={(e) => onHeardChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
                placeholder="e.g., hyper blue semen"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                What did you actually say? (correct)
              </label>
              <input
                type="text"
                value={correctionCorrect}
                onChange={(e) => onCorrectChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
                placeholder="e.g., hyperglycemia"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <EAButton
                variant="primary"
                className="flex-1"
                onClick={onSave}
                disabled={!correctionHeard.trim() || !correctionCorrect.trim()}
              >
                Save Correction
              </EAButton>
              <EAButton
                variant="secondary"
                className="flex-1"
                onClick={onClose}
              >
                Cancel
              </EAButton>
            </div>

            {voiceProfile && voiceProfile.corrections.length > 0 && (
              <div className="pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-500">
                  {voiceProfile.corrections.length} correction{voiceProfile.corrections.length !== 1 ? 's' : ''} learned
                  {voiceProfile.totalSessions > 0 && (
                    <> • Accuracy improved by {Math.round((voiceProfile.accuracyCurrent - voiceProfile.accuracyBaseline) * 100) / 100}%</>
                  )}
                </p>
              </div>
            )}
          </div>
        </EACardContent>
      </EACard>
    </div>
  );
});

VoiceCorrectionModal.displayName = 'VoiceCorrectionModal';

export default VoiceCorrectionModal;
