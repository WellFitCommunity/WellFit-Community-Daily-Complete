/**
 * Intelligent Admin Panel
 *
 * AI-powered adaptive dashboard that learns each user's behavior and reorganizes itself
 * Uses enterprise AI for ultra-fast personalization predictions
 *
 * Features:
 * - Learns user patterns over time
 * - Auto-expands frequently used sections
 * - Reorders sections by usage frequency
 * - Time-of-day awareness
 * - Role-based defaults for new users
 * - Smart suggestions powered by AI
 */

import React, { useState, useEffect, Suspense, lazy, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useUser } from '../../contexts/AuthContext';
import { DashboardPersonalizationAI } from '../../services/dashboardPersonalizationAI';
import { auditLogger } from '../../services/auditLogger';
import RequireAdminAuth from 'components/auth/RequireAdminAuth';
import AdminHeader from './AdminHeader';
import WhatsNewModal from './WhatsNewModal';
import { PersonalizedGreeting } from '../ai-transparency';
import {
  getUserBehaviorProfile,
  trackBehaviorEvent,
  getSmartSuggestions,
  UserBehaviorProfile
} from '../../services/behaviorTracking';
import { useSupabaseClient } from '../../contexts/AuthContext';
import {
  LearningIndicator,
  LearningEvent,
  SmartSuggestionCard,
  MilestoneCelebration
} from './LearningIndicator';
import { Clock, TrendingUp, Zap } from 'lucide-react';
import { SectionLoadingFallback as _SectionLoadingFallback } from './sections/sectionDefinitions';
// VoiceCommandBar removed - now handled by ClinicalModeComponents
import { useWorkflowPreferences } from '../../hooks/useWorkflowPreferences';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import { SearchResult } from '../../contexts/VoiceActionContext';

// Lazy-load category components for code splitting
// This reduces the initial bundle size by ~30-40%
const RevenueBillingCategory = lazy(() => import('./sections/RevenueBillingCategory'));
const PatientCareCategory = lazy(() => import('./sections/PatientCareCategory'));
const ClinicalDataCategory = lazy(() => import('./sections/ClinicalDataCategory'));
const SecurityComplianceCategory = lazy(() => import('./sections/SecurityComplianceCategory'));
const SystemAdminCategory = lazy(() => import('./sections/SystemAdminCategory'));

// Category loading fallback
const CategoryLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center p-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    <span className="ml-3 text-gray-700 text-lg">Loading category...</span>
  </div>
);

