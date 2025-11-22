/**
 * Intelligent Admin Panel
 *
 * AI-powered adaptive dashboard that learns each user's behavior and reorganizes itself
 * Uses Claude Haiku 4.5 for ultra-fast personalization predictions
 *
 * Features:
 * - Learns user patterns over time
 * - Auto-expands frequently used sections
 * - Reorders sections by usage frequency
 * - Time-of-day awareness
 * - Role-based defaults for new users
 * - Smart suggestions powered by AI
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useUser } from '../../contexts/AuthContext';
import { DashboardPersonalizationAI } from '../../services/dashboardPersonalizationAI';
import { auditLogger } from '../../services/auditLogger';
import { AdaptiveCollapsibleSection } from './AdaptiveCollapsibleSection';
import { CategoryCollapsibleGroup } from './CategoryCollapsibleGroup';
import RequireAdminAuth from 'components/auth/RequireAdminAuth';
import AdminHeader from './AdminHeader';
import WhatsNewModal from './WhatsNewModal';
import { PersonalizedGreeting } from '../ai-transparency';
import {
  getUserBehaviorProfile,
  trackBehaviorEvent,
  getSmartSuggestions,
  getRecommendedSectionOrder,
  UserBehaviorProfile
} from '../../services/behaviorTracking';
import { useSupabaseClient } from '../../contexts/AuthContext';
import {
  LearningIndicator,
  LearningEvent,
  SmartSuggestionCard,
  MilestoneCelebration,
  AnimatedSection
} from './LearningIndicator';
import { Clock, TrendingUp, Zap } from 'lucide-react';

// Lazy-load all dashboard components for code splitting
// This reduces the initial bundle size by ~20-30%
const UsersList = lazy(() => import('./UsersList'));
const ReportsSection = lazy(() => import('./ReportsSection'));
const ExportCheckIns = lazy(() => import('./ExportCheckIns'));
const FhirAiDashboard = lazy(() => import('./FhirAiDashboard'));
const FHIRFormBuilderEnhanced = lazy(() => import('./FHIRFormBuilderEnhanced'));
const FHIRDataMapper = lazy(() => import('./FHIRDataMapper'));
const BillingDashboard = lazy(() => import('./BillingDashboard'));
const SmartScribe = lazy(() => import('../smart/RealTimeSmartScribe'));
const SDOHCoderAssist = lazy(() => import('../billing/SDOHCoderAssist'));
const CCMTimeline = lazy(() => import('../atlas/CCMTimeline'));
const RevenueDashboard = lazy(() => import('../atlas/RevenueDashboard'));
const ClaimsSubmissionPanel = lazy(() => import('../atlas/ClaimsSubmissionPanel'));
const ClaimsAppealsPanel = lazy(() => import('../atlas/ClaimsAppealsPanel'));
const AdminTransferLogs = lazy(() => import('../handoff/AdminTransferLogs'));
const PatientEngagementDashboard = lazy(() => import('./PatientEngagementDashboard'));
const HospitalPatientEnrollment = lazy(() => import('./HospitalPatientEnrollment'));
const PaperFormScanner = lazy(() => import('./PaperFormScanner'));
const TenantSecurityDashboard = lazy(() => import('./TenantSecurityDashboard'));
const TenantAuditLogs = lazy(() => import('./TenantAuditLogs'));
const TenantComplianceReport = lazy(() => import('./TenantComplianceReport'));

interface DashboardSection {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  headerColor: string;
  component: React.ReactNode;
  category: 'revenue' | 'patient-care' | 'clinical' | 'security' | 'admin';
  priority: 'high' | 'medium' | 'low';
  defaultOpen?: boolean;
  roles?: string[]; // Which roles can see this section
}

// Loading fallback for lazy-loaded sections
const SectionLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    <span className="ml-3 text-gray-600">Loading section...</span>
  </div>
);

const IntelligentAdminPanel: React.FC = () => {
  const { adminRole } = useAdminAuth();
  const user = useUser();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sections, setSections] = useState<DashboardSection[]>([]);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [behaviorSuggestions, setBehaviorSuggestions] = useState<string[]>([]);
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
  const [behaviorProfile, setBehaviorProfile] = useState<UserBehaviorProfile | null>(null);
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestone, setMilestone] = useState('');
  const categoryOpenStates = {
    revenue: true,
    'patient-care': false,
    clinical: false,
    security: false,
    admin: false,
  };

  // Define all available sections
  const allSections: DashboardSection[] = [
    // REVENUE & BILLING (Category 1)
    {
      id: 'smartscribe-atlus',
      title: 'SmartScribe Atlus 💰',
      subtitle: 'AI transcription with Claude Sonnet 4.5 for maximum billing accuracy',
      icon: '🎤',
      headerColor: 'text-purple-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><SmartScribe /></Suspense>,
      category: 'revenue',
      priority: 'high',
    },
    {
      id: 'revenue-dashboard',
      title: 'Revenue Dashboard',
      subtitle: 'Real-time revenue analytics and optimization opportunities',
      icon: '💰',
      headerColor: 'text-green-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><RevenueDashboard /></Suspense>,
      category: 'revenue',
      priority: 'high',
    },
    {
      id: 'ccm-autopilot',
      title: 'CCM Autopilot',
      subtitle: 'Automatic tracking of 20+ minute patient interactions for CCM billing',
      icon: '⏱️',
      headerColor: 'text-purple-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><CCMTimeline /></Suspense>,
      category: 'revenue',
      priority: 'medium',
    },
    {
      id: 'claims-submission',
      title: 'Claims Submission Center',
      subtitle: 'Generate and submit 837P claims to clearinghouses',
      icon: '📋',
      headerColor: 'text-blue-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><ClaimsSubmissionPanel /></Suspense>,
      category: 'revenue',
      priority: 'medium',
    },
    {
      id: 'claims-appeals',
      title: 'Claims Appeals & Resubmission',
      subtitle: 'AI-assisted appeal letters for denied claims',
      icon: '🔄',
      headerColor: 'text-red-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><ClaimsAppealsPanel /></Suspense>,
      category: 'revenue',
      priority: 'medium',
    },
    {
      id: 'sdoh-billing',
      title: 'SDOH Billing Encoder',
      subtitle: 'Social determinants of health-aware medical coding',
      icon: '🏥',
      headerColor: 'text-indigo-800',
      component: (
        <Suspense fallback={<SectionLoadingFallback />}>
          <SDOHCoderAssist
            encounterId="demo-encounter-id"
            patientId="demo-patient-id"
            onSaved={(data) => auditLogger.debug('SDOH coding saved', data)}
          />
        </Suspense>
      ),
      category: 'revenue',
      priority: 'low',
    },
    {
      id: 'billing-dashboard',
      title: 'Billing & Claims Management',
      subtitle: 'Monitor claims processing and revenue tracking',
      icon: '💳',
      headerColor: 'text-green-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><BillingDashboard /></Suspense>,
      category: 'revenue',
      priority: 'medium',
    },

    // PATIENT CARE (Category 2)
    {
      id: 'patient-engagement',
      title: 'Patient Engagement & Risk Assessment',
      subtitle: 'Monitor senior activity levels to identify at-risk patients',
      icon: '📊',
      headerColor: 'text-indigo-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><PatientEngagementDashboard /></Suspense>,
      category: 'patient-care',
      priority: 'high',
    },
    {
      id: 'patient-handoff',
      title: 'Patient Handoff System',
      subtitle: 'Secure transfer of care between facilities - HIPAA compliant',
      icon: '🏥',
      headerColor: 'text-teal-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><AdminTransferLogs showExportButton={true} /></Suspense>,
      category: 'patient-care',
      priority: 'medium',
    },
    {
      id: 'user-management',
      title: 'User Management',
      subtitle: 'Manage patient and staff accounts',
      icon: '👥',
      headerColor: 'text-gray-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><UsersList /></Suspense>,
      category: 'patient-care',
      priority: 'medium',
    },
    {
      id: 'hospital-enrollment',
      title: 'Hospital Patient Enrollment',
      subtitle: 'Create test patients for backend testing (Physician/Nurse panels, handoffs, clinical workflows)',
      icon: '🏥',
      headerColor: 'text-blue-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><HospitalPatientEnrollment /></Suspense>,
      category: 'admin',
      priority: 'high',
      defaultOpen: false,
    },
    {
      id: 'paper-form-scanner',
      title: 'Paper Form Scanner (AI-Powered OCR)',
      subtitle: 'Upload photos of paper forms - AI extracts data automatically. Perfect for rural hospitals during outages. 50x faster than manual entry!',
      icon: '📸',
      headerColor: 'text-green-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><PaperFormScanner /></Suspense>,
      category: 'admin',
      priority: 'high',
      defaultOpen: false,
    },

    // CLINICAL DATA (Category 3)
    {
      id: 'fhir-analytics',
      title: 'AI-Enhanced FHIR Analytics',
      subtitle: 'Real-time patient insights and clinical decision support',
      icon: '🧠',
      headerColor: 'text-purple-800',
      component: (
        <Suspense fallback={<SectionLoadingFallback />}>
          <FhirAiDashboard
            supabaseUrl={process.env.REACT_APP_SUPABASE_URL || ''}
            supabaseKey={process.env.REACT_APP_SUPABASE_ANON_KEY || ''}
          />
        </Suspense>
      ),
      category: 'clinical',
      priority: 'medium',
    },
    {
      id: 'fhir-questionnaire',
      title: 'FHIR Questionnaire Builder',
      subtitle: 'Create standardized clinical questionnaires using AI',
      icon: '📝',
      headerColor: 'text-blue-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><FHIRFormBuilderEnhanced /></Suspense>,
      category: 'clinical',
      priority: 'low',
    },
    {
      id: 'fhir-mapper',
      title: 'FHIR Data Mapper',
      subtitle: 'Transform legacy data into FHIR-compliant formats',
      icon: '🔄',
      headerColor: 'text-teal-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><FHIRDataMapper /></Suspense>,
      category: 'clinical',
      priority: 'low',
    },
    {
      id: 'reports-analytics',
      title: 'Reports & Analytics',
      subtitle: 'System-wide analytics and insights',
      icon: '📊',
      headerColor: 'text-gray-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><ReportsSection /></Suspense>,
      category: 'clinical',
      priority: 'low',
    },

    // SECURITY & COMPLIANCE - TENANT SCOPED (Category 4)
    {
      id: 'tenant-security',
      title: 'Facility Security Dashboard',
      subtitle: 'Real-time security monitoring for your facility',
      icon: '🛡️',
      headerColor: 'text-red-900',
      component: <Suspense fallback={<SectionLoadingFallback />}><TenantSecurityDashboard /></Suspense>,
      category: 'security',
      priority: 'medium',
      roles: ['admin', 'super_admin'],
    },
    {
      id: 'tenant-audit-logs',
      title: 'Audit Logs',
      subtitle: 'PHI access logs and administrative actions for your facility',
      icon: '📋',
      headerColor: 'text-indigo-900',
      component: <Suspense fallback={<SectionLoadingFallback />}><TenantAuditLogs /></Suspense>,
      category: 'security',
      priority: 'medium',
      roles: ['admin', 'super_admin'],
    },
    {
      id: 'tenant-compliance',
      title: 'Compliance Report',
      subtitle: 'HIPAA and security compliance status for your facility',
      icon: '✅',
      headerColor: 'text-green-900',
      component: <Suspense fallback={<SectionLoadingFallback />}><TenantComplianceReport /></Suspense>,
      category: 'security',
      priority: 'low',
      roles: ['admin', 'super_admin'],
    },

    // ADMIN (Category 5)
    {
      id: 'data-export',
      title: 'Data Export & Advanced Tools',
      subtitle: 'Export data and access advanced administrative functions',
      icon: '📤',
      headerColor: 'text-gray-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><ExportCheckIns /></Suspense>,
      category: 'admin',
      priority: 'low',
    },
  ];

  // NOTE: Master-only components (ApiKeyManager, SOC2 dashboards, SystemAdmin)
  // are now ONLY in the Master Panel (/super-admin), not in tenant panels.
  // All tenants (including WellFit) use this same tenant-scoped admin panel.

  // Helper function to add learning events
  const addLearningEvent = (event: Omit<LearningEvent, 'timestamp'> & { timestamp: Date }) => {
    setLearningEvents(prev => [...prev, event].slice(-10)); // Keep last 10 events
  };

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

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    // Extract section ID from suggestion if possible
    const sectionMatch = suggestion.match(/work on ([\w-]+)/);
    if (sectionMatch) {
      const sectionId = sectionMatch[1].replace(/\s+/g, '-');
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        addLearningEvent({
          type: 'suggestion_generated',
          message: `Jumped to ${sectionId}`,
          timestamp: new Date()
        });
      }
    }
  };

  // Load personalized layout on mount
  useEffect(() => {
    loadPersonalizedDashboard();

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
    if (!user?.id) return;

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
      setBehaviorSuggestions(behaviorBasedSuggestions);

      // Merge AI suggestions with behavior suggestions
      const combinedSuggestions = [
        ...(layout.suggestions || []),
        ...behaviorBasedSuggestions
      ].slice(0, 5); // Limit to 5 total

      // Set welcome message and suggestions
      setWelcomeMessage(layout.welcomeMessage || '');
      setAiSuggestions(combinedSuggestions);

      // Organize sections based on both AI and behavior recommendations
      const organizedSections = organizeSections(layout, profile);
      setSections(organizedSections);

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
      // Fallback to default layout
      setSections(getDefaultSections());
    } finally {
      setIsLoading(false);
    }
  }

  function organizeSections(layout: any, behaviorProfile: any = null): DashboardSection[] {
    // Filter sections by role
    const visibleSections = allSections.filter(
      (section) => !section.roles || section.roles.includes(adminRole || 'admin')
    );

    // Get behavior-based recommended order
    const allSectionIds = allSections.map(s => s.id);
    const behaviorOrder = behaviorProfile
      ? getRecommendedSectionOrder(behaviorProfile, allSectionIds)
      : allSectionIds;

    // Sort within each category by:
    // 1. Behavior-based frequency (most used first)
    // 2. User's top sections (from AI)
    // 3. Priority (high > medium > low)

    const priorityOrder = { high: 1, medium: 2, low: 3 };

    return visibleSections.sort((a, b) => {
      // Keep same category together
      if (a.category !== b.category) {
        return 0; // Don't sort across categories
      }

      // Sort by behavior frequency
      const aBehaviorIndex = behaviorOrder.indexOf(a.id);
      const bBehaviorIndex = behaviorOrder.indexOf(b.id);
      if (aBehaviorIndex !== bBehaviorIndex) {
        return aBehaviorIndex - bBehaviorIndex;
      }

      // Check if in top sections
      const aInTop = layout.topSections?.includes(a.id);
      const bInTop = layout.topSections?.includes(b.id);

      if (aInTop && !bInTop) return -1;
      if (!aInTop && bInTop) return 1;

      // Then by priority
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // Group sections by category
  function groupSectionsByCategory(sections: DashboardSection[]) {
    const grouped: Record<string, DashboardSection[]> = {
      revenue: [],
      'patient-care': [],
      clinical: [],
      security: [],
      admin: [],
    };

    sections.forEach(section => {
      if (grouped[section.category]) {
        grouped[section.category].push(section);
      }
    });

    return grouped;
  }

  function getDefaultSections(): DashboardSection[] {
    return allSections.filter(
      (section) => !section.roles || section.roles.includes(adminRole || 'admin')
    );
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
          <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-xl shadow-lg p-6">
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

          {/* Envision Atlus Master Panel - Prominent Access */}
          {adminRole === 'super_admin' && (
            <div className="bg-gradient-to-br from-teal-700 via-cyan-600 to-blue-700 rounded-xl shadow-2xl p-8 mb-6 border-2 border-teal-400 relative overflow-hidden">
              {/* Animated Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-full h-full" style={{
                  backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                  backgroundSize: '30px 30px'
                }}></div>
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-white text-2xl font-bold flex items-center mb-2">
                      <span className="mr-3 text-3xl">🏛️</span>
                      Envision Atlus Master Panel
                    </h2>
                    <p className="text-teal-100 text-sm">Platform-wide administration, multi-tenant management & system controls</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                    <span className="text-white text-xs font-semibold">ENVISION ACCESS</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/super-admin')}
                  className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 px-8 py-5 rounded-lg font-bold text-lg hover:from-yellow-300 hover:to-orange-400 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center justify-center group"
                >
                  <span className="mr-3 text-2xl group-hover:scale-125 transition-transform">🔐</span>
                  <span>Open Master Panel with Vault Animation</span>
                  <span className="ml-3 text-2xl group-hover:translate-x-2 transition-transform">→</span>
                </button>

                <div className="grid grid-cols-4 gap-3 mt-4 text-center">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="text-white text-xs font-semibold mb-1">All Tenants</div>
                    <div className="text-teal-200 text-sm">✓</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="text-white text-xs font-semibold mb-1">Feature Flags</div>
                    <div className="text-teal-200 text-sm">✓</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="text-white text-xs font-semibold mb-1">SOC2 Monitor</div>
                    <div className="text-teal-200 text-sm">✓</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="text-white text-xs font-semibold mb-1">Guardian Activity</div>
                    <div className="text-teal-200 text-sm">✓</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Role Panel Navigation - Super Admin Only */}
          {adminRole === 'super_admin' && (
            <div className="bg-gradient-to-r from-teal-600 to-cyan-700 rounded-xl shadow-lg p-6">
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

          {/* AI-Organized Sections - Grouped by Category */}
          <div className="space-y-6">
            {(() => {
              const groupedSections = groupSectionsByCategory(sections);

              return (
                <>
                  {/* REVENUE & BILLING OPERATIONS */}
                  {groupedSections.revenue.length > 0 && (
                    <CategoryCollapsibleGroup
                      categoryId="revenue"
                      title="Revenue & Billing Operations"
                      icon="💰"
                      headerColor="text-green-800"
                      defaultOpen={categoryOpenStates.revenue}
                      userRole={adminRole || 'admin'}
                    >
                      {groupedSections.revenue.map((section, index) => (
                        <AnimatedSection key={section.id} sectionId={section.id} index={index}>
                          <AdaptiveCollapsibleSection
                            sectionId={section.id}
                            title={section.title}
                            subtitle={section.subtitle}
                            icon={section.icon}
                            headerColor={section.headerColor}
                            userRole={adminRole || 'admin'}
                            priority={section.priority}
                            defaultOpen={section.defaultOpen}
                          >
                            {section.component}
                          </AdaptiveCollapsibleSection>
                        </AnimatedSection>
                      ))}
                    </CategoryCollapsibleGroup>
                  )}

                  {/* PATIENT CARE & ENGAGEMENT */}
                  {groupedSections['patient-care'].length > 0 && (
                    <CategoryCollapsibleGroup
                      categoryId="patient-care"
                      title="Patient Care & Engagement"
                      icon="🏥"
                      headerColor="text-blue-800"
                      defaultOpen={categoryOpenStates['patient-care']}
                      userRole={adminRole || 'admin'}
                    >
                      {groupedSections['patient-care'].map((section, index) => (
                        <AnimatedSection key={section.id} sectionId={section.id} index={index}>
                          <AdaptiveCollapsibleSection
                            sectionId={section.id}
                            title={section.title}
                            subtitle={section.subtitle}
                            icon={section.icon}
                            headerColor={section.headerColor}
                            userRole={adminRole || 'admin'}
                            priority={section.priority}
                            defaultOpen={section.defaultOpen}
                          >
                            {section.component}
                          </AdaptiveCollapsibleSection>
                        </AnimatedSection>
                      ))}
                    </CategoryCollapsibleGroup>
                  )}

                  {/* CLINICAL DATA & FHIR */}
                  {groupedSections.clinical.length > 0 && (
                    <CategoryCollapsibleGroup
                      categoryId="clinical"
                      title="Clinical Data & FHIR"
                      icon="🧬"
                      headerColor="text-purple-800"
                      defaultOpen={categoryOpenStates.clinical}
                      userRole={adminRole || 'admin'}
                    >
                      {groupedSections.clinical.map((section) => (
                        <AdaptiveCollapsibleSection
                          key={section.id}
                          sectionId={section.id}
                          title={section.title}
                          subtitle={section.subtitle}
                          icon={section.icon}
                          headerColor={section.headerColor}
                          userRole={adminRole || 'admin'}
                          priority={section.priority}
                          defaultOpen={section.defaultOpen}
                        >
                          {section.component}
                        </AdaptiveCollapsibleSection>
                      ))}
                    </CategoryCollapsibleGroup>
                  )}

                  {/* SECURITY & COMPLIANCE */}
                  {groupedSections.security.length > 0 && (
                    <CategoryCollapsibleGroup
                      categoryId="security"
                      title="Security & Compliance"
                      icon="🛡️"
                      headerColor="text-red-800"
                      defaultOpen={categoryOpenStates.security}
                      userRole={adminRole || 'admin'}
                    >
                      {groupedSections.security.map((section) => (
                        <AdaptiveCollapsibleSection
                          key={section.id}
                          sectionId={section.id}
                          title={section.title}
                          subtitle={section.subtitle}
                          icon={section.icon}
                          headerColor={section.headerColor}
                          userRole={adminRole || 'admin'}
                          priority={section.priority}
                          defaultOpen={section.defaultOpen}
                        >
                          {section.component}
                        </AdaptiveCollapsibleSection>
                      ))}
                    </CategoryCollapsibleGroup>
                  )}

                  {/* SYSTEM ADMINISTRATION */}
                  {groupedSections.admin.length > 0 && (
                    <CategoryCollapsibleGroup
                      categoryId="admin"
                      title="System Administration"
                      icon="⚙️"
                      headerColor="text-gray-800"
                      defaultOpen={categoryOpenStates.admin}
                      userRole={adminRole || 'admin'}
                    >
                      {groupedSections.admin.map((section) => (
                        <AdaptiveCollapsibleSection
                          key={section.id}
                          sectionId={section.id}
                          title={section.title}
                          subtitle={section.subtitle}
                          icon={section.icon}
                          headerColor={section.headerColor}
                          userRole={adminRole || 'admin'}
                          priority={section.priority}
                          defaultOpen={section.defaultOpen}
                        >
                          {section.component}
                        </AdaptiveCollapsibleSection>
                      ))}
                    </CategoryCollapsibleGroup>
                  )}
                </>
              );
            })()}
          </div>
        </div>

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
