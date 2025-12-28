// src/utils/errorMessages.ts
// Comprehensive error message handling with user-friendly messages and actionable guidance

export interface ErrorDetails {
  title: string;
  message: string;
  technicalDetails?: string;
  actions?: readonly string[];
  severity: 'error' | 'warning' | 'info';
}

export class AppError extends Error {
  public readonly details: ErrorDetails;
  public readonly originalError?: Error;

  constructor(details: ErrorDetails, originalError?: Error) {
    super(details.message);
    this.name = 'AppError';
    this.details = details;
    this.originalError = originalError;
  }
}

// Network and API Errors
export const ERROR_MESSAGES = {
  // Network errors
  NETWORK_ERROR: {
    title: 'Network Connection Error',
    message: 'Unable to connect to the server. Please check your internet connection.',
    actions: [
      'Check your internet connection',
      'Disable VPN if active',
      'Try refreshing the page',
      'Contact support if the issue persists',
    ],
    severity: 'error' as const,
  },

  TIMEOUT_ERROR: {
    title: 'Request Timeout',
    message: 'The request took too long to complete. The server may be experiencing high load.',
    actions: [
      'Wait a moment and try again',
      'Check your internet speed',
      'Contact support if timeouts persist',
    ],
    severity: 'error' as const,
  },

  // Authentication errors
  UNAUTHORIZED: {
    title: 'Authentication Required',
    message: 'Your session has expired or you are not logged in.',
    actions: [
      'Please log in again',
      'Check if your account is active',
      'Clear browser cache and cookies',
    ],
    severity: 'warning' as const,
  },

  FORBIDDEN: {
    title: 'Access Denied',
    message: 'You do not have permission to access this resource.',
    actions: [
      'Contact your administrator for access',
      'Verify you are using the correct account',
      'Check if your role has required permissions',
    ],
    severity: 'error' as const,
  },

  // Data errors
  NOT_FOUND: {
    title: 'Resource Not Found',
    message: 'The requested resource could not be found.',
    actions: [
      'Verify the URL is correct',
      'The item may have been deleted',
      'Contact support if you believe this is an error',
    ],
    severity: 'warning' as const,
  },

  VALIDATION_ERROR: {
    title: 'Invalid Data',
    message: 'The information provided is invalid or incomplete.',
    actions: [
      'Review all required fields',
      'Check for error messages below each field',
      'Ensure data is in the correct format',
    ],
    severity: 'warning' as const,
  },

  // Database errors
  DATABASE_ERROR: {
    title: 'Database Error',
    message: 'An error occurred while accessing the database.',
    actions: [
      'Try again in a few moments',
      'Contact support with the timestamp of this error',
      'Save your work locally if possible',
    ],
    severity: 'error' as const,
  },

  // File upload errors
  FILE_TOO_LARGE: {
    title: 'File Size Exceeded',
    message: 'The file you are trying to upload is too large.',
    actions: [
      'Reduce file size (compress images/videos)',
      'Upload a smaller file',
      'Contact support for larger file limits',
    ],
    severity: 'warning' as const,
  },

  FILE_TYPE_INVALID: {
    title: 'Invalid File Type',
    message: 'The file type you are trying to upload is not supported.',
    actions: [
      'Convert to a supported format',
      'Check the list of allowed file types',
      'Contact support for format questions',
    ],
    severity: 'warning' as const,
  },

  // Rate limiting
  RATE_LIMIT_EXCEEDED: {
    title: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please slow down.',
    actions: [
      'Wait a few minutes before trying again',
      'Avoid rapid repeated requests',
      'Contact support if you need higher limits',
    ],
    severity: 'warning' as const,
  },

  // Server errors
  SERVER_ERROR: {
    title: 'Server Error',
    message: 'An unexpected error occurred on the server.',
    actions: [
      'Try again in a few moments',
      'Report this error with timestamp to support',
      'Check status page for ongoing issues',
    ],
    severity: 'error' as const,
  },

  SERVICE_UNAVAILABLE: {
    title: 'Service Temporarily Unavailable',
    message: 'The service is temporarily unavailable. We are working to restore it.',
    actions: [
      'Try again in a few minutes',
      'Check status page for updates',
      'Save your work and wait for service restoration',
    ],
    severity: 'error' as const,
  },

  // Form errors
  FORM_INCOMPLETE: {
    title: 'Incomplete Form',
    message: 'Please fill in all required fields before submitting.',
    actions: [
      'Review fields marked with red borders',
      'Ensure all required fields have values',
      'Check for validation error messages',
    ],
    severity: 'warning' as const,
  },

  // hCaptcha errors
  CAPTCHA_FAILED: {
    title: 'CAPTCHA Verification Failed',
    message: 'Please complete the CAPTCHA verification.',
    actions: [
      'Click the checkbox to verify you are human',
      'Solve the challenge if presented',
      'Disable browser extensions that may interfere',
      'Try a different browser if issues persist',
    ],
    severity: 'warning' as const,
  },

  CAPTCHA_EXPIRED: {
    title: 'CAPTCHA Expired',
    message: 'Your CAPTCHA verification has expired.',
    actions: [
      'Complete the CAPTCHA verification again',
      'Submit the form more quickly after verification',
    ],
    severity: 'warning' as const,
  },

  // Generic fallback
  UNKNOWN_ERROR: {
    title: 'Unexpected Error',
    message: 'An unexpected error occurred. Please try again.',
    actions: [
      'Refresh the page and try again',
      'Clear browser cache',
      'Contact support with error details',
    ],
    severity: 'error' as const,
  },
} as const;

