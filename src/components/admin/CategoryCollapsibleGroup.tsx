/**
 * Category Collapsible Group
 *
 * Groups related dashboard sections together with AI-powered behavior learning
 * Used in Mission Control to organize sections by category (Revenue, Patient Care, etc.)
 */

import React, { useState } from 'react';
import { DashboardPersonalizationAI } from '../../services/dashboardPersonalizationAI';
import { useUser } from '../../contexts/AuthContext';

interface CategoryCollapsibleGroupProps {
  categoryId: string;
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  headerColor?: string;
  userRole?: string;
}

export const CategoryCollapsibleGroup: React.FC<CategoryCollapsibleGroupProps> = ({
  categoryId,
  title,
  icon,
  children,
  defaultOpen = false,
  headerColor = 'text-gray-900',
  userRole = 'admin',
}) => {
  const user = useUser();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [openStartTime, setOpenStartTime] = useState<Date | null>(null);

  // Track category open/close for AI learning
  const handleToggle = async () => {
    const wasOpen = isOpen;
    setIsOpen(!isOpen);

    if (!user?.id) return;

    try {
      if (!wasOpen) {
        // Opening category - track start time
        setOpenStartTime(new Date());
        await DashboardPersonalizationAI.trackSectionOpen(
          user.id,
          categoryId,
          title,
          userRole
        );
      } else if (openStartTime) {
        // Closing category - track close
        setOpenStartTime(null);
      }
    } catch (error) {

    }
  };

  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl shadow-md border-2 border-gray-200 overflow-hidden mb-6">
      <button
        onClick={handleToggle}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/50 transition-all duration-200"
        aria-expanded={isOpen}
        aria-controls={`category-${categoryId}`}
      >
        <div className="flex items-center">
          <span className="text-3xl mr-4" aria-hidden="true">{icon}</span>
          <h2 className={`text-2xl font-bold ${headerColor}`}>
            {title}
          </h2>
        </div>
        <span
          className={`text-gray-600 transform transition-transform duration-300 text-2xl ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      {isOpen && (
        <div className="px-4 py-4 space-y-4" id={`category-${categoryId}`}>
          {children}
        </div>
      )}
    </div>
  );
};

export default CategoryCollapsibleGroup;
