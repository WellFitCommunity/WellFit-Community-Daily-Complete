/**
 * SessionFeedback - Thumbs up/down feedback after transcription session
 *
 * Purpose: Quick feedback on transcription quality to track DeepGram accuracy
 *          and identify users who may need voice training
 * Used by: RealTimeSmartScribe
 */

import React, { useState } from 'react';
import { EACard, EACardContent } from '../envision-atlus/EACard';

export type FeedbackRating = 'positive' | 'negative' | null;

export type FeedbackIssue =
  | 'missed_words'
  | 'wrong_medical_terms'
  | 'accent_issues'
  | 'background_noise'
  | 'other';

export interface SessionFeedbackData {
  rating: FeedbackRating;
  issues?: FeedbackIssue[];
  comment?: string;
}

interface SessionFeedbackProps {
  isVisible: boolean;
  onSubmit: (feedback: SessionFeedbackData) => void;
  onSkip: () => void;
}

export const SessionFeedback: React.FC<SessionFeedbackProps> = React.memo(({
  isVisible,
  onSubmit,
  onSkip,
}) => {
  const [rating, setRating] = useState<FeedbackRating>(null);
  const [selectedIssues, setSelectedIssues] = useState<FeedbackIssue[]>([]);
  const [showIssueSelector, setShowIssueSelector] = useState(false);

  if (!isVisible) return null;

  const handlePositive = () => {
    setRating('positive');
    onSubmit({ rating: 'positive' });
  };

  const handleNegative = () => {
    setRating('negative');
    setShowIssueSelector(true);
  };

  const toggleIssue = (issue: FeedbackIssue) => {
    setSelectedIssues(prev =>
      prev.includes(issue)
        ? prev.filter(i => i !== issue)
        : [...prev, issue]
    );
  };

  const handleSubmitWithIssues = () => {
    onSubmit({
      rating: 'negative',
      issues: selectedIssues.length > 0 ? selectedIssues : undefined,
    });
  };

  const issueOptions: { id: FeedbackIssue; label: string; icon: string }[] = [
    { id: 'missed_words', label: 'Missed words', icon: '🔇' },
    { id: 'wrong_medical_terms', label: 'Wrong medical terms', icon: '💊' },
    { id: 'accent_issues', label: 'Accent not recognized', icon: '🗣️' },
    { id: 'background_noise', label: 'Background noise issues', icon: '🔊' },
  ];

  // Initial feedback prompt
  if (!showIssueSelector) {
    return (
      <EACard className="border-slate-600">
        <EACardContent className="py-4">
          <div className="text-center space-y-4">
            <p className="text-sm text-slate-300 font-medium">
              How was the transcription quality?
            </p>

            <div className="flex items-center justify-center gap-6">
              {/* Thumbs Up */}
              <button
                type="button"
                onClick={handlePositive}
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-xl transition-all
                  min-h-[80px] min-w-[80px]
                  ${rating === 'positive'
                    ? 'bg-green-600 text-white scale-105'
                    : 'bg-slate-700 text-slate-300 hover:bg-green-600/20 hover:text-green-400'
                  }
                `}
                aria-label="Good transcription quality"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                <span className="text-sm font-medium">Good!</span>
              </button>

              {/* Thumbs Down */}
              <button
                type="button"
                onClick={handleNegative}
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-xl transition-all
                  min-h-[80px] min-w-[80px]
                  ${rating === 'negative'
                    ? 'bg-red-600 text-white scale-105'
                    : 'bg-slate-700 text-slate-300 hover:bg-red-600/20 hover:text-red-400'
                  }
                `}
                aria-label="Poor transcription quality"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                </svg>
                <span className="text-sm font-medium">Needs work</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              Skip feedback
            </button>
          </div>
        </EACardContent>
      </EACard>
    );
  }

  // Issue selection (shown after negative feedback)
  return (
    <EACard className="border-slate-600">
      <EACardContent className="py-4">
        <div className="space-y-4">
          <p className="text-sm text-slate-300 font-medium text-center">
            What was the issue? <span className="text-slate-500">(optional)</span>
          </p>

          <div className="grid grid-cols-2 gap-2">
            {issueOptions.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleIssue(option.id)}
                className={`
                  flex items-center gap-2 p-3 rounded-lg text-sm transition-all
                  min-h-[44px]
                  ${selectedIssues.includes(option.id)
                    ? 'bg-red-600/20 text-red-300 border border-red-500'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent'
                  }
                `}
              >
                <span>{option.icon}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSubmitWithIssues}
              className="px-4 py-2 bg-[#00857a] text-white rounded-lg text-sm font-medium hover:bg-[#006d64] transition-colors min-h-[44px]"
            >
              Submit Feedback
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors min-h-[44px]"
            >
              Skip
            </button>
          </div>
        </div>
      </EACardContent>
    </EACard>
  );
});

SessionFeedback.displayName = 'SessionFeedback';

export default SessionFeedback;
