/**
 * AIFeedbackButton - One-Click AI Feedback Capture
 *
 * Purpose: Enables clinicians to provide quick feedback on AI predictions
 * to improve model accuracy over time (learning health system loop).
 *
 * Usage: Add to any AI-generated suggestion, prediction, or recommendation.
 *
 * Feedback Types:
 * - Helpful: AI suggestion was useful and acted upon
 * - Wrong: AI suggestion was incorrect or not applicable
 * - Unsafe: AI suggestion could lead to patient harm (escalates to review)
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { ThumbsUp, ThumbsDown, AlertTriangle, MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';
import { useUser } from '../../contexts/AuthContext';

// ============================================================================
// TYPES
// ============================================================================

export type FeedbackType = 'helpful' | 'wrong' | 'unsafe';

export interface AIFeedbackButtonProps {
  /** The prediction ID from ai_predictions table */
  predictionId: string;
  /** The skill that generated this prediction */
  skillName: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Layout variant */
  variant?: 'inline' | 'stacked' | 'minimal';
  /** Whether to show labels */
  showLabels?: boolean;
  /** Whether to allow adding notes */
  allowNotes?: boolean;
  /** Callback when feedback is submitted */
  onFeedbackSubmitted?: (feedback: FeedbackType, notes?: string) => void;
  /** Custom class name */
  className?: string;
  /** Disable the component */
  disabled?: boolean;
}

interface FeedbackState {
  submitted: boolean;
  feedbackType: FeedbackType | null;
  showNotesModal: boolean;
  notes: string;
  submitting: boolean;
  error: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const AIFeedbackButton: React.FC<AIFeedbackButtonProps> = ({
  predictionId,
  skillName,
  size = 'sm',
  variant = 'inline',
  showLabels = false,
  allowNotes = true,
  onFeedbackSubmitted,
  className,
  disabled = false,
}) => {
  const user = useUser();
  const [state, setState] = useState<FeedbackState>({
    submitted: false,
    feedbackType: null,
    showNotesModal: false,
    notes: '',
    submitting: false,
    error: null,
  });

  // --------------------------------------------------------------------------
  // SUBMIT FEEDBACK
  // --------------------------------------------------------------------------

  const submitFeedback = useCallback(async (
    feedbackType: FeedbackType,
    notes?: string
  ) => {
    setState(prev => ({ ...prev, submitting: true, error: null }));

    try {
      // Map feedback type to accuracy tracking
      const isAccurate = feedbackType === 'helpful';
      const outcomeSource = feedbackType === 'unsafe' ? 'provider_review' : 'provider_review';

      // Record feedback via RPC
      const { error: rpcError } = await supabase.rpc('record_prediction_feedback', {
        p_prediction_id: predictionId,
        p_feedback_type: feedbackType,
        p_is_accurate: isAccurate,
        p_outcome_source: outcomeSource,
        p_notes: notes || null,
        p_user_id: user?.id || null,
      });

      // If RPC doesn't exist, fall back to direct update
      if (rpcError && rpcError.code === 'PGRST202') {
        // Function doesn't exist, use direct update
        const { error: updateError } = await supabase
          .from('ai_predictions')
          .update({
            actual_outcome: {
              feedback_type: feedbackType,
              provider_feedback: notes,
              feedback_timestamp: new Date().toISOString(),
            },
            outcome_recorded_at: new Date().toISOString(),
            outcome_source: 'provider_review',
            is_accurate: isAccurate,
            accuracy_notes: notes,
          })
          .eq('id', predictionId);

        if (updateError) {
          throw updateError;
        }
      } else if (rpcError) {
        throw rpcError;
      }

      // If unsafe, also create an alert for review
      if (feedbackType === 'unsafe') {
        await supabase.from('guardian_alerts').insert({
          severity: 'critical',
          category: 'ai_safety_concern',
          title: `AI Safety Concern: ${skillName}`,
          description: `A clinician flagged an AI prediction as potentially unsafe. Prediction ID: ${predictionId}. ${notes ? `Notes: ${notes}` : ''}`,
          status: 'pending',
          metadata: {
            prediction_id: predictionId,
            skill_name: skillName,
            reported_by: user?.id,
            feedback_notes: notes,
          },
        });

        auditLogger.warn('ai_unsafe_feedback_reported', {
          predictionId,
          skillName,
          userId: user?.id,
        });
      }

      // Log the feedback
      auditLogger.info('ai_feedback_submitted', {
        predictionId,
        skillName,
        feedbackType,
        hasNotes: !!notes,
      });

      // Update state
      setState(prev => ({
        ...prev,
        submitted: true,
        feedbackType,
        submitting: false,
        showNotesModal: false,
      }));

      // Callback
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(feedbackType, notes);
      }
    } catch (err: any) {
      auditLogger.error('ai_feedback_submit_failed', err instanceof Error ? err : new Error(err?.message || 'Unknown error'));

      setState(prev => ({
        ...prev,
        submitting: false,
        error: 'Failed to submit feedback. Please try again.',
      }));
    }
  }, [predictionId, skillName, user?.id, onFeedbackSubmitted]);

