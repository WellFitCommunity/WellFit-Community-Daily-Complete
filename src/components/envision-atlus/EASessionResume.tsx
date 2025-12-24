/**
 * EASessionResume - Session Resume Prompt
 *
 * ATLUS Enhancement: Unity - Prompts users to resume where they left off
 *
 * This component shows a non-intrusive toast when a user logs in and has
 * a previous session they can resume. It gives them the option to continue
 * where they left off or start fresh.
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { useNavigationHistory } from '../../contexts/NavigationHistoryContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  RotateCcw,
  X,
  ArrowRight,
} from 'lucide-react';

interface EASessionResumeProps {
  /** Auto-dismiss after this many milliseconds (0 = never) */
  autoDismissMs?: number;
  /** Additional class names */
  className?: string;
  /** Callback when session is resumed */
  onResume?: () => void;
  /** Callback when dismissed */
  onDismiss?: () => void;
}

// localStorage key for tracking dismissal
const DISMISS_STORAGE_KEY = 'wf_session_resume_dismissed';

// Routes that are "dashboard" routes - don't prompt to resume these
const DASHBOARD_ROUTES = [
  '/dashboard',
  '/admin',
  '/super-admin',
  '/nurse-dashboard',
  '/physician-dashboard',
  '/caregiver-dashboard',
];

// Helper to format route name for display
const formatRouteName = (route: string): string => {
  // Remove leading slash and split by slashes or dashes
  const parts = route.replace(/^\//, '').split(/[/-]/);

  // Capitalize and join with spaces
  return parts
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const EASessionResume: React.FC<EASessionResumeProps> = ({
  autoDismissMs = 10000, // Default 10 seconds
  className,
  onResume,
  onDismiss,
}) => {
  const { canResumeSession, getLastRoute, resumeSession, clearHistory } = useNavigationHistory();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [lastRoute, setLastRoute] = useState<string | null>(null);

  // Check if we should show the resume prompt
  useEffect(() => {
    // Only show for authenticated users
    if (!user) {
      setIsVisible(false);
      return;
    }

    // Check if already dismissed this session
    try {
      const dismissedAt = sessionStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissedAt) {
        // Already dismissed this session
        return;
      }
    } catch {
      // Ignore storage errors
    }

    // Check if we can resume
    if (!canResumeSession) {
      return;
    }

    const route = getLastRoute();
    if (!route) {
      return;
    }

    // Don't prompt for dashboard routes - user is already "home"
    if (DASHBOARD_ROUTES.some(dashRoute => route === dashRoute || route.startsWith(dashRoute + '/'))) {
      return;
    }

    // Check current location - if we're already at the last route, don't prompt
    if (window.location.pathname === route) {
      return;
    }

    setLastRoute(route);
    setIsVisible(true);
  }, [user, canResumeSession, getLastRoute]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);

    // Mark as dismissed for this session
    try {
      sessionStorage.setItem(DISMISS_STORAGE_KEY, new Date().toISOString());
    } catch {
      // Ignore storage errors
    }

    onDismiss?.();
  }, [onDismiss]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!isVisible || autoDismissMs === 0) {
      return;
    }

    const timer = setTimeout(() => {
      handleDismiss();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [isVisible, autoDismissMs, handleDismiss]);

  const handleResume = useCallback(() => {
    setIsVisible(false);
    resumeSession();
    onResume?.();
  }, [resumeSession, onResume]);

  const handleStartFresh = useCallback(() => {
    clearHistory();
    handleDismiss();
  }, [clearHistory, handleDismiss]);

  if (!isVisible || !lastRoute) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-right-5 duration-300',
        className
      )}
      role="dialog"
      aria-label="Resume previous session"
    >
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-teal-900/30 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-medium text-slate-100">Resume Session?</span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-sm hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <p className="text-sm text-slate-300 mb-3">
            You were last working on:
          </p>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg mb-3">
            <ArrowRight className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="text-sm text-slate-100 truncate">
              {formatRouteName(lastRoute)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Would you like to continue where you left off?
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/50 border-t border-slate-700">
          <button
            onClick={handleStartFresh}
            className="flex-1 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-sm transition-colors"
          >
            Start Fresh
          </button>
          <button
            onClick={handleResume}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-sm transition-colors"
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
};

export default EASessionResume;
