// src/components/ErrorBoundary.tsx
// Consolidated ErrorBoundary with all features:
// - Performance monitoring integration
// - Auto-reset on route changes
// - Custom fallback rendering
// - HOC wrapper for easy component wrapping
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { performanceMonitor } from '../services/performanceMonitoring';

type FallbackRender = (args: {
  error: Error;
  reset: () => void;
}) => React.ReactNode;

interface Props {
  children: ReactNode;
  /** When any key changes, the boundary resets (e.g., route, user id) */
  resetKeys?: unknown[];
  /** Optional custom fallback renderer */
  fallbackRender?: FallbackRender;
  /** Optional pre-built fallback component */
  fallback?: ReactNode;
  /** Optional error hook (e.g., Sentry, Supabase logs) */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class InnerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to performance monitoring system
    performanceMonitor.logError({
      error_message: error.message,
      error_stack: error.stack,
      error_type: 'react_error_boundary',
      component_name: errorInfo.componentStack?.split('\n')[1]?.trim() || 'Unknown',
      page_url: window.location.href,
      severity: 'critical'
    });

    // Optional external error handler
    this.props.onError?.(error, errorInfo);
  }

  public componentDidUpdate(prevProps: Props) {
    // Auto-reset when resetKeys change
    if (!areArraysEqual(prevProps.resetKeys, this.props.resetKeys)) {
      // reset only if currently showing fallback
      if (this.state.hasError) this.reset();
    }
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    const { hasError, error } = this.state;
    const { children, fallbackRender, fallback } = this.props;

    if (!hasError || !error) return children;

    // Custom fallback renderer takes priority
    if (fallbackRender) return fallbackRender({ error, reset: this.reset });

    // Pre-built fallback component
    if (fallback) return fallback;

    // Default fallback UI
    const isDev = process.env.NODE_ENV !== 'production';

    return (
      <div
        style={{
          backgroundColor: '#003865',
          color: '#fff',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
        role="alert"
        aria-live="polite"
      >
        <h2 style={{ margin: 0 }}>🚨 A critical error occurred in the app.</h2>
        <p style={{ opacity: 0.9 }}>{error.message}</p>
        <p>Check the browser console for technical details.</p>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={this.reset} style={btnStyle}>Try Again</button>
          <button onClick={() => window.location.reload()} style={btnStyle}>Reload</button>
          <a href="#/login" style={{ ...btnStyle, textDecoration: 'none' }}>Go to Login</a>
          <a href="#/" style={{ ...btnStyle, textDecoration: 'none' }}>Home</a>
        </div>

        {isDev && (
          <details style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: 8 }}>
            <summary>Developer details</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>
{String(error.stack || error.message)}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(String(error.stack || error.message))}
              style={btnStyle}
            >
              Copy details
            </button>
          </details>
        )}
      </div>
    );
  }
}

const btnStyle: React.CSSProperties = {
  background: '#ffffff',
  color: '#003865',
  border: 'none',
  padding: '0.5rem 0.75rem',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
};

function areArraysEqual(a?: unknown[], b?: unknown[]) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Wrapper to inject useful resetKeys like the current route */
export default function ErrorBoundary(props: Omit<Props, 'resetKeys'> & { resetKeys?: unknown[] }) {
  const location = useLocation();
  // navigate is available for future custom fallback use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate();

  const routeKey = location.pathname + location.search;
  const combinedKeys = React.useMemo(
    () => [routeKey, ...(props.resetKeys ?? [])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routeKey, JSON.stringify(props.resetKeys ?? [])]
  );

  return <InnerErrorBoundary {...props} resetKeys={combinedKeys} />;
}

// Named export for class-based usage
export { InnerErrorBoundary as ErrorBoundary };

// Higher-Order Component for easy wrapping
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <InnerErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </InnerErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};
