/**
 * useAdminPersonalization - AI-powered dashboard personalization hook
 *
 * Extracted from IntelligentAdminPanel to keep it under 600 lines.
 * Manages behavior tracking, AI suggestions, milestones, and suggestion routing.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardPersonalizationAI } from '../services/dashboardPersonalizationAI';
import { auditLogger } from '../services/auditLogger';
import {
  getUserBehaviorProfile,
  trackBehaviorEvent,
  getSmartSuggestions,
  UserBehaviorProfile
} from '../services/behaviorTracking';
import { LearningEvent } from '../components/admin/LearningIndicator';
import { SupabaseClient } from '@supabase/supabase-js';

/** Map of known section/category names to their IDs and types */
const SUGGESTION_SECTION_MAP: Record<string, { id: string; type: 'section' | 'category' | 'route' }> = {
  // Categories
  'revenue': { id: 'revenue', type: 'category' },
  'billing': { id: 'revenue', type: 'category' },
  'patient care': { id: 'patient-care', type: 'category' },
  'patient-care': { id: 'patient-care', type: 'category' },
  'clinical': { id: 'clinical', type: 'category' },
  'security': { id: 'security', type: 'category' },
  'admin': { id: 'admin', type: 'category' },

  // Sections
  'smartscribe': { id: 'smartscribe-atlus', type: 'section' },
  'smart scribe': { id: 'smartscribe-atlus', type: 'section' },
  'scribe': { id: 'smartscribe-atlus', type: 'section' },
  'patient engagement': { id: 'patient-engagement', type: 'section' },
  'patient-engagement': { id: 'patient-engagement', type: 'section' },
  'user management': { id: 'user-management', type: 'section' },
  'user-management': { id: 'user-management', type: 'section' },
  'patient list': { id: 'user-management', type: 'section' },
  'billing dashboard': { id: 'billing-dashboard', type: 'section' },
  'billing-dashboard': { id: 'billing-dashboard', type: 'section' },
  'revenue dashboard': { id: 'revenue-dashboard', type: 'section' },
  'revenue-dashboard': { id: 'revenue-dashboard', type: 'section' },
  'ccm': { id: 'ccm-autopilot', type: 'section' },
  'ccm autopilot': { id: 'ccm-autopilot', type: 'section' },
  'ccm-autopilot': { id: 'ccm-autopilot', type: 'section' },
  'fhir': { id: 'fhir-analytics', type: 'section' },
  'fhir analytics': { id: 'fhir-analytics', type: 'section' },
  'fhir-analytics': { id: 'fhir-analytics', type: 'section' },
  'claims': { id: 'claims-submission', type: 'section' },
  'claims submission': { id: 'claims-submission', type: 'section' },
  'handoff': { id: 'patient-handoff', type: 'section' },
  'patient handoff': { id: 'patient-handoff', type: 'section' },
  'prior auth': { id: 'prior-auth', type: 'section' },
  'prior-auth': { id: 'prior-auth', type: 'section' },
  'prior authorization': { id: 'prior-auth', type: 'section' },

  // Routes
  'er dashboard': { id: '/er-dashboard', type: 'route' },
  'er-dashboard': { id: '/er-dashboard', type: 'route' },
  'emergency': { id: '/er-dashboard', type: 'route' },
  'nurse dashboard': { id: '/nurse-dashboard', type: 'route' },
  'nurse-dashboard': { id: '/nurse-dashboard', type: 'route' },
  'physician dashboard': { id: '/physician-dashboard', type: 'route' },
  'physician-dashboard': { id: '/physician-dashboard', type: 'route' },
  'neuro': { id: '/neuro-suite', type: 'route' },
  'neuro suite': { id: '/neuro-suite', type: 'route' },
  'neuro-suite': { id: '/neuro-suite', type: 'route' },
  'physical therapy': { id: '/physical-therapy', type: 'route' },
  'physical-therapy': { id: '/physical-therapy', type: 'route' },
  'care coordination': { id: '/care-coordination', type: 'route' },
  'care-coordination': { id: '/care-coordination', type: 'route' },
  'referrals': { id: '/referrals', type: 'route' },
};

interface UseAdminPersonalizationParams {
  userId: string | undefined;
  adminRole: string | null;
  supabase: SupabaseClient;
  onScrollToSection: (sectionId: string) => void;
  onOpenCategory: (categoryId: string) => void;
}

interface UseAdminPersonalizationReturn {
  isLoading: boolean;
  aiSuggestions: string[];
  learningEvents: LearningEvent[];
  behaviorProfile: UserBehaviorProfile | null;
  showMilestone: boolean;
  milestone: string;
  setShowMilestone: (show: boolean) => void;
  handleSuggestionClick: (suggestion: string) => void;
  addLearningEvent: (event: Omit<LearningEvent, 'timestamp'> & { timestamp: Date }) => void;
  loadPersonalizedDashboard: () => Promise<void>;
}

