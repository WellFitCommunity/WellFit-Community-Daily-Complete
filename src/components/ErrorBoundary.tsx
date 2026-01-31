import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { performanceMonitor } from '../services/performanceMonitoring';
import { generateErrorCorrelationId, getSessionId } from '../lib/correlationId';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  correlationId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, correlationId: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Generate correlation ID when error occurs for tracing
    const correlationId = generateErrorCorrelationId();
    return { hasError: true, error, correlationId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { correlationId } = this.state;

    // Log to performance monitoring system with correlation context
    performanceMonitor.logError({
      error_message: error.message,
      error_stack: error.stack,
      error_type: 'react_error_boundary',
      component_name: errorInfo.componentStack?.split('\n')[1]?.trim() || 'Unknown',
      page_url: window.location.href,
      severity: 'critical',
      correlation_id: correlationId || undefined,
      session_id: getSessionId(),
    });

    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Alert variant="destructive" className="m-4">
          <AlertDescription>
            <div className="space-y-3">
              <div>
                <strong>Something went wrong</strong>
                <p className="text-sm text-gray-600 mt-1">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
                {this.state.correlationId && (
                  <p className="text-xs text-gray-500 mt-2 font-mono">
                    Error ID: {this.state.correlationId}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={this.handleRetry}
                >
                  Try Again
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};