const IntelligentAdminPanel: React.FC = () => {
  const { adminRole } = useAdminAuth();
  const user = useUser();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
  const [behaviorProfile, setBehaviorProfile] = useState<UserBehaviorProfile | null>(null);
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestone, setMilestone] = useState('');

  // Use workflow preferences for role-based ordering
  const {
    categoryOrder,
    getCategoryOpenState,
    isLoading: prefsLoading,
  } = useWorkflowPreferences();

  // Category refs for voice command scrolling
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ATLUS: Intuitive Technology - Voice search for patients, beds, providers
  // When user says "patient Maria LeBlanc", this handles the search and result selection
  const handlePatientSelected = useCallback((result: SearchResult) => {
    auditLogger.info('VOICE_PATIENT_SELECTED', {
      patientId: result.id,
      patientName: result.primaryText,
    });

    // Scroll to patient-care category and expand it
    const patientCareCategory = categoryRefs.current['patient-care'];
    if (patientCareCategory) {
      patientCareCategory.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const button = patientCareCategory.querySelector('button');
      if (button) button.click();
    }

    // Dispatch custom event for PatientCareCategory to highlight the patient
    window.dispatchEvent(new CustomEvent('voicePatientSelected', {
      detail: { patientId: result.id, patientName: result.primaryText, metadata: result.metadata }
    }));
  }, []);

  // Register voice search for this dashboard
  useVoiceSearch({
    entityTypes: ['patient', 'provider'],
    onPatientSelected: handlePatientSelected,
    updatePatientContext: true, // Auto-update global patient context
  });

  // Voice command handlers
  const handleScrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Flash the element to indicate it was found
      element.classList.add('ring-2', 'ring-teal-500');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-teal-500');
      }, 2000);
    }
  }, []);

  const handleOpenCategory = useCallback((categoryId: string) => {
    const categoryElement = categoryRefs.current[categoryId];
    if (categoryElement) {
      categoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Try to expand the category
      const button = categoryElement.querySelector('button');
      if (button) {
        button.click();
      }
    }
  }, []);

  // Get category open states based on role-based preferences
  const getCategoryOpenStateForRole = useCallback((categoryId: string): boolean => {
    // If preferences are loaded, use them
    if (!prefsLoading && categoryOrder.length > 0) {
      return getCategoryOpenState(categoryId);
    }
    // Default fallback based on role
    if (adminRole === 'nurse' || adminRole === 'physician' || adminRole === 'doctor') {
      return categoryId === 'patient-care';
    }
    if (adminRole === 'billing_specialist') {
      return categoryId === 'revenue';
    }
    if (adminRole === 'it_admin') {
      return categoryId === 'security';
    }
    // Default: revenue first for admin/super_admin
    return categoryId === 'revenue';
  }, [prefsLoading, categoryOrder, getCategoryOpenState, adminRole]);

  // Get ordered categories based on role
  const getOrderedCategories = useCallback(() => {
    const defaultOrder = ['revenue', 'patient-care', 'clinical', 'security', 'admin'];

    if (!prefsLoading && categoryOrder.length > 0) {
      // Use saved preferences
      return categoryOrder.map(c => c.categoryId);
    }

    // Role-based defaults
    switch (adminRole) {
      case 'nurse':
      case 'physician':
      case 'doctor':
      case 'case_manager':
      case 'social_worker':
        return ['patient-care', 'clinical', 'revenue', 'security', 'admin'];

      case 'billing_specialist':
        return ['revenue', 'patient-care', 'clinical', 'admin', 'security'];

      case 'it_admin':
        return ['security', 'admin', 'patient-care', 'clinical', 'revenue'];

      default:
        return defaultOrder;
    }
  }, [prefsLoading, categoryOrder, adminRole]);

  // Category components map
  const categoryComponents: Record<string, React.ReactNode> = {
    revenue: (
      <div
        key="revenue"
        ref={(el) => { categoryRefs.current['revenue'] = el; }}
        data-category-id="revenue"
      >
        <Suspense fallback={<CategoryLoadingFallback />}>
          <RevenueBillingCategory
            userRole={adminRole || 'admin'}
            defaultOpen={getCategoryOpenStateForRole('revenue')}
          />
        </Suspense>
      </div>
    ),
    'patient-care': (
      <div
        key="patient-care"
        ref={(el) => { categoryRefs.current['patient-care'] = el; }}
        data-category-id="patient-care"
      >
        <Suspense fallback={<CategoryLoadingFallback />}>
          <PatientCareCategory
            userRole={adminRole || 'admin'}
            defaultOpen={getCategoryOpenStateForRole('patient-care')}
          />
        </Suspense>
      </div>
    ),
    clinical: (
      <div
        key="clinical"
        ref={(el) => { categoryRefs.current['clinical'] = el; }}
        data-category-id="clinical"
      >
        <Suspense fallback={<CategoryLoadingFallback />}>
          <ClinicalDataCategory
            userRole={adminRole || 'admin'}
            defaultOpen={getCategoryOpenStateForRole('clinical')}
          />
        </Suspense>
      </div>
    ),
    security: (
      <div
        key="security"
        ref={(el) => { categoryRefs.current['security'] = el; }}
        data-category-id="security"
      >
        <Suspense fallback={<CategoryLoadingFallback />}>
          <SecurityComplianceCategory
            userRole={adminRole || 'admin'}
            defaultOpen={getCategoryOpenStateForRole('security')}
          />
        </Suspense>
      </div>
    ),
    admin: (
      <div
        key="admin"
        ref={(el) => { categoryRefs.current['admin'] = el; }}
        data-category-id="admin"
      >
        <Suspense fallback={<CategoryLoadingFallback />}>
          <SystemAdminCategory
            userRole={adminRole || 'admin'}
            defaultOpen={getCategoryOpenStateForRole('admin')}
          />
        </Suspense>
      </div>
    ),
  };

  // NOTE: Section definitions moved to sections/sectionDefinitions.tsx for code splitting
  // Categories are now lazy-loaded independently

  // Helper function to add learning events
  const addLearningEvent = useCallback((event: Omit<LearningEvent, 'timestamp'> & { timestamp: Date }) => {
    setLearningEvents(prev => [...prev, event].slice(-10)); // Keep last 10 events
  }, []);

  // Check for learning milestones
  const checkMilestones = (profile: UserBehaviorProfile) => {
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
  };

  // Handle suggestion click - Extract section/category from suggestion and navigate
  const handleSuggestionClick = useCallback((suggestion: string) => {
    // Normalize the suggestion text
    const normalized = suggestion.toLowerCase();

    // Map of known section/category names to their IDs and types
    const sectionMap: Record<string, { id: string; type: 'section' | 'category' | 'route' }> = {
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

    // Find matching section/category/route
    let matched: { id: string; type: 'section' | 'category' | 'route' } | null = null;

    for (const [keyword, target] of Object.entries(sectionMap)) {
      if (normalized.includes(keyword)) {
        matched = target;
        break;
      }
    }

    if (matched) {
      if (matched.type === 'route') {
        // Navigate to route
        navigate(matched.id);
        addLearningEvent({
          type: 'suggestion_generated',
          message: `Navigated to ${matched.id}`,
          timestamp: new Date()
        });
      } else if (matched.type === 'category') {
        // Scroll to category and expand it
        handleOpenCategory(matched.id);
        addLearningEvent({
          type: 'suggestion_generated',
          message: `Opened ${matched.id} category`,
          timestamp: new Date()
        });
      } else {
        // Scroll to section
        handleScrollToSection(matched.id);
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

      // If nothing matched, show a subtle notification
      addLearningEvent({
        type: 'suggestion_generated',
        message: 'Suggestion noted - exploring...',
        timestamp: new Date()
      });
    }
  }, [navigate, handleOpenCategory, handleScrollToSection, addLearningEvent]);

  // Load personalized layout on mount
  useEffect(() => {
    loadPersonalizedDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, adminRole]);

  // Auto-show What's New modal
  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('whatsNew_lastSeen');
    const permanentlyDismissed = localStorage.getItem('whatsNew_permanentlyDismissed');
    const currentVersion = '2025-10-19'; // Update with new features

    // Don't show if permanently dismissed OR if already seen this version
    if (permanentlyDismissed === 'true') {
      auditLogger.debug('[WhatsNew] Modal permanently dismissed by user');
      return;
    }

    if (lastSeenVersion !== currentVersion) {
      auditLogger.debug('[WhatsNew] Showing modal for version', { version: currentVersion });
      setTimeout(() => setShowWhatsNew(true), 1000);
    }
  }, []);

  async function loadPersonalizedDashboard() {
    if (!user?.id) {
      // No user yet - set loading false to prevent infinite loading state
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Get user behavior profile
      const profile = await getUserBehaviorProfile(supabase, user.id);
      setBehaviorProfile(profile);

      // Add learning event
      addLearningEvent({
        type: 'pattern_detected',
        message: profile ? 'Loaded your personalized dashboard' : 'Starting to learn your patterns',
        timestamp: new Date()
      });

      // Get AI-powered personalized layout
      const layout = await DashboardPersonalizationAI.generatePersonalizedLayout(
        user.id,
        adminRole || 'admin',
        new Date().getHours()
      );

      // Get behavior-based suggestions
      const behaviorBasedSuggestions = getSmartSuggestions(profile);

      // Merge AI suggestions with behavior suggestions
      const combinedSuggestions = [
        ...(layout.suggestions || []),
        ...behaviorBasedSuggestions
      ].slice(0, 5); // Limit to 5 total

      // Set AI suggestions
      setAiSuggestions(combinedSuggestions);

      // Check for milestones
      if (profile) {
        checkMilestones(profile);
      }

      // Track dashboard view
      if (user.id) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();

        await trackBehaviorEvent(supabase, {
          userId: user.id,
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
      // HIPAA Audit: Log dashboard personalization failure
      await auditLogger.error('ADMIN_DASHBOARD_PERSONALIZATION_FAILED', error instanceof Error ? error : new Error('Unknown error'), {
        userId: user?.id,
        adminRole: adminRole || 'admin'
      });
      // Category components will still load with default settings
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">🧠</div>
            <p className="text-lg text-gray-600">Personalizing your dashboard with AI...</p>
          </div>
        </div>
      </RequireAdminAuth>
    );
  }

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="🎯 Mission Control" showRiskAssessment={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Personalized Greeting with Role-Specific Stats */}
          <PersonalizedGreeting />

          {/* Smart Suggestions - Actionable and Responsive */}
          {aiSuggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900">Smart Suggestions</h3>
                <span className="text-xs text-gray-500">Based on your patterns</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiSuggestions.slice(0, 4).map((suggestion, i) => (
                  <SmartSuggestionCard
                    key={i}
                    suggestion={suggestion}
                    actionLabel="Go there"
                    onAction={() => handleSuggestionClick(suggestion)}
                    icon={i === 0 ? <TrendingUp className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  />
                ))}
              </div>
            </div>
          )}

          {/* What's New Modal */}
          <WhatsNewModal isOpen={showWhatsNew} onClose={() => setShowWhatsNew(false)} />

          {/* Quick Actions Bar */}
          <div className="bg-linear-to-r from-indigo-600 to-blue-700 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-xl font-bold">Quick Actions</h2>
              <button
                onClick={() => setShowWhatsNew(true)}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <span>✨</span>
                <span>What's New</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <button
                onClick={() => navigate('/admin/enroll-senior')}
                className="bg-white text-emerald-700 px-6 py-4 rounded-lg font-semibold hover:bg-emerald-50 transition-colors shadow-md flex items-center justify-center"
              >
                <span className="mr-2 text-2xl">➕</span>
                Enroll Senior
              </button>
              <button
                onClick={() => navigate('/admin/bulk-enroll')}
                className="bg-white text-blue-700 px-6 py-4 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-md flex items-center justify-center"
              >
                <span className="mr-2 text-2xl">👥</span>
                Bulk Enroll
              </button>
              <button
                onClick={() => navigate('/admin/bulk-export')}
                className="bg-white text-indigo-700 px-6 py-4 rounded-lg font-semibold hover:bg-indigo-50 transition-colors shadow-md flex items-center justify-center"
              >
                <span className="mr-2 text-2xl">📤</span>
                Bulk Export
              </button>
              <button
                onClick={() => navigate('/admin/photo-approval')}
                className="bg-white text-yellow-700 px-6 py-4 rounded-lg font-semibold hover:bg-yellow-50 transition-colors shadow-md flex items-center justify-center"
              >
                <span className="mr-2 text-2xl">📸</span>
                Approve Photos
              </button>
              <button
                onClick={() => navigate('/admin-questions')}
                className="bg-white text-purple-700 px-6 py-4 rounded-lg font-semibold hover:bg-purple-50 transition-colors shadow-md flex items-center justify-center"
              >
                <span className="mr-2 text-2xl">💬</span>
                Questions
              </button>
              <button
                onClick={() => navigate('/admin-profile-editor')}
                className="bg-white text-green-700 px-6 py-4 rounded-lg font-semibold hover:bg-green-50 transition-colors shadow-md flex items-center justify-center"
              >
                <span className="mr-2 text-2xl">✏️</span>
                Edit Profiles
              </button>
            </div>
          </div>

{/* Envision Master Panel removed - access via /envision/login only */}

          {/* Role Panel Navigation - Super Admin Only */}
          {adminRole === 'super_admin' && (
            <div className="bg-linear-to-r from-teal-600 to-cyan-700 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-xl font-bold">🏥 View Role Dashboards</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate('/physician-dashboard')}
                  className="bg-white text-blue-800 px-6 py-4 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-md flex items-center justify-center"
                >
                  <span className="mr-2 text-2xl">👨‍⚕️</span>
                  Physician Panel
                </button>
                <button
                  onClick={() => navigate('/nurse-dashboard')}
                  className="bg-white text-pink-700 px-6 py-4 rounded-lg font-semibold hover:bg-pink-50 transition-colors shadow-md flex items-center justify-center"
                >
                  <span className="mr-2 text-2xl">👩‍⚕️</span>
                  Nurse Panel
                </button>
                <button
                  onClick={() => navigate('/caregiver-dashboard')}
                  className="bg-white text-purple-700 px-6 py-4 rounded-lg font-semibold hover:bg-purple-50 transition-colors shadow-md flex items-center justify-center"
                >
                  <span className="mr-2 text-2xl">🤝</span>
                  Caregiver View
                </button>
              </div>
            </div>
          )}

          {/* Lazy-Loaded Category Sections - Ordered by Role Preferences */}
          <div className="space-y-6">
            {getOrderedCategories().map(categoryId => categoryComponents[categoryId])}
          </div>
        </div>

        {/* Voice handled by ClinicalModeComponents (GlobalSearchBar + VoiceCommandButton) */}

        {/* Learning Indicator - Real-time feedback */}
        {!isLoading && behaviorProfile && (
          <LearningIndicator
            events={learningEvents}
            learningScore={Math.min(100, (behaviorProfile.totalSessions || 0) * 2)}
            totalInteractions={behaviorProfile.totalSessions || 0}
          />
        )}

        {/* Milestone Celebration */}
        <MilestoneCelebration
          milestone={milestone}
          show={showMilestone}
          onClose={() => setShowMilestone(false)}
        />
      </div>
    </RequireAdminAuth>
  );
};

export default IntelligentAdminPanel;
