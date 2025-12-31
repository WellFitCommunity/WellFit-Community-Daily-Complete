/**
 * useToast - Enterprise-Grade Toast Notification Hook
 *
 * Provides a reusable, accessible toast notification system.
 * Replaces browser alert()/confirm() with non-blocking notifications.
 *
 * Features:
 * - WCAG 2.1 AA compliant accessibility
 * - Audit logging integration for error/warning tracking
 * - Configurable duration and positioning
 * - Maximum toast limit to prevent UI overflow
 * - Unique ID generation for each toast
 *
 * Usage:
 * ```tsx
 * const { showToast, ToastContainer } = useToast();
 *
 * // Show toasts
 * showToast('success', 'Operation completed!');
 * showToast('error', 'Something went wrong');
 * showToast('info', 'Processing...');
 * showToast('warning', 'Please review');
 *
 * // With custom duration (ms)
 * showToast('info', 'Quick message', { duration: 2000 });
 *
 * // Render container once per component
 * return (
 *   <div>
 *     <ToastContainer />
 *     {/* component content *\/}
 *   </div>
 * );
 * ```
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { auditLogger } from '../services/auditLogger';

/** Toast notification types */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/** Position options for toast container */
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

/** Configuration options for showing a toast */
export interface ToastOptions {
  /** Duration in milliseconds before auto-dismiss (default: 5000) */
  duration?: number;
  /** Whether to enable audit logging for this toast (default: true for error/warning) */
  auditLog?: boolean;
}

/** Internal toast data structure */
export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  createdAt: number;
}

/** Configuration for the useToast hook */
export interface UseToastConfig {
  /** Maximum number of toasts to display simultaneously (default: 5) */
  maxToasts?: number;
  /** Default duration in milliseconds (default: 5000) */
  defaultDuration?: number;
  /** Position of toast container (default: 'top-right') */
  position?: ToastPosition;
}

/** Props for individual toast notification component */
interface ToastNotificationProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

/** Generate a unique ID for each toast */
const generateToastId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 11);
  return `toast-${timestamp}-${randomPart}`;
};

/** Toast type to background color mapping */
const TOAST_COLORS: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-amber-500',
  info: 'bg-blue-600',
} as const;

/** Toast type to icon mapping */
const TOAST_ICONS: Record<ToastType, string> = {
  success: '\u2713', // ✓
  error: '\u2717',   // ✕
  warning: '\u26A0', // ⚠
  info: '\u2139',    // ℹ
} as const;

/** Position to CSS classes mapping */
const POSITION_CLASSES: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
} as const;

/**
 * Individual toast notification component
 */
const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onDismiss }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    onDismiss(toast.id);
  }, [toast.id, onDismiss]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        handleDismiss();
      }
    },
    [handleDismiss]
  );

  return (
    <div
      className={`${TOAST_COLORS[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex justify-between items-center min-w-[20rem] max-w-md transform transition-all duration-300 ease-out animate-slide-in`}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center space-x-3">
        <span
          className="text-lg font-bold flex-shrink-0"
          aria-hidden="true"
        >
          {TOAST_ICONS[toast.type]}
        </span>
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
      <button
        onClick={handleDismiss}
        className="ml-4 text-white/80 hover:text-white focus:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded p-1 transition-colors"
        aria-label="Dismiss notification"
        type="button"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};

/** Props for the toast container component */
interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
  position: ToastPosition;
}

/**
 * Container component that renders all active toasts
 */
const ToastContainerComponent: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  position,
}) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed ${POSITION_CLASSES[position]} z-50 space-y-2 pointer-events-none`}
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastNotification toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};

/** Return type for the useToast hook */
export interface UseToastReturn {
  /** Array of currently displayed toasts */
  toasts: ToastData[];
  /** Show a new toast notification */
  showToast: (type: ToastType, message: string, options?: ToastOptions) => string;
  /** Dismiss a specific toast by ID */
  dismissToast: (id: string) => void;
  /** Dismiss all active toasts */
  dismissAll: () => void;
  /** React component to render the toast container */
  ToastContainer: React.FC;
}

/** Default configuration values */
const DEFAULT_CONFIG: Required<UseToastConfig> = {
  maxToasts: 5,
  defaultDuration: 5000,
  position: 'top-right',
};

/**
 * Enterprise-grade toast notification hook
 *
 * @param config - Optional configuration for the toast system
 * @returns Toast management functions and container component
 */
export function useToast(config?: UseToastConfig): UseToastReturn {
  const mergedConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      ...config,
    }),
    [config]
  );

  const [toasts, setToasts] = useState<ToastData[]>([]);

  /**
   * Show a new toast notification
   * @param type - Type of toast (success, error, info, warning)
   * @param message - Message to display
   * @param options - Optional configuration for this specific toast
   * @returns The unique ID of the created toast
   */
  const showToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions): string => {
      const id = generateToastId();
      const duration = options?.duration ?? mergedConfig.defaultDuration;
      const shouldAuditLog = options?.auditLog ?? (type === 'error' || type === 'warning');

      // Audit log for error/warning toasts (enterprise compliance)
      if (shouldAuditLog) {
        if (type === 'error') {
          auditLogger.warn('Toast notification displayed', {
            toastType: type,
            message,
            toastId: id,
          });
        } else if (type === 'warning') {
          auditLogger.info('Toast notification displayed', {
            toastType: type,
            message,
            toastId: id,
          });
        }
      }

      const newToast: ToastData = {
        id,
        type,
        message,
        duration,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Enforce max toasts limit by removing oldest
        if (updated.length > mergedConfig.maxToasts) {
          return updated.slice(-mergedConfig.maxToasts);
        }
        return updated;
      });

      return id;
    },
    [mergedConfig.defaultDuration, mergedConfig.maxToasts]
  );

  /**
   * Dismiss a specific toast by ID
   */
  const dismissToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Dismiss all active toasts
   */
  const dismissAll = useCallback((): void => {
    setToasts([]);
  }, []);

  /**
   * Memoized toast container component
   */
  const ToastContainer = useMemo(() => {
    const Container: React.FC = () => (
      <ToastContainerComponent
        toasts={toasts}
        onDismiss={dismissToast}
        position={mergedConfig.position}
      />
    );
    Container.displayName = 'ToastContainer';
    return Container;
  }, [toasts, dismissToast, mergedConfig.position]);

  return {
    toasts,
    showToast,
    dismissToast,
    dismissAll,
    ToastContainer,
  };
}

export default useToast;
