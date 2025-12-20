/**
 * Guardian Error Boundary - Integrates React Error Boundaries with Guardian Agent
 * Automatically reports React errors to the agent for healing
 *
 * IMPORTANT: This component is designed to "fail quiet" to prevent error cascades.
 * - Throttles error reporting to once per page load
 * - Skips API calls when unauthenticated
 * - Limits recovery attempts to prevent infinite loops
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logGuardianAuditEvent } from '../services/guardianAgentClient';
import { supabase } from '../lib/supabaseClient';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isHealing: boolean;
  healingAttempts: number;
}

// Module-level throttle to prevent spam across all boundary instances
let lastReportedAt = 0;
const REPORT_THROTTLE_MS = 60000; // 1 minute throttle between reports
let hasReportedThisSession = false;

/**
 * Error Boundary with Guardian Agent integration
 * Automatically attempts to heal errors and recover gracefully
 */
export class GuardianErrorBoundary extends Component<Props, State> {

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isHealing: false,
      healingAttempts: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {

    this.setState({
      errorInfo,
      isHealing: true
    });

    // Report to Guardian Agent for autonomous healing
    this.reportAndHeal(error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private async reportAndHeal(error: Error, errorInfo: ErrorInfo): Promise<void> {
    try {
      // THROTTLE: Only report once per session or once per minute
      const now = Date.now();
      const shouldReport = !hasReportedThisSession || (now - lastReportedAt > REPORT_THROTTLE_MS);

      if (shouldReport) {
        // CHECK AUTH: Only report if user is authenticated to prevent 401 spam
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          // Report to Guardian Agent via Edge Function
          // Non-blocking: don't await, don't let failures affect recovery
          logGuardianAuditEvent({
            event_type: 'REACT_ERROR',
            severity: 'HIGH',
            description: `${error.message} in ${errorInfo.componentStack?.split('\n')[1]?.trim()}`,
            requires_investigation: true
          }).catch(() => {
            // Silently ignore reporting failures - don't cascade errors
          });

          lastReportedAt = now;
          hasReportedThisSession = true;
        }
      }

      // Attempt automatic recovery (limited by healingAttempts)
      await this.attemptRecovery();
    } catch (healingError) {
      // Fail quiet - don't let healing errors cascade
      this.setState({ isHealing: false });
    }
  }

  private async attemptRecovery(): Promise<void> {
    const { healingAttempts } = this.state;

    // REDUCED: Only attempt recovery once to prevent loops
    // If first recovery fails, show error UI and let user decide
    if (healingAttempts >= 1) {
      this.setState({ isHealing: false });
      return;
    }

    // Longer initial delay to let async operations settle
    const delay = 3000; // 3 seconds before first recovery attempt
    await new Promise(resolve => setTimeout(resolve, delay));

    // Attempt to reset state and recover
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      isHealing: false,
      healingAttempts: prevState.healingAttempts + 1
    }));
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isHealing: false,
      healingAttempts: 0
    });
  };

  render(): ReactNode {
    const { hasError, error, isHealing } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Show healing status - generic messaging (no Guardian references for end users)
      if (isHealing) {
        return (
          <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md text-center">
              <div className="text-6xl mb-4 animate-pulse">🔄</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Recovering...
              </h2>
              <p className="text-gray-600 mb-4">
                Please wait while we fix this issue.
              </p>
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="text-sm text-gray-500">
                  This should only take a moment
                </span>
              </div>
            </div>
          </div>
        );
      }

      // Show error with recovery option - generic messaging (no Guardian references)
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl">
            <div className="flex items-start space-x-4">
              <div className="text-5xl">⚠️</div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Something went wrong
                </h2>
                <p className="text-gray-600 mb-4">
                  We attempted to recover automatically but were unable to. Please try again or reload the page.
                </p>

                <details className="mb-4">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Show error details
                  </summary>
                  <div className="mt-2 p-4 bg-gray-50 rounded border border-gray-200">
                    <p className="text-sm font-mono text-red-600 mb-2">
                      {error.toString()}
                    </p>
                    {error.stack && (
                      <pre className="text-xs text-gray-600 overflow-auto max-h-40">
                        {error.stack}
                      </pre>
                    )}
                  </div>
                </details>

                <div className="flex space-x-4">
                  <button
                    onClick={this.handleReset}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default GuardianErrorBoundary;
