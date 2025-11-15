/**
 * Adaptive Collapsible Section
 *
 * Smart collapsible section that learns user behavior and auto-expands/collapses
 * based on usage patterns powered by Claude Haiku 4.5
 */

import React, { useState, useEffect } from 'react';
import { DashboardPersonalizationAI } from '../../services/dashboardPersonalizationAI';
import { useUser, useSupabaseClient } from '../../contexts/AuthContext';
import { trackBehaviorEvent, getUserBehaviorProfile } from '../../services/behaviorTracking';
import { LearningBadge } from './LearningIndicator';

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
  const supabase = useSupabaseClient();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [openStartTime, setOpenStartTime] = useState<Date | null>(null);
  const [frequencyScore, setFrequencyScore] = useState(0);
  const [isTopSection, setIsTopSection] = useState(false);

  // Load behavior data for this section
  useEffect(() => {
    const loadSectionStats = async () => {
      if (!user?.id) return;

      const profile = await getUserBehaviorProfile(supabase, user.id);
      if (profile) {
        const sectionStat = profile.sectionStats.find(s => s.sectionId === sectionId);
        if (sectionStat) {
          setFrequencyScore(sectionStat.frequencyScore);
        }
        setIsTopSection(profile.mostUsedSections.slice(0, 3).includes(sectionId));
      }
    };

    loadSectionStats();
  }, [user?.id, sectionId, supabase]);

  // Track open/close interactions
  const handleToggle = async () => {
    const wasOpen = isOpen;
    setIsOpen(!isOpen);

    if (!user?.id) return;

    try {
      // Get tenant ID for tracking
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      const tenantId = profile?.tenant_id || '';

      if (!wasOpen) {
        // Opening section - track start time
        setOpenStartTime(new Date());

        // Track with AI personalization service
        await DashboardPersonalizationAI.trackSectionOpen(
          user.id,
          sectionId,
          title,
          userRole
        );

        // Track with behavior tracking service
        await trackBehaviorEvent(supabase, {
          userId: user.id,
          tenantId,
          eventType: 'section_opened',
          sectionId,
          metadata: { title, priority }
        });
      } else if (openStartTime) {
        // Closing section - track close and duration
        const duration = Date.now() - openStartTime.getTime();
        setOpenStartTime(null);

        // Track with behavior tracking service
        await trackBehaviorEvent(supabase, {
          userId: user.id,
          tenantId,
          eventType: 'section_closed',
          sectionId,
          metadata: { title, duration }
        });
      }
    } catch (error) {
      // Fail silently - tracking should never break functionality
    }
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
            <div className="flex items-center gap-2">
              <h2 className={`text-xl font-semibold ${headerColor}`}>
                {title}
              </h2>
              {renderPriorityBadge()}
              <LearningBadge
                sectionId={sectionId}
                frequencyScore={frequencyScore}
                isTopSection={isTopSection}
              />
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