  // --------------------------------------------------------------------------
  // HANDLE BUTTON CLICKS
  // --------------------------------------------------------------------------

  const handleFeedbackClick = (feedbackType: FeedbackType) => {
    if (disabled || state.submitted || state.submitting) return;

    // For unsafe feedback, always show notes modal
    if (feedbackType === 'unsafe' && allowNotes) {
      setState(prev => ({
        ...prev,
        feedbackType,
        showNotesModal: true,
      }));
      return;
    }

    // For other feedback, submit directly (or show modal if notes allowed and wanted)
    if (allowNotes) {
      setState(prev => ({
        ...prev,
        feedbackType,
        showNotesModal: true,
      }));
    } else {
      submitFeedback(feedbackType);
    }
  };

  const handleSubmitWithNotes = () => {
    if (state.feedbackType) {
      submitFeedback(state.feedbackType, state.notes);
    }
  };

  const handleSkipNotes = () => {
    if (state.feedbackType) {
      submitFeedback(state.feedbackType);
    }
  };

  const handleCloseModal = () => {
    setState(prev => ({
      ...prev,
      showNotesModal: false,
      feedbackType: null,
      notes: '',
    }));
  };

  // --------------------------------------------------------------------------
  // SIZE CLASSES
  // --------------------------------------------------------------------------

  const sizeClasses = {
    sm: {
      button: 'p-1.5',
      icon: 'h-3.5 w-3.5',
      text: 'text-xs',
      gap: 'gap-1',
    },
    md: {
      button: 'p-2',
      icon: 'h-4 w-4',
      text: 'text-sm',
      gap: 'gap-1.5',
    },
    lg: {
      button: 'p-2.5',
      icon: 'h-5 w-5',
      text: 'text-base',
      gap: 'gap-2',
    },
  };

  const sizes = sizeClasses[size];

  // --------------------------------------------------------------------------
  // SUBMITTED STATE
  // --------------------------------------------------------------------------

