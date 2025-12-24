/**
 * Collapsible Section Component
 * Reusable collapsible UI for organizing physician panel sections
 */

import React, { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  category?: 'medical' | 'administrative' | 'clinical' | 'revenue';
  badge?: string | number;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = false,
  category = 'clinical',
  badge
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const categoryColors = {
    medical: 'border-l-4 border-l-blue-600 bg-blue-50',
    administrative: 'border-l-4 border-l-purple-600 bg-purple-50',
    clinical: 'border-l-4 border-l-green-600 bg-green-50',
    revenue: 'border-l-4 border-l-amber-600 bg-amber-50'
  };

  const badgeColors = {
    medical: 'bg-blue-600',
    administrative: 'bg-purple-600',
    clinical: 'bg-green-600',
    revenue: 'bg-amber-600'
  };

  const categoryColorsBranded = {
    medical: 'border-l-4 border-l-[#1BA39C] bg-linear-to-r from-[#E0F7F6] to-white',
    administrative: 'border-l-4 border-l-[#C8E63D] bg-linear-to-r from-[#F4FADC] to-white',
    clinical: 'border-l-4 border-l-[#158A84] bg-linear-to-r from-[#E0F7F6] to-white',
    revenue: 'border-l-4 border-l-[#C8E63D] bg-linear-to-r from-[#F4FADC] to-white'
  };

  const badgeColorsBranded = {
    medical: 'bg-[#1BA39C]',
    administrative: 'bg-[#C8E63D] text-[#2D3339]',
    clinical: 'bg-[#158A84]',
    revenue: 'bg-[#C8E63D] text-[#2D3339]'
  };

  return (
    <section className="bg-white rounded-xl shadow-lg border border-black overflow-hidden hover:border-2 hover:border-[#1BA39C] transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-[#E8F8F7] hover:bg-[#D1F2F0] transition-all border-b border-black"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <h2 className="text-xl font-bold text-black">{title}</h2>
          {badge !== undefined && (
            <span className={`px-2 py-1 text-xs font-bold rounded-full shadow-xs border border-black ${badgeColorsBranded[category]}`}>
              {badge}
            </span>
          )}
        </div>
        <span className={`text-[#1BA39C] font-bold transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="px-6 py-4 bg-white">
          {children}
        </div>
      )}
    </section>
  );
};
