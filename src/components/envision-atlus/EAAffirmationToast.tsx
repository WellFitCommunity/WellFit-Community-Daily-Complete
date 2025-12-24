/**
 * EAAffirmationToast
 *
 * ATLUS Enhancement: Service - Positive feedback for healthcare workers
 *
 * A toast notification component that displays provider affirmations
 * after completing actions. Designed to boost morale and acknowledge
 * the hard work of healthcare professionals.
 *
 * Usage:
 * ```tsx
 * const [toast, setToast] = useState<AffirmationToastState | null>(null);
 *
 * // Show affirmation after action
 * const handleComplete = () => {
 *   doSomething();
 *   setToast(createAffirmationToast('task_completed'));
 *   setTimeout(() => setToast(null), 4000);
 * };
 *
 * return (
 *   <>
 *     {toast && <EAAffirmationToast {...toast} onDismiss={() => setToast(null)} />}
 *   </>
 * );
 * ```
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, Info, Award, X } from 'lucide-react';

export interface EAAffirmationToastProps {
  /** The affirmation message to display */
  message: string;
  /** Type determines icon and color */
  type?: 'success' | 'info' | 'achievement';
  /** Called when toast is dismissed */
  onDismiss?: () => void;
  /** Auto-dismiss after ms (0 = never) */
  autoDismiss?: number;
  /** Position on screen */
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
  /** Custom class name */
  className?: string;
}

const POSITION_CLASSES: Record<string, string> = {
  'top-right': 'top-4 right-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-teal-500/20',
    border: 'border-teal-500',
    icon: <CheckCircle className="w-5 h-5 text-teal-400" />,
  },
  info: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500',
    icon: <Info className="w-5 h-5 text-blue-400" />,
  },
  achievement: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500',
    icon: <Award className="w-5 h-5 text-amber-400" />,
  },
};

export const EAAffirmationToast: React.FC<EAAffirmationToastProps> = ({
  message,
  type = 'success',
  onDismiss,
  autoDismiss = 4000,
  position = 'bottom-right',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss?.();
    }, 300); // Match exit animation duration
  }, [onDismiss]);

  useEffect(() => {
    // Animate in
    const showTimeout = setTimeout(() => setIsVisible(true), 50);

    // Auto dismiss
    let dismissTimeout: NodeJS.Timeout | undefined;
    if (autoDismiss > 0) {
      dismissTimeout = setTimeout(() => {
        handleDismiss();
      }, autoDismiss);
    }

    return () => {
      clearTimeout(showTimeout);
      if (dismissTimeout) clearTimeout(dismissTimeout);
    };
  }, [autoDismiss, handleDismiss]);

  const styles = TYPE_STYLES[type] || TYPE_STYLES.success;
  const positionClass = POSITION_CLASSES[position] || POSITION_CLASSES['bottom-right'];

  return (
    <div
      className={`
        fixed ${positionClass} z-50
        max-w-sm w-full
        transform transition-all duration-300 ease-out
        ${isVisible && !isExiting ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
        ${className}
      `}
      role="alert"
      aria-live="polite"
    >
      <div
        className={`
          ${styles.bg} ${styles.border}
          border rounded-lg shadow-lg
          p-4
          flex items-start gap-3
        `}
      >
        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          {styles.icon}
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium leading-relaxed">
            {message}
          </p>
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="shrink-0 text-slate-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Hook for managing affirmation toasts
 * Returns state and handlers for showing/hiding toasts
 */
export const useAffirmationToast = () => {
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'achievement';
  } | null>(null);

  const showAffirmation = (
    message: string,
    type: 'success' | 'info' | 'achievement' = 'success'
  ) => {
    setToast({ message, type });
  };

  const hideAffirmation = () => {
    setToast(null);
  };

  return {
    toast,
    showAffirmation,
    hideAffirmation,
    AffirmationToast: toast ? (
      <EAAffirmationToast
        message={toast.message}
        type={toast.type}
        onDismiss={hideAffirmation}
      />
    ) : null,
  };
};

export default EAAffirmationToast;
