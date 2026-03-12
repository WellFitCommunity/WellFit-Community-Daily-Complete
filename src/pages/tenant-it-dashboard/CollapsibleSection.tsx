/**
 * CollapsibleSection — Shared collapsible panel for Tenant IT Dashboard tabs
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CollapsibleSectionProps } from './TenantITDashboard.types';

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  icon,
  children,
  defaultOpen = false,
  badge,
  badgeColor = 'bg-[#C8E63D]'
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden hover:border-[#1BA39C] transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-[#E8F8F7] hover:bg-[#D1F2F0] transition-all border-b-2 border-black"
      >
        <div className="flex items-center flex-1 gap-3">
          <div className="p-2 rounded-lg bg-white border-2 border-black shadow-md">
            {icon}
          </div>
          <div className="text-left">
            <h2 className="text-xl font-bold text-black flex items-center gap-2">
              {title}
              {badge !== undefined && (
                <span className={`px-2 py-1 text-xs font-bold rounded-full ${badgeColor} text-black border border-black`}>
                  {badge}
                </span>
              )}
            </h2>
            {subtitle && <p className="text-sm text-[#6B7280] mt-1">{subtitle}</p>}
          </div>
        </div>
        <ChevronDown className={`text-[#1BA39C] transform transition-transform duration-200 w-6 h-6 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="p-6 bg-white">
          {children}
        </div>
      )}
    </section>
  );
};
