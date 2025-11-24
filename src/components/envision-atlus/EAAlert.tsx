/**
 * EAAlert - Envision Atlus Alert Component
 *
 * Clinical alerts following medical severity standards.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { AlertTriangle, AlertCircle, CheckCircle, Info, X } from 'lucide-react';

interface EAAlertProps {
  variant: 'critical' | 'warning' | 'success' | 'info';
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const EAAlert: React.FC<EAAlertProps> = ({
  variant,
  title,
  children,
  dismissible,
  onDismiss,
  className,
}) => {
  const variants = {
    critical: {
      container: 'bg-red-500/10 border-l-4 border-red-500',
      icon: <AlertCircle className="h-5 w-5 text-red-400" />,
      title: 'text-red-300',
      text: 'text-red-200',
    },
    warning: {
      container: 'bg-amber-500/10 border-l-4 border-amber-500',
      icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
      title: 'text-amber-300',
      text: 'text-amber-200',
    },
    success: {
      container: 'bg-green-500/10 border-l-4 border-green-500',
      icon: <CheckCircle className="h-5 w-5 text-green-400" />,
      title: 'text-green-300',
      text: 'text-green-200',
    },
    info: {
      container: 'bg-[#00857a]/10 border-l-4 border-[#00857a]',
      icon: <Info className="h-5 w-5 text-[#33bfb7]" />,
      title: 'text-[#66cfc9]',
      text: 'text-[#99dfdb]',
    },
  };

  const style = variants[variant];

  return (
    <div className={cn('rounded-r-lg p-4', style.container, className)}>
      <div className="flex gap-3">
        <div className="shrink-0 mt-0.5">{style.icon}</div>
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={cn('font-semibold text-sm mb-1', style.title)}>
              {title}
            </h4>
          )}
          <div className={cn('text-sm', style.text)}>{children}</div>
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default EAAlert;