export function useAdminPersonalization({
  userId,
  adminRole,
  supabase,
  onScrollToSection,
  onOpenCategory,
}: UseAdminPersonalizationParams): UseAdminPersonalizationReturn {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
  const [behaviorProfile, setBehaviorProfile] = useState<UserBehaviorProfile | null>(null);
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestone, setMilestone] = useState('');

  const addLearningEvent = useCallback((event: Omit<LearningEvent, 'timestamp'> & { timestamp: Date }) => {
    setLearningEvents(prev => [...prev, event].slice(-10));
  }, []);

  const checkMilestones = useCallback((profile: UserBehaviorProfile) => {
    const { totalSessions, sectionStats } = profile;

    if (totalSessions === 10) {
      setMilestone('🎯 10 Dashboard Visits - The system is learning your patterns!');
      setShowMilestone(true);
    } else if (totalSessions === 50) {
      setMilestone('🚀 50 Dashboard Visits - Your dashboard is now highly personalized!');
      setShowMilestone(true);
    } else if (sectionStats.some(s => s.frequencyScore === 100)) {
      setMilestone('⭐ Perfect Pattern - You have a favorite section!');
      setShowMilestone(true);
    }
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    const normalized = suggestion.toLowerCase();

    let matched: { id: string; type: 'section' | 'category' | 'route' } | null = null;

    for (const [keyword, target] of Object.entries(SUGGESTION_SECTION_MAP)) {
      if (normalized.includes(keyword)) {
        matched = target;
        break;
      }
    }

    if (matched) {
      if (matched.type === 'route') {
        navigate(matched.id);
        addLearningEvent({
          type: 'suggestion_generated',
          message: `Navigated to ${matched.id}`,
          timestamp: new Date()
        });
      } else if (matched.type === 'category') {
        onOpenCategory(matched.id);
        addLearningEvent({
          type: 'suggestion_generated',
          message: `Opened ${matched.id} category`,
          timestamp: new Date()
        });
      } else {
        onScrollToSection(matched.id);
        addLearningEvent({
          type: 'suggestion_generated',
          message: `Jumped to ${matched.id}`,
          timestamp: new Date()
        });
      }
    } else {
      // Fallback: try to find element by ID from suggestion text
      const words = suggestion.replace(/[^a-zA-Z0-9\s-]/g, '').toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3) {
          const element = document.getElementById(word) ||
                         document.getElementById(word.replace(/\s+/g, '-')) ||
                         document.querySelector(`[data-category-id="${word}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            element.classList.add('ring-2', 'ring-indigo-500');
            setTimeout(() => element.classList.remove('ring-2', 'ring-indigo-500'), 2000);
            addLearningEvent({
              type: 'suggestion_generated',
              message: `Found and scrolled to ${word}`,
              timestamp: new Date()
            });
            return;
          }
        }
      }

      addLearningEvent({
        type: 'suggestion_generated',
        message: 'Suggestion noted - exploring...',
        timestamp: new Date()
      });
    }
  }, [navigate, onOpenCategory, onScrollToSection, addLearningEvent]);

  const loadPersonalizedDashboard = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const profile = await getUserBehaviorProfile(supabase, userId);
      setBehaviorProfile(profile);

      addLearningEvent({
        type: 'pattern_detected',
        message: profile ? 'Loaded your personalized dashboard' : 'Starting to learn your patterns',
        timestamp: new Date()
      });

      const layout = await DashboardPersonalizationAI.generatePersonalizedLayout(
        userId,
        adminRole || 'admin',
        new Date().getHours()
      );

      const behaviorBasedSuggestions = getSmartSuggestions(profile);

      const combinedSuggestions = [
        ...(layout.suggestions || []),
        ...behaviorBasedSuggestions
      ].slice(0, 5);

      setAiSuggestions(combinedSuggestions);

      if (profile) {
        checkMilestones(profile);
      }

      if (userId) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', userId)
          .single();

        await trackBehaviorEvent(supabase, {
          userId,
          tenantId: userProfile?.tenant_id || '',
          eventType: 'navigation',
          metadata: { page: 'admin_dashboard' }
        });

        addLearningEvent({
          type: 'section_opened',
          message: 'Dashboard visit tracked',
          timestamp: new Date()
        });
      }
    } catch (error) {
      await auditLogger.error('ADMIN_DASHBOARD_PERSONALIZATION_FAILED', error instanceof Error ? error : new Error('Unknown error'), {
        userId,
        adminRole: adminRole || 'admin'
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, adminRole, supabase, addLearningEvent, checkMilestones]);

  return {
    isLoading,
    aiSuggestions,
    learningEvents,
    behaviorProfile,
    showMilestone,
    milestone,
    setShowMilestone,
    handleSuggestionClick,
    addLearningEvent,
    loadPersonalizedDashboard,
  };
}
