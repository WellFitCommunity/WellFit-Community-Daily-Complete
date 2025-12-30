/**
 * useToast - Reusable toast notification hook
 *
 * Provides a simple way to show toast notifications without alert().
 * Each component using this hook gets its own toast state.
 *
 * Usage:
 * ```tsx
 * const { toasts, showToast, dismissToast, ToastContainer } = useToast();
 *
 * // Show a toast
 * showToast('success', 'Operation completed!');
 * showToast('error', 'Something went wrong');
 * showToast('info', 'Processing...');
 * showToast('warning', 'Please review');
 *
 * // Render the container (once per component)
 * return (
 *   <div>
 *     <ToastContainer />
 *     {/* rest of component *\/}
 *   </div>
 * );
 * ```
 */

import React, { useState, useCallback, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastNotificationProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bgColors: Record<ToastType, string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return (
    <div
      className={`${bgColors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex justify-between items-center min-w-[20rem] max-w-md animate-slide-in`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center space-x-2">
        <span className="font-bold" aria-hidden="true">{icons[toast.type]}</span>
        <span className="text-sm">{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-4 text-white hover:text-gray-200 font-bold text-lg"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
};

interface ToastContainerComponentProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

const ToastContainerComponent: React.FC<ToastContainerComponentProps> = ({ toasts, onDismiss }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite">
    {toasts.map(toast => (
      <ToastNotification key={toast.id} toast={toast} onDismiss={onDismiss} />
    ))}
  </div>
);

export interface UseToastReturn {
  toasts: ToastData[];
  showToast: (type: ToastType, message: string) => void;
  dismissToast: (id: string) => void;
  ToastContainer: React.FC;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const ToastContainer = useCallback(() => (
    <ToastContainerComponent toasts={toasts} onDismiss={dismissToast} />
  ), [toasts, dismissToast]);

  return {
    toasts,
    showToast,
    dismissToast,
    ToastContainer
  };
}

export default useToast;
