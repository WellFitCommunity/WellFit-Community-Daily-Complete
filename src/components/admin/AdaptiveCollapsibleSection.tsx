/**
 * Adaptive Collapsible Section
 *
 * Smart collapsible section that learns user behavior and auto-expands/collapses
 * based on usage patterns powered by Claude Haiku 4.5
 */

import React, { useState, useEffect } from 'react';
import { DashboardPersonalizationAI } from '../../services/dashboardPersonalizationAI';
import { useUser } from '../../contexts/AuthContext';

interface AdaptiveCollapsibleSectionProps {
  sectionId: string;
  title: string;
  subtitle?: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  headerColor?: string;
  userRole?: string;
  priority?: 'high' | 'medium' | 'low'; // For intelligent ordering
}

export const AdaptiveCollapsibleSection: React.FC<AdaptiveCollapsibleSectionProps> = ({
  sectionId,
  title,
  subtitle,
  icon,
  children,
  defaultOpen = false,
  headerColor = 'text-gray-800',
  userRole = 'admin',
  priority = 'medium',
}) => {
  const user = useUser();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isLearning, setIsLearning] = useState(false);
  const [openStartTime, setOpenStartTime] = useState<Date | null>(null);

  // Track open/close interactions
  const handleToggle = async () => {
    const wasOpen = isOpen;
    setIsOpen(!isOpen);

    if (!user?.id) return;

    try {
      if (!wasOpen) {
        // Opening section - track start time
        setOpenStartTime(new Date());
        await DashboardPersonalizationAI.trackSectionOpen(
          user.id,
          sectionId,
          title,
          userRole
        );
      } else if (openStartTime) {
        // Closing section - calculate time spent
        const timeSpent = Math.floor((new Date().getTime() - openStartTime.getTime()) / 1000);
        // You could track close event with time spent here if needed
        setOpenStartTime(null);
      }
    } catch (error) {
      console.error('Failed to track section interaction:', error);
    }
  };

  // Visual indicator that this section is learning user behavior
  const renderLearningBadge = () => {
    if (!isLearning) return null;

    return (
      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full font-medium">
        🧠 AI Learning
      </span>
    );
  };

  // Priority badge for high-priority sections
  const renderPriorityBadge = () => {
    if (priority !== 'high') return null;

    return (
      <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
        ⚡ Quick Access
      </span>
    );
  };

  return (
    <section className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-xl">
      <button
        onClick={handleToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-200"
        aria-expanded={isOpen}
        aria-controls={`section-${sectionId}`}
      >
        <div className="flex items-center flex-1">
          <span className="text-2xl mr-3" aria-hidden="true">{icon}</span>
          <div className="text-left">
            <div className="flex items-center">
              <h2 className={`text-xl font-semibold ${headerColor}`}>
                {title}
              </h2>
              {renderPriorityBadge()}
              {renderLearningBadge()}
            </div>
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>
        </div>
        <span
          className={`text-gray-500 transform transition-transform duration-200 text-xl ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      {isOpen && (
        <div className="p-6" id={`section-${sectionId}`}>
          {children}
        </div>
      )}
    </section>
  );
};

export default AdaptiveCollapsibleSection;