type HttpLikeError = {
  status?: number;
  statusCode?: number;
  message?: string;
};

// Helper function to get error details from various error types
export function getErrorDetails(error: unknown): ErrorDetails {
  // Handle AppError
  if (error instanceof AppError) {
    return error.details;
  }

  // Handle native Error
  if (error instanceof Error) {
    // Check for specific error patterns
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return { ...ERROR_MESSAGES.NETWORK_ERROR, technicalDetails: error.message };
    }

    if (message.includes('timeout')) {
      return { ...ERROR_MESSAGES.TIMEOUT_ERROR, technicalDetails: error.message };
    }

    if (message.includes('unauthorized') || message.includes('401')) {
      return { ...ERROR_MESSAGES.UNAUTHORIZED, technicalDetails: error.message };
    }

    if (message.includes('forbidden') || message.includes('403')) {
      return { ...ERROR_MESSAGES.FORBIDDEN, technicalDetails: error.message };
    }

    if (message.includes('not found') || message.includes('404')) {
      return { ...ERROR_MESSAGES.NOT_FOUND, technicalDetails: error.message };
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return { ...ERROR_MESSAGES.VALIDATION_ERROR, technicalDetails: error.message };
    }

    if (message.includes('rate limit')) {
      return { ...ERROR_MESSAGES.RATE_LIMIT_EXCEEDED, technicalDetails: error.message };
    }

    if (message.includes('captcha')) {
      return { ...ERROR_MESSAGES.CAPTCHA_FAILED, technicalDetails: error.message };
    }

    return {
      ...ERROR_MESSAGES.UNKNOWN_ERROR,
      technicalDetails: error.message,
    };
  }

  // Handle HTTP response errors
  if (typeof error === 'object' && error !== null) {
    const err = error as HttpLikeError;

    if (err.status || err.statusCode) {
      const status = err.status ?? err.statusCode;

      switch (status) {
        case 400:
          return { ...ERROR_MESSAGES.VALIDATION_ERROR, technicalDetails: err.message };
        case 401:
          return { ...ERROR_MESSAGES.UNAUTHORIZED, technicalDetails: err.message };
        case 403:
          return { ...ERROR_MESSAGES.FORBIDDEN, technicalDetails: err.message };
        case 404:
          return { ...ERROR_MESSAGES.NOT_FOUND, technicalDetails: err.message };
        case 413:
          return { ...ERROR_MESSAGES.FILE_TOO_LARGE, technicalDetails: err.message };
        case 429:
          return { ...ERROR_MESSAGES.RATE_LIMIT_EXCEEDED, technicalDetails: err.message };
        case 500:
        case 502:
        case 503:
          return { ...ERROR_MESSAGES.SERVER_ERROR, technicalDetails: err.message };
        case 504:
          return { ...ERROR_MESSAGES.TIMEOUT_ERROR, technicalDetails: err.message };
      }
    }
  }

  // Fallback for unknown errors
  return {
    ...ERROR_MESSAGES.UNKNOWN_ERROR,
    technicalDetails: String(error),
  };
}

// Format error for logging
export function formatErrorForLogging(error: unknown): string {
  const details = getErrorDetails(error);
  return `[${details.severity.toUpperCase()}] ${details.title}: ${details.message}${
    details.technicalDetails ? ` | Technical: ${details.technicalDetails}` : ''
  }`;
}

// Create a user-friendly error message
export function createUserErrorMessage(error: unknown): string {
  const details = getErrorDetails(error);
  let message = `${details.title}\n\n${details.message}`;

  if (details.actions && details.actions.length > 0) {
    message += '\n\nSuggested actions:\n';
    details.actions.forEach((action, i) => {
      message += `${i + 1}. ${action}\n`;
    });
  }

  return message;
}
