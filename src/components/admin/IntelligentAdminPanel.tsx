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

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useUser } from '../../contexts/AuthContext';
import { DashboardPersonalizationAI } from '../../services/dashboardPersonalizationAI';
import { AdaptiveCollapsibleSection } from './AdaptiveCollapsibleSection';
import RequireAdminAuth from 'components/auth/RequireAdminAuth';
import AdminHeader from './AdminHeader';
import WhatsNewModal from './WhatsNewModal';

// Import all dashboard components
import UsersList from './UsersList';
import ReportsSection from './ReportsSection';
import ExportCheckIns from './ExportCheckIns';
import ClaudeTestWidget from './ClaudeTestWidget';
import FhirAiDashboard from './FhirAiDashboard';
import FHIRFormBuilderEnhanced from './FHIRFormBuilderEnhanced';
import FHIRDataMapper from './FHIRDataMapper';
import BillingDashboard from './BillingDashboard';
import ApiKeyManager from './ApiKeyManager';
import SmartScribe from '../smart/RealTimeSmartScribe';
import SDOHCoderAssist from '../billing/SDOHCoderAssist';
import CCMTimeline from '../atlas/CCMTimeline';
import RevenueDashboard from '../atlas/RevenueDashboard';
import ClaimsSubmissionPanel from '../atlas/ClaimsSubmissionPanel';
import ClaimsAppealsPanel from '../atlas/ClaimsAppealsPanel';
import AdminTransferLogs from '../handoff/AdminTransferLogs';
import PatientEngagementDashboard from './PatientEngagementDashboard';
import { SOC2SecurityDashboard } from './SOC2SecurityDashboard';
import { SOC2AuditDashboard } from './SOC2AuditDashboard';
import { SOC2IncidentResponseDashboard } from './SOC2IncidentResponseDashboard';
import { SOC2ExecutiveDashboard } from './SOC2ExecutiveDashboard';

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

