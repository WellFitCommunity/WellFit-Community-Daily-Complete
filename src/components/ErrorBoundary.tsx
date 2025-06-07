// src/components/ErrorBoundary.tsx

import * as React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔥 ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            backgroundColor: '#003865',
            color: '#fff',
            padding: '2rem',
            fontFamily: 'Arial, sans-serif',
            minHeight: '100vh',
          }}
        >
          <h2>🚨 A critical error occurred in the app.</h2>
          <p>{this.state.error?.message}</p>
          <p>Check the browser console for technical details.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
