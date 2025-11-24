/**
 * EAPageLayout - Envision Atlus Page Layout
 *
 * Consistent page structure for clinical dashboards.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronLeft } from 'lucide-react';
import { EAButton } from './EAButton';

interface EAPageLayoutProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  backButton?: {
    label?: string;
    onClick: () => void;
  };
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const EAPageLayout: React.FC<EAPageLayoutProps> = ({
  title,
  subtitle,
  badge,
  backButton,
  actions,
  children,
  className,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-4">
              {backButton && (
                <EAButton
                  variant="ghost"
                  size="sm"
                  onClick={backButton.onClick}
                  icon={<ChevronLeft className="h-4 w-4" />}
                >
                  {backButton.label || 'Back'}
                </EAButton>
              )}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-white">{title}</h1>
                  {badge}
                </div>
                {subtitle && (
                  <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            {actions && (
              <div className="flex items-center gap-3">{actions}</div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8', className)}>
        {children}
      </main>

      {/* Footer branding */}
      <footer className="border-t border-slate-800 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-slate-600 text-center">
            Envision Atlus Clinical Platform &bull; Powered by Envision VirtualEdge Group
          </p>
        </div>
      </footer>
    </div>
  );
};

export default EAPageLayout;
