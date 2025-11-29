// src/components/ui/ErrorDisplay.tsx
// Reusable component for displaying comprehensive error messages

import React, { useState } from 'react';
import { getErrorDetails, ErrorDetails as _ErrorDetails } from '../../utils/errorMessages';

interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  showTechnicalDetails?: boolean;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = '',
  showTechnicalDetails = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const details = getErrorDetails(error);

  const severityStyles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconMap = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div
      className={`border rounded-lg p-6 ${severityStyles[details.severity]} ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0" aria-hidden="true">
          {iconMap[details.severity]}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2">{details.title}</h3>
          <p className="mb-4">{details.message}</p>

          {details.actions && details.actions.length > 0 && (
            <div className="mb-4">
              <p className="font-medium mb-2">What you can do:</p>
              <ul className="list-disc list-inside space-y-1">
                {details.actions.map((action, index) => (
                  <li key={index} className="text-sm">
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showTechnicalDetails && details.technicalDetails && (
            <div className="mt-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current rounded"
              >
                {showDetails ? 'Hide' : 'Show'} technical details
              </button>
              {showDetails && (
                <pre className="mt-2 p-3 bg-white bg-opacity-50 rounded text-xs overflow-auto max-h-40">
                  {details.technicalDetails}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            {onRetry && (
              <button
                onClick={onRetry}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  details.severity === 'error'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : details.severity === 'warning'
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current`}
              >
                Try Again
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-4 py-2 border border-current rounded-md font-medium hover:bg-white hover:bg-opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Inline error display for forms
export const InlineError: React.FC<{ error: unknown; className?: string }> = ({
  error,
  className = '',
}) => {
  const details = getErrorDetails(error);

  return (
    <div
      className={`flex items-center gap-2 text-red-600 text-sm ${className}`}
      role="alert"
    >
      <span aria-hidden="true">⚠️</span>
      <span>{details.message}</span>
    </div>
  );
};
