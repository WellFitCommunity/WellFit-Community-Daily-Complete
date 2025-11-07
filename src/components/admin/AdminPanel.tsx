import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useUser, useSupabaseClient } from '../../contexts/AuthContext';
import RequireAdminAuth from 'components/auth/RequireAdminAuth';
import AdminHeader from './AdminHeader';
import WhatsNewModal from './WhatsNewModal';
import { auditLogger } from '../../services/auditLogger';
// Optimized imports for tree-shaking (saves ~20KB, removed 3 unused)
import Users from 'lucide-react/dist/esm/icons/users';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Activity from 'lucide-react/dist/esm/icons/activity';
import Clock from 'lucide-react/dist/esm/icons/clock';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Search from 'lucide-react/dist/esm/icons/search';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Zap from 'lucide-react/dist/esm/icons/zap';
import HeartPulse from 'lucide-react/dist/esm/icons/heart-pulse';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Database from 'lucide-react/dist/esm/icons/database';

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
import PersonalizedGreeting from '../shared/PersonalizedGreeting';
import { SOC2SecurityDashboard } from './SOC2SecurityDashboard';
import { SOC2AuditDashboard } from './SOC2AuditDashboard';
import { SOC2IncidentResponseDashboard } from './SOC2IncidentResponseDashboard';
import { SOC2ExecutiveDashboard } from './SOC2ExecutiveDashboard';
import { SystemAdminDashboard } from './SystemAdminDashboard';
import HospitalAdapterManagementPanel from './HospitalAdapterManagementPanel';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface DashboardMetrics {
  totalPatients: number;
  activePatients: number;
  todayRevenue: number;
  pendingTasks: number;
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
  securityScore: number;
  activeUsers: number;
  pendingClaims: number;
}

type TabKey = 'overview' | 'clinical' | 'billing' | 'security' | 'admin';