  if (state.submitted) {
    const feedbackColors = {
      helpful: 'text-green-400 bg-green-900/30 border-green-700',
      wrong: 'text-amber-400 bg-amber-900/30 border-amber-700',
      unsafe: 'text-red-400 bg-red-900/30 border-red-700',
    };

    const feedbackLabels = {
      helpful: 'Marked helpful',
      wrong: 'Marked incorrect',
      unsafe: 'Flagged for review',
    };

    return (
      <div className={cn(
        'inline-flex items-center rounded-md border px-2 py-1',
        sizes.gap,
        sizes.text,
        state.feedbackType ? feedbackColors[state.feedbackType] : '',
        className
      )}>
        {state.feedbackType === 'helpful' && <ThumbsUp className={sizes.icon} />}
        {state.feedbackType === 'wrong' && <ThumbsDown className={sizes.icon} />}
        {state.feedbackType === 'unsafe' && <AlertTriangle className={sizes.icon} />}
        <span>{state.feedbackType ? feedbackLabels[state.feedbackType] : 'Feedback recorded'}</span>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // NOTES MODAL
  // --------------------------------------------------------------------------

  if (state.showNotesModal) {
    const modalTitle = {
      helpful: 'What made this helpful?',
      wrong: 'What was incorrect?',
      unsafe: 'Describe the safety concern',
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 max-w-md w-full mx-4 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-100">
              {state.feedbackType && modalTitle[state.feedbackType]}
            </h3>
            <button
              onClick={handleCloseModal}
              className="p-1 hover:bg-slate-700 rounded"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          <textarea
            value={state.notes}
            onChange={(e) => setState(prev => ({ ...prev, notes: e.target.value }))}
            placeholder={
              state.feedbackType === 'unsafe'
                ? 'Please describe what could have caused patient harm...'
                : 'Optional: Add details to help improve AI accuracy...'
            }
            className="w-full h-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            autoFocus
          />

          {state.error && (
            <p className="text-red-400 text-sm mt-2">{state.error}</p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSubmitWithNotes}
              disabled={state.submitting || (state.feedbackType === 'unsafe' && !state.notes)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                state.feedbackType === 'unsafe'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-teal-600 hover:bg-teal-700 text-white',
                (state.submitting || (state.feedbackType === 'unsafe' && !state.notes)) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {state.submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit
            </button>
            {state.feedbackType !== 'unsafe' && (
              <button
                onClick={handleSkipNotes}
                disabled={state.submitting}
                className="px-4 py-2 rounded-lg font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              >
                Skip
              </button>
            )}
          </div>

          {state.feedbackType === 'unsafe' && (
            <p className="text-xs text-slate-400 mt-3 text-center">
              Safety concerns require a description and will be reviewed by clinical leadership.
            </p>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MAIN RENDER
  // --------------------------------------------------------------------------

  const buttonBaseClasses = cn(
    'rounded-md border border-slate-600 hover:border-slate-500 transition-all',
    'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 focus:ring-offset-slate-900',
    disabled && 'opacity-50 cursor-not-allowed',
    sizes.button
  );

  // Minimal variant - just icons
  if (variant === 'minimal') {
    return (
      <div className={cn('inline-flex items-center', sizes.gap, className)}>
        <button
          onClick={() => handleFeedbackClick('helpful')}
          disabled={disabled}
          className={cn(buttonBaseClasses, 'hover:bg-green-900/30 hover:text-green-400')}
          title="Helpful"
        >
          <ThumbsUp className={sizes.icon} />
        </button>
        <button
          onClick={() => handleFeedbackClick('wrong')}
          disabled={disabled}
          className={cn(buttonBaseClasses, 'hover:bg-amber-900/30 hover:text-amber-400')}
          title="Incorrect"
        >
          <ThumbsDown className={sizes.icon} />
        </button>
        <button
          onClick={() => handleFeedbackClick('unsafe')}
          disabled={disabled}
          className={cn(buttonBaseClasses, 'hover:bg-red-900/30 hover:text-red-400')}
          title="Safety concern"
        >
          <AlertTriangle className={sizes.icon} />
        </button>
      </div>
    );
  }

  // Stacked variant - vertical layout
  if (variant === 'stacked') {
    return (
      <div className={cn('flex flex-col', sizes.gap, className)}>
        <button
          onClick={() => handleFeedbackClick('helpful')}
          disabled={disabled}
          className={cn(
            buttonBaseClasses,
            'flex items-center justify-center gap-2 bg-slate-800 hover:bg-green-900/30 hover:text-green-400'
          )}
        >
          <ThumbsUp className={sizes.icon} />
          {showLabels && <span className={sizes.text}>Helpful</span>}
        </button>
        <button
          onClick={() => handleFeedbackClick('wrong')}
          disabled={disabled}
          className={cn(
            buttonBaseClasses,
            'flex items-center justify-center gap-2 bg-slate-800 hover:bg-amber-900/30 hover:text-amber-400'
          )}
        >
          <ThumbsDown className={sizes.icon} />
          {showLabels && <span className={sizes.text}>Wrong</span>}
        </button>
        <button
          onClick={() => handleFeedbackClick('unsafe')}
          disabled={disabled}
          className={cn(
            buttonBaseClasses,
            'flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-900/30 hover:text-red-400'
          )}
        >
          <AlertTriangle className={sizes.icon} />
          {showLabels && <span className={sizes.text}>Unsafe</span>}
        </button>
      </div>
    );
  }

  // Inline variant (default) - horizontal layout
  return (
    <div className={cn(
      'inline-flex items-center bg-slate-800/50 rounded-lg border border-slate-700 p-1',
      sizes.gap,
      className
    )}>
      {showLabels && (
        <span className={cn('text-slate-400 px-2', sizes.text)}>
          <MessageSquare className={cn('inline mr-1', sizes.icon)} />
          Rate AI
        </span>
      )}
      <button
        onClick={() => handleFeedbackClick('helpful')}
        disabled={disabled}
        className={cn(
          buttonBaseClasses,
          'bg-slate-700 hover:bg-green-900/50 hover:text-green-400 hover:border-green-600'
        )}
        title="Helpful - AI suggestion was useful"
      >
        <ThumbsUp className={sizes.icon} />
      </button>
      <button
        onClick={() => handleFeedbackClick('wrong')}
        disabled={disabled}
        className={cn(
          buttonBaseClasses,
          'bg-slate-700 hover:bg-amber-900/50 hover:text-amber-400 hover:border-amber-600'
        )}
        title="Wrong - AI suggestion was incorrect"
      >
        <ThumbsDown className={sizes.icon} />
      </button>
      <button
        onClick={() => handleFeedbackClick('unsafe')}
        disabled={disabled}
        className={cn(
          buttonBaseClasses,
          'bg-slate-700 hover:bg-red-900/50 hover:text-red-400 hover:border-red-600'
        )}
        title="Unsafe - AI suggestion could cause harm"
      >
        <AlertTriangle className={sizes.icon} />
      </button>
    </div>
  );
};

export default AIFeedbackButton;