const IntelligentAdminPanel: React.FC = () => {
  const { adminRole } = useAdminAuth();
  const user = useUser();
  const navigate = useNavigate();
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sections, setSections] = useState<DashboardSection[]>([]);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  // Define all available sections
  const allSections: DashboardSection[] = [
    // REVENUE & BILLING (Category 1)
    {
      id: 'smartscribe-atlas',
      title: 'SmartScribe Atlas 💰',
      subtitle: 'AI transcription with Claude Sonnet 4.5 for maximum billing accuracy',
      icon: '🎤',
      headerColor: 'text-purple-800',
      component: <SmartScribe />,
      category: 'revenue',
      priority: 'high',
    },
    {
      id: 'revenue-dashboard',
      title: 'Revenue Dashboard',
      subtitle: 'Real-time revenue analytics and optimization opportunities',
      icon: '💰',
      headerColor: 'text-green-800',
      component: <RevenueDashboard />,
      category: 'revenue',
      priority: 'high',
    },
    {
      id: 'ccm-autopilot',
      title: 'CCM Autopilot',
      subtitle: 'Automatic tracking of 20+ minute patient interactions for CCM billing',
      icon: '⏱️',
      headerColor: 'text-purple-800',
      component: <CCMTimeline />,
      category: 'revenue',
      priority: 'medium',
    },
    {
      id: 'claims-submission',
      title: 'Claims Submission Center',
      subtitle: 'Generate and submit 837P claims to clearinghouses',
      icon: '📋',
      headerColor: 'text-blue-800',
      component: <ClaimsSubmissionPanel />,
      category: 'revenue',
      priority: 'medium',
    },
    {
      id: 'claims-appeals',
      title: 'Claims Appeals & Resubmission',
      subtitle: 'AI-assisted appeal letters for denied claims',
      icon: '🔄',
      headerColor: 'text-red-800',
      component: <ClaimsAppealsPanel />,
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
        <SDOHCoderAssist
          encounterId="demo-encounter-id"
          patientId="demo-patient-id"
          onSaved={(data) => console.log('Coding saved:', data)}
        />
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
      component: <BillingDashboard />,
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
      component: <PatientEngagementDashboard />,
      category: 'patient-care',
      priority: 'high',
    },
    {
      id: 'patient-handoff',
      title: 'Patient Handoff System',
      subtitle: 'Secure transfer of care between facilities - HIPAA compliant',
      icon: '🏥',
      headerColor: 'text-teal-800',
      component: <AdminTransferLogs showExportButton={true} />,
      category: 'patient-care',
      priority: 'medium',
    },
    {
      id: 'user-management',
      title: 'User Management',
      subtitle: 'Manage patient and staff accounts',
      icon: '👥',
      headerColor: 'text-gray-800',
      component: <UsersList />,
      category: 'patient-care',
      priority: 'medium',
    },

    // CLINICAL DATA (Category 3)
    {
      id: 'fhir-analytics',
      title: 'AI-Enhanced FHIR Analytics',
      subtitle: 'Real-time patient insights and clinical decision support',
      icon: '🧠',
      headerColor: 'text-purple-800',
      component: (
        <FhirAiDashboard
          supabaseUrl={process.env.REACT_APP_SUPABASE_URL || ''}
          supabaseKey={process.env.REACT_APP_SUPABASE_ANON_KEY || ''}
        />
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
      component: <FHIRFormBuilderEnhanced />,
      category: 'clinical',
      priority: 'low',
    },
    {
      id: 'fhir-mapper',
      title: 'FHIR Data Mapper',
      subtitle: 'Transform legacy data into FHIR-compliant formats',
      icon: '🔄',
      headerColor: 'text-teal-800',
      component: <FHIRDataMapper />,
      category: 'clinical',
      priority: 'low',
    },
    {
      id: 'reports-analytics',
      title: 'Reports & Analytics',
      subtitle: 'System-wide analytics and insights',
      icon: '📊',
      headerColor: 'text-gray-800',
      component: <ReportsSection />,
      category: 'clinical',
      priority: 'low',
    },

    // SECURITY & COMPLIANCE (Category 4)
    {
      id: 'soc2-executive',
      title: 'SOC 2 Executive Summary',
      subtitle: 'High-level security posture and compliance overview',
      icon: '📊',
      headerColor: 'text-blue-900',
      component: <SOC2ExecutiveDashboard />,
      category: 'security',
      priority: 'low',
      roles: ['admin', 'super_admin'],
    },
    {
      id: 'security-ops',
      title: 'Security Operations Center',
      subtitle: 'Real-time security monitoring and threat detection',
      icon: '🛡️',
      headerColor: 'text-red-900',
      component: <SOC2SecurityDashboard />,
      category: 'security',
      priority: 'low',
      roles: ['admin', 'super_admin'],
    },
    {
      id: 'audit-compliance',
      title: 'Audit & Compliance Center',
      subtitle: 'PHI access logs and SOC 2 compliance status',
      icon: '📋',
      headerColor: 'text-indigo-900',
      component: <SOC2AuditDashboard />,
      category: 'security',
      priority: 'low',
      roles: ['admin', 'super_admin'],
    },
    {
      id: 'incident-response',
      title: 'Incident Response Center',
      subtitle: 'Security incident investigation queue with SLA tracking',
      icon: '🚨',
      headerColor: 'text-orange-900',
      component: <SOC2IncidentResponseDashboard />,
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
      component: <ExportCheckIns />,
      category: 'admin',
      priority: 'low',
    },
  ];

  // Add super admin sections dynamically
  if (adminRole === 'super_admin') {
    allSections.push(
      {
        id: 'super-admin',
        title: 'Super Admin Features',
        subtitle: 'Advanced system administration and AI testing',
        icon: '🔐',
        headerColor: 'text-blue-800',
        component: (
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-green-700 mb-4 flex items-center">
              <span className="mr-2">🧠</span>
              Claude AI Service Test
            </h3>
            <p className="text-green-600 text-sm mb-4">Test and validate AI service integration</p>
            <ClaudeTestWidget />
          </div>
        ),
        category: 'admin',
        priority: 'low',
        roles: ['super_admin'],
      },
      {
        id: 'api-keys',
        title: 'API Key Manager',
        subtitle: 'Generate and manage API keys for system integrations',
        icon: '🔑',
        headerColor: 'text-yellow-800',
        component: <ApiKeyManager />,
        category: 'admin',
        priority: 'low',
        roles: ['super_admin'],
      }
    );
  }

  // Load personalized layout on mount
  useEffect(() => {
    loadPersonalizedDashboard();
  }, [user?.id, adminRole]);

  // Auto-show What's New modal
  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('whatsNew_lastSeen');
    const currentVersion = '2025-10-19'; // Update with new features

    if (lastSeenVersion !== currentVersion) {
      setTimeout(() => setShowWhatsNew(true), 1000);
    }
  }, []);

  async function loadPersonalizedDashboard() {
    if (!user?.id) return;

    setIsLoading(true);

    try {
      // Get AI-powered personalized layout
      const layout = await DashboardPersonalizationAI.generatePersonalizedLayout(
        user.id,
        adminRole || 'admin',
        new Date().getHours()
      );

      // Set welcome message and suggestions
      setWelcomeMessage(layout.welcomeMessage || '');
      setAiSuggestions(layout.suggestions || []);

      // Organize sections based on AI recommendations
      const organizedSections = organizeSections(layout);
      setSections(organizedSections);
    } catch (error) {
      console.error('Failed to load personalized dashboard:', error);
      // Fallback to default layout
      setSections(getDefaultSections());
    } finally {
      setIsLoading(false);
    }
  }

  function organizeSections(layout: any): DashboardSection[] {
    // Filter sections by role
    let visibleSections = allSections.filter(
      (section) => !section.roles || section.roles.includes(adminRole || 'admin')
    );

    // Sort by:
    // 1. User's top sections (from AI)
    // 2. Priority (high > medium > low)
    // 3. Category order (revenue > patient-care > clinical > security > admin)

    const categoryOrder = { revenue: 1, 'patient-care': 2, clinical: 3, security: 4, admin: 5 };
    const priorityOrder = { high: 1, medium: 2, low: 3 };

    return visibleSections.sort((a, b) => {
      // Check if in top sections
      const aInTop = layout.topSections?.includes(a.id);
      const bInTop = layout.topSections?.includes(b.id);

      if (aInTop && !bInTop) return -1;
      if (!aInTop && bInTop) return 1;

      // Then by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by category
      return categoryOrder[a.category] - categoryOrder[b.category];
    });
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
        <AdminHeader title="Cutting Edge Admin Dashboard" showRiskAssessment={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Personalized Greeting */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <h1 className="text-2xl font-bold mb-2">{welcomeMessage || 'Welcome to your dashboard!'}</h1>
            {aiSuggestions.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm opacity-90 font-medium">🧠 AI Insights:</p>
                {aiSuggestions.map((suggestion, i) => (
                  <p key={i} className="text-sm opacity-90">• {suggestion}</p>
                ))}
              </div>
            )}
          </div>

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

          {/* AI-Organized Sections */}
          <div className="space-y-6">
            {sections.map((section) => (
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
          </div>
        </div>
      </div>
    </RequireAdminAuth>
  );
};

export default IntelligentAdminPanel;