// ============================================================================
// DASHBOARD METRIC CARD COMPONENT
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; isPositive: boolean };
  color: string;
  badge?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend, color, badge }) => {
  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 border-2 border-black hover:border-[#1BA39C] transition-all hover:scale-105 hover:shadow-2xl`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-3 rounded-lg ${color} border-2 border-black shadow-md`}>
          {icon}
        </div>
        {badge && (
          <span className="px-2 py-1 bg-[#C8E63D] text-black text-xs font-bold rounded-full border border-black">
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wide mb-1">{title}</h3>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold text-black">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 text-sm font-bold ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`w-4 h-4 ${trend.isPositive ? '' : 'rotate-180'}`} />
            <span>{trend.value}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  headerColor?: string;
  badge?: string | number;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  icon,
  children,
  defaultOpen = false,
  headerColor = 'text-gray-800',
  badge
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="bg-white rounded-xl shadow-lg border border-black overflow-hidden hover:border-2 hover:border-[#1BA39C] transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-[#E8F8F7] hover:bg-[#D1F2F0] transition-all border-b border-black"
      >
        <div className="flex items-center flex-1 gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="text-left">
            <h2 className={`text-xl font-semibold ${headerColor} flex items-center gap-2`}>
              {title}
              {badge !== undefined && (
                <span className="px-2 py-1 text-xs font-bold rounded-full bg-[#C8E63D] text-black border border-black">
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
        <div className="p-6 bg-white border-t border-black">
          {children}
        </div>
      )}
    </section>
  );
};

const AdminPanel: React.FC = () => {
  const { adminRole } = useAdminAuth();
  const user = useUser();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalPatients: 0,
    activePatients: 0,
    todayRevenue: 0,
    pendingTasks: 0,
    systemHealth: 'good',
    securityScore: 0,
    activeUsers: 0,
    pendingClaims: 0
  });
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Load dashboard metrics
  const loadMetrics = useCallback(async () => {
    try {
      setMetricsLoading(true);

      // Get patient counts
      const { count: totalPatients } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .or('role.eq.senior,role.eq.patient');

      // Get today's check-ins (proxy for active patients)
      const today = new Date().toISOString().split('T')[0];
      const { count: activePatients } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`);

      // Get pending claims count
      const { count: pendingClaims } = await supabase
        .from('billing_claims')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'submitted']);

      // Get security events for score calculation
      const { count: securityEvents } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      // Calculate security score (100 minus events, min 0)
      const securityScore = Math.max(0, 100 - (securityEvents || 0));

      // Determine system health based on metrics
      let systemHealth: 'excellent' | 'good' | 'warning' | 'critical' = 'excellent';
      if (securityScore < 70) systemHealth = 'warning';
      if (securityScore < 50) systemHealth = 'critical';

      setMetrics({
        totalPatients: totalPatients || 0,
        activePatients: activePatients || 0,
        todayRevenue: 0, // Will be calculated from billing data
        pendingTasks: (pendingClaims || 0),
        systemHealth,
        securityScore,
        activeUsers: (activePatients || 0),
        pendingClaims: pendingClaims || 0
      });
    } catch (error) {

    } finally {
      setMetricsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    // Auto-show What's New modal if user hasn't seen latest updates
    const lastSeenVersion = localStorage.getItem('whatsNew_lastSeen');
    const permanentlyDismissed = localStorage.getItem('whatsNew_permanentlyDismissed');
    const currentVersion = '2025-10-27'; // Update this when adding new features

    // Don't show if permanently dismissed
    if (permanentlyDismissed === 'true') {

      return;
    }

    if (lastSeenVersion !== currentVersion) {
      // Show after a short delay for better UX

      setTimeout(() => setShowWhatsNew(true), 1000);
    }
  }, []);

  // Tab configuration
  const tabs = [
    { key: 'overview' as TabKey, label: 'Overview', icon: <BarChart3 className="w-5 h-5" /> },
    { key: 'clinical' as TabKey, label: 'Clinical', icon: <HeartPulse className="w-5 h-5" /> },
    { key: 'billing' as TabKey, label: 'Billing & Revenue', icon: <DollarSign className="w-5 h-5" /> },
    { key: 'security' as TabKey, label: 'Security & Compliance', icon: <Shield className="w-5 h-5" /> },
    { key: 'admin' as TabKey, label: 'Administration', icon: <Database className="w-5 h-5" /> }
  ];

  // System health indicator color
  const healthColors = {
    excellent: 'bg-green-500',
    good: 'bg-blue-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500'
  };

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
      <div className="min-h-screen bg-[#E8F8F7]">
        <AdminHeader title="Envision Atlus - Admin Dashboard" showRiskAssessment={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* Personalized Greeting */}
          <PersonalizedGreeting
            userName={user?.email || user?.user_metadata?.full_name}
            userRole="admin"
          />

          {/* What's New Modal */}
          <WhatsNewModal isOpen={showWhatsNew} onClose={() => setShowWhatsNew(false)} />

          {/* ============================================================================ */}
          {/* EXECUTIVE DASHBOARD - KEY METRICS */}
          {/* ============================================================================ */}
          <div className="bg-gradient-to-r from-[#C0C5CB] to-[#A8ADB3] rounded-2xl shadow-2xl p-8 border-2 border-black">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-black flex items-center gap-3">
                  <Zap className="w-8 h-8 text-[#C8E63D]" />
                  Executive Dashboard
                </h1>
                <p className="text-black/80 mt-1 font-medium">Real-time operational intelligence & system health</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-black/60 uppercase tracking-wide font-bold">System Health</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-3 h-3 rounded-full ${healthColors[metrics.systemHealth]} animate-pulse`}></div>
                    <span className="text-sm font-bold text-black capitalize">{metrics.systemHealth}</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowWhatsNew(true)}
                  className="bg-[#C8E63D] hover:bg-[#A8C230] text-black px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center space-x-2 border-2 border-black"
                >
                  <span>✨</span>
                  <span>What's New</span>
                </button>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Patients"
                value={metricsLoading ? '...' : metrics.totalPatients}
                icon={<Users className="w-6 h-6 text-white" />}
                color="bg-[#1BA39C]"
                trend={{ value: '+5.2%', isPositive: true }}
              />
              <MetricCard
                title="Active Today"
                value={metricsLoading ? '...' : metrics.activePatients}
                icon={<Activity className="w-6 h-6 text-white" />}
                color="bg-[#158A84]"
                trend={{ value: '+12%', isPositive: true }}
              />
              <MetricCard
                title="Today's Revenue"
                value={metricsLoading ? '...' : `$${metrics.todayRevenue.toLocaleString()}`}
                icon={<DollarSign className="w-6 h-6 text-white" />}
                color="bg-[#C8E63D]"
                badge="Live"
              />
              <MetricCard
                title="Pending Tasks"
                value={metricsLoading ? '...' : metrics.pendingTasks}
                icon={<Clock className="w-6 h-6 text-white" />}
                color="bg-[#6B7280]"
              />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-white/90 rounded-lg p-4 border-2 border-black flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#6B7280] uppercase font-bold">Security Score</p>
                  <p className="text-2xl font-bold text-black">{metricsLoading ? '...' : metrics.securityScore}%</p>
                </div>
                <Shield className={`w-8 h-8 ${metrics.securityScore >= 90 ? 'text-green-600' : metrics.securityScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`} />
              </div>
              <div className="bg-white/90 rounded-lg p-4 border-2 border-black flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#6B7280] uppercase font-bold">Active Users</p>
                  <p className="text-2xl font-bold text-black">{metricsLoading ? '...' : metrics.activeUsers}</p>
                </div>
                <Users className="w-8 h-8 text-[#1BA39C]" />
              </div>
              <div className="bg-white/90 rounded-lg p-4 border-2 border-black flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#6B7280] uppercase font-bold">Pending Claims</p>
                  <p className="text-2xl font-bold text-black">{metricsLoading ? '...' : metrics.pendingClaims}</p>
                </div>
                <FileText className="w-8 h-8 text-[#C8E63D]" />
              </div>
            </div>
          </div>

          {/* ============================================================================ */}
          {/* TABBED NAVIGATION */}
          {/* ============================================================================ */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-[#E8F8F7] border-b-2 border-black">
              <div className="flex gap-2 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-6 py-3 rounded-lg font-bold transition-all flex items-center gap-2 whitespace-nowrap border-2 ${
                      activeTab === tab.key
                        ? 'bg-[#1BA39C] text-white border-black shadow-lg'
                        : 'bg-white text-black border-black/20 hover:border-[#1BA39C]'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    type="text"
                    placeholder="Search sections..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border-2 border-black rounded-lg text-sm focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C] transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================================ */}
          {/* TAB CONTENT - OVERVIEW */}
          {/* ============================================================================ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Actions Bar */}
              <div className="bg-gradient-to-r from-[#C0C5CB] to-[#A8ADB3] rounded-xl shadow-2xl p-6 border-2 border-black">
                <div className="flex items-center justify-between mb-4">
              <h2 className="text-black text-xl font-bold flex items-center gap-2">
                <span className="text-[#1BA39C]">⚡</span>
                Quick Actions
              </h2>
              <button
                onClick={() => setShowWhatsNew(true)}
                className="bg-[#C8E63D] hover:bg-[#A8C230] text-black px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center space-x-2 border-2 border-black"
                title="View recent updates"
              >
                <span>✨</span>
                <span>What's New</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <button
                onClick={() => navigate('/admin/enroll-senior')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">➕</span>
                Enroll Senior
              </button>
              <button
                onClick={() => navigate('/admin/bulk-enroll')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">👥</span>
                Bulk Enroll
              </button>
              <button
                onClick={() => navigate('/admin/bulk-export')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">📤</span>
                Bulk Export
              </button>
              <button
                onClick={() => navigate('/admin/photo-approval')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">📸</span>
                Approve Photos
              </button>
              <button
                onClick={() => navigate('/admin-questions')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">💬</span>
                Questions
              </button>
              <button
                onClick={() => navigate('/admin-profile-editor')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">✏️</span>
                Edit Profiles
              </button>
            </div>
          </div>

          {/* Patient Engagement Dashboard - CRITICAL FOR RISK ASSESSMENT */}
          <CollapsibleSection
            title="Patient Engagement & Risk Assessment"
            subtitle="Monitor senior activity levels to identify at-risk patients - includes trivia, games, check-ins, questions"
            icon="📊"
            headerColor="text-[#1BA39C]"
            defaultOpen={false}
          >
            <PatientEngagementDashboard />
          </CollapsibleSection>

          {/* SmartScribe Atlus - Revenue-Critical AI Transcription */}
          <CollapsibleSection
            title="SmartScribe Atlus 💰"
            subtitle="AI-powered transcription with Claude Sonnet 4.5 for maximum billing accuracy"
            icon="🎤"
            headerColor="text-[#C8E63D]"
          >
            <SmartScribe />
          </CollapsibleSection>

          {/* Project Atlus: CCM Autopilot */}
          <CollapsibleSection
            title="CCM Autopilot - Chronic Care Management"
            subtitle="Automatic tracking of 20+ minute patient interactions for CCM billing"
            icon="⏱️"
            headerColor="text-[#1BA39C]"
          >
            <CCMTimeline />
          </CollapsibleSection>

          {/* Project Atlus: Revenue Dashboard */}
          <CollapsibleSection
            title="Revenue Dashboard - Project Atlus"
            subtitle="Real-time revenue analytics and optimization opportunities"
            icon="💰"
            headerColor="text-[#C8E63D]"
          >
            <RevenueDashboard />
          </CollapsibleSection>

          {/* Project Atlus: Claims Submission */}
          <CollapsibleSection
            title="Claims Submission Center"
            subtitle="Generate and submit 837P claims to clearinghouses"
            icon="📋"
            headerColor="text-[#1BA39C]"
          >
            <ClaimsSubmissionPanel />
          </CollapsibleSection>

          {/* Project Atlus: Claims Appeals */}
          <CollapsibleSection
            title="Claims Appeals & Resubmission"
            subtitle="AI-assisted appeal letters for denied claims"
            icon="🔄"
            headerColor="text-[#158A84]"
          >
            <ClaimsAppealsPanel />
          </CollapsibleSection>

          {/* SDOH Billing Encoder */}
          <CollapsibleSection
            title="SDOH Billing Encoder"
            subtitle="Social determinants of health-aware medical coding"
            icon="🏥"
            headerColor="text-[#1BA39C]"
          >
            <SDOHCoderAssist
              encounterId="demo-encounter-id"
              patientId="demo-patient-id"
              onSaved={(data) => auditLogger.clinical('CODING_SAVED', true, { encounterId: 'demo-encounter-id', patientId: 'demo-patient-id' })}
            />
          </CollapsibleSection>

          {/* FHIR Analytics Dashboard */}
          <CollapsibleSection
            title="AI-Enhanced FHIR Analytics"
            subtitle="Real-time patient insights and clinical decision support"
            icon="🧠"
            headerColor="text-[#1BA39C]"
          >
            <FhirAiDashboard
              supabaseUrl={process.env.REACT_APP_SUPABASE_URL || ''}
              supabaseKey={process.env.REACT_APP_SUPABASE_ANON_KEY || ''}
            />
          </CollapsibleSection>

          {/* FHIR Tools Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CollapsibleSection
              title="FHIR Questionnaire Builder"
              subtitle="Create standardized clinical questionnaires using AI"
              icon="📝"
              headerColor="text-[#1BA39C]"
            >
              <FHIRFormBuilderEnhanced />
            </CollapsibleSection>

            <CollapsibleSection
              title="FHIR Data Mapper"
              subtitle="Transform legacy data into FHIR-compliant formats"
              icon="🔄"
              headerColor="text-[#158A84]"
            >
              <FHIRDataMapper />
            </CollapsibleSection>

            {/* Hospital EHR/EMR Adapter Management */}
            <CollapsibleSection
              title="Hospital EHR/EMR Integrations"
              subtitle="Connect to Epic, Cerner, Athenahealth, and other hospital systems"
              icon="🏥"
              headerColor="text-[#1BA39C]"
              defaultOpen={false}
            >
              <HospitalAdapterManagementPanel />
            </CollapsibleSection>
          </div>

          {/* Billing Dashboard */}
          <CollapsibleSection
            title="Billing & Claims Management"
            subtitle="Monitor claims processing and revenue tracking"
            icon="💳"
            headerColor="text-[#C8E63D]"
          >
            <BillingDashboard />
          </CollapsibleSection>

          {/* Patient Handoff System */}
          <CollapsibleSection
            title="Patient Handoff System"
            subtitle="Secure transfer of care between facilities - HIPAA compliant audit trail"
            icon="🏥"
            headerColor="text-[#1BA39C]"
          >
            <AdminTransferLogs showExportButton={true} />
          </CollapsibleSection>

          {/* SOC 2 Compliance & Security Monitoring */}
          <CollapsibleSection
            title="SOC 2 Executive Summary"
            subtitle="High-level security posture and compliance overview for leadership"
            icon="📊"
            headerColor="text-[#2D3339]"
            defaultOpen={false}
          >
            <SOC2ExecutiveDashboard />
          </CollapsibleSection>

          <CollapsibleSection
            title="Security Operations Center"
            subtitle="Real-time security monitoring, threat detection, and event tracking"
            icon="🛡️"
            headerColor="text-[#158A84]"
            defaultOpen={false}
          >
            <SOC2SecurityDashboard />
          </CollapsibleSection>

          <CollapsibleSection
            title="Audit & Compliance Center"
            subtitle="PHI access logs, audit trails, and SOC 2 compliance status"
            icon="📋"
            headerColor="text-[#1BA39C]"
            defaultOpen={false}
          >
            <SOC2AuditDashboard />
          </CollapsibleSection>

          <CollapsibleSection
            title="Incident Response Center"
            subtitle="Security incident investigation queue with SLA tracking"
            icon="🚨"
            headerColor="text-[#C8E63D]"
            defaultOpen={false}
          >
            <SOC2IncidentResponseDashboard />
          </CollapsibleSection>

          <CollapsibleSection
            title="System Administration"
            subtitle="Infrastructure health, database monitoring, active sessions, and system metrics"
            icon="⚙️"
            headerColor="text-[#2D3339]"
            defaultOpen={false}
          >
            <SystemAdminDashboard />
          </CollapsibleSection>

          {/* Core Admin Functions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CollapsibleSection
              title="User Management"
              subtitle="Manage patient and staff accounts"
              icon="👥"
              headerColor="text-[#1BA39C]"
            >
              <UsersList />
            </CollapsibleSection>

            <CollapsibleSection
              title="Reports & Analytics"
              subtitle="System-wide analytics and insights"
              icon="📊"
              headerColor="text-[#1BA39C]"
            >
              <ReportsSection />
            </CollapsibleSection>
          </div>

          {/* Data Export */}
          <CollapsibleSection
            title="Data Export & Advanced Tools"
            subtitle="Export data and access advanced administrative functions"
            icon="📤"
            headerColor="text-[#158A84]"
          >
            <ExportCheckIns />
          </CollapsibleSection>

          {/* Super Admin Only Features */}
          {adminRole === 'super_admin' && (
            <CollapsibleSection
              title="Super Admin Features"
              subtitle="Advanced system administration and AI testing"
              icon="🔐"
              headerColor="text-black"
            >
              <div className="bg-[#E8F8F7] rounded-lg p-6 border border-black">
                <h3 className="text-lg font-bold text-black mb-4 flex items-center">
                  <span className="mr-2">🧠</span>
                  Claude AI Service Test
                </h3>
                <p className="text-[#158A84] text-sm mb-4 font-medium">Test and validate AI service integration</p>
                <ClaudeTestWidget />
              </div>
            </CollapsibleSection>
          )}

          {/* API Key Manager - Moved to Bottom as requested */}
          {adminRole === 'super_admin' && (
            <CollapsibleSection
              title="API Key Manager"
              subtitle="Generate and manage API keys for system integrations"
              icon="🔑"
              headerColor="text-[#C8E63D]"
            >
              <ApiKeyManager />
            </CollapsibleSection>
          )}
            </div>
          )}

          {/* ============================================================================ */}
          {/* TAB CONTENT - CLINICAL */}
          {/* ============================================================================ */}
          {activeTab === 'clinical' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="Patient Engagement & Risk Assessment"
                subtitle="Monitor senior activity levels to identify at-risk patients"
                icon="📊"
                headerColor="text-[#1BA39C]"
                defaultOpen={true}
              >
                <PatientEngagementDashboard />
              </CollapsibleSection>

              <CollapsibleSection
                title="SmartScribe Atlus"
                subtitle="AI-powered clinical documentation with Claude Sonnet 4.5"
                icon="🎤"
                headerColor="text-[#C8E63D]"
              >
                <SmartScribe />
              </CollapsibleSection>

              <CollapsibleSection
                title="FHIR Analytics Dashboard"
                subtitle="Real-time patient insights and clinical decision support"
                icon="🧠"
                headerColor="text-[#1BA39C]"
              >
                <FhirAiDashboard
                  supabaseUrl={process.env.REACT_APP_SUPABASE_URL || ''}
                  supabaseKey={process.env.REACT_APP_SUPABASE_ANON_KEY || ''}
                />
              </CollapsibleSection>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CollapsibleSection
                  title="FHIR Questionnaire Builder"
                  subtitle="Create standardized clinical questionnaires"
                  icon="📝"
                  headerColor="text-[#1BA39C]"
                >
                  <FHIRFormBuilderEnhanced />
                </CollapsibleSection>

                <CollapsibleSection
                  title="FHIR Data Mapper"
                  subtitle="Transform legacy data into FHIR formats"
                  icon="🔄"
                  headerColor="text-[#158A84]"
                >
                  <FHIRDataMapper />
                </CollapsibleSection>
              </div>

              <CollapsibleSection
                title="Patient Handoff System"
                subtitle="Secure transfer of care between facilities"
                icon="🏥"
                headerColor="text-[#1BA39C]"
              >
                <AdminTransferLogs showExportButton={true} />
              </CollapsibleSection>

              <CollapsibleSection
                title="Hospital EHR/EMR Integrations"
                subtitle="Connect to Epic, Cerner, Athenahealth, and other systems"
                icon="🏥"
                headerColor="text-[#1BA39C]"
              >
                <HospitalAdapterManagementPanel />
              </CollapsibleSection>
            </div>
          )}

          {/* ============================================================================ */}
          {/* TAB CONTENT - BILLING */}
          {/* ============================================================================ */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="Revenue Dashboard - Project Atlus"
                subtitle="Real-time revenue analytics and optimization opportunities"
                icon="💰"
                headerColor="text-[#C8E63D]"
                defaultOpen={true}
                badge={`$${metrics.todayRevenue.toLocaleString()}`}
              >
                <RevenueDashboard />
              </CollapsibleSection>

              <CollapsibleSection
                title="CCM Autopilot - Chronic Care Management"
                subtitle="Automatic tracking of 20+ minute patient interactions"
                icon="⏱️"
                headerColor="text-[#1BA39C]"
              >
                <CCMTimeline />
              </CollapsibleSection>

              <CollapsibleSection
                title="Claims Submission Center"
                subtitle="Generate and submit 837P claims to clearinghouses"
                icon="📋"
                headerColor="text-[#1BA39C]"
                badge={metrics.pendingClaims}
              >
                <ClaimsSubmissionPanel />
              </CollapsibleSection>

              <CollapsibleSection
                title="Claims Appeals & Resubmission"
                subtitle="AI-assisted appeal letters for denied claims"
                icon="🔄"
                headerColor="text-[#158A84]"
              >
                <ClaimsAppealsPanel />
              </CollapsibleSection>

              <CollapsibleSection
                title="SDOH Billing Encoder"
                subtitle="Social determinants of health-aware medical coding"
                icon="🏥"
                headerColor="text-[#1BA39C]"
              >
                <SDOHCoderAssist
                  encounterId="demo-encounter-id"
                  patientId="demo-patient-id"
                  onSaved={(data) => auditLogger.clinical('CODING_SAVED', true, { encounterId: 'demo-encounter-id', patientId: 'demo-patient-id' })}
                />
              </CollapsibleSection>

              <CollapsibleSection
                title="Billing & Claims Management"
                subtitle="Monitor claims processing and revenue tracking"
                icon="💳"
                headerColor="text-[#C8E63D]"
              >
                <BillingDashboard />
              </CollapsibleSection>
            </div>
          )}

          {/* ============================================================================ */}
          {/* TAB CONTENT - SECURITY */}
          {/* ============================================================================ */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="SOC 2 Executive Summary"
                subtitle="High-level security posture and compliance overview"
                icon="📊"
                headerColor="text-[#2D3339]"
                defaultOpen={true}
                badge={`${metrics.securityScore}%`}
              >
                <SOC2ExecutiveDashboard />
              </CollapsibleSection>

              <CollapsibleSection
                title="Security Operations Center"
                subtitle="Real-time security monitoring and threat detection"
                icon="🛡️"
                headerColor="text-[#158A84]"
              >
                <SOC2SecurityDashboard />
              </CollapsibleSection>

              <CollapsibleSection
                title="Audit & Compliance Center"
                subtitle="PHI access logs and SOC 2 compliance status"
                icon="📋"
                headerColor="text-[#1BA39C]"
              >
                <SOC2AuditDashboard />
              </CollapsibleSection>

              <CollapsibleSection
                title="Incident Response Center"
                subtitle="Security incident investigation queue"
                icon="🚨"
                headerColor="text-[#C8E63D]"
              >
                <SOC2IncidentResponseDashboard />
              </CollapsibleSection>
            </div>
          )}

          {/* ============================================================================ */}
          {/* TAB CONTENT - ADMIN */}
          {/* ============================================================================ */}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="System Administration"
                subtitle="Infrastructure health and database monitoring"
                icon="⚙️"
                headerColor="text-[#2D3339]"
                defaultOpen={true}
              >
                <SystemAdminDashboard />
              </CollapsibleSection>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CollapsibleSection
                  title="User Management"
                  subtitle="Manage patient and staff accounts"
                  icon="👥"
                  headerColor="text-[#1BA39C]"
                  badge={metrics.totalPatients}
                >
                  <UsersList />
                </CollapsibleSection>

                <CollapsibleSection
                  title="Reports & Analytics"
                  subtitle="System-wide analytics and insights"
                  icon="📊"
                  headerColor="text-[#1BA39C]"
                >
                  <ReportsSection />
                </CollapsibleSection>
              </div>

              <CollapsibleSection
                title="Data Export & Advanced Tools"
                subtitle="Export data and access advanced functions"
                icon="📤"
                headerColor="text-[#158A84]"
              >
                <ExportCheckIns />
              </CollapsibleSection>

              {adminRole === 'super_admin' && (
                <CollapsibleSection
                  title="Super Admin Features"
                  subtitle="Advanced system administration and AI testing"
                  icon="🔐"
                  headerColor="text-black"
                >
                  <div className="bg-[#E8F8F7] rounded-lg p-6 border border-black">
                    <h3 className="text-lg font-bold text-black mb-4 flex items-center">
                      <span className="mr-2">🧠</span>
                      Claude AI Service Test
                    </h3>
                    <p className="text-[#158A84] text-sm mb-4 font-medium">Test and validate AI service integration</p>
                    <ClaudeTestWidget />
                  </div>
                </CollapsibleSection>
              )}

              {adminRole === 'super_admin' && (
                <CollapsibleSection
                  title="API Key Manager"
                  subtitle="Generate and manage API keys for integrations"
                  icon="🔑"
                  headerColor="text-[#C8E63D]"
                >
                  <ApiKeyManager />
                </CollapsibleSection>
              )}
            </div>
          )}

        </div>
      </div>
    </RequireAdminAuth>
  );
};

export default AdminPanel;