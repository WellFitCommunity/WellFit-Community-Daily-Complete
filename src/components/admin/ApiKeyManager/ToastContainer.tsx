// src/components/admin/ApiKeyManager/ToastContainer.tsx
//
// Toast UI extracted from the original ApiKeyManager. The container is the
// fixed-position wrapper; ToastNotification is a single auto-dismissing card.

import React, { useEffect } from 'react';
import type { ToastData } from './types';

interface ToastNotificationProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const bgColors: Record<ToastData['type'], string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
};

const icons: Record<ToastData['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`${bgColors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex justify-between items-center min-w-[20rem] max-w-md`}
    >
      <div className="flex items-center space-x-2">
        <span className="font-bold">{icons[toast.type]}</span>
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

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite">
    {toasts.map((toast) => (
      <ToastNotification key={toast.id} toast={toast} onDismiss={onDismiss} />
    ))}
  </div>
);

export default ToastContainer;
