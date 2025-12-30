/**
 * Proactive Correction Component
 *
 * Provides the "Did I understand you to say XYZ?" pattern for intuitive learning.
 * Appears inline when the system detects something that might need confirmation.
 * Non-blocking, auto-dismisses, and feeds corrections back into the learning loop.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { EAButton } from '../envision-atlus/EAButton';

export interface PendingConfirmation {
  id: string;
  heardText: string;
  timestamp: Date;
  confidence: number;
  context?: string; // surrounding words for context
}

interface ProactiveCorrectionProps {
  /** The pending confirmation to display */
  confirmation: PendingConfirmation;
  /** Called when user confirms the transcription is correct */
  onConfirm: (id: string) => void;
  /** Called when user provides a correction */
  onCorrect: (id: string, heardText: string, correctText: string) => void;
  /** Called when the confirmation is dismissed (timeout or manual) */
  onDismiss: (id: string) => void;
  /** Auto-dismiss timeout in ms (default: 15000) */
  autoDismissMs?: number;
}

export const ProactiveCorrection: React.FC<ProactiveCorrectionProps> = React.memo(({
  confirmation,
  onConfirm,
  onCorrect,
  onDismiss,
  autoDismissMs = 15000,
}) => {
  const [showCorrectionInput, setShowCorrectionInput] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-dismiss timer
  useEffect(() => {
    if (autoDismissMs <= 0) return;

    const timer = setTimeout(() => {
      onDismiss(confirmation.id);
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [confirmation.id, autoDismissMs, onDismiss]);

  const handleYes = useCallback(() => {
    onConfirm(confirmation.id);
  }, [confirmation.id, onConfirm]);

  const handleNo = useCallback(() => {
    setShowCorrectionInput(true);
    setCorrectionText(confirmation.heardText); // Pre-populate with what was heard
  }, [confirmation.heardText]);

  const handleSubmitCorrection = useCallback(async () => {
    if (!correctionText.trim() || correctionText.trim() === confirmation.heardText) {
      // If they didn't change anything, treat as dismiss
      onDismiss(confirmation.id);
      return;
    }

    setIsSubmitting(true);
    try {
      await onCorrect(confirmation.id, confirmation.heardText, correctionText.trim());
    } finally {
      setIsSubmitting(false);
    }
  }, [confirmation.id, confirmation.heardText, correctionText, onCorrect, onDismiss]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitCorrection();
    } else if (e.key === 'Escape') {
      onDismiss(confirmation.id);
    }
  }, [confirmation.id, handleSubmitCorrection, onDismiss]);

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-600 rounded-lg p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {!showCorrectionInput ? (
        // Initial confirmation prompt
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#00857a] flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">R</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300">
                Did I hear correctly?
              </p>
              <p className="text-sm font-medium text-white mt-1 break-words">
                "{confirmation.heardText}"
              </p>
              {confirmation.context && (
                <p className="text-xs text-slate-500 mt-1">
                  ...{confirmation.context}...
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-8">
            <EAButton
              variant="primary"
              size="sm"
              onClick={handleYes}
              className="px-4"
            >
              Yes
            </EAButton>
            <EAButton
              variant="secondary"
              size="sm"
              onClick={handleNo}
              className="px-4"
            >
              No, let me correct
            </EAButton>
            <button
              onClick={() => onDismiss(confirmation.id)}
              className="ml-auto text-slate-500 hover:text-slate-400 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        // Correction input mode
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-[#00857a] flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">R</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300">
                What did you actually say?
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                I heard: <span className="line-through text-red-400">{confirmation.heardText}</span>
              </p>
            </div>
          </div>

          <div className="ml-8 space-y-2">
            <input
              type="text"
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00857a] focus:border-transparent text-sm"
              placeholder="Type the correct word or phrase..."
              autoFocus
              disabled={isSubmitting}
            />

            <div className="flex items-center gap-2">
              <EAButton
                variant="primary"
                size="sm"
                onClick={handleSubmitCorrection}
                disabled={isSubmitting || !correctionText.trim()}
                className="px-4"
              >
                {isSubmitting ? 'Learning...' : 'Teach Riley'}
              </EAButton>
              <EAButton
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(confirmation.id)}
                disabled={isSubmitting}
              >
                Cancel
              </EAButton>
            </div>

            <p className="text-xs text-slate-500">
              Riley will remember this correction and apply it automatically in the future.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

ProactiveCorrection.displayName = 'ProactiveCorrection';

/**
 * Container component for managing multiple pending confirmations
 */
interface ProactiveCorrectionListProps {
  confirmations: PendingConfirmation[];
  onConfirm: (id: string) => void;
  onCorrect: (id: string, heardText: string, correctText: string) => void;
  onDismiss: (id: string) => void;
  maxVisible?: number;
}

export const ProactiveCorrectionList: React.FC<ProactiveCorrectionListProps> = ({
  confirmations,
  onConfirm,
  onCorrect,
  onDismiss,
  maxVisible = 2,
}) => {
  // Only show the most recent confirmations to avoid overwhelming the user
  const visibleConfirmations = confirmations.slice(-maxVisible);

  if (visibleConfirmations.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleConfirmations.map((confirmation) => (
        <ProactiveCorrection
          key={confirmation.id}
          confirmation={confirmation}
          onConfirm={onConfirm}
          onCorrect={onCorrect}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

export default ProactiveCorrection;
